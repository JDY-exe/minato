import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useTheme } from '../../minato-design';
import { cloudProfiles } from '../CloudHero/cloud-settings';

type RGB = [number, number, number];

function rgb(value: string): RGB {
  return value.startsWith('#')
    ? [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16)) as RGB
    : value.match(/[\d.]+/g)!.slice(0, 3).map(Number) as RGB;
}

function subtractionColors(ink: RGB, sky: RGB, palette: RGB[]) {
  const distance = (source: RGB, candidate: RGB) => candidate.reduce((sum, channel, index) => sum + (channel - (255 - source[index])) ** 2, 0);
  // Assign distinct colors jointly so quantization
  // cannot collapse both sides of the dither mask to the same palette entry.
  let best = { ink: palette[0], sky: palette[1], distance: Infinity };
  for (const inkColor of palette) for (const skyColor of palette) {
    if (inkColor === skyColor) continue;
    const score = distance(ink, inkColor) + distance(sky, skyColor);
    if (score < best.distance) best = { ink: inkColor, sky: skyColor, distance: score };
  }
  return { ink: `rgb(${best.ink.join(' ')})`, sky: `rgb(${best.sky.join(' ')})` };
}

/** Recolor the cloud's binary alpha mask, preserving its pixels and exact palette tokens. */
export function PaletteDifference({ target, textTarget, active, sections }: {
  target: RefObject<HTMLElement | null>;
  textTarget: RefObject<HTMLElement | null>;
  active: string | null;
  sections: readonly string[];
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const animate = useRef<() => void>(() => {});
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const mapped = document.createElement('canvas');
    const paint = mapped.getContext('2d')!;
    const textMapped = document.createElement('canvas');
    const textPaint = textMapped.getContext('2d')!;
    const root = getComputedStyle(document.documentElement);
    const palette = [700, 900].map(shade => rgb(root.getPropertyValue(`--mn-slate-${shade}`).trim()));
    const textPalette = (resolvedTheme === 'light' ? [700, 900] : [100, 300])
      .map(shade => rgb(root.getPropertyValue(`--mn-tidal-${shade}`).trim()));
    const hero = document.querySelector<HTMLElement>('.cloud-hero')!;
    let frame = 0, refresh = 0, until = 0, disposed = false, live = false;
    let observedText: HTMLElement | null = null;
    let textVersion = 0, requestedVersion = -1, textPending = false, textCover = false, textReady = false;
    // Retain the decoded Image as well as its URL so CSS can reuse its image cache.
    let textRaster: { image: HTMLImageElement; url: string; width: number; height: number; cover: boolean } | null = null;
    const layout = new ResizeObserver(draw);

    function prepareTextImage() {
      if (textPending || requestedVersion === textVersion) return;
      textPending = true;
      requestedVersion = textVersion;
      const image = new Image();
      const raster = { image, url: textMapped.toDataURL(), width: textMapped.width, height: textMapped.height, cover: textCover };
      image.src = raster.url;
      void image.decode().then(() => {
        if (disposed) return;
        textPending = false;
        textRaster = raster;
        drawText();
      }).catch(() => {
        // Keep the last decoded raster (or the solid tidal fallback) on failure.
        if (disposed) return;
        textPending = false;
        if (requestedVersion !== textVersion) drawText();
      });
    }

    function drawText() {
      const text = textTarget.current;
      if (text !== observedText) {
        if (observedText) layout.unobserve(observedText);
        observedText = text;
        if (text) layout.observe(text);
      }
      if (!text || !textReady) return;
      // Coalesce incoming frames during decode, and never install an undecoded
      // background under transparent glyphs. Keep the previous image visible.
      prepareTextImage();
      if (!textRaster) return;
      const rect = text.getBoundingClientRect();
      const scale = textRaster.cover ? Math.max(innerWidth / textRaster.width, innerHeight / textRaster.height) : 1;
      const width = textRaster.cover ? textRaster.width * scale : innerWidth;
      const height = textRaster.cover ? textRaster.height * scale : innerHeight;
      text.style.backgroundImage = `url("${textRaster.url}")`;
      text.style.backgroundSize = `${width}px ${height}px`;
      text.style.backgroundPosition = `${(innerWidth - width) / 2 - rect.left}px ${(innerHeight - height) / 2 - rect.top}px`;
      text.dataset.paletteReady = '';
    }

    function draw() {
      const boxes = target.current?.querySelectorAll<HTMLElement>('.home-section');
      boxes?.forEach((box, index) => {
        const output = canvases.current[index];
        if (!output) return;
        const rect = box.getBoundingClientRect();
        output.style.opacity = getComputedStyle(box).opacity;
        // Clip in CSS pixels, after the browser scales the original cloud raster.
        output.style.clipPath = `inset(${rect.top}px ${innerWidth - rect.right}px ${innerHeight - rect.bottom}px ${rect.left}px)`;
      });
      drawText();
    }

    function recolor(source: HTMLCanvasElement | HTMLImageElement, cover = false) {
      const sourceInk = rgb(cloudProfiles[resolvedTheme].ink ?? getComputedStyle(hero.querySelector('.cloud-hero__stage')!).color);
      // Match poster dimming and the live dark theme's dimmed highlight ink.
      if (cover || resolvedTheme === 'dark') {
        const exposureScale = Number(hero.dataset.exposureScale ?? 1);
        sourceInk.forEach((channel, index) => { sourceInk[index] = channel * exposureScale; });
      }
      const sourceSky = rgb(getComputedStyle(document.documentElement).getPropertyValue('--mn-surface').trim());
      const { ink, sky } = subtractionColors(sourceInk, sourceSky, palette);
      const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      mapped.width = width;
      mapped.height = height;
      paint.imageSmoothingEnabled = false;
      paint.globalCompositeOperation = 'source-over';
      paint.drawImage(source, 0, 0);
      paint.globalCompositeOperation = 'source-in';
      paint.fillStyle = ink; paint.fillRect(0, 0, mapped.width, mapped.height);
      paint.globalCompositeOperation = 'destination-over';
      paint.fillStyle = sky; paint.fillRect(0, 0, mapped.width, mapped.height);
      const textColors = subtractionColors(sourceInk, sourceSky, textPalette);
      textMapped.width = width;
      textMapped.height = height;
      textPaint.imageSmoothingEnabled = false;
      textPaint.drawImage(source, 0, 0);
      textPaint.globalCompositeOperation = 'source-in';
      textPaint.fillStyle = textColors.ink; textPaint.fillRect(0, 0, width, height);
      textPaint.globalCompositeOperation = 'destination-over';
      textPaint.fillStyle = textColors.sky; textPaint.fillRect(0, 0, width, height);
      textCover = cover;
      textVersion++;
      textReady = true;
      for (const output of canvases.current) {
        if (!output) continue;
        output.width = width; output.height = height;
        output.dataset.source = cover ? 'poster' : 'animation';
        output.getContext('2d')!.drawImage(mapped, 0, 0);
      }
      draw();
    }

    function onFrame(event: Event) {
      live = true;
      // Capture synchronously, before WebGL discards its drawing buffer.
      recolor((event as CustomEvent<HTMLCanvasElement>).detail);
    }
    const poster = new Image();
    poster.onload = () => { if (!disposed && !live) refresh = requestAnimationFrame(resize); };
    poster.src = `${import.meta.env.BASE_URL}clouds/${resolvedTheme === 'light' ? 'poster-light.webp' : 'poster.webp'}`;
    function tick() { draw(); frame = performance.now() < until ? requestAnimationFrame(tick) : 0; }
    animate.current = () => {
      until = performance.now() + 400;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    function resize() { if (!live && poster.complete && poster.naturalWidth) recolor(poster, true); else draw(); }
    window.addEventListener('cloud-frame', onFrame);
    window.addEventListener('resize', resize);
    target.current?.querySelectorAll('.home-section').forEach(box => layout.observe(box));
    void document.fonts.ready.then(() => { if (!disposed) draw(); });
    const state = new MutationObserver(() => {
      if (hero.dataset.state === 'static') { live = false; resize(); }
    });
    state.observe(hero, { attributes: true, attributeFilter: ['data-state', 'data-exposure-scale'] });
    const theme = new MutationObserver(() => { if (!live) { cancelAnimationFrame(refresh); refresh = requestAnimationFrame(resize); } });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(refresh); animate.current = () => {};
      state.disconnect();
      theme.disconnect();
      layout.disconnect();
      window.removeEventListener('cloud-frame', onFrame);
      window.removeEventListener('resize', resize);
    };
  }, [resolvedTheme, target, textTarget]);

  useEffect(() => { animate.current(); }, [active]);
  return <>{sections.map((section, index) => <canvas key={section}
    ref={element => { canvases.current[index] = element; }} className="home-palette-background" aria-hidden="true" />)}</>;
}
