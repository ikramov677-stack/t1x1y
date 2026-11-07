// «Молния горячее Солнца» — watercolor journal page (vertical 1080×1920)
// Stroke engine engine.js from the Lemo-Opuscar watercolor demo (MIT); everything else written for this film.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const qs = new URLSearchParams(location.search);

// ———————————————————————————— timeline
const LINES = [
  { id: 'bolt', text: 'Молния горячее поверхности Солнца!' },
  { id: 'sun', text: 'Поверхность Солнца — около 5 500 градусов.' },
  { id: 'compare', text: 'А молния нагревает воздух почти до 30 000 градусов!' },
  { id: 'five', text: 'Это примерно в пять раз горячее.' },
  { id: 'thunder', text: 'Воздух так резко расширяется, что раздаётся гром.' },
  { id: 'count', text: 'Посчитайте секунды между вспышкой и громом и разделите на три.' },
  { id: 'map', text: 'Получится расстояние до грозы в километрах.' },
  { id: 'earth', text: 'Каждую секунду на Земле бьют около 40 молний.' },
  { id: 'tower', text: 'А в одно место молния может ударить много раз.' },
  { id: 'sand', text: 'Когда она попадает в песок, получается стеклянная трубка.' },
  { id: 'sub', text: 'Подписывайтесь на «Факты за минуту»!' },
];
const VOICE = [[0.0, 2.54], [3.01, 6.35], [6.93, 10.67], [11.14, 13.09], [13.53, 16.68], [17.17, 20.81], [21.25, 23.55], [24.05, 27.01], [27.41, 30.05], [30.43, 33.76], [34.27, 36.27]];               // [[start, end], …] in the voice file once it arrives
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

// ———————————————————————————— palette
const STORM = ['#8a90a0', '#6a7186', '#59627a', '#454d63', '#363d52'];
const BOLT = '#fbf1cf', BOLT_P = '#e2a83a';
const VERM = '#c8442a';
const SAGE = '#8ea37c', SAGE_D = '#6f8862', OCHRE = '#d6a24a', SAND = '#e3c38c', SKY_W = '#f3c99a';
const SUN = ['#f2b45a', '#f6c76e', '#fadf98'];

