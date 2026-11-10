// «Твой мозг тебя обманул» (inattentional blindness experiment) — cinematic 2D (light, silhouettes, depth blur, grain), vertical 1080×1920
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2;

// ———————————————————————————— timeline
const LINES = [
  ['hook', 'Сейчас я докажу, что твой мозг может быть обманут за десять секунд!'],
  ['task', 'Смотри внимательно на экран. Посчитай, сколько раз игроки в белых футболках передают друг другу мяч. Не отвлекайся!'],
  ['count', 'Сосредоточься! Считай передачи! Раз… два… три…'],
  ['shock', 'Стоп! А ты заметил гориллу?!'],
  ['reveal', 'Пока ты считал передачи, человек в костюме гориллы спокойно прошёл прямо перед камерой! И многие люди вообще его не замечают!'],
  ['explain', 'Это называется слепота невнимания. Когда мозг сосредоточен на одной задаче, он может пропустить даже очень заметные события!'],
  ['final', 'А теперь честно: ты заметил гориллу или нет? Напиши в комментариях!'],
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

// ———————————————————————————— the experiment kit
const GOLD = '#ffd24a', CY = '#7fe0ff';
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
function gorilla(x, y, s, ph, beat = 0, wave = 0) {
  const c = g, sw = Math.sin(ph) * 14, fur = '#0d0b0c', fur2 = '#1c1819'; c.save(); c.translate(x, y); c.scale(s, s);
  c.globalAlpha = .3; c.beginPath(); c.ellipse(0, 4, 120, 22, 0, 0, TAU); c.fillStyle = '#000'; c.fill(); c.globalAlpha = 1;
  c.lineCap = 'round'; c.strokeStyle = fur; c.lineWidth = 62; c.beginPath(); c.moveTo(-40, -130); c.lineTo(-46 - sw, -14); c.stroke(); c.beginPath(); c.moveTo(40, -130); c.lineTo(46 + sw, -14); c.stroke();
  c.beginPath(); c.ellipse(0, -235, 108, 130, 0, 0, TAU); const gr = c.createLinearGradient(-100, 0, 100, 0); gr.addColorStop(0, fur2); gr.addColorStop(1, fur); c.fillStyle = gr; c.fill();
  c.beginPath(); c.ellipse(0, -250, 60, 70, 0, 0, TAU); c.fillStyle = '#231e1f'; c.fill();
  // arms: hang, beat the chest, or wave
  c.strokeStyle = fur; c.lineWidth = 54;
  const bL = beat * (.5 + .5 * Math.sin(ph * 3)), bR = beat * (.5 - .5 * Math.sin(ph * 3));
  c.beginPath(); c.moveTo(-98, -320); c.quadraticCurveTo(-150 + 60 * bL, -220, lerp(-120 - sw, -30, bL), lerp(-110, -250, bL)); c.stroke();
  if (wave > 0) { c.beginPath(); c.moveTo(98, -320); c.quadraticCurveTo(170, -380, 150 + Math.sin(ph * 2) * 40 * wave, -500); c.stroke(); }
  else { c.beginPath(); c.moveTo(98, -320); c.quadraticCurveTo(150 - 60 * bR, -220, lerp(120 + sw, 30, bR), lerp(-110, -250, bR)); c.stroke(); }
  c.beginPath(); c.ellipse(0, -420, 74, 78, 0, 0, TAU); c.fillStyle = fur; c.fill(); c.beginPath(); c.ellipse(0, -472, 50, 40, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(0, -402, 50, 52, 0, 0, TAU); c.fillStyle = '#3a3331'; c.fill();
  c.fillStyle = fur; c.beginPath(); c.ellipse(0, -428, 48, 14, 0, 0, TAU); c.fill();
  c.fillStyle = '#e8d8c0'; for (const k of [-1, 1]) { c.beginPath(); c.arc(k * 20, -414, 6, 0, TAU); c.fill(); } c.fillStyle = '#050404'; for (const k of [-1, 1]) { c.beginPath(); c.arc(k * 20, -414, 3, 0, TAU); c.fill(); c.beginPath(); c.arc(k * 9, -392, 4, 0, TAU); c.fill(); }
  c.strokeStyle = '#120e0e'; c.lineWidth = 5; c.beginPath(); c.moveTo(-22, -372); c.quadraticCurveTo(0, -364, 22, -372); c.stroke();
  c.restore();
}
// game clock is local to the 'task' scene start; the same clock runs through 'count'
const GAME = (() => {
  const T0 = () => SCN.task.t0, tEnd = SCN.count.t1 - SCN.task.t0, TW = Math.max(1.0, word('task', 'Посчитай') + .2), PW = 1.2, FL = .5, TB = TW + .55, PB = 1.37;
  const gA = SCN.count.t0 - 1.0 - SCN.task.t0, gB = tEnd - .25;
  const base = [[230, 1010], [560, 965], [870, 1020], [300, 1250], [650, 1290], [900, 1220]], WH = [0, 4, 2], BL = [3, 1, 5];
  const pos = (i, tg) => { const [bx, by] = base[i]; const x = bx + 95 * Math.sin(tg * (.55 + .13 * i) + i * 2.1), y = by + 45 * Math.sin(tg * (.43 + .11 * i) + i * 1.3); return [x, y, .72 + (y - 940) / 420 * .46]; };
  const ballAt = (team, tg) => { const [st, per, ids] = team ? [TW, PW, WH] : [TB, PB, BL]; const k = Math.floor((tg - st) / per), fr = tg - st - k * per; const hold = i => { const [x, y, s] = pos(i, tg); return [x + 46 * s, y - (215 + Math.abs(Math.sin(tg * 7 + i)) * 26) * s, s]; };
    if (tg < st) return hold(ids[0]); const a = hold(ids[((k % 3) + 3) % 3]), b = hold(ids[(k + 1) % 3]); if (fr < FL) { const u = fr / FL; return [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * 130, lerp(a[2], b[2], u)]; } return b; };
  const N = Math.max(0, Math.floor((tEnd - TW - FL) / PW) + 1);
  const gor = tg => { const u = (tg - gA) / (gB - gA); if (u <= 0 || u >= 1) return null; const x = u < .4 ? lerp(1200, 560, u / .4) : u < .6 ? 560 : lerp(560, -130, (u - .6) / .4); return { x, y: 1135, beat: u > .42 && u < .58 ? 1 : 0, u }; };
  const passes = (team) => { const [st, per] = team ? [TW, PW] : [TB, PB], out = []; for (let k = 0; st + k * per < tEnd - .1; k++) out.push(st + k * per); return out; };
  return { tEnd, gA, gB, N, pos, ballAt, gor, passes, T0 };
})();
function drawGame(tg, o = {}) {
  const items = []; for (let i = 0; i < 6; i++) { const [x, y, s] = GAME.pos(i, tg); items.push({ y, f: () => player(x, y, s, [0, 4, 2].includes(i), tg * 5 + i * 2) }); }
  const gr = o.noGor ? null : GAME.gor(tg); if (gr) items.push({ y: gr.y, f: () => gorilla(gr.x, gr.y + Math.abs(Math.sin(tg * 6)) * (gr.beat ? 0 : 8), .86, tg * 6, gr.beat) });
  items.sort((a, b) => a.y - b.y).forEach(it => it.f());
  for (const tm of [0, 1]) { const [x, y, s] = GAME.ballAt(tm, tg); ball(x, y, 34 * s); }
  return gr;
}

// ———————————————————————————— scenes
const DESK = 1360;
const SH = {
  hook: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#0a0618'], [1, '#04030a']]); g.fillRect(0, 0, W, H); G = g;
      bokeh(26, 21, 0, 0, W, H, ['#ff4070', '#7a50ff', '#40c0ff'], 12, 44, .3, t, 6);
      const z = 1 + .12 * eio(lt / D); g.save(); g.translate(540, 900); g.scale(z, z); g.translate(-540, -900);
      brain(540, 900, 2.5, t, 1); const k = Math.floor(t * 8); if (hash(k) > .55) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25; g.drawImage(cv, (hash(k + 1) - .5) * 40, 0); g.restore(); }
      g.restore(); grade('#5a1a8a', .25);
    },
    ui(lt, D, t) { const to = word('hook', 'обманут') - .2, tn = word('hook', 'десять') - .2; title('ТВОЙ МОЗГ', 240, seg(lt, .1, .4), 140); title('МОЖНО ОБМАНУТЬ', 390, seg(lt, to, to + .3), 104, { fill: '#ff6a8a', glow: 'rgba(255,40,90,.9)', rgb: 4 }); title('ЗА 10 СЕКУНД', 1320, seg(lt, tn, tn + .3), 130, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); },
  },
  task: {
    w(lt, D, t) { gym(t); drawGame(lt); grade('#2a5a60', .12); },
    ui(lt, D, t) {
      const tp = word('task', 'Посчитай') - .1, tw = word('task', 'белых') - .2, tn = word('task', 'Не отвлекайся') - .1;
      title('СМОТРИ ВНИМАТЕЛЬНО', 230, seg(lt, .1, .4) * (1 - seg(lt, tp - .2, tp)), 90);
      title('СЧИТАЙ ПЕРЕДАЧИ', 220, seg(lt, tp, tp + .3), 100); title('БЕЛЫХ ФУТБОЛОК', 340, seg(lt, tw, tw + .3), 100, { fill: '#ffffff', glow: 'rgba(255,255,255,.7)' });
      if (lt > tw && lt < tw + 2.2) { const a = seg(lt, tw, tw + .3) * (1 - seg(lt, tw + 1.8, tw + 2.2)) * (.6 + .4 * Math.sin(t * 9)); for (const i of [0, 4, 2]) { const [x, y, s] = GAME.pos(i, lt); g.save(); g.globalAlpha = a; g.strokeStyle = GOLD; g.lineWidth = 6; g.shadowColor = GOLD; g.shadowBlur = 16; g.beginPath(); g.ellipse(x, y - 210 * s, 110 * s, 230 * s, 0, 0, TAU); g.stroke(); g.restore(); } }
      chip('НЕ ОТВЛЕКАЙСЯ!', W / 2, 470, seg(lt, tn, tn + .3), 44, '#ff6a8a');
    },
  },
  count: {
    w(lt, D, t) { gym(t); drawGame(lt + SCN.count.t0 - SCN.task.t0); grade('#2a5a60', .12); },
    ui(lt, D, t) { title('СЧИТАЙ ПЕРЕДАЧИ', 220, 1, 100); title('БЕЛЫХ ФУТБОЛОК', 340, 1, 100, { fill: '#ffffff', glow: 'rgba(255,255,255,.7)' }); },
  },
  shock: {
    w(lt, D, t) {
      const z = 1 + .06 * eo(seg(lt, 0, .4)); g.save(); g.translate(540, 1100); g.scale(z, z); g.translate(-540, -1100); gym(SCN.shock.t0); drawGame(GAME.tEnd); g.restore();
      grade('#000000', .45, 'source-over'); grade('#8a0a20', .35);
      if (lt < .3) { g.fillStyle = `rgba(255,255,255,${1 - lt / .3})`; g.fillRect(0, 0, W, H); }
    },
    ui(lt, D, t) {
      const tq = word('shock', 'А ты') - .1;
      title('СТОП!', 520, seg(lt, 0, .2) * (1 - seg(lt, tq - .15, tq)), 300, { fill: '#ff3050', glow: 'rgba(255,0,40,.9)', x: W / 2 + Math.sin(t * 60) * 8 * (1 - seg(lt, 0, .5)) });
      title('А ТЫ ЗАМЕТИЛ', 420, seg(lt, tq, tq + .25), 120); title('ГОРИЛЛУ?!', 600, seg(lt, tq + .25, tq + .5), 190, { fill: GOLD, glow: 'rgba(255,150,20,.9)' });
    },
  },
  reveal: {
    w(lt, D, t) {
      const rw = .7, tg = lt < rw ? lerp(GAME.tEnd, GAME.gA, eio(lt / rw)) : lerp(GAME.gA, GAME.gB, seg(lt, rw, D - .2));
      gym(t); const gr = drawGame(tg); grade('#2a5a60', .12);
      if (lt < rw) { g.save(); g.globalAlpha = .25; g.fillStyle = '#fff'; for (let i = 0; i < 12; i++) g.fillRect(0, ((t * 1900 + i * 170) % H), W, 8 + hash(i) * 20); g.restore(); }
      else if (gr) { const a = seg(lt, rw, rw + .4); g.save(); g.globalAlpha = .68 * a; g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, W, H); g.ellipse(gr.x, gr.y - 215, 190, 290, 0, 0, TAU); g.fill('evenodd'); g.restore(); g.save(); g.globalAlpha = a; g.strokeStyle = GOLD; g.lineWidth = 8; g.shadowColor = GOLD; g.shadowBlur = 24; g.beginPath(); g.ellipse(gr.x, gr.y - 215, 190, 290, 0, 0, TAU); g.stroke(); g.restore(); }
    },
    ui(lt, D, t) {
      const tm = word('reveal', 'И многие') - .1;
      if (lt < .7) title('« ПЕРЕМОТКА', 300, 1, 90, { fill: '#fff' });
      else { chip('ПОВТОР', 190, 150, 1, 40, '#ff6a8a'); title('ВОТ ОНА!', 250, seg(lt, .8, 1.1) * (1 - seg(lt, tm - .2, tm)), 150, { fill: GOLD, glow: 'rgba(255,150,20,.9)' }); title('МНОГИЕ ЕЁ', 220, seg(lt, tm, tm + .3), 100); title('НЕ ЗАМЕЧАЮТ', 340, seg(lt, tm + .2, tm + .5), 110, { fill: '#ff6a8a', glow: 'rgba(255,40,90,.9)' }); chip(`БЕЛЫЕ СДЕЛАЛИ ПЕРЕДАЧ: ${GAME.N}`, W / 2, 470, seg(lt, 1.6, 2.0), 38, '#ffffff'); }
    },
  },
  explain: {
    w(lt, D, t) {
      g.fillStyle = vgrad(0, H, [[0, '#070a1a'], [1, '#020308']]); g.fillRect(0, 0, W, H); G = g; bokeh(24, 11, 0, 0, W, H, ['#3050ff', '#a040ff'], 10, 40, .22, t, 6);
      const tk = word('explain', 'Когда') - .2, f = eio(seg(lt, tk, tk + .8));
      brain(540, 640, 1.5, t, 1);
      // focus beam on the task, the rest of the world goes dark
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .28 * f; const gr = g.createLinearGradient(540, 700, 300, 1300); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(1, 'rgba(255,246,192,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(500, 740); g.lineTo(580, 740); g.lineTo(520, 1290); g.lineTo(60, 1290); g.closePath(); g.fill(); g.restore();
      player(260, 1280, .95, true, t * 4); ball(350, 1070 - Math.abs(Math.sin(t * 5)) * 60, 34); glow(300, 1100, 320, 'rgba(255,240,180,.35)', f);
      g.save(); g.globalAlpha = lerp(1, .16, f); gorilla(800, 1290, .9, t * 4, 0, 1); g.restore();
      grade('#3a1a8a', .22);
    },
    ui(lt, D, t) {
      const ts = word('explain', 'слепота') - .2, tk = word('explain', 'Когда') - .2, tp = word('explain', 'пропустить') - .2;
      title('СЛЕПОТА', 210, seg(lt, ts, ts + .3), 130); title('НЕВНИМАНИЯ', 340, seg(lt, ts + .2, ts + .5), 120, { fill: GOLD, glow: 'rgba(255,150,20,.9)' });
      chip('ФОКУС', 280, 830, seg(lt, tk, tk + .3), 40, '#fff6c0'); chip('НЕ ЗАМЕЧЕНО', 800, 760, seg(lt, tp, tp + .3), 40, '#ff6a8a');
    },
  },
  final: {
    w(lt, D, t) { gym(t); g.save(); g.globalAlpha = .5; for (const [i, x] of [[0, 190], [1, 900]]) player(x, 1040, .62, !i, t * 4 + i); g.restore(); gorilla(540, 1440, 1.45, t * 5, 0, 1); grade('#2a5a60', .12); },
    ui(lt, D, t) {
      const tq = word('final', 'ты заметил') - .2, tn = word('final', 'Напиши') - .1;
      title('А ТЕПЕРЬ ЧЕСТНО:', 200, seg(lt, .1, .4), 90); title('ТЫ ЗАМЕТИЛ ГОРИЛЛУ?', 320, seg(lt, tq, tq + .3), 80, { fill: GOLD, glow: 'rgba(255,150,20,.9)' });
      const btn = (x, s, col, p) => { if (p <= 0) return; g.save(); g.translate(x, 470); const k = back(p) * (1 + .04 * Math.sin(t * 6 + x)); g.scale(k, k); g.globalAlpha = clamp(p * 3); g.beginPath(); g.roundRect(-200, -62, 400, 124, 62); g.fillStyle = col; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.fill(); g.shadowBlur = 0; g.font = '500 60px Oswald'; g.letterSpacing = '5px'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 4); g.restore(); };
      btn(300, 'ДА', '#22a85a', seg(lt, tq + .4, tq + .7)); btn(780, 'НЕТ', '#e8303e', seg(lt, tq + .6, tq + .9));
      chip('ПИШИ В КОММЕНТАРИЯХ', W / 2, 610, seg(lt, tn, tn + .3), 44, '#ffffff');
    },
  },
};

