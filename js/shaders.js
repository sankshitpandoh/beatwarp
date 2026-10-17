// GLSL for the two render passes.
//  1. EFFECT: warps the user's image (space transforms -> mode -> trails) into a feedback buffer.
//  2. POST:   bloom / heat, kick accents, vignette and exposure, drawn to screen.

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

#define PI 3.14159265
#define TAU 6.2831853

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return v;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
`;

export const EFFECT_FRAG = COMMON + `
uniform sampler2D uImg;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform vec2 uImgScale;
uniform float uTime;
uniform float uSub, uBass, uMid, uHigh, uEnergy, uKick, uKickN;
uniform int uMode;
uniform float uWet, uSym, uTiles, uTwist, uSlice, uLens, uSpin, uChaos, uTrails;
uniform int uLensStyle;
uniform vec3 uPal[5];

// p-space: y in [-.5,.5], x scaled by aspect. Image is "cover"-fitted and mirror-wrapped.
vec3 img(vec2 p) { return textureLod(uImg, p * uImgScale + .5, 0.).rgb; }
vec3 prev(vec2 p) { return textureLod(uPrev, vec2(p.x * uRes.y / uRes.x, p.y) + .5, 0.).rgb; }

// ---------- space -----------------------------------------------------------
vec2 symm(vec2 p, float n) {
  if (n < .5) return p;
  if (n < 1.5) return vec2(abs(p.x), p.y);
  if (n < 2.5) return abs(p);
  float a = atan(p.y, p.x), r = length(p), s = TAU / n;
  a = mod(a, s);
  a = abs(a - s * .5);
  return r * vec2(cos(a), sin(a));
}

vec4 hexCell(vec2 p) {
  const vec2 s = vec2(1., 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + .5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + .5);
}

vec2 lens(vec2 p) {
  float s = uLens;
  if (s <= .001) return p;
  if (uLensStyle == 1) {            // glass ribs
    float k = 18.;
    p.x += (fract(p.x * k) - .5) / k * s * 2.5;
  } else if (uLensStyle == 2) {     // glass fan
    float r = length(p), a = atan(p.y, p.x), k = 10.;
    a += (fract(a * k / PI) - .5) * PI / k * s * 2.;
    p = r * vec2(cos(a), sin(a));
  } else if (uLensStyle == 3) {     // anamorphic
    p.x /= 1. + s * .8;
    p *= 1. + s * .9 * dot(p, p);
  } else if (uLensStyle == 4) {     // melt
    p.y += (fbm(vec2(p.x * 4., uTime * .3)) - .5) * .25 * s * (1. + uBass);
    p.x += sin(p.y * 9. + uTime) * .02 * s;
  } else if (uLensStyle == 5) {     // glitch
    vec2 b = floor(p * vec2(6., 22.));
    float h = hash21(b + floor(uTime * 7.));
    if (h > 1. - .35 * s) p.x += (hash21(b + 3.1) - .5) * .35 * s;
    p.y += step(.92, hash11(floor(uTime * 11.))) * .03 * s;
  } else if (uLensStyle == 6) {     // pixels
    float n = mix(160., 14., s);
    p = (floor(p * n) + .5) / n;
  } else if (uLensStyle == 7) {     // fly eye
    float c = mix(.22, .06, s);
    vec4 h = hexCell(p / c);
    vec2 ctr = h.zw * vec2(1., 1.7320508) * c;
    p = ctr + h.xy * c * mix(1., 3., s);
  }
  return p;
}

vec2 domain(vec2 p) {
  float ch = max(uChaos - .25, 0.) * 1.33;
  if (ch > 0.) {
    vec2 w = vec2(fbm(p * 3. + uTime * .15), fbm(p * 3. + vec2(5.2, 1.3) - uTime * .12)) - .5;
    p += w * ch * .35 * (.5 + uMid);
  }
  if (abs(uTwist) > .001) {
    float r = length(p);
    p = rot(uTwist * 3. * exp(-r * 2.5) * (1. + .5 * uBass)) * p;
  }
  if (uSlice > .001) {
    float b = floor(p.y * 14.);
    p.x += (hash11(b + floor(uTime * 1.5) * 7.) - .5) * uSlice * .35 * (.4 + uMid);
  }
  p = lens(p);
  if (uSym > .5) {
    p = rot(uTime * uSpin * .4) * p;
    p = symm(p, floor(uSym + .5));
  }
  if (uTiles > .5) {
    float n = floor(uTiles + .5) + 1.;
    p = abs(mod(p * n + .5, 2.) - 1.) - .5;
  }
  return p;
}

