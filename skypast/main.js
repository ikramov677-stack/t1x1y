// «Ты никогда не видел настоящее небо» — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['look', 'Прямо сейчас ты смотришь в прошлое. И даже не подозреваешь об этом!'],
  ['moon', 'Когда ты смотришь на Луну, ты видишь её такой, какой она была чуть больше секунды назад!'],
  ['sun', 'Солнце? Ты видишь его таким, каким оно было восемь минут и двадцать секунд назад!'],
  ['andromeda', 'А теперь приготовься! Когда ты смотришь на галактику Андромеды, ты видишь свет, который отправился в путешествие примерно два с половиной миллиона лет назад!'],
  ['human', 'В тот момент, когда этот свет покинул галактику, на Земле ещё не существовало современного человека!'],
  ['final', 'Получается, ночное небо — это настоящая машина времени! Подпишись, если хочешь узнать ещё более невероятные тайны Вселенной!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.12,4.13],[4.61,9.43],[9.83,14.56],[15.03,23.99],[24.39,29.59],[29.96,37.91]];
const PH = [[0.12,2.21,'Прямо сейчас ты смотришь в прошлое.'],[2.53,4.13,'И даже не подозреваешь об этом!'],[4.61,5.79,'Когда ты смотришь на Луну,'],[6.04,9.43,'ты видишь её такой, какой она была чуть больше секунды назад!'],
  [9.83,10.29,'Солнце?'],[10.66,14.56,'Ты видишь его таким, каким оно было 8 минут и 20 секунд назад!'],[15.03,16.12,'А теперь приготовься!'],[16.45,18.54,'Когда ты смотришь на галактику Андромеды,'],
  [18.73,21.45,'ты видишь свет, который отправился в путешествие'],[21.5,23.99,'примерно 2,5 миллиона лет назад!'],[24.39,26.81,'В тот момент, когда этот свет покинул галактику,'],[27.02,29.59,'на Земле ещё не существовало современного человека!'],
  [29.96,33.67,'Получается, ночное небо — это настоящая машина времени!'],[34.04,37.91,'Подпишись, если хочешь узнать ещё более невероятные тайны Вселенной!']];
const WORDS = { 'look|прошлое': 1.7, 'moon|чуть больше': 8.0, 'sun|восемь': 12.6, 'andromeda|Когда': 16.45, 'andromeda|галактику': 17.5, 'andromeda|два с половиной': 21.6, 'human|на Земле': 27.02, 'human|ещё не': 27.7, 'final|машина': 32.4, 'final|Подпишись': 34.04 };
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

// ———————————————————————————— space kit
const GOLD = '#ffd24a', CY = '#7fe0ff';
function stars(t, a = 1, n = 260, seed = 0, c = g) { c.save(); for (let i = 0; i < n; i++) { const k = seed + i * 3, b = hash(k + 2), tw = .6 + .4 * Math.sin(t * (1 + b * 3) + k); c.globalAlpha = a * (.25 + .75 * b) * tw; c.fillStyle = i % 7 ? '#ffffff' : i % 14 ? '#bcd8ff' : '#ffe0b0'; const r = .8 + 2.4 * b * b; c.beginPath(); c.arc(hash(k) * W, hash(k + 1) * H, r, 0, TAU); c.fill(); } c.restore(); }
function spaceBG(t, tint = '#0a1030') { g.fillStyle = vgrad(0, H, [[0, '#02030a'], [.6, tint], [1, '#02030a']]); g.fillRect(0, 0, W, H); stars(t); }
function moon(x, y, r, t) {
  const c = g; glow(x, y, r * 2.2, 'rgba(190,210,255,.35)', 1);
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  const gr = c.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r * 1.1); gr.addColorStop(0, '#f4f2ec'); gr.addColorStop(.6, '#b8b6b2'); gr.addColorStop(1, '#55565e'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  for (const [mx, my, mr] of [[-.3, -.25, .32], [.15, -.4, .22], [.3, .05, .28], [-.15, .25, .2], [-.5, .1, .15]]) { c.beginPath(); c.ellipse(x + mx * r, y + my * r, mr * r, mr * r * .8, mx, 0, TAU); c.fillStyle = 'rgba(70,72,84,.33)'; c.fill(); }
  for (let i = 0; i < 46; i++) { const q = hash(i + 40) * TAU, d = Math.sqrt(hash(i + 41)) * r * .95, cr = r * (.015 + .06 * hash(i + 42) ** 2), cx = x + Math.cos(q) * d, cy = y + Math.sin(q) * d; c.beginPath(); c.arc(cx, cy, cr, 0, TAU); c.fillStyle = 'rgba(50,50,60,.3)'; c.fill(); c.beginPath(); c.arc(cx, cy, cr, .3, 2.2); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1.5, cr * .18); c.stroke(); }
  const sh = c.createRadialGradient(x - r * .5, y - r * .4, r * .5, x - r * .2, y - r * .2, r * 1.6); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,10,.75)'); c.fillStyle = sh; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}
