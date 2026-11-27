import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// No Python packages needed. Requires FFmpeg and cwebp (or FFmpeg's libwebp).
const source = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? '.clouds/exports/cloud.mp4');
const postersOnly = process.argv.includes('--posters-only');
const profiles = JSON.parse(readFileSync(new URL('../src/components/CloudHero/cloud-settings.json', import.meta.url),'utf8'));
const output = resolve('public/clouds');
mkdirSync(output, { recursive: true });
function run(args, input) {
  const result = spawnSync('ffmpeg', ['-v', 'error', ...args], { input, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr?.toString() || 'FFmpeg failed');
  return result.stdout;
}
// Key the original RGB footage before throwing away its color information.
const key = { color: '#4384A3', inner: 0.025, outer: 0.085 };
const clamp = v => Math.max(0, Math.min(1, v));
function chroma(r, g, b) {
  const y = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  return [(b/255-y)/1.8556, (r/255-y)/1.5748];
}
const keyChroma = chroma(0x43, 0x84, 0xA3);
function opacity(r, g, b) {
  const [cb, cr] = chroma(r,g,b);
  const distance = Math.hypot(cb-keyChroma[0],cr-keyChroma[1])/Math.SQRT2;
  const t = clamp((distance-key.inner)/(key.outer-key.inner));
  return t*t*(3-2*t);
}
const linear = Array.from({ length: 256 }, (_, n) => {
  const v = n / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
function lightness(r, g, b) {
  r = linear[r]; g = linear[g]; b = linear[b];
  return 0.2104542553 * Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b)
    + 0.793617785 * Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b)
    - 0.0040720468 * Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
}
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration,width,height', '-of', 'json', source]);
if (probe.status !== 0) throw new Error(probe.stderr.toString());
const info = JSON.parse(probe.stdout.toString()).streams[0];
const duration = Number(info.duration);
if (!Number.isFinite(duration) || duration <= 0) throw new Error('Source must have a finite duration');
const master = run(['-i', source, '-vf', 'fps=24,scale=384:240:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
const histogram = new Uint32Array(256);
let foregroundPixels = 0;
for (let i = 0; i < master.length; i += 3) {
  if (opacity(master[i],master[i+1],master[i+2]) < 0.95) continue;
  histogram[Math.round(lightness(master[i], master[i+1], master[i+2]) * 255)]++;
  foregroundPixels++;
}
if (!foregroundPixels) throw new Error('Chroma key removed the entire cloud');
function percentile(p) {
  let sum = 0;
  for (let i = 0; i < 256; i++) { sum += histogram[i]; if (sum >= foregroundPixels * p) return i / 255; }
  return 1;
}
// One global curve prevents exposure pumping between frames.
const black = percentile(0.01), white = percentile(0.99);
const normalizedLightness = (r,g,b) => clamp((lightness(r,g,b)-black)/Math.max(white-black,0.001));
function webp(bytes, width, height, format, file) {
  const raw = ['-f', 'rawvideo', '-pixel_format', format, '-video_size', `${width}x${height}`, '-i', '-', '-frames:v', '1'];
  const available = spawnSync('cwebp', ['-version']);
  if (available.status === 0) {
    const png = run([...raw, '-c:v', 'png', '-f', 'image2pipe', '-'], bytes);
    const temporary = mkdtempSync(resolve(tmpdir(), 'cloud-webp-'));
    try {
      const inputFile = resolve(temporary, 'input.png');
      writeFileSync(inputFile, png);
      const encoded = spawnSync('cwebp', ['-quiet', '-lossless', '-exact', '-m', '6', inputFile, '-o', resolve(output,file)], { maxBuffer: 32*1024*1024 });
      if (encoded.status !== 0) throw new Error(encoded.stderr.toString());
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  } else {
    run([...raw, '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', '-y', resolve(output, file)], bytes);
  }
}
const manifest = {
  version: 3, encoding: 'lightness-opacity', duration, source: { file: source.split(/[/\\]/).pop(), sha256: createHash('sha256').update(readFileSync(source)).digest('hex') },
  key, tone: { black, white, space: 'OKLab L' }, posters: { light: 'poster-light.webp', dark: 'poster.webp' }, variants: {},
};
for (const [name, width, height, fps, columns, rows] of (postersOnly ? [] : [['desktop',384,240,24,5,8], ['mobile',256,160,12,8,4]])) {
  const rgb = name === 'desktop' ? master : run(['-i', source, '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const count = rgb.length / (width * height * 3);
  if (!Number.isInteger(count)) throw new Error('Incomplete decoded frame');
  const capacity = columns * rows, pages = [];
  for (let first = 0; first < count; first += capacity) {
    const pageWidth = width * columns, pageHeight = height * rows;
    // RGB WebP transports R=lightness, G=opacity; B is unused. Runtime uploads RG8.
    const packed = Buffer.alloc(pageWidth * pageHeight * 3);
    for (let n = 0; n < Math.min(capacity, count-first); n++) {
      const x = n % columns * width, y = Math.floor(n / columns) * height;
      for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
        const i = ((first+n) * width * height + py * width + px) * 3;
        const dest = ((y+py) * pageWidth+x+px)*3;
        packed[dest] = Math.round(normalizedLightness(rgb[i],rgb[i+1],rgb[i+2])*255);
        packed[dest+1] = Math.round(opacity(rgb[i],rgb[i+1],rgb[i+2])*255);
      }
    }
    const file = `${name}-${pages.length}.webp`;
    webp(packed, pageWidth, pageHeight, 'rgb24', file);
    pages.push({ file, width: pageWidth, height: pageHeight });
  }
  manifest.variants[name] = { width, height, fps, count, columns, rows, pages };
  console.log(`${name}: ${count} frames, ${pages.length} pages, ${(2*pages.length*columns*rows*width*height/1048576).toFixed(1)} MiB RG8 textures`);
}
for (const theme of ['light','dark']) {
  const settings = profiles[theme];
  const poster = Buffer.alloc(384*240*4), thresholds = [1/8,5/8,7/8,3/8];
  for (let y=0; y<240; y++) for (let x=0; x<384; x++) {
    const i=(y*384+x)*3;
    const l = Math.round(normalizedLightness(master[i],master[i+1],master[i+2])*255)/255;
    const a = Math.round(opacity(master[i],master[i+1],master[i+2])*255)/255;
    const tone = Math.pow(clamp((l-0.5)*settings.contrast+0.5+settings.exposure), settings.gamma);
    const shadows = settings.shading === 'shadows' || (settings.shading === 'auto' && theme === 'light');
    const shade = shadows ? 1-tone : tone;
    const ink = a*clamp(settings.density*(settings.minimum+(1-settings.minimum)*shade));
    poster.set([255,255,255,ink>thresholds[(y%2)*2+x%2]?255:0],(y*384+x)*4);
  }
  webp(poster,384,240,'rgba',manifest.posters[theme]);
}
if (!postersOnly) writeFileSync(resolve(output,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${source} → ${output}`);
