import type { CloudSettings } from './cloud-settings';

export type CloudVideoSource = {
  kind: 'video'; file: string; width: number; height: number; fps: number; duration: number;
  key: { color: string; inner: number; outer: number };
  tone: { black: number; white: number };
};

const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const fragment = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uResolution, uFrameSize;
uniform vec3 uInk;
uniform vec4 uTone;
uniform float uMinimum, uExposureScale;
uniform bool uShadows;
out vec4 color;
uniform vec3 uKey;
uniform vec2 uKeyRange, uLightnessRange;
vec2 chroma(vec3 c) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return vec2((c.b-y)/1.8556, (c.r-y)/1.5748);
}
float linearChannel(float c) { return c <= 0.04045 ? c/12.92 : pow((c+0.055)/1.055, 2.4); }
float cloudLightness(vec3 rgb) {
  vec3 c = vec3(linearChannel(rgb.r), linearChannel(rgb.g), linearChannel(rgb.b));
  vec3 lms = pow(mat3(
    0.4122214708, 0.2119034982, 0.0883024619,
    0.5363325363, 0.6806995451, 0.2817188376,
    0.0514459929, 0.1073969566, 0.6299787005
  ) * c, vec3(1.0/3.0));
  return dot(lms, vec3(0.2104542553, 0.793617785, -0.0040720468));
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 uv = pixel / uResolution;
  float viewAspect = uResolution.x / uResolution.y;
  float sourceAspect = uFrameSize.x / uFrameSize.y;
  if (viewAspect > sourceAspect) uv.y = (uv.y - 0.5) * sourceAspect / viewAspect + 0.5;
  else uv.x = (uv.x - 0.5) * viewAspect / sourceAspect + 0.5;
  vec2 source = clamp(uv * uFrameSize, vec2(0.5), uFrameSize - 0.5);
  vec3 rgb = texture(uVideo, source / uFrameSize).rgb;
  float opacity = smoothstep(uKeyRange.x, uKeyRange.y, length(chroma(rgb)-chroma(uKey))/sqrt(2.0));
  vec2 cloud = vec2(clamp((cloudLightness(rgb)-uLightnessRange.x)/max(0.001,uLightnessRange.y-uLightnessRange.x),0.0,1.0), opacity);
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

export function createCloudRenderer(canvas: HTMLCanvasElement, source: CloudVideoSource) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  const shaders: WebGLShader[] = [];
  let texture: WebGLTexture | null = null;
  const program = gl.createProgram();
  if (!program) throw new Error('Could not allocate shader program');
  let valid = true;
  function dispose() {
    // Restoration invalidates every old handle. Deleting those handles in the
    // restored context would poison its GL error state and break the next upload.
    if (!valid) return;
    if (texture) gl!.deleteTexture(texture);
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
    const locations = Object.fromEntries(['uVideo','uResolution','uFrameSize','uInk','uTone','uMinimum','uExposureScale','uShadows','uKey','uKeyRange','uLightnessRange'].map(n => [n, gl.getUniformLocation(program, n)]));
    gl.uniform1i(locations.uVideo, 0);
    gl.uniform2f(locations.uFrameSize, source.width, source.height);
    const key = [1,3,5].map(offset => parseInt(source.key.color.slice(offset,offset+2),16)/255);
    gl.uniform3fv(locations.uKey, key);
    gl.uniform2f(locations.uKeyRange, source.key.inner, source.key.outer);
    gl.uniform2f(locations.uLightnessRange, source.tone.black, source.tone.white);
    let videoWidth = 0, videoHeight = 0;
    let lastFrame = -1, lastWidth = 0, lastHeight = 0, lastInk = '';
    return {
      dispose,
      invalidate() { valid = false; },
      uploadVideo(video: HTMLVideoElement) {
        if (video.readyState < 2 || video.seeking) return false;
        if (!texture) {
          texture = gl.createTexture();
          if (!texture) throw new Error('Could not allocate video texture');
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (videoWidth !== video.videoWidth || videoHeight !== video.videoHeight) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          videoWidth = video.videoWidth; videoHeight = video.videoHeight;
        } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Could not upload video frame');
        lastFrame = -1;
        return true;
      },
      draw(frame: number, cssWidth: number, cssHeight: number, ink: number[], settings: CloudSettings, shadows: boolean, exposureScale = 1) {
        let width = Math.max(1, Math.floor(cssWidth / settings.pixelSize));
        let height = Math.max(1, Math.floor(cssHeight / settings.pixelSize));
        const scale = Math.min(1, Math.sqrt(256000/(width*height)));
        width = Math.max(1, Math.floor(width*scale)); height = Math.max(1, Math.floor(height*scale));
        const inkKey = JSON.stringify([ink,settings,shadows,exposureScale]);
        if (frame === lastFrame && width === lastWidth && height === lastHeight && inkKey === lastInk) return;
        if (width !== canvas.width || height !== canvas.height) { canvas.width = width; canvas.height = height; }
        gl.viewport(0,0,width,height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform2f(locations.uResolution, width,height);
        gl.uniform3fv(locations.uInk, ink);
        gl.uniform4f(locations.uTone,settings.exposure,settings.contrast,settings.gamma,settings.density);
        gl.uniform1f(locations.uMinimum,settings.minimum);
        gl.uniform1f(locations.uExposureScale,exposureScale);
        gl.uniform1i(locations.uShadows,shadows ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES,0,3);
        lastFrame = frame; lastWidth = width; lastHeight = height; lastInk = inkKey;
        return true;
      },
    };
  } catch (error) { dispose(); throw error; }
}

