# Minato foundations

Minato is a custom React and CSS system inspired by Material 3 Expressive. It lives in `src/minato-design/`; page composition belongs in `src/pages/` and `src/site.css`.

## Tokens

`src/minato-design/styles/tokens.css` is the source of truth. All token names start with `--mn-`.

- Color: primary and paired foreground, primary/secondary/tertiary containers with paired foregrounds, surface levels, surface foregrounds, outlines, and error.
- Themes: light, dark, and system; `data-theme` on the root selects explicit colors. CSS provides the system fallback.
- Spacing: 4, 8, 12, 16, 24, 32, 48, and 64px.
- Shape: 8, 16, 28px, and full rounding. Buttons become less rounded when pressed.
- Type: display, headline, title, body, and label. Body: Source Sans 3 (English), Noto Sans JP (Japanese). Display: Newsreader (English, self-hosted regular and italic), Hina Mincho (Japanese). Mono: Google Sans Code. Body/mono sizes are 14/16/20px; weights 400/500/700. Title and display are responsive 40px/72px at weight 400. Native English italics are enabled; Japanese remains upright.
- Motion: 180ms CSS transitions with reduced-motion support. Full Material spring physics is not implemented.

## Components

Text offers body, title, display, and mono variants, typed element props, and language-aware families. Button provides filled, tonal, outlined, and text variants, three sizes, disabled, and loading states. Surface applies paired tonal colors. TextField connects labels and descriptions and supports errors. Switch uses a native checkbox with switch semantics. ThemeSelect controls the app-wide ThemeProvider.

Native HTML props pass through. Keep new components accessible using native elements where possible, expose their prop types through `index.ts`, and add examples to `src/pages/design-system/`.

## Scope

The main and blog pages contain clearly identified starter copy. Personal content, publishing pipeline, hosting target are open decisions. The base palette is #E0FBFC, #C2DFE3, #9DB4C0, #5C6B73, and #253237, with tidal blue #00B8C4 as the tertiary accent. Its paired foreground is #253237; use it for fills, not small text on light surfaces. Tertiary containers are #B6F2F4 / #004F57 in light/dark themes. Dark surfaces run from #10191D through #162126 and #1C292F to #28383F, retaining a blue undertone.

## Site identity

yuan.tokyo uses a thin-lined Japanese writing grid: two columns and three square cells, with narrow side rails and a central gutter. Horizontal guides are dashed. Grid rules have deterministic dry-ink edges, uneven thickness, and two larger tears and a few tiny ink losses inspired by worn printed writing paper. These are real vector contours; do not add raster noise filters or distress the glyphs. The left column is 。/東/京; the right is ユ/ア/ン. Hina Mincho glyphs are converted to SVG outlines. The period sits at the upper-right of its cell, following vertical text placement. Preserve the glyph shapes and cell order. Use currentColor with slate ink on light surfaces and pale ink on dark surfaces. The standalone asset is `public/yuan-tokyo.svg`; the inline component is `src/components/Logo.tsx`.

An alternate mark uses the same writing grid and worn rules in two rows: 東/京 on the left and 袁/。 on the right. 袁 is the confirmed surname Yuan, available directly in Hina Mincho. This is the active site logo. The original three-row SVG and component remain in the repository and design-system previews. Assets: `public/yuan-tokyo-alt.svg` and `src/components/LogoAlt.tsx`.