// ———————————————————————————— stroke generators
function boltShape(x0, y0, len, w, col, seed) {
  return withSeed(seed, () => {
    const S = [], main = [[x0, y0]]; let x = x0, y = y0;
    const n = 9;
    for (let i = 0; i < n; i++) { x += rnd(-70, 70); y += len / n * rnd(.8, 1.2); main.push([x, y]); }
    S.push(mk(main, w, col, { prof: 'tip', nb: 4, a: .95, rough: .25 }));
    for (let b = 0; b < 4; b++) {
      const k = 1 + Math.floor(rnd(0, n - 3)), [bx, by] = main[k], br = [[bx, by]]; let xx = bx, yy = by; const dir = rnd() < .5 ? -1 : 1;
      for (let i = 0; i < 4; i++) { xx += dir * rnd(20, 70); yy += rnd(30, 70); br.push([xx, yy]); }
      S.push(mk(br, w * .45, col, { prof: 'tip', nb: 2, a: .85, rough: .3 }));
    }
    return { S, tip: main[main.length - 1] };
  });
}
function sunDisc(r) {
  const S = [];
  fillEllipse(S, 0, 0, r, r, SUN[0], 9); fillEllipse(S, -r * .08, -r * .08, r * .72, r * .72, SUN[1], 7); fillEllipse(S, -r * .15, -r * .15, r * .4, r * .4, SUN[2], 4);
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; S.push(mk(polar(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, a, r * .28, 0, 5), r * .07, '#e8a64a', { prof: 'tip', nb: 0, a: .75 })); }
  return { S };
}
function cloud(s) { const S = []; for (const [x, y, rx, ry] of [[-120, 10, 120, 70], [0, -30, 150, 90], [130, 10, 120, 70], [10, 40, 200, 60]]) fillEllipse(S, x * s, y * s, rx * s, ry * s, ['#6a7186', '#59627a', '#7a8094'], 5); return { S }; }
function houseS(s) {
  const S = [], w = 220 * s, h = 150 * s;
  fillRect(S, -w / 2, -h, w / 2, 0, ['#e7cfa8', '#dcc298'], 4);
  for (let k = 0; k < 4; k++) { const y = -h - 10 * s - k * 24 * s, hw = w * .62 * (1 - k / 4.4); S.push(mk(qcurve(-hw, y, hw, y, 0, 8), 28 * s, ['#b8644a', '#a8553e'][k % 2], { prof: 'even', nb: 3, a: .8 })); }
  fillRect(S, 30 * s, -100 * s, 80 * s, -50 * s, '#f2d27a', 2, { a: .9 });
  return { S };
}
function earth(r) {
  const S = []; fillEllipse(S, 0, 0, r, r, ['#5f87a8', '#6f97b6', '#557d9e'], 14);
  for (const [x, y, rx, ry, a] of [[-.35, -.25, .32, .22, .4], [.3, .1, .26, .34, -.3], [-.1, .45, .22, .14, .1], [.45, -.45, .14, .1, 0]]) fillEllipse(S, x * r, y * r, rx * r, ry * r, [SAGE, '#a2b38a', '#b5a878'], 5, { ang: a });
  for (let k = 0; k < 9; k++) { const a = rnd(0, 6.28), rr = rnd(.2, .85) * r; S.push(mk(polar(Math.cos(a) * rr, Math.sin(a) * rr, a + 1.6, rnd(60, 160), rnd(-30, 30), 8), rnd(10, 18), '#eef0ea', { prof: 'leaf', nb: 2, a: .7 })); }
  return { S };
}
function tower(s) {
  const S = [], w = 170 * s, h = 1000 * s;
  fillRect(S, -w / 2, -h, w / 2, 0, ['#7a8698', '#6c788c', '#8592a4'], 22);
  for (let r = 0; r < 18; r++) for (let c = 0; c < 3; c++) if (rnd() < .45) S.push(mk(qcurve(-w / 2 + 25 * s + c * 50 * s, -h + 40 * s + r * 52 * s, -w / 2 + 50 * s + c * 50 * s, -h + 40 * s + r * 52 * s, 0, 3), 20 * s, '#f0d688', { prof: 'even', nb: 0, a: .8 }));
  fillRect(S, -w * .3, -h - 60 * s, w * .3, -h, '#6c788c', 3);
  S.push(mk(qcurve(0, -h - 60 * s, 0, -h - 220 * s, 0, 6), 8 * s, '#3d3129', { prof: 'tip', nb: 0, a: .9 }));
  return { S, tip: [0, -h - 220 * s] };
}
function fulgurite(s) {
  const S = [], main = []; let x = -380 * s, y = 0;
  for (let i = 0; i <= 12; i++) { main.push([x, y]); x += 64 * s; y += rnd(-22, 22) * s; }
  const body = mk(main, 46 * s, '#a7ad9a', { prof: 'even', nb: 6, a: .85, rough: .4 }); S.push(body);
  for (let b = 0; b < 5; b++) { const [bx, by] = main[2 + b * 2], br = [[bx, by]]; let xx = bx, yy = by; const d = b % 2 ? -1 : 1; for (let i = 0; i < 3; i++) { xx += rnd(20, 50) * s; yy += d * rnd(30, 60) * s; br.push([xx, yy]); } S.push(mk(br, 22 * s, '#b4b9a6', { prof: 'tip', nb: 3, a: .85, rough: .4 })); }
  S.push(edgeOf(body, -1, 6 * s, '#eef0e4', .8)); S.push(edgeOf(body, 1, 5 * s, '#6f7466', .6));
  return { S };
}
function personBack(s) {
  const S = []; fillEllipse(S, 0, -340 * s, 62 * s, 72 * s, ['#4a3c32', '#3d3129'], 5);
  fillEllipse(S, 0, -150 * s, 150 * s, 130 * s, ['#7a8aa0', '#6c7c94'], 7);
  return { S };
}
function stormSky(seed, y0 = 320) {
  withSeed(seed, () => {
    for (let k = 0; k < STORM.length; k++) { const a = y0 + k * 210 - 40, b = a + 260, pts = []; for (let x = -20; x <= W + 20; x += 30) pts.push([x, a + fbm(x / 150 + k * 5 + seed) * 50]); for (let x = W + 20; x >= -20; x -= 30) pts.push([x, b + fbm(x / 140 + k * 3) * 50]); washPoly(ctx, pts, STORM[k], .75, 3, 6); }
  });
}
function fields(seed, y0 = 1220) {
  withSeed(seed, () => {
    for (const [dy, col, a] of [[0, SAGE, .7], [110, SAGE_D, .7], [220, OCHRE, .55]]) { const pts = []; for (let x = -20; x <= W + 20; x += 24) pts.push([x, y0 + dy + Math.sin(x / 210 + dy) * 40 + fbm(x / 90 + dy) * 30]); pts.push([W + 20, H], [-20, H]); washPoly(ctx, pts, col, a, 3, 5); }
  });
}
function flash(lt, at, a = .55) { const f = lt >= at ? Math.exp(-(lt - at) * 7) * a : 0; if (f > .01) { ctx.fillStyle = rgba(PAPER, f); ctx.fillRect(0, 0, W, H); } }
function strike(o, lt, at, x = 0, y = 0, hold = 1.0) {   // a bolt painted in ≤ .2 s, held, flickering out
  if (lt < at) return; const p = seg(lt, at, at + .18), fade = 1 - ss(seg(lt, at + hold, at + hold + .5)), fl = lt - at < .5 ? (Math.floor((lt - at) * 24) % 3 === 1 ? .55 : 1) : 1;
  if (fade <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = fade * fl;
  ctx.shadowColor = rgba('#fff6d8', .9); ctx.shadowBlur = 28; drawList(ctx, o.S, p); ctx.restore();
}
function thermo(x, base, hpx, p, col, label, lp) {
  ctx.strokeStyle = rgba(INK2, .8); ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 34, base - 640, 68, 660, 34); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, base + 40, 52, 0, 7); ctx.fillStyle = rgba(col, .85); ctx.fill(); ctx.strokeStyle = rgba(INK2, .8); ctx.stroke();
  const h = hpx * eo(p); ctx.fillStyle = rgba(col, .82); ctx.fillRect(x - 20, base - h, 40, h + 10);
  mono(label, x, base - h - 46, lp, { size: 36, col: col === VERM ? VERM : INK });
}

