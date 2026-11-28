import { Logo } from '../../components/Logo';
import { LogoAlt } from '../../components/LogoAlt';
import { useState } from 'react';
import { Button, JaAnimText, Surface, Switch, Text, TextField } from '../../minato-design';

export function DesignSystemPage() {
  const [checked, setChecked] = useState(true);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [typing, setTyping] = useState(true);
  const [typingRun, setTypingRun] = useState(0);
  const [slowTyping, setSlowTyping] = useState(false);
  return <>
    <section className="page-intro"><Text as="h1" variant="display">Meet Minato.</Text><p>A small, custom design system inspired by Material 3 Expressive. Semantic colors, generous shapes, and components you can make your own.</p></section>
    <section className="specimen"><h2>yuan.tokyo</h2>
      <p>A worn two-column writing grid: ユアン on the right, 。東京 on the left. Hina Mincho letterforms are outlined for consistent rendering.</p>
      <div className="logo-previews">
        <div className="logo-preview logo-preview--light"><Logo width="162" height="201" /></div>
        <div className="logo-preview logo-preview--dark"><Logo width="162" height="201" /></div>
      </div>
      <a href={`${import.meta.env.BASE_URL}yuan-tokyo.svg`} download="yuan-tokyo.svg">Download SVG logo</a>
    </section>
    <section className="specimen"><h2>Alternate mark</h2>
      <p>A compact two-by-two grid: 東/京 on the left, the surname 袁 and 。 on the right. This is the active site logo; the original mark is preserved above.</p>
      <div className="logo-previews">
        <div className="logo-preview logo-preview--light"><LogoAlt width="216" height="188" /></div>
        <div className="logo-preview logo-preview--dark"><LogoAlt width="216" height="188" /></div>
      </div>
      <a href={`${import.meta.env.BASE_URL}yuan-tokyo-alt.svg`} download="yuan-tokyo-alt.svg">Download alternate SVG logo</a>
    </section>
    <section className="specimen"><h2>Color & surface</h2><p>Paired foregrounds keep each tonal surface readable in both themes.</p>
      <div className="swatches">{(['primary', 'secondary', 'tertiary', 'low', 'default', 'high'] as const).map(tone => <Surface key={tone} tone={tone}>{tone}</Surface>)}</div>
    </section>
    <section className="specimen"><h2>Buttons</h2><p>Four levels of emphasis. Press a button to see its shape change.</p><div className="component-row">
      <Button onClick={() => setSaved(value => !value)}>{saved ? 'Saved' : 'Save example'}</Button>
      <Button variant="tonal">Tonal</Button><Button variant="outlined">Outlined</Button><Button variant="text">Text</Button><Button disabled>Disabled</Button><Button loading>Loading</Button>
    </div><p role="status">{saved ? 'Example saved for this session.' : 'Try the save button.'}</p></section>
    <section className="specimen"><h2>Inputs</h2><div className="input-examples">
      <TextField label="Display name" placeholder="Your name" value={name} onChange={event => setName(event.target.value)} hint="A local example; nothing is submitted." />
      <TextField label="Email" type="email" defaultValue="hello@" error="Enter a complete email address, such as name@example.com." />
      <Switch label="Enable example setting" checked={checked} onChange={event => setChecked(event.target.checked)} />
      <Switch label="Unavailable setting" disabled />
    </div></section>
    <section className="specimen"><h2>The palette</h2><p>Tidal blue adds a vibrant tertiary accent, with softer tonal containers for each theme.</p>
      <div className="palette-strip">{['e0fbfc', 'c2dfe3', '9db4c0', '5c6b73', '253237', '00b8c4'].map((hex, index) => <div key={hex} style={{ background: `#${hex}`, color: index < 3 || index === 5 ? '#253237' : '#e0fbfc' }}><Text variant="mono" size="small">#{hex.toUpperCase()}</Text></div>)}</div>
    </section>
    <section className="specimen ja-anim-specimen"><h2>Japanese IME text</h2>
      <p>Letters become kana, then commit to the supplied text. Only the active segment is underlined.</p>
      <div className="ja-anim-specimen__preview">
        <JaAnimText key={typingRun} as="p" variant="display" playing={typing}
          segments={[{ text: '東', typing: 'tou' }, { text: '京', typing: 'kyou' }]}
          timings={slowTyping ? { keystroke: 180, jitter: 35, conversionDelay: 500 } : undefined} />
      </div>
      <div className="component-row">
        <Button onClick={() => setTyping(value => !value)}>{typing ? 'Reset typing' : 'Start typing'}</Button>
        <Button variant="outlined" onClick={() => { setTyping(true); setTypingRun(value => value + 1); }}>Replay typing</Button>
        <Switch label="Slower typing" checked={slowTyping} onChange={event => setSlowTyping(event.target.checked)} />
      </div>
      <pre className="ja-anim-specimen__code"><code>{`<JaAnimText\n  segments={[{ text: '東', typing: 'tou' }, { text: '京', typing: 'kyou' }]}\n  playing={playing}\n  timings={{ keystroke: 95, jitter: 30, conversionDelay: 280 }}\n/>`}</code></pre>
    </section>
    <section className="specimen"><h2>Bilingual typography</h2>
      <p>English display uses Newsreader. All five Google Fonts are self-hosted. Japanese remains upright, including when italic is requested.</p>
      <div className="type-columns">{(['en', 'ja'] as const).map(lang => <div className="type-column" lang={lang} key={lang}>
        <Text as="h3" variant="title">{lang === 'en' ? 'A quiet expression.' : '静かな表現。'}</Text>
        <Text as="p" variant="title" italic>{lang === 'en' ? 'A little character.' : '文字に、個性を。'}</Text>
        <Text as="p" variant="display">{lang === 'en' ? 'Minato' : 'みなと'}</Text>
        <Text as="p" variant="display" italic>{lang === 'en' ? 'Minato' : 'みなと'}</Text>
        {(['small', 'medium', 'large'] as const).map(size => <div className="type-sample" key={size}>
          <Text as="p" variant="mono" size="small">{size} / {size === 'small' ? '14' : size === 'medium' ? '16' : '20'}px</Text>
          {(['regular', 'medium', 'bold'] as const).map(weight => <div key={weight}>
            <Text as="p" size={size} weight={weight}>{lang === 'en' ? `Thoughtfully made. ${weight}` : `心を込めて、つくる。 ${weight}`}</Text>
            <Text as="p" size={size} weight={weight} italic>{lang === 'en' ? `Thoughtfully made. ${weight} italic` : `心を込めて、つくる。 ${weight}`}</Text>
          </div>)}
        </div>)}
      </div>)}</div>
    </section>
    <section className="specimen"><h2>Google Sans Code</h2>
      {(['small', 'medium', 'large'] as const).map(size => <div className="type-sample" key={size}>
        {(['regular', 'medium', 'bold'] as const).map(weight => <div key={weight}>
          <Text as="p" variant="mono" size={size} weight={weight}>{`const minato = "${size} / ${weight}";`}</Text>
          <Text as="p" variant="mono" size={size} weight={weight} italic>{`const minato = "${size} / ${weight} italic";`}</Text>
        </div>)}
      </div>)}
    </section>
  </>;
}
