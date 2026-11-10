// «Клеопатра жила ближе к iPhone, чем к пирамидам» — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['hook', 'Вы не поверите, но Клеопатра жила ближе к появлению айфона, чем к строительству египетских пирамид!'],
  ['pyramid', 'Великая пирамида Хеопса была построена примерно четыре с половиной тысячи лет назад.'],
  ['born', 'А Клеопатра родилась только в шестьдесят девятом году до нашей эры!'],
  ['twist', 'Но самое удивительное впереди! Клеопатра умерла в тридцатом году до нашей эры.'],
  ['iphone', 'Первый айфон появился в две тысячи седьмом году. Между ними прошло около двух тысяч лет!'],
  ['climax', 'Получается, для Клеопатры египетские пирамиды были ещё более древней историей, чем для нас сама Клеопатра!'],
  ['sub', 'А вы знали об этом? Подписывайтесь! Здесь каждый день факты, которые взрывают мозг!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.05,5.60],[6.17,10.69],[11.18,15.00],[15.53,20.88],[21.40,26.83],[27.34,33.63],[34.05,39.45]];
const PH = [[0.05,1.02,'Вы не поверите,'],[1.10,3.08,'но Клеопатра жила ближе к появлению iPhone,'],[3.17,5.60,'чем к строительству египетских пирамид!'],[6.17,10.69,'Великая пирамида Хеопса была построена примерно 4\u00a0500 лет назад.'],
  [11.18,15.00,'А Клеопатра родилась только в 69 году до нашей эры!'],[15.53,17.26,'Но самое удивительное впереди!'],[17.80,20.88,'Клеопатра умерла в 30 году до нашей эры.'],[21.40,24.05,'Первый iPhone появился в 2007 году.'],[24.43,26.83,'Между ними прошло около 2\u00a0000 лет!'],
  [27.34,31.73,'Получается, для Клеопатры египетские пирамиды были ещё более древней историей,'],[31.95,33.63,'чем для нас сама Клеопатра!'],[34.05,35.02,'А вы знали об этом?'],[35.49,36.30,'Подписывайтесь!'],[36.48,39.45,'Здесь каждый день факты, которые взрывают мозг!']];
const WORDS = { 'hook|ближе': 2.1, 'pyramid|четыре': 8.9, 'born|шестьдесят': 13.0, 'twist|умерла': 18.5, 'twist|тридцатом': 19.2, 'iphone|две тысячи седьмом': 22.9, 'iphone|Между': 24.43, 'climax|пирамиды': 29.2, 'climax|чем для нас': 31.95, 'sub|Подписывайтесь': 35.49, 'sub|взрывают': 38.3 };
const VOICE_OFFSET = 0.4, BPM = 84, BEAT = 60 / BPM;
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
function cleoHairPath(c) {
  c.beginPath(); c.moveTo(76, -100); c.bezierCurveTo(86, -166, 0, -200, -50, -166); c.bezierCurveTo(-106, -130, -102, -40, -102, 112); c.lineTo(-16, 112); c.lineTo(-22, -10); c.bezierCurveTo(-30, -50, -10, -80, 20, -92); c.lineTo(72, -84); c.closePath();
}
function cleoGold(c) {
  c.save(); c.strokeStyle = '#ffc94a'; c.fillStyle = '#ffc94a'; c.lineCap = 'round'; c.shadowColor = '#ffb020'; c.shadowBlur = 14;
  c.lineWidth = 9; c.beginPath(); c.moveTo(78, -99); c.quadraticCurveTo(0, -132, -100, -76); c.stroke();
  c.lineWidth = 6; c.beginPath(); c.moveTo(78, -100); c.quadraticCurveTo(100, -112, 94, -134); c.quadraticCurveTo(108, -128, 104, -112); c.stroke();
  c.lineWidth = 5; for (const y of [84, 98]) { c.beginPath(); c.moveTo(-100, y); c.lineTo(-18, y); c.stroke(); }
  c.beginPath(); c.arc(-8, -34, 9, 0, TAU); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#05060a'; c.lineWidth = 4; c.beginPath(); c.moveTo(48, -74); c.lineTo(26, -70); c.stroke();
  c.restore();
}
function cleoCollar(c) { c.save(); c.shadowColor = '#ffb020'; c.shadowBlur = 16; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-70 - i * 22, 62 + i * 12); c.quadraticCurveTo(0, 96 + i * 34, 62 + i * 8, 66 + i * 30); c.lineWidth = 15; c.strokeStyle = ['#ffc94a', '#2ab8c8', '#ffc94a'][i]; c.lineCap = 'round'; c.stroke(); } c.restore(); }
function bodyPath(c) { c.beginPath(); c.moveTo(-36, 30); c.bezierCurveTo(-112, 44, -156, 120, -156, 270); c.lineTo(-156, 620); c.lineTo(96, 620); c.lineTo(86, 210); c.bezierCurveTo(84, 120, 62, 70, 24, 36); c.closePath(); }
function rimFill(c, pathF, base, rim, dx, dy, halo = .45) {
  if (rim && halo > 0) { c.save(); c.shadowColor = rim; c.shadowBlur = 36; c.globalAlpha = halo; pathF(c); c.fillStyle = rim; c.fill(); c.restore(); }
  c.save(); pathF(c); c.fillStyle = rim || base; c.fill(); c.clip(); c.translate(-dx, -dy); pathF(c); c.fillStyle = base; c.fill(); c.restore();
}
function armPath(c, pts, w) { c.beginPath(); c.moveTo(...pts[0]); if (pts.length === 3) c.quadraticCurveTo(...pts[1], ...pts[2]); else c.lineTo(...pts[1]); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; }
// o: x,y,s, nod, jaw, eye(0 closed..1 open), red, rim, rdx,rdy, base, face {x,y,r,col,a}, arms [[p0,p1,p2], ...] (local), farArm, rot
function guy(o) {
  const c = G; c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); c.scale(o.s * (o.flip || 1), o.s);
  const HP = o.cleo ? cleoHairPath : o.girl ? girlHairPath : hairPath, base = o.base || '#12141b', rim = o.rim, dx = o.rdx ?? 5, dy = o.rdy ?? -2;
  const strokeArm = (pts, col, wid = 58) => { if (rim) { c.save(); c.globalAlpha = .55; c.translate(dx * .5, dy * .5); armPath(c, pts, wid); c.strokeStyle = rim; c.stroke(); c.restore(); } armPath(c, pts, wid); c.strokeStyle = col; c.stroke(); const e = pts[pts.length - 1]; c.beginPath(); c.arc(e[0], e[1], 26, 0, TAU); c.fillStyle = col; c.fill(); };
  if (o.farArm) strokeArm(o.farArm, '#0c0d12');
  if (!o.noBody) rimFill(c, bodyPath, base, rim, dx, dy, o.halo ?? .4); if (o.cleo) cleoCollar(c);
  c.save(); c.translate(0, 30); c.rotate(o.nod || 0); c.translate(0, -30);
  const hp = cc => headPath(cc, o.jaw || 0);
  rimFill(c, hp, base, rim, dx, dy, o.halo ?? .4);
  if (o.face) { c.save(); hp(c); c.clip(); const f = o.face, gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, f.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = f.a; c.fillStyle = gr; c.fillRect(-120, -200, 260, 280); c.restore(); }
  // hair
  c.save(); HP(c); c.fillStyle = o.hairCol || '#07080b'; c.fill(); if (rim && !o.hairCol) { c.clip(); c.translate(-dx * 1.2, -dy * 1.2); HP(c); c.globalCompositeOperation = 'destination-out'; c.fill(); } c.restore();
  if (rim) { c.save(); HP(c); c.clip(); c.globalCompositeOperation = 'source-atop'; c.restore(); }
  if (o.cleo) cleoGold(c);
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