function sun(x, y, r, t, flare = 0) {
  const c = g; glow(x, y, r * 3.2, 'rgba(255,150,40,.5)', 1); glow(x, y, r * 1.7, 'rgba(255,220,120,.8)', 1);
  c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y); for (let i = 0; i < 18; i++) { c.rotate(TAU / 18); const L = r * (1.5 + .5 * Math.sin(t * 1.3 + i * 2)); c.globalAlpha = .1; c.fillStyle = '#ffd070'; c.beginPath(); c.moveTo(0, -r * .9); c.lineTo(r * .14, -L - r); c.lineTo(-r * .14, -L - r); c.closePath(); c.fill(); } c.restore();
  // prominences
  c.save(); c.lineCap = 'round'; c.shadowColor = '#ff7a20'; c.shadowBlur = 30; c.strokeStyle = '#ffb050'; for (const [q, s] of [[-.9, 1], [.6, .7], [2.4, .9], [3.9, .6]]) { const px = x + Math.cos(q) * r, py = y + Math.sin(q) * r, k = s * (1 + .15 * Math.sin(t * 2 + q)); c.lineWidth = r * .05; c.beginPath(); c.ellipse(px, py, r * .16 * k, r * .3 * k, q + Math.PI / 2, 0, TAU); c.stroke(); } c.restore();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#fffbe6'); gr.addColorStop(.55, '#ffd45a'); gr.addColorStop(.9, '#ff9a20'); gr.addColorStop(1, '#e85a10'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  const f = Math.floor(t * 5); for (let i = 0; i < 260; i++) { const q = hash(i + 7) * TAU, d = Math.sqrt(hash(i + 8)) * r, gx = x + Math.cos(q) * d + Math.sin(t * .6 + i) * 6, gy = y + Math.sin(q) * d + Math.cos(t * .5 + i) * 6; c.globalAlpha = .1 + .12 * hash(i + f); c.fillStyle = i % 2 ? '#fff6c8' : '#e06a10'; c.beginPath(); c.arc(gx, gy, r * (.03 + .05 * hash(i + 9)), 0, TAU); c.fill(); }
  c.globalAlpha = 1; for (const [q, d, s] of [[.8, .45, .07], [3.6, .6, .05]]) { c.beginPath(); c.ellipse(x + Math.cos(q) * d * r, y + Math.sin(q) * d * r, r * s, r * s * .7, q, 0, TAU); c.fillStyle = 'rgba(120,40,0,.55)'; c.fill(); }
  c.restore();
  if (flare > 0) { glow(x + r * .6, y - r * .5, r * (1 + 3 * flare), 'rgba(255,255,230,1)', 1 - flare); }
}
function earth(x, y, r, t) { const c = g; glow(x, y, r * 2.4, 'rgba(90,170,255,.5)', 1); c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); const gr = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); gr.addColorStop(0, '#6ac0ff'); gr.addColorStop(1, '#0a3a8a'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(x + ((hash(i + 70) * 2.6 - 1.3 + t * .05) % 2.6 - 1) * r, y + (hash(i + 71) - .5) * 1.5 * r, r * (.2 + .25 * hash(i + 72)), r * (.14 + .2 * hash(i + 73)), hash(i) * 3, 0, TAU); c.fillStyle = '#3aa860'; c.fill(); } const sh = c.createRadialGradient(x - r * .5, y - r * .5, r * .4, x, y, r * 1.3); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,20,.7)'); c.fillStyle = sh; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); }
// spiral galaxy, pre-rendered once
const GAL = (() => { const S = 1200, c = mk(S, S), x = c.getContext('2d'); x.translate(S / 2, S / 2); x.globalCompositeOperation = 'lighter';
  let gr = x.createRadialGradient(0, 0, 0, 0, 0, 560); gr.addColorStop(0, 'rgba(255,240,210,.9)'); gr.addColorStop(.12, 'rgba(255,210,150,.5)'); gr.addColorStop(.4, 'rgba(120,140,255,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(-600, -600, 1200, 1200);
  for (let i = 0; i < 9000; i++) { const arm = i % 2, u = Math.pow(hash(i), .7), th = u * 9.5 + arm * Math.PI + (hash(i + 1) - .5) * (.5 + u * .5), rr2 = 30 + u * 520 + (hash(i + 2) - .5) * 60 * u; const px = Math.cos(th) * rr2, py = Math.sin(th) * rr2, b = hash(i + 3); x.globalAlpha = .25 + .6 * b * (1 - u * .5); x.fillStyle = b > .92 ? '#ff9ac0' : u < .25 ? '#ffe8c0' : b > .5 ? '#bcd0ff' : '#8aa8ff'; x.beginPath(); x.arc(px, py, .8 + 2.2 * b * b, 0, TAU); x.fill(); }
  for (let i = 0; i < 2500; i++) { const q = hash(i + 9000) * TAU, d = Math.pow(hash(i + 9001), 2) * 160; x.globalAlpha = .5; x.fillStyle = '#fff0d0'; x.beginPath(); x.arc(Math.cos(q) * d, Math.sin(q) * d, 1 + hash(i) * 1.5, 0, TAU); x.fill(); }
  return c; })();
function galaxy(x, y, s, rot, a = 1, tilt = .42, ang = -.5) { g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(ang); g.scale(s, s * tilt); g.rotate(rot); g.drawImage(GAL, -600, -600); g.restore(); glow(x, y, 260 * s, 'rgba(255,230,190,.5)', a); }
function warp(t, k, cx = 540, cy = 860) { if (k <= 0) return; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; for (let i = 0; i < 150; i++) { const q = hash(i + 300) * TAU, u = ((t * (.5 + hash(i + 301)) * 1.4 + hash(i + 302)) % 1), d0 = 60 + u * u * 1300, L = 30 + 420 * k * u; g.globalAlpha = k * u * .9; g.strokeStyle = i % 3 ? '#cfe2ff' : '#ffffff'; g.lineWidth = 1.5 + 3 * u; g.beginPath(); g.moveTo(cx + Math.cos(q) * d0, cy + Math.sin(q) * d0); g.lineTo(cx + Math.cos(q) * (d0 + L), cy + Math.sin(q) * (d0 + L)); g.stroke(); } g.restore(); }
// light-travel diagram: source at top, Earth at bottom, a photon running down
function lightPath(y0, y1, u, col = '#ffffff') { g.save(); g.setLineDash([10, 16]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(540, y0); g.lineTo(540, y1); g.stroke(); g.setLineDash([]); const py = lerp(y0, y1, u); const gr = g.createLinearGradient(0, py - 220, 0, py); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, col); g.strokeStyle = gr; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(540, Math.max(y0, py - 220)); g.lineTo(540, py); g.stroke(); g.restore(); glow(540, py, 70, 'rgba(255,255,255,1)', 1); }
function bigNum(s, y, p, size, col, glowc) { title(s, y, p, size, { fill: col, glow: glowc, sp: .04 }); }
function hominid(x, y, s) { const c = g; c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#050308'; c.strokeStyle = '#050308'; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = 44; c.beginPath(); c.moveTo(-20, -40); c.lineTo(-60, 60); c.lineTo(-10, 150); c.stroke(); c.beginPath(); c.moveTo(-10, -40); c.lineTo(50, 50); c.lineTo(20, 150); c.stroke();
  c.beginPath(); c.ellipse(20, -130, 62, 110, .5, 0, TAU); c.fill();
  c.lineWidth = 34; c.beginPath(); c.moveTo(60, -190); c.lineTo(120, -80); c.lineTo(150, 30); c.stroke(); c.beginPath(); c.moveTo(40, -190); c.lineTo(0, -80); c.lineTo(40, -10); c.stroke();
  c.beginPath(); c.ellipse(96, -262, 52, 46, .3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(132, -246, 30, 24, .5, 0, TAU); c.fill();
  c.lineWidth = 9; c.beginPath(); c.moveTo(150, 30); c.lineTo(230, -150); c.stroke();
  c.restore(); }
function savanna(t) {
  g.fillStyle = vgrad(0, 1400, [[0, '#04061a'], [.5, '#2a1a4a'], [.82, '#b8502a'], [1, '#ffb050']]); g.fillRect(0, 0, W, H); stars(t, .9, 200, 5);
  glow(540, 1380, 700, 'rgba(255,170,80,.55)', 1);
  g.fillStyle = '#050308'; g.beginPath(); g.moveTo(0, 1400); g.bezierCurveTo(300, 1350, 700, 1420, W, 1370); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  // acacia
  g.save(); g.translate(830, 1385); g.strokeStyle = '#050308'; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -180, 30, -330); g.stroke(); g.lineWidth = 14; for (const [bx, by] of [[-150, -420], [150, -430], [0, -470]]) { g.beginPath(); g.moveTo(20, -300); g.lineTo(bx, by); g.stroke(); } g.fillStyle = '#050308'; for (const [ex, ey, ew] of [[-120, -450, 190], [130, -460, 200], [0, -500, 240]]) { g.beginPath(); g.ellipse(ex, ey, ew, 46, 0, 0, TAU); g.fill(); } g.restore();
  for (let i = 0; i < 40; i++) { const x = hash(i + 90) * W; g.strokeStyle = '#050308'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 1400); g.lineTo(x + (hash(i) - .5) * 30, 1350 - hash(i + 5) * 40); g.stroke(); }
}
function clockRings(x, y, t, a) { if (a <= 0) return; g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); for (let k = 0; k < 4; k++) { const r = 190 + k * 120, col = k % 2 ? CY : GOLD; g.save(); g.rotate(-t * (.5 - k * .09) * (k % 2 ? 1 : 1.3)); g.globalAlpha = a * (.55 - k * .1); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 18; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); const n = 12 * (k + 1); for (let i = 0; i < n; i++) { const q = i / n * TAU, L = i % (k + 1) ? 14 : 34; g.beginPath(); g.moveTo(Math.cos(q) * r, Math.sin(q) * r); g.lineTo(Math.cos(q) * (r - L), Math.sin(q) * (r - L)); g.stroke(); } g.restore(); }
  g.globalAlpha = a; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 14; g.lineWidth = 9; g.save(); g.rotate(-t * 2.4); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -150); g.stroke(); g.restore(); g.lineWidth = 6; g.save(); g.rotate(-t * 9); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -230); g.stroke(); g.restore(); g.restore(); }

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  look: {
    w(lt, D, t) {
      // hard zoom into an eye; the night sky is inside the pupil
      const z = 1 + 11 * Math.pow(seg(lt, .15, D - .1), 2.6), cx = 540, cy = 900;
      g.fillStyle = vgrad(0, H, [[0, '#2a1810'], [1, '#0c0605']]); g.fillRect(0, 0, W, H);
      g.save(); g.translate(cx, cy); g.scale(z, z);
      glow(-200, -300, 900, 'rgba(255,190,140,.25)', 1);
      const almond = () => { g.beginPath(); g.moveTo(-400, 10); g.quadraticCurveTo(-40, -330, 400, -10); g.quadraticCurveTo(20, 270, -400, 10); g.closePath(); };
      g.save(); almond(); g.clip();
      const sc = g.createRadialGradient(0, 0, 100, 0, 0, 440); sc.addColorStop(0, '#f6f0ea'); sc.addColorStop(1, '#a89088'); g.fillStyle = sc; g.fillRect(-420, -340, 840, 640);
      const ir = g.createRadialGradient(0, 0, 60, 0, 0, 200); ir.addColorStop(0, '#d8a040'); ir.addColorStop(.45, '#3a9aa8'); ir.addColorStop(1, '#0c3a4a'); g.beginPath(); g.arc(0, 0, 200, 0, TAU); g.fillStyle = ir; g.fill();
      g.lineCap = 'round'; for (let i = 0; i < 110; i++) { const q = i / 110 * TAU + hash(i) * .05; g.strokeStyle = `rgba(${i % 2 ? '255,240,200' : '6,30,40'},${.18 + .2 * hash(i + 1)})`; g.lineWidth = 2 + 2 * hash(i + 2); g.beginPath(); g.moveTo(Math.cos(q) * 84, Math.sin(q) * 84); g.lineTo(Math.cos(q) * (150 + 46 * hash(i + 3)), Math.sin(q) * (150 + 46 * hash(i + 3))); g.stroke(); }
      g.lineWidth = 10; g.strokeStyle = 'rgba(4,16,24,.8)'; g.beginPath(); g.arc(0, 0, 198, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 82, 0, TAU); g.fillStyle = '#020308'; g.fill();
      const sh = g.createLinearGradient(0, -330, 0, -60); sh.addColorStop(0, 'rgba(20,8,4,.75)'); sh.addColorStop(1, 'rgba(20,8,4,0)'); g.fillStyle = sh; g.fillRect(-420, -340, 840, 300);
      g.beginPath(); g.ellipse(-70, -70, 34, 22, -.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
      g.restore();
      g.strokeStyle = '#120806'; g.lineWidth = 12; g.beginPath(); g.moveTo(-400, 10); g.quadraticCurveTo(-40, -330, 400, -10); g.stroke();
      for (let i = 0; i < 30; i++) { const u = i / 29, bx = -400 + u * 800, by = 10 - Math.sin(u * Math.PI) * 170 - (u - .5) * 20; g.lineWidth = 6; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx - 10 + u * 20, by - 60, bx - 50 + u * 100, by - 90 - Math.sin(u * Math.PI) * 30); g.stroke(); }
      g.restore();
      // sky inside the pupil
      g.save(); g.beginPath(); g.arc(cx, cy, 80 * z, 0, TAU); g.clip(); g.fillStyle = '#02030a'; g.fillRect(0, 0, W, H); stars(t, clamp(z / 3)); g.restore();
      grade('#6a2a10', .2 * (1 - seg(z, 4, 10)));
    },
    ui(lt, D) { const tp = word('look', 'прошлое') - .4; title('ТЫ СМОТРИШЬ', 250, seg(lt, .1, .4), 110); title('В ПРОШЛОЕ', 390, seg(lt, tp, tp + .3), 150, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); },
  },
  moon: {
    w(lt, D, t) {
      const tb = word('moon', 'чуть больше') - .5; spaceBG(t);
      if (lt < tb) { const u = lt / tb, r = lerp(200, 520, eio(u)); moon(540 + 60 * (1 - u), 900 - 40 * u, r, t); }
      else { const l2 = lt - tb; moon(540, 520, 190, t); earth(540, 1320, 90, t); const u = (l2 % 1.9) / 1.3; lightPath(720, 1220, clamp(u), '#dfe8ff'); if (lt - tb < .25) { g.fillStyle = `rgba(255,255,255,${.5 * (1 - (lt - tb) / .25)})`; g.fillRect(0, 0, W, H); } }
      grade('#1a2a6a', .2);
    },
    ui(lt, D) {
      const tb = word('moon', 'чуть больше') - .5;
      title('ЛУНА', 240, seg(lt, .15, .5) * (1 - seg(lt, tb - .2, tb)), 150);
      if (lt > tb) { const u = clamp(((lt - tb) % 1.9) / 1.3); bigNum((u * 1.3).toFixed(1).replace('.', ',') + ' С', 980, 1, 90, '#fff', 'rgba(0,0,0,.9)'); bigNum('1,3 СЕКУНДЫ', 240, seg(lt, tb, tb + .3), 130, GOLD, 'rgba(255,150,20,.9)'); title('НАЗАД', 370, seg(lt, tb + .15, tb + .45), 90); }
    },
  },
  sun: {
    w(lt, D, t) {
      const tb = word('sun', 'восемь') - .4;
      g.fillStyle = vgrad(0, H, [[0, '#120602'], [.5, '#2a0e04'], [1, '#050201']]); g.fillRect(0, 0, W, H); stars(t, .5);
      if (lt < tb) { const u = lt / tb; sun(540, 900, lerp(330, 430, eio(u)), t, seg(lt, 0, .9)); if (lt < .35) { g.fillStyle = `rgba(255,240,200,${1 - lt / .35})`; g.fillRect(0, 0, W, H); } }
      else { const dur = Math.max(1.5, D - tb - .6), u = eio(seg(lt, tb + .2, tb + .2 + dur)); sun(540, 470, 190, t); earth(540, 1330, 80, t); lightPath(680, 1240, u, '#fff0b0'); if (lt - tb < .25) { g.fillStyle = `rgba(255,255,255,${.5 * (1 - (lt - tb) / .25)})`; g.fillRect(0, 0, W, H); } }
      grade('#8a3a00', .18);
    },
    ui(lt, D) {
      const tb = word('sun', 'восемь') - .4;
      title('СОЛНЦЕ?', 230, seg(lt, .15, .45) * (1 - seg(lt, tb - .2, tb)), 150, { fill: '#ffe9a8', glow: 'rgba(255,120,0,.9)' });
      if (lt > tb) { const dur = Math.max(1.5, D - tb - .6), s = Math.round(500 * eio(seg(lt, tb + .2, tb + .2 + dur))); bigNum(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 980, 1, 110, '#fff', 'rgba(0,0,0,.9)'); bigNum('8 МИНУТ', 230, seg(lt, tb, tb + .3), 140, GOLD, 'rgba(255,120,0,.9)'); title('20 СЕКУНД НАЗАД', 370, seg(lt, tb + .2, tb + .5), 84); }
    },
  },
  andromeda: {
    w(lt, D, t) {
      const tk = word('andromeda', 'Когда') - .2, u = seg(lt, tk, D);
      spaceBG(t, '#140a30');
      if (lt < tk) { warp(t, eio(seg(lt, 0, tk * .8))); galaxy(540, 860, .12 + .1 * (lt / tk), t * .05, .8); }
      else { warp(t, .5 * (1 - seg(lt, tk, tk + 1.2))); galaxy(540 + 30 * Math.sin(lt * .3), 880, lerp(.25, 1.25, Math.pow(u, .8)), t * .05 + 1); }
      if (lt > tk && lt < tk + .25) { g.fillStyle = `rgba(255,255,255,${.5 * (1 - (lt - tk) / .25)})`; g.fillRect(0, 0, W, H); }
      grade('#3a1a8a', .2);
    },
    ui(lt, D) {
      const tk = word('andromeda', 'Когда') - .2, tg = word('andromeda', 'галактику') - .2, tn = word('andromeda', 'два с половиной') - .2, n = 2500000 * eio(seg(lt, tn, tn + 1.6));
      title('ПРИГОТОВЬСЯ!', 300, seg(lt, .1, .4) * (1 - seg(lt, tk - .2, tk)), 130, { fill: GOLD, glow: 'rgba(255,150,20,.9)' });
      title('ГАЛАКТИКА', 220, seg(lt, tg, tg + .3) * (1 - seg(lt, tn - .25, tn)), 100); title('АНДРОМЕДЫ', 340, seg(lt, tg + .15, tg + .45) * (1 - seg(lt, tn - .25, tn)), 120, { fill: '#cbb8ff', glow: 'rgba(120,80,255,.9)' });
      if (lt > tn) { bigNum(fmt(n), 240, seg(lt, tn, tn + .25), 150, GOLD, 'rgba(255,150,20,.9)'); title('ЛЕТ В ПРОШЛОЕ', 380, seg(lt, tn + .2, tn + .5), 90); }
    },
  },
  human: {
    w(lt, D, t) {
      const te = word('human', 'на Земле') - .5;
      if (lt < te) { spaceBG(t, '#140a30'); galaxy(540, 820, 1.0, t * .05 + 1.4); const u = seg(lt, .4, te); if (u > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#fff'; g.shadowColor = '#bcd0ff'; g.shadowBlur = 30; g.globalAlpha = 1 - u * .3; g.lineWidth = 8 + 20 * u; g.beginPath(); g.arc(540, 820, 40 + 1500 * u * u, 0, TAU); g.stroke(); g.restore(); } g.fillStyle = `rgba(0,0,0,${.75 * (1 - seg(lt, 0, .6))})`; g.fillRect(0, 0, W, H); grade('#3a1a8a', .2); }
      else { const l2 = lt - te; savanna(t); galaxy(330, 420, .28, 1.2, .9 * seg(l2, 0, .6)); hominid(360, 1250, 1.1); if (l2 < .3) { g.fillStyle = `rgba(255,255,255,${.6 * (1 - l2 / .3)})`; g.fillRect(0, 0, W, H); } grade('#6a2a50', .15); }
    },
    ui(lt, D) {
      const te = word('human', 'на Земле') - .5, tn = word('human', 'ещё не') - .2;
      title('СВЕТ ПОКИНУЛ ГАЛАКТИКУ', 250, seg(lt, .5, .9) * (1 - seg(lt, te - .2, te)), 76);
      if (lt > te) { chip('2,5 МЛН ЛЕТ НАЗАД', W / 2, 640, seg(lt, te, te + .3), 44, GOLD); title('ЧЕЛОВЕКА', 800, seg(lt, tn, tn + .3), 130); title('ЕЩЁ НЕ БЫЛО', 940, seg(lt, tn + .2, tn + .5), 120, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); }
    },
  },
  final: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#02030c'], [.7, '#0e1a40'], [1, '#1a2a5a']]); g.fillRect(0, 0, W, H);
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(540, 760); g.rotate(-.9); const mw = g.createLinearGradient(0, -260, 0, 260); mw.addColorStop(0, 'rgba(0,0,0,0)'); mw.addColorStop(.5, 'rgba(150,140,255,.28)'); mw.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = mw; g.fillRect(-1400, -260, 2800, 520); g.restore();
      stars(t, 1, 420, 9); galaxy(800, 420, .2, t * .03, .8);
      clockRings(620, 700, t, seg(lt, word('final', 'машина') - .3, word('final', 'машина') + .4) * .8);
      G = g; g.fillStyle = '#03040a'; g.beginPath(); g.moveTo(0, 1500); g.bezierCurveTo(300, 1380, 700, 1440, W, 1520); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      guy({ x: 300, y: 1270, s: 1.7, nod: -.38, eye: .9, base: '#05060c', rim: '#7fa8ff', rdx: 5, rdy: -3, halo: .5, eyeA: .5 });
      grade('#1a2a8a', .2);
    },
    ui(lt, D, t) {
      const tm = word('final', 'машина') - .3, ts = word('final', 'Подпишись') - .1, tc = ts + 1.0;
      title('МАШИНА', 230, seg(lt, tm, tm + .3) * (1 - seg(lt, ts + 1.6, ts + 1.9)), 150); title('ВРЕМЕНИ', 380, seg(lt, tm + .2, tm + .5) * (1 - seg(lt, ts + 1.6, ts + 1.9)), 150, { fill: GOLD, glow: 'rgba(255,150,20,.9)' });
      title('КАК ДАЛЕКО В ПРОШЛОЕ', 230, seg(lt, ts + 1.9, ts + 2.3), 78); title('ТЫ ХОТЕЛ БЫ ЗАГЛЯНУТЬ?', 340, seg(lt, ts + 2.1, ts + 2.5), 78, { fill: GOLD });
      const bp = seg(lt, ts, ts + .4), done = lt > tc; if (bp > 0) { g.save(); g.translate(W / 2 + 130, 1080); const k = back(bp) * (lt > tc ? 1 - .06 * Math.exp(-(lt - tc) * 10) : 1); g.scale(k, k); g.beginPath(); g.roundRect(-290, -80, 580, 160, 80); g.fillStyle = done ? '#3a3a40' : '#ff1f2e'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0; g.font = '500 64px Oswald'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4); g.restore(); }
      if (bp > .5) { const u = eio(seg(lt, ts + .4, tc)); g.save(); g.translate(lerp(1010, 780, u), lerp(1380, 1110, u)); g.beginPath(); [[0, 0], [0, 64], [16, 50], [28, 76], [40, 70], [28, 46], [48, 44]].forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke(); g.restore(); }
    },
  },
};
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ———————————————————————————— subtitles: large, white, key words yellow
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('восемь минут и двадцать секунд', '8 минут и 20 секунд').replace('два с половиной миллиона лет', '2,5 миллиона лет');
const KEYS = ['прошлое', 'луну', 'солнце', 'секунды', 'андромед', 'миллиона', 'человека', 'машина', 'времени', 'подпишись', 'вселенной', 'приготовься'];
const isKey = w => { const x = w.toLowerCase().replace(/[«»"!?,.:—]/g, ''); return /\d/.test(x) || KEYS.some(k => x.startsWith(k)); };
const SUBS = (() => { const out = VOICE && PH ? PH.map(([a, b, x]) => ({ text: x, a: a + VOICE_OFFSET - .05, b: b + VOICE_OFFSET })) : VO.map(v => ({ text: SHOW(v.text), a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .5, p.a + 1.6); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .15) * (1 - seg(t, v.b - .12, v.b));
  g.save(); g.globalAlpha = f; g.font = '600 66px Inter'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const L = wrap(v.text, 940), LH = 86, y0 = H - 250 - (L.length - 1) * LH, sp = g.measureText(' ').width;
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
  add('boom', at('look', .05)); add('riser', at('look', .2), { d: dur('look') - .2 }); add('hit', w('look', 'прошлое') - .4);
  add('boom', at('moon', 0), { v: .8 }); add('wind', at('moon', 0), { d: dur('moon') }); const tb = w('moon', 'чуть больше') - .5; add('whoosh', tb, { d: .5 }); for (let k = 0; tb + k * 1.9 < at('moon', dur('moon')) - .4 && k < 4; k++) { add('count', tb + k * 1.9, { d: 1.3 }); add('ding', tb + k * 1.9 + 1.3); }
  add('boom', at('sun', 0)); add('fire', at('sun', 0), { d: dur('sun') }); const ts = w('sun', 'восемь') - .4; add('whoosh', ts, { d: .5 }); add('count', ts + .2, { d: Math.max(1.5, dur('sun') - word('sun', 'восемь') - .2) }); add('chime', at('sun', dur('sun')) - .5);
  const tk = w('andromeda', 'Когда') - .2; add('riser', at('andromeda', 0), { d: tk - at('andromeda', 0) }); add('boom', tk); add('wind', tk, { d: dur('andromeda') }); add('pop', w('andromeda', 'галактику') - .2); add('count', w('andromeda', 'два с половиной') - .2, { d: 1.6 }); add('hit', w('andromeda', 'два с половиной') + 1.4);
  add('down', at('human', 0), { d: 1.2 }); add('whoosh', at('human', .4), { d: Math.max(.6, word('human', 'на Земле') - .9) }); add('boom', w('human', 'на Земле') - .5); add('wind', w('human', 'на Земле') - .5, { d: dur('human') }); add('hit', w('human', 'ещё не') - .2);
  add('swell', at('final', 0), { d: dur('final') }); add('boom', w('final', 'машина') - .3, { v: .8 }); add('count', w('final', 'машина'), { d: 1.2 }); add('click', w('final', 'Подпишись') + .9); add('chime', w('final', 'Подпишись') + .95); add('pop', w('final', 'Подпишись') + 1.9);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
