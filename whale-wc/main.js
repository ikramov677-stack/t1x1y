// «Сердце синего кита» — watercolor journal page (vertical 1080×1920)
// Stroke engine engine.js from the Lemo-Opuscar watercolor demo (MIT); everything else written for this film.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const qs = new URLSearchParams(location.search);

// ———————————————————————————— timeline
const LINES = [
  { id: 'whale', text: 'Сердце синего кита весит около 180 килограммов!' },
  { id: 'heart', text: 'Это как два взрослых человека.' },
  { id: 'dino', text: 'Синий кит — самое большое животное в истории Земли.' },
  { id: 'length', text: 'Он бывает длиной до 30 метров.' },
  { id: 'dive', text: 'Когда кит ныряет, его сердце бьётся всего 2 раза в минуту!' },
  { id: 'rise', text: 'А у поверхности — до 37 ударов.' },
  { id: 'tongue', text: 'Его язык весит столько же, сколько слон.' },
  { id: 'myth', text: 'Говорят, что человек может проплыть по его сосудам, но это миф.' },
  { id: 'artery', text: 'Его главная артерия шириной около 23 сантиметров — как тарелка.' },
  { id: 'song', text: 'А песни синего кита слышны за сотни километров.' },
  { id: 'sub', text: 'Подписывайтесь на «Факты за минуту»!' },
];
const VOICE = null;               // [[start, end], …] in the voice file once it arrives
const VOICE_OFFSET = 0.4;
const BPM = 72, BEAT = 60 / BPM;
const snapB = t => Math.round(t / BEAT * 2) * BEAT / 2;
const TL = (() => {
  const spans = VOICE || (() => { let t = 0; return LINES.map(l => { const d = l.text.length / 13.5; const s = [t, t + d]; t += d + .7; return s; }); })();
  const on = spans.map(s => s[0] + VOICE_OFFSET);
  const starts = on.map((x, i) => i === 0 ? 0 : snapB(x - .3));
  const end = snapB(spans[spans.length - 1][1] + VOICE_OFFSET + 3.2);
  const SC = LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end }));
  const VO = LINES.map((l, i) => ({ id: l.id, text: l.text, t: on[i], d: spans[i][1] - spans[i][0] }));
  return { SC, VO, DUR: end };
})();
const { SC, VO } = TL; window.DUR = TL.DUR;
const sceneIdx = t => { let k = 0; for (let i = 0; i < SC.length; i++) if (t >= SC[i].t0) k = i; return k; };

// ———————————————————————————— palette
const SEA = ['#c9d9dc', '#9fbccb', '#7299b2', '#4f7795', '#345674', '#22384f'];
const WH = { top: '#3d5a72', mid: '#5f819b', belly: '#a7bccb', groove: '#46627a' };
const VERM = '#c8442a', VERM_D = '#8e2a1a';
const SAGE = '#8ea37c', OCHRE = '#d6a24a', ROSE = '#e3a89a', PEACH = '#f0cfa4';
const MONO = '400 30px "IBM Plex Mono"';