// ———————————————————————————— déjà vu kit
function cafeBG(t) {
  layer(13, () => {
    G.fillStyle = vgrad(0, H, [[0, '#3a2416'], [1, '#140b06']]); G.fillRect(0, 0, W, H);
    G.fillStyle = vgrad(260, 1000, [[0, '#9fd0d8'], [1, '#e8d8b8']]); G.fillRect(-40, 260, 380, 760); G.fillStyle = '#1a0f08'; G.fillRect(150, 260, 14, 760); G.fillRect(-40, 620, 380, 12);
    glow(160, 640, 700, 'rgba(180,220,230,.35)', 1);
    for (let i = 0; i < 3; i++) { const x = 520 + i * 230, y = 420 + (i % 2) * 70; G.fillStyle = '#0a0604'; G.fillRect(x - 3, 0, 6, y - 40); G.beginPath(); G.moveTo(x - 60, y); G.quadraticCurveTo(x, y - 90, x + 60, y); G.closePath(); G.fill(); glow(x, y + 20, 260, 'rgba(255,190,110,.85)', 1); }
    for (let r = 0; r < 2; r++) { G.fillStyle = '#1a0f08'; G.fillRect(440, 760 + r * 150, 700, 14); for (let i = 0; i < 9; i++) { rr(460 + i * 72, 680 + r * 150 + hash(i + r * 9) * 20, 34, 80 - hash(i + r * 9) * 20, 8); G.fillStyle = ['#c87a40', '#6a9a70', '#d8b060', '#a04a3a'][(i + r) % 4]; G.fill(); } }
    G.fillStyle = '#20120a'; G.fillRect(380, 1080, 800, 300);
    bokeh(12, 51, 380, 300, W, 1000, ['#ffb060', '#ffd8a0'], 14, 40, .35, t, 3);
  });
}
function cafeGuy(lt, o = {}) { return guy({ x: 430, y: 900, s: 2.2, base: '#17120e', rim: '#ffc078', rdx: 6, rdy: -3, halo: .35, face: { x: -70, y: -80, r: 230, col: 'rgba(190,225,235,.45)', a: 1 }, ...o }); }
function cafeTable() { g.fillStyle = vgrad(1380, H, [[0, '#4a2c18'], [1, '#120a05']]); g.fillRect(0, 1380, W, H - 1380); g.fillStyle = 'rgba(255,210,150,.3)'; g.fillRect(0, 1380, W, 3); G = g; mug(820, 1380, 1.2, '#e8e0d4'); steam(820, 1300, performance.now ? 0 : 0, .0); }
function person(x, y, s, lit, t, k) {
  const c = G, col = lit ? '#ffd08a' : null; c.save(); c.translate(x, y); c.scale(s, s);
  if (lit) { c.shadowColor = col; c.shadowBlur = 50; }
  c.fillStyle = lit ? '#2a1c10' : '#0c0d12'; c.beginPath(); c.arc(0, -210, 42, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-70, 60); c.quadraticCurveTo(-78, -150, 0, -160); c.quadraticCurveTo(78, -150, 70, 60); c.closePath(); c.fill(); c.shadowBlur = 0;
  if (lit) { c.lineWidth = 5; c.strokeStyle = col; c.globalAlpha = .9; c.beginPath(); c.arc(0, -210, 42, -2.4, .3); c.stroke(); c.beginPath(); c.moveTo(0, -160); c.quadraticCurveTo(78, -150, 70, 60); c.stroke(); }
  c.restore();
}

