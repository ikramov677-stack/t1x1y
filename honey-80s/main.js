// «Мёд почти не портится» — 80s cel anime short (vertical 1080×1920)
// Engine modules cel.js / head80.js / fx.js / post.js / pal.js adapted from the Lemo-Opuscar cel-anime-80s demo (MIT).
import { canvas, W, H, cel, path, poly, line, ribbon, flutter, mix, rgba, airbrush, vgrad, rng, hash, TAU, LWK } from './cel.js';
import { head80 } from './head80.js';
import { PAL } from './pal.js';
import { speedLines, flare, lamp } from './fx.js';
import { makePost } from './post.js';
import { SC, VO, DUR, S, T, BEAT, sceneAt, NET_FRAC } from './timeline.js';

const qs = new URLSearchParams(location.search);
const [sc, g0] = canvas(W, H), [gc, e0] = canvas(W, H), [ovc, ov] = canvas(W, H);
const post = makePost(document.getElementById('gl'));

await document.fonts.load('700 58px "PT Sans Narrow"', 'АБВабвЁё');
await document.fonts.load('100px "Russo One"', 'ТЫСЯЧИЛЕТ');
await document.fonts.load('60px "Dela Gothic One"', 'ハチミツ');

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3), eio = x => x * x * (3 - 2 * x);
const back = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const f12 = t => Math.floor(t * 12) / 12, f8 = t => Math.floor(t * 8) / 8;
const TEXTS_NOW = [];

// ———————————————————————————— honey & glass colour models
const HONEY = { f: '#f2a521', s: '#c4700c', h: '#ffd970', l: '#7a3c06' };
const HONEY_C = { f: '#f4dc96', s: '#d6b464', h: '#fff4cc', l: '#8a6420' };
const CLAY = { f: '#c8784a', s: '#8c4a2c', h: '#eaa678', l: '#4a2010' };
const GLASS_L = 'rgba(230,246,255,.85)';

// ———————————————————————————— painted plates (drawn once)
function kitchenPlate(mode) {
  const [c, g] = canvas(W, H), [ec, e] = canvas(W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const dusk = mode === 'dusk';
  vgrad(g, 0, 0, W, H, dusk ? [[0, '#3a2350'], [.5, '#6a3a52'], [1, '#2a1830']] : [[0, '#e8e2d2'], [.6, '#f2e8d4'], [1, '#c8b89c']]);
  // window
  const wx = 150, wy = 260, ww = 780, wh = 820;
  vgrad(g, wx, wy, ww, wh, dusk ? [[0, '#2b2a6a'], [.45, '#a04a8a'], [.75, '#ff8a5a'], [1, '#ffcf7a']] : [[0, '#8ec8ff'], [.6, '#cfe8ff'], [1, '#fff6dc']]);
  if (dusk) { airbrush(g, 540, wy + wh - 60, 150, 150, '#ffe0a0', .95, .3); airbrush(e, 540, wy + wh - 60, 260, 200, '#ff9a50', .8, .8); vgrad(e, wx, wy + wh * .5, ww, wh * .5, [[0, 'rgba(255,120,60,0)'], [1, 'rgba(255,150,70,.45)']]); }
  else { airbrush(g, 760, wy + 160, 110, 110, '#fffbe8', 1, .3); airbrush(e, 760, wy + 160, 220, 220, '#fff2c0', .5, .9); }
  // clouds in the window
  const R = rng(dusk ? 4 : 9);
  for (let i = 0; i < 5; i++) { const x = wx + R() * ww, y = wy + 120 + R() * 400; airbrush(g, x, y, 140 + R() * 120, 30 + R() * 20, dusk ? '#ffb0a0' : '#ffffff', .6, .7); airbrush(g, x, y + 16, 120, 16, dusk ? '#7a3a6a' : '#cfe0f4', .5, .8); }
  // frame + cross bars
  g.fillStyle = dusk ? '#2a1a2a' : '#f8f4ec'; for (const [x, y, w, h] of [[wx - 24, wy - 24, ww + 48, 24], [wx - 24, wy + wh, ww + 48, 30], [wx - 24, wy, 24, wh], [wx + ww, wy, 24, wh], [wx + ww / 2 - 9, wy, 18, wh], [wx, wy + wh * .45 - 9, ww, 18]]) g.fillRect(x, y, w, h);
  // curtains
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? wx - 70 : wx + ww + 70;
    const pts = [[x0 - 60 * s, wy - 60], [x0 + 140 * s, wy - 60], [x0 + 90 * s, wy + 400], [x0 + 150 * s, wy + wh + 40], [x0 - 60 * s, wy + wh + 60]];
    cel(g, pts, { f: dusk ? '#7a3a52' : '#f2b0a0', s: dusk ? '#4a1e36' : '#d08478', so: [30 * s, 0], l: dusk ? '#2a0e1e' : '#8a4a40', lw: 3 });
  }
  // table
  const ty = 1290;
  vgrad(g, 0, ty, W, H - ty, dusk ? [[0, '#7a4a32'], [1, '#3a2018']] : [[0, '#c89060'], [1, '#8a5a38']]);
  g.fillStyle = dusk ? '#a8684a' : '#e8b480'; g.fillRect(0, ty, W, 14);
  const R2 = rng(22); g.strokeStyle = rgba(dusk ? '#2a1008' : '#6a3a1a', .35); g.lineWidth = 3;
  for (let i = 0; i < 26; i++) { const y = ty + 30 + R2() * (H - ty - 40); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 60) g.lineTo(x, y + Math.sin(x * .01 + i) * 6); g.stroke(); }
  // window light on the table
  g.save(); g.globalAlpha = dusk ? .22 : .3; g.fillStyle = dusk ? '#ffb070' : '#fff6d8';
  g.beginPath(); g.moveTo(wx + 60, ty); g.lineTo(wx + ww - 60, ty); g.lineTo(wx + ww + 120, H); g.lineTo(wx - 120, H); g.fill(); g.restore();
  return [c, ec];
}