// ———————————————————————————— stroke generators (local coords, centred)
function fillEllipse(S, cx, cy, rx, ry, col, n, o = {}) {
  const ang = o.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang), w = o.w ?? (2 * ry / n) * 1.6;
  for (let i = 0; i < n; i++) {
    const v = -1 + 2 * (i + .5) / n, hl = rx * Math.sqrt(Math.max(0, 1 - v * v)) * rnd(.86, 1);
    const y = v * ry, x0 = -hl + rnd(-4, 4), x1 = hl + rnd(-4, 4);
    const P = qcurve(x0, y, x1, y + rnd(-3, 3), rnd(-6, 6), 10).map(([x, yy]) => [cx + x * ca - yy * sa, cy + x * sa + yy * ca]);
    S.push(mk(P, w * rnd(.85, 1.1), Array.isArray(col) ? col[i % col.length] : col, { prof: 'even', nb: 4, a: o.a ?? rnd(.6, .8), rough: .3 }));
  }
}
function fillRect(S, x0, y0, x1, y1, col, n, o = {}) {
  const h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) { const y = y0 + h * (i + .5); S.push(mk(qcurve(x0 + rnd(-3, 3), y, x1 + rnd(-3, 3), y + rnd(-2, 2), rnd(-3, 3), 10), h * 1.5, Array.isArray(col) ? col[i % col.length] : col, { prof: 'even', nb: 4, a: o.a ?? rnd(.65, .82), rough: .25 })); }
}
function whale(L) {
  const S = [], h = u => L * .072 * (u < .14 ? Math.sqrt(u / .14) * .95 + .05 : 1 - Math.pow((u - .14) / .86, 1.5) * .86);
  const c = u => L * .012 * Math.sin(u * Math.PI * 1.1), X = u => -L / 2 + u * L, Y = (u, v) => c(u) + v * h(u);
  const rows = 11;
  for (let k = 0; k < rows; k++) {
    const v = -.92 + k * 1.84 / (rows - 1), col = v < -.35 ? WH.top : v < .35 ? WH.mid : WH.belly;
    const u0 = .015 + Math.abs(v) * .03, u1 = .97 - Math.abs(v) * .05, P = [];
    for (let i = 0; i <= 26; i++) { const u = u0 + (u1 - u0) * i / 26; P.push([X(u), Y(u, v)]); }
    S.push(mk(P, L * .022 * (1.1 - Math.abs(v) * .3), col, { prof: 'even', nb: 6, a: .78, rough: .25 }));
  }
  // dark back edge and belly edge
  const back = [], belly = []; for (let i = 0; i <= 30; i++) { const u = .01 + .96 * i / 30; back.push([X(u), Y(u, -1.02)]); belly.push([X(u), Y(u, 1.0)]); }
  S.push(mk(back, 5, INK2, { prof: 'even', nb: 2, a: .55, rough: .35 }));
  S.push(mk(belly, 3, WH.groove, { prof: 'even', nb: 0, a: .45, rough: .35 }));
  // throat grooves
  for (let k = 0; k < 6; k++) { const v = .45 + k * .09, P = []; for (let i = 0; i <= 10; i++) { const u = .06 + .32 * i / 10; P.push([X(u), Y(u, v)]); } S.push(mk(P, 2.2, WH.groove, { prof: 'tip', nb: 0, a: .55 })); }
  // mouth line, eye, flipper, dorsal fin, flukes
  { const P = []; for (let i = 0; i <= 12; i++) { const u = .012 + .2 * i / 12; P.push([X(u), Y(u, .18 + i * .006)]); } S.push(mk(P, 3.4, INK, { prof: 'tip', nb: 0, a: .8 })); }
  S.push(mk(qcurve(X(.215), Y(.215, .05), X(.222), Y(.222, .07), 0, 3), 7, INK, { prof: 'leaf', nb: 0, a: .9 }));
  S.push(mk(qcurve(X(.3), Y(.3, .75), X(.42), Y(.3, .75) + L * .1, -L * .02, 10), L * .028, WH.top, { prof: 'leaf', nb: 4, a: .8 }));
  S.push(mk(qcurve(X(.72), Y(.72, -.95), X(.78), Y(.76, -1.0) - L * .02, L * .005, 6), L * .016, WH.top, { prof: 'tip', nb: 3, a: .85 }));
  const tx = X(.975), ty = Y(.975, 0);
  S.push(mk(qcurve(tx, ty, tx + L * .07, ty - L * .055, L * .01, 10), L * .034, WH.top, { prof: 'leaf', nb: 5, a: .85 }));
  S.push(mk(qcurve(tx, ty, tx + L * .07, ty + L * .055, -L * .01, 10), L * .034, WH.top, { prof: 'leaf', nb: 5, a: .85 }));
  return { S, heart: [X(.3), Y(.3, .2)], head: [X(.02), Y(.02, 0)] };
}
function heartShape(s) {
  const S = [];
  fillEllipse(S, 0, 10 * s, 95 * s, 112 * s, [VERM, '#b8402c', '#d4583a'], 9, { ang: -.35 });
  S.push(mk(qcurve(-30 * s, -90 * s, -46 * s, -170 * s, -12 * s, 8), 30 * s, '#a8381f', { prof: 'even', nb: 4, a: .85 }));
  S.push(mk(qcurve(10 * s, -95 * s, 50 * s, -160 * s, 18 * s, 8), 36 * s, VERM, { prof: 'even', nb: 4, a: .85 }));
  S.push(mk(qcurve(50 * s, -158 * s, 100 * s, -150 * s, -12 * s, 8), 26 * s, VERM, { prof: 'tip', nb: 3, a: .8 }));
  const E = []; for (let i = 0; i <= 18; i++) { const a = Math.PI * .55 + i / 18 * Math.PI * 1.2; E.push([Math.cos(a) * 92 * s, 10 * s + Math.sin(a) * 110 * s]); }
  S.push(mk(E, 4 * s, VERM_D, { prof: 'even', nb: 0, a: .6 }));
  return { S };
}
function person(s, col = INK2) {
  const S = [];
  S.push(mk(qcurve(0, -168 * s, 0, -140 * s, 0, 4), 30 * s, col, { prof: 'leaf', nb: 0, a: .85 }));
  S.push(mk(qcurve(0, -128 * s, 0, -60 * s, 2 * s, 8), 34 * s, col, { prof: 'even', nb: 4, a: .8 }));
  S.push(mk(qcurve(-8 * s, -62 * s, -14 * s, 0, -3 * s, 6), 14 * s, col, { prof: 'even', nb: 2, a: .8 }));
  S.push(mk(qcurve(8 * s, -62 * s, 14 * s, 0, 3 * s, 6), 14 * s, col, { prof: 'even', nb: 2, a: .8 }));
  S.push(mk(qcurve(-16 * s, -122 * s, -24 * s, -70 * s, -4 * s, 6), 11 * s, col, { prof: 'tip', nb: 0, a: .8 }));
  S.push(mk(qcurve(16 * s, -122 * s, 24 * s, -70 * s, 4 * s, 6), 11 * s, col, { prof: 'tip', nb: 0, a: .8 }));
  return { S };
}
function sauropod(s) {
  const S = []; fillEllipse(S, 0, -110 * s, 150 * s, 62 * s, [SAGE, '#7f9670'], 6);
  S.push(mk(qcurve(110 * s, -140 * s, 210 * s, -330 * s, -30 * s, 12), 30 * s, SAGE, { prof: 'tip', nb: 4, a: .8 }));
  S.push(mk(qcurve(205 * s, -330 * s, 240 * s, -335 * s, 0, 4), 30 * s, '#7f9670', { prof: 'leaf', nb: 0, a: .9 }));
  S.push(mk(qcurve(-130 * s, -110 * s, -330 * s, -50 * s, 30 * s, 12), 34 * s, SAGE, { prof: 'tip', nb: 4, a: .8 }));
  for (const x of [-90, -40, 50, 100]) S.push(mk(qcurve(x * s, -70 * s, x * s, 0, 0, 5), 26 * s, '#7f9670', { prof: 'even', nb: 3, a: .85 }));
  return { S };
}
function bus(s) {   // 12 m × 3 m at 80 px/m
  const S = [], w = 960 * s, h = 240 * s;
  fillRect(S, -w / 2, -h - 30 * s, w / 2, -30 * s, [OCHRE, '#cf9a3e', '#dcab52'], 7);
  for (let k = 0; k < 7; k++) { const x = -w / 2 + 70 * s + k * 124 * s; fillRect(S, x, -h + 10 * s, x + 90 * s, -h + 90 * s, ['#e9e3d0', '#dfe6e6'], 2, { a: .9 }); }
  fillRect(S, w / 2 - 70 * s, -h + 10 * s, w / 2 - 20 * s, -40 * s, '#8a6a3a', 3);
  for (const x of [-w * .32, w * .3]) S.push(mk(qcurve(x - 18 * s, -26 * s, x + 18 * s, -26 * s, 0, 3), 62 * s, INK2, { prof: 'leaf', nb: 3, a: .9 }));
  S.push(mk(qcurve(-w / 2, -h - 30 * s, w / 2, -h - 30 * s, 0, 12), 4 * s, INK2, { prof: 'even', nb: 0, a: .5 }));
  return { S };
}
function house(s) {   // ~7 m wide, ~6 m tall
  const S = [], w = 560 * s, h = 300 * s;
  fillRect(S, -w / 2, -h, w / 2, 0, ['#e7cfa8', '#dcc298', '#e2c8a0'], 6);
  for (let k = 0; k < 6; k++) { const y = -h - 18 * s - k * 34 * s, hw = w * .62 * (1 - k / 6.2); S.push(mk(qcurve(-hw, y, hw, y, 0, 8), 40 * s, ['#b8644a', '#a8553e'][k % 2], { prof: 'even', nb: 4, a: .8 })); }
  fillRect(S, -60 * s, -170 * s, 20 * s, 0, '#8a6a4a', 3);
  fillRect(S, 90 * s, -220 * s, 200 * s, -120 * s, ['#9fbccb', '#b4c6d0'], 3, { a: .9 });
  return { S };
}
function elephant(s) {
  const S = [], G = ['#9a9a96', '#8a8a86', '#a8a7a0'];
  fillEllipse(S, 0, -230 * s, 200 * s, 130 * s, G, 8);
  for (const x of [-130, -60, 60, 130]) S.push(mk(qcurve(x * s, -170 * s, x * s, 0, 0, 5), 60 * s, '#8a8a86', { prof: 'even', nb: 4, a: .85 }));
  fillEllipse(S, 210 * s, -300 * s, 90 * s, 90 * s, G, 5);
  fillEllipse(S, 150 * s, -300 * s, 70 * s, 100 * s, ['#b4b2aa', '#a4a29a'], 4, { ang: .2 });
  S.push(mk(qctrl(280 * s, -280 * s, 340 * s, -150 * s, 300 * s, -40 * s, 12), 40 * s, '#8a8a86', { prof: 'tip', nb: 4, a: .85 }));
  S.push(mk(qcurve(232 * s, -330 * s, 236 * s, -326 * s, 0, 2), 9 * s, INK, { prof: 'leaf', nb: 0, a: .9 }));
  return { S };
}
function tongue(s) { const S = []; fillEllipse(S, 0, 0, 230 * s, 110 * s, ['#e7a3a0', '#d98a88', '#efb6ae'], 8, { ang: -.08 }); S.push(mk(qcurve(-180 * s, 0, 170 * s, -6 * s, 6 * s, 12), 4 * s, '#b9706c', { prof: 'tip', nb: 0, a: .6 })); return { S }; }
function swimmer(s) {
  const S = [];
  S.push(mk(qcurve(0, 0, 0, 4 * s, 0, 3), 30 * s, INK2, { prof: 'leaf', nb: 0, a: .85 }));
  S.push(mk(qcurve(16 * s, 6 * s, 110 * s, 20 * s, 4 * s, 8), 26 * s, INK2, { prof: 'even', nb: 3, a: .8 }));
  S.push(mk(qcurve(10 * s, -4 * s, -60 * s, -40 * s, -6 * s, 6), 10 * s, INK2, { prof: 'tip', nb: 0, a: .8 }));
  S.push(mk(qcurve(110 * s, 20 * s, 170 * s, 10 * s, 0, 5), 12 * s, INK2, { prof: 'tip', nb: 0, a: .8 }));
  S.push(mk(qcurve(110 * s, 24 * s, 168 * s, 40 * s, 0, 5), 12 * s, INK2, { prof: 'tip', nb: 0, a: .8 }));
  return { S };
}
function ring(r, cols, n = 14, w = 26) {
  const S = [];
  for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2 + rnd(-.05, .05), a1 = a0 + Math.PI * 2 / n * 1.25, P = []; for (let i = 0; i <= 6; i++) { const a = a0 + (a1 - a0) * i / 6; P.push([Math.cos(a) * r, Math.sin(a) * r]); } S.push(mk(P, w, cols[k % cols.length], { prof: 'even', nb: 4, a: .8 })); }
  return { S };
}
function tube(L, r) {
  const S = [];
  for (let k = 0; k < 5; k++) { const v = -1 + k / 2, P = []; for (let i = 0; i <= 14; i++) { const u = i / 14; P.push([-L / 2 + u * L, v * r * .8 + Math.sin(u * 3) * 20]); } S.push(mk(P, r * .5, [VERM, '#b8402c', '#d4583a'][k % 3], { prof: 'even', nb: 5, a: .75 })); }
  fillEllipse(S, -L / 2, Math.sin(0) * 20, r * .45, r, ['#7a2418', '#5a1a10'], 4);
  return { S };
}
function flukes(s) {
  const S = [];
  S.push(mk(qcurve(0, 120 * s, 0, -20 * s, 6 * s, 8), 70 * s, '#2a3c50', { prof: 'trunk', nb: 5, a: .85 }));
  S.push(mk(qctrl(0, -20 * s, -120 * s, -60 * s, -260 * s, -150 * s, 12), 90 * s, '#2a3c50', { prof: 'leaf', nb: 6, a: .85 }));
  S.push(mk(qctrl(0, -20 * s, 120 * s, -60 * s, 260 * s, -150 * s, 12), 90 * s, '#2a3c50', { prof: 'leaf', nb: 6, a: .85 }));
  return { S };
}
function obj(g) { g.spr = sprite(g.S); return g; }
function drawObj(o, x, y, p = 1, am = 1) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= am;
  if (p >= 1) ctx.drawImage(o.spr.cv, o.spr.x0, o.spr.y0); else drawList(ctx, o.S, p);
  ctx.restore();
}

