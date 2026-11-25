# Resume: yuan.tokyo procedural clouds

## User intent and working style

- Personal site: yuan.tokyo. Existing React + TypeScript + Vite app; Minato is its design system, not the site name. Preserve the logo, fonts, palette, and existing pages.
- Goal: a full-viewport hero featuring enormous, realistic summer cumulonimbus/cumulus towers, finished with dithering in the existing palette: `#E0FBFC`, `#C2DFE3`, `#9DB4C0`, `#5C6B73`, `#253237`.
- Scrolling forward advances/speeds cloud time; scrolling backward rewinds it. Offline rendering, a loading phase, and eventually 10–20 curated randomly encountered variants are acceptable. Exact scroll-position scrubbing was recommended; idle motion versus strict time reversibility is not finally settled.
- **Work on one piece at a time. Current scope is Blender animation only. Do not resume website integration until requested.** User has no modeling experience and no Houdini license. Explain Blender controls in beginner terms.
- Moving from an Apple Silicon Mac (16 GB) to a PC with an NVIDIA RTX 4070 and more RAM. PC OS is presumed Windows; verify.

## What is done

- Blender 5.3 and FFmpeg were installed on the Mac using Homebrew.
- `scripts/clouds/scene.py` generates an editable Blender scene with three layered procedural cloud volumes, an orthographic camera, sun, ambient world lighting, and animated shader parameters. Uses Cycles with multiple volume bounces and denoising.
- **This is an art-directed implicit density model, NOT a physical atmospheric simulation.** Ellipsoidal lobe fields are combined and eroded with 4D gradient noise. Worley detail, fluid growth, and a polished realistic silhouette are NOT implemented yet. The first draft looks soft/blob-like and needs refinement.
- Motion currently shifts lobe centers sideways/upward and changes the noise W parameter across frames 1–32. Draft is only 1.33 seconds at 24 fps. Extending the end frame alone does not retime these keys.
- One 640×400, 24-sample still was actually rendered and visually verified. The first Mac render took ~264 seconds including initial Metal compilation. Full rendered animation and sustained frame times have NOT been verified.
- Portable snapshot: `examples/clouds/seed-7/cloud.blend`; reference still: `examples/clouds/seed-7/frame-0001.png`. Snapshot predates the PC portability fixes and embeds Mac output/device settings. Regenerate it on the PC rather than rely on its render configuration.
- Blender GUI was opened in camera + Rendered mode on the Mac. Gray boxes in Solid mode are volume containers; checkerboard means transparent background.
- Website hero integration was started prematurely, then removed after the user requested incremental work. Homepage is still the original starter. No runtime shader, scroll controller, or cloud manifest is connected to the site.
- Existing site build/typecheck passed before handoff. No persistent Python environment is needed; scene script runs inside Blender's bundled Python.

## Files and commands

- `scripts/clouds/config.json`: seed candidates and draft/production quality presets. Candidates are **not a curated or rendered library**.
- `scripts/clouds/scene.py`: actual scene generator, density shader, lighting, keyframes, GPU selection, PNG renderer.
- `scripts/clouds/clouds.mjs`: Node CLI. Finds Blender using `BLENDER_BIN`, standard macOS/Windows locations, or PATH. Uses OptiX then CUDA on NVIDIA PCs, Metal on macOS, CPU fallback. Windows GPU path is implemented but not hardware-tested here.

```sh
npm ci
npm run clouds:doctor
npm run clouds:scene -- --seed 7       # Generate .blend only; no rendering
npm run clouds:preview -- --seed 7     # Render one still
npm run clouds:render -- --seed 7      # Render draft PNG sequence only
```

Outputs: `.clouds/draft-7/cloud.blend`, `.clouds/draft-7/frame-0001.png` etc. Still-preview output is `.clouds/draft-7-still/`. `.clouds/` is ignored by git.

