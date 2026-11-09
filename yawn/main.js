// «Почему зевота заразна» — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['bet', 'Спорим, вы зевнёте до конца этого видео?'],
  ['chain', 'Зевота заразна. Достаточно увидеть, как зевает другой, — и рот открывается сам.'],
  ['book', 'Иногда хватает просто прочитать или подумать о зевоте. Вот как сейчас.'],
  ['family', 'Учёные заметили: чаще всего мы «заражаемся» от близких людей. Это связано с сочувствием.'],
  ['dog', 'Даже собаки могут зевнуть, увидев, как зевает хозяин!'],
  ['womb', 'А зевать мы начинаем ещё до рождения — в животе у мамы.'],
  ['cool', 'Зачем мы зеваем? По одной из версий, зевота охлаждает мозг, чтобы он лучше работал.'],
  ['sub', 'Ну что, зевнули? Пишите в комментариях! И подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.05,2.53],[2.92,8.26],[8.59,13.23],[13.56,20.07],[20.36,23.69],[24.04,27.61],[28.05,33.52],[34.00,39.13]];
const PH = [[0.05,2.53,'Спорим, вы зевнёте до конца этого видео?'],[2.92,4.21,'Зевота заразна.'],[4.51,8.26,'Достаточно увидеть, как зевает другой, — и рот открывается сам.'],[8.59,12.00,'Иногда хватает просто прочитать или подумать о зевоте.'],
  [12.32,13.23,'Вот как сейчас.'],[13.56,14.63,'Учёные заметили:'],[14.84,18.18,'чаще всего мы «заражаемся» от близких людей.'],[18.52,20.07,'Это связано с сочувствием.'],[20.36,23.69,'Даже собаки могут зевнуть, увидев, как зевает хозяин!'],
  [24.04,27.61,'А зевать мы начинаем ещё до рождения — в животе у мамы.'],[28.05,29.10,'Зачем мы зеваем?'],[29.50,33.52,'По одной из версий, зевота охлаждает мозг, чтобы он лучше работал.'],[34.00,35.16,'Ну что, зевнули?'],[35.52,36.66,'Пишите в комментариях!'],[36.94,39.13,'И подписывайтесь на «Факты за минуту»!']];
const WORDS = { 'bet|зевнёте': 0.9, 'chain|заразна': 3.5, 'chain|Достаточно': 4.51, 'book|прочитать': 10.0, 'book|подумать': 10.9, 'book|Вот как': 12.32, 'family|близких': 16.9, 'family|сочувствием': 19.2,
  'dog|собаки': 20.8, 'dog|увидев': 21.4, 'womb|до рождения': 25.9, 'cool|Зачем': 28.05, 'cool|охлаждает': 31.0, 'sub|Пишите': 35.52, 'sub|подписывайтесь': 37.3 };
const VOICE_OFFSET = 0.4, BPM = 72, BEAT = 60 / BPM;
const snapB = t => Math.round(t / (BEAT / 2)) * BEAT / 2;
const TL = (() => {
  const spans = VOICE || (() => { let t = 0; return LINES.map(l => { const d = l.text.length / 14; const s = [t, t + d]; t += d + .6; return s; }); })();
  const on = spans.map(s => s[0] + VOICE_OFFSET), starts = on.map((x, i) => i ? snapB(x - .3) : 0);
  const end = snapB(spans[spans.length - 1][1] + VOICE_OFFSET + 3.0);
  return { SC: LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end })), VO: LINES.map((l, i) => ({ ...l, t: on[i], d: spans[i][1] - spans[i][0] })), DUR: end };
})();
const { SC, VO } = TL;
const sceneIdx = t => { let k = 0; SC.forEach((s, i) => { if (t >= s.t0) k = i; }); return k; };
const SCN = Object.fromEntries(SC.map(s => [s.name, s])), VON = Object.fromEntries(VO.map(v => [v.id, v]));
const word = (id, w) => { if (VOICE && WORDS[id + '|' + w] != null) return WORDS[id + '|' + w] + VOICE_OFFSET - SCN[id].t0; const v = VON[id], i = Math.max(0, v.text.indexOf(w)); return v.t + v.d * i / v.text.length - SCN[id].t0; };

