export type CloudVariant = {
  width: number; height: number; fps: number; count: number; columns: number; rows: number;
  pages: { file: string; width: number; height: number }[];
};
export type CloudManifest = {
  version: number; encoding: string; duration: number;
  variants: { desktop: CloudVariant; mobile: CloudVariant };
};

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const fragment = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uResolution, uFrameSize, uAtlasSize, uOffset;
uniform vec3 uInk;
uniform vec4 uTone;
uniform float uMinimum, uExposureScale;
uniform bool uShadows;
out vec4 color;
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 uv = pixel / uResolution;
  float viewAspect = uResolution.x / uResolution.y;
  float sourceAspect = uFrameSize.x / uFrameSize.y;
  if (viewAspect > sourceAspect) uv.y = (uv.y - 0.5) * sourceAspect / viewAspect + 0.5;
  else uv.x = (uv.x - 0.5) * viewAspect / sourceAspect + 0.5;
  vec2 source = clamp(uv * uFrameSize, vec2(0.5), uFrameSize - 0.5);
  vec2 cloud = texture(uAtlas, (uOffset + source) / uAtlasSize).rg;
  float lightness = pow(clamp((cloud.r-0.5)*uTone.y+0.5+uTone.x,0.0,1.0),uTone.z);
  lightness *= uExposureScale;
  float shade = uShadows ? 1.0-lightness : lightness;
  float coverage = cloud.g * clamp(uTone.w * mix(uMinimum,1.0,shade),0.0,1.0);
  int x = int(pixel.x) & 1;
  int y = int(pixel.y) & 1;
  float threshold = y == 0 ? (x == 0 ? 0.125 : 0.625) : (x == 0 ? 0.875 : 0.375);
  float alpha = coverage > threshold ? 1.0 : 0.0;
  // In highlight mode, fewer bright dots alone can be hard to perceive on solid
  // cloud areas. Dim the ink too, matching the static poster's brightness change.
  vec3 ink = uInk * (uShadows ? 1.0 : uExposureScale);
  color = vec4(ink * alpha, alpha);
}`;

export function createCloudRenderer(canvas: HTMLCanvasElement, variant: CloudVariant) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  const shaders: WebGLShader[] = [], textures: WebGLTexture[] = [];
  const program = gl.createProgram();
  if (!program) throw new Error('Could not allocate shader program');
  let valid = true;
  function dispose() {
    // Restoration invalidates every old handle. Deleting those handles in the
    // restored context would poison its GL error state and break the next upload.
    if (!valid) return;
    textures.forEach(t => gl!.deleteTexture(t));
    shaders.forEach(s => gl!.deleteShader(s));
    gl!.deleteProgram(program);
  }
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not allocate shader');
      shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader link failed');
    gl.useProgram(program);
    gl.disable(gl.DITHER); gl.disable(gl.BLEND);
    const locations = Object.fromEntries(['uAtlas','uResolution','uFrameSize','uAtlasSize','uOffset','uInk','uTone','uMinimum','uExposureScale','uShadows'].map(n => [n, gl.getUniformLocation(program, n)]));
    gl.uniform1i(locations.uAtlas, 0);
    gl.uniform2f(locations.uFrameSize, variant.width, variant.height);
    let lastFrame = -1, lastWidth = 0, lastHeight = 0, lastInk = '';
    return {
      dispose,
      invalidate() { valid = false; },
      upload(index: number, pixels: Uint8Array) {
        const page = variant.pages[index];
        if (page.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || page.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('Atlas exceeds texture limit');
        const texture = gl.createTexture();
        if (!texture) throw new Error('Could not allocate atlas');
        textures[index] = texture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, page.width, page.height, 0, gl.RG, gl.UNSIGNED_BYTE, pixels);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Could not upload atlas');
      },
      draw(frame: number, cssWidth: number, cssHeight: number, ink: number[], settings: CloudSettings, shadows: boolean, exposureScale = 1) {
        let width = Math.max(1, Math.floor(cssWidth / settings.pixelSize));
        let height = Math.max(1, Math.floor(cssHeight / settings.pixelSize));
        const scale = Math.min(1, Math.sqrt(256000/(width*height)));
        width = Math.max(1, Math.floor(width*scale)); height = Math.max(1, Math.floor(height*scale));
        const inkKey = JSON.stringify([ink,settings,shadows,exposureScale]);
        if (frame === lastFrame && width === lastWidth && height === lastHeight && inkKey === lastInk) return;
        if (width !== canvas.width || height !== canvas.height) { canvas.width = width; canvas.height = height; }
        const capacity = variant.columns*variant.rows, pageIndex = Math.floor(frame/capacity), local = frame%capacity;
        const page = variant.pages[pageIndex];
        gl.viewport(0,0,width,height);
        gl.bindTexture(gl.TEXTURE_2D, textures[pageIndex]);
        gl.uniform2f(locations.uResolution, width,height);
        gl.uniform3fv(locations.uInk, ink);
        gl.uniform4f(locations.uTone,settings.exposure,settings.contrast,settings.gamma,settings.density);
        gl.uniform1f(locations.uMinimum,settings.minimum);
        gl.uniform1f(locations.uExposureScale,exposureScale);
        gl.uniform1i(locations.uShadows,shadows ? 1 : 0);
        gl.uniform2f(locations.uAtlasSize, page.width,page.height);
        gl.uniform2f(locations.uOffset, local%variant.columns*variant.width,Math.floor(local/variant.columns)*variant.height);
        gl.drawArrays(gl.TRIANGLES,0,3);
        lastFrame = frame; lastWidth = width; lastHeight = height; lastInk = inkKey;
        return true;
      },
    };
  } catch (error) { dispose(); throw error; }
}
import type { CloudSettings } from './cloud-settings';

