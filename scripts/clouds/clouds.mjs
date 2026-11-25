#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(readFileSync(join(root, 'scripts/clouds/config.json'), 'utf8'));
const [command = 'help', ...args] = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const has = (name) => args.includes(`--${name}`);
function executable(name, alternatives = []) {
  if (process.env[name.toUpperCase() + '_BIN']) return process.env[name.toUpperCase() + '_BIN'];
  for (const path of alternatives) if (existsSync(path)) return path;
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
}
const blenderLocations = ['/Applications/Blender.app/Contents/MacOS/Blender'];
if (process.platform === 'win32') {
  const foundation = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Blender Foundation');
  if (existsSync(foundation)) for (const folder of readdirSync(foundation).sort().reverse()) {
    blenderLocations.push(join(foundation, folder, 'blender.exe'));
  }
}
const blender = executable('blender', blenderLocations);
const ffmpeg = executable('ffmpeg');
const cwebp = executable('cwebp');
function run(bin, argv) {
  const result = spawnSync(bin, argv, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${bin} failed (${result.error?.message ?? result.status}).`);
}
function numberOption(name, fallback, min, max) {
  const value = Number(option(name, fallback));
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`--${name} must be an integer from ${min} to ${max}.`);
  return value;
}
function render(seed, quality, still = false, sceneOnly = false) {
  if (!blender) throw new Error('Blender is missing. Run npm run clouds:setup first, or set BLENDER_BIN.');
  const preset = config.presets[quality];
  if (!preset) throw new Error('Quality must be draft or production.');
  const output = join(root, '.clouds', `${quality}-${seed}${still ? '-still' : ''}`);
  mkdirSync(output, { recursive: true });
  run(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', 'scripts/clouds/scene.py', '--',
    '--seed', String(seed), '--quality', quality, '--output', output, ...(still ? ['--still'] : []), ...(sceneOnly ? ['--scene-only'] : []), ...(has('cpu') ? ['--cpu'] : [])]);
  return output;
}
function pack(source, seed, quality) {
  if (!ffmpeg && !cwebp) throw new Error('An image encoder is missing. Run npm run clouds:setup.');
  const metadata = JSON.parse(readFileSync(join(source, 'scene.json'), 'utf8'));
  const files = readdirSync(source).filter(name => /^frame-\d{4}\.png$/.test(name)).sort();
  if (files.length !== metadata.frameCount) throw new Error(`Expected ${metadata.frameCount} frames, found ${files.length}. Resume rendering before packaging.`);
  const id = `summer-${seed}`;
  const destination = join(root, 'public/clouds', id);
  const staging = destination + '.staging';
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (const [index, name] of files.entries()) {
    const target = join(staging, `frame-${String(index).padStart(4, '0')}.webp`);
    if (cwebp) run(cwebp, ['-quiet', '-q', '88', '-alpha_q', '100', join(source, name), '-o', target]);
    else run(ffmpeg, ['-v', 'error', '-y', '-i', join(source, name), '-c:v', 'libwebp', '-quality', '88', target]);
  }
  const scene = { id, seed, quality, width: metadata.width, height: metadata.height, frameCount: files.length,
    pattern: `/clouds/${id}/frame-{frame}.webp`, poster: `/clouds/${id}/frame-0000.webp` };
  writeFileSync(join(staging, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
  rmSync(destination, { recursive: true, force: true });
  renameSync(staging, destination);
  const manifestPath = join(root, 'public/clouds/manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { schemaVersion: 1, scenes: [] };
  manifest.scenes = [...manifest.scenes.filter(item => item.id !== id), scene];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Published ${files.length} ${quality} frames for seed ${seed}. Source scene: ${source}/cloud.blend`);
}
try {
  if (command === 'setup') {
    if (process.platform !== 'darwin') throw new Error('Install Blender and FFmpeg with your OS package manager, then run clouds:doctor.');
    if (!executable('brew')) throw new Error('Homebrew is required for automatic setup: https://brew.sh');
    if (!blender) run('brew', ['install', '--cask', 'blender']);
    if (!ffmpeg) run('brew', ['install', 'ffmpeg']);
    console.log('Cloud tools are installed. Run npm run clouds:doctor.');
  } else if (command === 'doctor') {
    for (const [name, path] of [['Blender', blender], ['FFmpeg', ffmpeg], ['WebP encoder (optional)', cwebp]]) console.log(`${name}: ${path ?? 'not installed'}`);
    if (!blender) process.exitCode = 1;
    if (!ffmpeg && !cwebp) console.log('Encoding tools are optional until you run clouds:pack.');
    if (blender) run(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python-expr',
      'import bpy, sys; print("Blender", bpy.app.version_string); p=bpy.context.preferences.addons["cycles"].preferences; p.compute_device_type="METAL" if sys.platform=="darwin" else "OPTIX"; p.get_devices(); print("Cycles devices:", [(d.name,d.type) for d in p.devices])']);
  } else if (['scene', 'preview', 'render', 'catalog'].includes(command)) {
    const seed = numberOption('seed', config.defaultSeed, 0, 2147483647);
    const quality = option('quality', 'draft');
    if (command === 'catalog') {
      const count = numberOption('count', 6, 1, config.candidateSeeds.length);
      for (const candidate of config.candidateSeeds.slice(0, count)) render(candidate, quality, true);
      console.log('Contact-sheet candidates are in .clouds/*-still/frame-0001.png. Render your favorites with --seed.');
    } else {
      const source = render(seed, quality, command === 'preview', command === 'scene');
      console.log(`Scene: ${source}/cloud.blend`);
      if (command !== 'scene') console.log(`Rendered PNGs: ${source}`);
    }
  } else if (command === 'pack') {
    const seed = numberOption('seed', config.defaultSeed, 0, 2147483647);
    const quality = option('quality', 'draft');
    pack(join(root, '.clouds', `${quality}-${seed}`), seed, quality);
  } else {
    console.log('Cloud pipeline\n  npm run clouds:setup\n  npm run clouds:doctor\n  npm run clouds:scene -- --seed 7\n  npm run clouds:preview -- --seed 7\n  npm run clouds:render -- --seed 7 --quality draft\n  npm run clouds:render -- --seed 7 --quality production\n  npm run clouds:catalog -- --count 6\n  npm run clouds:pack -- --seed 7\nAdd --cpu to disable GPU rendering. Metal is used on macOS; OptiX/CUDA on NVIDIA PCs. Renders reuse existing PNGs; use a new seed or remove the .clouds/<quality>-<seed> directory after changing the generator.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
