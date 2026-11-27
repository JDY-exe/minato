# yuan.tokyo

- Tokens: `src/minato-design/styles/tokens.css`; reuse Minato components.
- Palette: `#E0FBFC`, `#C2DFE3`, `#9DB4C0`, `#5C6B73`, `#253237`; accent `#00B8C4`.
- Type: Source Sans 3 / Noto Sans JP body; Newsreader / Hina Mincho display; Google Sans Code mono.
- Preserve the active LogoAlt writing grid, outlined glyphs and worn vector rules. Use `currentColor`.
- Hero: cloud-only 2×2 Bayer dots; flat sky. Light ink `#9DB4C0`, dark ink `#5C6B73`; approved profiles live beside CloudHero.
- Homepage layers a large Logo in the upper left and three scattered Blog, About and Reach out boxes over the animation. Rectangular backgrounds subtract cloud colors from white, then jointly map ink and sky to the closest distinct assignment of slate-700 and slate-900 by RGB distance. This preserves readable white lettering and a visible dither pattern in both themes. No borders. Hover or keyboard focus expands the active box and hides its siblings. Touch toggles About and Reach out. Preserve the uncluttered canvas, without a footer or visible scrollbar.
- Scrolling alone controls cloud time; stopping holds the frame. Preserve reduced-motion posters, accessibility and responsive layouts.
- Contain homepage scrolling at both ends: disable overscroll bounce and horizontal overflow without disabling vertical scroll input.
- Palette box backgrounds retain the source raster's native dimensions and binary alpha mask. Apply the cloud layer's CSS pixelated scaling, then clip in viewport coordinates; never resample or threshold the dither mask separately.
- The homepage logo is noninteractive and fades out with the other boxes whenever a section is active. All boxes expand from their centers.
- Homepage boxes and Japanese labels form a scattered group around the central cloud area. About → プロフィール sits above/right of its box, Blog → ブログ below/left, and Reach out → ご連絡 above/left. Labels use Hina Mincho display text, replay on activation, follow keyboard/touch activation too, and never intercept input.
- Japanese labels clip a separately recolored cloud raster to their DOM glyphs: tidal-700/900 in light mode, tidal-100/300 in dark mode. Preserve the source dither and viewport alignment through typing, scroll, and resize; button backgrounds keep their slate palette.
- Keep the last decoded text raster visible until the next image has decoded; coalesce incoming cloud frames during decoding to avoid blank glyphs while scrolling.
- Append an aqua bracketed upper-right arrow to the active English section label using simple timers: start 0.5 seconds after Japanese typing starts, then reveal `[`, `↗`, `]` at the same keystroke pace and jitter as JaAnimText. Cancel/reset on close; reduced motion reveals all three immediately.
- Active sections sweep an aqua underline beneath the English label and reduce live cloud lightness to 80% before dithering, without advancing cloud time or reloading atlases. Dark-mode highlight ink also dims to 80% so solid cloud areas visibly darken. Static posters dim their masked ink to 80%; the flat sky stays unchanged. Restore on close and keep subtraction layers aligned with the actual displayed ink.
- Ease cloud hover exposure in and out over 300ms, updating at most 30fps only during the transition. Interrupted transitions continue from the current exposure; reduced motion and hidden documents settle immediately.
- A fourth, smaller homepage difference box sits left of About and just below Reach out, switches to the opposite theme, and persists the choice. Its hover/focus prompt types ダークモードに切り替えますか or ライトモードに切り替えますか at title size; keep the prompt centered and responsive. Clicking clears hover/focus/selected state and closes the prompt. Minato ThemeSelect is removed.
