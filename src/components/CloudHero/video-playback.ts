import { createCloudRenderer } from './cloud-renderer';
import type { CloudVideoSource } from './cloud-renderer';
import type { CloudSettings } from './cloud-settings';

type Options = { settings: CloudSettings; mode: 'light' | 'dark'; exposureScale: number };
type State = 'loading' | 'ready' | 'static';

/** Own media seeking and transport; the renderer and overlays still share one cloud mask. */
export function createVideoPlayback({ container, canvas, viewport, getOptions, onState, restart }: {
  container: HTMLElement; canvas: HTMLCanvasElement; viewport: HTMLElement;
  getOptions: () => Options; onState: (state: State) => void; restart: () => void;
}) {
  const controller = new AbortController();
  const { signal } = controller;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
  // Keep the media in the rendering tree for WebKit's presentation callbacks.
  video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
  viewport.append(video);
  const hasFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  let renderer: ReturnType<typeof createCloudRenderer> | undefined;
  let disposed = false, failed = false, lost = false, visible = true, ready = false, touching = false;
  let mode: 'waiting' | 'forward' | 'reverse' = 'waiting';
  let direction = 1, fps = 30, end = 0, displayedTime = 0;
  let idleTimer = 0, reverseTimer = 0, frameCallback = 0, fallbackFrame = 0, paintFrame = 0;
  let pendingSeek: number | null = null, seeking = false, expectedScroll: number | null = null;
  let reverseTarget = 0, reverseClock = 0, frameGeneration = 0;
  const allowed = () => !disposed && !failed && !lost && !motion.matches;
  const canPlay = () => allowed() && ready && visible && !document.hidden && !touching;
  const tolerance = () => 0.5/fps;

  function stopIdle() {
    clearTimeout(idleTimer); clearTimeout(reverseTimer);
    idleTimer = reverseTimer = 0;
    mode = 'waiting';
    video.pause();
    cancelVideoFrames();
    cancelAnimationFrame(fallbackFrame); fallbackFrame = 0;
  }
  function releaseMedia() {
    cancelVideoFrames();
    video.pause(); video.removeAttribute('src'); video.load();
  }
  function fail(error: unknown) {
    if (disposed || failed || lost) return;
    failed = true; ready = false;
    stopIdle(); releaseMedia(); renderer?.dispose(); renderer = undefined;
    cancelAnimationFrame(paintFrame); paintFrame = 0;
    onState('static');
    console.warn('Cloud video is using its static poster.', error);
  }
  function timeFromScroll() {
    const range = Math.max(1, container.offsetHeight-viewport.clientHeight);
    return Math.max(0, Math.min(1, -container.getBoundingClientRect().top/range))*end;
  }
  function syncScroll() {
    const range = Math.max(0, container.offsetHeight-viewport.clientHeight);
    const start = container.getBoundingClientRect().top + scrollY;
    expectedScroll = start + range * displayedTime/Math.max(end, 0.001);
    window.scrollTo({ top: expectedScroll, behavior: 'instant' });
  }
  function paint() {
    if (!allowed() || !ready || !visible || document.hidden) return;
    try {
      const { settings, mode: theme, exposureScale } = getOptions();
      const ink = getComputedStyle(viewport).color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value => value/255);
      const shadows = settings.shading === 'shadows' || (settings.shading === 'auto' && theme === 'light');
      if (renderer?.draw(Math.round(displayedTime*fps), viewport.clientWidth, viewport.clientHeight, ink, settings, shadows, exposureScale)) {
        window.dispatchEvent(new CustomEvent('cloud-frame', { detail: canvas }));
      }
      canvas.dataset.time = String(displayedTime);
      canvas.dataset.frame = String(Math.round(displayedTime*fps));
    } catch (error) { fail(error); }
  }
  function redraw() {
    if (paintFrame || !allowed()) return;
    paintFrame = requestAnimationFrame(() => { paintFrame = 0; paint(); });
  }
  function capture(time: number) {
    if (!allowed() || !renderer || video.seeking || video.readyState < 2 || !visible || document.hidden) return;
    try {
      if (!renderer.uploadVideo(video)) return;
      displayedTime = Math.max(0, Math.min(end, time));
      const first = !ready;
      ready = true; paint();
      if (!allowed()) return;
      if (first) { onState('ready'); startIdle(); }
      if (mode !== 'waiting') syncScroll();
      if (mode === 'forward' && displayedTime >= end-tolerance()) beginReverse();
      else if (mode === 'reverse' && displayedTime <= tolerance()) { direction = 1; beginForward(); }
    } catch (error) { fail(error); }
  }
  function requestSeek(time: number) {
    pendingSeek = Math.max(0, Math.min(end, time));
    drainSeek();
  }
  function drainSeek() {
    if (!allowed() || seeking || video.seeking || video.readyState < 1 || pendingSeek === null) return;
    const target = pendingSeek;
    pendingSeek = null;
    if (Math.abs(video.currentTime-target) <= tolerance() && video.readyState >= 2) return;
    cancelVideoFrames();
    seeking = true;
    try { video.currentTime = target; } catch (error) { seeking = false; fail(error); }
  }
  function seeked() {
    seeking = false;
    capture(video.currentTime);
    drainSeek();
    if (mode === 'forward' && !seeking && pendingSeek === null) playForward();
  }
  function cancelVideoFrames() {
    frameGeneration++;
    if (frameCallback) video.cancelVideoFrameCallback(frameCallback);
    frameCallback = 0;
  }
  function scheduleVideoFrame() {
    if (!hasFrameCallback || frameCallback || !canPlay() || mode !== 'forward' || video.paused) return;
    const generation = frameGeneration;
    frameCallback = video.requestVideoFrameCallback((_now, metadata) => {
      // Cancellation may arrive after the browser queues a callback. Only seeks
      // and transport changes invalidate it; ordinary callback latency is valid.
      if (generation !== frameGeneration || !allowed()) return;
      frameCallback = 0;
      if (mode === 'forward' && !video.paused) capture(metadata.mediaTime);
      scheduleVideoFrame();
    });
  }
  function fallbackTick() {
    fallbackFrame = 0;
    if (!canPlay() || mode !== 'forward') return;
    if (Math.abs(video.currentTime-displayedTime) >= tolerance()) capture(video.currentTime);
    if (mode === 'forward') fallbackFrame = requestAnimationFrame(fallbackTick);
  }
  function playForward() {
    if (!canPlay() || mode !== 'forward' || seeking || pendingSeek !== null || !video.paused) return;
    void video.play().then(() => {
      if (!canPlay() || mode !== 'forward') video.pause();
      else if (hasFrameCallback) scheduleVideoFrame();
      else if (!fallbackFrame) fallbackFrame = requestAnimationFrame(fallbackTick);
    }).catch(error => { if (canPlay() && mode === 'forward') fail(error); });
  }
  function beginForward() {
    clearTimeout(reverseTimer); reverseTimer = 0;
    if (!canPlay()) return;
    mode = 'forward'; direction = 1;
    playForward();
  }
  function reverseTick() {
    reverseTimer = 0;
    if (!canPlay() || mode !== 'reverse') return;
    const now = performance.now();
    reverseTarget = Math.max(0, reverseTarget-Math.min(0.1, (now-reverseClock)/1000));
    reverseClock = now;
    requestSeek(reverseTarget);
    if (mode === 'reverse') reverseTimer = window.setTimeout(reverseTick, 1000/fps);
  }
  function beginReverse() {
    if (!canPlay()) return;
    video.pause(); cancelVideoFrames(); mode = 'reverse'; direction = -1;
    reverseTarget = displayedTime; reverseClock = performance.now();
    clearTimeout(reverseTimer);
    reverseTimer = window.setTimeout(reverseTick, 1000/fps);
  }
  function startIdle() {
    stopIdle();
    if (!canPlay()) return;
    idleTimer = window.setTimeout(() => {
      idleTimer = 0;
      if (!canPlay()) return;
      if (displayedTime >= end-tolerance()) direction = -1;
      else if (displayedTime <= tolerance()) direction = 1;
      if (direction === 1) beginForward(); else beginReverse();
    }, 2000);
  }
  function input() { expectedScroll = null; startIdle(); }
  function scrolled() {
    if (expectedScroll !== null && Math.abs(scrollY-expectedScroll) <= 1) return;
    input(); requestSeek(timeFromScroll());
  }
  function keydown(event: KeyboardEvent) {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) input();
  }
  function visibilityChanged() {
    if (!visible || document.hidden) stopIdle();
    else { capture(video.currentTime); startIdle(); }
  }
  const layout = new ResizeObserver(() => {
    if (mode !== 'waiting') syncScroll();
    else if (ready) requestSeek(timeFromScroll());
    redraw();
  });
  const intersection = new IntersectionObserver(entries => {
    const changed = visible !== entries[0].isIntersecting;
    visible = entries[0].isIntersecting;
    if (changed) visibilityChanged();
  });
  // Context listeners survive media failure/loss so the browser can recover.
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; ready = false;
    stopIdle(); renderer?.invalidate(); releaseMedia(); onState('static');
  }, { signal });
  canvas.addEventListener('webglcontextrestored', restart, { signal });
  motion.addEventListener('change', restart, { signal });
  window.addEventListener('scroll', scrolled, { passive: true, signal });
  window.addEventListener('wheel', input, { passive: true, signal });
  window.addEventListener('keydown', keydown, { signal });
  window.addEventListener('touchstart', () => { touching = true; stopIdle(); }, { passive: true, signal });
  window.addEventListener('touchmove', input, { passive: true, signal });
  const touchEnded = () => { touching = false; startIdle(); };
  window.addEventListener('touchend', touchEnded, { passive: true, signal });
  window.addEventListener('touchcancel', touchEnded, { passive: true, signal });
  document.addEventListener('visibilitychange', visibilityChanged, { signal });
  video.addEventListener('seeked', seeked, { signal });
  video.addEventListener('error', () => fail(video.error), { signal });
  video.addEventListener('ended', beginReverse, { signal });
  video.addEventListener('loadedmetadata', () => {
    end = Math.max(0, video.duration-1/fps);
    requestSeek(timeFromScroll());
  }, { signal });
  video.addEventListener('loadeddata', () => {
    if (!seeking && pendingSeek === null) capture(video.currentTime);
    else drainSeek();
  }, { signal });
  layout.observe(viewport); intersection.observe(container);

  async function load() {
    if (motion.matches) { onState('static'); return; }
    onState('loading');
    const response = await fetch(`${import.meta.env.BASE_URL}clouds/video.json`, { signal });
    if (!response.ok) throw new Error('Cloud video metadata unavailable');
    const source: CloudVideoSource = await response.json();
    if (!allowed()) return;
    if (source.kind !== 'video' || !(source.fps > 0) || !(source.duration > 0)) throw new Error('Invalid cloud video metadata');
    fps = source.fps; end = Math.max(0, source.duration-1/fps);
    renderer = createCloudRenderer(canvas, source);
    canvas.dataset.variant = 'video';
    video.src = `${import.meta.env.BASE_URL}clouds/${source.file}`;
    video.load();
  }
  void load().catch(error => { if (!disposed) fail(error); });
  return {
    redraw,
    dispose() {
      disposed = true; controller.abort(); stopIdle(); releaseMedia(); video.remove();
      cancelAnimationFrame(paintFrame);
      renderer?.dispose(); layout.disconnect(); intersection.disconnect();
      delete canvas.dataset.time;
    },
  };
}
