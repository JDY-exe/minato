# Resume: yuan.tokyo clouds

Read this before cloud work. Current scope is Blender animation only; do not integrate the website until requested. The user has no modeling experience: explain controls simply.

## Storage decision (2026-11-25)

The user only uses Blender on this GPU PC. Keep all cloud work in `.clouds/`. Version only `.clouds/exports/cloud.mp4` and `.clouds/exports/cloud.gif`; Blender scenes, simulation/generation scripts, frames, studies, dependencies and caches stay local. Do not add native sources to Git or introduce Git LFS. This applies to cloud material; ordinary website source remains versioned.

The old `examples/clouds/` folder moved to `.clouds/studies/`. `scripts/clouds/` moved to `.clouds/scripts/`. Local scripts were updated; old cloud npm shortcuts were removed. Use `node .clouds/scripts/clouds.mjs <command>` from the repository root. Local details: `.clouds/README.md`. Previous detailed handoff and README are preserved in `.clouds/before-consolidation/`; their paths and job PIDs are historical.

## Current animation and jobs

- Complete ten-second review: `.clouds/exports/cloud.mp4` and `cloud.gif`, 384 x 240, 240 frames at 24 fps. These are current review exports, not finished website graphics. The animation is not seamless.
- Editable working scene: `.clouds/studies/manual-clouds/cloud.blend`. Preserve the user's approved manual adjustments. Regenerating from `scene.py` will not reconstruct them.
- Frozen ten-second render source: `.clouds/studies/manual-clouds/preview-10s/render-source.blend`, matching the master job's source. Approved travel speed is preserved; internal billowing evolves 3x faster.
- Low-resolution job `.clouds/master-10s-preview/` is complete, 240/240 verified. Its PNG sequence remains local.
- High-resolution job `.clouds/master-10s/` is explicitly PAUSED at 22/240 frames. Do not resume unless the user requests it. Preserve source, scene.json, fingerprint and completed frames without changes. Proposed master: 1280 x 800, 24 fps, 16-bit RGBA PNG, up to 32 adaptive samples, four volume bounces.
- Blender 5.3.0, RTX 4070 and OptiX are verified by actual renders. Blender MCP is connected. CPU rendering is disabled in the render helper.
- The starter is now `.clouds/scripts/start_master.ps1`. Existing render folders remain in place. Default delivery goes to `.clouds/studies/manual-clouds/`; copy reviewed final exports to `.clouds/exports/` explicitly.

## Visual direction and eventual site goal

Massive asymmetric summer clouds, many overlapping tufts, depth comparable to width, leftward billowing, chaotic local evolution with less overall translation. User liked the micro-morphing and approved manual shape adjustments. This is an art-directed procedural volume, not a physical simulation.

Eventually: full-page dithered hero, reversible scroll-controlled time, offline rendering and 10–20 curated randomly selected variants. Preserve yuan.tokyo's Minato identity, typography and palette: `#E0FBFC`, `#C2DFE3`, `#9DB4C0`, `#5C6B73`, `#253237`. Delivery format, dithering and player integration are future work, not authorized in the current Blender-only scope.
