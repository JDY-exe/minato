# Minato

A personal site built with Vite, React, TypeScript, and Minato: a custom, lightweight design system inspired by [Material 3 Expressive](https://m3.material.io/).

The site is **yuan.tokyo**. The current ten-second cloud animation is available as [MP4](.clouds/exports/cloud.mp4) and [GIF](.clouds/exports/cloud.gif). Blender sources, scripts and render caches live locally in `.clouds/` and are ignored; only those two exports are versioned. Website integration is deferred. Read [HANDOFF.md](HANDOFF.md) before continuing cloud work.

## Run

Requires Node 22.12+ and npm.

```sh
npm install
npm run dev
```

`npm run build` typechecks and builds to `dist/`. `npm run preview` serves that build. `npm run typecheck` checks TypeScript independently.

## Structure

```text
src/
  minato-design/
    components/       # Custom React components
    styles/           # Semantic tokens, base styles, component styles
    theme/            # Light/dark/system preference and persistence
    index.ts          # Public component exports
  pages/
    main/index.tsx    # Personal homepage starter
    blog/index.tsx    # Blog starter
    design-system/    # Interactive component reference
  App.tsx             # Page selection and shared navigation
  main.tsx            # React entry point
  site.css            # Site layouts, separate from the design system
```

## Using Minato

```tsx
import { Button, Surface, TextField } from './minato-design';

<Surface tone="primary">
  <TextField label="Name" />
  <Button>Save</Button>
</Surface>
```

Import `minato-design/styles/index.css` once at the app entry. Wrap the app in `ThemeProvider`. `ThemeSelect` offers light, dark, and system modes; preferences persist locally and sync across tabs. The early theme initializer in `index.html` applies the preference before React mounts.

Edit `styles/tokens.css` to change Minato’s colors, spacing, typography, shapes, and interaction timing. Components use native HTML semantics and accept native attributes, including refs. No component framework, CSS-in-JS runtime, icon library, router, or animation library is installed. React and React DOM are the only runtime dependencies.

## Pages

Add folders beneath `src/pages/` and register their paths in `src/App.tsx`. Navigation currently uses native links and full page loads. A static host must rewrite page URLs such as `/blog` to `index.html`; Vite handles this in development and preview. Choose a router when the site needs client-side navigation, nested layouts, or route data.

The homepage and blog are intentionally starter content. No biography or posts have been invented. Minato currently includes Text, Button, Surface, TextField, Switch, ThemeSelect, and ThemeProvider. Its palette is authored, not dynamically generated from a seed, and its CSS transitions are a lightweight starting point rather than Material's full spring physics system.

## Typography

```tsx
import { Text } from './minato-design';

<Text as="h1" variant="display" lang="en">Minato</Text>
<Text as="h2" variant="title" lang="ja">みなと</Text>
<Text as="p" size="large" weight="medium" italic>Made with care.</Text>
<Text as="code" variant="mono" size="small">const minato = true;</Text>
```

`Text` defaults to a body-style `span`. `as` controls the HTML element independently of appearance and supports its native props and ref. `lang` follows HTML inheritance, including regional tags such as `ja-JP`.

| Variant | English | Japanese | Sizes | Weights |
| --- | --- | --- | --- | --- |
| `body` | Source Sans 3 | Noto Sans JP | `small` 14px, `medium` 16px, `large` 20px | `regular` 400, `medium` 500, `bold` 700 |
| `title` | Newsreader | Hina Mincho | 40px, fluid down to 32px | 400 |
| `display` | Newsreader | Hina Mincho | 72px, fluid down to 48px | 400 |
| `mono` | Google Sans Code | Noto Sans JP glyph fallback | Same as body | Same as body |

All variants accept `italic`. English uses native italic faces where available; Japanese stays upright as requested. Display/title reject size and weight overrides in TypeScript. Japanese glyph fallback within code is not guaranteed to be monospaced.

All five Google Fonts are self-hosted with Unicode subsets and their licenses in `src/minato-design/fonts/`. Newsreader includes regular and italic faces at weight 400, with automatic optical sizing.

The five exact palette colors are exposed as `--mn-slate-50`, `--mn-slate-200`, `--mn-slate-500`, `--mn-slate-700`, and `--mn-slate-900`. Semantic theme roles reference them, with mixed surface tones and separate error colors. Preview all variants at `/design-system`.

Tidal blue `#00B8C4` is the tertiary accent (`--mn-tertiary`), paired with `--mn-on-tertiary` for text on filled accents. Use it for fills rather than small text on light surfaces. Tertiary containers use `#B6F2F4` in light mode and `#004F57` in dark mode. Dark surface levels are `#10191D`, `#162126`, `#1C292F`, and `#28383F`, from background to highest container.

## Site logo

`src/components/Logo.tsx` renders the yuan.tokyo mark as an accessible inline SVG. Pass `decorative` inside an already-labeled link. Its `currentColor` ink adapts to the surrounding theme. A standalone transparent SVG is available at `public/yuan-tokyo.svg` and via the download link on `/design-system`.

Grid rules have uneven vector edges and two larger breaks and a few tiny ink losses for a worn print appearance. A fixed seed in the generator makes these imperfections repeatable, and the effect works with either ink color.

The 2 × 3 writing grid contains `。/東/京` on the left and `ユ/ア/ン` on the right. The Japanese period uses upper-right placement for vertical writing. Glyphs are Hina Mincho outlines, so no font request is needed to render the logo. The SIL OFL license is in `src/minato-design/fonts/hinamincho-OFL.txt`.

To regenerate both outputs, install Python `fonttools` in a temporary environment and run `python scripts/build-logo.py /path/to/HinaMincho-Regular.ttf`. Keep the logo in site-specific components; Minato remains the design system's name.

The alternate surname mark is `public/yuan-tokyo-alt.svg`, rendered inline by `src/components/LogoAlt.tsx`. It uses a compact 2 × 2 grid, with 東/京 in the left column and 袁/。 in the right. Both outputs regenerate with the same build script. The alternate surname mark is the active header logo. The original SVG and React component are retained.