`clouds:setup` currently installs automatically only on macOS. On Windows install official Blender and FFmpeg; auto-discovery checks `C:\Program Files\Blender Foundation\*\blender.exe`. If needed in PowerShell:

```powershell
$env:BLENDER_BIN = 'C:\Program Files\Blender Foundation\Blender 5.3\blender.exe'
npm run clouds:doctor
```

Adjust the path to the installed version. FFmpeg is only necessary for later encoding; scene generation and PNG rendering do not need it. In Blender GUI choose Edit → Preferences → System → Cycles Render Devices → OptiX and enable the 4070; Render Properties → Device → GPU Compute.

Other CLI commands: `clouds:catalog -- --count 6` renders candidate stills; `clouds:pack -- --seed 7` explicitly converts a completed sequence to web assets. **Do not run packaging/integration yet.** `--quality production` uses 1600×1000, 160 frames, 128 samples, 8 volume bounces. Start with draft.

## Immediate next steps

1. Verify Blender/OptiX detects the 4070. Generate the scene without rendering and open it.
2. Inspect one draft still, then compare frames 1/16/32. Establish actual render time before rendering the full clip.
3. Improve the cloud silhouette/detail/light together with the user. Add accessible named controls rather than expect them to navigate hundreds of generated nodes.
4. Make a longer, visibly evolving animation and render/play it fully. Current script is a prototype, not a finished simulation or production asset.

Useful current controls: sun strength 3.2; world strength 0.45; camera ortho scale 35; main density 1.6; noise scale 1.55/detail 3/roughness 0.62; erosion 0.65; anisotropy 0.35. Cloud objects are named `Main rising tower`, `Distant summer bank`, `Near cropped crown`. Transform scale and location work directly in Blender; finer controls currently live in source/shader nodes.

Blender viewing: hover viewport → F3 → View Camera; choose Rendered shading (rightmost sphere). Render → Render Image for a still. Set an output directory and Render → Render Animation, then Render → View Animation to play saved frames smoothly. Spacebar in a path-traced viewport is not equivalent to a pre-rendered clip.

## Important prototype limitations

- Existing PNGs are blindly reused when rerunning a seed/quality. After changing generator settings, use a new seed/output directory or remove that specific generated output directory; otherwise stale frames can mix. No source fingerprint yet.
- The saved `.blend` is regenerated by CLI runs; save manual experiments under another filename before running the generator again.
- Current renderer uses transparent RGBA PNGs; sky/background and artistic dithering are deferred. No video export command exists yet; `pack` exports WebP frames.
- Generated shader nodes are not laid out into a usable control panel. The density shape is evaluated procedurally inside box meshes, not represented by those meshes' visible surface.
- Prior still snapshot contains absolute Mac paths. New script sets the output path for the machine where it runs.

## Research and eventual direction

Prefer offline cloud generation and volumetric path tracing for realism, with lightweight final palette/dither rendering in browser later. Consider Perlin–Worley erosion for billows, explicit macro towers for silhouette, and air-parcel/moist-fluid simulation only if physical formation becomes necessary. Rewind can replay cached states; no reverse fluid solver needed. Delivery format (frame sequences versus seekable video), mobile framing, and memory/download budgets remain untested.

- Inspiration: https://jzhao.xyz/posts/dappled-light
- Horizon 2015: https://advances.realtimerendering.com/s2015/The%20Real-time%20Volumetric%20Cloudscapes%20of%20Horizon%20-%20Zero%20Dawn%20-%20ARTR.pdf
- Nubis³: https://www.guerrilla-games.com/read/nubis-cubed
- Noise implementation: https://github.com/sebh/TileableVolumeNoise
- Procedural Cloudscapes formulas: https://webanck.fr/publications/Webanck2018-supplementary_material.pdf
- Physical simulation: https://research.google/pubs/stormscapes-simulating-cloud-dynamics-in-the-now/

GitHub destination requested by user: `JDY-exe/minato`. Replace its current project contents with this project while preserving commit history; repository name stays minato.
