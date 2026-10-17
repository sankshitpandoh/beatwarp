import { VERT, EFFECT_FRAG, POST_FRAG } from './shaders.js';

const MAX_TEX = 2048;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
  }
  return sh;
}

function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    loc[name] = gl.getUniformLocation(p, name);
  }
  return { p, loc };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not supported in this browser.');
    this.gl = gl;
    this.effect = program(gl, EFFECT_FRAG);
    this.post = program(gl, POST_FRAG);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    this.imgAspect = 1;

    this.targets = [];
    this.read = 0;
    this.w = this.h = 0;
  }

  _makeTarget(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  }

  resize(w, h) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.canvas.width = w;
    this.canvas.height = h;
    this.targets.forEach(t => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); });
    this.targets = [this._makeTarget(w, h), this._makeTarget(w, h)];
    this.w = w;
    this.h = h;
  }

  /** source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | HTMLVideoElement */
  setSource(source, isVideo = false) {
    const gl = this.gl;
    let src = source;
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!isVideo && Math.max(sw, sh) > MAX_TEX) {
      const k = MAX_TEX / Math.max(sw, sh);
      const c = document.createElement('canvas');
      c.width = Math.round(sw * k);
      c.height = Math.round(sh * k);
      c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
      src = c;
    }
    this.video = isVideo ? source : null;
    this.imgAspect = sw / sh || 1;
    this._upload(src);
  }

  _upload(src) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  _imgScale() {
    const ca = this.w / this.h, ia = this.imgAspect;
    return ca > ia ? [1 / ca, ia / ca] : [1 / ia, 1];
  }

  render(s) {
    const gl = this.gl;
    if (this.video && this.video.readyState >= 2) {
      const vw = this.video.videoWidth, vh = this.video.videoHeight;
      if (vw && vh) this.imgAspect = vw / vh;
      this._upload(this.video);
    }
    const read = this.targets[this.read], write = this.targets[1 - this.read];
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.w, this.h);

    // effect pass
    const E = this.effect;
    gl.useProgram(E.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
    gl.uniform1i(E.loc.uImg, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(E.loc.uPrev, 1);
    gl.uniform2f(E.loc.uRes, this.w, this.h);
    gl.uniform2fv(E.loc.uImgScale, this._imgScale());
    gl.uniform1f(E.loc.uTime, s.time);
    const a = s.audio;
    gl.uniform1f(E.loc.uSub, a.sub);
    gl.uniform1f(E.loc.uBass, a.bass);
    gl.uniform1f(E.loc.uMid, a.mid);
    gl.uniform1f(E.loc.uHigh, a.high);
    gl.uniform1f(E.loc.uEnergy, a.energy);
    gl.uniform1f(E.loc.uKick, a.kick);
    gl.uniform1f(E.loc.uKickN, a.kickN);
    gl.uniform1i(E.loc.uMode, s.mode);
    const P = s.params;
    gl.uniform1f(E.loc.uWet, P.wet);
    gl.uniform1f(E.loc.uSym, P.symmetry);
    gl.uniform1f(E.loc.uTiles, P.tiles);
    gl.uniform1f(E.loc.uTwist, P.twist);
    gl.uniform1f(E.loc.uSlice, P.slice);
    gl.uniform1f(E.loc.uLens, P.lens);
    gl.uniform1i(E.loc.uLensStyle, P.lensStyle);
    gl.uniform1f(E.loc.uSpin, P.spin);
    gl.uniform1f(E.loc.uChaos, P.chaos);
    gl.uniform1f(E.loc.uTrails, P.trails);
    gl.uniform3fv(E.loc.uPal, s.palette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindTexture(gl.TEXTURE_2D, write.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // post pass
    const Q = this.post;
    gl.useProgram(Q.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, write.tex);
    gl.uniform1i(Q.loc.uScene, 0);
    gl.uniform2f(Q.loc.uRes, this.w, this.h);
    gl.uniform1f(Q.loc.uTime, s.time);
    gl.uniform1f(Q.loc.uHeat, P.heat);
    gl.uniform1f(Q.loc.uBright, P.bright);
    gl.uniform1f(Q.loc.uVig, P.vignette);
    gl.uniform1f(Q.loc.uKick, a.kick);
    gl.uniform1f(Q.loc.uHigh, a.high);
    gl.uniform1f(Q.loc.uBass, a.bass);
    gl.uniform3fv(Q.loc.uPal, s.palette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.read = 1 - this.read;
  }
}