// ———————————————————————————— Egypt kit
const GOLD = '#ffc94a';
function palaceBG(t, tint = 0) {
  layer(12, () => {
    G.fillStyle = vgrad(0, H, [[0, '#3a2208'], [1, '#0e0703']]); G.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) { const x = 60 + i * 330; G.fillStyle = vgrad(0, 1300, [[0, '#6a4a1c'], [1, '#2a1a08']]); G.fillRect(x, 200, 120, 1200); G.fillStyle = '#8a6426'; G.fillRect(x - 24, 170, 168, 50); G.fillRect(x - 14, 220, 148, 24); for (let k = 0; k < 9; k++) { G.fillStyle = 'rgba(20,10,0,.35)'; G.fillRect(x + 20 + (k % 3) * 30, 320 + k * 90, 22, 44); } }
    for (const x of [230, 900]) { const f = .8 + .2 * Math.sin(t * 9 + x) + .1 * Math.sin(t * 23 + x); glow(x, 620, 420 * f, 'rgba(255,170,60,.9)', .9); glow(x, 600, 90, 'rgba(255,240,200,1)', 1); }
    bokeh(14, 61, 0, 300, W, 1200, ['#ffb040', '#ffd890'], 10, 30, .4, t, 3);
  });
  if (tint) grade('#8a1a10', tint);
}
function pyramid(x, by, w, h, lit = '#e8a850', dark = '#7a4a22') {
  const c = G; c.beginPath(); c.moveTo(x - w / 2, by); c.lineTo(x, by - h); c.lineTo(x + w * .18, by); c.closePath(); c.fillStyle = lit; c.fill();
  c.beginPath(); c.moveTo(x + w * .18, by); c.lineTo(x, by - h); c.lineTo(x + w / 2, by); c.closePath(); c.fillStyle = dark; c.fill();
  c.save(); c.beginPath(); c.moveTo(x - w / 2, by); c.lineTo(x, by - h); c.lineTo(x + w / 2, by); c.closePath(); c.clip(); c.strokeStyle = 'rgba(40,20,5,.22)'; c.lineWidth = 2; for (let y = by; y > by - h; y -= h / 26) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.stroke(); } c.restore();
}
function desert(t, o = {}) {
  const c = G; c.fillStyle = vgrad(0, 1300, [[0, '#1a1238'], [.45, '#8a3a50'], [.8, '#ff9a40'], [1, '#ffd890']]); c.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.7 * hash(i + 2) * (.6 + .4 * Math.sin(t * 2 + i))})`; c.fillRect(hash(i) * W, hash(i + 1) * 520, 3, 3); }
  glow(o.sx ?? 760, 1120, 620, 'rgba(255,220,150,.95)', 1); c.beginPath(); c.arc(o.sx ?? 760, 1120, 130, 0, TAU); c.fillStyle = '#fff4d0'; c.fill();
  pyramid(820, 1260, 520, 330, '#c88a44', '#5a3418'); pyramid(250, 1270, 420, 270, '#c88a44', '#5a3418'); pyramid(520, 1290, 900, 600);
  c.fillStyle = vgrad(1260, H, [[0, '#c8843c'], [1, '#3a2010']]); c.beginPath(); c.moveTo(0, 1290); c.bezierCurveTo(300, 1250, 700, 1330, W, 1280); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
}
const cleo = (o) => guy({ cleo: true, hairCol: '#0b0a10', base: '#20140a', rim: '#ffc060', rdx: 6, rdy: -3, halo: .4, face: { x: 110, y: -70, r: 210, col: 'rgba(255,200,130,.8)', a: .9 }, eye: .85, ...o });
function smartphone(x, y, s, a = 1, rot = 0) {
  const c = G; c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = a;
  c.shadowColor = 'rgba(140,200,255,.9)'; c.shadowBlur = 70; rr(-150, -300, 300, 600, 44); c.fillStyle = '#0c0d12'; c.fill(); c.shadowBlur = 0;
  rr(-136, -286, 272, 572, 34); const gr = c.createLinearGradient(0, -286, 0, 286); gr.addColorStop(0, '#2a3a7a'); gr.addColorStop(1, '#0e1430'); c.fillStyle = gr; c.fill();
  const cols = ['#4cd964', '#ffcc00', '#ff5e57', '#5ac8fa', '#ff9500', '#af52de', '#34c759', '#ff2d55', '#007aff', '#ffd60a', '#64d2ff', '#ff6b6b'];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { if (r === 3 && k > 3) continue; rr(-118 + k * 62, -230 + r * 76, 48, 48, 12); c.fillStyle = cols[(r * 4 + k) % 12]; c.fill(); }
  rr(-124, 196, 248, 70, 22); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill(); for (let k = 0; k < 4; k++) { rr(-118 + k * 62, 207, 48, 48, 12); c.fillStyle = cols[(k * 5 + 2) % 12]; c.fill(); }
  c.beginPath(); c.arc(0, 286 + 0, 0, 0, TAU); c.restore();
}
// the timeline: pyramids (−2560) … Cleopatra (−69…−30) … first iPhone (2007). a, b = how much of each span is drawn
function timeline(y, p, a, b, o = {}) {
  if (p <= 0) return; const c = g, x0 = 110, x1 = 970, X = yr => x0 + (yr + 2560) / 4567 * (x1 - x0), xc = X(-50);
  c.save(); c.globalAlpha = eo(p); c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 8; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  if (a > 0) { c.strokeStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 20; c.lineWidth = 14; c.beginPath(); c.moveTo(x0, y); c.lineTo(lerp(x0, xc, a), y); c.stroke(); }
  if (b > 0) { c.strokeStyle = '#5ad8ff'; c.shadowColor = '#5ad8ff'; c.shadowBlur = 20; c.lineWidth = 14; c.beginPath(); c.moveTo(xc, y); c.lineTo(lerp(xc, x1, b), y); c.stroke(); }
  c.shadowBlur = 0;
  // marks
  c.fillStyle = GOLD; c.beginPath(); c.moveTo(x0 - 34, y - 22); c.lineTo(x0, y - 78); c.lineTo(x0 + 34, y - 22); c.closePath(); c.fill();
  if (a >= 1 || o.cleo) { c.beginPath(); c.arc(xc, y, 22, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.arc(xc, y, 12, 0, TAU); c.fillStyle = '#ff4a6a'; c.fill(); }
  if (b >= 1 || o.phone) { c.fillStyle = '#eaf8ff'; c.beginPath(); c.roundRect(x1 - 18, y - 84, 36, 62, 8); c.fill(); c.fillStyle = '#2a3a7a'; c.fillRect(x1 - 13, y - 78, 26, 48); }
  c.font = '500 34px Oswald'; c.letterSpacing = '3px'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#000'; c.shadowBlur = 14;
  c.fillStyle = GOLD; c.fillText('ПИРАМИДЫ', x0 + 60, y + 52); if (a >= 1 || o.cleo) { c.fillStyle = '#fff'; c.fillText('КЛЕОПАТРА', xc, y + 52); } if (b >= 1 || o.phone) { c.fillStyle = '#9fe8ff'; c.fillText('iPHONE', x1 - 40, y + 52); }
  c.font = '500 46px Oswald';
  if (a > .05) { c.fillStyle = GOLD; c.fillText(o.la ?? '≈ 2 500 ЛЕТ', (x0 + xc) / 2, y - 120); }
  if (b > .05) { c.fillStyle = '#9fe8ff'; c.fillText(o.lb ?? '≈ 2 000 ЛЕТ', (xc + x1) / 2, y - 120); }
  c.restore();
}
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  hook: {
    w(lt, D, t) {
      palaceBG(t); G = g; const z = 1 + .06 * eio(lt / D); g.save(); g.translate(540, 900); g.scale(z, z); g.translate(-540, -900);
      cleo({ x: 400, y: 1120, s: 3.0, nod: -.04 + Math.sin(lt * .8) * .015, eye: lt % 3.2 > 3.05 ? .1 : .9 }); g.restore();
      dust(40, 3, 0, 300, W, 1500, t, '#ffd890', .5); grade('#8a4a10', .22);
    },
    ui(lt, D, t) {
      const tb = word('hook', 'ближе') - .2;
      title('ЭТО', 230, seg(lt, .15, .5) * (1 - seg(lt, tb - .3, tb)), 110); title('НЕВОЗМОЖНО?!', 360, seg(lt, .3, .7) * (1 - seg(lt, tb - .3, tb)), 120, { fill: GOLD, glow: 'rgba(255,140,20,.8)' });
      const p = seg(lt, tb, tb + .4); timeline(430, p, eio(seg(lt, tb + .2, tb + 1.0)), eio(seg(lt, tb + .9, tb + 1.6)), { cleo: 1, phone: 1 });
    },
  },
  pyramid: {
    w(lt, D, t) {
      const z = 1 + .22 * eio(lt / D); g.save(); g.translate(520, 1000); g.scale(z, z); g.translate(-520, -1000); G = g; desert(t); g.restore();
      G = g; dust(50, 8, 0, 900, W, 1500, t, '#ffe2b0', .5); grade('#8a4a10', .18);
    },
    ui(lt, D) {
      const ty = word('pyramid', 'четыре') - .2; title('ПИРАМИДА ХЕОПСА', 220, seg(lt, .2, .6), 84); title('2560', 370, seg(lt, .5, .9), 190, { fill: GOLD, glow: 'rgba(255,140,20,.8)' }); title('ДО НАШЕЙ ЭРЫ', 500, seg(lt, .7, 1.1), 64, { a: .9 });
      chip('≈ 4 500 ЛЕТ НАЗАД', W / 2, 620, seg(lt, ty, ty + .35), 46, GOLD);
    },
  },
  born: {
    w(lt, D, t) { palaceBG(t); G = g; cleo({ x: 330, y: 1000, s: 2.3, nod: -.03 }); dust(30, 3, 0, 300, W, 1500, t, '#ffd890', .5); grade('#8a4a10', .22); },
    ui(lt, D) {
      const tn = word('born', 'шестьдесят') - .2, n = 2491 * eio(seg(lt, tn + .2, tn + 1.6));
      title('КЛЕОПАТРА', 220, seg(lt, .2, .6), 100); title('69', 370, seg(lt, tn, tn + .35), 190, { fill: GOLD, glow: 'rgba(255,140,20,.8)' }); title('ДО НАШЕЙ ЭРЫ', 500, seg(lt, tn + .2, tn + .55), 64, { a: .9 });
      timeline(1420, seg(lt, tn + .1, tn + .5), eio(seg(lt, tn + .2, tn + 1.6)), 0, { la: `${fmt(n)} ЛЕТ` });
    },
  },
  twist: {
    w(lt, D, t) { const td = word('twist', 'умерла') - .2, k = seg(lt, td, td + 1.2); palaceBG(t, .25 * k); G = g; cleo({ x: 330, y: 1000, s: 2.3, nod: .1 * k, eye: lerp(.85, 0, eio(k)) }); dust(30, 3, 0, 300, W, 1500, t, '#ffd890', .5); grade('#8a4a10', .22); g.fillStyle = `rgba(0,0,0,${.25 * k})`; g.fillRect(0, 0, W, H); },
    ui(lt, D) {
      const td = word('twist', 'умерла') - .2, tn = word('twist', 'тридцатом') - .2;
      title('САМОЕ УДИВИТЕЛЬНОЕ', 230, seg(lt, .15, .5) * (1 - seg(lt, td - .2, td)), 84, { fill: GOLD }); title('ВПЕРЕДИ!', 350, seg(lt, .35, .7) * (1 - seg(lt, td - .2, td)), 120);
      title('30', 330, seg(lt, tn, tn + .35), 190, { fill: '#ff8a8a', glow: 'rgba(255,40,40,.7)' }); title('ДО НАШЕЙ ЭРЫ', 460, seg(lt, tn + .2, tn + .55), 64, { a: .9 });
      timeline(1420, 1, 1, 0);
    },
  },
  iphone: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#05070f'], [1, '#0a1022']]); g.fillRect(0, 0, W, H); G = g;
      bokeh(24, 17, 0, 0, W, H, ['#3a70ff', '#5ad8ff'], 10, 36, .25, t, 5);
      const up = eo(seg(lt, 0, .7)); glow(540, 900, 760, 'rgba(90,170,255,.45)', up);
      smartphone(540, 900 + (1 - up) * 500 + Math.sin(t * 1.5) * 10, 1.25, 1, Math.sin(t * .9) * .04);
      if (lt < .3) { g.fillStyle = `rgba(255,255,255,${1 - lt / .3})`; g.fillRect(0, 0, W, H); }
      grade('#1a3a9a', .2);
    },
    ui(lt, D) {
      const ty = word('iphone', 'две тысячи седьмом') - .2, tb = word('iphone', 'Между') - .1, n = 2036 * eio(seg(lt, tb + .2, tb + 1.5));
      title('ПЕРВЫЙ iPHONE', 200, seg(lt, .2, .6), 90, { sp: .06 }); title('2007', 330, seg(lt, ty, ty + .35), 170, { fill: '#9fe8ff', glow: 'rgba(60,180,255,.8)' });
      timeline(1420, seg(lt, tb, tb + .4), 1, eio(seg(lt, tb + .2, tb + 1.5)), { lb: lt < tb + 1.5 ? `${fmt(n)} ЛЕТ` : '≈ 2 000 ЛЕТ' });
    },
  },
  climax: {
    w(lt, D, t) {
      G = g; desert(t, { sx: 800 }); g.fillStyle = 'rgba(10,5,0,.35)'; g.fillRect(0, 0, W, H);
      cleo({ x: 250, y: 1150, s: 2.0, nod: -.08, rim: '#ffd890' }); dust(40, 8, 0, 800, W, 1500, t, '#ffe2b0', .5); grade('#8a4a10', .2);
    },
    ui(lt, D, t) {
      const t1 = word('climax', 'пирамиды') - .3, t2 = word('climax', 'чем для нас') - .2, tz = D + 9;
      const bar = (y, lab, yrs, frac, col, p) => { if (p <= 0) return; g.save(); g.globalAlpha = eo(p); g.font = '500 38px Oswald'; g.letterSpacing = '3px'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.shadowColor = '#000'; g.shadowBlur = 14; g.fillStyle = '#fff'; g.fillText(lab, 100, y - 44); g.textAlign = 'right'; g.fillStyle = col; g.fillText(yrs, 980, y - 44); g.shadowColor = col; g.shadowBlur = 20; g.beginPath(); g.roundRect(100, y - 16, 880 * frac * eio(p), 32, 16); g.fillStyle = col; g.fill(); g.restore(); };
      const hide = 1 - seg(lt, tz - .3, tz);
      bar(270, 'ПИРАМИДЫ → КЛЕОПАТРА', '≈ 2 500 ЛЕТ', 1, GOLD, seg(lt, t1, t1 + .8) * hide); bar(410, 'КЛЕОПАТРА → iPHONE', '≈ 2 000 ЛЕТ', .8, '#5ad8ff', seg(lt, t2, t2 + .8) * hide);
      title('ЗАДУМАЙСЯ!', 330, seg(lt, tz, tz + .4), 160, { fill: GOLD, glow: 'rgba(255,140,20,.9)' });
    },
  },
  sub: {
    w(lt, D, t) { G = g; desert(t, { sx: 800 }); g.fillStyle = 'rgba(10,5,0,.3)'; g.fillRect(0, 0, W, H); cleo({ x: 250, y: 1150, s: 2.0, nod: -.05, rim: '#ffd890' }); dust(40, 8, 0, 800, W, 1500, t, '#ffe2b0', .6); grade('#8a4a10', .2); },
    ui(lt, D, t) {
      const ts = word('sub', 'Подписывайтесь') - .1, tc = ts + 1.0, tm = word('sub', 'взрывают') - .2;
      title('ЗАДУМАЙСЯ!', 280, seg(lt, .05, .4) * (1 - seg(lt, tm - .3, tm)), 160, { fill: GOLD, glow: 'rgba(255,140,20,.9)' }); title('ФАКТЫ', 220, seg(lt, tm, tm + .4), 150, { fill: GOLD, glow: 'rgba(255,140,20,.8)' }); title('ЗА МИНУТУ', 350, seg(lt, tm + .2, tm + .6), 90);
      const bp = seg(lt, ts, ts + .4), done = lt > tc; if (bp > 0) { g.save(); g.translate(W / 2 + 120, 1000); const k = back(bp) * (lt > tc ? 1 - .06 * Math.exp(-(lt - tc) * 10) : 1); g.scale(k, k); g.beginPath(); g.roundRect(-300, -80, 600, 160, 80); g.fillStyle = done ? '#3a3a40' : '#ff1f2e'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0; g.font = '500 66px Oswald'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4); g.restore(); }
      if (bp > .5) { const u = eio(seg(lt, ts + .4, tc)); g.save(); g.translate(lerp(1000, 760, u), lerp(1300, 1030, u)); g.beginPath(); [[0, 0], [0, 64], [16, 50], [28, 76], [40, 70], [28, 46], [48, 44]].forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.restore(); }
    },
  },
};

// ———————————————————————————— subtitles: large, white, key words yellow
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('айфона', 'iPhone').replace('айфон', 'iPhone').replace('четыре с половиной тысячи', '4\u00a0500').replace('в шестьдесят девятом году', 'в 69 году').replace('в тридцатом году', 'в 30 году').replace('в две тысячи седьмом году', 'в 2007 году').replace('двух тысяч лет', '2\u00a0000 лет');
const KEYS = ['клеопатр', 'iphone', 'пирамид', 'ближе', 'удивительное', 'древней', 'подписывайтесь', 'взрывают', 'мозг', 'хеопса'];
const isKey = w => { const x = w.toLowerCase().replace(/[«»"!?,.:—]/g, ''); return /\d/.test(x) || KEYS.some(k => x.startsWith(k)); };
const SUBS = (() => { const out = VOICE && PH ? PH.map(([a, b, x]) => ({ text: x, a: a + VOICE_OFFSET - .05, b: b + VOICE_OFFSET })) : VO.map(v => ({ text: SHOW(v.text), a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .5, p.a + 1.6); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .15) * (1 - seg(t, v.b - .12, v.b));
  g.save(); g.globalAlpha = f; g.font = '600 60px Inter'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const L = wrap(v.text, 940), LH = 80, y0 = H - 250 - (L.length - 1) * LH, sp = g.measureText(' ').width;
  L.forEach((s, i) => { let x = W / 2 - g.measureText(s).width / 2; const y = y0 + i * LH; for (const w of s.split(' ')) { g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(w, x, y); g.fillStyle = isKey(w) ? '#ffe14a' : '#ffffff'; g.fillText(w, x, y); x += g.measureText(w).width + sp; } });
  g.restore();
}

// ———————————————————————————— frame
function render(t) {
  const k = sceneIdx(t), s = SC[k], lt = t - s.t0, D = s.t1 - s.t0;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; G = g;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  SH[s.name].w(lt, D, t); G = g;
  vignette(.8); { const gr = g.createLinearGradient(0, 1250, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.45, 'rgba(0,0,0,.72)'); gr.addColorStop(1, 'rgba(0,0,0,.9)'); g.fillStyle = gr; g.fillRect(0, 1250, W, H - 1250); } grain(t, .06);
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
  add('boom', at('hook', .3)); add('fire', at('hook', 0), { d: dur('hook') }); add('riser', w('hook', 'ближе') - .2, { d: 1.6 }); add('ding', w('hook', 'ближе') + 1.4);
  add('wind', at('pyramid', 0), { d: dur('pyramid') }); add('boom', at('pyramid', .5), { v: .8 }); add('pop', w('pyramid', 'четыре') - .2);
  add('fire', at('born', 0), { d: dur('born') + dur('twist') }); add('hit', w('born', 'шестьдесят') - .2); add('count', w('born', 'шестьдесят'), { d: 1.4 });
  add('riser', at('twist', 0), { d: Math.max(.6, word('twist', 'умерла') - .2) }); add('hit', w('twist', 'тридцатом') - .2, { v: .9 }); add('down', w('twist', 'умерла') - .2, { d: 1.4 });
  add('boom', at('iphone', 0)); add('whoosh', at('iphone', 0), { d: .8 }); add('ding', w('iphone', 'две тысячи седьмом') - .2); add('count', w('iphone', 'Между') + .1, { d: 1.3 }); add('chime', w('iphone', 'Между') + 1.5);
  add('wind', at('climax', 0), { d: dur('climax') + dur('sub') }); add('riser', at('climax', 0), { d: dur('climax') }); add('pop', w('climax', 'пирамиды') - .3); add('pop', w('climax', 'чем для нас') - .2);
  add('boom', at('sub', .05));
  add('swell', at('sub', 0), { d: dur('sub') }); add('click', w('sub', 'Подписывайтесь') + .9); add('chime', w('sub', 'Подписывайтесь') + .95); add('boom', w('sub', 'взрывают') - .2, { v: .7 });
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
