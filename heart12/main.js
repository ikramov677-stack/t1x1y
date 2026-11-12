// «12 минут без сердцебиения» (the Brad Phillips case) — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['fall', 'Представь: ты играешь в футбол… делаешь шаг… и внезапно падаешь.'],
  ['stop', 'И самое страшное — твоё сердце перестаёт биться.'],
  ['brad', 'Именно это произошло с двадцатидвухлетним Брэдом Филлипсом.'],
  ['match', 'Во время футбольного матча он потерял сознание. Его сердце перестало перекачивать кровь.'],
  ['twelve', 'Двенадцать минут его организм оставался без нормального кровообращения.'],
  ['defib', 'Врачи боролись за его жизнь. Они применили дефибриллятор и смогли восстановить сердцебиение.'],
  ['problem', 'Но возникла другая проблема…'],
  ['brain', 'Мозг мог получить необратимые повреждения из-за нехватки кислорода.'],
  ['cool', 'Врачи приняли необычное решение: на сутки охладили тело Брэда примерно до тридцати трёх градусов, чтобы защитить мозг.'],
  ['incredible', 'И произошло невероятное.'],
  ['woke', 'Он очнулся. Начал говорить. А затем снова научился ходить.'],
  ['moral', 'Сегодня эта история напоминает нам: иногда между жизнью и смертью стоят всего несколько минут… и люди, которые не сдаются.'],
  ['ask', 'А ты знал, что человека можно спасти даже после двенадцати минут остановки сердца?'],
].map(([id, text]) => ({ id, text }));
const VOICE = null, PH = null, WORDS = {};
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