const cv = document.getElementById('ov'), g = cv.getContext('2d');
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const OFF = mk(), og = OFF.getContext('2d');
// draw f into an offscreen layer, then composite it blurred (depth of field)
function layer(blur, f, alpha = 1) {
  og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, W, H); const keep = g; G = og; f(); G = keep;
  g.save(); g.globalAlpha = alpha; if (blur > 0) g.filter = `blur(${blur}px)`; g.drawImage(OFF, 0, 0); g.restore();
}
let G = g; // current target for helpers
// ———————————————————————————— light helpers
function glow(x, y, r, col, a = 1, op = 'lighter') { const c = G; c.save(); c.globalCompositeOperation = op; c.globalAlpha = a; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
function vgrad(y0, y1, stops) { const gr = G.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function bokeh(n, seed, x0, y0, x1, y1, cols, rmin, rmax, a, t = 0, drift = 0) {
  const c = G; c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const k = seed + i * 13; const x = x0 + hash(k) * (x1 - x0) + Math.sin(t * .3 + k) * drift, y = y0 + hash(k + 1) * (y1 - y0) + Math.cos(t * .25 + k) * drift, r = rmin + hash(k + 2) * (rmax - rmin);
    const gr = c.createRadialGradient(x, y, r * .55, x, y, r); const col = cols[i % cols.length]; gr.addColorStop(0, col); gr.addColorStop(.85, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = a * (.4 + .6 * hash(k + 3)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  c.restore();
}
function dust(n, seed, x0, y0, x1, y1, t, col = '#fff', a = .5) { const c = G; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = col; for (let i = 0; i < n; i++) { const k = seed + i * 7; const x = x0 + ((hash(k) * (x1 - x0) + t * (8 + hash(k + 1) * 14)) % (x1 - x0)), y = y0 + ((hash(k + 2) * (y1 - y0) - t * (5 + hash(k + 3) * 10) + 9999 * (y1 - y0)) % (y1 - y0)); c.globalAlpha = a * (.3 + .7 * Math.abs(Math.sin(t * .8 + k))); c.beginPath(); c.arc(x, y, 1.5 + hash(k + 4) * 3, 0, TAU); c.fill(); } c.restore(); }
function rr(x, y, w, h, r) { G.beginPath(); G.roundRect(x, y, w, h, r); }

// ———————————————————————————— the guy (profile, facing right). Origin = neck pivot.
function headPath(c, j) {
  c.beginPath(); c.moveTo(-38, 18);
  c.bezierCurveTo(-80, -20, -84, -122, -20, -150); c.bezierCurveTo(30, -170, 76, -138, 74, -100);
  c.quadraticCurveTo(74, -86, 80, -79); c.quadraticCurveTo(86, -66, 97, -50); c.quadraticCurveTo(93, -42, 81, -42);
  c.lineTo(83, -34); c.quadraticCurveTo(87, -30, 81, -27); c.lineTo(80 - j * .2, -26 + j);
  c.quadraticCurveTo(86 - j * .2, -21 + j, 80 - j * .2, -16 + j); c.quadraticCurveTo(84, -1 + j, 64, 5 + j);
  c.quadraticCurveTo(42, 9 + j * .6, 26, 20); c.lineTo(24, 46); c.lineTo(-36, 46); c.closePath();
}
function hairPath(c) {
  c.beginPath(); c.moveTo(-44, -54); c.bezierCurveTo(-92, -120, -40, -190, 26, -168); c.bezierCurveTo(66, -158, 88, -128, 76, -108);
  c.lineTo(62, -116); c.lineTo(58, -100); c.lineTo(44, -118); c.lineTo(28, -108); c.lineTo(18, -122); c.quadraticCurveTo(-18, -112, -28, -84); c.quadraticCurveTo(-34, -66, -44, -54); c.closePath();
}
function girlHairPath(c) {
  c.beginPath(); c.moveTo(74, -104); c.bezierCurveTo(84, -160, 10, -196, -40, -164); c.bezierCurveTo(-100, -126, -96, -20, -92, 70); c.bezierCurveTo(-90, 130, -70, 170, -30, 190);
  c.bezierCurveTo(-56, 120, -44, 50, -26, 4); c.bezierCurveTo(-36, -40, -24, -92, 12, -118); c.quadraticCurveTo(44, -100, 74, -104); c.closePath();
}
function bodyPath(c) { c.beginPath(); c.moveTo(-36, 30); c.bezierCurveTo(-112, 44, -156, 120, -156, 270); c.lineTo(-156, 620); c.lineTo(96, 620); c.lineTo(86, 210); c.bezierCurveTo(84, 120, 62, 70, 24, 36); c.closePath(); }
function rimFill(c, pathF, base, rim, dx, dy, halo = .45) {
  if (rim && halo > 0) { c.save(); c.shadowColor = rim; c.shadowBlur = 36; c.globalAlpha = halo; pathF(c); c.fillStyle = rim; c.fill(); c.restore(); }
  c.save(); pathF(c); c.fillStyle = rim || base; c.fill(); c.clip(); c.translate(-dx, -dy); pathF(c); c.fillStyle = base; c.fill(); c.restore();
}
function armPath(c, pts, w) { c.beginPath(); c.moveTo(...pts[0]); if (pts.length === 3) c.quadraticCurveTo(...pts[1], ...pts[2]); else c.lineTo(...pts[1]); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; }
// o: x,y,s, nod, jaw, eye(0 closed..1 open), red, rim, rdx,rdy, base, face {x,y,r,col,a}, arms [[p0,p1,p2], ...] (local), farArm, rot
function guy(o) {
  const c = G; c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); c.scale(o.s * (o.flip || 1), o.s);
  const HP = o.girl ? girlHairPath : hairPath, base = o.base || '#12141b', rim = o.rim, dx = o.rdx ?? 5, dy = o.rdy ?? -2;
  const strokeArm = (pts, col, wid = 58) => { if (rim) { c.save(); c.globalAlpha = .55; c.translate(dx * .5, dy * .5); armPath(c, pts, wid); c.strokeStyle = rim; c.stroke(); c.restore(); } armPath(c, pts, wid); c.strokeStyle = col; c.stroke(); const e = pts[pts.length - 1]; c.beginPath(); c.arc(e[0], e[1], 26, 0, TAU); c.fillStyle = col; c.fill(); };
  if (o.farArm) strokeArm(o.farArm, '#0c0d12');
  if (!o.noBody) rimFill(c, bodyPath, base, rim, dx, dy, o.halo ?? .4);
  c.save(); c.translate(0, 30); c.rotate(o.nod || 0); c.translate(0, -30);
  const hp = cc => headPath(cc, o.jaw || 0);
  rimFill(c, hp, base, rim, dx, dy, o.halo ?? .4);
  if (o.face) { c.save(); hp(c); c.clip(); const f = o.face, gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, f.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = f.a; c.fillStyle = gr; c.fillRect(-120, -200, 260, 280); c.restore(); }
  // hair
  c.save(); HP(c); c.fillStyle = '#07080b'; c.fill(); if (rim) { c.clip(); c.translate(-dx * 1.2, -dy * 1.2); HP(c); c.globalCompositeOperation = 'destination-out'; c.fill(); } c.restore();
  if (rim) { c.save(); HP(c); c.clip(); c.globalCompositeOperation = 'source-atop'; c.restore(); }
  // ear, brow, eye
  c.save(); c.globalAlpha = .5; c.beginPath(); c.ellipse(-8, -66, 11, 17, .2, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 3; c.stroke(); c.restore();
  const eye = o.eye ?? 1, ea = o.eyeA ?? .9;
  c.save(); c.globalAlpha = ea; c.translate(58, -76);
  if (eye > .08) { c.beginPath(); c.ellipse(0, 0, 9, 5.5 * eye, 0, 0, TAU); c.fillStyle = o.red ? `rgb(${lerp(220, 235, o.red)},${lerp(215, 150, o.red)},${lerp(210, 145, o.red)})` : '#e2dcd6'; c.fill(); c.beginPath(); c.arc(5, 0, 4 * Math.min(1, eye + .3), 0, TAU); c.fillStyle = '#1a1210'; c.fill(); c.beginPath(); c.arc(6.5, -1.5, 1.3, 0, TAU); c.fillStyle = '#fff'; c.fill(); }
  c.beginPath(); c.moveTo(-10, -5.5 * eye - 1); c.quadraticCurveTo(0, -7 * eye - 3, 10, -4 * eye - 1); c.strokeStyle = '#05060a'; c.lineWidth = 3; c.stroke();
  if (o.bags) { c.beginPath(); c.moveTo(-8, 8); c.quadraticCurveTo(2, 12, 10, 7); c.strokeStyle = `rgba(90,40,60,${o.bags})`; c.lineWidth = 3; c.stroke(); }
  c.beginPath(); c.moveTo(-12, -16 - (o.brow || 0)); c.quadraticCurveTo(2, -20 - (o.brow || 0), 14, -15); c.strokeStyle = '#05060a'; c.lineWidth = 5; c.stroke();
  c.restore();
  if (o.jaw > 2) { c.save(); c.globalAlpha = .9; c.beginPath(); c.ellipse(80, -27 + o.jaw * .5, 3 + o.jaw * .12, o.jaw * .45, 0, 0, TAU); c.fillStyle = '#050405'; c.fill(); c.restore(); }
  c.restore();
  const hands = []; for (const a of o.arms || []) { strokeArm(a, '#171a22'); hands.push(a[a.length - 1]); }
  c.restore();
  // world coords of hands
  return hands.map(([hx, hy]) => { const cs = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0), X = hx * o.s * (o.flip || 1), Y = hy * o.s; return [o.x + X * cs - Y * sn, o.y + X * sn + Y * cs]; });
}

// ———————————————————————————— type
function title(s, y, p, size = 120, o = {}) {
  if (p <= 0) return; const c = g; c.save(); c.globalAlpha = eo(p) * (o.a ?? 1); c.font = `${o.w || 500} ${size}px Oswald`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = (o.sp ?? .08) * size + 'px';
  const x = o.x ?? W / 2, yy = y + (1 - eo(p)) * 26;
  if (o.rgb) { c.globalCompositeOperation = 'lighter'; const j = o.rgb; c.fillStyle = '#ff2040'; c.fillText(s, x - j, yy); c.fillStyle = '#20e0ff'; c.fillText(s, x + j, yy + j * .3); c.globalCompositeOperation = 'source-over'; }
  c.shadowColor = o.glow || 'rgba(0,0,0,.9)'; c.shadowBlur = size * .4; c.fillStyle = o.fill || '#fff8ee'; c.fillText(s, x, yy); c.shadowBlur = size * .1; c.shadowColor = 'rgba(0,0,0,.7)'; c.fillText(s, x, yy); c.restore();
}
function chip(s, x, y, p, size = 44, col = '#ff4058') { if (p <= 0) return; const c = g; c.save(); c.globalAlpha = eo(p); c.font = `500 ${size}px Oswald`; c.letterSpacing = size * .12 + 'px'; const w = c.measureText(s).width + size * 1.2; c.translate(x, y); const k = back(p); c.scale(k, k); c.beginPath(); c.roundRect(-w / 2, -size * .8, w, size * 1.6, size * .8); c.fillStyle = 'rgba(10,10,14,.6)'; c.fill(); c.lineWidth = 3; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 18; c.stroke(); c.shadowBlur = 0; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); }
function hud(hours, p) { if (p <= 0) return; const c = g; c.save(); c.globalAlpha = eo(p) * .95; c.font = '500 40px Oswald'; c.letterSpacing = '5px'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#ff4058'; c.shadowColor = '#ff2040'; c.shadowBlur = 16; c.beginPath(); c.arc(84, 130, 10, 0, TAU); c.fill(); c.fillText(`${hours} Ч БЕЗ СНА`, 108, 132); c.restore(); }

// ———————————————————————————— props
function phone(x, y, a, glowA = 1) { const c = G; c.save(); c.translate(x, y); c.rotate(a); rr(-34, -64, 68, 128, 12); c.fillStyle = '#0a0b10'; c.fill(); rr(-29, -58, 58, 116, 8); const gr = c.createLinearGradient(0, -58, 0, 58); gr.addColorStop(0, '#d8ecff'); gr.addColorStop(1, '#7fb4ff'); c.fillStyle = gr; c.globalAlpha = glowA; c.fill(); c.restore(); }
function mug(x, y, s = 1, col = '#d8d2c8') { const c = G; c.save(); c.translate(x, y); c.scale(s, s); rr(-38, -60, 76, 92, 12); c.fillStyle = col; c.fill(); c.beginPath(); c.arc(40, -16, 20, -1.3, 1.3); c.lineWidth = 11; c.strokeStyle = col; c.stroke(); c.globalAlpha = .25; rr(-38, -60, 22, 92, 12); c.fillStyle = '#000'; c.fill(); c.restore(); }
function steam(x, y, t, a = .35) { const c = G; c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (let j = 0; j < 3; j++) { c.beginPath(); for (let i = 0; i <= 16; i++) { const u = i / 16; const px = x + (j - 1) * 16 + Math.sin(u * 5 + t * 2 + j * 2) * (6 + u * 18), py = y - u * 170; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.strokeStyle = `rgba(255,255,255,${a * .5})`; c.lineWidth = 10; c.stroke(); } c.restore(); }
function keys(x, y, t, shine = 0) { const c = G; c.save(); c.translate(x, y); c.rotate(.4 + Math.sin(t * 3) * .1); c.strokeStyle = '#d9b45a'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.stroke(); c.fillStyle = '#e8c56a'; for (const [a, l] of [[.4, 70], [1.0, 60]]) { c.save(); c.rotate(a); rr(10, -6, l, 12, 3); c.fill(); c.fillRect(l - 6, 6, 6, 10); c.fillRect(l - 22, 6, 6, 8); c.restore(); } c.restore(); if (shine > 0) { glow(x + 30, y + 20, 90, '#ffe6a0', shine * .8); } }
function brain(x, y, s, t, a) { const c = G; c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = a;
  c.beginPath(); c.moveTo(-120, 30); c.bezierCurveTo(-150, -40, -100, -110, -30, -100); c.bezierCurveTo(10, -130, 90, -120, 110, -60); c.bezierCurveTo(160, -40, 150, 40, 100, 50); c.bezierCurveTo(70, 90, 0, 80, -20, 60); c.bezierCurveTo(-60, 80, -110, 70, -120, 30); c.closePath();
  c.fillStyle = 'rgba(120,220,255,.12)'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#8fe6ff'; c.shadowColor = '#4fd0ff'; c.shadowBlur = 24; c.stroke();
  c.lineWidth = 4; for (const p of [[-90, -20, -50, -60, -20, -30], [-40, 20, 0, -20, 30, 10], [20, -70, 50, -30, 90, -50], [-70, 40, -30, 10, 0, 40], [50, 10, 80, 40, 110, 10]]) { c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[2], p[3], p[4], p[5]); c.stroke(); }
  c.restore(); }
function vignette(a = .75) { const gr = g.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .5, H * .78); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
const NOISE = (() => { const c = mk(512, 512), x = c.getContext('2d'), d = x.createImageData(512, 512); let s = 1; for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 256; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; })();
function grain(t, a = .07) { const f = Math.floor(t * 24); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a; const ox = -hash(f) * 512, oy = -hash(f + 1) * 512; for (let x = ox; x < W; x += 512) for (let y = oy; y < H; y += 512) g.drawImage(NOISE, x, y); g.restore(); }
function grade(col, a, op = 'soft-light') { g.save(); g.globalCompositeOperation = op; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, W, H); g.restore(); }

// ———————————————————————————— dream props
function icon(kind, x, y, s, a, col = '#bfe8ff') {
  const c = G; if (a <= 0) return; c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = a; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = col; c.shadowBlur = 22; c.beginPath();
  if (kind === 'moon') { c.arc(0, 0, 40, .9, 5.4); c.arc(18, -10, 32, 4.9, 1.3, true); c.closePath(); }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 44, q = i / 10 * TAU - Math.PI / 2; i ? c.lineTo(Math.cos(q) * r, Math.sin(q) * r) : c.moveTo(Math.cos(q) * r, Math.sin(q) * r); } c.closePath(); }
  else if (kind === 'house') { c.moveTo(-40, 40); c.lineTo(-40, -5); c.lineTo(0, -42); c.lineTo(40, -5); c.lineTo(40, 40); c.closePath(); c.moveTo(-12, 40); c.lineTo(-12, 12); c.lineTo(12, 12); c.lineTo(12, 40); }
  else if (kind === 'fish') { c.moveTo(-44, 0); c.quadraticCurveTo(-5, -38, 34, 0); c.quadraticCurveTo(-5, 38, -44, 0); c.moveTo(34, 0); c.lineTo(52, -20); c.lineTo(52, 20); c.closePath(); c.moveTo(-26, -4); c.arc(-26, -4, 3, 0, TAU); }
  else if (kind === 'heart') { c.moveTo(0, 36); c.bezierCurveTo(-60, -6, -30, -50, 0, -18); c.bezierCurveTo(30, -50, 60, -6, 0, 36); }
  else if (kind === 'run') { c.arc(10, -40, 10, 0, TAU); c.moveTo(6, -26); c.lineTo(-4, 10); c.lineTo(18, 30); c.moveTo(-4, 10); c.lineTo(-26, 34); c.moveTo(2, -18); c.lineTo(26, -6); c.moveTo(2, -18); c.lineTo(-20, -4); }
  else if (kind === 'key') { c.arc(-24, 0, 16, 0, TAU); c.moveTo(-8, 0); c.lineTo(44, 0); c.lineTo(44, 14); c.moveTo(30, 0); c.lineTo(30, 12); }
  c.stroke(); c.restore();
}
function bubble(x, y, r, a, col = 'rgba(160,200,255,') {
  if (a <= 0) return; const c = G; c.save(); c.globalAlpha = a; c.beginPath();
  for (let i = 0; i < 7; i++) { const q = i / 7 * TAU; c.moveTo(x + Math.cos(q) * r * .55 + r * .42, y + Math.sin(q) * r * .4); c.arc(x + Math.cos(q) * r * .55, y + Math.sin(q) * r * .4, r * .42, 0, TAU); }
  c.fillStyle = col + '.10)'; c.shadowColor = col + '.8)'; c.shadowBlur = 40; c.fill(); c.restore();
}
function particlesOut(x, y, r, u, n, seed, col = '#bfe8ff') { const c = G; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = col; for (let i = 0; i < n; i++) { const k = seed + i, q = hash(k) * TAU, d = r * (.3 + hash(k + 1)) + u * (80 + 160 * hash(k + 2)); c.globalAlpha = (1 - u) * (.4 + .6 * hash(k + 3)); c.beginPath(); c.arc(x + Math.cos(q) * d, y + Math.sin(q) * d - u * 120 * hash(k + 4), 2 + 3 * hash(k + 5), 0, TAU); c.fill(); } c.restore(); }
function bedroom(night, t) {
  layer(12, () => {
    G.fillStyle = night ? vgrad(0, H, [[0, '#0a1024'], [1, '#05070f']]) : vgrad(0, H, [[0, '#3a4a6a'], [1, '#141a28']]); G.fillRect(0, 0, W, H);
    G.fillStyle = night ? vgrad(240, 900, [[0, '#1a2a5a'], [1, '#26407a']]) : vgrad(240, 900, [[0, '#ffd2a8'], [1, '#f0a888']]); G.fillRect(640, 240, 360, 640);
    if (night) { bokeh(10, 7, 650, 300, 990, 860, ['#9cc8ff', '#ffffff'], 3, 7, .9, t, 1); glow(860, 360, 70, 'rgba(230,240,255,.9)', 1); }
    G.fillStyle = night ? '#070a14' : '#2a2a3a'; G.fillRect(812, 240, 14, 640); G.fillRect(640, 556, 360, 12);
    glow(820, 560, 700, night ? 'rgba(80,120,220,.35)' : 'rgba(255,190,140,.45)', 1);
  });
}
function bed(y = 1210, col = '#2a3050') { rr(30, y, 1020, 260, 40); G.fillStyle = col; G.fill(); rr(150, y - 100, 340, 140, 60); G.fillStyle = '#cfcbc4'; G.fill(); G.fillStyle = 'rgba(0,0,0,.3)'; rr(150, y - 20, 340, 60, 40); G.fill(); }
function blanket(y0, lt, cols = ['#5a6a9a', '#232a46'], rim = 'rgba(160,190,255,.4)') {
  const b = Math.sin(lt * 1.3) * 10; G.beginPath(); G.moveTo(450, y0 - b); G.bezierCurveTo(680, y0 - 50 - b, 920, y0 - 20, 1050, y0 + 50); G.lineTo(1050, H + 20); G.lineTo(420, H + 20); G.closePath(); G.fillStyle = vgrad(y0 - 50, 1480, [[0, cols[0]], [1, cols[1]]]); G.fill();
  G.save(); G.strokeStyle = rim; G.lineWidth = 4; G.beginPath(); G.moveTo(450, y0 - b); G.bezierCurveTo(680, y0 - 50 - b, 920, y0 - 20, 1050, y0 + 50); G.stroke(); G.restore();
}
const lying = (o) => guy({ x: 370, y: 1110, s: 1.9, rot: -Math.PI / 2, nod: .05, base: '#1c2030', noBody: true, girl: true, ...o });