// ———————————————————————————— scenes
const SCN = {
  bolt(lt, D) {
    stormSky(3); fields(4);
    const at = .45; strike(O.b1, lt, at, 0, 0, 2.2); flash(lt, at);
    title('Молния горячее', 160, seg(lt, .2, 1.0), 74);
    title('поверхности Солнца', 250, seg(lt, .5, 1.3), 56, true);
    mistBottom(.9, 1560);
  },
  sun(lt, D) {
    withSeed(21, () => { const pts = [[-20, 330], [W + 20, 330], [W + 20, 1520], [-20, 1520]]; washPoly(ctx, pts, SKY_W, .65); washPoly(ctx, [[-20, 900], [W + 20, 900], [W + 20, 1520], [-20, 1520]], '#eeb08a', .35); });
    drawObj(O.sun, 540, 880, seg(lt, .1, 1.6));
    title('Солнце', 200, seg(lt, .1, .8), 70);
    note(lt, 1.4, 700, 1050, 560, 1290, 'поверхность', { size: 54 });
    mono('≈ 5 500 °C', 540, 1400, seg(lt, 1.8, 2.3), { size: 52 });
    mistBottom(.85, 1560);
  },
  compare(lt, D) {
    page(31); title('5 500  против  30 000', 230, seg(lt, 0, .7), 58);
    drawObj(O.sunS, 300, 560, seg(lt, .1, .8));
    ctx.save(); ctx.translate(780, 380); drawList(ctx, O.b2.S, seg(lt, .4, .65), BOLT_P); ctx.restore();
    thermo(300, 1380, 640 * 5500 / 30000, seg(lt, .7, 1.6), '#e8a64a', '5 500 °C', seg(lt, 1.4, 1.8));
    thermo(780, 1380, 640, seg(lt, 1.0, 2.4), VERM, '30 000 °C', seg(lt, 2.2, 2.6));
    mistBottom(.6);
  },
  five(lt, D) {
    page(32); title('в пять раз горячее', 230, seg(lt, 0, .7), 64);
    for (let k = 0; k < 5; k++) drawObj(O.sunXS, 140 + k * 200, 600, seg(lt, .3 + k * .25, .7 + k * .25));
    mono('= ×5', 540, 790, seg(lt, 1.6, 2.0), { size: 56 });
    ctx.save(); ctx.translate(540, 880); drawList(ctx, O.b3.S, seg(lt, 1.5, 1.8), BOLT_P); ctx.restore();
    mistBottom(.6);
  },
  thunder(lt, D) {
    stormSky(5); fields(6);
    const at = .3; strike(O.b4, lt, at, 0, 0, 1.6); flash(lt, at, .45);
    const [tx, ty] = O.b4.tip;
    for (let k = 0; k < 5; k++) {
      const ph = seg(lt, at + .25 + k * .3, at + 2.6 + k * .3); if (ph <= 0 || ph >= 1) continue;
      const r = 40 + ph * 900; ctx.beginPath(); ctx.ellipse(tx, ty, r, r * .45, 0, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = rgba(PAPER, .8 * (1 - ph)); ctx.lineWidth = 8 * (1 - ph) + 2; ctx.stroke();
    }
    title('гром', 200, seg(lt, .8, 1.5), 84);
    hand('воздух резко расширяется', 540, 290, seg(lt, 1.2, 2.2), { size: 50, align: 'center' });
    mistBottom(.9, 1560);
  },
  count(lt, D) {
    // a window onto the storm, a person counting
    ctx.save(); ctx.beginPath(); ctx.rect(170, 420, 740, 900); ctx.clip(); stormSky(7, 380);
    withSeed(8, () => { for (let k = 0; k < 40; k++) { const x = rnd(170, 910), y = ((rnd(420, 1320) + lt * 900) % 900) + 420; ctx.strokeStyle = rgba('#dfe6ec', .5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 40); ctx.stroke(); } });
    strike(O.b5, lt, .25, 0, 0, .5); ctx.restore();
    withSeed(9, () => { for (const [a, b, c, d] of [[160, 410, 920, 410], [160, 1330, 920, 1330], [160, 410, 160, 1330], [920, 410, 920, 1330], [540, 410, 540, 1330], [160, 870, 920, 870]]) drawS(ctx, mk(qcurve(a, b, c, d, 0, 10), 22, '#8a6a4a', { prof: 'even', nb: 4, a: .9 })); });
    flash(lt, .25, .35);
    drawObj(O.person, 800, 1600, 1);
    const n = Math.floor(clamp((lt - .5) / .55, 0, 6));
    for (let k = 1; k <= n; k++) hand(String(k), 130 + (k - 1) * 105, 1420, seg(lt, .5 + (k - 1) * .55, .8 + (k - 1) * .55), { size: 86, col: VERM, align: 'center' });
    title('считаем секунды…', 230, seg(lt, .1, .8), 60, true);
    mono('÷ 3', 540, 330, seg(lt, D - 1.2, D - .8), { size: 56, col: VERM });
    mistBottom(.5, 1640);
  },
  map(lt, D) {
    page(33); title('расстояние до грозы', 230, seg(lt, 0, .7), 60);
    drawObj(O.houseS, 230, 1060, seg(lt, .1, .8));
    drawObj(O.cloud, 790, 640, seg(lt, .3, 1.0));
    ctx.save(); ctx.translate(790, 660); drawList(ctx, O.b6.S, seg(lt, .9, 1.1), BOLT_P); ctx.restore();
    const p = seg(lt, 1.0, 2.2); ctx.setLineDash([18, 14]); ctx.strokeStyle = rgba(INK, .8); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(300, 960); ctx.lineTo(lerp(300, 720, p), lerp(960, 760, p)); ctx.stroke(); ctx.setLineDash([]);
    mono('6 с ÷ 3 = 2 км', 540, 1260, seg(lt, 2.0, 2.5), { size: 50 });
    hand('в километрах', 540, 1360, seg(lt, 2.3, 3.0), { size: 54, align: 'center', col: VERM });
    mistBottom(.6);
  },
  earth(lt, D) {
    withSeed(41, () => washPoly(ctx, [[-20, 330], [W + 20, 330], [W + 20, 1520], [-20, 1520]], '#2f3550', .85));
    withSeed(42, () => { for (let k = 0; k < 60; k++) { ctx.fillStyle = rgba('#f1e9da', rnd(.3, .8)); ctx.fillRect(rnd(0, W), rnd(340, 1500), 3, 3); } });
    drawObj(O.earth, 540, 910, seg(lt, .1, 1.4));
    if (lt > 1.2) withSeed(1000 + Math.floor(lt * 12), () => { for (let k = 0; k < 5; k++) { const a = rnd(0, 6.28), r = Math.sqrt(rnd()) * 300; const x = 540 + Math.cos(a) * r, y = 910 + Math.sin(a) * r; ctx.save(); ctx.shadowColor = '#fff6c8'; ctx.shadowBlur = 24; ctx.fillStyle = rgba('#fff6c8', .95); ctx.beginPath(); ctx.arc(x, y, rnd(5, 10), 0, 7); ctx.fill(); ctx.restore(); } });
    title('каждую секунду', 200, seg(lt, .1, .8), 64);
    mono('≈ 40 молний', 540, 1380, seg(lt, 1.4, 1.9), { size: 52, col: '#f1e9da' });
    mistBottom(.85, 1560);
  },
  tower(lt, D) {
    stormSky(11);
    withSeed(12, () => { for (let k = 0; k < 9; k++) { const x = k * 130 - 20, h = rnd(200, 420); fillRect([], 0, 0, 0, 0, '#000', 0); ctx.fillStyle = rgba('#4a5268', .7); ctx.fillRect(x, 1500 - h, 110, h); } });
    drawObj(O.tower, 540, 1500, seg(lt, 0, .9));
    const [tx, ty] = O.tower.tip, hits = [.8, 1.6, 2.4].filter(a => a < D - .3);
    hits.forEach((a, i) => { strike(O.bt[i], lt, a, 540 + tx, 1500 + ty, .35); flash(lt, a, .4); });
    const nh = hits.filter(a => lt >= a).length;
    hand('| '.repeat(nh).trim(), 860, 520, nh ? 1 : 0, { size: 80, col: VERM, align: 'center' });
    title('в одно место —', 170, seg(lt, .1, .8), 60); title('много раз', 250, seg(lt, .4, 1.1), 56, true);
    mistBottom(.9, 1560);
  },
  sand(lt, D) {
    page(34);
    withSeed(51, () => { washPoly(ctx, [[-20, 900], [W + 20, 900], [W + 20, 1520], [-20, 1520]], SAND, .7); for (let k = 0; k < 12; k++) { const y = 960 + k * 45; drawS(ctx, mk(qcurve(rnd(0, 200), y, rnd(700, 1080), y + rnd(-10, 10), rnd(-20, 20), 12), 5, '#c9a46a', { prof: 'even', nb: 0, a: .5 })); } });
    drawObj(O.fulg, 540, 1180, seg(lt, .3, 1.8));
    title('песок + молния', 230, seg(lt, 0, .7), 64);
    note(lt, 1.6, 640, 1150, 420, 760, 'фульгурит', { size: 60 });
    mono('стеклянная трубка', 540, 1420, seg(lt, 2.0, 2.5), { size: 40 });
    mistBottom(.6);
  },
  sub(lt, D) {
    withSeed(61, () => washPoly(ctx, [[-20, 330], [W + 20, 330], [W + 20, 1300], [-20, 1300]], '#dfe6e2', .6));
    fields(62, 1180);
    const RB = ['#d98c7a', '#e6b47a', '#e8d38c', '#a9c08c', '#8fb0c4', '#a99cc4'];
    RB.forEach((c, i) => { const r = 620 - i * 34, P = []; for (let k = 0; k <= 30; k++) { const a = Math.PI + k / 30 * Math.PI; P.push([540 + Math.cos(a) * r, 1280 + Math.sin(a) * r * .9]); } withSeed(70 + i, () => drawS(ctx, mk(P, 30, c, { prof: 'even', nb: 5, a: .75 }), seg(lt, .2 + i * .12, 1.4 + i * .12))); });
    title('Факты за минуту', 200, seg(lt, .8, 1.6), 88);
    hand('подписывайтесь', 540, 300, seg(lt, 1.3, 2.3), { size: 62, align: 'center', col: VERM });
    const m = seg(lt, D - 2.4, D - .5);
    if (m > 0) { const y0 = H - m * (H + 300); const g = ctx.createLinearGradient(0, y0, 0, y0 + 300); g.addColorStop(0, rgba(PAPER, 0)); g.addColorStop(1, rgba(PAPER, 1)); ctx.fillStyle = g; ctx.fillRect(0, y0, W, 300); ctx.fillStyle = PAPER; ctx.fillRect(0, y0 + 300, W, H); }
    mistBottom(.85, 1560);
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

function buildAll() {
  O.b1 = boltShape(560, 340, 960, 16, BOLT, 1); O.b2 = boltShape(0, 0, 560, 14, BOLT_P, 2); O.b3 = boltShape(0, 0, 520, 16, BOLT_P, 3);
  O.b4 = boltShape(520, 360, 900, 15, BOLT, 4); O.b5 = boltShape(600, 420, 560, 10, BOLT, 5); O.b6 = boltShape(0, 0, 300, 9, BOLT_P, 6);
  O.bt = [7, 8, 9].map(s => boltShape(0, -700, 700, 13, BOLT, s));
  O.sun = obj(sunDisc(230)); O.sunS = obj(sunDisc(110)); O.sunXS = obj(sunDisc(62));
  O.cloud = obj(cloud(1)); O.houseS = obj(houseS(1)); O.earth = obj(earth(330)); O.tower = obj(tower(1));
  O.fulg = obj(fulgurite(1)); O.person = obj(personBack(1.2));
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const S = Object.fromEntries(SC.map(s => [s.name, s]));
  add('rain', S.bolt.t0, { d: S.bolt.t1 - S.bolt.t0 + .5 }); add('crack', S.bolt.t0 + .45); add('thunder', S.bolt.t0 + 1.4, { d: 3 });
  add('brush', S.sun.t0 + .1, { d: 1.5 }); add('pencil', S.sun.t0 + 1.7, { d: .8 });
  add('brush', S.compare.t0 + .1, { d: .7 }); add('tick', S.compare.t0 + .7, { d: 1.7 });
  for (let k = 0; k < 5; k++) add('pop', S.five.t0 + .3 + k * .25); add('crack', S.five.t0 + 1.5, { v: .4 });
  add('rain', S.thunder.t0, { d: S.thunder.t1 - S.thunder.t0 }); add('crack', S.thunder.t0 + .3); add('thunder', S.thunder.t0 + .55, { d: 3.2, v: 1.3 });
  add('rain', S.count.t0, { d: S.count.t1 - S.count.t0, v: .7 }); add('crack', S.count.t0 + .25, { v: .5 });
  for (let k = 0; k < 6; k++) if (S.count.t0 + .5 + k * .55 < S.count.t1) add('count', S.count.t0 + .5 + k * .55);
  add('thunder', Math.min(S.count.t1 - .3, S.count.t0 + 2.2), { d: 2.2, v: .7 });
  add('brush', S.map.t0 + .1, { d: 1 }); add('pencil', S.map.t0 + 1.0, { d: 1.2 });
  add('sparkle', S.earth.t0 + 1.2, { d: S.earth.t1 - S.earth.t0 - 1.2 });
  add('rain', S.tower.t0, { d: S.tower.t1 - S.tower.t0 }); for (const a of [.8, 1.6, 2.4]) if (a < S.tower.t1 - S.tower.t0 - .3) add('crack', S.tower.t0 + a, { v: .8 });
  add('thunder', S.tower.t0 + 1.0, { d: 2.5, v: .8 });
  add('brush', S.sand.t0 + .3, { d: 1.5 }); add('pencil', S.sand.t0 + 1.9, { d: .8 }); add('wind', S.sand.t0, { d: S.sand.t1 - S.sand.t0 });
  add('birds', S.sub.t0, { d: S.sub.t1 - S.sub.t0 }); add('chime', S.sub.t0 + .9);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.render = render;
window.SC = SC; window.VO = VO; window.SUBS = SUBS;
(async () => {
  PAPER_IMG = new Image(); PAPER_IMG.src = 'paper.jpg'; await PAPER_IMG.decode();
  await document.fonts.load('500 60px "Cormorant Garamond"', 'Молния'); await document.fonts.load('italic 500 52px "Cormorant Garamond"', 'Молния');
  await document.fonts.load('600 46px Caveat', 'гром'); await document.fonts.load('400 30px "IBM Plex Mono"', '5 500 °C');
  withSeed(20261107, buildAll);
  window.EV = events();
  render(parseFloat(qs.get('t') ?? '2'));
  window.READY = true;
})();
