export const MODES = [
  { name: 'none', label: 'Original', hint: 'Plain picture, gently pumping with the bass' },
  { name: 'smear', label: 'Liquid', hint: 'Liquid feedback - the picture flows and kicks re-ink it' },
  { name: 'droste', label: 'Spiral', hint: 'Infinite spiral of the picture inside itself' },
  { name: 'infinite', label: 'Tunnel', hint: 'Endless tunnel; kicks send a light pulse down it' },
  { name: 'corridor', label: 'Corridor', hint: 'Fly down a hall lined with the picture' },
  { name: 'cube', label: 'Cube', hint: 'Spinning cube wrapped in the picture' },
  { name: 'planet', label: 'Planet', hint: 'Little-planet projection of the picture' },
  { name: 'windows', label: 'Screens', hint: 'Grid of lagging screens; kicks snap every screen to now' },
  { name: 'melt', label: 'Melt', hint: 'The picture drips and runs' },
  { name: 'shatter', label: 'Shatter', hint: 'Glass shards that explode on kicks' },
  { name: 'prism', label: 'Prism', hint: 'Refracted facets with RGB split from the highs' },
  { name: 'terrain', label: 'Terrain', hint: 'Flyover of a landscape grown from the picture' },
  { name: 'breathe', label: 'Breathe', hint: 'Readable picture that breathes; hard hits slide into recursion' },
  { name: 'mosh', label: 'Glitch', hint: 'Datamosh smear; kicks snap back to a clean frame' },
  { name: 'sort', label: 'Streak', hint: 'Pixel-sorted streaks through the bright areas' },
  { name: 'scanline', label: 'Scanline', hint: 'Line-by-line jitter driven by the highs' },
  { name: 'thresh', label: 'Poster', hint: 'Posterised levels; kicks lower the level count' },
  { name: 'solar', label: 'Invert', hint: 'Solarised; kicks widen the flip' },
  { name: 'halftone', label: 'Halftone', hint: 'Print dots that swell with the bass' },
  { name: 'vhs', label: 'VHS', hint: 'Worn tape; kicks slam the tracking' },
];

export const LENS_STYLES = ['', 'glass ribs', 'glass fan', 'anamorphic', 'melt', 'glitch', 'pixels', 'fly eye'];

// `primary` groups sit in the open "Feel" section; the rest fold into "Fine tune".
export const PARAM_GROUPS = [
  {
    title: 'Feel',
    primary: true,
    params: [
      { key: 'react', label: 'Beat response', min: 0, max: 2, step: .01, def: 1 },
      { key: 'chaos', label: 'Wobble', min: 0, max: 1, step: .01, def: .3 },
      { key: 'trails', label: 'Trails', min: 0, max: 1, step: .01, def: .25 },
      { key: 'heat', label: 'Glow', min: 0, max: 1.5, step: .01, def: .7 },
      { key: 'speed', label: 'Speed', min: 0, max: 2, step: .01, def: 1 },
    ],
  },
  {
    title: 'Space',
    params: [
      { key: 'symmetry', label: 'Symmetry', min: 0, max: 12, step: 1, def: 0 },
      { key: 'spin', label: 'Spin', min: -1, max: 1, step: .01, def: .2 },
      { key: 'tiles', label: 'Tiles', min: 0, max: 6, step: 1, def: 0 },
      { key: 'twist', label: 'Twist', min: -1, max: 1, step: .01, def: 0 },
      { key: 'slice', label: 'Slices', min: 0, max: 1, step: .01, def: 0 },
      { key: 'lens', label: 'Lens', min: 0, max: 1, step: .01, def: 0 },
      { key: 'lensStyle', label: 'Lens style', min: 1, max: 7, step: 1, def: 1, names: LENS_STYLES },
    ],
  },
  {
    title: 'Light',
    params: [
      { key: 'bright', label: 'Brightness', min: .6, max: 2.4, step: .01, def: 1 },
      { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: .01, def: .35 },
      { key: 'hueDrift', label: 'Colour cycle', min: 0, max: 1, step: .01, def: 0 },
      { key: 'wet', label: 'Effect mix', min: 0, max: 1, step: .01, def: 1 },
    ],
  },
  {
    title: 'Audio',
    params: [
      { key: 'decay', label: 'Settle time', min: 0, max: 1, step: .01, def: .4 },
      { key: 'gain', label: 'Sensitivity', min: 0, max: 3, step: .01, def: 1 },
    ],
  },
];

export const DEFAULTS = Object.fromEntries(
  PARAM_GROUPS.flatMap(g => g.params).map(p => [p.key, p.def]),
);

// Each preset is a full look: mode, motion, post and palette.
export const PRESETS = [
  { name: 'Liquid Dream', mode: 'smear', palette: 'Photo', params: { trails: 0, chaos: .55, heat: .8 } },
  { name: 'Endless Tunnel', mode: 'infinite', palette: 'Neon', params: { heat: 1, twist: .25, vignette: .5 } },
  { name: 'Droste Spiral', mode: 'droste', palette: 'Photo', params: { trails: .35, heat: .6 } },
  { name: 'Kaleido Temple', mode: 'breathe', palette: 'Gold', params: { symmetry: 6, spin: .35, twist: .3, heat: .9 } },
  { name: 'Tiny Planet', mode: 'planet', palette: 'Photo', params: { trails: .2, vignette: .6 } },
  { name: 'Glass Shards', mode: 'shatter', palette: 'Ice', params: { lens: .35, lensStyle: 2, heat: 1 } },
  { name: 'Data Mosh', mode: 'mosh', palette: 'Photo', params: { chaos: .4, heat: .5 } },
  { name: 'VHS Memory', mode: 'vhs', palette: 'Vapor', params: { vignette: .75, trails: .2, heat: .6 } },
  { name: 'Halftone Pop', mode: 'halftone', palette: 'Sunset', params: { heat: .4, vignette: .2 } },
  { name: 'Meltdown', mode: 'melt', palette: 'Ember', params: { lens: .4, lensStyle: 4, heat: .9 } },
  { name: 'Prism Fan', mode: 'prism', palette: 'Neon', params: { symmetry: 2, lens: .5, lensStyle: 1 } },
  { name: 'Flyover', mode: 'terrain', palette: 'Photo', params: { heat: .8, vignette: .3 } },
  { name: 'Pixel Sorter', mode: 'sort', palette: 'Mono', params: { trails: .4, slice: .3 } },
  { name: 'Hall of Mirrors', mode: 'corridor', palette: 'Photo', params: { symmetry: 1, heat: .9 } },
  { name: 'Screens', mode: 'windows', palette: 'Acid', params: { heat: .7 } },
  { name: 'Compound Eye', mode: 'none', palette: 'Photo', params: { lens: .6, lensStyle: 7, chaos: .45, trails: .3 } },
];
