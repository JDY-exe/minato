# yuan.tokyo

- Tokens: `src/minato-design/styles/tokens.css`; reuse Minato components.
- Palette: `#E0FBFC`, `#C2DFE3`, `#9DB4C0`, `#5C6B73`, `#253237`; accent `#00B8C4`.
- Type: Source Sans 3 / Noto Sans JP body; Newsreader / Hina Mincho display; Google Sans Code mono.
- Preserve the logos' writing grid, outlined glyphs and worn vector rules; use `currentColor`.
- Homepage: full-viewport dithered clouds, a large noninteractive Logo at upper left, scattered Blog / About / Reach out boxes and a smaller theme switch. No footer, borders or visible scrollbar.
- MP4 clouds are dithered live with 2×2 Bayer dots over a flat sky: light ink `#9DB4C0`, dark ink `#5C6B73`. Subtracted box backgrounds use distinct slate-700/900 colors with white display text. Preserve the source dither and viewport alignment across every overlay; never independently resample its mask.
- Hover/focus expands a box from its center and hides siblings and logo; touch toggles sections. Active labels gain an aqua underline and bracketed arrow, except the theme switch has no arrow. Support keyboard input, Escape and reduced motion.
- Japanese labels use Hina Mincho with IME-like typing and a cloud-aligned tidal palette: 700/900 in light mode, 100/300 in dark mode. They replay on activation, stay readable without flicker and never intercept input. The theme prompt is centered; its Moon/Sun icon sits snugly beside the English label.
- Active boxes ease cloud exposure to 120% in light mode or 80% in dark mode; keep the sky flat and restore exposure on close. The theme switch names the destination mode, persists the choice and closes on activation.
- Manual scrolling controls cloud time; idle playback resumes after two seconds and reverses at the ends. Pause for input, hidden/offscreen content and reduced motion; retain static posters as fallback. Contain overscroll and horizontal overflow while preserving vertical input.
