// «Что будет, если не спать 3 дня» — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['night', 'Что будет, если не спать три дня? Ответ вас удивит!'],
  ['work', 'Через сутки без сна реакция у человека как после алкоголя. Внимание падает, всё раздражает.'],
  ['micro', 'Мозг начинает засыпать сам — на пару секунд, даже с открытыми глазами. Это называют микросном.'],
  ['keys', 'На второй день память подводит, мысли путаются, сложно подобрать слова.'],
  ['halluc', 'На третий день могут начаться галлюцинации: человек видит то, чего нет.'],
  ['record', 'Рекорд — одиннадцать дней без сна, его поставил школьник в тысяча девятьсот шестьдесят четвёртом году. Сегодня такие рекорды больше не регистрируют — это опасно.'],
  ['sleep', 'Ведь во сне мозг очищается и восстанавливается.'],
  ['sub', 'Спите хорошо и подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.07,3.47],[3.83,9.66],[10.09,16.12],[16.57,20.70],[21.18,25.50],[26.01,35.22],[35.61,38.47],[38.95,41.81]];
const PH = [[0.07,1.93,'Что будет, если не спать 3 дня?'],[2.31,3.47,'Ответ вас удивит!'],[3.83,7.17,'Через сутки без сна реакция у человека как после алкоголя.'],[7.53,9.66,'Внимание падает, всё раздражает.'],
  [10.09,11.68,'Мозг начинает засыпать сам —'],[11.89,14.17,'на пару секунд, даже с открытыми глазами.'],[14.63,16.12,'Это называют микросном.'],[16.57,20.70,'На второй день память подводит, мысли путаются, сложно подобрать слова.'],
  [21.18,23.56,'На третий день могут начаться галлюцинации:'],[23.87,25.50,'человек видит то, чего нет.'],[26.01,28.17,'Рекорд — 11 дней без сна,'],[28.48,31.67,'его поставил школьник в 1964 году.'],
  [32.05,34.27,'Сегодня такие рекорды больше не регистрируют —'],[34.52,35.22,'это опасно.'],[35.61,38.47,'Ведь во сне мозг очищается и восстанавливается.'],[38.95,41.81,'Спите хорошо и подписывайтесь на «Факты за минуту»!']];
const WORDS = { 'work|алкоголя': 6.4, 'work|Внимание': 7.53, 'work|всё раздражает': 8.6, 'micro|засыпать': 10.9, 'micro|микросном': 15.0, 'keys|мысли': 18.6, 'halluc|галлюцинации': 22.6,
  'record|одиннадцать': 26.77, 'record|Сегодня': 32.05, 'sleep|очищается': 36.9, 'sub|подписывайтесь': 40.2 };
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
function bodyPath(c) { c.beginPath(); c.moveTo(-36, 30); c.bezierCurveTo(-112, 44, -156, 120, -156, 270); c.lineTo(-156, 620); c.lineTo(96, 620); c.lineTo(86, 210); c.bezierCurveTo(84, 120, 62, 70, 24, 36); c.closePath(); }
function rimFill(c, pathF, base, rim, dx, dy, halo = .45) {
  if (rim && halo > 0) { c.save(); c.shadowColor = rim; c.shadowBlur = 36; c.globalAlpha = halo; pathF(c); c.fillStyle = rim; c.fill(); c.restore(); }
  c.save(); pathF(c); c.fillStyle = rim || base; c.fill(); c.clip(); c.translate(-dx, -dy); pathF(c); c.fillStyle = base; c.fill(); c.restore();
}
function armPath(c, pts, w) { c.beginPath(); c.moveTo(...pts[0]); if (pts.length === 3) c.quadraticCurveTo(...pts[1], ...pts[2]); else c.lineTo(...pts[1]); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; }
// o: x,y,s, nod, jaw, eye(0 closed..1 open), red, rim, rdx,rdy, base, face {x,y,r,col,a}, arms [[p0,p1,p2], ...] (local), farArm, rot
function guy(o) {
  const c = G; c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); c.scale(o.s * (o.flip || 1), o.s);
  const base = o.base || '#12141b', rim = o.rim, dx = o.rdx ?? 5, dy = o.rdy ?? -2;
  const strokeArm = (pts, col, wid = 58) => { if (rim) { c.save(); c.globalAlpha = .55; c.translate(dx * .5, dy * .5); armPath(c, pts, wid); c.strokeStyle = rim; c.stroke(); c.restore(); } armPath(c, pts, wid); c.strokeStyle = col; c.stroke(); const e = pts[pts.length - 1]; c.beginPath(); c.arc(e[0], e[1], 26, 0, TAU); c.fillStyle = col; c.fill(); };
  if (o.farArm) strokeArm(o.farArm, '#0c0d12');
  if (!o.noBody) rimFill(c, bodyPath, base, rim, dx, dy, o.halo ?? .4);
  c.save(); c.translate(0, 30); c.rotate(o.nod || 0); c.translate(0, -30);
  const hp = cc => headPath(cc, o.jaw || 0);
  rimFill(c, hp, base, rim, dx, dy, o.halo ?? .4);
  if (o.face) { c.save(); hp(c); c.clip(); const f = o.face, gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, f.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = f.a; c.fillStyle = gr; c.fillRect(-120, -200, 260, 280); c.restore(); }
  // hair
  c.save(); hairPath(c); c.fillStyle = '#07080b'; c.fill(); if (rim) { c.clip(); c.translate(-dx * 1.2, -dy * 1.2); hairPath(c); c.globalCompositeOperation = 'destination-out'; c.fill(); } c.restore();
  if (rim) { c.save(); hairPath(c); c.clip(); c.globalCompositeOperation = 'source-atop'; c.restore(); }
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

// ———————————————————————————— scenes: each has world (w) and UI (ui)
const DESK = 1360;
const SH = {
  night: {
    w(lt, D, t) {
      g.fillStyle = '#04060c'; g.fillRect(0, 0, W, H);
      layer(10, () => {
        G.fillStyle = vgrad(0, H, [[0, '#070b18'], [1, '#03040a']]); G.fillRect(0, 0, W, H);
        // window with night city
        G.fillStyle = vgrad(240, 900, [[0, '#0d1a3a'], [1, '#1a2850']]); G.fillRect(600, 220, 420, 700);
        bokeh(26, 3, 610, 560, 1010, 900, ['#ffb347', '#ff7a3a', '#9cc8ff', '#ffd27a'], 8, 22, .8, t, 4);
        G.fillStyle = '#05070d'; G.fillRect(800, 220, 16, 700); G.fillRect(600, 560, 420, 14); G.lineWidth = 22; G.strokeStyle = '#05070d'; G.strokeRect(600, 220, 420, 700);
        glow(820, 520, 520, 'rgba(70,110,200,.35)', .8);
        // wall clock
        rr(110, 380, 330, 150, 24); G.fillStyle = '#0a0b10'; G.fill(); G.lineWidth = 4; G.strokeStyle = '#1b1d26'; G.stroke();
        G.save(); G.font = '500 120px Oswald'; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillStyle = '#ff2a3a'; G.shadowColor = '#ff2030'; G.shadowBlur = 40; const blink = Math.floor(t * 2) % 2; G.fillText(blink ? '03:00' : '03 00', 275, 460); G.restore();
        glow(275, 455, 360, 'rgba(255,40,60,.35)', .9);
      });
      const push = 1 + .05 * eio(lt / D);
      g.save(); g.translate(W / 2, H * .55); g.scale(push, push); g.translate(-W / 2, -H * .55);
      // phone light on the scene
      const ph = [790, 930];
      const hands = guy({ x: 420, y: 820, s: 2.25, nod: .16 + Math.sin(lt * .8) * .02, eye: .55 + .1 * Math.sin(lt * .5), red: 1, bags: .6, rim: '#5f8dff', rdx: -5, rdy: -2, face: { x: 120, y: -60, r: 190, col: 'rgba(170,205,255,.85)', a: .9 }, arms: [[[-40, 140], [40, 260], [160, 52]]] });
      phone(hands[0][0] + 14, hands[0][1] - 56, -.35);
      glow(hands[0][0] + 10, hands[0][1] - 60, 520, 'rgba(140,190,255,.55)', .9);
      // desk
      g.fillStyle = vgrad(DESK, H, [[0, '#14161e'], [1, '#050608']]); g.fillRect(0, DESK, W, H - DESK); g.fillStyle = 'rgba(140,180,255,.2)'; g.fillRect(0, DESK, W, 3);
      for (const [x, h] of [[150, 150], [230, 150], [930, 150]]) { rr(x - 34, DESK - h + 8, 68, h, 10); g.fillStyle = '#16181f'; g.fill(); g.fillStyle = 'rgba(255,60,80,.6)'; g.fillRect(x - 34, DESK - h + 50, 68, 20); }
      G = g; dust(40, 9, 500, 600, 1000, 1200, t, '#bcd6ff', .5);
      g.restore();
      grade('#1a2a6a', .35);
    },
    ui(lt, D) { title('НЕ СПАТЬ', 1120, seg(lt, .4, 1.1), 150); title('3 ДНЯ', 1260, seg(lt, .8, 1.5), 130, { fill: '#ff4058', glow: 'rgba(255,40,70,.8)' }); },
  },
  work: {
    w(lt, D, t) {
      layer(14, () => {
        G.fillStyle = vgrad(0, H, [[0, '#9fb2c2'], [1, '#4a5662']]); G.fillRect(0, 0, W, H);
        for (let i = 0; i < 4; i++) { G.fillStyle = 'rgba(235,245,255,.9)'; G.fillRect(-40 + i * 300, 160, 230, 900); }
        bokeh(14, 40, 0, 300, W, 1100, ['#ffffff', '#e8f4ff'], 30, 70, .35);
        G.fillStyle = 'rgba(40,50,60,.7)'; G.fillRect(0, 1100, W, 300); for (let i = 0; i < 5; i++) { rr(60 + i * 220, 980, 170, 110, 10); G.fillStyle = '#2c3540'; G.fill(); }
      });
      glow(150, 500, 900, 'rgba(255,255,255,.35)', .7);
      const yawn = Math.max(eio(seg(lt, .3, 1.1)) * (1 - eio(seg(lt, 1.9, 2.6))), 0), irr = seg(lt, word('work', 'всё раздражает'), word('work', 'всё раздражает') + .3);
      const hands = guy({ x: 430, y: 820, s: 2.3, nod: -.14 * yawn + .05, jaw: 26 * yawn, eye: lerp(.5, .05, yawn), red: .6, bags: .5, rim: '#e8f2ff', rdx: -6, rdy: -3, halo: .3, brow: irr * 6,
        face: { x: -60, y: -80, r: 220, col: 'rgba(200,215,230,.35)', a: 1 }, arms: [[[-40, 140], [20, 300], [150, 236]]] });
      mug(hands[0][0] + 30, hands[0][1] - 10, 1.3); steam(hands[0][0] + 30, hands[0][1] - 100, t);
      // monitor (foreground right, slightly soft)
      layer(5, () => { rr(760, 980, 380, 300, 14); G.fillStyle = '#0d1014'; G.fill(); rr(774, 994, 352, 272, 8); G.fillStyle = '#5c7a96'; G.fill(); for (let i = 0; i < 6; i++) { G.fillStyle = 'rgba(255,255,255,.4)'; G.fillRect(800, 1020 + i * 36, 120 + hash(i) * 180, 14); } G.fillStyle = '#0d1014'; G.fillRect(930, 1280, 30, 80); });
      g.fillStyle = vgrad(DESK, H, [[0, '#3a3a40'], [1, '#101114']]); g.fillRect(0, DESK, W, H - DESK); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, DESK, W, 3);
      if (irr > 0) for (let i = 0; i < 3; i++) { const p = seg(lt, word('work', 'всё раздражает') + i * .25, word('work', 'всё раздражает') + i * .25 + .3); if (p <= 0) continue; g.save(); g.translate(840 + i * 70 - 60, 900 - i * 90); g.scale(back(p), back(p)); g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fillStyle = '#ff3048'; g.shadowColor = '#ff3048'; g.shadowBlur = 20; g.fill(); g.shadowBlur = 0; g.font = '500 48px Oswald'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 3); g.restore(); }
      grade('#2a5a70', .3);
    },
    ui(lt, D) {
      const ta = word('work', 'алкоголя') - .2, tv = word('work', 'Внимание');
      title('24 ЧАСА', 250, seg(lt, .2, .8), 140); title('БЕЗ СНА', 360, seg(lt, .4, 1.0), 80, { a: .85 });
      chip('РЕАКЦИЯ КАК ПОСЛЕ АЛКОГОЛЯ', W / 2, 470, seg(lt, ta, ta + .4), 42, '#ffb347');
      if (lt > tv) { const p = seg(lt, tv, tv + .4), lv = 1 - .65 * eio(seg(lt, tv + .2, tv + 1.6)); g.save(); G = g; g.globalAlpha = eo(p); g.font = '500 38px Oswald'; g.letterSpacing = '5px'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.shadowColor = '#000'; g.shadowBlur = 12; g.fillText('ВНИМАНИЕ', 800, 1060); g.shadowBlur = 0; rr(800, 1090, 270, 22, 11); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); rr(800, 1090, 270 * lv, 22, 11); g.fillStyle = lv > .6 ? '#ffd060' : '#ff4058'; g.shadowColor = g.fillStyle; g.shadowBlur = 16; g.fill(); g.restore(); }
      hud(24, seg(lt, .2, .6));
    },
  },
  micro: {
    w(lt, D, t) {
      const td = word('micro', 'засыпать') - .1, tj = td + 1.7;
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#2a1e18'], [1, '#0c0907']]); G.fillRect(0, 0, W, H); bokeh(18, 70, 0, 200, W, 1200, ['#ffb060', '#ff8840', '#ffd8a0'], 18, 50, .45, t, 3); glow(880, 700, 700, 'rgba(255,170,80,.45)', .8); });
      const drop = lt < td ? 0 : lt < tj ? eio(seg(lt, td, td + .5)) : 1 - eo(seg(lt, tj, tj + .25));
      const jolt = lt > tj ? Math.exp(-(lt - tj) * 5) : 0;
      g.save(); g.translate(Math.sin(t * 50) * 14 * jolt, Math.cos(t * 43) * 10 * jolt);
      // desk lamp
      g.save(); g.strokeStyle = '#1a1612'; g.lineWidth = 16; g.beginPath(); g.moveTo(960, DESK); g.lineTo(940, 1000); g.lineTo(820, 900); g.stroke(); g.translate(820, 900); g.rotate(-.5); rr(-70, -40, 140, 70, 30); g.fillStyle = '#1a1612'; g.fill(); g.restore();
      glow(780, 980, 420, 'rgba(255,190,110,.7)', 1);
      guy({ x: 420, y: 840, s: 2.3, nod: .75 * drop, eye: lerp(.9, .75, drop) + jolt * .2, red: .8, bags: .7, brow: jolt * 10, rim: '#ffb766', rdx: 6, rdy: -3, face: { x: 110, y: -50, r: 210, col: 'rgba(255,190,120,.8)', a: .8 }, arms: [[[-40, 140], [60, 330], [230, 500]]] });
      g.fillStyle = vgrad(DESK, H, [[0, '#2a2018'], [1, '#0a0806']]); g.fillRect(0, DESK, W, H - DESK); g.fillStyle = 'rgba(255,200,130,.3)'; g.fillRect(0, DESK, W, 3);
      for (let i = 0; i < 3; i++) { rr(560 + i * 16, DESK - 30 - i * 26, 300, 26, 4); g.fillStyle = ['#e8e0d0', '#d8cfc0', '#efe7d8'][i]; g.fill(); }
      g.restore();
      grade('#6a3a10', .3);
      // eyelids: the microsleep blackout
      const lid = lt < td + .3 ? 0 : lt < tj ? eio(seg(lt, td + .3, td + .8)) * .9 : 1 - eo(seg(lt, tj, tj + .15));
      if (lid > 0) { g.fillStyle = '#000'; const h = H / 2 * lid; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, h); g.quadraticCurveTo(W / 2, h + 120 * lid, 0, h); g.fill(); g.beginPath(); g.moveTo(0, H); g.lineTo(W, H); g.lineTo(W, H - h); g.quadraticCurveTo(W / 2, H - h - 120 * lid, 0, H - h); g.fill(); }
      if (jolt > .02) { g.fillStyle = `rgba(255,255,255,${jolt * .35})`; g.fillRect(0, 0, W, H); }
    },
    ui(lt, D) {
      const td = word('micro', 'засыпать') - .1, tj = td + 1.7, tm = word('micro', 'микросном') - .2;
      title('ZZZ…', 300, seg(lt, td + .6, td + 1) * (1 - seg(lt, tj - .1, tj)), 90, { a: .7 });
      chip('2 СЕКУНДЫ', W / 2, 760, seg(lt, tj + .1, tj + .4) * (1 - seg(lt, tm - .2, tm)), 44, '#ffb347');
      title('МИКРОСОН', 300, seg(lt, tm, tm + .4), 140, { fill: '#ffd8a0', glow: 'rgba(255,140,40,.7)' });
      hud(30, 1);
    },
  },
  keys: {
    w(lt, D, t) {
      const tf = Math.max(1.6, D * .38);
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#1a2a2c'], [1, '#081011']]); G.fillRect(0, 0, W, H); rr(640, 300, 260, 900, 10); G.fillStyle = '#243638'; G.fill(); G.beginPath(); G.arc(870, 760, 14, 0, TAU); G.fillStyle = '#c9a050'; G.fill(); glow(300, 300, 700, 'rgba(255,200,140,.35)', .8); for (let i = 0; i < 3; i++) { rr(120 + i * 150, 600, 110, 160, 6); G.fillStyle = 'rgba(255,230,190,.12)'; G.fill(); } });
      const look = Math.sin(lt * 2.2) * .12 * (1 - seg(lt, tf, tf + .3));
      const hands = guy({ x: 400, y: 860, s: 2.4, nod: .35 + look, eye: .8, red: .9, bags: .8, brow: 4, rim: '#9ff0e0', rdx: 6, rdy: -3, face: { x: 120, y: -40, r: 200, col: 'rgba(255,215,170,.55)', a: .8 },
        arms: [[[-40, 140], [90, 230], [190, 120]]] });
      keys(hands[0][0] + 10, hands[0][1] - 10, t, seg(lt, tf, tf + .3) * (.6 + .4 * Math.sin(lt * 8)));
      // drawer/shelf being searched
      g.fillStyle = vgrad(DESK + 40, H, [[0, '#2a2420'], [1, '#0a0806']]); g.fillRect(0, DESK + 40, W, H); g.fillStyle = 'rgba(255,220,180,.25)'; g.fillRect(0, DESK + 40, W, 3);
      grade('#0a5a5a', .25);
    },
    ui(lt, D, t) {
      const tf = Math.max(1.6, D * .38), tw = word('keys', 'мысли');
      title('ДЕНЬ 2', 260, seg(lt, .2, .7), 140);
      for (let i = 0; i < 3; i++) { const p = seg(lt, .4 + i * .3, .7 + i * .3) * (1 - seg(lt, tf - .2, tf)); if (p > 0) title('?', 840 + (i - 1) * 90, 620 - i * 70 + Math.sin(t * 3 + i) * 10, p, 110 - i * 15, { fill: '#9ff0e0' }); }
      if (lt > tf) { const p = seg(lt, tf, tf + .4); const hx = 400 + 190 * 2.4 + 10, hy = 860 + 120 * 2.4 - 10; g.save(); g.globalAlpha = eo(p); g.strokeStyle = '#ffd060'; g.lineWidth = 7; g.shadowColor = '#ffd060'; g.shadowBlur = 18; g.beginPath(); g.ellipse(hx, hy, 140 * back(p), 110 * back(p), 0, 0, TAU); g.stroke(); g.restore(); title('ОНИ В РУКЕ!', hy - 230, p, 80, { fill: '#ffd060', x: 640 }); }
      if (lt > tw) { const p = seg(lt, tw, tw + .4), s = 'СЛ…ОВА?'; g.save(); g.globalAlpha = eo(p) * .9; g.font = '500 70px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; [...'СЛОВА… ЭТО… КАК ЕГО…'].forEach((ch, i, a) => { const x = W / 2 + (i - a.length / 2) * 40 + Math.sin(t * 7 + i * 2) * 8, y = 470 + Math.cos(t * 6 + i * 3) * 14; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 20; g.fillText(ch, x, y); }); g.restore(); }
      hud(48, seg(lt, .1, .5));
    },
  },
  halluc: {
    w(lt, D, t) {
      const th = word('halluc', 'галлюцинации') - .2, m = eio(seg(lt, th - .4, th + 1.6));
      g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
      layer(4, () => {
        G.fillStyle = vgrad(0, H, [[0, '#0b1416'], [1, '#040607']]); G.fillRect(0, 0, W, H);
        // moonlight patch on the wall
        G.save(); G.beginPath(); G.moveTo(320, 280); G.lineTo(960, 360); G.lineTo(980, 1260); G.lineTo(300, 1180); G.closePath(); G.fillStyle = 'rgba(120,170,190,.32)'; G.fill(); G.clip();
        G.fillStyle = 'rgba(0,0,0,.6)'; G.fillRect(620, 280, 20, 1000); G.fillRect(300, 720, 700, 18);
        // the shadow: coat on a hook → tall figure with long arms
        G.save(); G.filter = 'blur(6px)'; G.fillStyle = 'rgba(0,0,0,.92)'; const sx = 660 + Math.sin(t * .7) * 6, sy = 520, wob = (k) => Math.sin(t * 2.3 + k) * 6 * m;
        G.beginPath(); G.ellipse(sx, sy - 60 * m, 46 + 10 * m, 54 + 14 * m, 0, 0, TAU); G.fill();
        G.beginPath(); G.moveTo(sx - 80, sy); G.quadraticCurveTo(sx - 120 - 20 * m, sy + 300, sx - 110 + wob(1), sy + 560 + 120 * m); G.lineTo(sx + 110 + wob(2), sy + 560 + 120 * m); G.quadraticCurveTo(sx + 120 + 20 * m, sy + 300, sx + 80, sy); G.closePath(); G.fill();
        G.lineCap = 'round'; G.strokeStyle = 'rgba(0,0,0,.92)';
        for (const k of [-1, 1]) { G.lineWidth = 34 - 10 * m; G.beginPath(); G.moveTo(sx + k * 70, sy + 20); G.bezierCurveTo(sx + k * (140 + 80 * m), sy + 120 - 60 * m, sx + k * (180 + 180 * m), sy + 200 + 120 * m + wob(k * 3), sx + k * (150 + 230 * m), sy + 300 + 380 * m + wob(k * 5)); G.stroke();
          if (m > .3) for (let f = 0; f < 4; f++) { G.lineWidth = 8; G.beginPath(); const ex = sx + k * (150 + 230 * m), ey = sy + 300 + 380 * m; G.moveTo(ex, ey); G.lineTo(ex + k * (10 + f * 12) * m, ey + (50 + f * 8) * m); G.stroke(); } }
        G.restore(); G.restore();
        if (m > .6) { const e = seg(m, .6, 1) * (.7 + .3 * Math.sin(t * 9)); glow(640, 460, 50, `rgba(255,40,40,${e})`, 1); glow(684, 462, 50, `rgba(255,40,40,${e})`, 1); G.fillStyle = `rgba(255,120,120,${e})`; G.beginPath(); G.arc(640, 460, 6, 0, TAU); G.arc(684, 462, 6, 0, TAU); G.fill(); }
      });
      glow(700, 650, 800, 'rgba(90,140,160,.25)', .8);
      g.save(); const sh = m * .6; g.translate(Math.sin(t * 31) * 2 * sh, 0);
      guy({ x: 230, y: 1100, s: 2.5, nod: -.12 - .05 * m, eye: lerp(.8, 1.15, m), red: 1, bags: .9, brow: 10 * m, rim: '#7fd6e8', rdx: 6, rdy: -3, face: { x: 90, y: -60, r: 160, col: 'rgba(130,190,210,.5)', a: .8 } });
      g.restore();
      grade('#0a3a3a', .3);
      if (m > .2) { const k = Math.floor(t * 12); if (hash(k) > .8) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .12; g.drawImage(cv, 8, 0); g.restore(); } }
    },
    ui(lt, D, t) {
      const th = word('halluc', 'галлюцинации') - .2;
      title('ДЕНЬ 3', 260, seg(lt, .2, .7), 140);
      const p = seg(lt, th, th + .4); title('ГАЛЛЮЦИНАЦИИ', 400, p, 100, { rgb: 6 + 6 * Math.abs(Math.sin(t * 13)), fill: '#e8fbff', x: W / 2 + (hash(Math.floor(t * 15)) > .7 ? 8 : 0) });
      hud(72, seg(lt, .1, .5));
    },
  },
  record: {
    w(lt, D, t) {
      g.fillStyle = '#0e0b08'; g.fillRect(0, 0, W, H);
      layer(10, () => { G.fillStyle = vgrad(0, H, [[0, '#2a2016'], [1, '#0a0806']]); G.fillRect(0, 0, W, H); glow(540, 700, 900, 'rgba(255,200,130,.3)', .9); });
      const p = eo(seg(lt, .1, .9)), z = 1 + .04 * lt / D;
      g.save(); g.translate(540, 925); g.scale(z * .96, z * .96); g.rotate(-.04 + (1 - p) * .2); g.translate(0, (1 - p) * 300); g.globalAlpha = clamp(p * 2);
      g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 50; g.shadowOffsetY = 20; g.fillStyle = '#efe6d2'; g.fillRect(-380, -470, 760, 940); g.shadowColor = 'transparent';
      g.save(); g.beginPath(); g.rect(-340, -430, 680, 740); g.clip();
      G = g; g.fillStyle = vgrad(-430, 310, [[0, '#8a7a62'], [1, '#3a3024']]); g.fillRect(-340, -430, 680, 740);
      // the kid at a desk with a tally calendar (sepia)
      rr(60, -330, 230, 280, 6); g.fillStyle = '#d8ccb0'; g.fill(); g.font = '500 30px Oswald'; g.fillStyle = '#3a3024'; g.textAlign = 'center'; g.fillText('1964', 175, -290);
      const n = Math.min(11, Math.floor(seg(lt, word('record', 'одиннадцать') - .2, word('record', 'одиннадцать') + 1.2) * 11.99)); g.strokeStyle = '#3a2a1c'; g.lineWidth = 6; g.lineCap = 'round';
      for (let i = 0; i < n; i++) { const gx = 90 + (i % 5) * 34 + Math.floor(i / 5) * 0, gy = -230 + Math.floor(i / 5) * 80; if (i % 5 === 4) { g.beginPath(); g.moveTo(gx - 140, gy + 50); g.lineTo(gx + 10, gy + 4); g.stroke(); } else { g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 4, gy + 54); g.stroke(); } }
      guy({ x: -120, y: -40, s: 1.25, nod: .05, eye: .9, base: '#2a2219', rim: '#c8b08a', rdx: -4, rdy: -2, halo: 0, eyeA: .6, face: { x: 60, y: -60, r: 160, col: 'rgba(210,190,150,.5)', a: 1 }, arms: [[[-40, 140], [40, 250], [150, 210]]] });
      g.fillStyle = '#2a2219'; g.fillRect(-340, 230, 680, 80);
      g.restore();
      // sepia wash + scratches
      g.save(); g.globalCompositeOperation = 'color'; g.fillStyle = '#a08060'; g.globalAlpha = .6; g.fillRect(-340, -430, 680, 740); g.restore();
      g.save(); g.globalAlpha = .35; g.strokeStyle = '#fff'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const x = -340 + hash(Math.floor(t * 8) + i) * 680; g.beginPath(); g.moveTo(x, -430); g.lineTo(x + 6, 310); g.stroke(); } g.restore();
      g.font = '500 70px Oswald'; g.fillStyle = '#2a2016'; g.textAlign = 'center'; g.letterSpacing = '6px'; g.fillText('1964 — 11 ДНЕЙ', 0, 400);
      g.restore();
      grade('#5a3a10', .35);
    },
    ui(lt, D, t) {
      const t11 = word('record', 'одиннадцать') - .2, ts = word('record', 'Сегодня');
      const n = Math.min(11, Math.floor(seg(lt, t11, t11 + 1.2) * 11.99));
      title('РЕКОРД', 180, seg(lt, .2, .7), 100, { fill: '#ffd8a0' });
      if (lt > t11) title(`${n} ${n === 1 ? 'ДЕНЬ' : n < 5 ? 'ДНЯ' : 'ДНЕЙ'}`, 300, seg(lt, t11, t11 + .3), 120, { fill: '#fff' });
      if (lt > ts) { const p = seg(lt, ts, ts + .25); g.save(); g.translate(560, 1090); g.rotate(-.18); const k = 1 + 1.4 * (1 - eo(p)); g.scale(k, k); g.globalAlpha = eo(p) * .92; g.strokeStyle = '#e8202c'; g.lineWidth = 12; g.strokeRect(-280, -80, 560, 160); g.font = '500 120px Oswald'; g.letterSpacing = '14px'; g.fillStyle = '#e8202c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ОПАСНО', 0, 6); g.restore();
        chip('РЕКОРДЫ БОЛЬШЕ НЕ РЕГИСТРИРУЮТ', W / 2, 420, seg(lt, ts + .4, ts + .8), 38, '#ff4058'); }
    },
  },
  sleep: {
    w(lt, D, t) {
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#18223a'], [1, '#0a0e18']]); G.fillRect(0, 0, W, H); G.fillStyle = vgrad(200, 900, [[0, '#ffd9a8'], [1, '#ffb889']]); G.fillRect(700, 200, 300, 700); G.fillStyle = '#18223a'; G.fillRect(840, 200, 14, 700); G.fillRect(700, 540, 300, 12); glow(850, 550, 700, 'rgba(255,200,150,.55)', 1); });
      // light beam
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .18; g.fillStyle = vgrad(300, 1500, [[0, '#ffd9a8'], [1, 'rgba(255,217,168,0)']]); g.beginPath(); g.moveTo(700, 220); g.lineTo(1000, 220); g.lineTo(560, 1500); g.lineTo(80, 1500); g.closePath(); g.fill(); g.restore();
      G = g; dust(50, 3, 150, 400, 1000, 1500, t, '#ffe2b8', .6);
      // bed
      rr(40, 1200, 1000, 260, 40); g.fillStyle = '#2a3048'; g.fill(); rr(60, 1100, 300, 140, 60); g.fillStyle = '#d8d4cc'; g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; rr(60, 1180, 300, 60, 40); g.fill();
      const br = Math.sin(lt * 1.4) * .012;
      guy({ x: 250, y: 1150, s: 1.9, rot: -Math.PI / 2 + br, nod: .05, eye: 0, base: '#1c2030', rim: '#ffc890', rdx: 5, rdy: -2, halo: .3, face: { x: 80, y: -60, r: 200, col: 'rgba(255,200,150,.6)', a: .8 }, noBody: true });
      // blanket over the body
      g.beginPath(); g.moveTo(330, 1100 - 10 * Math.sin(lt * 1.4)); g.bezierCurveTo(600, 1050 - 12 * Math.sin(lt * 1.4), 900, 1080, 1040, 1150); g.lineTo(1040, 1420); g.lineTo(300, 1420); g.closePath(); g.fillStyle = vgrad(1050, 1420, [[0, '#6a7aa8'], [1, '#2a3050']]); g.fill();
      g.save(); g.globalAlpha = .3; g.strokeStyle = '#ffd9a8'; g.lineWidth = 4; g.beginPath(); g.moveTo(330, 1100); g.bezierCurveTo(600, 1050, 900, 1080, 1040, 1150); g.stroke(); g.restore();
      grade('#3a2a6a', .25);
    },
    ui(lt, D, t) {
      const tc = word('sleep', 'очищается') - .2, p = seg(lt, tc - .3, tc + .4);
      G = g; brain(330, 780, 1.3, t, eo(p));
      if (p > 0) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { const u = ((t * .35 + hash(i)) % 1), a = hash(i + 7) * TAU; const x = 330 + Math.cos(a) * 150 * (1 - u) + u * 260, y = 760 + Math.sin(a) * 90 * (1 - u) - u * 260; g.globalAlpha = eo(p) * (1 - u) * .9; g.fillStyle = i % 3 ? '#8fe6ff' : '#ffffff'; g.beginPath(); g.arc(x, y, 3 + 4 * (1 - u), 0, TAU); g.fill(); } g.restore(); }
      title('Z', 560 + Math.sin(t) * 10, seg(lt, .3, .8), 60, { x: 400, a: .7 }); title('z', 500 + Math.sin(t + 1) * 10, seg(lt, .6, 1.1), 44, { x: 450, a: .6 });
      title('МОЗГ ОЧИЩАЕТСЯ', 300, seg(lt, tc, tc + .4), 96, { fill: '#c8f4ff', glow: 'rgba(80,200,255,.7)' });
    },
  },
  sub: {
    w(lt, D, t) {
      layer(10, () => { G.fillStyle = vgrad(0, H, [[0, '#ffcf8a'], [1, '#c87a50']]); G.fillRect(0, 0, W, H); glow(860, 420, 900, 'rgba(255,240,200,1)', 1); bokeh(16, 90, 400, 100, W, 900, ['#fff4d0', '#ffe0a0'], 20, 60, .5, t, 5); });
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(860, 420); for (let i = 0; i < 12; i++) { g.rotate(TAU / 12 + Math.sin(t * .2) * .002); g.globalAlpha = .07 + .05 * Math.sin(t + i); g.fillStyle = '#fff4d0'; g.beginPath(); g.moveTo(0, 0); g.lineTo(1800, -70); g.lineTo(1800, 70); g.closePath(); g.fill(); } g.restore();
      G = g; dust(40, 5, 0, 300, W, 1500, t, '#fff', .6);
      const st = eio(seg(lt, .2, 1.2)) * (1 - .3 * eio(seg(lt, D - 1.5, D)));
      rr(-40, 1300, 1160, 300, 40); g.fillStyle = '#7a5a6a'; g.fill();
      guy({ x: 360, y: 900, s: 2.2, nod: -.25 * st, eye: lerp(.2, 1, seg(lt, .4, 1)), jaw: 14 * st * (1 - seg(lt, 1.4, 2)), base: '#2a1e1e', rim: '#fff0c8', rdx: 6, rdy: -3, halo: .5, face: { x: 100, y: -80, r: 220, col: 'rgba(255,220,170,.85)', a: .9 }, });
      rr(-40, 1360, 1160, 400, 40); g.fillStyle = vgrad(1360, 1700, [[0, '#e8d8c8'], [1, '#a08878']]); g.fill();
      grade('#ff9a40', .2);
    },
    ui(lt, D, t) {
      const ts = word('sub', 'подписывайтесь') - .2, tc = ts + 1.1;
      title('ФАКТЫ', 220, seg(lt, .4, .9), 150, { glow: 'rgba(160,60,0,.7)' }); title('ЗА МИНУТУ', 350, seg(lt, .6, 1.1), 90, { glow: 'rgba(160,60,0,.7)' });
      const bp = seg(lt, ts, ts + .4), done = lt > tc; if (bp > 0) { g.save(); g.translate(W / 2, 1220); const k = back(bp) * (lt > tc ? 1 - .06 * Math.exp(-(lt - tc) * 10) : 1); g.scale(k, k); g.beginPath(); g.roundRect(-300, -80, 600, 160, 80); g.fillStyle = done ? '#3a3a40' : '#ff1f2e'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0; g.font = '500 66px Oswald'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4); g.restore(); }
      if (bp > .5) { const u = eio(seg(lt, ts + .4, tc)); g.save(); g.translate(lerp(960, 640, u), lerp(1500, 1250, u)); g.beginPath(); [[0, 0], [0, 64], [16, 50], [28, 76], [40, 70], [28, 46], [48, 44]].forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.restore(); }
    },
  },
};

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('три дня', '3 дня').replace('одиннадцать дней', '11 дней').replace('в тысяча девятьсот шестьдесят четвёртом году', 'в 1964 году');
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
  add('tick', at('night', 0), { d: dur('night') }); add('hit', at('night', .8), { v: .7 });
  add('room', at('work', 0), { d: dur('work') }); add('yawn', at('work', .3)); add('hit', w('work', 'алкоголя') - .2, { v: .5 }); add('ping', w('work', 'всё раздражает')); add('ping', w('work', 'всё раздражает') + .25); add('ping', w('work', 'всё раздражает') + .5);
  const td = word('micro', 'засыпать') - .1; add('drone', at('micro', 0), { d: dur('micro') }); add('down', at('micro', td + .2), { d: 1.4 }); add('jolt', at('micro', td + 1.7)); add('hit', w('micro', 'микросном') - .2, { v: .6 });
  add('tick', at('keys', 0), { d: dur('keys') }); add('jingle', at('keys', Math.max(1.6, dur('keys') * .38))); add('glitch', w('keys', 'мысли'), { d: 1.6 });
  add('drone', at('halluc', 0), { d: dur('halluc'), dark: 1 }); add('creep', w('halluc', 'галлюцинации') - .6, { d: 2.4 }); add('glitch', w('halluc', 'галлюцинации') - .2, { d: .8 });
  add('shutter', at('record', .15)); add('tally', w('record', 'одиннадцать') - .2, { d: 1.2 }); add('stamp', w('record', 'Сегодня'));
  add('calm', at('sleep', 0), { d: dur('sleep') }); add('shimmer', w('sleep', 'очищается') - .4, { d: 2.5 });
  add('birds', at('sub', 0), { d: dur('sub') }); add('swell', at('sub', 0), { d: dur('sub') }); add('click', w('sub', 'подписывайтесь') + .9); add('chime', w('sub', 'подписывайтесь') + .95);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'ДНЯ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
