import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

// Requires FFmpeg/ffprobe and cwebp (or FFmpeg libwebp). Analysis streams RGB frames; no whole-movie buffer or raw files.
const source = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? '.clouds/exports/cloud.mp4');
const videoOnly = process.argv.includes('--video');
const postersOnly = process.argv.includes('--posters-only');
if (videoOnly && postersOnly) throw new Error('Choose --video or --posters-only');
const profiles = JSON.parse(readFileSync(new URL('../src/components/CloudHero/cloud-settings.json', import.meta.url),'utf8'));
const output = resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? 'public/clouds');
mkdirSync(output,{recursive:true});
// Stage beside the destination so publication can use atomic renames across platforms.
const working = mkdtempSync(resolve(output,'cloud-video.staging-'));
let activeChild, cancelled = 0;
process.on('exit',() => rmSync(working,{recursive:true,force:true}));
for (const [signal,code] of [['SIGINT',130],['SIGTERM',143]]) {
  process.on(signal,() => {
    if (cancelled) return;
    cancelled = code;
    if (!activeChild) process.exit(code);
    const child = activeChild;
    child.kill(signal);
    // A stuck encoder must not outlive cancellation or keep staging files open.
    const force = setTimeout(() => child.kill('SIGKILL'),2000);
    force.unref();
    child.once('close',() => clearTimeout(force));
  });
}
async function command(binary,args,input,onChunk) {
  const child = spawn(binary,args,{stdio:['pipe','pipe','pipe']});
  activeChild = child;
  const chunks = [], errors = [];
  let chunkError;
  child.stdout.on('data',chunk => {
    if (cancelled || chunkError) return;
    if (!onChunk) chunks.push(chunk);
    else try { onChunk(chunk); } catch (error) { chunkError = error; child.kill(); }
  });
  child.stderr.on('data',chunk => errors.push(chunk));
  // An encoder may fail before it consumes a supplied poster buffer.
  child.stdin.on('error',error => { if (error.code !== 'EPIPE') chunkError = error; });
  child.stdin.end(input);
  try {
    const status = await new Promise((resolve,reject) => {
      child.once('error',reject);
      child.once('close',resolve);
    });
    if (cancelled) process.exit(cancelled);
    if (chunkError) throw chunkError;
    if (status !== 0) throw new Error(Buffer.concat(errors).toString() || `${binary} failed`);
    return Buffer.concat(chunks);
  } finally { activeChild = undefined; }
}
const ffmpeg = (args,input,onChunk) => command('ffmpeg',['-v','error',...args],input,onChunk);
const key = { color:'#4384A3',inner:0.025,outer:0.085 };
const clamp = value => Math.max(0,Math.min(1,value));
function chroma(r,g,b) {
  const y = (0.2126*r+0.7152*g+0.0722*b)/255;
  return [(b/255-y)/1.8556,(r/255-y)/1.5748];
}
const keyChroma = chroma(0x43,0x84,0xA3);
function opacity(r,g,b) {
  const [cb,cr] = chroma(r,g,b);
  const distance = Math.hypot(cb-keyChroma[0],cr-keyChroma[1])/Math.SQRT2;
  const t = clamp((distance-key.inner)/(key.outer-key.inner));
  return t*t*(3-2*t);
}
const linear = Array.from({length:256},(_,n) => {
  const v = n/255;
  return v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
});
function lightness(r,g,b) {
  r = linear[r]; g = linear[g]; b = linear[b];
  return 0.2104542553*Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b)
    + 0.793617785*Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b)
    - 0.0040720468*Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
}
const probe = await command('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,duration,width,height,r_frame_rate','-of','json',source]);
const info = JSON.parse(probe).streams[0];
const duration = Number(info?.duration);
const [numerator,denominator] = (info?.r_frame_rate ?? '').split('/').map(Number);
const fps = numerator/denominator;
if (!(duration > 0 && Number.isFinite(duration) && fps > 0 && Number.isFinite(fps))) throw new Error('Source must have a finite duration and frame rate');
if (!postersOnly && info.codec_name !== 'h264') throw new Error('Export an H.264 MP4 before preparing cloud assets');
const hash = createHash('sha256');
for await (const chunk of createReadStream(source)) hash.update(chunk);
const fingerprint = hash.digest('hex');
let tone;
try {
  const approved = JSON.parse(readFileSync(resolve(output,'video.json'),'utf8'));
  if (approved.source?.sha256 === fingerprint && JSON.stringify(approved.key) === JSON.stringify(key)) tone = approved.tone;
} catch { /* A new source needs one global calibration, preventing exposure pumping. */ }
const frameBytes = 384*240*3;
const raw = ['-i',source,'-vf','fps=24,scale=384:240:flags=lanczos'];
let firstFrame;
if (!tone) {
  const frame = Buffer.alloc(frameBytes), histogram = new Float64Array(256);
  let offset = 0, foreground = 0, count = 0;
  await ffmpeg([...raw,'-f','rawvideo','-pix_fmt','rgb24','-'],undefined,chunk => {
    let position = 0;
    while (position < chunk.length) {
      const length = Math.min(frameBytes-offset,chunk.length-position);
      chunk.copy(frame,offset,position,position+length); offset += length; position += length;
      if (offset !== frameBytes) continue;
      if (!count++) firstFrame = Buffer.from(frame);
      for (let i = 0; i < frameBytes; i += 3) {
        if (opacity(frame[i],frame[i+1],frame[i+2]) < 0.95) continue;
        histogram[Math.round(lightness(frame[i],frame[i+1],frame[i+2])*255)]++; foreground++;
      }
      offset = 0;
    }
  });
  if (offset || !count) throw new Error('Incomplete decoded cloud frame');
  if (!foreground) throw new Error('Chroma key removed the entire cloud');
  function percentile(p) {
    let sum = 0;
    for (let i = 0; i < 256; i++) { sum += histogram[i]; if (sum >= foreground*p) return i/255; }
    return 1;
  }
  tone = {black:percentile(0.01),white:percentile(0.99)};
} else if (!videoOnly) {
  firstFrame = await ffmpeg([...raw,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-']);
}
const files = [];
if (!postersOnly) {
  await ffmpeg(['-i',source,'-map','0:v:0','-an','-c:v','copy','-movflags','+faststart','-y',resolve(working,'cloud-video.mp4')]);
  files.push('cloud-video.mp4');
}
if (!videoOnly) {
  let cwebp = false;
  try { await command('cwebp',['-version']); cwebp = true; } catch { /* FFmpeg libwebp is the fallback. */ }
  for (const theme of ['light','dark']) {
    const settings = profiles[theme], poster = Buffer.alloc(384*240*4), thresholds = [1/8,5/8,7/8,3/8];
    for (let y = 0; y < 240; y++) for (let x = 0; x < 384; x++) {
      const i = (y*384+x)*3;
      const l = Math.round(clamp((lightness(firstFrame[i],firstFrame[i+1],firstFrame[i+2])-tone.black)/Math.max(tone.white-tone.black,0.001))*255)/255;
      const a = Math.round(opacity(firstFrame[i],firstFrame[i+1],firstFrame[i+2])*255)/255;
      const exposed = Math.pow(clamp((l-0.5)*settings.contrast+0.5+settings.exposure),settings.gamma);
      const shadows = settings.shading === 'shadows' || (settings.shading === 'auto' && theme === 'light');
      const coverage = a*clamp(settings.density*(settings.minimum+(1-settings.minimum)*(shadows ? 1-exposed : exposed)));
      poster.set([255,255,255,coverage>thresholds[(y%2)*2+x%2]?255:0],(y*384+x)*4);
    }
    const file = theme === 'light' ? 'poster-light.webp' : 'poster.webp';
    const input = ['-f','rawvideo','-pixel_format','rgba','-video_size','384x240','-i','-','-frames:v','1'];
    if (cwebp) {
      const png = resolve(working,`${theme}.png`);
      await ffmpeg([...input,'-c:v','png','-y',png],poster);
      await command('cwebp',['-quiet','-lossless','-exact','-m','6',png,'-o',resolve(working,file)]);
    } else await ffmpeg([...input,'-c:v','libwebp','-lossless','1','-compression_level','6','-y',resolve(working,file)],poster);
    files.push(file);
  }
}
if (!postersOnly) {
  writeFileSync(resolve(working,'video.json'),JSON.stringify({kind:'video',file:'cloud-video.mp4',width:info.width,height:info.height,fps,duration,key,tone,source:{file:basename(source),sha256:fingerprint}},null,2)+'\n');
  files.push('video.json');
}
// Publish only complete outputs, metadata last. Cancellation leaves the prior assets intact.
for (const file of files) renameSync(resolve(working,file),resolve(output,file));
console.log(`Prepared ${source} → ${output}`);