// ———————————————————————————— painted sheets (built once)
const O = {};
let PAPER_IMG, OCEAN;
function washPoly(c, pts, fill, a, passes = 3, jit = 5) {
  for (let p = 0; p < passes; p++) { c.beginPath(); pts.forEach(([x, y], i) => { const yy = y + (i % 3 === 0 ? rnd(-jit, jit) : 0); i ? c.lineTo(x, yy) : c.moveTo(x, yy); }); c.closePath(); c.globalAlpha = a / passes * 1.6; c.fillStyle = fill; c.fill(); }
  c.globalAlpha = 1;
}
const OH = 4400, WL = 420;   // ocean sheet height, waterline
function buildOcean() {
  const c = document.createElement('canvas'); c.width = W; c.height = OH; const g = c.getContext('2d');
  // sky: unpainted paper with a warm wash
  washPoly(g, [[-20, -20], [W + 20, -20], [W + 20, WL], [-20, WL]], '#f2e2c4', .35);
  // depth bands (palette as data: 6 bands)
  const band = (OH - WL) / SEA.length;
  for (let k = 0; k < SEA.length; k++) {
    const y0 = WL + k * band - 30, y1 = WL + (k + 1) * band + 30, pts = [];
    for (let x = -20; x <= W + 20; x += 20) pts.push([x, y0 + fbm(x / 160 + k * 7) * 40]);
    for (let x = W + 20; x >= -20; x -= 20) pts.push([x, y1 + fbm(x / 170 + k * 3) * 40]);
    washPoly(g, pts, SEA[k], .72, 3, 6);
  }
  // sun rays (paper-coloured lifts)
  for (let k = 0; k < 6; k++) { const x = 120 + k * 170, w = 40 + rnd(0, 50); g.globalAlpha = .18; g.fillStyle = PAPER; g.beginPath(); g.moveTo(x, WL); g.lineTo(x + w, WL); g.lineTo(x + w + 260, WL + 1500); g.lineTo(x + 180, WL + 1500); g.fill(); }
  g.globalAlpha = 1;
  // waterline stroke + small wave dashes
  const wl = []; for (let x = -20; x <= W + 20; x += 30) wl.push([x, WL + Math.sin(x / 70) * 6]);
  drawS(g, mk(wl, 6, '#4f7795', { prof: 'even', nb: 4, a: .85, rough: .3 }));
  for (let k = 0; k < 16; k++) { const x = rnd(0, W), y = WL + rnd(20, 160); drawS(g, mk(qcurve(x, y, x + rnd(40, 90), y, -6, 5), 4, '#e8f0ee', { prof: 'leaf', nb: 0, a: .6 })); }
  return c;
}
function buildAll() {
  OCEAN = buildOcean();
  O.whale = obj(whale(860)); O.whaleS = obj(whale(560)); O.whaleL = obj(whale(2400)); O.whaleD = obj(whale(700));
  O.heart = obj(heartShape(1)); O.heartS = obj(heartShape(.55)); O.dot = obj(heartShape(.22));
  O.p1 = obj(person(1)); O.p2 = obj(person(.95, '#5a4636'));
  O.dino = obj(sauropod(.9)); O.bus = obj(bus(.92)); O.house = obj(house(.9));
  O.ele = obj(elephant(.5)); O.tongue = obj(tongue(.5)); O.swim = obj(swimmer(1.2)); O.tube = obj(tube(780, 120));
  O.plate = obj(ring(200, ['#9fb4c4', '#8aa0b2', '#b4c6d0'], 14, 34)); O.plateIn = obj(ring(120, ['#dfe6e6', '#d2dada'], 10, 70));
  O.aorta = obj(ring(200, [VERM, '#b8402c', '#d4583a'], 14, 46)); O.aortaIn = obj(ring(130, ['#e7a3a0', '#efb6ae'], 10, 40));
  O.flukes = obj(flukes(1));
  O.cross = [mk(qcurve(180, 760, 900, 1300, -20, 14), 70, VERM, { prof: 'brush', nb: 8, a: .9 }), mk(qcurve(900, 760, 180, 1300, 20, 14), 70, VERM, { prof: 'brush', nb: 8, a: .9 })];
  O.beam = mk(qcurve(-310, 0, 310, 0, 0, 16), 12, INK2, { prof: 'even', nb: 3, a: .85, rough: .25 });
  O.post = mk(qcurve(0, 0, 0, 560, 0, 10), 16, INK2, { prof: 'trunk', nb: 4, a: .85 });
  O.base = mk(qcurve(-140, 560, 140, 560, -6, 10), 14, INK2, { prof: 'even', nb: 3, a: .85 });
  O.pan = mk(qcurve(-125, 0, 125, 0, 50, 14), 10, INK2, { prof: 'even', nb: 3, a: .85 });
  O.ground = mk(qcurve(60, 0, W - 60, 0, -4, 30), 6, INK2, { prof: 'even', nb: 4, a: .8, rough: .3 });
  O.ruler = mk(qcurve(0, 0, 2400, 0, 0, 40), 5, INK, { prof: 'even', nb: 0, a: .85, rough: .2 });
  O.waves = []; for (let k = 0; k < 9; k++) { const P = []; for (let i = 0; i <= 40; i++) { const a = -Math.PI * .95 + i / 40 * Math.PI * 1.9; P.push([Math.cos(a), Math.sin(a) * .55]); } O.waves.push(P); }
  O.ecg = [];
}

