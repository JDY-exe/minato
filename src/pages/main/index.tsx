import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { CloudHero } from '../../components/CloudHero';
import { Logo } from '../../components/Logo';
import { PaletteDifference } from '../../components/PaletteDifference';
import { JaAnimText, useTheme } from '../../minato-design';

const sections = ['Blog', 'About', 'Reach out', 'Theme'] as const;
type Section = typeof sections[number];
const japaneseLabels = {
  Blog: [{ text: 'ブログ', typing: 'burogu' }],
  About: [{ text: 'プロフィール', typing: 'purofi-ru' }],
  'Reach out': [{ text: 'ご連絡', typing: 'gorenraku' }],
};
const themePrompts = {
  dark: [{ text: 'ダークモード', typing: 'da-kumo-do' }, { text: 'に', typing: 'ni' }, { text: '切り替えますか', typing: 'kirikaemasuka' }],
  light: [{ text: 'ライトモード', typing: 'raitomo-do' }, { text: 'に', typing: 'ni' }, { text: '切り替えますか', typing: 'kirikaemasuka' }],
};
// Run the homepage labels at 1.5× the component's natural typing speed.
const japaneseLabelTimings = {
  startDelay: 250 / 1.5,
  keystroke: 95 / 1.5,
  jitter: 30 / 1.5,
  conversionDelay: 280 / 1.5,
  segmentDelay: 160 / 1.5,
};

export function MainPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === 'light' ? 'dark' : 'light';
  const navigation = useRef<HTMLElement>(null);
  const japaneseLabel = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState<Section | null>(null);
  const [focused, setFocused] = useState<Section | null>(null);
  const [selected, setSelected] = useState<Section | null>(null);
  const active = focused ?? hovered ?? selected;
  const activeKey = active === 'Theme' ? `Theme-${nextTheme}` : active;
  const [arrowProgress, setArrowProgress] = useState<{ section: Section; count: number } | null>(null);
  useEffect(() => {
    setArrowProgress(null);
    if (!active || active === 'Theme') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setArrowProgress({ section: active, count: 3 });
      return;
    }
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    function typeCharacter() {
      setArrowProgress({ section: active!, count: ++count });
      if (count < 3) {
        const delay = japaneseLabelTimings.keystroke + (Math.random() * 2 - 1) * japaneseLabelTimings.jitter;
        timer = setTimeout(typeCharacter, delay);
      }
    }
    timer = setTimeout(typeCharacter, 500);
    return () => clearTimeout(timer);
  }, [activeKey]);

  return <>
    <CloudHero exposureScale={active ? (resolvedTheme === 'light' ? 1.2 : 0.8) : 1} />
    <div className="home-composition" onKeyDown={event => {
      if (event.key === 'Escape') {
        setHovered(null);
        setFocused(null);
        setSelected(null);
        (event.target as HTMLElement).blur();
      }
    }}>
      <div className="home-logo" data-hidden={Boolean(active) || undefined} aria-hidden={Boolean(active) || undefined}><Logo /></div>
      {active && <JaAnimText key={activeKey} ref={japaneseLabel} className="home-japanese-label" variant={active === 'Theme' ? 'title' : 'display'}
        data-section={active} segments={active === 'Theme' ? themePrompts[nextTheme] : japaneseLabels[active]} timings={japaneseLabelTimings} aria-hidden="true" />}
      <PaletteDifference target={navigation} textTarget={japaneseLabel} active={active} sections={sections} />
      <nav ref={navigation} className="home-sections" aria-label="Explore yuan.tokyo" data-active={active || undefined}
        onPointerDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
        {sections.map((label, index) => {
          const text = label === 'Theme' ? `${nextTheme === 'dark' ? 'Dark' : 'Light'} mode` : label;
          const content = <>{label === 'Theme' && (nextTheme === 'dark'
            ? <Moon className="home-section__icon" strokeWidth={1.5} aria-hidden="true" focusable="false" />
            : <Sun className="home-section__icon" strokeWidth={1.5} aria-hidden="true" focusable="false" />)}
            <span className="home-section__label">{text}</span>{label !== 'Theme' && active === label && arrowProgress?.section === label &&
            <span className="home-section__arrow" aria-hidden="true">
              <svg viewBox="0 0 40 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" focusable="false">
                <path d="M8 3H3V25H8" />
                {arrowProgress.count >= 2 && <path d="M14 20L26 8M15 8H26V19" />}
                {arrowProgress.count >= 3 && <path d="M32 3H37V25H32" />}
              </svg>
            </span>}</>;
          const className = `home-section home-section--${index + 1}`;
          const interaction = {
            className,
            'data-expanded': active === label || undefined,
            onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType === 'mouse') setHovered(label); },
            onPointerLeave: () => setHovered(null),
            onFocus: (event: React.FocusEvent<HTMLElement>) => { if (event.currentTarget.matches(':focus-visible')) setFocused(label); },
            onBlur: () => setFocused(null),
          };
          return label === 'Blog'
            ? <a key={label} {...interaction} href="/blog">{content}</a>
            : <button key={label} {...interaction} type="button" aria-pressed={label === 'Theme' ? undefined : selected === label}
              onClick={event => {
                if (label === 'Theme') {
                  setTheme(nextTheme);
                  setSelected(null);
                  setHovered(null);
                  setFocused(null);
                  event.currentTarget.blur();
                  return;
                }
                setSelected(selected === label ? null : label);
              }}>{content}</button>;
        })}
      </nav>
    </div>
  </>;
}