// ———————————————————————————— hall and players (shared with the gorilla film)
function gym(t) {
  layer(7, () => {
    G.fillStyle = vgrad(0, 900, [[0, '#26333a'], [1, '#4a5a60']]); G.fillRect(0, 0, W, 900);
    for (let i = 0; i < 4; i++) { G.fillStyle = vgrad(180, 560, [[0, '#dff0f4'], [1, '#9fc0c8']]); G.fillRect(60 + i * 260, 180, 190, 380); G.fillStyle = '#26333a'; G.fillRect(150 + i * 260, 180, 10, 380); }
    glow(540, 300, 900, 'rgba(210,240,250,.3)', 1);
    G.fillStyle = '#1c262b'; G.fillRect(0, 700, W, 14); G.fillStyle = '#a8442c'; G.fillRect(0, 760, W, 30);
  });
  g.fillStyle = vgrad(880, H, [[0, '#b98850'], [.5, '#8a5c30'], [1, '#2a1a0c']]); g.fillRect(0, 880, W, H - 880);
  g.save(); g.strokeStyle = 'rgba(60,35,10,.3)'; g.lineWidth = 3; for (let i = -6; i < 18; i++) { g.beginPath(); g.moveTo(540 + (i - 6) * 90, 880); g.lineTo(540 + (i - 6) * 260, H); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 8; g.beginPath(); g.ellipse(540, 1160, 430, 130, 0, 0, TAU); g.stroke(); g.restore();
  g.fillStyle = vgrad(860, 960, [[0, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 880, W, 80);
}
function player(x, y, s, white, ph) {
  const c = g, sw = Math.sin(ph) * 16; c.save(); c.translate(x, y); c.scale(s, s);
  c.globalAlpha = .3; c.beginPath(); c.ellipse(0, 4, 90, 18, 0, 0, TAU); c.fillStyle = '#000'; c.fill(); c.globalAlpha = 1;
  c.lineCap = 'round'; c.strokeStyle = '#23262e'; c.lineWidth = 44; c.beginPath(); c.moveTo(-28, -150); c.lineTo(-30 - sw, -10); c.stroke(); c.beginPath(); c.moveTo(28, -150); c.lineTo(30 + sw, -10); c.stroke();
  const shirt = white ? '#f1f1ee' : '#15151a', sh2 = white ? '#c9c9c4' : '#08080b';
  c.strokeStyle = shirt; c.lineWidth = 36; c.beginPath(); c.moveTo(-62, -290); c.lineTo(-84 - sw * .5, -230); c.stroke(); c.beginPath(); c.moveTo(62, -290); c.lineTo(84 + sw * .5, -230); c.stroke();
  c.strokeStyle = '#c69a80'; c.lineWidth = 26; c.beginPath(); c.moveTo(-84 - sw * .5, -226); c.lineTo(-62, -180 + sw * .4); c.stroke(); c.beginPath(); c.moveTo(84 + sw * .5, -226); c.lineTo(62, -180 - sw * .4); c.stroke();
  c.beginPath(); c.roundRect(-62, -310, 124, 176, 28); const gr = c.createLinearGradient(-62, 0, 62, 0); gr.addColorStop(0, shirt); gr.addColorStop(1, sh2); c.fillStyle = gr; c.fill();
  c.fillStyle = '#c69a80'; c.fillRect(-14, -330, 28, 26); c.beginPath(); c.arc(0, -362, 40, 0, TAU); c.fill();
  c.beginPath(); c.arc(0, -372, 41, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(34, -366); c.quadraticCurveTo(0, -386, -34, -366); c.closePath(); c.fillStyle = '#2a1c14'; c.fill();
  c.restore();
}
function ball(x, y, r) { const c = g; c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); const gr = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); gr.addColorStop(0, '#ffb060'); gr.addColorStop(1, '#c85a14'); c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(40,15,0,.7)'; c.lineWidth = Math.max(2, r * .08); c.beginPath(); c.arc(x, y, r, 0, TAU); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke(); c.restore(); }
// ———————————————————————————— cardiac kit
const RED = '#ff3b4a', GRN = '#5dffa0', ICE = '#8fe0ff';
const fmt2 = n => String(Math.floor(n)).padStart(2, '0');
// one heartbeat (phase 0..1) → trace height
const beatY = ph => { const gss = (c, w, a) => a * Math.exp(-Math.pow((ph - c) / w, 2)); return gss(.16, .035, .12) - gss(.285, .012, .14) + gss(.31, .014, 1) - gss(.335, .013, .26) + gss(.56, .06, .22); };
const fibY = tt2 => .28 * Math.sin(tt2 * 31) * Math.sin(tt2 * 7.3) + .16 * Math.sin(tt2 * 53 + 1) + .1 * Math.sin(tt2 * 17.7);
// scrolling ECG strip. modeAt(time) → 'beat' | 'fib' | 'flat'
function ecg(x, y, w, h, t, modeAt, col = GRN, speed = 260, lw = 6) {
  g.save(); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 20; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i <= w; i += 4) { const tm = t - (w - i) / speed, m = modeAt(tm), v = m === 'beat' ? beatY(((tm / .8) % 1 + 1) % 1) : m === 'fib' ? fibY(tm) : (hash(Math.floor(tm * 40)) - .5) * .02; const py = y - v * h; i ? g.lineTo(x + i, py) : g.moveTo(x + i, py); }
  g.stroke(); g.restore(); glow(x + w, y, 40, col === GRN ? 'rgba(93,255,160,.9)' : 'rgba(255,60,74,.9)', .9);
}
function monitor(x, y, w, h, t, modeAt, bpmTxt, col = GRN) {
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 26); g.fillStyle = 'rgba(2,8,6,.9)'; g.fill(); g.strokeStyle = '#1c2a22'; g.lineWidth = 8; g.stroke(); g.clip();
  g.strokeStyle = 'rgba(93,255,160,.1)'; g.lineWidth = 2; for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(x + i * w / 12, y); g.lineTo(x + i * w / 12, y + h); g.stroke(); } for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x, y + i * h / 4); g.lineTo(x + w, y + i * h / 4); g.stroke(); }
  ecg(x + 20, y + h * .62, w - 190, h * .42, t, modeAt, col);
  g.font = '500 76px Oswald'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16; g.fillText(bpmTxt, x + w - 24, y + h * .5); g.restore();
}
function heartShape(x, y, s, col, a = 1) { g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a; g.beginPath(); g.moveTo(0, 120); g.bezierCurveTo(-210, -30, -110, -190, 0, -70); g.bezierCurveTo(110, -190, 210, -30, 0, 120); g.closePath(); const gr = g.createRadialGradient(-40, -60, 10, 0, 0, 200); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.12, col); gr.addColorStop(1, '#3a0008'); g.fillStyle = gr; g.shadowColor = col; g.shadowBlur = 70; g.fill(); g.restore(); }
function hosp(t, cool = 0) {
  layer(12, () => { G.fillStyle = vgrad(0, H, cool ? [[0, '#0a1a2e'], [1, '#040a14']] : [[0, '#12262c'], [1, '#050c0e']]); G.fillRect(0, 0, W, H); for (let i = 0; i < 9; i++) { G.fillStyle = cool ? 'rgba(140,200,255,.35)' : 'rgba(200,235,240,.4)'; G.fillRect(640, 260 + i * 62, 360, 34); } glow(820, 520, 700, cool ? 'rgba(90,160,255,.35)' : 'rgba(150,220,230,.3)', 1); G.fillStyle = '#0c1418'; G.fillRect(150, 300, 10, 900); G.fillRect(100, 300, 110, 10); G.beginPath(); G.roundRect(170, 330, 70, 120, 12); G.fillStyle = 'rgba(200,240,255,.35)'; G.fill(); }); G = g;
}
function medic(x, y, s, press, flip = 1) { const c = g; c.save(); c.translate(x, y); c.scale(s * flip, s); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#0a0e14'; c.fillStyle = '#0a0e14';
  c.lineWidth = 54; c.beginPath(); c.moveTo(-20, -100); c.lineTo(70, -10); c.lineTo(-70, -6); c.stroke(); c.lineWidth = 66; c.beginPath(); c.moveTo(-20, -100); c.lineTo(60, -230 + press * 12); c.stroke();
  c.lineWidth = 30; c.beginPath(); c.moveTo(60, -225 + press * 12); c.lineTo(150, -70 + press * 22); c.stroke(); c.beginPath(); c.arc(84, -290 + press * 12, 42, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(160,220,255,.5)'; c.lineWidth = 5; c.beginPath(); c.arc(84, -290 + press * 12, 42, -2.2, .2); c.stroke(); c.beginPath(); c.moveTo(72, -256 + press * 12); c.lineTo(4, -116); c.stroke(); c.restore(); }
function fallen(x, y, s, a = -Math.PI / 2) { g.save(); g.translate(x, y); g.rotate(a); player(0, 0, s, true, 0); g.restore(); }
function thermo(x, y, lv, txt, col) { g.save(); g.translate(x, y); g.beginPath(); g.roundRect(-30, -360, 60, 440, 30); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4; g.stroke(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 26; g.beginPath(); g.arc(0, 120, 56, 0, TAU); g.fill(); g.beginPath(); g.roundRect(-16, 90 - 420 * lv, 32, 420 * lv, 16); g.fill(); g.shadowBlur = 0; g.restore(); title(txt, y + 250, 1, 110, { fill: col, glow: 'rgba(0,0,0,.9)', x, sp: .02 }); }
const CUT = (lt, t0) => { const d = lt - t0; if (d >= 0 && d < .16) { g.fillStyle = `rgba(0,0,0,${1 - d / .16})`; g.fillRect(0, 0, W, H); } };

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  fall: {
    w(lt, D, t) {
      const tf = word('fall', 'падаешь') - .35, f = eio(seg(lt, tf, tf + .45)), z = 1 + .1 * eio(lt / D) + .12 * f;
      g.save(); g.translate(540, 1150); g.scale(z, z); g.translate(-540, -1150); gym(t);
      g.save(); g.globalAlpha = .55; player(210, 1060, .7, false, t * 6); player(880, 1090, .75, true, t * 6 + 2); g.restore();
      const run = 1 - f; g.save(); g.translate(540 + 40 * f, 1330); g.rotate(-1.5 * f); player(0, -Math.abs(Math.sin(lt * 9)) * 16 * run, 1.35, true, lt * 9 * run); g.restore();
      ball(700 + 260 * eo(seg(lt, tf, tf + 1.4)), 1310 - Math.abs(Math.sin(lt * 9)) * 30 * run, 44); g.restore();
      grade('#2a5a60', .12); if (f > 0) grade('#000000', .3 * f, 'source-over');
      if (lt > tf && lt < tf + .2) { g.fillStyle = `rgba(255,255,255,${.6 * (1 - (lt - tf) / .2)})`; g.fillRect(0, 0, W, H); }
    },
    ui(lt, D, t) { const tf = word('fall', 'падаешь') - .35; title('12 МИНУТ', 240, seg(lt, .05, .3), 190, { fill: RED, glow: 'rgba(255,20,50,.9)' }); title('БЕЗ СЕРДЦЕБИЕНИЯ!', 400, seg(lt, .25, .5), 96); ecg(60, 560, 960, 70, t, tm => tm < SCN.fall.t0 + tf + .3 ? 'beat' : 'flat', lt > tf + .3 ? RED : GRN); },
  },
  stop: {
    w(lt, D, t) {
      const ts = word('stop', 'перестаёт') - .1, st = seg(lt, ts, ts + .5); g.fillStyle = vgrad(0, H, [[0, '#14040a'], [1, '#040102']]); g.fillRect(0, 0, W, H); G = g;
      bokeh(20, 31, 0, 0, W, H, ['#ff3050', '#8a1030'], 14, 46, .25 * (1 - st), t, 5);
      const ph = (lt / .8) % 1, pulse = lt < ts ? .12 * Math.exp(-ph * 9) + .06 * Math.exp(-Math.pow((ph - .28) / .05, 2)) : 0;
      heartShape(540, 880, 1.9 * (1 + pulse), st > .5 ? '#5a4a50' : '#e8203a', 1 - .25 * st);
      ecg(60, 1330, 960, 110, t, tm => tm < SCN.stop.t0 + ts ? 'beat' : 'flat', st > 0 ? RED : GRN);
    },
    ui(lt, D) { const ts = word('stop', 'перестаёт') - .1; title('СЕРДЦЕ', 230, seg(lt, .15, .45), 130); title('ОСТАНОВИЛОСЬ', 370, seg(lt, ts, ts + .3), 118, { fill: RED, glow: 'rgba(255,20,50,.9)' }); },
  },
  brad: {
    w(lt, D, t) { const z = 1.12 + .06 * eio(lt / D); g.save(); g.translate(540, 1200); g.scale(z, z); g.translate(-540, -1200); gym(t); g.save(); g.globalAlpha = .6; player(230, 1120, .8, false, 0); player(860, 1140, .82, true, 0); g.restore(); fallen(700, 1330, 1.2); g.restore(); grade('#000000', .45, 'source-over'); glow(540, 1250, 600, 'rgba(255,255,255,.18)', 1); grade('#2a4a70', .2); },
    ui(lt, D) { const tn = word('brad', 'Брэдом') - .3; chip('РЕАЛЬНАЯ ИСТОРИЯ · США, 2019', W / 2, 200, seg(lt, .15, .45), 38, '#e8f4ff'); title('БРЭД ФИЛЛИПС', 340, seg(lt, tn, tn + .3), 120); title('22 ГОДА', 480, seg(lt, tn + .25, tn + .55), 110, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); },
  },
  match: {
    w(lt, D, t) {
      const press = Math.pow(Math.abs(Math.sin(lt * 5.6)), 3); g.save(); g.translate(540, 1250); g.scale(1.25, 1.25); g.translate(-540, -1250); gym(t); fallen(690, 1340, 1.15); medic(500, 1345, 1.05, press); g.restore();
      grade('#000000', .4, 'source-over'); grade('#2a4a70', .2);
      monitor(60, 470, 960, 230, t, () => 'fib', '— —', RED);
    },
    ui(lt, D) { const tb = word('match', 'Его сердце') - .2; title('ОН ПОТЕРЯЛ СОЗНАНИЕ', 230, seg(lt, .15, .45) * (1 - seg(lt, tb - .2, tb)), 84); title('КРОВЬ', 220, seg(lt, tb, tb + .3), 120); title('НЕ ПОСТУПАЕТ', 350, seg(lt, tb + .2, tb + .5), 110, { fill: RED, glow: 'rgba(255,20,50,.9)' }); },
  },
  twelve: {
    w(lt, D, t) {
      g.fillStyle = '#030305'; g.fillRect(0, 0, W, H); G = g; const u = eio(seg(lt, .2, D - .9)), punch = seg(lt, D - .9, D - .7);
      for (let i = 0; i < 3; i++) { const ph = ((lt * 1.8 + i / 3) % 1); g.save(); g.globalAlpha = .35 * (1 - ph); g.strokeStyle = RED; g.lineWidth = 6; g.beginPath(); g.arc(540, 900, 200 + ph * 420, 0, TAU); g.stroke(); g.restore(); }
      const mm = 12 * u; g.save(); g.translate(540, 900); const k = 1 + .18 * eo(punch); g.scale(k, k); g.font = '500 300px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.shadowColor = RED; g.shadowBlur = 50; g.fillText(`${fmt2(mm)}:${fmt2((mm * 60) % 60)}`, 0, 0); g.restore();
      ecg(60, 1330, 960, 100, t, () => 'flat', RED);
    },
    ui(lt, D) { title('12 МИНУТ', 260, seg(lt, .15, .45), 150, { fill: RED, glow: 'rgba(255,20,50,.9)' }); chip('ВСЁ ЭТО ВРЕМЯ ШЛА РЕАНИМАЦИЯ', W / 2, 420, seg(lt, 1.0, 1.4), 38, '#e8f4ff'); },
  },
  defib: {
    w(lt, D, t) {
      const td = word('defib', 'дефибриллятор') + .1, tr = word('defib', 'восстановить') - .1, j = lt > td ? Math.exp(-(lt - td) * 7) : 0;
      hosp(t); const sir = .5 + .5 * Math.sin(lt * 9) * (1 - seg(lt, 1.2, 2)); glow(200, 300, 900, `rgba(255,40,60,${.25 * sir})`, 1); glow(900, 300, 900, `rgba(60,120,255,${.25 * (1 - sir) * (1 - seg(lt, 1.2, 2))})`, 1);
      g.save(); g.translate(0, -26 * j); bed(1240, '#1a2a30'); lying({ girl: false, eye: 0, rim: '#9fe0e8', rdx: 5, rdy: -2, halo: .3, face: { x: 80, y: -60, r: 200, col: 'rgba(160,230,240,.45)', a: .8 } }); blanket(1140, 0, ['#3a6a74', '#12262c'], 'rgba(160,230,240,.5)'); g.restore();
      guy({ x: 880, y: 760, s: 1.5, flip: -1, nod: .35, base: '#081014', rim: '#9fe0e8', rdx: 5, rdy: -2, halo: .3, arms: [[[-40, 140], [40, 260], [150, 300 - 30 * j]]] });
      monitor(60, 300, 620, 200, t, tm => tm < SCN.defib.t0 + tr ? 'fib' : 'beat', lt > tr ? '72' : '— —', lt > tr ? GRN : RED);
      if (j > .05) { g.fillStyle = `rgba(200,235,255,${.75 * j})`; g.fillRect(0, 0, W, H); } grade('#0a4a5a', .18);
    },
    ui(lt, D) { const td = word('defib', 'дефибриллятор') + .1, tr = word('defib', 'восстановить') - .1; title('ВРАЧИ НЕ СДАЮТСЯ', 620, seg(lt, .15, .45) * (1 - seg(lt, td - .2, td)), 84); title('РАЗРЯД!', 640, seg(lt, td, td + .15) * (1 - seg(lt, tr - .2, tr)), 170, { fill: '#cfeaff', glow: 'rgba(80,160,255,.9)' }); title('СЕРДЦЕ БЬЁТСЯ', 640, seg(lt, tr, tr + .3), 110, { fill: GRN, glow: 'rgba(40,255,140,.8)' }); },
  },
  problem: {
    w(lt, D, t) { g.fillStyle = '#030406'; g.fillRect(0, 0, W, H); ecg(60, 1250, 960, 110, t, () => 'beat', GRN); g.fillStyle = `rgba(0,0,0,${.5 * seg(lt, D * .4, D)})`; g.fillRect(0, 1100, W, 300); },
    ui(lt, D) { const tp = word('problem', 'другая') - .2; title('НО…', 620, seg(lt, .1, .35), 200); title('ДРУГАЯ ПРОБЛЕМА', 820, seg(lt, tp, tp + .3), 104, { fill: RED, glow: 'rgba(255,20,50,.9)' }); },
  },
  brain: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#0a0614'], [1, '#030208']]); g.fillRect(0, 0, W, H); G = g; const dmg = eio(seg(lt, .4, D - .3));
      brain(540, 860, 2.3, t, 1); glow(540, 860, 500, `rgba(255,40,60,${.35 * dmg * (.6 + .4 * Math.sin(t * 6))})`, 1);
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { if (hash(i + 5) > 1 - dmg * .8) continue; const q = hash(i) * TAU, r = Math.sqrt(hash(i + 1)); g.globalAlpha = .5 + .5 * Math.sin(t * 5 + i); g.fillStyle = '#8fe6ff'; g.beginPath(); g.arc(530 + Math.cos(q) * r * 300, 830 + Math.sin(q) * r * 180, 4, 0, TAU); g.fill(); } g.restore();
      const gr = g.createRadialGradient(540, 900, 500, 540, 900, 1200); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(200,0,30,${.4 * dmg})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    },
    ui(lt, D) {
      const lv = lerp(1, .12, eio(seg(lt, .4, D - .3))); title('МОЗГ', 220, seg(lt, .15, .45), 150); title('БЕЗ КИСЛОРОДА', 360, seg(lt, .4, .7), 100, { fill: RED, glow: 'rgba(255,20,50,.9)' });
      g.save(); g.globalAlpha = seg(lt, .3, .6); g.font = '500 44px Oswald'; g.letterSpacing = '5px'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('O2', 160, 1300); g.textAlign = 'right'; g.fillText(Math.round(lv * 100) + '%', 920, 1300); g.beginPath(); g.roundRect(160, 1340, 760, 28, 14); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill(); g.beginPath(); g.roundRect(160, 1340, 760 * lv, 28, 14); g.fillStyle = lv > .5 ? '#8fe6ff' : RED; g.shadowColor = g.fillStyle; g.shadowBlur = 18; g.fill(); g.restore();
    },
  },
  cool: {
    w(lt, D, t) {
      const tc = word('cool', 'охладили') - .2, c = eio(seg(lt, tc, tc + 2.2)); hosp(t, 1);
      bed(1240, '#12223a'); lying({ girl: false, eye: 0, base: '#101a2c', rim: ICE, rdx: 5, rdy: -2, halo: .3 + .4 * c, face: { x: 80, y: -60, r: 200, col: 'rgba(140,210,255,.5)', a: .8 } }); blanket(1140, lt * .4, ['#4a8ac8', '#12284a'], 'rgba(143,224,255,.9)');
      glow(640, 1180, 620, `rgba(120,200,255,${.3 * c})`, 1); G = g; dust(70, 21, 0, 500, W, 1400, t * 1.6, '#dff4ff', .7 * c);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .2 * c; g.fillStyle = vgrad(1000, 1300, [[0, 'rgba(160,220,255,0)'], [1, '#bfe8ff']]); g.fillRect(0, 1000, W, 300); g.restore();
      grade('#0a3a8a', .15 + .15 * c);
    },
    ui(lt, D, t) {
      const tc = word('cool', 'охладили') - .2, ts = word('cool', 'на сутки') - .2, tg = word('cool', 'чтобы') - .2, c = eio(seg(lt, tc, tc + 2.2)), temp = lerp(37, 33, c);
      title('НЕОБЫЧНОЕ РЕШЕНИЕ', 220, seg(lt, .2, .5) * (1 - seg(lt, tc - .2, tc)), 84); title('ОХЛАДИЛИ ТЕЛО', 220, seg(lt, tc, tc + .3), 104, { fill: ICE, glow: 'rgba(60,160,255,.9)' });
      if (lt > tc - .2) { g.save(); g.globalAlpha = seg(lt, tc - .2, tc + .1); thermo(860, 640, lerp(.86, .42, c), temp.toFixed(1).replace('.', ',') + '°', c > .6 ? ICE : '#ffb080'); g.restore(); }
      chip('НА 24 ЧАСА', 330, 380, seg(lt, ts, ts + .3), 46, ICE); chip('ЧТОБЫ ЗАЩИТИТЬ МОЗГ', 330, 490, seg(lt, tg, tg + .3), 36, '#e8f4ff');
    },
  },
  incredible: {
    w(lt, D, t) { g.fillStyle = '#020203'; g.fillRect(0, 0, W, H); glow(540, 900, 300 + 900 * eo(seg(lt, .2, D)), 'rgba(255,220,160,.5)', eo(seg(lt, .2, D))); ecg(60, 1250, 960, 130, t, () => 'beat', GRN); },
    ui(lt, D) { const tn = word('incredible', 'невероятное') - .25; title('И ПРОИЗОШЛО', 640, seg(lt, .1, .4), 100); title('НЕВЕРОЯТНОЕ', 800, seg(lt, tn, tn + .3), 136, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); },
  },
  woke: {
    w(lt, D, t) {
      const ts = word('woke', 'Начал') - .2, tw = word('woke', 'А затем') - .2;
      if (lt < tw) {
        bedroom(false, t); G = g; const z = 1.5 + .12 * eio(lt / tw); g.save(); g.translate(360, 1100); g.scale(z, z); g.translate(-360, -1100); bed(); const op = eo(seg(lt, .25, .9));
        lying({ girl: false, eye: op, brow: 4 * op, rim: '#ffc8a0', rdx: 5, rdy: -2, halo: .35, jaw: lt > ts ? 6 + 6 * Math.sin(lt * 14) : 0, face: { x: 80, y: -60, r: 200, col: 'rgba(255,205,160,.7)', a: .85 } }); blanket(1110, lt, ['#8a8ab8', '#2a2a46'], 'rgba(255,200,160,.5)'); g.restore();
        if (lt > ts) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#ffe2b0'; g.lineWidth = 7; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const u = ((lt - ts) * 1.6 + i / 3) % 1; g.globalAlpha = .8 * (1 - u); g.beginPath(); g.arc(430, 760, 60 + u * 220, -1.9, -.9); g.stroke(); } g.restore(); }
        G = g; dust(40, 3, 100, 300, 1000, 1500, t, '#ffe2c0', .5); grade('#8a4a20', .2);
      } else {
        const l2 = lt - tw; layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#f2cf9a'], [1, '#a8683a']]); G.fillRect(0, 0, W, H); for (let i = 0; i < 3; i++) { G.fillStyle = 'rgba(255,245,215,.9)'; G.fillRect(80 + i * 340, 200, 240, 760); } glow(540, 500, 900, 'rgba(255,240,200,.8)', 1); G.fillStyle = 'rgba(90,50,20,.5)'; G.fillRect(0, 1380, W, 600); }); G = g;
        const x = lerp(330, 620, seg(l2, 0, D - tw)); player(x, 1420 - Math.abs(Math.sin(l2 * 4.4)) * 12, 1.5, true, l2 * 4.4); g.fillStyle = vgrad(1380, H, [[0, 'rgba(60,30,10,.0)'], [1, 'rgba(20,10,4,.8)']]); g.fillRect(0, 1380, W, 540); dust(40, 5, 0, 300, W, 1500, t, '#fff', .6); grade('#ff9a40', .2); CUT(lt, tw);
      }
    },
    ui(lt, D) { const ts = word('woke', 'Начал') - .2, tw = word('woke', 'А затем') - .2; title('ОН ОЧНУЛСЯ', 230, seg(lt, .25, .55) * (1 - seg(lt, ts - .15, ts)), 130, { fill: GOLD, glow: 'rgba(160,60,0,.8)' }); title('НАЧАЛ ГОВОРИТЬ', 230, seg(lt, ts, ts + .3) * (1 - seg(lt, tw - .15, tw)), 104, { glow: 'rgba(160,60,0,.8)' }); title('СНОВА ХОДИТ', 230, seg(lt, tw + .1, tw + .4), 130, { glow: 'rgba(160,60,0,.8)' }); },
  },
  moral: {
    w(lt, D, t) {
      layer(12, () => { G.fillStyle = vgrad(0, H, [[0, '#1a2a3a'], [1, '#060a10']]); G.fillRect(0, 0, W, H); glow(540, 620, 900, 'rgba(255,220,170,.55)', 1); }); G = g;
      clockRings(540, 640, -t * .6, .55 * (1 - seg(lt, D * .6, D * .8)));
      guy({ x: 300, y: 1180, s: 1.9, nod: -.05, base: '#070b10', rim: '#ffd9a8', rdx: 6, rdy: -3, halo: .4 }); guy({ x: 800, y: 1230, s: 1.7, flip: -1, girl: true, nod: -.05, base: '#070b10', rim: '#ffd9a8', rdx: 6, rdy: -3, halo: .4 });
      grade('#6a4a20', .18);
    },
    ui(lt, D) { const tm = word('moral', 'несколько минут') - .2, tn = word('moral', 'не сдаются') - .3; title('НЕСКОЛЬКО МИНУТ', 230, seg(lt, tm, tm + .3) * (1 - seg(lt, tn - .2, tn)), 96); title('НЕ СДАВАЙСЯ', 290, seg(lt, tn, tn + .3), 150, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); },
  },
  ask: {
    w(lt, D, t) { g.fillStyle = vgrad(0, H, [[0, '#14040a'], [1, '#040102']]); g.fillRect(0, 0, W, H); G = g; bokeh(20, 31, 0, 0, W, H, ['#ff3050', '#ffb060'], 14, 46, .25, t, 5); const ph = (lt / .8) % 1, pulse = .12 * Math.exp(-ph * 9) + .06 * Math.exp(-Math.pow((ph - .28) / .05, 2)); heartShape(540, 900, 1.7 * (1 + pulse), '#e8203a'); ecg(60, 1330, 960, 110, t, () => 'beat', GRN); },
    ui(lt, D) { const tn = word('ask', 'двенадцати') - .2; title('А ТЫ ЗНАЛ?', 240, seg(lt, .1, .4), 150); chip('12 МИНУТ ОСТАНОВКИ СЕРДЦА — И ОН ЖИВ', W / 2, 400, seg(lt, tn, tn + .3), 36, GOLD); },
  },
};

