export const MODES = [
  { name: 'none', hint: 'Plain picture, gently pumping with the bass' },
  { name: 'smear', hint: 'Liquid feedback - the picture flows and kicks re-ink it' },
  { name: 'droste', hint: 'Infinite spiral of the picture inside itself' },
  { name: 'infinite', hint: 'Endless tunnel; kicks send a light pulse down it' },
  { name: 'corridor', hint: 'Fly down a hall lined with the picture' },
  { name: 'cube', hint: 'Spinning cube wrapped in the picture' },
  { name: 'planet', hint: 'Little-planet projection of the picture' },
  { name: 'windows', hint: 'Grid of lagging screens; kicks snap every screen to now' },
  { name: 'melt', hint: 'The picture drips and runs' },
  { name: 'shatter', hint: 'Glass shards that explode on kicks' },
  { name: 'prism', hint: 'Refracted facets with RGB split from the highs' },
  { name: 'terrain', hint: 'Flyover of a landscape grown from the picture' },
  { name: 'breathe', hint: 'Readable picture that breathes; hard hits slide into recursion' },
  { name: 'mosh', hint: 'Datamosh smear; kicks snap back to a clean frame' },
  { name: 'sort', hint: 'Pixel-sorted streaks through the bright areas' },
  { name: 'scanline', hint: 'Line-by-line jitter driven by the highs' },
  { name: 'thresh', hint: 'Posterised levels; kicks lower the level count' },
  { name: 'solar', hint: 'Solarised; kicks widen the flip' },
  { name: 'halftone', hint: 'Print dots that swell with the bass' },
  { name: 'vhs', hint: 'Worn tape; kicks slam the tracking' },
];

export const LENS_STYLES = ['', 'glass ribs', 'glass fan', 'anamorphic', 'melt', 'glitch', 'pixels', 'fly eye'];

export const PARAM_GROUPS = [
  {
    title: 'Look',
    params: [
      { key: 'wet', label: 'Dry / Wet', min: 0, max: 1, step: .01, def: 1 },
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
      { key: 'slice', label: 'Slice', min: 0, max: 1, step: .01, def: 0 },
      { key: 'lens', label: 'Lens', min: 0, max: 1, step: .01, def: 0 },
      { key: 'lensStyle', label: 'Lens style', min: 1, max: 7, step: 1, def: 1, names: LENS_STYLES },
      { key: 'chaos', label: 'Chaos', min: 0, max: 1, step: .01, def: .3 },
    ],
  },
  {
    title: 'Light',
    params: [
      { key: 'trails', label: 'Trails', min: 0, max: 1, step: .01, def: .25 },
      { key: 'heat', label: 'Heat', min: 0, max: 1.5, step: .01, def: .7 },
      { key: 'bright', label: 'Bright', min: .6, max: 2.4, step: .01, def: 1 },
      { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: .01, def: .35 },
      { key: 'hueDrift', label: 'Hue drift', min: 0, max: 1, step: .01, def: 0 },
    ],
  },
  {
    title: 'Response',
    params: [
      { key: 'react', label: 'React', min: 0, max: 2, step: .01, def: 1 },
      { key: 'decay', label: 'Decay', min: 0, max: 1, step: .01, def: .4 },
      { key: 'gain', label: 'Input gain', min: 0, max: 3, step: .01, def: 1 },
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
