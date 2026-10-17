// Palettes have five slots: background, shadow, mid, accent, glow.
// The picture keeps its own colours; the palette colours the world around it
// (kick accents, bloom tint, terrain sky, frames).

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export const PRESET_PALETTES = {
  Photo: null, // extracted from the current image
  Neon: ['#07010f', '#2a0b4a', '#7b2ff7', '#ff2bd6', '#2bfff1'],
  Sunset: ['#140508', '#4a0f1e', '#c2384b', '#ff8a3d', '#ffe29a'],
  Ocean: ['#010812', '#06294a', '#0f6f8f', '#2de1c2', '#e0fff9'],
  Acid: ['#050800', '#1e3300', '#5c9e00', '#c6ff00', '#fbffd6'],
  Mono: ['#000000', '#222222', '#777777', '#dddddd', '#ffffff'],
  Ember: ['#0a0300', '#3d0c00', '#a12a00', '#ff6a00', '#ffd27a'],
  Vapor: ['#0d0221', '#261447', '#ff6c11', '#fd3777', '#9cf6f6'],
  Forest: ['#020a05', '#0b2a17', '#2f6b3a', '#a7d46f', '#f2ffd9'],
  Ice: ['#02060c', '#13263b', '#4d7ea8', '#9fd3ff', '#ffffff'],
  Gold: ['#080500', '#2b1d04', '#7a5512', '#e3b448', '#fff4cc'],
  Blood: ['#060000', '#2a0004', '#7d0010', '#ff1f3d', '#ffd0d6'],
};

export function presetPalette(name) {
  const p = PRESET_PALETTES[name];
  return p ? p.map(hex) : null;
}

const lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
const sat = c => Math.max(...c) - Math.min(...c);

/** k-means the image down to five colours, ordered into palette slots. */
export function extractPalette(source) {
  const N = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, N, N);
  const data = g.getImageData(0, 0, N, N).data;
  const px = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    px.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
  }
  if (px.length < 10) return presetPalette('Neon');

  px.sort((a, b) => lum(a) - lum(b));
  const K = 5;
  let cents = Array.from({ length: K }, (_, k) => px[Math.floor((k + .5) / K * px.length)].slice());
  const assign = new Array(px.length).fill(0);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) {
        const c = cents[k], d = (px[i][0] - c[0]) ** 2 + (px[i][1] - c[1]) ** 2 + (px[i][2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      assign[i] = best;
    }
    const sums = cents.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    cents = cents.map((c, k) => (sums[k][3] ? sums[k].slice(0, 3).map(v => v / sums[k][3]) : c));
  }
  cents.sort((a, b) => lum(a) - lum(b));
  // darkest = background, brightest = glow, most saturated of the rest = accent
  const bg = cents[0], glow = cents[4];
  const rest = cents.slice(1, 4);
  const accent = rest.reduce((x, y) => (sat(y) > sat(x) ? y : x));
  const [sh, mid] = rest.filter(c => c !== accent);
  const boost = c => { const m = Math.max(...c, .01); return c.map(v => Math.min(1, v / m * Math.max(m, .75))); };
  return [bg.map(v => v * .6), sh, mid, boost(accent), boost(glow)];
}

export function hueRotate(pal, turns) {
  if (!turns) return pal;
  const a = turns * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  // same matrix as the CSS hue-rotate() filter
  const m = [
    .213 + .787 * c - .213 * s, .715 - .715 * c - .715 * s, .072 - .072 * c + .928 * s,
    .213 - .213 * c + .143 * s, .715 + .285 * c + .140 * s, .072 - .072 * c - .283 * s,
    .213 - .213 * c - .787 * s, .715 - .715 * c + .715 * s, .072 + .928 * c + .072 * s,
  ];
  return pal.map(([r, g, b]) => [
    Math.min(1, Math.max(0, m[0] * r + m[1] * g + m[2] * b)),
    Math.min(1, Math.max(0, m[3] * r + m[4] * g + m[5] * b)),
    Math.min(1, Math.max(0, m[6] * r + m[7] * g + m[8] * b)),
  ]);
}

export const toCss = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