// ———————————————————————————— subtitles: large, white, key words yellow
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('двадцатидвухлетним', '22-летним').replace('Двенадцать минут', '12 минут').replace('тридцати трёх градусов', '33 градусов').replace('двенадцати минут', '12 минут');
const KEYS = ['сердце', 'сердцебиение', 'падаешь', 'дефибриллятор', 'мозг', 'невероятное', 'очнулся', 'сдаются', 'охладили', 'филлипсом', 'брэдом', 'кислорода', 'ходить', 'говорить'];
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
  const tf = w('fall', 'падаешь') - .35; add('boom', at('fall', .05)); add('room', at('fall', 0), { d: tf - at('fall', 0) }); add('mbeep', at('fall', .3), { d: tf - at('fall', 0) }); add('boom', tf + .35); add('mute', tf + .5, { d: .5, lvl: .05 });
  const ts = w('stop', 'перестаёт') - .1; add('heart', at('stop', 0), { d: ts - at('stop', 0) }); add('flat', ts, { d: at('stop', dur('stop')) - ts }); add('hit', ts);
  add('pop', w('brad', 'Брэдом') - .3); add('room', at('brad', 0), { d: dur('brad') + dur('match') });
  add('siren', at('match', 0), { d: dur('match') }); add('static', at('match', 0), { d: dur('match') });
  add('flat', at('twelve', 0), { d: dur('twelve'), v: .5 }); add('count', at('twelve', .2), { d: dur('twelve') - 1.1 }); add('cpr', at('twelve', 0), { d: dur('twelve') - .8 }); add('boom', at('twelve', dur('twelve') - .9)); add('riser', at('twelve', 0), { d: dur('twelve') - .9 });
  const td = w('defib', 'дефибриллятор') + .1, tr = w('defib', 'восстановить') - .1; add('siren', at('defib', 0), { d: 1.6 }); add('charge', td - 1.2, { d: 1.2 }); add('shock', td); add('flat', at('defib', .2), { d: Math.max(.3, td - at('defib', .2) - .1), v: .4 }); add('mbeep', tr, { d: at('defib', dur('defib')) - tr + dur('problem') }); add('ding', tr);
  add('down', w('problem', 'другая') - .2, { d: 1.2 }); add('hit', w('problem', 'другая') - .2, { v: .7 });
  add('neural', at('brain', 0), { d: dur('brain') }); add('alarm', at('brain', .5), { d: dur('brain') - .7 }); add('riser', at('brain', 0), { d: dur('brain') });
  add('wind', w('cool', 'охладили') - .2, { d: dur('cool') - word('cool', 'охладили') + .2 }); add('mbeep', at('cool', 0), { d: dur('cool'), v: .5 }); add('count', w('cool', 'охладили'), { d: 2.0 }); add('pop', w('cool', 'на сутки') - .2); add('chime', w('cool', 'чтобы'));
  add('mute', at('incredible', -.35), { d: .35, lvl: .08 }); add('mbeep', at('incredible', 0), { d: dur('incredible') }); add('swell', at('incredible', 0), { d: dur('incredible') + 1 }); add('boom', w('incredible', 'невероятное') - .25, { v: .7 });
  add('chime', at('woke', .3)); add('birds', at('woke', 0), { d: dur('woke') }); add('pop', w('woke', 'Начал') - .2); add('ding', w('woke', 'А затем') - .1);
  add('swell', at('moral', 0), { d: dur('moral') }); add('boom', w('moral', 'не сдаются') - .3, { v: .7 });
  add('heart', at('ask', 0), { d: dur('ask') }); add('mbeep', at('ask', 0), { d: dur('ask'), v: .5 }); add('chime', w('ask', 'двенадцати'));
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
