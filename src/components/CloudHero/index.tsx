import { useEffect, useRef, useState } from 'react';
import { createVideoPlayback } from './video-playback';
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
    const playback = createVideoPlayback({
      container, canvas: element, viewport, getOptions: () => options.current,
      onState: setState, restart: () => setGeneration(n => n+1),
    });
    redraw.current = playback.redraw;
    return () => { redraw.current = () => {}; playback.dispose(); };
  }, [generation]);

  return <section ref={section} className="cloud-hero" aria-label="Summer clouds" data-state={state} data-exposure-scale={animatedExposure}>
    <link rel="preload" as="image" href={`${assetBase}${resolvedTheme === 'light' ? 'poster-light.webp' : 'poster.webp'}`} fetchPriority="high" />
    <div ref={stage} className="cloud-hero__stage" style={{ color: settings.ink ?? undefined }}>
      <div className="cloud-hero__poster" role="img" aria-label="Towering summer clouds drawn in monochrome dots." style={{ maskImage: `url("${assetBase}${resolvedTheme === 'light' ? 'poster-light.webp' : 'poster.webp'}")`, filter: `brightness(${animatedExposure})` }} />
      <canvas ref={canvas} className="cloud-hero__canvas" aria-hidden="true" />
    </div>
  </section>;
}
