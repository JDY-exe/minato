# Project guide

- React + TypeScript + Vite. Run `npm run dev` locally.
- Read [agents/DESIGN.md](agents/DESIGN.md) before visual changes.
- DESIGN.md is precious real estate: Only append important paradigms, not uncessary bloat.
- Each component in `src/components/` owns a directory with `index.tsx`; colocate its helpers and assets.
- Reuse `src/minato-design/`; keep page composition in `src/pages/` and `src/site.css`.
- Cloud profiles: `src/components/CloudHero/cloud-settings.json`. Regenerate fallback posters with `npm run clouds:prepare -- --posters-only` after profile changes.
- Validate with `npm run build`; run `npm run test:clouds` for cloud behavior changes (Playwright Chromium/WebKit required).
- Keep Blender sources/caches in `.clouds/`. Preserve approved scenes and paused renders unless requested otherwise.
