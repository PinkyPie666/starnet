// Master palette, lifted from ansimuz's Tech Lab tileset (17 colors) plus a few
// accents. Every procedural sprite uses only these, so it matches the tiles.

export const P = {
  black: '#000000',
  ink: '#202040', // dark outline navy
  ink2: '#283962',
  steel0: '#3a3a5a',
  steel1: '#404060',
  steel2: '#606080',
  steel3: '#a4aec1',
  white: '#fffcff',
  teal0: '#062c31',
  teal1: '#004040',
  teal2: '#206060',
  teal3: '#00a080',
  glow: '#2ee8c0',
  blue0: '#3d5772',
  blue1: '#6d9ccd',
  elec: '#3aa0ff',
  amber0: '#3d2e00',
  amber1: '#806000',
  amber2: '#a2860a',
  amber3: '#f0b030',
  red: '#ff6b4a',
  pink: '#ff5fa2',
  violet: '#a98bff',
} as const;

// Skin ramps: [light, mid, shadow]
export const SKIN_TONES: [string, string, string][] = [
  ['#ffe0c8', '#e8b08c', '#a8705a'],
  ['#f2c39b', '#cf9468', '#8c5a3c'],
  ['#d8a070', '#b07848', '#704828'],
  ['#a87048', '#845030', '#4c2c18'],
  ['#704830', '#543420', '#2c1a10'],
];

// Hair: [light, dark]
export const HAIR_COLORS: [string, string][] = [
  ['#3a3a5a', '#202040'], // black-navy
  ['#a4aec1', '#606080'], // silver
  ['#2ee8c0', '#00a080'], // teal dye
  ['#c88040', '#7a4420'], // copper
  ['#f0d060', '#a2860a'], // blond
  ['#ff5fa2', '#a03070'], // pink dye
];

// Uniforms: [light, mid, dark]
export const UNIFORMS: [string, string, string][] = [
  ['#6d9ccd', '#3d5772', '#202040'], // station blue
  ['#f0b030', '#a2860a', '#3d2e00'], // command amber
  ['#00a080', '#206060', '#062c31'], // engineering teal
  ['#c8a0ff', '#7a5ac8', '#2c2050'], // science violet
  ['#ff8a6a', '#c04a30', '#401810'], // security red
  ['#a4aec1', '#606080', '#3a3a5a'], // ops grey
];

export const HAIR_STYLES = ['Short', 'Long', 'Crest', 'Shaved'];
export const UNIFORM_NAMES = ['Station Blue', 'Command Amber', 'Engineering Teal', 'Science Violet', 'Security Red', 'Ops Grey'];

export const hex = (s: string) => parseInt(s.slice(1), 16);