// ---------- modes -----------------------------------------------------------
vec3 mNone(vec2 p) {
  return img(p * (1. - .03 * uBass));
}

vec3 mSmear(vec2 p, vec2 p0) {
  float a = fbm(p0 * 2.5 + uTime * .1) * TAU * 2.;
  vec2 flow = vec2(cos(a), sin(a)) * .004 * (.4 + uMid * 2.);
  vec3 pc = prev(p0 * (1. - .004 * (.3 + uBass)) + flow);
  vec2 ip = p + (vec2(fbm(p * 3. + uTime * .2), fbm(p * 3. - uTime * .2)) - .5) * .08 * (1. + uBass);
  float inject = .04 + .55 * uKick * uKick + .1 * uHigh;
  return mix(pc * .996, img(ip), clamp(inject, 0., 1.));
}

vec3 mDroste(vec2 p) {
  float scale = 2.4 - .4 * uKick;
  float ls = log(scale);
  vec2 z = vec2(log(length(p) + 1e-5), atan(p.y, p.x));
  float alpha = atan(ls / TAU);
  z = rot(alpha) * z * cos(alpha);
  z.x = mod(z.x - uTime * .25, ls);
  vec2 q = exp(z.x) * vec2(cos(z.y), sin(z.y));
  vec3 c = img(q * .21);
  return c * (.85 + .3 * smoothstep(.0, ls, z.x));
}

vec3 mInfinite(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  float depth = .22 / r + uTime * .45;
  vec3 c = img(vec2(abs(a) / PI - .5, fract(depth * .5) - .5));
  c *= smoothstep(.0, .35, r);
  float ringR = .04 + (1. - uKick) * .9;
  c += uPal[3] * exp(-abs(r - ringR) * 35.) * uKick * 1.2;
  return c;
}

vec3 mCorridor(vec2 p) {
  vec2 ap = abs(p);
  float m = max(ap.x, ap.y);
  vec2 uv = ap.x > ap.y ? vec2(p.y / ap.x, .3 / ap.x) : vec2(p.x / ap.y, .3 / ap.y);
  uv.y += uTime * .6;
  vec3 c = img(vec2(uv.x * .5, fract(uv.y * .35) - .5));
  float seam = smoothstep(.02, 0., abs(ap.x - ap.y));
  c = mix(c, uPal[4], seam * .25);
  c *= smoothstep(.0, .4, m);
  float ringR = .03 + (1. - uKick) * .8;
  c += uPal[3] * exp(-abs(m - ringR) * 40.) * uKick * 1.2;
  return c;
}

vec3 mCube(vec2 p) {
  // spinning cube with the image on every face (ray-box intersection)
  vec3 ro = vec3(0., 0., -3.2 + uBass * .4);
  vec3 rd = normalize(vec3(p, 1.6));
  float ay = uTime * .5 + uKick * .5, ax = uTime * .31;
  mat2 ry = rot(ay), rx = rot(ax);
  ro.xz = ry * ro.xz; rd.xz = ry * rd.xz;
  ro.yz = rx * ro.yz; rd.yz = rx * rd.yz;
  float s = .9 + .1 * uKick;
  vec3 inv = 1. / rd;
  vec3 t1 = (-s - ro) * inv, t2 = (s - ro) * inv;
  vec3 tmin = min(t1, t2), tmax = max(t1, t2);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  vec3 bg = img(p * 1.6) * .25 + uPal[0] * .4;
  if (tn > tf || tf < 0.) return bg;
  vec3 h = (ro + rd * tn) / s;
  vec3 ah = abs(h);
  vec2 f = ah.x > .999 ? h.zy : ah.y > .999 ? h.xz : h.xy;
  vec3 c = img(f * .5);
  vec3 n = step(.999, ah) * sign(h);
  c *= .55 + .45 * abs(dot(n, normalize(vec3(.4, .7, -.6))));
  float edge = smoothstep(.97, 1., max(max(min(ah.x, ah.y), min(ah.y, ah.z)), min(ah.x, ah.z)));
  return c + uPal[4] * edge * (.3 + uKick);
}

