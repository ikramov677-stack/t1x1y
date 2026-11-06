// Colour model (iro shitei, 色指定): standard daytime colours → converted automatically per time of day (night / dawn), the same as real anime's "時間帯別 色指定" (per-time-of-day colour models)
import { hex } from './cel.js';

export const BASE = {
  skin: { f: '#ffd6bc', s: '#e09a86', h: '#fff1e6', l: '#5a2e2e' },
  blush: '#ff9a9a',
  hair: { f: '#6a3a32', s: '#42211f', h: '#b0705a', l: '#3a1830' },
  lash: '#1c0f26',
  jacket: { f: '#c9a467', s: '#97733f', h: '#f0d8a0', l: '#4a3216' },
  stripe: { f: '#b08d55', s: '#866838', l: '#4a3216' },
  scarf: { f: '#1fc4b2', s: '#11867c', h: '#8ff5e8', l: '#0b3e3a' },
  pants: { f: '#363c5c', s: '#20243c', h: '#5b6490', l: '#0d0f1f' },
  boot: { f: '#48424f', s: '#2a2632', h: '#80798f', l: '#121016' },
  glove: { f: '#3e3a4a', s: '#26232f', h: '#7a7690', l: '#100e16' },
  cuff: { f: '#22c3b2', s: '#138578', l: '#0b3d38' },
  strap: { f: '#5a4c66', s: '#3a3044', l: '#16101c' },
  lens: { f: '#86e6ff', s: '#3a9fd0', h: '#ffffff', l: '#1d3a58' },
  phone: { f: '#2a2a34', s: '#16161d', h: '#5c5c70', l: '#08080c' },
  white: { f: '#f3f6fc', s: '#a9b3cd', h: '#ffffff', l: '#39456a' },
  teal: { f: '#1fc4b2', s: '#12857c', h: '#8ff5e8', l: '#0b3e3a' },
  magenta: { f: '#1fc4b2', s: '#12857c', l: '#0b3e3a' },
  dark: { f: '#2b2d40', s: '#181a26', h: '#50546e', l: '#08090f' },
  chrome: { f: '#dfe7f3', s: '#646f90', h: '#ffffff', l: '#2b3350' },
  gold: { f: '#e2b24e', s: '#9a6c28', h: '#fff0b0', l: '#4d3210' },
  tire: { f: '#23232f', s: '#15151c', h: '#565873', l: '#07070b' },
  seat: { f: '#2e2a36', s: '#1b1822', h: '#5d5670', l: '#0a090d' },
  eye: { f: '#b0642a', s: '#5e2c14', h: '#ffc070', l: '#2a1006' },
  white_eye: '#fbf8ff',
  mouth: '#9a3b4a',
};

const mul = (c, m) => { const v = hex(c); return '#' + v.map((x, i) => Math.max(0, Math.min(255, Math.round(x * m[i]))).toString(16).padStart(2, '0')).join(''); };

// Time of day: f/h are multiplied by lit, s by shade, and line colours are darkened along with them
export const LIGHTS = {
  day: { lit: [1, 1, 1], shade: [1, 1, 1], line: [1, 1, 1] },
  night: { lit: [.78, .74, 1.0], shade: [.58, .52, .92], line: [.8, .7, 1.1] },
  dawn: { lit: [1.04, .9, .84], shade: [.86, .66, .8], line: [1, .8, .85] },
  torch: { lit: [1.04, .8, .6], shade: [.6, .4, .46], line: [.85, .6, .55] },
  morning: { lit: [1.03, 1.0, .95], shade: [.92, .86, .96], line: [1, .95, 1] },
  sil: { lit: [.2, .16, .32], shade: [.14, .1, .24], line: [.3, .2, .5] },
  backlit: { lit: [.42, .3, .55], shade: [.24, .16, .36], line: [.4, .25, .5] },
};
export function palette(name) {
  const L = LIGHTS[name], out = {};
  for (const [k, v] of Object.entries(BASE)) {
    if (typeof v === 'string') { out[k] = mul(v, L.lit); continue; }
    out[k] = {};
    for (const [kk, c] of Object.entries(v)) out[k][kk] = mul(c, kk === 's' ? L.shade : kk === 'l' ? L.line : L.lit);
  }
  return out;
}
export const PAL = { day: palette('day'), night: palette('night'), dawn: palette('dawn'), torch: palette('torch'), morning: palette('morning'), sil: palette('sil'), backlit: palette('backlit') };
// Night skin is specified by hand: neutral-cool lit area + cool purple shadow (converting by multiplication turns the whole face pink)
Object.assign(PAL.night.skin, { f: '#e9c9c4', s: '#9b82b4', h: '#fff2f2' });
PAL.night.blush = '#e0869a';

Object.assign(PAL.torch.skin, { f: '#f2c09a', s: '#a8686a', h: '#ffe4c8' });