// ———————————————————————————— drawing helpers
function hand(txt, x, y, p, o = {}) {
  if (p <= 0) return;
  ctx.save(); ctx.font = `${o.w || 600} ${o.size || 46}px Caveat`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  ctx.beginPath(); ctx.rect(x0 - 6, y - 50, (w + 12) * eo(p), 100); ctx.clip();
  ctx.shadowColor = rgba(PAPER, .95); ctx.shadowBlur = 14; ctx.fillStyle = rgba(o.col || INK, o.a ?? .9); ctx.fillText(txt, x, y); ctx.fillText(txt, x, y);
  ctx.restore();
}
function mono(txt, x, y, p, o = {}) {
  if (p <= 0) return;
  ctx.save(); ctx.font = `400 ${o.size || 30}px "IBM Plex Mono"`; ctx.letterSpacing = '3px'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha *= ss(p); ctx.shadowColor = rgba(PAPER, .95); ctx.shadowBlur = 10; ctx.fillStyle = rgba(o.col || INK, .9); ctx.fillText(txt, x, y); ctx.fillText(txt, x, y); ctx.restore();
}
function leader(x0, y0, x1, y1, p, bend = 20, a = .75) {
  if (p <= 0) return;
  const pts = qcurve(x0, y0, x1, y1, bend, 16), m = Math.max(1, Math.round(16 * clamp(p)));
  ctx.beginPath(); for (let i = 0; i <= m; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = rgba(INK, a); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke();
  if (p >= 1) { ctx.beginPath(); ctx.arc(x1, y1, 4, 0, 7); ctx.fillStyle = rgba(INK, a); ctx.fill(); }
}
function note(lt, t0, ax, ay, lx, ly, txt, o = {}) { if (lt < t0) return; leader(lx + (o.lead ?? 0), ly + 26, ax, ay, seg(lt, t0, t0 + .6), o.bend ?? 18); hand(txt, lx, ly, seg(lt, t0 + .3, t0 + 1.3), o); }
function title(txt, y, p, size = 66, italic = false) {
  if (p <= 0) return;
  ctx.save(); ctx.font = `${italic ? 'italic ' : ''}500 ${size}px "Cormorant Garamond"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = ss(p); ctx.shadowColor = rgba(PAPER, .9); ctx.shadowBlur = 16; ctx.fillStyle = rgba(INK, .88); ctx.fillText(txt, W / 2, y + (1 - eo(p)) * 14); ctx.restore();
}
function mistBottom(a = .9, y0 = 1500) {   // paper-coloured mist band where subtitles sit
  const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, rgba(PAPER, 0)); g.addColorStop(.35, rgba(PAPER, a * .8)); g.addColorStop(1, rgba(PAPER, a));
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
}
function page(seed) {   // a journal plate: soft wash panel with uneven edges
  withSeed(seed, () => { const pts = []; for (let k = 0; k <= 20; k++) pts.push([70 + k * 47, 360 + rnd(-10, 10)]); for (let k = 20; k >= 0; k--) pts.push([70 + k * 47, 1500 + rnd(-10, 10)]); washPoly(ctx, pts, '#e9dcc2', .35, 3, 6); });
}
function balance(cx, cy, tilt, p) {
  ctx.save(); ctx.translate(cx, cy);
  drawS(ctx, O.post, seg(p, 0, .3)); drawS(ctx, O.base, seg(p, .2, .4));
  const ends = [];
  ctx.save(); ctx.rotate(tilt); drawS(ctx, O.beam, seg(p, .3, .6)); ctx.restore();
  for (const s of [-1, 1]) {
    const ex = s * 310 * Math.cos(tilt), ey = s * 310 * Math.sin(tilt);
    if (p > .6) { ctx.strokeStyle = rgba(INK2, .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 115, ey + 230); ctx.moveTo(ex, ey); ctx.lineTo(ex + 115, ey + 230); ctx.stroke(); }
    ctx.save(); ctx.translate(ex, ey + 230); drawS(ctx, O.pan, seg(p, .6, .9)); ctx.restore();
    ends.push([cx + ex, cy + ey + 230]);
  }
  ctx.restore();
  return ends;
}
function ecg(x0, x1, y, lt, period, p, label) {
  // paper ribbon + ink trace painted left→right
  ctx.save(); ctx.globalAlpha = .9 * ss(seg(lt, 0, .4));
  withSeed(77, () => washPoly(ctx, [[x0 - 30, y - 110], [x1 + 30, y - 110], [x1 + 30, y + 90], [x0 - 30, y + 90]], PAPER, .95, 3, 4));
  ctx.restore();
  const n = 220, head = clamp(p) * n;
  ctx.beginPath();
  for (let i = 0; i <= head; i++) {
    const x = x0 + (x1 - x0) * i / n, tt = i / n * 4.0, ph = (tt % period) / period;
    let yy = y + Math.sin(i * .7) * 1.2;
    if (ph < .04) yy -= 90 * Math.sin(ph / .04 * Math.PI); else if (ph < .07) yy += 35 * Math.sin((ph - .04) / .03 * Math.PI);
    i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
  }
  ctx.strokeStyle = rgba(VERM, .9); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
  mono(label, (x0 + x1) / 2, y + 60, seg(lt, .6, 1.2), { size: 34 });
}

// ———————————————————————————— scenes (lt = local time, D = scene length)
const SCN = {
  whale(lt, D) {
    const z = 1 + eo(seg(lt, 0, D)) * .05; ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), 900 * (1 - z));
    ctx.drawImage(OCEAN, 0, 0);
    const x = 540, y = 960 + Math.sin(lt * .9) * 8;
    drawObj(O.whale, x, y, seg(lt, .15, 2.2));
    const [hx, hy] = O.whale.heart, pulse = .7 + .3 * Math.max(0, Math.sin(lt * 4));
    drawObj(O.dot, x + hx, y + hy, seg(lt, 1.9, 2.4), pulse);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    title('Сердце синего кита', 210, seg(lt, .3, 1.1), 70);
    note(lt, 2.2, x + hx * z, y + hy + 26, 470, 1290, 'сердце ≈ 180 кг', { size: 54 });
    mistBottom(.92);
  },
  heart(lt, D) {
    page(11); title('запись · сердце', 300, seg(lt, 0, .6), 52, true);
    const tilt = lerp(-.16, 0, eo(seg(lt, 1.3, 2.4)));
    const [L, R] = balance(540, 640, tilt, seg(lt, .1, 1.0));
    drawObj(O.heartS, L[0], L[1] - 70, seg(lt, .5, 1.3));
    drawObj(O.p1, R[0] - 50, R[1] + 4, seg(lt, 1.0, 1.6)); drawObj(O.p2, R[0] + 55, R[1] + 4, seg(lt, 1.2, 1.8));
    mono('180 кг', L[0], 1260, seg(lt, 1.4, 1.8), { size: 40 }); mono('2 × 90 кг', R[0], 1260, seg(lt, 1.8, 2.2), { size: 40 });
    hand('как два взрослых!', 540, 1380, seg(lt, 2.2, 3.0), { size: 58, align: 'center', col: VERM });
    mistBottom(.6);
  },
  dino(lt, D) {
    page(12); const z = 1.12 - eo(seg(lt, 0, D)) * .12; ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), 1150 * (1 - z));
    ctx.save(); ctx.translate(0, 1300); drawS(ctx, O.ground, seg(lt, 0, .6)); ctx.restore();
    drawObj(O.whaleD, 560, 760, seg(lt, .2, 1.4));
    drawObj(O.dino, 330, 1300, seg(lt, .9, 1.9));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    title('самое большое животное', 300, seg(lt, .2, .9), 60);
    title('в истории Земли', 380, seg(lt, .4, 1.1), 50, true);
    note(lt, 1.8, 330, 1060, 560, 1240, 'крупный динозавр', { size: 46 });
    mistBottom(.6);
  },
  length(lt, D) {
    // long lateral dolly along a 30 m whale (80 px per metre)
    const camx = eio(seg(lt, .2, D - .2)) * (2600 - W);
    page(13);
    ctx.save(); ctx.translate(-camx, 0);
    withSeed(31, () => washPoly(ctx, [[0, 470], [2700, 470], [2700, 860], [0, 860]], SEA[1], .45, 3, 8));
    const vis = x => ss(seg(W * .95 - (x - camx), 0, 380));
    // whale painted as the camera reaches each part
    ctx.save(); ctx.translate(1300, 660); drawList(ctx, O.whaleL.S, Math.min(1, vis(150) * .15 + seg(lt, 0, D * .8))); ctx.restore();
    drawObj(O.bus, 640, 1340, vis(200));
    drawObj(O.house, 1750, 1340, vis(1450));
    ctx.save(); ctx.translate(100, 1430); drawS(ctx, O.ruler, seg(lt, 0, D * .85));
    for (let m = 0; m <= 30; m += 5) { const x = m * 80; if (seg(lt, 0, D * .85) * 2400 >= x) { ctx.fillStyle = rgba(INK, .85); ctx.fillRect(x - 1.5, -16, 3, 32); mono(m + (m === 30 ? ' м' : ''), x, 50, 1, { size: 32 }); } }
    ctx.restore();
    hand('автобус · 12 м', 640, 1000, vis(200), { size: 44, align: 'center' });
    hand('дом', 1750, 880, vis(1450), { size: 44, align: 'center' });
    ctx.restore();
    title('до 30 метров', 300, seg(lt, .1, .8), 70);
    mistBottom(.6, 1560);
  },
  dive(lt, D) {
    const cy = eio(seg(lt, 0, D)) * 2500;
    ctx.drawImage(OCEAN, 0, -cy);
    const wy = 700 + cy * .62 - cy;   // whale sinks a little slower than the camera
    ctx.save(); ctx.translate(540, 1000 + wy * .2); ctx.rotate(1.05); drawObj(O.whaleS, 0, 0, 1); ctx.restore();
    // bubbles
    for (let k = 0; k < 8; k++) { const ph = (lt * .5 + k / 8) % 1; ctx.beginPath(); ctx.arc(480 + Math.sin(k * 3) * 60, 900 - ph * 500, 6 + k % 3 * 3, 0, 7); ctx.strokeStyle = rgba('#e8f0ee', .5 * (1 - ph)); ctx.lineWidth = 2; ctx.stroke(); }
    hand(`глубина ${Math.round(cy / 2500 * 300)} м`, 80, 300, seg(lt, .3, 1), { size: 46, col: '#f1e9da', a: .9 });
    ecg(110, 970, 1420, lt, 3.6, seg(lt, .3, D - .2), '2 уд/мин');
    mistBottom(.92, 1560);
  },
  rise(lt, D) {
    const cy = (1 - eio(seg(lt, 0, D * .85))) * 2500;
    ctx.drawImage(OCEAN, 0, -cy);
    ctx.save(); ctx.translate(540, 1000); ctx.rotate(-1.0); drawObj(O.whaleS, 0, 0, 1); ctx.restore();
    if (cy < 300) { ctx.globalAlpha = 1 - cy / 300; hand('у поверхности', 540, 300, 1, { size: 56, align: 'center' }); ctx.globalAlpha = 1; }
    ecg(110, 970, 1420, lt, .55, seg(lt, .2, D - .2), 'до 37 уд/мин');
    mistBottom(.92, 1560);
  },
  tongue(lt, D) {
    page(14); title('запись · язык', 300, seg(lt, 0, .6), 52, true);
    const [L, R] = balance(540, 640, lerp(.1, 0, eo(seg(lt, 1.2, 2.2))), seg(lt, .1, 1.0));
    drawObj(O.tongue, L[0], L[1] - 70, seg(lt, .5, 1.3));
    drawObj(O.ele, R[0] - 50, R[1] + 4, seg(lt, .9, 1.9));
    hand('язык', L[0], 1260, seg(lt, 1.4, 1.9), { size: 54, align: 'center' }); hand('слон', R[0], 1260, seg(lt, 1.6, 2.1), { size: 54, align: 'center' });
    mono('≈ 2,7 т  =  ≈ 2,7 т', 540, 1380, seg(lt, 2.0, 2.5), { size: 34 });
    mistBottom(.6);
  },
  myth(lt, D) {
    page(15); const z = 1 + eo(seg(lt, 0, D)) * .06; ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), 1000 * (1 - z));
    drawObj(O.tube, 600, 1000, seg(lt, 0, 1.0));
    drawObj(O.swim, 110, 1000, seg(lt, .6, 1.2));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    title('проплыть по сосудам?', 300, seg(lt, .1, .8), 62);
    const ct = D * .62;
    drawS(ctx, O.cross[0], seg(lt, ct, ct + .25)); drawS(ctx, O.cross[1], seg(lt, ct + .2, ct + .45));
    mono('МИФ', 540, 1420, seg(lt, ct + .4, ct + .7), { size: 64, col: VERM });
    mistBottom(.6);
  },
  artery(lt, D) {
    page(16); title('главная артерия', 300, seg(lt, 0, .6), 62); title('шириной с тарелку', 380, seg(lt, .2, .8), 50, true);
    drawObj(O.aorta, 300, 900, seg(lt, .1, .9)); drawObj(O.aortaIn, 300, 900, seg(lt, .5, 1.1));
    drawObj(O.plate, 780, 900, seg(lt, .6, 1.4)); drawObj(O.plateIn, 780, 900, seg(lt, 1.0, 1.6));
    hand('аорта', 300, 1170, seg(lt, 1.0, 1.5), { size: 52, align: 'center', col: VERM }); hand('тарелка', 780, 1170, seg(lt, 1.4, 1.9), { size: 52, align: 'center' });
    // measured span under both
    const rp = seg(lt, 1.6, 2.3);
    if (rp > 0) for (const cx of [300, 780]) { ctx.strokeStyle = rgba(INK, .85); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 200, 1260); ctx.lineTo(cx - 200 + 400 * eo(rp), 1260); ctx.stroke(); ctx.fillRect(cx - 201, 1246, 3, 28); if (rp >= 1) ctx.fillRect(cx + 198, 1246, 3, 28); }
    mono('≈ 23 см', 540, 1340, seg(lt, 2.2, 2.6), { size: 42 });
    mistBottom(.6);
  },
  song(lt, D) {
    const z = 1.14 - eo(seg(lt, 0, D)) * .14; ctx.setTransform(z, 0, 0, z, W / 2 * (1 - z), 900 * (1 - z));
    ctx.drawImage(OCEAN, 0, -250);
    const x = 620, y = 1000;
    drawObj(O.whaleD, x, y, 1);
    const [hx, hy] = O.whaleD.head;
    for (let k = 0; k < 6; k++) {
      const ph = (lt * .35 + k / 6) % 1, r = 60 + ph * 1100;
      ctx.beginPath(); O.waves[k].forEach(([a, b], i) => { const px = x + hx + a * r, py = y + hy + b * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.strokeStyle = rgba('#f1e9da', .75 * (1 - ph) * ss(seg(lt, k * .15, k * .15 + .4))); ctx.lineWidth = 7 * (1 - ph) + 2; ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    title('песни слышны', 230, seg(lt, .3, 1.0), 64);
    hand('за сотни километров', 540, 320, seg(lt, .8, 1.8), { size: 58, align: 'center', col: INK });
    mistBottom(.92, 1560);
  },
  sub(lt, D) {
    // sunset sea, tail lifts, the page washes back to paper
    withSeed(41, () => {
      washPoly(ctx, [[-20, -20], [W + 20, -20], [W + 20, 520], [-20, 520]], PEACH, .7);
      washPoly(ctx, [[-20, 480], [W + 20, 480], [W + 20, 900], [-20, 900]], ROSE, .55);
      const sea = []; for (let x = -20; x <= W + 20; x += 20) sea.push([x, 880 + Math.sin(x / 80) * 6]); sea.push([W + 20, 1700], [-20, 1700]);
      washPoly(ctx, sea, SEA[3], .75);
    });
    ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = '#f6c27a'; ctx.beginPath(); ctx.arc(300, 820, 90, Math.PI, 0); ctx.fill(); ctx.restore();
    const rise = eo(seg(lt, .2, 1.6));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 900); ctx.clip(); drawObj(O.flukes, 620, 1060 - rise * 260, 1); ctx.restore();
    for (let k = 0; k < 10; k++) { const ph = (lt * .8 + k / 10) % 1; ctx.fillStyle = rgba('#dfe9ec', .7 * (1 - ph)); ctx.beginPath(); ctx.arc(420 + k * 40 + Math.sin(k) * 20, 820 - rise * 120 + ph * 160, 5, 0, 7); ctx.fill(); }
    // mist erases the sheet from the bottom
    const m = seg(lt, D - 2.6, D - .6);
    if (m > 0) { const y0 = H - m * (H + 300); const g = ctx.createLinearGradient(0, y0, 0, y0 + 300); g.addColorStop(0, rgba(PAPER, 0)); g.addColorStop(1, rgba(PAPER, 1)); ctx.fillStyle = g; ctx.fillRect(0, y0, W, 300); ctx.fillStyle = PAPER; ctx.fillRect(0, y0 + 300, W, H); }
    title('Факты за минуту', 1080, seg(lt, .8, 1.6), 92);
    hand('подписывайтесь', 540, 1190, seg(lt, 1.4, 2.4), { size: 64, align: 'center', col: VERM });
    mistBottom(.92, 1560);
  },
};

// ———————————————————————————— subtitles on the paper
function wrap(txt, maxW) { const words = txt.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SUBS = (() => { const out = VO.map(v => ({ text: v.text, a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .6, p.a + 1.8); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return;
  const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return;
  const f = ss(seg(t, v.a, v.a + .25)) * (1 - ss(seg(t, v.b - .2, v.b)));
  ctx.save(); ctx.font = 'italic 500 52px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const L = wrap(v.text, 960), y0 = H - 190 - (L.length - 1) * 62;
  L.forEach((s, i) => { ctx.shadowColor = rgba(PAPER, 1); ctx.shadowBlur = 16; ctx.fillStyle = rgba(INK, .82 * f); ctx.fillText(s, W / 2, y0 + i * 62); ctx.fillText(s, W / 2, y0 + i * 62); });
  ctx.restore();
}

// ———————————————————————————— frame
function drawScene(k, t) {
  const s = SC[k]; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.drawImage(PAPER_IMG, 0, 0);
  withSeed(1000 + k, () => SCN[s.name](t - s.t0, s.t1 - s.t0));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
function render(t) {
  const k = sceneIdx(t), s = SC[k], wipe = .7;
  if (k > 0 && t - s.t0 < wipe) {
    drawScene(k - 1, t);
    // brush-edge wipe: the new scene is painted in behind a wavy vertical edge
    const p = eio((t - s.t0) / wipe), ex = -120 + p * (W + 240);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-10, -10);
    for (let y = -10; y <= H + 10; y += 40) ctx.lineTo(ex + Math.sin(y / 90 + k) * 50 + fbm(y / 200 + k) * 60, y);
    ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.clip();
    drawScene(k, t); ctx.restore();
  } else drawScene(k, t);
  subs(t);
  const fi = 1 - ss(seg(t, 0, .4)); if (fi > 0) { ctx.fillStyle = rgba(PAPER, fi); ctx.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const S = Object.fromEntries(SC.map(s => [s.name, s]));
  add('brush', S.whale.t0 + .15, { d: 2 }); add('pencil', S.whale.t0 + 2.4, { d: 1 });
  add('brush', S.heart.t0 + .1, { d: 1.6 }); add('creak', S.heart.t0 + 1.3); add('pencil', S.heart.t0 + 2.2, { d: .8 });
  add('brush', S.dino.t0 + .2, { d: 1.7 });
  add('brush', S.length.t0 + .2, { d: S.length.t1 - S.length.t0 - .4 });
  for (const sname of ['dive', 'rise']) { const s = S[sname], per = sname === 'dive' ? 3.6 : .55, D = s.t1 - s.t0; for (let x = 0; x < 4.0; x += per) { const tt = s.t0 + .3 + x / 4.0 * (D - .5); if (tt < s.t1) add('beat', tt, { v: sname === 'dive' ? 1 : .7 }); } }
  add('deep', S.dive.t0, { d: S.dive.t1 - S.dive.t0 });
  add('brush', S.tongue.t0 + .1, { d: 1.8 }); add('creak', S.tongue.t0 + 1.2);
  add('brush', S.myth.t0, { d: 1.2 }); add('stamp', S.myth.t0 + (S.myth.t1 - S.myth.t0) * .62);
  add('brush', S.artery.t0 + .1, { d: 1.5 }); add('pencil', S.artery.t0 + 1.6, { d: .7 });
  add('song', S.song.t0 + .2, { d: S.song.t1 - S.song.t0 + 1 });
  add('waves', S.sub.t0, { d: S.sub.t1 - S.sub.t0 }); add('mist', S.sub.t1 - 2.6, { d: 2 });
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.render = render;
window.SC = SC; window.VO = VO; window.SUBS = SUBS;
(async () => {
  PAPER_IMG = new Image(); PAPER_IMG.src = 'paper.jpg'; await PAPER_IMG.decode();
  await document.fonts.load('500 60px "Cormorant Garamond"', 'Сердце'); await document.fonts.load('italic 500 52px "Cormorant Garamond"', 'Сердце');
  await document.fonts.load('600 46px Caveat', 'сердце'); await document.fonts.load('400 30px "IBM Plex Mono"', '180 кг');
  withSeed(20261106, buildAll);
  window.EV = events();
  render(parseFloat(qs.get('t') ?? '2'));
  window.READY = true;
})();