vec3 mPlanet(vec2 p) {
  p = rot(uTime * .12) * p;
  float r = length(p), a = atan(p.y, p.x);
  float v = 2. * atan(r * (3.2 - 1.2 * uBass)) / PI;
  return img((vec2(abs(a) / PI, v) - .5) / uImgScale);
}

vec3 mWindows(vec2 p, vec2 p0) {
  float n = 3.;
  vec2 cell = floor(p * n), l = fract(p * n) - .5;
  float h = hash21(cell + uKickN * .37);
  vec2 off = (hash22(cell + uKickN) - .5) * .3;
  vec3 c = img(l * mix(.7, 1.4, h) + off);
  float lag = hash21(cell * 1.7) * .93 * (1. - uKick);
  c = mix(c, prev(p0), lag);
  float b = max(abs(l.x), abs(l.y));
  return mix(c, mix(uPal[0], uPal[3], uKick), smoothstep(.45, .47, b));
}

vec3 mMelt(vec2 p, vec2 p0) {
  float n = fbm(vec2(p.x * 6., uTime * .2));
  float drip = pow(n, 1.5) * (.12 + .35 * uBass);
  vec2 q = p + vec2(sin(p.y * 10. + uTime) * .01 * uMid, drip * (.5 + p.y + .5));
  vec3 c = img(q);
  vec3 pc = prev(p0 + vec2((noise(vec2(p0.x * 20., uTime)) - .5) * .002, .004 * (1. + uBass)));
  return mix(c, pc, .55 * (1. - uKick * .7));
}

vec3 mShatter(vec2 p) {
  float sc = 5.;
  vec2 x = p * sc, n = floor(x), f = fract(x);
  float md = 8., md2 = 8.;
  vec2 seed = vec2(0);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(i, j);
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md2 = md; md = d; seed = n + g + o; } else if (d < md2) md2 = d;
    }
  vec2 sp = seed / sc;
  float h = hash21(seed);
  float ex = uKick * (.3 + .7 * h);
  vec3 c = img(sp + rot((h - .5) * ex * 1.5) * (p - sp) - normalize(sp + .001) * ex * .12);
  float edge = sqrt(md2) - sqrt(md);
  c += uPal[4] * smoothstep(.07, 0., edge) * (.15 + uKick * .8 + uHigh * .3);
  return c * (1. - .35 * ex * h);
}

vec3 mPrism(vec2 p) {
  float n = 6., a = atan(p.y, p.x), r = length(p);
  float seg = floor((a + PI) / (TAU / n));
  vec2 dir = vec2(cos(seg * TAU / n + .5), sin(seg * TAU / n + .5));
  vec2 q = p + dir * (.03 + .1 * uHigh + .15 * uKick) * smoothstep(0., .4, r);
  float ca = .01 + .03 * uMid + .04 * uKick;
  vec3 c = vec3(img(q * (1. + ca)).r, img(q).g, img(q * (1. - ca)).b);
  float fe = abs(fract((a + PI) / (TAU / n)) - .5);
  return c + uPal[4] * smoothstep(.46, .5, fe) * .3 * (.3 + uHigh);
}

