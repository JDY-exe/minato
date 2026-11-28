import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ElementType } from 'react';
import { Text } from '../Text';
import type { TextProps } from '../Text';
import { romajiToKana } from './romaji';

export type JaAnimTextSegment = { text: string; typing: string };
export type JaAnimTextTimings = {
  startDelay: number;
  keystroke: number;
  jitter: number;
  conversionDelay: number;
  segmentDelay: number;
};
type WithoutChildren<P> = P extends unknown ? Omit<P, 'children'> : never;
export type JaAnimTextProps<T extends ElementType = 'span'> = WithoutChildren<TextProps<T>> & {
  segments: readonly JaAnimTextSegment[];
  /** False resets to empty; true starts a fresh run. Defaults to true. */
  playing?: boolean;
  timings?: Partial<JaAnimTextTimings>;
  underline?: boolean;
};

const defaults: JaAnimTextTimings = { startDelay: 250, keystroke: 95, jitter: 30, conversionDelay: 280, segmentDelay: 160 };
const motionQuery = '(prefers-reduced-motion: reduce)';
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
type Frame = { committed: string; composition: string; delay: number };

/** IME-like playback. Each segment commits exactly the supplied text, without inference. */
export function JaAnimText<T extends ElementType = 'span'>({
  segments, playing = true, timings, underline = true, className = '', lang = 'ja', ...props
}: JaAnimTextProps<T>) {
  // Inline arrays with equal content must not restart an in-flight composition.
  const previousSegments = useRef(segments);
  if (segments.length !== previousSegments.current.length || segments.some((segment, index) =>
    segment.text !== previousSegments.current[index].text || segment.typing !== previousSegments.current[index].typing)) {
    previousSegments.current = segments;
  }
  const stableSegments = previousSegments.current;
  const timing = (key: keyof JaAnimTextTimings) => {
    const value = timings?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : defaults[key];
  };
  const startDelay = timing('startDelay'), keystroke = timing('keystroke'), jitter = timing('jitter');
  const conversionDelay = timing('conversionDelay'), segmentDelay = timing('segmentDelay');
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, () => true);
  const playback = useMemo(() => {
    const frames: Frame[] = [];
    let committed = '';
    let pendingDelay = startDelay;
    for (const { text, typing } of stableSegments) {
      const letters = Array.from(typing);
      let prefix = '';
      for (const [index, letter] of letters.entries()) {
        prefix += letter;
        frames.push({ committed, composition: romajiToKana(prefix, index === letters.length - 1), delay: pendingDelay + keystroke });
        pendingDelay = 0;
      }
      committed += text;
      frames.push({ committed, composition: '', delay: letters.length ? conversionDelay : pendingDelay });
      pendingDelay = segmentDelay;
    }
    return { frames, fullText: stableSegments.map(item => item.text).join(''), jitter };
  }, [stableSegments, startDelay, keystroke, jitter, conversionDelay, segmentDelay]);
  const { frames, fullText } = playback;
  const [progress, setProgress] = useState({ playback, index: -1 });

  useEffect(() => {
    setProgress({ playback, index: -1 });
    if (!playing || reducedMotion || !frames.length) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    function schedule(index: number) {
      const frame = playback.frames[index];
      if (!frame) return;
      const jitter = frame.composition ? (Math.random() * 2 - 1) * playback.jitter : 0;
      timer = setTimeout(() => {
        if (cancelled) return;
        setProgress({ playback, index });
        schedule(index + 1);
      }, Math.max(0, frame.delay + jitter));
    }
    schedule(0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playback, playing, reducedMotion]);

  const index = progress.playback === playback ? progress.index : -1;
  const complete = playing && (reducedMotion || !frames.length || index === frames.length - 1);
  const frame = playing && index >= 0 ? frames[index] : undefined;
  return <Text<T> {...props as TextProps<T>} lang={lang} className={`mn-ja-anim-text ${className}`.trim()}>
    {complete ? fullText : <>
      <span className="mn-ja-anim-text__accessible">{fullText}</span>
      <span aria-hidden="true">{frame?.committed}<span className={underline ? 'mn-ja-anim-text__composition' : undefined}>{frame?.composition}</span></span>
    </>}
  </Text>;
}
