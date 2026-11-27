import { useEffect, useRef, useState } from 'react';
import { createCloudRenderer } from './cloud-renderer';
import type { CloudManifest } from './cloud-renderer';
import { useTheme } from '../../minato-design';
import { cloudProfiles } from './cloud-settings';

const assetBase = `${import.meta.env.BASE_URL}clouds/`;

export function CloudHero({ exposureScale = 1 }: { exposureScale?: number }) {
  const { resolvedTheme } = useTheme();
  const section = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'static'>('loading');
  const [generation, setGeneration] = useState(0);
  const [animatedExposure, setAnimatedExposure] = useState(exposureScale);
  const currentExposure = useRef(exposureScale);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const from = currentExposure.current;
    let pending = 0;
    const start = performance.now();
    let lastUpdate = start;
    function update(value: number) {
      currentExposure.current = value;
      setAnimatedExposure(value);
    }
    function finish() {
      cancelAnimationFrame(pending);
      update(exposureScale);
    }
    function preferenceChanged() { if (motion.matches || document.hidden) finish(); }
    if (motion.matches || document.hidden || from === exposureScale) {
      update(exposureScale);
      return;
    }
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / 300);
      // Bound expensive subtraction-raster updates to 30fps during the tween.
      const canUpdate = now - lastUpdate >= 1000 / 30 - 0.5;
      if (canUpdate) {
        const eased = 1 - (1 - progress) ** 3;
        update(progress === 1 ? exposureScale : from + (exposureScale - from) * eased);
        lastUpdate = now;
      }
      if (progress < 1 || !canUpdate) pending = requestAnimationFrame(tick);
    }
    pending = requestAnimationFrame(tick);
    motion.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', preferenceChanged);
    return () => {
      cancelAnimationFrame(pending);
      motion.removeEventListener('change', preferenceChanged);
      document.removeEventListener('visibilitychange', preferenceChanged);
    };
  }, [exposureScale]);
  const settings = cloudProfiles[resolvedTheme];
  const options = useRef({ settings, mode: resolvedTheme, exposureScale: animatedExposure });
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    options.current = { settings, mode: resolvedTheme, exposureScale: animatedExposure };
    redraw.current();
  }, [settings,resolvedTheme,animatedExposure]);

  useEffect(() => {
    const container = section.current!, element = canvas.current!, viewport = stage.current!;
    const controller = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer: ReturnType<typeof createCloudRenderer> | undefined;
    let ready = false, visible = true, pending = 0, disposed = false, lost = false;
    let frameCount = 0;
    const canAnimate = () => !disposed && !lost && ready && visible && !document.hidden && !motion.matches;
    function scrollFrame() {
      const rect = container.getBoundingClientRect();
      const range = Math.max(1,container.offsetHeight-viewport.clientHeight);
      return Math.round(Math.max(0,Math.min(1,-rect.top/range))*(frameCount-1));
    }
    function paint(frame: number) {
      // Read after the theme's CSS has resolved, including system/storage changes.
      const ink = getComputedStyle(viewport).color.match(/[\d.]+/g)!.slice(0,3).map(channel => Number(channel)/255);
      const { settings,mode,exposureScale } = options.current;
      const shadows = settings.shading === 'shadows' || (settings.shading === 'auto' && mode === 'light');
      if (renderer?.draw(frame, viewport.clientWidth, viewport.clientHeight, ink, settings, shadows, exposureScale)) {
        window.dispatchEvent(new CustomEvent('cloud-frame', { detail: element }));
      }
      element.dataset.frame = String(frame);
    }
    function schedule() {
      if (pending || !canAnimate()) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        if (!canAnimate()) return;
        paint(scrollFrame());
      });
    }
    function visibilityChanged() {
      if (canAnimate()) schedule();
      else { cancelAnimationFrame(pending); pending = 0; }
    }
    function motionChanged() { setGeneration(n => n+1); }
    function contextLost(event: Event) {
      event.preventDefault(); lost = true; ready = false;
      cancelAnimationFrame(pending); pending = 0;
      renderer?.invalidate(); controller.abort(); setState('static');
    }
    function contextRestored() { setGeneration(n => n+1); }
    const resize = new ResizeObserver(schedule);
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; visibilityChanged(); });
    const theme = new MutationObserver(schedule);
    redraw.current = schedule;
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    motion.addEventListener('change', motionChanged);
    element.addEventListener('webglcontextlost', contextLost);
    element.addEventListener('webglcontextrestored', contextRestored);
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', visibilityChanged);
    resize.observe(viewport); intersection.observe(container);

    async function load() {
      if (motion.matches) { setState('static'); return; }
      setState('loading');
      const response = await fetch(`${assetBase}manifest.json`, { signal: controller.signal });
      if (!response.ok) throw new Error('Cloud manifest unavailable');
      const manifest: CloudManifest = await response.json();
      if (disposed || lost) return;
      if (manifest.version !== 3 || manifest.encoding !== 'lightness-opacity') throw new Error('Unsupported cloud assets');
      // Select once per mount: resize must not restart asset downloads.
      const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
      const variant = mobile ? manifest.variants.mobile : manifest.variants.desktop;
      frameCount = variant.count;
      element.dataset.variant = mobile ? 'mobile' : 'desktop';
      renderer = createCloudRenderer(element, variant);
      const scratch = document.createElement('canvas');
      const context = scratch.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Image decoding unavailable');
      // Decode sequentially so only one temporary RGBA page exists at a time.
      try {
        for (const [index, page] of variant.pages.entries()) {
          const asset = await fetch(assetBase+page.file, { signal: controller.signal });
          if (!asset.ok) throw new Error('Cloud atlas unavailable');
          const bitmap = await createImageBitmap(await asset.blob(), { colorSpaceConversion: 'none' });
          try {
            if (disposed || lost) return;
            if (bitmap.width !== page.width || bitmap.height !== page.height) throw new Error('Invalid cloud atlas dimensions');
            scratch.width = page.width; scratch.height = page.height;
            context.drawImage(bitmap,0,0);
            const rgba = context.getImageData(0,0,page.width,page.height).data;
            const channels = new Uint8Array(page.width*page.height*2);
            for (let i=0; i<page.width*page.height; i++) { channels[i*2] = rgba[i*4]; channels[i*2+1] = rgba[i*4+1]; }
            renderer!.upload(index, channels);
          } finally { bitmap.close(); }
          // Yield between pages, without leaving an unmount-blocking promise.
          await new Promise(resolve => setTimeout(resolve,0));
        }
      } finally { scratch.width = scratch.height = 1; }
      if (disposed || lost) return;
      ready = true;
      // Paint before revealing the canvas, including if the visitor already scrolled.
      paint(scrollFrame());
      setState('ready'); schedule();
    }
    void load().catch(error => {
      if (disposed || lost) return;
      ready = false; renderer?.dispose(); renderer = undefined;
      setState('static');
      console.warn('Cloud animation is using its static poster.', error);
    });
    return () => {
      disposed = true; controller.abort(); cancelAnimationFrame(pending);
      redraw.current = () => {};
      renderer?.dispose(); resize.disconnect(); intersection.disconnect(); theme.disconnect();
      motion.removeEventListener('change', motionChanged);
      element.removeEventListener('webglcontextlost', contextLost);
      element.removeEventListener('webglcontextrestored', contextRestored);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [generation]);

  return <section ref={section} className="cloud-hero" aria-label="Summer clouds" data-state={state} data-exposure-scale={animatedExposure}>
    <link rel="preload" as="image" href={`${assetBase}${resolvedTheme === 'light' ? 'poster-light.webp' : 'poster.webp'}`} fetchPriority="high" />
    <div ref={stage} className="cloud-hero__stage" style={{ color: settings.ink ?? undefined }}>
      <div className="cloud-hero__poster" role="img" aria-label="Towering summer clouds drawn in monochrome dots." style={{ maskImage: `url("${assetBase}${resolvedTheme === 'light' ? 'poster-light.webp' : 'poster.webp'}")`, filter: `brightness(${animatedExposure})` }} />
      <canvas ref={canvas} className="cloud-hero__canvas" aria-hidden="true" />
    </div>
  </section>;
}