function tombPlate() {
  const TH = 3900, [c, g] = canvas(W, TH), [ec, e] = canvas(W, TH);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, TH);
  // night desert sky
  vgrad(g, 0, 0, W, 1100, [[0, '#0c0a2e'], [.6, '#3a2160'], [1, '#c8605a']]);
  const R = rng(7); for (let i = 0; i < 160; i++) { const x = R() * W, y = R() * 800; g.fillStyle = rgba('#ffffff', .3 + R() * .6); g.fillRect(x, y, 2, 2); }
  airbrush(g, 820, 260, 70, 70, '#fff4d8', 1, .2); airbrush(e, 820, 260, 160, 160, '#ffe6b0', .5, .9);
  // pyramids
  for (const [x, w, h, col] of [[300, 700, 520, '#5a3048'], [760, 520, 380, '#4a2840']]) {
    cel(g, poly([[x - w / 2, 1100], [x, 1100 - h], [x + w / 2, 1100]]), { f: col, s: mix(col, '#000000', .35), sh: [[[x, 1100 - h], [x + w / 2, 1100], [x + w * .1, 1100]]], l: '#1e0e1e', lw: 3 });
  }
  vgrad(g, 0, 1060, W, 140, [[0, '#a85a48'], [1, '#2a1418']]);
  // descent into stone
  vgrad(g, 0, 1180, W, TH - 1180, [[0, '#1a0e10'], [.15, '#4a2c1e'], [.6, '#5a3622'], [1, '#2a1610']]);
  const R2 = rng(31);
  for (let y = 1260; y < TH - 500; y += 120) {
    const off = (Math.floor(y / 120) % 2) * 110;
    for (let x = -off; x < W; x += 220) {
      g.strokeStyle = rgba('#1a0a06', .55); g.lineWidth = 4; g.strokeRect(x + 4, y + 4, 212, 112);
      airbrush(g, x + 110, y + 60, 90, 40, R2() < .5 ? '#7a5032' : '#3a2214', .25, .9);
    }
  }
  // carved generic glyph bands
  for (const yb of [1700, 2300, 2900]) {
    g.fillStyle = rgba('#2a160c', .55); g.fillRect(60, yb, W - 120, 150);
    g.strokeStyle = rgba('#c89060', .7); g.lineWidth = 6;
    for (let k = 0; k < 9; k++) {
      const x = 120 + k * 104, y = yb + 75, r = R2();
      g.beginPath();
      if (r < .25) { g.ellipse(x, y, 34, 18, 0, 0, TAU); g.moveTo(x + 8, y); g.arc(x, y, 8, 0, TAU); }
      else if (r < .5) { g.moveTo(x - 30, y + 40); g.lineTo(x, y - 45); g.lineTo(x + 30, y + 40); }
      else if (r < .75) { g.moveTo(x - 30, y - 30); g.quadraticCurveTo(x + 40, y - 30, x, y + 40); g.moveTo(x - 30, y + 10); g.lineTo(x + 25, y + 10); }
      else { g.arc(x, y - 20, 18, 0, TAU); g.moveTo(x, y); g.lineTo(x, y + 45); g.moveTo(x - 22, y + 15); g.lineTo(x + 22, y + 15); }
      g.stroke();
    }
  }
  // torches
  for (const [x, y] of [[110, 1550], [970, 1950], [110, 2550], [970, 3150]]) {
    g.fillStyle = '#2a1a10'; g.fillRect(x - 10, y, 20, 90);
    airbrush(g, x, y + 40, 260, 260, '#ff8a3a', .22, 1); airbrush(e, x, y - 10, 160, 200, '#ff9a40', .55, 1);
  }
  // chamber floor with clay jars
  vgrad(g, 0, TH - 520, W, 520, [[0, '#4a2a18'], [1, '#1e0e08']]);
  const R3 = rng(5);
  for (let k = 0; k < 7; k++) {
    const x = 80 + k * 155 + R3() * 20, y = TH - 330 + (k % 2) * 40, s = .8 + R3() * .3;
    clayJar(g, x, y, s, CLAY, false);
  }
  return [c, ec, TH];
}

function clayJar(g, x, y, s, C, open, lidLift = 0, lidTilt = 0) {
  const body = [[x - 30 * s, y - 120 * s], [x - 70 * s, y - 70 * s], [x - 78 * s, y], [x - 55 * s, y + 70 * s], [x, y + 90 * s], [x + 55 * s, y + 70 * s], [x + 78 * s, y], [x + 70 * s, y - 70 * s], [x + 30 * s, y - 120 * s]];
  cel(g, body, { f: C.f, s: C.s, so: [-22 * s, -8 * s], h: C.h, ho: [10 * s, 6 * s], l: C.l, lw: 3 });
  line(g, [[x - 72 * s, y - 30 * s], [x + 72 * s, y - 30 * s]], rgba(C.l, .5), 2.5);
  line(g, [[x - 76 * s, y + 10 * s], [x + 76 * s, y + 10 * s]], rgba(C.l, .5), 2.5);
  const neck = new Path2D(); neck.ellipse(x, y - 122 * s, 34 * s, 11 * s, 0, 0, TAU);
  cel(g, neck, { f: open ? '#2a1206' : C.s, l: C.l, lw: 3 });
  if (!open) {
    g.save(); g.translate(x, y - 132 * s - lidLift); g.rotate(lidTilt);
    const lid = new Path2D(); lid.ellipse(0, 0, 40 * s, 14 * s, 0, 0, TAU);
    cel(g, lid, { f: C.h, s: C.f, so: [0, 8 * s], l: C.l, lw: 3 });
    cel(g, poly([[-8 * s, -4 * s], [8 * s, -4 * s], [6 * s, -22 * s], [-6 * s, -22 * s]]), { f: C.f, l: C.l, lw: 2.5 });
    g.restore();
  }
}

function combPlate() {
  const PW = 2200, [c, g] = canvas(PW, H), [ec, e] = canvas(PW, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, PW, H);
  vgrad(g, 0, 0, PW, H, [[0, '#5a3010'], [1, '#2a1406']]);
  const r = 74, R = rng(13);
  for (let row = -1; row < H / (r * 1.5) + 1; row++) for (let col = -1; col < PW / (r * 1.732) + 1; col++) {
    const x = col * r * 1.732 + (row % 2) * r * .866, y = row * r * 1.5;
    const hex = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * TAU / 6; hex.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    const inner = hex.map(([hx, hy]) => [x + (hx - x) * .82, y + (hy - y) * .82]);
    cel(g, poly(hex), { f: '#e8b04a', s: '#b07420', so: [8, 8], l: '#5a3008', lw: 3 });
    const full = R() < .62;
    cel(g, poly(inner), full ? { f: HONEY.f, s: HONEY.s, so: [-10, -10], h: HONEY.h, ho: [6, 6], l: HONEY.l, lw: 2 } : { f: '#5a3410', s: '#3a1e08', so: [10, 10], l: '#2a1404', lw: 2 });
    if (full) { g.fillStyle = 'rgba(255,255,240,.85)'; g.beginPath(); g.ellipse(x - 22, y - 26, 14, 7, -.5, 0, TAU); g.fill(); e.fillStyle = 'rgba(255,170,40,.28)'; e.fill(poly(inner)); }
  }
  return [c, ec, PW];
}

