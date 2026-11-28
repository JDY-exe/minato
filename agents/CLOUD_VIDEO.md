# Cloud video playback

The homepage uses progressively loaded MP4 video and a live WebGL dither shader. Navigation and posters render before media is ready. Unsupported playback uses the poster. There is no atlas renderer or alternate query mode.

```sh
npm run clouds:prepare -- /absolute/path/to/cloud.mp4
npm run dev
# Only refresh posters after profile changes:
npm run clouds:prepare -- --posters-only
# Only replace video and calibration:
npm run clouds:prepare:video -- /absolute/path/to/cloud.mp4
```

Preparation remuxes an H.264 export into `public/clouds/cloud-video.mp4` with fast-start metadata, no audio and no re-encoding. `video.json` records source dimensions, frame rate, duration, chroma key and global lightness calibration. Matching source hashes reuse the calibration; new sources are analyzed as a stream of RGB frames with bounded memory and no raw movie files. Outputs are staged until complete. SIGINT/SIGTERM stops the encoder and removes partial staging files. Blender exports are never modified.

The GPU derives cloud opacity and OKLab lightness from decoded RGB, applies theme exposure and a Bayer mask, and reuses one source texture. Box/text overlays consume the synchronous `cloud-frame` event. Their canvas copies and PNG conversion remain a separate optimization opportunity.

Forward idle motion uses native muted inline playback. Scrolling pauses playback and serializes seeks, retaining the latest pending target; reverse idle motion uses the same queue. Scroll position follows displayed frames. Callback generations invalidate notifications queued before a seek or transport change, without discarding valid delayed callbacks. The invisible video stays attached to the rendering tree for WebKit presentation.

## Validation and benchmark limits

```sh
npm run build
npm run test:clouds
npm run bench:clouds
```

Behavior tests derive endpoints from generated video metadata. Coverage includes delayed/stale callbacks, initial/coalesced seeks, idle resume and reversal, touch holds, visibility, theme/exposure, reduced motion, unavailable WebGL, media/play rejection, missing frame callbacks and context recovery. CLI regressions verify cancellation removes partial output and leaves no encoder process.

The benchmark serves the production build on localhost, throttles **media only** and creates a temporary 10× repeated clip. Its nominal 4 Mbps limit is **per response**, so overlapping range requests can exceed that aggregate rate. Timings are illustrative, not deployed page-load scores or production network guarantees.

Earlier measurements with the 24-second, 1.39 MiB export, three cold runs per engine:

| Clip | Chromium median media-to-ready | WebKit median media-to-ready | Bytes sent before readiness |
|---|---:|---:|---:|
| 24 seconds | 154 ms | 306 ms | 32–96 KiB |
| 240 seconds, repeated footage | 227 ms | 354 ms | 64–96 KiB |

Both allocated one source texture: about 0.98 MiB for 640×400 RGBA, excluding decoder buffers, render targets and overlays. Full playback still transfers the video; startup does not wait for the entire transfer. The physical iPhone, low-power mode and real longer export remain release checks. Small decoder/scaling differences from the former image sequence are expected.