// ———————————————————————————— yawn kit
// smooth yawn envelope: rise, hold, fall (seconds)
const yw = (lt, a, d = 2.2) => eio(seg(lt, a, a + d * .35)) * (1 - eio(seg(lt, a + d * .7, a + d)));
const yawnPose = (y) => ({ jaw: 30 * y, nod: -.22 * y, eye: lerp(.9, 0, clamp(y * 1.4)), brow: 6 * y });
function officeBG(t) {
  layer(14, () => { G.fillStyle = vgrad(0, H, [[0, '#8aa0b8'], [1, '#3a4656']]); G.fillRect(0, 0, W, H); for (let i = 0; i < 4; i++) { G.fillStyle = 'rgba(235,245,255,.85)'; G.fillRect(-40 + i * 300, 160, 230, 760); } bokeh(14, 40, 0, 300, W, 1000, ['#ffffff', '#e8f4ff'], 30, 70, .35); G.fillStyle = 'rgba(40,50,60,.6)'; G.fillRect(0, 960, W, 400); });
}
function warmBG(t) {
  layer(14, () => { G.fillStyle = vgrad(0, H, [[0, '#3a2418'], [1, '#120a06']]); G.fillRect(0, 0, W, H); bokeh(22, 70, 0, 150, W, 1300, ['#ffb060', '#ff9040', '#ffd8a0'], 18, 55, .5, t, 3); glow(880, 520, 760, 'rgba(255,170,90,.5)', 1); });
}
function dog(o) {
  const c = G, s = o.s, f = o.flip || 1, rim = o.rim, dx = o.rdx ?? 5, dy = o.rdy ?? -2, base = o.base || '#16131a';
  c.save(); c.translate(o.x, o.y); c.scale(s * f, s);
  const body = cc => { cc.beginPath(); cc.ellipse(-190, 120, 170, 85, 0, 0, TAU); cc.moveTo(-60, 40); cc.lineTo(-10, -10); cc.lineTo(40, 30); cc.lineTo(20, 140); cc.lineTo(-90, 160); cc.closePath(); cc.rect(-80, 150, 34, 140); cc.rect(-300, 150, 34, 140); };
  rimFill(c, body, base, rim, dx, dy, .35);
  c.save(); c.translate(0, -10); c.rotate(o.nod || 0);
  const head = cc => { cc.beginPath(); cc.moveTo(-50, 30); cc.bezierCurveTo(-60, -60, -10, -96, 40, -78); cc.bezierCurveTo(70, -70, 80, -52, 92, -42); cc.lineTo(150, -34); cc.quadraticCurveTo(166, -30, 162, -14); cc.lineTo(150, -2); cc.lineTo(54, 4); cc.quadraticCurveTo(10, 40, -50, 30); cc.closePath(); };
  const jawA = (o.jaw || 0) * .022;
  // open mouth interior
  if (jawA > .02) { c.save(); c.beginPath(); c.moveTo(56, 0); c.lineTo(150, -2); c.lineTo(56 + Math.cos(jawA) * 92, Math.sin(jawA) * 92 + 4); c.closePath(); c.fillStyle = '#3a0c14'; c.fill(); c.restore(); }
  c.save(); c.translate(56, 2); c.rotate(jawA); const jaw = cc => { cc.beginPath(); cc.moveTo(-10, -2); cc.lineTo(88, -2); cc.quadraticCurveTo(84, 16, 60, 18); cc.quadraticCurveTo(10, 24, -10, 10); cc.closePath(); }; rimFill(c, jaw, base, rim, dx, dy, 0);
  if (jawA > .1) { c.save(); c.beginPath(); c.ellipse(40, 4, 34, 7, 0, 0, TAU); c.fillStyle = '#c85a6a'; c.fill(); c.restore(); }
  c.restore();
  rimFill(c, head, base, rim, dx, dy, .35);
  c.beginPath(); c.arc(160, -24, 9, 0, TAU); c.fillStyle = '#050406'; c.fill();
  const ear = cc => { cc.beginPath(); cc.moveTo(-6, -70); cc.bezierCurveTo(-60, -60, -64, 10, -40, 40); cc.bezierCurveTo(-20, 20, -10, -20, 20, -66); cc.closePath(); }; c.save(); ear(c); c.fillStyle = '#0a080c'; c.fill(); c.restore();
  const e = o.eye ?? 1; c.save(); c.translate(62, -48); if (e > .1) { c.beginPath(); c.ellipse(0, 0, 8, 6 * e, 0, 0, TAU); c.fillStyle = '#2a1a10'; c.fill(); c.beginPath(); c.arc(3, -2, 2, 0, TAU); c.fillStyle = '#fff'; c.fill(); } else { c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(0, 5, 8, 0); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke(); } c.restore();
  c.restore(); c.restore();
}
function yawnRing(x, y, p, col = '#ffd08a') { if (p <= 0 || p >= 1) return; const c = G; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - p) * .7; c.strokeStyle = col; c.lineWidth = 6; c.shadowColor = col; c.shadowBlur = 20; c.beginPath(); c.arc(x, y, 40 + p * 220, 0, TAU); c.stroke(); c.restore(); }

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  bet: {
    w(lt, D, t) {
      warmBG(t); G = g;
      const y = yw(lt, .6, Math.min(2.6, D - .8)), P = yawnPose(y);
      guy({ x: 420, y: 1060, s: 3.1, girl: true, base: '#1c1418', rim: '#ffb870', rdx: 5, rdy: -2, halo: .4, face: { x: 110, y: -70, r: 210, col: 'rgba(255,200,150,.75)', a: .9 }, ...P });
      dust(30, 4, 100, 300, 1000, 1500, t, '#ffd8a8', .5);
      grade('#6a3a10', .25);
    },
    ui(lt, D) { const tz = word('bet', 'зевнёте'); title('СПОРИМ,', 260, seg(lt, .2, .7), 110); title('ВЫ ЗЕВНЁТЕ?', 390, seg(lt, tz - .1, tz + .35), 120, { fill: '#ffd08a', glow: 'rgba(255,140,40,.8)' }); },
  },
  chain: {
    w(lt, D, t) {
      officeBG(t); G = g;
      const t0 = word('chain', 'Достаточно') - .4, P = [[170, false], [420, true], [670, false], [920, true]];
      P.forEach(([x, girl], i) => { const a = Math.max(.3, t0) + i * .85, y = yw(lt, a, 2.0); guy({ x, y: 1010 + (i % 2) * 30, s: 1.25, girl, base: '#141820', rim: '#e8f2ff', rdx: -5, rdy: -3, halo: .3, face: { x: -40, y: -80, r: 200, col: 'rgba(200,215,230,.35)', a: 1 }, ...yawnPose(y) }); yawnRing(x + 100, 980, seg(lt, a + .2, a + 1.3), '#bfe0ff'); });
      g.fillStyle = vgrad(DESK, H, [[0, '#3a3a40'], [1, '#101114']]); g.fillRect(0, DESK, W, H - DESK); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, DESK, W, 3);
      for (let i = 0; i < 4; i++) { rr(70 + i * 250, DESK - 160, 180, 130, 10); g.fillStyle = '#0d1014'; g.fill(); rr(80 + i * 250, DESK - 150, 160, 100, 6); g.fillStyle = '#4c6a86'; g.fill(); }
      grade('#2a5a70', .25);
    },
    ui(lt, D) { const tz = word('chain', 'заразна'); title('ЗЕВОТА', 240, seg(lt, tz - .2, tz + .2), 120); title('ЗАРАЗНА', 370, seg(lt, tz, tz + .4), 120, { fill: '#9fd8ff', glow: 'rgba(60,160,255,.8)' }); },
  },
  book: {
    w(lt, D, t) {
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#24180e'], [1, '#0a0704']]); G.fillRect(0, 0, W, H); bokeh(14, 22, 0, 200, W, 1100, ['#ffb060', '#ffd8a0'], 18, 50, .4, t, 3); glow(900, 600, 700, 'rgba(255,170,90,.5)', .9); });
      const tr = word('book', 'прочитать'), y = yw(lt, tr + .5, 2.4);
      glow(760, 1000, 520, 'rgba(255,200,130,.6)', 1);
      const hands = guy({ x: 380, y: 880, s: 2.3, nod: .3 - .5 * y, jaw: 30 * y, eye: lerp(.85, 0, clamp(y * 1.4)), base: '#16120e', rim: '#ffc078', rdx: 6, rdy: -3, face: { x: 120, y: -30, r: 200, col: 'rgba(255,215,160,.7)', a: .9 }, arms: [[[-40, 140], [80, 300], [180, 200]]] });
      // open book
      const bx = hands[0][0] + 90, by = hands[0][1] - 30; g.save(); g.translate(bx, by); g.rotate(-.35);
      g.beginPath(); g.moveTo(-170, -10); g.quadraticCurveTo(-90, -40, 0, -6); g.quadraticCurveTo(90, -40, 170, -10); g.lineTo(170, 210); g.quadraticCurveTo(90, 180, 0, 214); g.quadraticCurveTo(-90, 180, -170, 210); g.closePath(); g.fillStyle = '#f2e6cc'; g.shadowColor = 'rgba(255,200,130,.6)'; g.shadowBlur = 40; g.fill(); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(80,60,40,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 214); g.stroke();
      for (let r = 0; r < 7; r++) for (const sd of [-1, 1]) { if (sd === 1 && r === 3) continue; g.fillStyle = 'rgba(60,45,30,.45)'; g.fillRect(sd < 0 ? -150 : 20, 20 + r * 26, 120 + hash(r + sd) * 10, 7); }
      const wp = seg(lt, tr - .3, tr + .2); g.font = '500 30px Oswald'; g.letterSpacing = '3px'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#7a2010'; g.shadowColor = '#ffb050'; g.shadowBlur = 24 * wp; g.fillText('ЗЕВОТА', 22, 20 + 3 * 26 + 4); g.restore();
      grade('#6a3a10', .25);
    },
    ui(lt, D) { const tr = word('book', 'прочитать'), tn = word('book', 'Вот как'); title('ПРОЧИТАТЬ', 250, seg(lt, tr - .1, tr + .3), 110); title('ИЛИ ПОДУМАТЬ', 370, seg(lt, word('book', 'подумать') - .1, word('book', 'подумать') + .3), 80, { a: .9 }); chip('ВЫ ТОЖЕ ЗЕВАЕТЕ?', W / 2, 520, seg(lt, tn, tn + .4), 44, '#ffd08a'); },
  },
  family: {
    w(lt, D, t) {
      warmBG(t); G = g;
      const tz = word('family', 'близких') - .6, y = yw(lt, Math.max(.4, tz), 2.4);
      guy({ x: 330, y: 900, s: 2.0, girl: true, base: '#1a1210', rim: '#ffc078', rdx: 5, rdy: -2, face: { x: 110, y: -70, r: 200, col: 'rgba(255,200,150,.7)', a: .9 }, ...yawnPose(y) });
      guy({ x: 790, y: 1190, s: 1.25, flip: -1, base: '#1a1210', rim: '#ffd8a0', rdx: 5, rdy: -2, face: { x: 110, y: -70, r: 200, col: 'rgba(255,210,160,.7)', a: .9 }, ...yawnPose(yw(lt, Math.max(.4, tz) + .15, 2.4)) });
      rr(-40, 1420, W + 80, 600, 0); g.fillStyle = vgrad(1420, H, [[0, '#4a2a1c'], [1, '#120806']]); g.fill();
      const hp = seg(lt, word('family', 'сочувствием') - .2, word('family', 'сочувствием') + .4); if (hp > 0) { g.save(); g.translate(600, 760 - Math.sin(t * 2) * 8); const k = back(hp) * (1 + .05 * Math.sin(t * 6)); g.scale(k * 1.4, k * 1.4); G = g; icon('heart', 0, 0, 1, eo(hp), '#ff9aa8'); g.restore(); }
      grade('#7a3a10', .25);
    },
    ui(lt, D) { const tb = word('family', 'близких'), ts = word('family', 'сочувствием'); title('БЛИЗКИЕ ЛЮДИ', 250, seg(lt, tb - .1, tb + .3), 110); chip('СОЧУВСТВИЕ', W / 2, 400, seg(lt, ts - .1, ts + .3), 46, '#ff9aa8'); },
  },
  dog: {
    w(lt, D, t) {
      warmBG(t); G = g;
      const tz = Math.max(.3, word('dog', 'увидев') - .9);
      guy({ x: 300, y: 860, s: 2.1, base: '#16120e', rim: '#ffc078', rdx: 5, rdy: -2, face: { x: 110, y: -70, r: 200, col: 'rgba(255,205,150,.7)', a: .9 }, ...yawnPose(yw(lt, tz, 2.2)) });
      const dy = yw(lt, tz + 1.3, 2.0);
      dog({ x: 780, y: 1150, s: 1.2, flip: -1, nod: -.35 * dy - .15, jaw: 40 * dy, eye: lerp(1, 0, clamp(dy * 1.5)), rim: '#ffd8a0', rdx: 5, rdy: -2 });
      rr(-40, 1500, W + 80, 600, 0); g.fillStyle = vgrad(1500, H, [[0, '#4a2a1c'], [1, '#120806']]); g.fill();
      grade('#7a3a10', .25);
    },
    ui(lt, D) { const ts = word('dog', 'собаки'); title('ДАЖЕ СОБАКИ', 250, seg(lt, ts - .1, ts + .3), 110, { fill: '#ffd08a', glow: 'rgba(255,140,40,.8)' }); },
  },
  womb: {
    w(lt, D, t) {
      g.fillStyle = '#020203'; g.fillRect(0, 0, W, H); G = g;
      const ox = 540, oy = 260, R = 1150;
      g.save(); g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, Math.PI / 2 + .62, Math.PI / 2 - .62, true); g.closePath(); g.clip();
      g.fillStyle = '#1a1a1c'; g.fillRect(0, 0, W, H);
      g.save(); g.globalAlpha = .55; const f = Math.floor(t * 12); for (let x = -hash(f) * 512; x < W; x += 512) for (let y = -hash(f + 1) * 512; y < H; y += 512) g.drawImage(NOISE, x, y); g.restore();
      // amniotic sac
      g.save(); g.filter = 'blur(10px)'; g.beginPath(); g.ellipse(560, 980, 380, 330, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.85)'; g.fill(); g.lineWidth = 40; g.strokeStyle = 'rgba(200,200,200,.35)'; g.stroke(); g.restore();
      // fetus (soft, luminous)
      const y = yw(lt, word('womb', 'до рождения') - .6, 2.6), br = Math.sin(lt * 1.5) * 4;
      g.save(); g.filter = 'blur(5px)'; g.fillStyle = 'rgba(225,220,210,.85)';
      g.beginPath(); g.arc(470, 870 + br, 125, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(620, 1030 + br, 180, 125, .7, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(520, 1080, 50, 26, -.6, 0, TAU); g.fill(); g.beginPath(); g.ellipse(700, 1170, 90, 38, .3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(10,10,12,.9)'; g.beginPath(); g.ellipse(410, 940 + br, 16, 6 + 22 * y, -.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(430, 860 + br, 14, 3 + 2 * (1 - y), 0, 0, TAU); g.fill();
      g.restore();
      g.restore();
      g.save(); g.strokeStyle = 'rgba(220,220,220,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, Math.PI / 2 + .62, Math.PI / 2 - .62, true); g.closePath(); g.stroke();
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(80, 420 + i * 80); g.lineTo(i % 4 ? 96 : 110, 420 + i * 80); g.stroke(); }
      g.font = '500 30px Oswald'; g.fillStyle = 'rgba(230,230,230,.75)'; g.letterSpacing = '3px'; g.textAlign = 'right'; g.fillText('УЗИ  ·  ПЛОД', 1000, 150); g.fillText('ГЛУБИНА 14 СМ', 1000, 190); g.restore();
      grade('#8a6a40', .25);
    },
    ui(lt, D) { const tr = word('womb', 'до рождения'); title('ДО РОЖДЕНИЯ', 330, seg(lt, tr - .1, tr + .3), 110, { fill: '#ffe8d0' }); },
  },
  cool: {
    w(lt, D, t) {
      layer(10, () => { G.fillStyle = vgrad(0, H, [[0, '#06101e'], [1, '#02050a']]); G.fillRect(0, 0, W, H); bokeh(26, 31, 0, 0, W, H, ['#2a70ff', '#40c8ff'], 12, 40, .3, t, 6); });
      const tc = word('cool', 'охлаждает'), yy = yw(lt, Math.max(.3, tc - 1.2), 2.6), x0 = 380, y0 = 1150, s = 3.2;
      guy({ x: x0, y: y0, s, base: '#0c1220', rim: '#5fc8ff', rdx: 5, rdy: -2, halo: .5, face: { x: 110, y: -70, r: 220, col: 'rgba(120,180,255,.35)', a: .9 }, ...yawnPose(yy), nod: -.08 * yy });
      const bx = x0 + 5 * s, by = y0 - 95 * s, cool = seg(lt, tc, tc + 1.5);
      G = g; brain(bx, by, .72, t, 1);
      g.save(); g.globalCompositeOperation = 'source-atop'; g.restore();
      glow(bx, by, 240, `rgba(${Math.round(lerp(255, 80, cool))},${Math.round(lerp(90, 200, cool))},${Math.round(lerp(60, 255, cool))},.55)`, 1);
      if (yy > .1 || cool > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const mx = x0 + 82 * s, my = y0 - 20 * s; for (let i = 0; i < 70; i++) { const u = (t * .7 + hash(i)) % 1, q = hash(i + 3) * .6 - .3; const x = mx + 260 * (1 - u) * Math.cos(q) - 20, y2 = my + 30 * Math.sin(q * 3); const px = lerp(x + 120, bx, eio(u)), py = lerp(y2, by + Math.sin(i) * 40, eio(u)) - Math.sin(u * Math.PI) * 80; g.globalAlpha = Math.sin(u * Math.PI) * clamp(yy * 2 + cool) * .8; g.fillStyle = i % 3 ? '#8fe6ff' : '#ffffff'; g.beginPath(); g.arc(px, py, 3 + 3 * hash(i + 8), 0, TAU); g.fill(); } g.restore(); }
      // thermometer
      const lv = lerp(.85, .35, eio(cool)); g.save(); g.translate(930, 900); rr(-26, -300, 52, 380, 26); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4; g.stroke(); const col = cool > .5 ? '#5fc8ff' : '#ff6a50'; g.beginPath(); g.arc(0, 110, 48, 0, TAU); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 24; g.fill(); rr(-14, 80 - 360 * lv, 28, 360 * lv, 14); g.fill(); g.restore();
      grade('#1a3a8a', .25);
    },
    ui(lt, D) { const tq = word('cool', 'Зачем'), tc = word('cool', 'охлаждает'); title('ЗАЧЕМ?', 250, seg(lt, tq, tq + .4) * (1 - seg(lt, tc - .3, tc)), 120); title('ОХЛАЖДАЕТ МОЗГ', 250, seg(lt, tc, tc + .4), 100, { fill: '#bff0ff', glow: 'rgba(60,180,255,.8)' }); chip('ОДНА ИЗ ВЕРСИЙ', W / 2, 380, seg(lt, tc + .3, tc + .7), 38, '#8fe6ff'); },
  },
  sub: {
    w(lt, D, t) {
      layer(10, () => { G.fillStyle = vgrad(0, H, [[0, '#ffcf8a'], [1, '#c87a50']]); G.fillRect(0, 0, W, H); glow(860, 420, 900, 'rgba(255,240,200,1)', 1); bokeh(16, 90, 400, 100, W, 900, ['#fff4d0', '#ffe0a0'], 20, 60, .5, t, 5); });
      G = g; dust(40, 5, 0, 300, W, 1500, t, '#fff', .6);
      const y = yw(lt, .2, 2.0);
      guy({ x: 360, y: 940, s: 2.4, girl: true, base: '#2a1e1e', rim: '#fff0c8', rdx: 6, rdy: -3, halo: .5, face: { x: 100, y: -80, r: 220, col: 'rgba(255,220,170,.85)', a: .9 }, ...yawnPose(y) });
      grade('#ff9a40', .2);
    },
    ui(lt, D, t) {
      const tk = word('sub', 'Пишите'), ts = word('sub', 'подписывайтесь') + .1, tc = ts + 1.1;
      title('НУ ЧТО, ЗЕВНУЛИ?', 230, seg(lt, .1, .5), 100, { glow: 'rgba(160,60,0,.7)' });
      pop2(seg(lt, tk - .1, tk + .3), 800, 520, () => { g.beginPath(); g.roundRect(-190, -80, 380, 160, 50); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.moveTo(-100, 70); g.lineTo(-150, 140); g.lineTo(-40, 76); g.fill(); g.font = '500 56px Oswald'; g.fillStyle = '#2a1e1e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '4px'; g.fillText('ДА! 🥱'.replace(' 🥱', ''), 0, 4); });
      const bp = seg(lt, ts, ts + .4), done = lt > tc; if (bp > 0) { g.save(); g.translate(W / 2, 1300); const k = back(bp) * (lt > tc ? 1 - .06 * Math.exp(-(lt - tc) * 10) : 1); g.scale(k, k); g.beginPath(); g.roundRect(-300, -80, 600, 160, 80); g.fillStyle = done ? '#3a3a40' : '#ff1f2e'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0; g.font = '500 66px Oswald'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4); g.restore(); }
      if (bp > .5) { const u = eio(seg(lt, ts + .4, tc)); g.save(); g.translate(lerp(960, 640, u), lerp(1560, 1330, u)); g.beginPath(); [[0, 0], [0, 64], [16, 50], [28, 76], [40, 70], [28, 46], [48, 44]].forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.restore(); }
    },
  },
};
function pop2(p, x, y, f) { if (p <= 0) return; g.save(); g.translate(x, y); const k = back(p); g.scale(k, k); g.globalAlpha = clamp(p * 3); f(); g.restore(); }

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s;
const SUBS = (() => { const out = VOICE && PH ? PH.map(([a, b, x]) => ({ text: x, a: a + VOICE_OFFSET - .05, b: b + VOICE_OFFSET })) : VO.map(v => ({ text: SHOW(v.text), a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .5, p.a + 1.6); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .2) * (1 - seg(t, v.b - .15, v.b));
  g.save(); g.globalAlpha = f; g.font = '600 50px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = wrap(v.text, 900), y0 = H - 250 - (L.length - 1) * 66;
  L.forEach((s, i) => { g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 16; g.fillStyle = '#fff'; g.fillText(s, W / 2, y0 + i * 66); g.fillText(s, W / 2, y0 + i * 66); });
  g.restore();
}

// ———————————————————————————— frame
function render(t) {
  const k = sceneIdx(t), s = SC[k], lt = t - s.t0, D = s.t1 - s.t0;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; G = g;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  SH[s.name].w(lt, D, t); G = g;
  vignette(.8); grain(t, .06);
  SH[s.name].ui(lt, D, t);
  subs(t);
  const fin = 1 - seg(lt, 0, k ? .3 : .6), fout = k === SC.length - 1 ? 0 : seg(lt, D - .2, D);
  const f = Math.max(fin, fout); if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
  if (t > TL.DUR - .8) { g.fillStyle = `rgba(0,0,0,${seg(t, TL.DUR - .8, TL.DUR)})`; g.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const X = SCN, at = (n, dt) => X[n].t0 + dt, dur = n => X[n].t1 - X[n].t0, w = (n, s) => at(n, word(n, s));
  add('yawn', at('bet', .6), { d: 2.2, f: 1.25 });
  const t0 = Math.max(.3, word('chain', 'Достаточно') - .4); add('room', at('chain', 0), { d: dur('chain') }); for (let i = 0; i < 4; i++) add('yawn', at('chain', t0 + i * .85), { d: 1.9, f: [1, 1.3, .95, 1.25][i], v: .7 }); add('hit', w('chain', 'заразна'), { v: .5 });
  add('page', at('book', .2)); add('ding', w('book', 'прочитать') - .2); add('yawn', w('book', 'прочитать') + .5, { d: 2.3, f: .95 });
  const tz = Math.max(.4, word('family', 'близких') - .6); add('yawn', at('family', tz), { d: 2.3, f: 1.25 }); add('yawn', at('family', tz + .15), { d: 2.2, f: 1.8, v: .6 }); add('ding', w('family', 'сочувствием') - .2);
  const td = Math.max(.3, word('dog', 'увидев') - .9); add('yawn', at('dog', td), { d: 2.1, f: .95 }); add('dogyawn', at('dog', td + 1.3), { d: 1.9 });
  add('womb', at('womb', 0), { d: dur('womb') });
  add('air', w('cool', 'охлаждает') - 1.0, { d: 2.6 }); add('chime', w('cool', 'охлаждает') + .2);
  add('swell', at('sub', 0), { d: dur('sub') }); add('yawn', at('sub', .2), { d: 2.0, f: 1.25, v: .7 }); add('pop', w('sub', 'Пишите') - .1); add('click', w('sub', 'подписывайтесь') + 1.2); add('chime', w('sub', 'подписывайтесь') + 1.25);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