function gardenPlate() {
  const PW = 2700, [c, g] = canvas(PW, H), [ec, e] = canvas(PW, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, PW, H);
  vgrad(g, 0, 0, PW, 1200, [[0, '#2f7fe0'], [.7, '#8fd0ff'], [1, '#e8f6ff']]);
  airbrush(g, 2100, 300, 120, 120, '#fffbe0', 1, .3); airbrush(e, 2100, 300, 300, 300, '#fff4c0', .55, 1);
  const R = rng(17);
  for (let i = 0; i < 7; i++) { const x = R() * PW, y = 280 + R() * 500, w = 220 + R() * 180; airbrush(g, x, y, w, w * .35, '#ffffff', .95, .45); airbrush(g, x + 20, y + w * .2, w * .9, w * .12, '#b8cff0', .8, .6); }
  // hills
  for (const [y0, col, amp, k] of [[1080, '#6ab07a', 70, .003], [1180, '#4a9a5a', 60, .005]]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= PW; x += 30) g.lineTo(x, y0 + Math.sin(x * k + y0) * amp); g.lineTo(PW, H); g.fill();
  }
  vgrad(g, 0, 1250, PW, H - 1250, [[0, '#3f8f4a'], [1, '#2a6a34']]);
  // flowers
  const cols = [['#ff7aa8', '#c8406e'], ['#ffd23f', '#c8961a'], ['#ffffff', '#c8c8d8'], ['#b88aff', '#7a50c8']];
  for (let i = 0; i < 90; i++) {
    const x = R() * PW, y = 1300 + R() * 560, s = .5 + (y - 1300) / 560 * .9, [f, sd] = cols[Math.floor(R() * 4)];
    line(g, [[x, y], [x + 4, y + 70 * s]], '#2a6a30', 4 * s);
    for (let k = 0; k < 5; k++) { const a = k * TAU / 5, p = new Path2D(); p.ellipse(x + Math.cos(a) * 14 * s, y + Math.sin(a) * 14 * s, 13 * s, 9 * s, a, 0, TAU); cel(g, p, { f, s: sd, so: [4 * s, 4 * s], l: mix(sd, '#000000', .4), lw: 1.6 }); }
    const ctr = new Path2D(); ctr.arc(x, y, 8 * s, 0, TAU); cel(g, ctr, { f: '#ffb020', l: '#7a4a08', lw: 1.5 });
  }
  return [c, ec, PW];
}