// ———————————————————————————— subtitles: large, white, key words yellow
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('десять секунд', '10 секунд');
const KEYS = ['мозг', 'обманут', 'белых', 'мяч', 'считай', 'посчитай', 'стоп', 'горилл', 'слепота', 'невнимания', 'честно', 'комментариях', 'отвлекайся'];
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
  add('boom', at('hook', .05)); add('glitch', at('hook', .3), { d: dur('hook') - .5 }); add('hit', w('hook', 'десять') - .2);
  add('room', at('task', 0), { d: dur('task') + dur('count') }); add('game', at('task', 0), { d: dur('task') + dur('count') });
  for (const tm of [0, 1]) for (const p of GAME.passes(tm)) { add('bounce', at('task', p), { v: tm ? 1 : .7 }); add('bounce', at('task', p + .5), { v: tm ? .8 : .5, catch: 1 }); }
  for (let k = 0; k < (dur('task') + dur('count')) / .9; k++) add('squeak', at('task', .4 + k * .9 + hash(k) * .4));
  add('pop', w('task', 'Посчитай') - .1); add('ding', w('task', 'Не отвлекайся') - .1);
  add('scratch', at('shock', 0)); add('boom', at('shock', .05)); add('hit', w('shock', 'А ты') + .15);
  add('rewind', at('reveal', 0), { d: .7 }); add('room', at('reveal', .7), { d: dur('reveal') - .7 }); add('ding', at('reveal', .85)); const u0 = .7, u1 = dur('reveal') - .2; for (let k = 0; k < 6; k++) add('thump', at('reveal', lerp(u0, u1, .43 + k * .025)), { v: .8 });
  add('neural', at('explain', 0), { d: dur('explain') }); add('hit', w('explain', 'слепота') - .2, { v: .7 }); add('down', w('explain', 'Когда') - .2, { d: 1.0 }); add('pop', w('explain', 'пропустить') - .2);
  add('room', at('final', 0), { d: dur('final') }); add('swell', at('final', 0), { d: dur('final') }); add('pop', w('final', 'ты заметил') + .2); add('pop', w('final', 'ты заметил') + .4); add('chime', w('final', 'Напиши'));
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СНЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
