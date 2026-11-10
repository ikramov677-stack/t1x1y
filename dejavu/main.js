// «Что такое дежавю» — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['cafe', 'Бывало чувство, что этот момент уже был? Это не магия.'],
  ['double', 'Это дежавю. С французского — «уже виденное».'],
  ['crowd', 'Его испытывали примерно двое из трёх человек. Так что вы не одни.'],
  ['glitch', 'Учёные считают, что это короткий сбой памяти: мозг по ошибке помечает новое как знакомое.'],
  ['notice', 'И тут же сам замечает ошибку. Поэтому ощущение такое странное.'],
  ['age', 'Чаще всего дежавю бывает у молодых, а ещё при усталости и стрессе. С возрастом оно приходит реже.'],
  ['jamais', 'А есть обратный эффект. Повторите любое слово раз тридцать, и оно покажется чужим. Это жамевю!'],
  ['sub', 'Подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.05,4.18],[4.48,8.10],[8.49,12.75],[13.28,19.24],[19.55,24.03],[24.56,31.05],[31.39,38.53],[38.92,41.17]];
const PH = [[0.05,2.65,'Бывало чувство, что этот момент уже был?'],[3.25,4.18,'Это не магия.'],[4.48,5.59,'Это дежавю.'],[5.96,8.10,'С французского — «уже виденное».'],[8.49,11.28,'Его испытывали примерно 2 из 3 человек.'],[11.47,12.75,'Так что вы не одни.'],
  [13.28,16.00,'Учёные считают, что это короткий сбой памяти:'],[16.37,19.24,'мозг по ошибке помечает новое как знакомое.'],[19.55,21.58,'И тут же сам замечает ошибку.'],[21.88,24.03,'Поэтому ощущение такое странное.'],
  [24.56,28.95,'Чаще всего дежавю бывает у молодых, а ещё при усталости и стрессе.'],[29.28,31.05,'С возрастом оно приходит реже.'],[31.39,32.82,'А есть обратный эффект.'],[33.18,36.79,'Повторите любое слово раз 30, и оно покажется чужим.'],
  [37.09,38.53,'Это жамевю!'],[38.92,41.17,'Подписывайтесь на «Факты за минуту»!']];
const WORDS = { 'cafe|уже был': 2.0, 'cafe|Это не магия': 3.25, 'double|дежавю': 4.8, 'double|С французского': 5.96, 'double|уже виденное': 7.04, 'crowd|двое': 10.2, 'crowd|Так что': 11.47, 'glitch|сбой': 15.0, 'glitch|помечает': 17.6, 'glitch|знакомое': 18.6,
  'notice|замечает': 20.5, 'notice|странное': 23.4, 'age|молодых': 26.3, 'age|усталости': 27.5, 'age|стрессе': 28.4, 'age|С возрастом': 29.28, 'jamais|Повторите': 33.18, 'jamais|чужим': 36.3, 'jamais|жамевю': 37.5, 'sub|Подписывайтесь': 38.92 };
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
  c.save(); HP(c); c.fillStyle = o.hairCol || '#07080b'; c.fill(); if (rim && !o.hairCol) { c.clip(); c.translate(-dx * 1.2, -dy * 1.2); HP(c); c.globalCompositeOperation = 'destination-out'; c.fill(); } c.restore();
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

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  cafe: {
    w(lt, D, t) {
      const tf = word('cafe', 'уже был') - .3, fr = seg(lt, tf, tf + .25), walk = 1 - eo(seg(lt, 0, tf));
      cafeBG(lt < tf ? t : SCN.cafe.t0 + tf); G = g;
      const z = 1 + .08 * eio(seg(lt, tf, D)); g.save(); g.translate(540, 800); g.scale(z, z); g.translate(-540, -800);
      cafeGuy(lt, { x: 430 - 260 * walk, y: 900 + Math.abs(Math.sin(lt * 7)) * 10 * walk, eye: lerp(.9, 1.2, fr), brow: 8 * fr, nod: -.05 * fr });
      cafeTable(); g.restore();
      if (fr > 0 && fr < 1) { g.fillStyle = `rgba(255,255,255,${.35 * (1 - fr)})`; g.fillRect(0, 0, W, H); }
      grade('#6a3a10', .22); if (lt > tf) grade('#2a6a7a', .18 * fr, 'color');
    },
    ui(lt, D) { const tf = word('cafe', 'уже был') - .3, tm = word('cafe', 'Это не магия'); title('ЭТО УЖЕ', 250, seg(lt, tf, tf + .35), 120); title('БЫЛО?', 380, seg(lt, tf + .2, tf + .55), 130, { fill: '#9fe8f0', glow: 'rgba(60,200,220,.8)' }); chip('ЭТО НЕ МАГИЯ', W / 2, 520, seg(lt, tm, tm + .35), 42, '#ffd08a'); },
  },
  double: {
    w(lt, D, t) {
      cafeBG(t); G = g; cafeGuy(lt, { eye: 1.1, brow: 6 }); cafeTable();
      grade('#6a3a10', .22);
      // the frame repeats itself: ghost copies sliding in and out, like a film that skipped back
      const k = .5 + .5 * Math.sin(lt * 2.2), off = 26 + 40 * k;
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .38; g.drawImage(cv, off, -6); g.globalAlpha = .22; g.drawImage(cv, -off * 1.6, 8); g.restore();
      g.save(); g.globalAlpha = .1; g.fillStyle = '#9fe8f0'; for (let i = 0; i < 9; i++) { const y = ((t * 260 + i * 240) % (H + 200)) - 100; g.fillRect(0, y, W, 6 + hash(i) * 26); } g.restore();
      if (hash(Math.floor(t * 9)) > .82) { const y = hash(Math.floor(t * 9) + 5) * H; g.drawImage(cv, 0, y, W, 90, 40, y, W, 90); }
      grade('#2a6a7a', .2, 'color');
    },
    ui(lt, D, t) { const td = word('double', 'дежавю') - .1, tfr = word('double', 'С французского'); title('ДЕЖАВЮ', 280, seg(lt, td, td + .4), 170, { rgb: 5 + 5 * Math.abs(Math.sin(t * 5)), fill: '#eafcff' }); chip('DÉJÀ VU', W / 2, 440, seg(lt, tfr, tfr + .35), 50, '#9fe8f0'); title('«УЖЕ ВИДЕННОЕ»', 560, seg(lt, word('double', 'уже виденное') - .1, word('double', 'уже виденное') + .35), 76, { fill: '#ffd08a' }); },
  },
  crowd: {
    w(lt, D, t) {
      layer(14, () => { G.fillStyle = vgrad(0, H, [[0, '#1a2038'], [.55, '#4a3050'], [1, '#0a0a14']]); G.fillRect(0, 0, W, H); for (let i = 0; i < 7; i++) { G.fillStyle = '#0c0e1a'; const h = 500 + hash(i) * 500; G.fillRect(i * 170 - 40, 1000 - h, 150, h); } bokeh(40, 12, 0, 300, W, 1000, ['#ffb060', '#ff7090', '#70c0ff', '#ffe0a0'], 8, 26, .7, t, 2); });
      G = g; const tn = word('crowd', 'двое') - .2;
      const rows = [[1.0, 1040, [150, 420, 690, 950]], [1.25, 1200, [260, 560, 860]], [1.6, 1420, [130, 500, 880]]]; let n = 0;
      // lit: 2 of every 3 people
      rows.forEach(([s, y, xs], r) => xs.forEach((x, i) => { const idx = n++, isLit = idx % 3 !== 2, p = isLit ? seg(lt, tn + idx * .12, tn + idx * .12 + .4) : 0; person(x, y + Math.sin(t * 1.5 + idx) * 4, s, p > .5, t, idx); if (isLit && p > 0) glow(x, y - 150 * s, 200 * s, 'rgba(255,200,130,.5)', p * .8); }));
      g.fillStyle = vgrad(1500, H, [[0, 'rgba(10,10,20,0)'], [1, '#05050a']]); g.fillRect(0, 1500, W, 420);
      grade('#4a2a7a', .22);
    },
    ui(lt, D) { const tn = word('crowd', 'двое') - .2, ta = word('crowd', 'Так что'); title('2 ИЗ 3', 290, seg(lt, tn, tn + .4), 190, { fill: '#ffd08a', glow: 'rgba(255,140,40,.8)' }); title('ЧЕЛОВЕК', 440, seg(lt, tn + .3, tn + .7), 80, { a: .9 }); chip('ВЫ НЕ ОДНИ', W / 2, 580, seg(lt, ta, ta + .35), 44, '#ffd08a'); },
  },
  glitch: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#070a1a'], [1, '#020308']]); g.fillRect(0, 0, W, H); G = g;
      bokeh(30, 11, 0, 0, W, H, ['#3050ff', '#a040ff'], 10, 40, .25, t, 6);
      const cx = 540, cy = 900, ts = word('glitch', 'сбой') - .2;
      brain(cx, cy, 2.3, t, 1);
      const A = [cx - 170, cy - 60], B = [cx + 150, cy + 40];
      glow(A[0], A[1], 150, 'rgba(120,220,255,.9)', .7 + .3 * Math.sin(t * 4)); glow(B[0], B[1], 150, 'rgba(255,190,110,.9)', .7 + .3 * Math.sin(t * 4 + 2));
      // spark jumping between the two zones
      const cyc = lt > ts ? ((lt - ts) % 1.1) / 1.1 : -1;
      if (cyc >= 0 && cyc < .55) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#ffffff'; g.shadowColor = '#fff6a0'; g.shadowBlur = 30; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath(); const f = Math.floor(t * 20); for (let i = 0; i <= 8; i++) { const u = i / 8, x = lerp(A[0], B[0], u), y = lerp(A[1], B[1], u) + (i && i < 8 ? (hash(f + i) - .5) * 90 : 0); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.globalAlpha = 1 - cyc / .55; g.stroke(); g.restore(); g.fillStyle = `rgba(255,255,255,${.12 * (1 - cyc / .55)})`; g.fillRect(0, 0, W, H); }
      grade('#3a1a8a', .25);
    },
    ui(lt, D, t) {
      const ts = word('glitch', 'сбой') - .2, tn = word('glitch', 'помечает'), tk = word('glitch', 'знакомое') - .2;
      title('СБОЙ ПАМЯТИ', 260, seg(lt, ts, ts + .4), 120, { rgb: 4, fill: '#eafcff' });
      const p = seg(lt, tn - .2, tn + .2); if (p > 0) { g.save(); g.globalAlpha = eo(p); g.translate(W / 2, 1230); g.beginPath(); g.roundRect(-240, -70, 480, 140, 24); g.fillStyle = 'rgba(10,14,30,.75)'; g.fill(); g.strokeStyle = '#8fe6ff'; g.lineWidth = 4; g.stroke(); g.font = '500 76px Oswald'; g.letterSpacing = '8px'; g.fillStyle = '#eafcff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('НОВОЕ', 0, 4); g.restore(); }
      const q = seg(lt, tk, tk + .25); if (q > 0) { g.save(); g.translate(W / 2 + 30, 1370); g.rotate(-.08); const k = 1 + 1.3 * (1 - eo(q)); g.scale(k, k); g.globalAlpha = eo(q); g.strokeStyle = '#ffb347'; g.lineWidth = 9; g.strokeRect(-250, -62, 500, 124); g.font = '500 84px Oswald'; g.letterSpacing = '8px'; g.fillStyle = '#ffb347'; g.shadowColor = '#000'; g.shadowBlur = 20; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ЗНАКОМОЕ', 0, 5); g.restore(); }
    },
  },
  notice: {
    w(lt, D, t) {
      cafeBG(t); G = g;
      const rub = Math.sin(lt * 6) * 10;
      cafeGuy(lt, { nod: .14 + rub * .004, eye: .55, brow: -7 });
      cafeTable(); grade('#6a3a10', .22);
    },
    ui(lt, D, t) {
      const te = word('notice', 'замечает') - .1, ts = word('notice', 'странное') - .3;
      title('?', 300 + Math.sin(t * 3) * 10, seg(lt, .2, .6), 220, { fill: '#9fe8f0', glow: 'rgba(60,200,220,.8)', x: 660 });
      chip('МОЗГ ЗАМЕЧАЕТ ОШИБКУ', W / 2, 560, seg(lt, te, te + .35), 44, '#ffb347');
      title('СТРАННОЕ ЧУВСТВО', 1290, seg(lt, ts, ts + .4), 84, { rgb: 4, fill: '#eafcff' });
    },
  },
  age: {
    w(lt, D, t) {
      // left: tired student at night; right: calm older man with a newspaper
      const ta = word('age', 'С возрастом') - .2, sw = eio(seg(lt, ta - .3, ta + .3));
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#0a1228'], [1, '#04060e']]); G.fillRect(0, 0, W, H); glow(300, 700, 600, 'rgba(90,140,255,.4)', 1); bokeh(10, 5, 0, 200, 540, 900, ['#70a0ff'], 10, 30, .4, t, 2);
        G.fillStyle = vgrad(0, H, [[0, '#3a2414'], [1, '#120a05']]); G.fillRect(540, 0, 540, H); glow(860, 600, 560, 'rgba(255,180,100,.55)', 1); });
      G = g;
      g.save(); g.beginPath(); g.rect(0, 0, 536, H); g.clip(); g.globalAlpha = lerp(1, .45, sw);
      const yy = yw(lt, .5, 2.2);
      guy({ x: 230, y: 980, s: 1.55, nod: .3 - .2 * yy, eye: .45, red: .8, bags: .8, jaw: 16 * yy, base: '#0e1320', rim: '#6f9dff', rdx: 5, rdy: -2, face: { x: 120, y: -30, r: 200, col: 'rgba(150,190,255,.6)', a: .9 }, arms: [[[-40, 140], [60, 300], [200, 300]]] });
      for (let i = 0; i < 4; i++) { rr(330 + i * 8, 1330 - i * 34, 190, 30, 4); g.fillStyle = ['#3a5a9a', '#9a4a3a', '#d8cfc0', '#4a8a6a'][i]; g.fill(); }
      g.fillStyle = '#0a0d18'; g.fillRect(0, 1360, 540, 600); g.restore();
      g.save(); g.beginPath(); g.rect(544, 0, 540, H); g.clip(); g.globalAlpha = lerp(.5, 1, sw);
      const hands = guy({ x: 900, y: 980, s: 1.55, flip: -1, nod: .18, eye: .8, hairCol: '#b8b4ac', base: '#1a130c', rim: '#ffc078', rdx: 5, rdy: -2, face: { x: 120, y: -40, r: 200, col: 'rgba(255,210,160,.6)', a: .9 }, arms: [[[-40, 140], [60, 290], [170, 230]]] });
      g.save(); g.translate(hands[0][0] - 40, hands[0][1] - 60); g.rotate(.12); rr(-130, -110, 240, 300, 6); g.fillStyle = '#e8e0cc'; g.fill(); g.fillStyle = 'rgba(40,30,20,.6)'; g.fillRect(-110, -90, 200, 26); for (let i = 0; i < 9; i++) g.fillRect(-110, -44 + i * 24, i % 3 ? 200 : 140, 8); g.restore();
      g.fillStyle = '#1a0f08'; g.fillRect(544, 1360, 540, 600); g.restore();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(538, 0, 4, H);
      grade('#3a2a5a', .15);
    },
    ui(lt, D) {
      const tm = word('age', 'молодых') - .2, tu = word('age', 'усталости') - .1, tst = word('age', 'стрессе') - .1, ta = word('age', 'С возрастом') - .2;
      title('МОЛОДЫЕ', 240, seg(lt, tm, tm + .35), 84, { x: 270, fill: '#bcd4ff' }); title('ЧАЩЕ', 340, seg(lt, tm + .2, tm + .55), 110, { x: 270, fill: '#6f9dff', glow: 'rgba(60,110,255,.8)' });
      chip('УСТАЛОСТЬ', 270, 470, seg(lt, tu, tu + .3), 36, '#9fc0ff'); chip('СТРЕСС', 270, 560, seg(lt, tst, tst + .3), 36, '#9fc0ff');
      title('С ВОЗРАСТОМ', 240, seg(lt, ta, ta + .35), 70, { x: 812, fill: '#ffe0b8' }); title('РЕЖЕ', 340, seg(lt, ta + .2, ta + .55), 110, { x: 812, fill: '#ffb347', glow: 'rgba(255,140,40,.8)' });
    },
  },
  jamais: {
    w(lt, D, t) {
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#2a1c12'], [1, '#0c0705']]); G.fillRect(0, 0, W, H); glow(800, 400, 800, 'rgba(255,180,100,.5)', 1); });
      const tr = word('jamais', 'Повторите') - .1, tc = word('jamais', 'чужим') - .3, n = Math.floor(seg(lt, tr, tc) * 30), melt = seg(lt, tc, tc + 1.5);
      g.save(); g.translate(540, 960); g.rotate(-.05); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 60; g.shadowOffsetY = 24; g.fillStyle = '#f2ead8'; g.fillRect(-400, -540, 800, 1000); g.shadowColor = 'transparent';
      g.strokeStyle = 'rgba(90,120,170,.25)'; g.lineWidth = 2; for (let i = 0; i < 11; i++) { g.beginPath(); g.moveTo(-360, -440 + i * 86); g.lineTo(360, -440 + i * 86); g.stroke(); }
      g.font = 'italic 500 62px Inter'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1a2a5a';
      for (let i = 0; i < n; i++) { const r = Math.floor(i / 3), c = i % 3, k = melt * clamp((i + 6) / 30), x = -350 + c * 240, y = -452 + r * 86; g.save(); g.translate(x + Math.sin(t * 5 + i) * 10 * k, y + Math.cos(t * 4 + i * 2) * 8 * k); g.rotate((hash(i) - .5) * .06 + (hash(i + 4) - .5) * .5 * k); if (k > 0) g.filter = `blur(${(k * 7).toFixed(1)}px)`; g.globalAlpha = 1 - k * .45; g.fillText('слово', 0, 0); g.restore(); }
      g.restore();
      grade('#6a3a10', .2);
    },
    ui(lt, D, t) {
      const tr = word('jamais', 'Повторите') - .1, tc = word('jamais', 'чужим') - .3, tj = word('jamais', 'жамевю') - .2, n = Math.floor(seg(lt, tr, tc) * 30);
      title('ОБРАТНЫЙ ЭФФЕКТ', 230, seg(lt, .2, .6) * (1 - seg(lt, tj - .3, tj)), 84);
      if (lt > tr) chip(`× ${n}`, 880, 400, seg(lt, tr, tr + .3), 56, '#ffd08a');
      title('ЖАМЕВЮ', 250, seg(lt, tj, tj + .4), 160, { rgb: 5 + 5 * Math.abs(Math.sin(t * 5)), fill: '#eafcff' });
      chip('ЗНАКОМОЕ КАЖЕТСЯ ЧУЖИМ', W / 2, 1420, seg(lt, tj + .3, tj + .7), 40, '#9fe8f0');
    },
  },
  sub: {
    w(lt, D, t) { cafeBG(t); G = g; cafeGuy(lt, { y: 900 + 60 * eio(seg(lt, .2, 1.0)), nod: -.06, eye: .7 }); cafeTable(); G = g; steam(820, 1300, t, .35); dust(30, 5, 0, 300, W, 1400, t, '#ffe2b8', .5); grade('#8a4a10', .25); },
    ui(lt, D, t) {
      const ts = word('sub', 'Подписывайтесь') + .2, tc = ts + 1.1;
      title('ФАКТЫ', 220, seg(lt, .2, .7), 150, { glow: 'rgba(160,60,0,.7)' }); title('ЗА МИНУТУ', 350, seg(lt, .4, .9), 90, { glow: 'rgba(160,60,0,.7)' });
      const bp = seg(lt, ts, ts + .4), done = lt > tc; if (bp > 0) { g.save(); g.translate(W / 2, 1220); const k = back(bp) * (lt > tc ? 1 - .06 * Math.exp(-(lt - tc) * 10) : 1); g.scale(k, k); g.beginPath(); g.roundRect(-300, -80, 600, 160, 80); g.fillStyle = done ? '#3a3a40' : '#ff1f2e'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0; g.font = '500 66px Oswald'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4); g.restore(); }
      if (bp > .5) { const u = eio(seg(lt, ts + .4, tc)); g.save(); g.translate(lerp(960, 640, u), lerp(1500, 1250, u)); g.beginPath(); [[0, 0], [0, 64], [16, 50], [28, 76], [40, 70], [28, 46], [48, 44]].forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.restore(); }
    },
  },
};

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('двое из трёх', '2 из 3').replace('раз тридцать', 'раз 30');
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
  add('room', at('cafe', 0), { d: word('cafe', 'уже был') - .3 }); add('freeze', w('cafe', 'уже был') - .3); add('ding', w('cafe', 'Это не магия'));
  add('rewind', at('double', 0), { d: dur('double') }); add('hit', w('double', 'дежавю') - .1, { v: .6 }); add('pop', w('double', 'С французского'));
  add('room', at('crowd', 0), { d: dur('crowd') }); for (let i = 0; i < 7; i++) add('bloop', w('crowd', 'двое') - .2 + i * .14, { k: i }); add('ding', w('crowd', 'Так что'));
  add('neural', at('glitch', 0), { d: dur('glitch') }); const ts = w('glitch', 'сбой') - .2; for (let k = 0; ts + k * 1.1 < at('glitch', dur('glitch')) - .3 && k < 6; k++) add('zap', ts + k * 1.1); add('stamp', w('glitch', 'знакомое') - .2);
  add('room', at('notice', 0), { d: dur('notice') }); add('beep', w('notice', 'замечает') - .1); add('glitch', w('notice', 'странное') - .3, { d: .8 });
  add('yawn', at('age', .5), { d: 2.2, f: 1, v: .6 }); add('page', w('age', 'С возрастом') - .2); add('ding', w('age', 'С возрастом'));
  add('write', w('jamais', 'Повторите') - .1, { d: word('jamais', 'чужим') - word('jamais', 'Повторите') }); add('dissolve', w('jamais', 'чужим') - .3, { d: 1.6 }); add('hit', w('jamais', 'жамевю') - .2, { v: .6 });
  add('room', at('sub', 0), { d: dur('sub') }); add('swell', at('sub', 0), { d: dur('sub') }); add('click', w('sub', 'Подписывайтесь') + 1.3); add('chime', w('sub', 'Подписывайтесь') + 1.35);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы'); await document.fonts.load('italic 500 62px Inter', 'слово');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