float terrainH(vec2 xz) { float l = luma(img(xz * .32)); return l * l * (.75 + .45 * uBass); }
vec3 mTerrain(vec2 p) {
  vec3 ro = vec3(sin(uTime * .1) * .6, 1.05, uTime * .5);
  vec3 rd = normalize(vec3(p.x, p.y - .22, 1.1));
  float t = .1;
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    vec3 pos = ro + rd * t;
    float h = pos.y - terrainH(pos.xz);
    if (h < .002 * t) { hit = true; break; }
    t += max(h * .5, .01);
    if (t > 14.) break;
  }
  vec3 sky = mix(uPal[2], uPal[0], clamp(p.y * 1.6 + .2, 0., 1.));
  sky += uPal[4] * pow(max(0., 1. - length(p - vec2(0., .1)) * 3.), 3.) * (.6 + uKick);
  if (!hit) return sky;
  vec3 pos = ro + rd * t;
  vec2 e = vec2(.02, 0);
  vec3 n = normalize(vec3(terrainH(pos.xz - e.xy) - terrainH(pos.xz + e.xy), 2. * e.x,
                          terrainH(pos.xz - e.yx) - terrainH(pos.xz + e.yx)));
  vec3 col = img(pos.xz * .32) * (clamp(dot(n, normalize(vec3(.3, .8, -.6))), 0., 1.) * .8 + .35);
  col += uPal[3] * smoothstep(.6, .9, terrainH(pos.xz)) * uKick * .5;
  return mix(col, sky, 1. - exp(-t * .12));
}

vec3 mBreathe(vec2 p) {
  float z = 1. - .08 * uBass - .05 * uKick;
  vec2 q = rot(sin(uTime * .3) * .05 * (.3 + uMid)) * p * z;
  q += .01 * sin(q.yx * 6. + uTime) * uMid;
  vec3 c = img(q);
  // a strong hit slides the frame toward recursion, then it eases back
  return mix(c, mDroste(p), smoothstep(.55, 1., uKick) * .8);
}

vec3 mMosh(vec2 p, vec2 p0) {
  vec2 bid = floor(p0 * 24.);
  float tq = floor(uTime * 2.);
  vec2 mv = (vec2(hash21(bid + tq), hash21(bid + 17. + tq)) - .5) * .012 * (.4 + uMid * 2.);
  vec3 c = prev(p0 + mv);
  float fresh = .015 + step(.75, uKick);
  c = mix(c, img(p), clamp(fresh, 0., 1.));
  if (hash21(bid + floor(uTime * 6.)) > .985 - .03 * uHigh) c = img(p + mv * 6.);
  return c;
}

vec3 mSort(vec2 p) {
  float th = .55 - .3 * uBass - .1 * uKick;
  vec3 c0 = img(p);
  if (luma(c0) < th) return c0;
  vec2 step_ = vec2(0., .007 * (.6 + uMid));
  float up = 0., dn = 0.;
  for (int i = 1; i < 36; i++) { if (luma(img(p + step_ * float(i))) < th) break; up = float(i); }
  for (int i = 1; i < 36; i++) { if (luma(img(p - step_ * float(i))) < th) break; dn = float(i); }
  float s = dn / max(up + dn, 1.);
  vec3 a = img(p - step_ * dn), b = img(p + step_ * up);
  return mix(a, b, smoothstep(0., 1., s));
}

vec3 mScanline(vec2 p, vec2 p0) {
  float line = floor((p0.y + .5) * uRes.y / 3.);
  float off = (hash11(line + floor(uTime * 30.)) - .5) * .08 * uHigh + sin(p.y * 40. + uTime * 8.) * .006 * uMid;
  off += step(.96, fract(p0.y * 2. - uTime * .5)) * .06 * uKick;
  vec3 c = img(p + vec2(off, 0.));
  return c * (.7 + .3 * sin((p0.y + .5) * uRes.y * PI / 3.));
}

vec3 mThresh(vec2 p) {
  float levels = floor(mix(6., 2., uKick)) + 1.;
  vec3 c = img(p);
  return floor(c * levels + .5) / levels;
}

vec3 mSolar(vec2 p) {
  vec3 c = img(p);
  float w = .65 - .35 * uKick - .1 * uBass;
  return mix(c, 1. - c, smoothstep(w - .05, w + .05, luma(c)));
}

vec3 mHalftone(vec2 p) {
  float n = mix(95., 50., uBass);
  float ang = .4 + uTime * .05;
  vec2 q = rot(ang) * p * n;
  vec2 cell = floor(q) + .5;
  vec3 c = img(rot(-ang) * (cell / n));
  float rad = sqrt(luma(c)) * .62 * (1. + uKick * .35);
  float d = length(fract(q) - .5);
  return mix(uPal[0], c * 1.15, smoothstep(rad, rad - .08, d));
}