// ———————————————————————————— cels
function glassJar(g, e, x, y, s, o = {}) {
  const H2 = o.crystal ? HONEY_C : HONEY;
  const w = 150 * s, h = 190 * s;
  const body = new Path2D(); body.roundRect(x - w, y - h, w * 2, h * 2, 42 * s);
  g.save(); g.fillStyle = 'rgba(210,235,255,.18)'; g.fill(body); g.restore();
  // honey inside
  const top = y - h + 40 * s;
  const HP = new Path2D(); HP.roundRect(x - w + 10 * s, top, w * 2 - 20 * s, h * 2 - 50 * s, 34 * s);
  cel(g, HP, { f: H2.f, s: H2.s, so: [-28 * s, 0], h: H2.h, ho: [16 * s, 0], l: H2.l, lw: 2.5 });
  if (o.crystal) { const R = rng(44); g.save(); g.clip(HP); for (let i = 0; i < 260; i++) { g.fillStyle = rgba(R() < .5 ? '#fffbe8' : '#c8a050', .55); g.fillRect(x - w + R() * w * 2, top + R() * h * 2, 4 * s, 4 * s); } g.restore(); }
  if (e && !o.crystal) { e.save(); e.fillStyle = rgba('#ffa628', .45 * (o.glow ?? 1)); e.fill(HP); e.restore(); }
  // glass outline + hard highlight stripes
  g.strokeStyle = GLASS_L; g.lineWidth = 5; g.stroke(body);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x - w + 26 * s, y - h + 50 * s, 16 * s, h * 1.4); g.fillRect(x - w + 52 * s, y - h + 70 * s, 7 * s, h * .9);
  // label
  const L = new Path2D(); L.roundRect(x - w * .62, y - 10 * s, w * 1.24, 110 * s, 10 * s);
  cel(g, L, { f: '#fff3dc', s: '#e2caa0', so: [-10 * s, 0], l: '#7a4a20', lw: 2.5 });
  g.save(); g.font = `700 ${Math.round(64 * s)}px "PT Sans Narrow"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#9a3a14'; g.fillText(o.label || 'МЁД', x, y + 46 * s); g.restore();
  // cloth cap + string
  const cap = [[x - w - 18 * s, y - h + 6 * s], [x - w * .6, y - h - 50 * s], [x + w * .6, y - h - 50 * s], [x + w + 18 * s, y - h + 6 * s], [x + w * .8, y - h + 46 * s, 1], [x + w * .4, y - h + 26 * s, 1], [x, y - h + 50 * s, 1], [x - w * .4, y - h + 26 * s, 1], [x - w * .8, y - h + 46 * s, 1]];
  cel(g, cap, { f: '#e8545e', s: '#a82c40', so: [-18 * s, 0], h: '#ff9a9a', ho: [8 * s, 4 * s], l: '#5a1020', lw: 3,
    clipFn: gg => { gg.fillStyle = 'rgba(255,255,255,.55)'; for (let k = -4; k < 5; k++) gg.fillRect(x + k * 34 * s, y - h - 60 * s, 12 * s, 120 * s); } });
  line(g, [[x - w - 6 * s, y - h + 14 * s], [x + w + 6 * s, y - h + 14 * s]], '#f4e0b0', 6 * s);
  return HP;
}

function bee(g, e, x, y, s, t, o = {}) {
  const dir = o.dir || 1;
  g.save(); g.translate(x, y); g.scale(dir * s, s);
  // wings (on ones: fast flutter)
  const fl = Math.sin(t * 90) * .5 + .5;
  for (const [wx, wy, a] of [[-8, -46, -.9], [18, -44, -.4]]) {
    const wp = new Path2D(); wp.ellipse(wx, wy - 20 * fl, 30, 46, a, 0, TAU);
    g.fillStyle = 'rgba(230,248,255,.6)'; g.fill(wp); g.strokeStyle = 'rgba(90,120,160,.8)'; g.lineWidth = 2; g.stroke(wp);
    if (e) { e.save(); e.translate(x, y); e.scale(dir * s, s); e.fillStyle = 'rgba(180,230,255,.12)'; e.fill(wp); e.restore(); }
  }
  // legs
  for (const k of [-20, 0, 20]) line(g, [[k, 30], [k - 6, 52 + Math.sin(t * 8 + k) * 3]], '#2a1a10', 4);
  // body + stripes
  const B = new Path2D(); B.ellipse(-10, 8, 62, 44, 0, 0, TAU);
  cel(g, B, { f: '#ffc928', s: '#d08a10', so: [10, 12], h: '#fff090', ho: [-6, -8], l: '#4a2a06', lw: 3,
    clipFn: gg => { gg.fillStyle = '#2a1a14'; for (const sx of [-44, -14, 16]) gg.fillRect(sx, -50, 16, 120); } });
  cel(g, poly([[-72, 6], [-92, 10], [-72, 18]]), { f: '#2a1a14' });
  // head
  const Hd = new Path2D(); Hd.arc(50, -6, 32, 0, TAU);
  cel(g, Hd, { f: '#2e2030', s: '#1a1020', so: [8, 8], h: '#6a5a78', ho: [-4, -4], l: '#0e0810', lw: 3 });
  // big 80s eye
  const ey = new Path2D(); ey.ellipse(60, -12, 13, 17, 0, 0, TAU);
  g.fillStyle = '#fbf8ff'; g.fill(ey);
  g.fillStyle = '#5a2c10'; g.beginPath(); g.ellipse(63, -9, 8, 12, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(60, -15, 4, 3, -.5, 0, TAU); g.fill();
  if (o.sweat) cel(g, [[78, -46, 1], [86, -30], [78, -24], [70, -30]], { f: '#e8f8ff', l: '#4a6a98', lw: 2 });
  if (o.blush) { g.fillStyle = 'rgba(255,120,140,.6)'; g.beginPath(); g.ellipse(64, 10, 10, 4, 0, 0, TAU); g.fill(); }
  // antennae
  line(g, [[44, -34], [36, -64], [26, -72]], '#2a1a14', 3); line(g, [[56, -34], [62, -66], [72, -74]], '#2a1a14', 3);
  g.restore();
}

function bug(g, x, y, s, col, t, ph, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const st = Math.floor(f8(t + ph) * 8) % 2;
  line(g, [[-14, 30], [-18 - st * 6, 52]], mix(col, '#000000', .5), 5); line(g, [[14, 30], [18 + (1 - st) * 6, 52]], mix(col, '#000000', .5), 5);
  const pts = []; for (let k = 0; k < 8; k++) { const a = k * TAU / 8, r = 46 + hash(k + ph * 10) * 10; pts.push([Math.cos(a) * r, Math.sin(a) * r * .85]); }
  cel(g, pts, { f: col, s: mix(col, '#000000', .3), so: [10, 10], h: mix(col, '#ffffff', .4), ho: [-6, -6], l: mix(col, '#000000', .55), lw: 3 });
  for (const sx of [-14, 14]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(sx - 10, -8, 9, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.ellipse(sx - 13, -5, 4.5, 6, 0, 0, TAU); g.fill(); }
  line(g, [[-20, 18], [-12, 14], [-4, 18]], mix(col, '#000000', .6), 3);   // sad mouth
  if (o.sweat) cel(g, [[30, -40, 1], [37, -26], [30, -20], [23, -26]], { f: '#e8f8ff', l: '#4a6a98', lw: 2 });
  if (o.case) { const c = new Path2D(); c.roundRect(-78, 6, 36, 28, 5); cel(g, c, { f: '#a8642a', s: '#7a4214', so: [6, 6], l: '#3a1a06', lw: 2.5 }); line(g, [[-68, 6], [-66, -2], [-54, -2], [-52, 6]], '#3a1a06', 3); line(g, [[-42, 12], [-38, 0]], mix(col, '#000000', .5), 5); }
  g.restore();
}

function anyaTiny(g, e, x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const P = PAL.torch;
  line(g, [[-10, 0], [-14, 70]], P.pants.l, 14); line(g, [[10, 0], [16, 70]], P.pants.l, 14);
  cel(g, [[-28, -90], [28, -90], [32, 4], [-32, 4]], { f: P.jacket.f, s: P.jacket.s, so: [10, 0], l: P.jacket.l, lw: 3 });
  cel(g, [[-20, -94], [20, -94], [22, -84], [-22, -84]], { f: P.scarf.f, l: P.scarf.l, lw: 2 });
  line(g, [[24, -80], [52, -120]], P.jacket.f, 13);   // arm up with torch
  const hd = new Path2D(); hd.arc(0, -122, 26, 0, TAU); cel(g, hd, { f: P.skin.f, s: P.skin.s, so: [8, 0], l: P.skin.l, lw: 2.5 });
  cel(g, [[-28, -126], [-22, -150], [8, -156], [28, -136], [12, -138], [-10, -128]], { f: P.hair.f, l: P.hair.l, lw: 2.5 });
  cel(g, ribbon(flutter(-24, -132, Math.PI * .9, 70, 8, 6, 1, t * 6, 30), u => (1 - u) * 18 + 1), { f: P.hair.f, l: P.hair.l, lw: 2 });
  line(g, [[52, -120], [58, -160]], '#3a2410', 8);
  g.restore();
  const fx = x + 58 * s, fy = y - 172 * s, fl = 1 + .15 * Math.sin(t * 24);
  cel(g, [[fx - 12 * s, fy + 12 * s], [fx, fy - 36 * s * fl], [fx + 12 * s, fy + 12 * s]], { f: '#ffd24a', h: '#fff6c0', hi: [[[fx - 4 * s, fy + 8 * s], [fx, fy - 18 * s], [fx + 4 * s, fy + 8 * s]]] });
  lamp(null, e, fx, fy, 60 * s, '#ff9a40', .9);
}

// ———————————————————————————— type
function chrome(g, e, txt, x, y, size, lt, o = {}) {
  if (lt < 0) return;
  const k = Math.floor(lt * 12), flick = o.static ? 1 : k < 1 ? 0 : k === 2 ? .3 : k === 4 ? .6 : 1;
  if (flick <= 0) return;
  for (const ctx of [g, e]) { ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -.2, 1, 0, 0); ctx.font = `${size}px "Russo One"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; }
  const gr = g.createLinearGradient(0, -size * .82, 0, size * .05);
  gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(.46, '#7fc8ff'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.54, '#3a2a7a'); gr.addColorStop(.8, o.warm ? '#ff8a40' : '#ff6aa0'); gr.addColorStop(1, '#ffd08a');
  g.globalAlpha = flick;
  g.strokeStyle = '#120830'; g.lineWidth = size * .14; g.strokeText(txt, 0, 0);
  g.strokeStyle = o.neon || '#ffb020'; g.lineWidth = size * .055; g.strokeText(txt, 0, 0);
  g.fillStyle = gr; g.fillText(txt, 0, 0);
  e.strokeStyle = rgba(o.neon || '#ffb020', .9 * flick); e.lineWidth = size * .08; e.strokeText(txt, 0, 0);
  e.fillStyle = rgba('#ffe0a0', .25 * flick); e.fillText(txt, 0, 0);
  const tw = g.measureText(txt).width;
  g.restore(); e.restore();
  if (!o.static) {
    const sx = x - tw / 2 - 200 + seg(lt, .2, 1.1) * (tw + 400);
    e.save(); e.globalCompositeOperation = 'lighter';
    const sg = e.createLinearGradient(sx - 90, 0, sx + 90, 0); sg.addColorStop(0, rgba('#ffffff', 0)); sg.addColorStop(.5, rgba('#ffffff', .7)); sg.addColorStop(1, rgba('#ffffff', 0));
    e.fillStyle = sg; e.fillRect(sx - 90, y - size, 180, size * 1.15); e.restore();
    const ga = Math.sin(seg(lt, 1.0, 1.5) * Math.PI);
    if (ga > 0) flare(e, x - tw / 2 + 20, y - size * .75, .45 * ga * size / 120, '#ffe6a0', { ghosts: false, streak: 500 });
  }
  TEXTS_NOW.push({ id: o.id || txt, text: txt, x0: x - tw / 2, y0: y - size, x1: x + tw / 2, y1: y + size * .1 });
}
function kata(g, e, txt, x, y, size, a = 1) {
  for (const [ctx, c] of [[g, '#35e7ff'], [e, rgba('#35e7ff', .7 * a)]]) { ctx.save(); ctx.font = `${size}px "Dela Gothic One"`; ctx.textAlign = 'center'; ctx.fillStyle = c; ctx.globalAlpha = ctx === g ? a : 1; ctx.fillText(txt, x, y); ctx.restore(); }
}
function label(g, txt, x, y, size, col = '#fff0a0', a = 1, id) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = `700 ${size}px "PT Sans Narrow"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = '#120a1e'; g.lineWidth = size * .2; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y);
  const tw = g.measureText(txt).width; g.restore();
  TEXTS_NOW.push({ id: id || txt, text: txt, x0: x - tw / 2, y0: y - size / 2, x1: x + tw / 2, y1: y + size / 2 });
}
function cam(S, z, cx, cy, dx = 0, dy = 0) { for (const x of [S.g, S.e]) { x.translate(W / 2 + dx, H / 2 + dy); x.scale(z, z); x.translate(-cx, -cy); } }

// ———————————————————————————— assets
const A = {};
[A.kD, A.kDe] = kitchenPlate('dusk');
[A.kM, A.kMe] = kitchenPlate('morning');
[A.tomb, A.tombE, A.tombH] = tombPlate();
[A.comb, A.combE, A.combW] = combPlate();
[A.garden, A.gardenE, A.gardenW] = gardenPlate();

// ———————————————————————————— shots
const SHOTS = {
  jar(S) {   // 1 · hook: backlit jar at dusk, chrome title
    const z = 1 + eo(S.u) * .07;
    cam(S, z, 540, 1150);
    S.g.drawImage(A.kD, 0, 0); S.e.drawImage(A.kDe, 0, 0);
    const HP = glassJar(S.g, S.e, 540, 1230, 1.4, { glow: 1 });
    // light band sweeping across the held jar
    const bx = -300 + seg(S.lt, .3, 1.6) * 1700;
    S.g.save(); S.g.clip(HP); const lg = S.g.createLinearGradient(bx - 80, 0, bx + 80, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,250,220,.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); S.g.fillStyle = lg; S.g.fillRect(bx - 80, 0, 160, H); S.g.restore();
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    kata(S.g, S.e, 'ハチミツ', 540, 230, 64, seg(S.lt, .4, .6));
    chrome(S.g, S.e, 'ТЫСЯЧИ', 540, 380, 150, S.lt - .45, { id: 't1' });
    chrome(S.g, S.e, 'ЛЕТ?!', 560, 545, 170, S.lt - .65, { id: 't2' });
  },
  tomb(S) {   // 2 · multiplane crane down into the tomb
    const travel = A.tombH - H, y = eio(seg(S.lt, 0, S.D - .3)) * travel;
    S.g.drawImage(A.tomb, 0, -y); S.e.drawImage(A.tombE, 0, -y);
    // tiny Anya on the chamber floor
    anyaTiny(S.g, S.e, 600, A.tombH - 300 - y, 1.25, S.t);
    // foreground multiplane: stone pillars moving faster
    const fy = -y * 1.35 + 900;
    for (const [x, w] of [[-60, 180], [W - 120, 180]]) {
      vgrad(S.g, x, 0, w, H, [[0, '#120806'], [1, '#2a140a']]);
      S.g.fillStyle = 'rgba(255,140,60,.12)'; S.g.fillRect(x + (x < 0 ? w - 14 : 0), 0, 14, H);
      for (let k = 0; k < 8; k++) { S.g.fillStyle = 'rgba(0,0,0,.4)'; S.g.fillRect(x, ((fy + k * 300) % 2400 + 2400) % 2400 - 240, w, 8); }
    }
    label(S.g, 'ДРЕВНИЙ ЕГИПЕТ', 540, 220, 64, '#ffd27a', seg(S.lt, .6, 1.0));
  },
  open(S) {   // 3 · Anya opens the clay jar: light pours through the frame
    const P = PAL.torch, tOpen = T.lidOpen - S.t0, opened = S.lt >= tOpen, k = seg(S.lt, tOpen, tOpen + .6);
    vgrad(S.g, 0, 0, W, H, [[0, '#2a140c'], [.6, '#4a2414'], [1, '#1a0a06']]);
    airbrush(S.g, 200, 500, 300, 380, '#ff8a3a', .25, 1); airbrush(S.e, 160, 420, 140, 200, '#ff9040', .4, 1);
    const z = 1 + eo(seg(S.lt, 0, S.D)) * .06; cam(S, z, 640, 1100);
    // light from the jar
    if (opened) {
      S.e.save(); S.e.globalCompositeOperation = 'lighter';
      for (let r = 0; r < 9; r++) { const a = -Math.PI / 2 + (r - 4) * .17 + Math.sin(S.t * 2 + r) * .02, L = 650 * k;
        const gr = S.e.createLinearGradient(780, 980, 780 + Math.cos(a) * L, 980 + Math.sin(a) * L); gr.addColorStop(0, rgba('#ffd060', .8)); gr.addColorStop(1, rgba('#ffa020', 0));
        S.e.fillStyle = gr; S.e.beginPath(); S.e.moveTo(780, 980); S.e.lineTo(780 + Math.cos(a - .05) * L, 980 + Math.sin(a - .05) * L); S.e.lineTo(780 + Math.cos(a + .05) * L, 980 + Math.sin(a + .05) * L); S.e.fill(); }
      S.e.restore();
      airbrush(S.g, 780, 980, 420 * k, 300 * k, '#ffcf6a', .35 * k, 1);
    }
    // Anya bust, 3/4 view, looking at the jar
    const face = opened ? (S.lt > tOpen + .5 ? 'smileopen' : 'surprised') : 'neutral';
    const look = opened ? [.8, .5] : [.6, .6];
    S.g.save(); S.g.translate(300, 960); S.g.scale(2.6, 2.6);
    LWK.k = .7;
    head80(S.g, P, { view: 'q', expr: face, look, ph: S.t * .4, wind: .1, light: [1, .3], skinRim: opened ? '#ffd27a' : null, reflect: opened ? '#ffd060' : null, blush: opened ? .45 : .2 });
    LWK.k = 1; S.g.restore();
    // the clay jar, foreground right
    const lift = opened ? eo(k) * 150 : 0;
    clayJar(S.g, 780, 1240, 2.1, CLAY, false, lift * 1.4, lift * .004);
    if (opened) {
      const m = new Path2D(); m.ellipse(780, 984, 70, 22, 0, 0, TAU);
      S.g.fillStyle = '#ffd24a'; S.g.fill(m); S.g.fillStyle = '#fff6c0'; S.g.beginPath(); S.g.ellipse(760, 980, 30, 7, 0, 0, TAU); S.g.fill();
      S.e.fillStyle = 'rgba(255,210,90,.95)'; S.e.fill(m);
      flare(S.e, 780, 975, .9 * k, '#ffd27a', { streak: 900 });
    }
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    if (opened) chrome(S.g, S.e, 'НЕ ИСПОРТИЛСЯ!', 540, 330, 96, S.lt - tOpen - .5, { id: 'ok' });
    // impact flash at the opening
    if (S.lt >= tOpen && S.lt < tOpen + 2 / 24) { S.g.fillStyle = '#fff8e0'; S.g.fillRect(0, 0, W, H); }
  },
  water(S) {   // 4 · notebook insert
    vgrad(S.g, 0, 0, W, H, [[0, '#f4ead2'], [1, '#e2d2b0']]);
    S.g.strokeStyle = 'rgba(80,120,170,.25)'; S.g.lineWidth = 2; for (let y = 120; y < H; y += 56) { S.g.beginPath(); S.g.moveTo(0, y); S.g.lineTo(W, y); S.g.stroke(); }
    S.g.strokeStyle = 'rgba(200,60,60,.35)'; S.g.beginPath(); S.g.moveTo(120, 0); S.g.lineTo(120, H); S.g.stroke();
    const z = 1 + S.u * .04; cam(S, z, 540, 960);
    const drop = (x, y, s, C) => cel(S.g, [[x, y - 150 * s, 1], [x + 70 * s, y - 20 * s], [x + 90 * s, y + 50 * s], [x, y + 120 * s], [x - 90 * s, y + 50 * s], [x - 70 * s, y - 20 * s]], { f: C.f, s: C.s, so: [-18 * s, -6 * s], h: C.h, ho: [10 * s, 0], l: C.l, lw: 3 });
    const pop1 = back(seg(S.lt, .1, .45)), pop2 = back(seg(S.lt, .4, .75));
    if (pop1 > 0) { drop(320, 900, 1.6 * pop1, HONEY); S.e.fillStyle = 'rgba(255,170,40,.25)'; S.e.beginPath(); S.e.arc(320, 900, 160 * pop1, 0, TAU); S.e.fill(); }
    if (pop2 > 0) drop(760, 900, 1.6 * pop2, { f: '#7ac8ff', s: '#3a86d0', h: '#e0f4ff', l: '#1a3a68' });
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    label(S.g, 'мёд', 320, 1180, 64, '#ffd27a', seg(S.lt, .3, .5));
    label(S.g, 'вода', 760, 1180, 64, '#9fd8ff', seg(S.lt, .6, .8));
    // red cross drawn on twos
    const cx = seg(f12(S.lt), 1.0, 1.4), cy2 = seg(f12(S.lt), 1.3, 1.7);
    S.g.strokeStyle = '#e02a2a'; S.g.lineWidth = 26; S.g.lineCap = 'round';
    if (cx > 0) { S.g.beginPath(); S.g.moveTo(600, 720); S.g.lineTo(600 + 320 * cx, 720 + 360 * cx); S.g.stroke(); }
    if (cy2 > 0) { S.g.beginPath(); S.g.moveTo(920, 720); S.g.lineTo(920 - 320 * cy2, 720 + 360 * cy2); S.g.stroke(); }
    chrome(S.g, S.e, 'МАЛО ВОДЫ', 540, 420, 120, S.lt - 1.6, { id: 'water' });
    label(S.g, '≈ 17 %', 540, 540, 70, '#fff0a0', seg(S.lt, 2.0, 2.2));
  },
  bact(S) {   // 5 · bacteria pack their suitcases (side tracking, 3 layers)
    const x = S.lt * 160;
    vgrad(S.g, 0, 0, W, H, [[0, '#f2c8d8'], [.6, '#f6dcc0'], [1, '#e8c098']]);
    for (let k = 0; k < 6; k++) airbrush(S.g, ((k * 320 + x * .3) % 1500) - 200, 500 + (k % 2) * 200, 160, 160, '#ffffff', .25, 1);
    vgrad(S.g, 0, 1280, W, H - 1280, [[0, '#c89060'], [1, '#8a5a38']]);
    glassJar(S.g, S.e, 760 + x * .9, 1060, 1.1, { glow: .6 });
    for (let i = 0; i < 3; i++) {
      const bx = 560 - i * 260 - S.lt * 120 + x * .9, by = 1330 + Math.abs(Math.sin((f8(S.lt) + i * .3) * 9)) * -12;
      bug(S.g, bx, by, 2.0, ['#8ad06a', '#b08aff', '#6ac8d0'][i], S.lt, i * .13, { case: true, sweat: i === 1 });
    }
    // foreground crumbs moving fastest
    for (let k = 0; k < 7; k++) { const fx = ((k * 220 + x * 1.6) % 1500) - 200; S.g.fillStyle = '#a06a3a'; S.g.beginPath(); S.g.ellipse(fx, 1760 + (k % 3) * 40, 30, 12, 0, 0, TAU); S.g.fill(); }
    chrome(S.g, S.e, 'НЕГДЕ ЖИТЬ', 540, 420, 120, S.lt - .5, { id: 'bact' });
  },
  acid(S) {   // 6 · pH badge; tilt from the jar up to the scale
    vgrad(S.g, 0, 0, W, H, [[0, '#2a2a5a'], [.5, '#5a3a7a'], [1, '#2a1a3a']]);
    for (let k = 0; k < 40; k++) { S.g.fillStyle = rgba('#ffffff', .25); S.g.fillRect(hash(k) * W, hash(k + 9) * H, 3, 3); }
    const dy = (1 - eio(seg(S.lt, 0, 1.4))) * -260; cam(S, 1, 540, 960, 0, dy);
    glassJar(S.g, S.e, 540, 1180, 1.3, { glow: .8 });
    // lemon cel
    S.g.save(); S.g.translate(860, 1420); S.g.rotate(-.35);
    cel(S.g, [[-130, 0, 1], [-96, -50], [0, -72], [96, -50], [130, 0, 1], [96, 50], [0, 72], [-96, 50]], { f: '#ffe14a', s: '#d0a810', so: [-16, 0], h: '#fff8b0', ho: [10, -6], l: '#6a5004', lw: 3 });
    cel(S.g, [[100, -40], [150, -100], [170, -60]], { f: '#4aa84a', s: '#2a7a2a', so: [4, 4], l: '#14401a', lw: 2.5 });
    S.g.restore();
    // pH scale
    const x0 = 140, x1 = 940, y = 640;
    const sg = S.g.createLinearGradient(x0, 0, x1, 0);
    ['#e8302a', '#f4762a', '#f8c42a', '#b8d83a', '#4ac85a', '#3aa8c8', '#4a5ad8', '#7a3ac8'].forEach((c, i, a) => sg.addColorStop(i / (a.length - 1), c));
    const bar = new Path2D(); bar.roundRect(x0, y - 34, x1 - x0, 68, 34);
    S.g.fillStyle = sg; S.g.fill(bar); S.g.strokeStyle = '#120a1e'; S.g.lineWidth = 5; S.g.stroke(bar);
    for (let n = 1; n <= 14; n += 1) { const xx = x0 + (n - 1) / 13 * (x1 - x0); S.g.fillStyle = '#120a1e'; S.g.fillRect(xx - 2, y + 34, 4, 16); }
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    const mk = eo(seg(S.lt, .6, 1.8)), mx = x0 + (lerpN(7, 3.9, mk) - 1) / 13 * (x1 - x0), my = y + dy - 64;
    cel(S.g, [[mx - 26, my - 40], [mx + 26, my - 40], [mx, my + 4]], { f: '#ffffff', l: '#120a1e', lw: 4 });
    label(S.g, '7', x0 + 6 / 13 * (x1 - x0), y + dy + 80, 44, '#ffffff', .8, 'p7');
    label(S.g, 'кисло', x0 + 40, y + dy + 80, 44, '#ff8a7a', 1, 'pk');
    chrome(S.g, S.e, 'КИСЛЫЙ', 540, 380, 140, S.lt - .3, { id: 'acid' });
    label(S.g, 'pH ≈ ' + (lerpN(7, 3.9, mk)).toFixed(1).replace('.', ','), mx, my - 80, 60, '#fff0a0', seg(S.lt, .6, .8), 'ph');
  },
  bee(S) {   // 7 · a bee fills a cell (slow pan across the comb)
    const px = 200 + S.u * 260;
    S.g.drawImage(A.comb, -px, 0); S.e.drawImage(A.combE, -px, 0);
    const cx = 760 - px + 200, cy = 1000;
    const hov = Math.sin(f12(S.t) * 6) * 6;
    bee(S.g, S.e, cx - 150, cy - 140 + hov, 2.3, S.t, { dir: 1 });
    // drip into the cell
    const dk = (S.lt * 1.2) % 1;
    S.g.fillStyle = HONEY.f; S.g.beginPath(); S.g.ellipse(cx - 20, cy - 60 + dk * 70, 10, 16, 0, 0, TAU); S.g.fill();
    S.e.fillStyle = 'rgba(255,170,40,.6)'; S.e.beginPath(); S.e.arc(cx - 20, cy - 60 + dk * 70, 30, 0, TAU); S.e.fill();
    chrome(S.g, S.e, 'ФЕРМЕНТ', 540, 400, 140, S.lt - .5, { id: 'enz' });
    for (let k = 0; k < 5; k++) { const a = S.t * 2 + k * 1.26, r = 60 + 20 * Math.sin(S.t * 3 + k); lamp(S.g, S.e, cx - 20 + Math.cos(a) * r, cy - 40 + Math.sin(a) * r, 8, '#fff0a0', .8); }
  },
  shield(S) {   // 8 · the comb glows like a shield; a microbe bounces off
    const z = 1.18 - eo(S.u) * .18; cam(S, z, 540, 1000);
    S.g.drawImage(A.comb, -560, 0); S.e.drawImage(A.combE, -560, 0);
    const pulse = .5 + .5 * Math.sin(S.t * 5);
    S.e.save(); S.e.globalCompositeOperation = 'lighter'; S.e.fillStyle = rgba('#ffb030', .06 + .06 * pulse); S.e.fillRect(0, 0, W, H); S.e.restore();
    // shield dome outline
    S.g.strokeStyle = rgba('#fff0a0', .9); S.g.lineWidth = 10; S.g.beginPath(); S.g.ellipse(540, 1100, 470, 560, 0, Math.PI, TAU); S.g.stroke();
    S.e.strokeStyle = rgba('#ffd060', .9); S.e.lineWidth = 34; S.e.beginPath(); S.e.ellipse(540, 1100, 470, 560, 0, Math.PI, TAU); S.e.stroke();
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    const th = T.shieldHit - S.t0;
    if (S.lt < th) { const u = seg(S.lt, 0, th); bug(S.g, -100 + u * 520, 380 + u * 160, 1.3, '#8ad06a', S.lt, 0); speedLines(S.g, Math.floor(S.lt * 24), { type: 'h', n: 18, col: '#ffffff', a: .5, hmax: 5, seed: 3 }); }
    else if (S.lt < th + 2 / 24) {   // impact frame: inverted silhouette over radial lines
      S.g.fillStyle = '#1a0a2a'; S.g.fillRect(0, 0, W, H);
      speedLines(S.g, 1, { type: 'radial', cx: 420, cy: 540, n: 120, col: '#fff0a0', a: .9 });
      S.g.fillStyle = '#ffffff'; S.g.beginPath(); S.g.arc(420, 540, 70, 0, TAU); S.g.fill();
    } else { const u = seg(S.lt, th, th + 1); bug(S.g, 420 - u * 600, 540 - u * 500 + u * u * 200, 1.3 * (1 - u * .4), '#8ad06a', S.lt, 0, { sweat: true }); }
    chrome(S.g, S.e, 'МИКРОБАМ — СТОП', 540, 300, 92, S.lt - th, { id: 'stop' });
  },
  spoon(S) {   // 9 · the bee and the teaspoon, with a tape rewind on the self-correction
    vgrad(S.g, 0, 0, W, H, [[0, '#9fd8a0'], [.55, '#f4e4b8'], [1, '#d0a878']]);
    for (let k = 0; k < 12; k++) airbrush(S.g, hash(k) * W, 300 + hash(k + 3) * 700, 80 + hash(k + 5) * 80, 80 + hash(k + 5) * 80, ['#ffffff', '#ffd2e0', '#fff0a0'][k % 3], .35, 1);
    vgrad(S.g, 0, 1300, W, H - 1300, [[0, '#c89060'], [1, '#8a5a38']]);
    const tn = T.net - S.t0, after = S.lt >= tn;
    const z = after ? 1 + eo(seg(S.lt, tn + .5, S.D)) * .35 : 1; cam(S, z, 640, 1240);
    // teaspoon
    const sp = new Path2D(); sp.ellipse(700, 1240, 150, 92, 0, 0, TAU);
    cel(S.g, sp, { f: '#d8dee8', s: '#8a94a8', so: [-16, -10], h: '#ffffff', ho: [10, 6], l: '#3a4258', lw: 4 });
    cel(S.g, poly([[840, 1222], [1120, 1196], [1124, 1222], [846, 1258]]), { f: '#d8dee8', s: '#8a94a8', so: [0, -8], l: '#3a4258', lw: 4 });
    const inner = new Path2D(); inner.ellipse(700, 1240, 124, 70, 0, 0, TAU);
    const level = after ? lerpN(.5, .085, eo(seg(S.lt, tn + .35, tn + 1.2))) : eo(seg(S.lt, .4, 1.4)) * .5;
    if (level > 0) {
      S.g.save(); S.g.clip(inner);
      const r = Math.sqrt(level) * 130;
      const hp = new Path2D(); hp.ellipse(700, 1250, r * 1.05, r * .62, 0, 0, TAU);
      cel(S.g, hp, { f: HONEY.f, s: HONEY.s, so: [-10, -4], h: HONEY.h, ho: [6, -4], l: HONEY.l, lw: 2.5 }); S.g.restore();
      S.e.fillStyle = 'rgba(255,170,40,.45)'; S.e.beginPath(); S.e.ellipse(700, 1250, Math.sqrt(level) * 140, Math.sqrt(level) * 85, 0, 0, TAU); S.e.fill();
    }
    bee(S.g, S.e, 300, 1150 + Math.sin(f12(S.t) * 7) * 8, 2.0, S.t, { dir: 1, sweat: after, blush: after });
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    if (!after) chrome(S.g, S.e, '½ ЛОЖКИ?', 540, 420, 140, S.lt - .5, { id: 'half' });
    else {
      chrome(S.g, S.e, '1/12 ЛОЖКИ!', 540, 420, 130, S.lt - tn - .6, { id: 'twelfth' });
      label(S.g, 'за всю жизнь', 540, 540, 64, '#fff0a0', seg(S.lt, tn + 1.2, tn + 1.4));
    }
    return { track: S.lt >= tn - .05 && S.lt < tn + .35 ? 1 - .4 * seg(S.lt, tn - .05, tn + .35) : 0 };
  },
  cryst(S) {   // 10 · the kitchen again, repainted for morning: crystallised + liquid
    const z = 1.04; cam(S, z, 540, 1150);
    S.g.drawImage(A.kM, 0, 0); S.e.drawImage(A.kMe, 0, 0);
    glassJar(S.g, S.e, 720, 1120, 1.0, { crystal: true });
    glassJar(S.g, S.e, 330, 1180, .85, { glow: .5 });
    S.g.setTransform(1, 0, 0, 1, 0, 0); S.e.setTransform(1, 0, 0, 1, 0, 0);
    label(S.g, 'засахарился', 720, 840, 54, '#fff0a0', seg(S.lt, .5, .7));
    label(S.g, 'жидкий', 330, 940, 54, '#fff0a0', seg(S.lt, .8, 1.0));
    chrome(S.g, S.e, 'ЭТО НОРМА ✓', 540, 380, 116, S.lt - 1.4, { id: 'norm', neon: '#4adf8a' });
    // Anya peeks in from the left edge, smiling
    const pe = eo(seg(S.lt, 1.6, 2.3));
    if (pe > 0) { S.g.save(); S.g.translate(-40 + pe * 230, 1380); S.g.scale(1.6, 1.6); LWK.k = .8; head80(S.g, PAL.morning, { view: 'q', expr: 'smile', ph: S.t * .4, wind: .1, light: [-1, -.6], blush: .4 }); LWK.k = 1; S.g.restore(); }
  },
  sub(S) {   // 11 · garden: side track with the bee, end card
    const px = eio(seg(S.lt, 0, S.D)) * (A.gardenW - W);
    S.g.drawImage(A.garden, -px, 0); S.e.drawImage(A.gardenE, -px, 0);
    const bx = 300 + Math.sin(S.lt * 1.5) * 60, by = 900 + Math.sin(S.lt * 2.2) * 80;
    bee(S.g, S.e, bx, by, 1.6, S.t, { dir: 1 });
    for (let k = 1; k < 6; k++) { S.g.fillStyle = rgba('#ffffff', .6 - k * .1); S.g.beginPath(); S.g.arc(bx - k * 50, by + Math.sin(S.lt * 2.2 - k * .4) * 30 + 10, 6, 0, TAU); S.g.fill(); }
    const ec = S.lt - .8;
    if (ec > 0) {
      S.g.save(); S.g.fillStyle = rgba('#0c0a2e', .35 * seg(ec, 0, .5)); S.g.fillRect(0, 160, W, 520); S.g.restore();
      kata(S.g, S.e, 'ハチミツ', 540, 250, 56, seg(ec, 0, .3));
      chrome(S.g, S.e, 'ФАКТЫ', 540, 430, 170, ec, { id: 'e1', neon: '#ff3fa4' });
      chrome(S.g, S.e, 'ЗА МИНУТУ', 540, 600, 130, ec - .2, { id: 'e2', neon: '#ff3fa4' });
      label(S.g, '▶ ПОДПИСЫВАЙТЕСЬ', 540, 1420, 70, '#ffffff', seg(ec, 1.2, 1.5), 'sub');
    }
  },
};
function lerpN(a, b, u) { return a + (b - a) * u; }

// ———————————————————————————— subtitles (recorded on the tape)
function subPieces() {
  const out = [];
  for (const v of VO) {
    let parts;
    if (v.id === 'spoon') { const i = v.text.indexOf('нет'); parts = [[v.text.slice(0, i).trim(), 0, NET_FRAC], [v.text.slice(i), NET_FRAC, 1]]; }
    else parts = [[v.text, 0, 1]];
    for (const [txt, a, b] of parts) out.push({ text: txt, a: v.t + v.d * a - .05, b: v.t + v.d * b });
  }
  out.forEach((p, i) => { p.b = Math.max(p.b + .6, p.a + 1.8); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); });
  return out;
}
const SUBS = subPieces();
function wrap(c, txt, maxW) {
  const words = txt.split(' '), lines = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
  if (cur) lines.push(cur); return lines;
}
function hud(c, t) {
  c.clearRect(0, 0, W, H);
  if (qs.get('nosub')) return;
  const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return;
  c.save(); c.font = '700 60px "PT Sans Narrow"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const L = wrap(c, v.text, 900), y0 = H - 250 - (L.length - 1) * 70;
  L.forEach((s, i) => {
    const y = y0 + i * 70;
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
    c.strokeStyle = '#120a1e'; c.lineWidth = 11; c.strokeText(s, W / 2, y);
    c.shadowColor = 'transparent'; c.fillStyle = '#fff0a0'; c.fillText(s, W / 2, y);
  });
  c.restore();
}

// ———————————————————————————— frame
function render(t) {
  TEXTS_NOW.length = 0;
  for (const x of [g0, e0]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  g0.fillStyle = '#000'; g0.fillRect(0, 0, W, H); e0.fillStyle = '#000'; e0.fillRect(0, 0, W, H);
  const s = sceneAt(t), D = s.t1 - s.t0;
  const over = SHOTS[qs.get('shot') || s.name]({ t, lt: t - s.t0, u: (t - s.t0) / D, D, t0: s.t0, g: g0, e: e0 }) || {};
  hud(ov, t);
  const fr = Math.round(t * 24);
  post.render(sc, gc, fr, ovc, { power: Math.min(1, t / .5), ...over, ...(t > DUR - .5 ? { power: Math.max(0.001, (DUR - t) / .5) } : {}) });
}

// ———————————————————————————— sound events (read by mix.py)
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  add('crton', .02);
  add('brass', S.jar.t0 + .45); add('glint', S.jar.t0 + 1.2);
  add('wind', S.tomb.t0, { d: S.tomb.t1 - S.tomb.t0 + (T.lidOpen - S.open.t0) });
  add('scrape', T.lidOpen - .05); add('shimmer', T.lidOpen, { d: 2.2 }); add('brass', T.lidOpen + .5);
  add('pop', S.water.t0 + .1); add('pop', S.water.t0 + .4); add('pen', S.water.t0 + 1.0, { d: .8 });
  for (let k = 0; k < 10; k++) add('step', S.bact.t0 + k * .25, { v: .5 });
  add('tick', S.acid.t0 + .6, { d: 1.2 });
  add('buzz', S.bee.t0, { d: S.bee.t1 - S.bee.t0 }); add('drip', S.bee.t0 + .8); add('drip', S.bee.t0 + 1.6);
  add('whoosh', T.shieldHit - .5); add('impact', T.shieldHit); add('boing', T.shieldHit + .1);
  add('buzz', S.spoon.t0, { d: T.net - S.spoon.t0, v: .5 }); add('tapestop', T.net - .05); add('tracking', T.net, { d: .4 });
  add('chime', S.cryst.t0 + 1.4);
  add('buzz', S.sub.t0, { d: S.sub.t1 - S.sub.t0, v: .6 }); add('brass', S.sub.t0 + .8);
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  add('net', T.net); add('lid', T.lidOpen);
  return ev.sort((a, b) => a.t - b.t);
}
window.EV = events();
window.DUR = DUR;
window.SC = SC; window.VO = VO; window.SUBS = SUBS; window.T = T;
window.render = render;
window.TEXTS = t => { render(t); return TEXTS_NOW.slice(); };
render(parseFloat(qs.get('t') ?? '1.5'));
window.READY = true;
