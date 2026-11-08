// «Почему мы забываем сны» — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['wake', 'Вы видели сон этой ночью. Но уже забыли его. Почему?'],
  ['dreams', 'Каждую ночь мы видим несколько снов — даже если уверены, что не видели ни одного.'],
  ['rem', 'Самые яркие сны приходят в фазе быстрого сна — глаза в это время бегают под веками.'],
  ['memory', 'В эти моменты отдел мозга, который записывает воспоминания, работает слабо. Поэтому сон не сохраняется.'],
  ['phone', 'Через несколько минут после пробуждения большая часть сна исчезает из памяти.'],
  ['paralysis', 'А ещё во время снов тело парализовано, чтобы мы не повторяли движения из сна.'],
  ['notebook', 'Хотите запомнить сон? Проснувшись, не двигайтесь, вспомните его и сразу запишите.'],
  ['sub', 'Подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = null, PH = null, WORDS = {};
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

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  wake: {
    w(lt, D, t) {
      bedroom(false, t); G = g;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .14; g.fillStyle = vgrad(240, 1500, [[0, '#ffd2a8'], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.moveTo(640, 250); g.lineTo(1000, 250); g.lineTo(600, 1500); g.lineTo(120, 1500); g.closePath(); g.fill(); g.restore();
      dust(40, 3, 100, 300, 1000, 1500, t, '#ffe2c0', .5);
      const jolt = seg(lt, .25, .4), sh = lt > .25 ? Math.exp(-(lt - .25) * 6) : 0;
      g.save(); g.translate(Math.sin(t * 50) * 8 * sh, 0);
      bed();
      lying({ eye: lt < .25 ? 0 : 1.1, brow: 6 * jolt, rim: '#ffc8a0', rdx: 5, rdy: -2, halo: .3, face: { x: 80, y: -60, r: 200, col: 'rgba(255,200,160,.6)', a: .8 } });
      blanket(1110, lt, ['#7a7aa8', '#2a2a46'], 'rgba(255,200,160,.4)');
      g.restore();
      // fading dream fragments
      const u = seg(lt, .4, 2.6); ['moon', 'fish', 'house'].forEach((k, i) => { icon(k, 330 + i * 190, 720 - i * 60 - u * 80, 1.1, (1 - u) * .9); particlesOut(330 + i * 190, 720 - i * 60, 50, u, 30, i * 40); });
      grade('#4a3a8a', .25);
    },
    ui(lt, D, t) { const tq = word('wake', 'Почему'); title('УЖЕ ЗАБЫЛИ', 300, seg(lt, word('wake', 'уже забыли') - .1, word('wake', 'уже забыли') + .4), 120); title('ПОЧЕМУ?', 440, seg(lt, tq, tq + .4), 110, { fill: '#bfe8ff', glow: 'rgba(80,160,255,.8)' }); },
  },
  dreams: {
    w(lt, D, t) {
      bedroom(true, t); G = g; bed(1210, '#1a2040');
      lying({ eye: 0, rim: '#7fa8ff', rdx: 5, rdy: -2, halo: .4, face: { x: 80, y: -60, r: 200, col: 'rgba(120,160,255,.4)', a: .8 } });
      blanket(1110, lt, ['#3a4a80', '#121830']);
      const B = [[300, 820, 'moon'], [560, 640, 'fish'], [800, 820, 'house'], [430, 450, 'heart'], [720, 400, 'star']];
      B.forEach(([x, y, k], i) => { const p = eo(seg(lt, .4 + i * .45, 1.0 + i * .45)), fy = y + Math.sin(t * .9 + i) * 14; bubble(x, fy, 150 * p, p * .9); icon(k, x, fy, 1.1 * p, p * .95); });
      for (let i = 0; i < 3; i++) { const p = seg(lt, .2 + i * .15, .5 + i * .15); glow(330 + i * 0, 1000 - i * 60, 30 + i * 8, 'rgba(160,200,255,.7)', p); }
      grade('#2a3a8a', .3);
    },
    ui(lt, D) { const tn = word('dreams', 'несколько'); title('НЕСКОЛЬКО СНОВ', 230, seg(lt, tn - .1, tn + .4), 100); chip('КАЖДУЮ НОЧЬ', W / 2, 1460 - 100, seg(lt, tn + .4, tn + .8), 40, '#bfe8ff'); },
  },
  rem: {
    w(lt, D, t) {
      g.fillStyle = '#05060c'; g.fillRect(0, 0, W, H);
      // extreme close-up: closed eye under a soft blue light
      const cx = 540, cy = 900;
      g.save(); const sk = g.createRadialGradient(cx - 120, cy - 260, 50, cx, cy, 900); sk.addColorStop(0, '#6a5a6a'); sk.addColorStop(.5, '#2a2230'); sk.addColorStop(1, '#07060a'); g.fillStyle = sk; g.fillRect(0, 0, W, H); g.restore();
      G = g; glow(cx - 200, cy - 400, 700, 'rgba(110,140,255,.35)', 1);
      // brow
      g.save(); g.strokeStyle = 'rgba(20,12,16,.85)'; g.lineCap = 'round'; for (let i = 0; i < 70; i++) { const u = i / 70, x = cx - 330 + u * 640, y = cy - 300 - Math.sin(u * Math.PI) * 70 + hash(i) * 14; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y - 10 - hash(i + 3) * 10); g.stroke(); } g.restore();
      // eyeball bulge moving under the lid (REM)
      const rem = lt > .5 ? Math.sin(lt * 9) * .5 + Math.sin(lt * 15.3) * .35 : 0, bx = cx + rem * 120;
      g.save(); g.beginPath(); g.ellipse(cx, cy, 330, 190, 0, 0, TAU); g.clip();
      const lid = g.createRadialGradient(bx - 40, cy - 70, 10, bx, cy, 320); lid.addColorStop(0, '#9a8496'); lid.addColorStop(.4, '#5a4858'); lid.addColorStop(1, '#1c1420'); g.fillStyle = lid; g.fillRect(cx - 340, cy - 200, 680, 400);
      glow(bx - 30, cy - 60, 120, 'rgba(200,220,255,.35)', 1); g.restore();
      // crease + lash line
      g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(30,18,26,.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 320, cy - 20); g.quadraticCurveTo(cx, cy - 220, cx + 320, cy - 40); g.stroke();
      g.strokeStyle = '#0a0608'; g.lineWidth = 9; g.beginPath(); g.moveTo(cx - 330, cy + 20); g.quadraticCurveTo(cx, cy + 150, cx + 330, cy + 10); g.stroke();
      for (let i = 0; i < 34; i++) { const u = i / 33, x = cx - 320 + u * 640, y = cy + 20 + Math.sin(u * Math.PI) * 64; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + 40, x + 22 * (u - .5), y + 70 + Math.sin(u * Math.PI) * 10); g.stroke(); }
      g.restore();
      grade('#2a2a8a', .3);
      // REM trace
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#ff5ad8'; g.shadowColor = '#ff5ad8'; g.shadowBlur = 16; g.lineWidth = 5; g.beginPath(); for (let i = 0; i <= 200; i++) { const x = 80 + i * 4.6, tt2 = lt - (200 - i) * .012, v = tt2 > .5 ? Math.sin(tt2 * 9) * .5 + Math.sin(tt2 * 15.3) * .35 : 0; i ? g.lineTo(x, 470 - v * 70) : g.moveTo(x, 470 - v * 70); } g.globalAlpha = seg(lt, .4, 1); g.stroke(); g.restore();
    },
    ui(lt, D) { const tb = word('rem', 'быстрого'); title('БЫСТРЫЙ СОН', 260, seg(lt, tb - .1, tb + .4), 120, { fill: '#ffd0f4', glow: 'rgba(255,80,200,.7)' }); chip('ГЛАЗА БЕГАЮТ ПОД ВЕКАМИ', W / 2, 1290, seg(lt, word('rem', 'глаза'), word('rem', 'глаза') + .4), 40, '#ff8ae0'); },
  },
  memory: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#070a1a'], [1, '#020308']]); g.fillRect(0, 0, W, H); G = g;
      bokeh(30, 11, 0, 0, W, H, ['#3050ff', '#a040ff'], 10, 40, .25, t, 6);
      const cx = 540, cy = 880;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 140; i++) { const q = hash(i) * TAU, r = Math.sqrt(hash(i + 1)), x = cx + Math.cos(q) * r * 330 - 10, y = cy + Math.sin(q) * r * 200 - 30; const hip = Math.hypot(x - (cx + 20), y - (cy + 90)) < 90; if (hip) continue; const fl = .6 + .4 * Math.sin(t * 4 + i); g.globalAlpha = fl; g.fillStyle = i % 3 ? '#7ab8ff' : '#e080ff'; g.beginPath(); g.arc(x, y, 3 + 3 * hash(i + 2), 0, TAU); g.fill();
        if (i % 4 === 0) { const j = (i * 7) % 140, q2 = hash(j) * TAU, r2 = Math.sqrt(hash(j + 1)); g.globalAlpha = .25 * fl; g.strokeStyle = '#7ab8ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(cx + Math.cos(q2) * r2 * 330 - 10, cy + Math.sin(q2) * r2 * 200 - 30); g.stroke(); } }
      g.restore();
      brain(cx, cy, 2.2, t, 1);
      // the memory centre: dim, flickering
      const tw = word('memory', 'записывает'), dim = seg(lt, tw, tw + .6), fl = (hash(Math.floor(t * 14)) > .7 ? .5 : 1);
      g.save(); g.translate(cx + 20, cy + 90); g.rotate(-.4); g.beginPath(); g.ellipse(0, 0, 70, 30, 0, 0, TAU); g.fillStyle = `rgba(255,200,120,${lerp(.85, .12, dim) * fl})`; g.shadowColor = '#ffb050'; g.shadowBlur = lerp(50, 5, dim); g.fill(); g.restore();
      grade('#3a1a8a', .25);
    },
    ui(lt, D, t) {
      const tw = word('memory', 'записывает'), tn = word('memory', 'Поэтому');
      title('ЗАПИСЬ ПАМЯТИ', 260, seg(lt, tw - .1, tw + .4), 110, { fill: '#ffe0b0', glow: 'rgba(255,160,60,.6)' });
      if (lt > tw + .3) { const p = seg(lt, tw + .3, tw + .7); g.save(); g.globalAlpha = eo(p); g.strokeStyle = '#ffd090'; g.lineWidth = 4; g.beginPath(); g.moveTo(580, 990); g.lineTo(700, 1150); g.lineTo(880, 1150); g.stroke(); g.restore(); chip('РАБОТАЕТ СЛАБО', 760, 1150, p, 38, '#ffb050'); }
      if (lt > tn) { const p = seg(lt, tn, tn + .4), on = Math.floor(t * 2) % 2; g.save(); g.globalAlpha = eo(p); g.translate(W / 2, 420); g.beginPath(); g.roundRect(-230, -60, 460, 120, 20); g.fillStyle = 'rgba(0,0,0,.6)'; g.fill(); g.strokeStyle = '#ff4058'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.arc(-160, 0, 22, 0, TAU); g.fillStyle = on ? '#ff4058' : '#401018'; g.fill(); g.font = '500 56px Oswald'; g.letterSpacing = '8px'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('REC', -110, 4); g.strokeStyle = '#ff4058'; g.lineWidth = 8; g.beginPath(); g.moveTo(-120, 0); g.lineTo(120, 0); g.globalAlpha = eo(seg(lt, tn + .4, tn + .8)); g.stroke(); g.restore(); title('НЕ СОХРАНЯЕТСЯ', 540, seg(lt, tn + .4, tn + .8), 70, { fill: '#ff8090' }); }
    },
  },
  phone: {
    w(lt, D, t) {
      bedroom(false, t); G = g; bed(1290);
      const hands = guy({ x: 420, y: 900, s: 2.2, nod: .2, eye: .85, girl: true, base: '#1c1a26', rim: '#ffc8a0', rdx: 5, rdy: -2, face: { x: 120, y: -60, r: 190, col: 'rgba(170,205,255,.75)', a: .9 }, arms: [[[-40, 140], [40, 260], [160, 60]]] });
      phone(hands[0][0] + 14, hands[0][1] - 56, -.35); glow(hands[0][0] + 10, hands[0][1] - 60, 420, 'rgba(140,190,255,.5)', .8);
      blanket(1240, lt, ['#7a7aa8', '#2a2a46'], 'rgba(255,200,160,.4)');
      const u = seg(lt, word('phone', 'исчезает') - .8, word('phone', 'исчезает') + 1.2);
      [['moon', 300, 560], ['house', 520, 440], ['fish', 760, 560], ['star', 640, 700]].forEach(([k, x, y], i) => { const ui = clamp(u * 1.3 - i * .1); icon(k, x, y - ui * 60, 1, (1 - ui) * .9 * seg(lt, .1, .6)); bubble(x, y - ui * 60, 120, (1 - ui) * .6 * seg(lt, .1, .6)); particlesOut(x, y, 60, ui, 36, i * 50); });
      grade('#4a3a8a', .2);
    },
    ui(lt, D) {
      const ti = word('phone', 'исчезает'), p = seg(lt, .4, .8), lv = 1 - .88 * eio(seg(lt, ti - .6, ti + 1.2));
      title('НЕСКОЛЬКО МИНУТ', 230, p, 96);
      if (p > 0) { g.save(); g.globalAlpha = eo(p); g.font = '500 40px Oswald'; g.letterSpacing = '5px'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.shadowColor = '#000'; g.shadowBlur = 12; g.fillText('СОН В ПАМЯТИ', 200, 340); g.textAlign = 'right'; g.fillText(Math.round(lv * 100) + '%', 880, 340); g.shadowBlur = 0; rr(200, 370, 680, 22, 11); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill(); rr(200, 370, 680 * lv, 22, 11); g.fillStyle = lv > .5 ? '#9fd0ff' : '#ff6080'; g.shadowColor = g.fillStyle; g.shadowBlur = 16; g.fill(); g.restore(); }
    },
  },
  paralysis: {
    w(lt, D, t) {
      bedroom(true, t); G = g; bed(1210, '#1a2040');
      lying({ eye: 0, rim: '#7fe0ff', rdx: 5, rdy: -2, halo: .7, face: { x: 80, y: -60, r: 200, col: 'rgba(120,200,255,.35)', a: .8 } });
      blanket(1110, lt, ['#3a4a80', '#121830'], 'rgba(127,224,255,.8)');
      const pul = .5 + .5 * Math.sin(lt * 2.5), tp = word('paralysis', 'парализовано');
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (.25 + .25 * pul) * seg(lt, tp - .5, tp + .3); g.shadowColor = '#7fe0ff'; g.shadowBlur = 60; g.strokeStyle = '#7fe0ff'; g.lineWidth = 6; g.beginPath(); g.ellipse(700, 1130, 470, 150, -.02, 0, TAU); g.stroke(); g.restore();
      // the dream: running figure that the body does not follow
      const dp = seg(lt, .3, .9); bubble(620, 640, 260, dp * .9); icon('run', 620 + Math.sin(lt * 6) * 10, 640, 2 + Math.sin(lt * 12) * .1, dp);
      if (seg(lt, tp, tp + .4) > 0) { const p = seg(lt, tp, tp + .4); g.save(); g.globalAlpha = eo(p); g.translate(620, 960); const k = back(p); g.scale(k, k); g.strokeStyle = '#bff0ff'; g.lineWidth = 9; g.shadowColor = '#7fe0ff'; g.shadowBlur = 20; g.beginPath(); g.arc(0, -40, 34, Math.PI, 0); g.stroke(); rr(-50, -40, 100, 80, 14); g.fillStyle = 'rgba(127,224,255,.25)'; g.fill(); g.stroke(); g.restore(); }
      grade('#1a4a8a', .3);
    },
    ui(lt, D) { const tp = word('paralysis', 'парализовано'); title('ТЕЛО', 230, seg(lt, tp - .2, tp + .2), 110); title('ПАРАЛИЗОВАНО', 350, seg(lt, tp, tp + .4), 100, { fill: '#bff0ff', glow: 'rgba(80,200,255,.8)' }); },
  },
  notebook: {
    w(lt, D, t) {
      bedroom(false, t); G = g;
      const tw = word('notebook', 'запишите') - .6, sit = eio(seg(lt, tw - .6, tw + .1));
      if (sit < .5) {
        bed(); lying({ eye: 0, rim: '#ffc8a0', rdx: 5, rdy: -2, halo: .3, face: { x: 80, y: -60, r: 200, col: 'rgba(255,200,160,.6)', a: .8 } }); blanket(1110, lt, ['#7a7aa8', '#2a2a46'], 'rgba(255,200,160,.4)');
        const tv = word('notebook', 'вспомните'); if (lt > tv) { const u = seg(lt, tv, tv + 1.2); ['moon', 'fish', 'house'].forEach((k, i) => { const p = seg(u, i * .25, i * .25 + .5); icon(k, 340 + i * 190, 720 - i * 50, 1.1, eo(p) * .9); bubble(340 + i * 190, 720 - i * 50, 120, eo(p) * .5); }); }
      } else {
        bed(1290);
        const wr = Math.sin(lt * 14) * 6;
        const hands = guy({ x: 400, y: 900, s: 2.2, nod: .45, eye: .8, girl: true, base: '#1c1a26', rim: '#ffc8a0', rdx: 5, rdy: -2, face: { x: 120, y: -40, r: 200, col: 'rgba(255,210,170,.6)', a: .9 }, arms: [[[-40, 140], [70, 300], [190 + wr, 250]]] });
        blanket(1300, lt, ['#7a7aa8', '#2a2a46'], 'rgba(255,200,160,.4)');
        // notebook
        g.save(); g.translate(720, 1290); g.rotate(-.12); rr(-170, -70, 340, 120, 10); g.fillStyle = '#efe6d2'; g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#3a4a8a'; g.lineWidth = 4; const n = Math.floor(seg(lt, tw, D) * 18); for (let i = 0; i < n; i++) { const r2 = Math.floor(i / 6), cI = i % 6; g.beginPath(); g.moveTo(-140 + cI * 46, -40 + r2 * 32); g.quadraticCurveTo(-125 + cI * 46, -48 + r2 * 32 + hash(i) * 10, -102 + cI * 46, -40 + r2 * 32); g.stroke(); } g.restore();
        g.save(); g.strokeStyle = '#d0b060'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(hands[0][0], hands[0][1]); g.lineTo(hands[0][0] + 30, hands[0][1] + 60); g.stroke(); g.restore();
      }
      grade('#5a3a7a', .2);
    },
    ui(lt, D) {
      const S = [['1', 'НЕ ДВИГАЙТЕСЬ', word('notebook', 'не двигайтесь')], ['2', 'ВСПОМНИТЕ', word('notebook', 'вспомните')], ['3', 'ЗАПИШИТЕ', word('notebook', 'запишите')]];
      S.forEach(([n, s, tt0], i) => { const p = seg(lt, tt0 - .1, tt0 + .3); if (p <= 0) return; g.save(); g.globalAlpha = eo(p); g.translate(150 + (1 - eo(p)) * -40, 200 + i * 110); g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.fillStyle = '#ffd08a'; g.shadowColor = '#ffb050'; g.shadowBlur = 20; g.fill(); g.shadowBlur = 0; g.font = '500 48px Oswald'; g.fillStyle = '#1a1020'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 3); g.textAlign = 'left'; g.font = '500 72px Oswald'; g.letterSpacing = '6px'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 24; g.fillText(s, 70, 4); g.restore(); });
    },
  },
  sub: {
    w(lt, D, t) {
      layer(10, () => { G.fillStyle = vgrad(0, H, [[0, '#ffcf8a'], [1, '#c87a50']]); G.fillRect(0, 0, W, H); glow(860, 420, 900, 'rgba(255,240,200,1)', 1); bokeh(16, 90, 400, 100, W, 900, ['#fff4d0', '#ffe0a0'], 20, 60, .5, t, 5); });
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(860, 420); for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.globalAlpha = .07 + .05 * Math.sin(t + i); g.fillStyle = '#fff4d0'; g.beginPath(); g.moveTo(0, 0); g.lineTo(1800, -70); g.lineTo(1800, 70); g.closePath(); g.fill(); } g.restore();
      G = g; dust(40, 5, 0, 300, W, 1500, t, '#fff', .6);
      rr(-40, 1300, 1160, 300, 40); g.fillStyle = '#7a5a6a'; g.fill();
      guy({ x: 360, y: 900, s: 2.2, nod: -.18, eye: lerp(.3, 1, seg(lt, .3, .9)), girl: true, base: '#2a1e1e', rim: '#fff0c8', rdx: 6, rdy: -3, halo: .5, face: { x: 100, y: -80, r: 220, col: 'rgba(255,220,170,.85)', a: .9 } });
      rr(-40, 1360, 1160, 400, 40); g.fillStyle = vgrad(1360, 1700, [[0, '#e8d8c8'], [1, '#a08878']]); g.fill();
      grade('#ff9a40', .2);
    },
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
  add('gasp', at('wake', .25)); add('dissolve', at('wake', .5), { d: 2.0 }); add('hit', w('wake', 'Почему'), { v: .5 });
  add('night', at('dreams', 0), { d: dur('dreams') + dur('rem') }); for (let i = 0; i < 5; i++) add('bloop', at('dreams', .4 + i * .45), { k: i });
  add('flutter', at('rem', .5), { d: dur('rem') - .7 }); add('hit', w('rem', 'быстрого') - .1, { v: .5 });
  add('neural', at('memory', 0), { d: dur('memory') }); add('down', w('memory', 'записывает'), { d: 1.2 }); add('beep', w('memory', 'Поэтому')); add('glitch', w('memory', 'Поэтому') + .4, { d: .6 });
  add('room', at('phone', 0), { d: dur('phone') }); add('dissolve', w('phone', 'исчезает') - .8, { d: 2.0 });
  add('night', at('paralysis', 0), { d: dur('paralysis') }); add('heart', at('paralysis', .3), { d: dur('paralysis') - .5 }); add('lock', w('paralysis', 'парализовано'));
  add('pop', w('notebook', 'не двигайтесь') - .1); add('pop', w('notebook', 'вспомните') - .1); add('pop', w('notebook', 'запишите') - .1); add('write', w('notebook', 'запишите'), { d: dur('notebook') - word('notebook', 'запишите') });
  add('birds', at('sub', 0), { d: dur('sub') }); add('swell', at('sub', 0), { d: dur('sub') }); add('click', w('sub', 'Подписывайтесь') + 1.3); add('chime', w('sub', 'Подписывайтесь') + 1.35);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