vec3 mVhs(vec2 p, vec2 p0) {
  float tr = uKick;
  vec2 q = p;
  q.x += (hash11(floor(uTime * 20.)) - .5) * .004;
  q.x += (noise(vec2(p0.y * 30., uTime * 10.)) - .5) * .012 * (1. + tr * 6.);
  q.y += tr * .12 * (hash11(floor(uTime * 15.)) - .5);
  float sh = .006 + .01 * uHigh;
  vec3 c = vec3(img(q + vec2(sh, 0.)).r, img(q).g, img(q - vec2(sh, 0.)).b);
  c = mix(vec3(luma(c)), c, .8);
  float band = smoothstep(.04, 0., abs(fract(p0.y * .7 - uTime * .17) - .5));
  c += band * (hash21(vec2(p0.y * 700., uTime)) - .3) * .5;
  c += (hash21(p0 * 900. + uTime) - .5) * .07;
  return c;
}

void main() {
  vec2 frag = vUv * uRes;
  vec2 p0 = (frag - .5 * uRes) / uRes.y;
  vec2 p = domain(p0);
  vec3 c;
  bool fb = false;
  if (uMode == 0) c = mNone(p);
  else if (uMode == 1) { c = mSmear(p, p0); fb = true; }
  else if (uMode == 2) c = mDroste(p);
  else if (uMode == 3) c = mInfinite(p);
  else if (uMode == 4) c = mCorridor(p);
  else if (uMode == 5) c = mCube(p);
  else if (uMode == 6) c = mPlanet(p);
  else if (uMode == 7) { c = mWindows(p, p0); fb = true; }
  else if (uMode == 8) { c = mMelt(p, p0); fb = true; }
  else if (uMode == 9) c = mShatter(p);
  else if (uMode == 10) c = mPrism(p);
  else if (uMode == 11) c = mTerrain(p);
  else if (uMode == 12) c = mBreathe(p);
  else if (uMode == 13) { c = mMosh(p, p0); fb = true; }
  else if (uMode == 14) c = mSort(p);
  else if (uMode == 15) c = mScanline(p, p0);
  else if (uMode == 16) c = mThresh(p);
  else if (uMode == 17) c = mSolar(p);
  else if (uMode == 18) c = mHalftone(p);
  else c = mVhs(p, p0);

  if (uMode != 0 && uMode != 11) c = mix(img(p0), c, uWet);
  if (!fb && uTrails > .001) {
    float z = 1. - max(uChaos - .5, 0.) * .06 * (1. + uBass);
    c = mix(c, prev(p0 * z), uTrails * .88);
  }
  outColor = vec4(clamp(c, 0., 1.), 1.);
}`;

export const POST_FRAG = COMMON + `
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uTime, uHeat, uBright, uVig, uKick, uHigh, uBass;
uniform vec3 uPal[5];

void main() {
  vec3 c = textureLod(uScene, vUv, 0.).rgb;
  vec3 bloom = vec3(0.);
  float w = 1., wsum = 0.;
  for (int i = 2; i <= 7; i++) {
    vec3 b = textureLod(uScene, vUv, float(i)).rgb;
    bloom += max(b - .62, 0.) * w;
    wsum += w;
    w *= 1.3;
  }
  bloom /= wsum;
  c += bloom * uHeat * (1.2 + uKick * 2.5 + uHigh * .8);  // the picture's own light blooms
  c *= 1. + smoothstep(.65, 1., luma(c)) * uHigh * .25 * uHeat; // music adds glow to highlights
  vec2 q = vUv - .5;
  c += uPal[3] * uKick * uKick * .18 * uHeat * smoothstep(.1, .7, length(q) * 1.4); // kick accent from the edges

  vec2 p = q * vec2(uRes.x / uRes.y, 1.);
  float v = clamp(1. - uVig * dot(p, p) * 2.2, 0., 1.);
  c = mix(uPal[0] * .5, c, v);

  c *= uBright;
  c = min(c, 1. + (c - 1.) * .3);  // soft shoulder above white
  c += (hash21(vUv * uRes + fract(uTime) * 100.) - .5) * .025;
  outColor = vec4(c, 1.);
}`;
