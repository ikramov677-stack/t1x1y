// «Операция "Крошка"» — серия 1. 2D-мультфильм, всё нарисовано кодом. 1920×1080.
// Персонажи молчат; закадровый голос — в стиле документального фильма о дикой природе.
const W = 1920, H = 1080, FLOOR = 880, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const lin = x => clamp(x), step = () => 0, ei = x => clamp(x) ** 2;
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2, PI = Math.PI;
const pulse = (t, a, b) => seg(t, a, a + .15) * (1 - seg(t, b - .15, b));        // 0→1→0 window
const arc = u => 4 * u * (1 - u);
// keyframes: [[t, v, ease?], ...]; two keys at the same t = a cut
function K(keys, def = eio) {
  return t => { let i = -1; for (let j = 0; j < keys.length; j++) if (keys[j][0] <= t) i = j;
    if (i < 0) return keys[0][1]; if (i === keys.length - 1) return keys[i][1];
    const a = keys[i], b = keys[i + 1]; return lerp(a[1], b[1], (b[2] || def)((t - a[0]) / (b[0] - a[0]))); };
}
const L = keys => K(keys, lin);

// ———————————————————————————— закадровый текст (черновик: время по сценарию; голос можно подложить позже)
const LINES = [
  [9.0, 'Обычная квартира. Обычное утро. Но на полу лежит то, что изменит всё… крошка.'],
  [19.2, 'А это Жужа. Он пылесос. Но сам он об этом не знает и считает себя героем.'],
  [32.0, 'Голубь Гоша. Вес — как у небольшой курицы. Цель в жизни — еда. Других целей нет.'],
  [43.0, 'Гоша прибегает к хитрости. Ну, к тому, что он считает хитростью.'],
  [52.0, 'Герой выдвигается на задание.'],
  [58.2, 'Задание временно откладывается.'],
  [76.2, 'Гоша применяет древнюю технику маскировки: «Я носок».'],
  [91.8, 'Жужа подозревает неладное. Носки в этом доме обычно не ходят.'],
  [105.5, 'Погоня. Самая медленная и самая громкая погоня в истории этой квартиры.'],
  [133.0, 'Решающий момент. Два охотника — одна крошка.'],
  [169.5, 'Учёные до сих пор спорят, кто из них победил.'],
  [175.6, 'Ответ: диван.'],
  [203.0, 'В природе всё решает сила. В квартире всё решает бабушка.'],
  [215.6, 'Злодей получил целое печенье. Герой получил пыль.'],
  [233.2, 'А настоящий победитель, как всегда, молчит.'],
  [239.8, 'Но Жужа всё видел.'],
  [242.6, 'Продолжение следует…'],
];
const VOICE = null;            // после записи голоса: [[t0,t1], ...] по строкам LINES (секунды в voice.wav)
const VOICE_OFFSET = 0;
const DUR = 251;
const SUBS = (() => {
  const out = [];
  LINES.forEach(([t, s], i) => {
    const span = VOICE ? [VOICE[i][0] + VOICE_OFFSET, VOICE[i][1] + VOICE_OFFSET] : [t, t + Math.max(1.4, s.length / 13.5)];
    // split long lines into sentences
    const parts = s.match(/[^.!?…:]+[.!?…:]+[»]?|[^.!?…:]+$/g).map(x => x.trim()).filter(Boolean);
    const merged = []; for (const p of parts) { if (merged.length && (merged[merged.length - 1] + ' ' + p).length < 46) merged[merged.length - 1] += ' ' + p; else merged.push(p); }
    const tot = merged.reduce((a, p) => a + p.length, 0); let a = span[0];
    for (const p of merged) { const d = (span[1] - span[0]) * p.length / tot; out.push({ a, b: a + d, text: p }); a += d; }
  });
  return out;
})();

const cv = document.getElementById('ov'), g = cv.getContext('2d');
let G = g;

// ———————————————————————————— helpers
function rr(x, y, w, h, r) { G.beginPath(); G.roundRect(x, y, w, h, r); }
function ell(x, y, rx, ry, rot = 0) { G.beginPath(); G.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); }
function fillE(x, y, rx, ry, col, rot = 0) { ell(x, y, rx, ry, rot); G.fillStyle = col; G.fill(); }
function glow(x, y, r, col, a = 1, op = 'lighter') { const c = G; c.save(); c.globalCompositeOperation = op; c.globalAlpha = a; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
function lgrad(x0, y0, x1, y1, stops) { const gr = G.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function shadow(x, w, a = .25, y = FLOOR) { G.save(); G.globalAlpha = a; fillE(x, y + 2, w, w * .12, '#3a2414'); G.restore(); }
const INK = '#2b1d16';
function ink(w = 4) { G.lineWidth = w; G.strokeStyle = INK; G.lineJoin = 'round'; G.lineCap = 'round'; G.stroke(); }
const CK_CV = document.createElement('canvas'); CK_CV.width = CK_CV.height = 128; const CK_G = CK_CV.getContext('2d');
function cookie(x, y, r, rot = 0, bite = 0) {
  const keep = G; let c = G;
  if (bite > 0) { c = CK_G; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 128, 128); c.save(); c.translate(64, 64); c.scale(40 / r, 40 / r); G = c; } else { c.save(); c.translate(x, y); }
  c.rotate(rot);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#d99a4e'; c.fill(); c.lineWidth = r * .1; c.strokeStyle = '#a8662b'; c.stroke();
  c.fillStyle = '#5a3218'; for (let i = 0; i < 6; i++) { const a = i * 1.7, d = r * (.25 + .45 * hash(i + 3)); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r * .11, 0, TAU); c.fill(); }
  c.globalAlpha = .35; c.beginPath(); c.arc(-r * .3, -r * .35, r * .35, 0, TAU); c.fillStyle = '#fff2c8'; c.fill(); c.globalAlpha = 1;
  if (bite > 0) { c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < Math.ceil(bite * 3); i++) { c.beginPath(); c.arc(r * .95 * Math.cos(-.6 + i * .8 - rot), r * .95 * Math.sin(-.6 + i * .8 - rot), r * .42, 0, TAU); c.fill(); } }
  c.restore(); G = keep;
  if (bite > 0) { const s = r / 40; G.drawImage(CK_CV, x - 64 * s, y - 64 * s, 128 * s, 128 * s); }
}
function crumbShape(x, y, s = 1, rot = 0) { const c = G; c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.beginPath(); for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, r = 10 + 4 * hash(i * 3.3); c.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * .9); } c.closePath(); c.fillStyle = '#d99a4e'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#8c5322'; c.stroke(); c.beginPath(); c.arc(1, 0, 3, 0, TAU); c.fillStyle = '#5a3218'; c.fill(); c.restore(); }

// ———————————————————————————— сюжет: состояния персонажей по времени
// Жужа
const ZX = L([[0, 560], [51, 560], [56.4, 760, ei], [57.0, 700, eo], [61, 700], [62.4, 760, ei], [62.9, 715, eo], [63.6, 715], [64.4, 780, ei], [64.9, 735, eo], [65.6, 735], [66.4, 800, ei], [66.9, 750, eo], [67.6, 750], [68.4, 820, ei], [68.9, 770, eo], [70, 770],
  [70.01, 1550], [100, 1550], [103.5, 1550], [118, 400], [121, 400], [122.5, 300], [130, 1720, eo], [141, 1720], [151, 1800], [156, 1560, eo], [201, 1560], [201.6, 1620, eo], [251, 1620]]);
const ZFACE = L([[0, 1], [57.0, 1], [57.2, -1], [57.5, 1], [57.8, -1], [58.1, 1], [70, 1], [70.01, -1], [85, -1], [85.25, 1], [88, 1], [88.25, -1], [90.5, -1], [90.65, 1], [94, 1], [94.25, -1], [96, -1], [96.2, 1],
  [101.5, 1], [102.3, .4], [102.9, .7], [103.5, -1], [121, -1], [122.4, -1], [122.5, 1], [212, 1], [212.4, -1], [216, -1], [216.4, 1]]);
const ZLIFT = t => (t > 142 && t < 151 ? 170 * arc(seg(t, 142, 151)) : 0) + (t > 56.4 && t < 57.1 ? 18 * arc(seg(t, 56.4, 57.1)) : 0) + (t > 201 && t < 201.6 ? 40 * arc(seg(t, 201, 201.6)) : 0);
function zz(t) {
  const o = { x: ZX(t), face: ZFACE(t), lift: ZLIFT(t), on: seg(t, 17.4, 17.9), mood: 'norm', open: 1, tilt: 0, sy: 1, cape: t > 18.6, pan: t > 121 && t < 201.4, dust: seg(t, 213.9, 214.5), hum: 0, siren: 0, spin: 0 };
  // eyes
  const bl = (a) => 1 - pulse(t, a, a + .32) * .95;
  o.open = Math.min(bl(18.2), bl(18.7), bl(28.4), bl(47.0), bl(110), bl(150.5) * 0 + 1, bl(225));
  if (t < 17.4) o.open = 0;
  if (t > 23.8 && t < 70) o.mood = 'focus';
  if (t > 57 && t < 60.5) o.mood = 'dizzy';
  if (t > 61 && t < 70) o.mood = 'focus';
  if (t > 70 && t < 85) o.mood = 'norm';
  if ((t > 85.25 && t < 88) || (t > 96.2 && t < 98)) o.mood = 'sus';
  if (t > 90.65 && t < 94) o.mood = 'q';
  if (t > 98 && t < 141) o.mood = 'alarm';
  if (t >= 141 && t < 156) o.mood = 'focus';
  if (t >= 156 && t < 201) o.mood = 'dizzy';
  if (t >= 201 && t < 212) o.mood = 'norm';
  if (t >= 212 && t < 214) o.mood = 'focus';
  if (t >= 214 && t < 238.6) o.mood = 'sad';
  if (t >= 238.6) o.mood = 'narrow';
  if (t > 98 && t < 130) o.siren = 1;
  if (t > 56.4 && t < 58.4) o.spin = seg(t, 56.4, 58.4);
  if (t > 156 && t < 201) { o.sy = .78; o.tilt = Math.sin(t * 9) * .02; }
  if (t > 141 && t < 151) o.tilt = -.12 * arc(seg(t, 142, 151));
  // motor
  if (t > 19 && t < 26) o.hum = .3;
  if (t > 51 && t < 70) o.hum = .7;
  if (t > 98 && t < 130) o.hum = 1;
  if (t > 141 && t < 199) o.hum = .7;
  if (t > 213 && t < 214.5) o.hum = 1;
  if (t > 83 && t < 98) o.hum = .2;
  return o;
}
// Гоша
const GX = L([[0, 3420], [29, 3420], [30.3, 3110, eo], [70, 3110], [70.01, 2905], [74.5, 2930], [78, 2930], [80, 2900], [82, 2900], [85, 2650], [88, 2650], [90.5, 2400], [94, 2400], [96, 2150], [100, 2150], [101.5, 1350, lin], [116, 250], [121, 250], [129.5, 2060, eo], [141, 2060],
  [151, 1950], [156, 1720, eo], [199, 1720], [199.6, 1880, eo], [222, 1880], [226, 2860], [228.2, 2930], [251, 2930]]);
const GY = t => {
  if (t < 29) return 300;
  if (t < 30.3) return lerp(300, 620, eo(seg(t, 29, 30.3))) - 80 * arc(seg(t, 29, 30.3));
  if (t < 70) return 620;
  if (t < 73.5) return 186;
  if (t < 74.5) return lerp(186, 690, ei(seg(t, 73.5, 74.5)));
  if (t < 78) return 690;
  if (t < 80) return lerp(690, FLOOR, seg(t, 78, 80)) - 120 * arc(seg(t, 78, 80));
  if (t > 100 && t < 101.5) return FLOOR - 320 * arc(seg(t, 100, 101.5));
  if (t > 141 && t < 151) return FLOOR - 260 * arc(seg(t, 141, 151));
  if (t > 199 && t < 199.6) return FLOOR - 70 * arc(seg(t, 199, 199.6));
  if (t > 226 && t < 228.2) return lerp(FLOOR, 186, eio(seg(t, 226, 228.2))) - 60 * arc(seg(t, 226, 228.2));
  if (t >= 228.2) return 186;
  return FLOOR;
};
const GFACE = L([[0, -1], [30, -1], [70, -1], [74.5, -1], [76, 1], [77, 1], [77.3, -1], [129.5, -1], [130, -1], [141, -1], [199, -1], [199.3, 1], [251, 1]]);
function gs(t) {
  const o = { x: GX(t), y: GY(t), face: GFACE(t), walk: 0, sock: seg(t, 77.2, 77.6) * (t < 199 ? 1 : 0), flap: 0, pose: 'stand', eye: 'norm', squash: 1, press: 0, sign: 0, cookie: t > 203.6 && t < 251, hearts: pulse(t, 204, 210), vis: t > 28.9 && t < 228.2 };
  const dx = (dt) => Math.abs(GX(t + dt) - GX(t - dt)) / (2 * dt);
  const sp = dx(.05); o.walk = sp > 5 ? t * (sp > 120 ? 9 : 6) : 0;
  if (t >= 101.5 && t < 116 || t > 121 && t < 129.5) o.walk = t * 13;        // legs blur, progress slow
  if (t > 29 && t < 30.3) o.flap = (t * 8) % 1;
  if (t >= 30.3 && t < 40) o.press = 1;
  if (t >= 40 && t < 50) o.sign = t < 47 ? 1 : 2;
  if (t >= 70 && t < 73.5) o.pose = 'squeeze';
  if (t >= 73.5 && t < 74.5 || t > 78 && t < 80 || t > 100 && t < 101.5 || t > 141 && t < 151 || t > 226 && t < 228.2) o.flap = (t * 6) % 1;
  if ((t >= 85 && t < 88) || (t > 96 && t < 98.4)) { o.pose = 'flop'; o.walk = 0; }
  if (t >= 90.5 && t < 94) { o.pose = 'stiff'; o.walk = 0; }
  if (t > 98.4 && t < 100) { o.eye = 'wide'; o.pose = 'stand'; }
  if (t >= 130 && t < 141) o.eye = 'sly';
  if (t >= 151 && t < 199) { o.squash = lerp(1, .42, eo(seg(t, 155.6, 156))); o.eye = 'dizzy'; o.walk = t > 158 ? t * 7 : 0; }
  if (t >= 199 && t < 203.6) o.eye = 'wide';
  if (t >= 203.6 && t < 222) o.eye = 'heart';
  if (t > 30.3 && t < 40) o.eye = 'wide';
  if (t > 40 && t < 50) o.eye = 'sly';
  return o;
}
// Бабушка
const BX = L([[0, -150], [1.5, -150], [13.5, 3650], [190, 3650], [197, 2000, eo], [199.4, 2000], [200.3, 1840], [201.4, 1840], [202.6, 2085], [223, 2085], [232, 3700]]);
function gm(t) {
  const x = BX(t), sp = Math.abs(BX(t + .05) - BX(t - .05)) / .1;
  const o = { x, face: t < 100 ? 1 : (t > 222.8 ? 1 : -1), walk: sp > 10 ? x / 95 : 0, plate: t < 194.6 ? 1 : 0, bend: 0, give: 0, smile: 1, laugh: 0 };
  if (t > 197.6 && t < 202.6) o.bend = Math.max(pulse(t, 197.8, 199.4), pulse(t, 200.4, 201.6)) * .5;
  o.give = pulse(t, 202.8, 205);
  if (t > 214.4 && t < 219) o.laugh = 1;
  if (t > 194 && t < 195.2) o.place = 1;
  return o;
}
// Барон
function ba(t) {
  const o = { x: 1745, y: 600, mode: 'lie', eyes: 0, look: 0, chew: 0, bounce: 0, paw: 0, cookie: 0 };
  if (t > 156 && t < 157.5) o.bounce = Math.sin(seg(t, 156, 157.5) * PI * 3) * (1 - seg(t, 156, 157.5)) * 30;
  if (t > 156.3 && t < 159) o.eyes = .5;
  if (t > 229 && t < 230.2) o.eyes = 1;
  if (t >= 230.2) { const u = seg(t, 230.2, 231.0); o.mode = u < 1 ? 'jump' : 'sit'; o.x = lerp(1745, 2290, eio(u)); o.y = lerp(600, 700, u) - 160 * arc(u); o.ju = u; o.eyes = 1; }
  if (t > 231.6) o.paw = pulse(t, 231.6, 232.5);
  if (t > 232.1) o.cookie = 1;
  if (t > 232.4) { o.chew = Math.max(0, Math.sin(t * 9)); o.bite = clamp((t - 232.4) / 10); }
  if (t > 233.4 && t < 238.5) o.look = 1;
  return o;
}
const SLX = L([[0, 920], [62.4, 920], [62.5, 930], [64.4, 930], [64.5, 950], [66.4, 950], [66.5, 970], [68.4, 970], [68.5, 1000], [251, 1000]]);
function crumbPos(t) {
  if (t < 7.6) return null;
  if (t < 8.15) { const u = seg(t, 7.6, 8.15); return { x: lerp(2010, 1900, u), y: lerp(575, FLOOR - 8, ei(u)), r: u * 6 }; }
  if (t < 8.6) { const u = seg(t, 8.15, 8.6); return { x: 1900 - u * 6, y: FLOOR - 8 - 20 * arc(u), r: 6 + u }; }
  if (t < 148) return { x: 1894, y: FLOOR - 8, r: 7 };
  const u = eo(seg(t, 148, 151.5)); return { x: lerp(1894, 1700, u), y: FLOOR - 8, r: 7 - u * 12 };
}

// ———————————————————————————— комната
const SOFA = { x0: 1000, x1: 1800, seat: 640, top: 420, under: 815 };
function sofaY(t) { return (t > 155.8 && t < 158 ? -Math.sin(seg(t, 155.8, 158) * PI * 4) * 16 * (1 - seg(t, 155.8, 158)) : 0) + (t > 158 && t < 199 ? Math.sin(t * 11) * 1.6 : 0) - (t > 156 && t < 199.2 ? 6 : 0); }
function room(t) {
  const c = G;
  // wall
  c.fillStyle = lgrad(0, -500, 0, FLOOR, [[0, '#e9d3a8'], [1, '#f3dfb9']]); c.fillRect(-600, -500, 4800, FLOOR + 500);
  // wallpaper stripes + tiny flowers
  c.save(); c.globalAlpha = .18; c.fillStyle = '#c99a6a'; for (let x = -600; x < 4200; x += 120) c.fillRect(x, -500, 10, FLOOR + 500); c.globalAlpha = .22;
  for (let x = -540; x < 4200; x += 120) for (let y = -460; y < FLOOR - 40; y += 110) { const yy = y + ((x / 120) % 2) * 55; c.fillStyle = '#d27a5e'; c.beginPath(); for (let k = 0; k < 4; k++) c.arc(x + Math.cos(k * PI / 2) * 6, yy + Math.sin(k * PI / 2) * 6, 5, 0, TAU); c.fill(); }
  c.restore();
  // ceiling cornice
  c.fillStyle = '#f7ead0'; c.fillRect(-600, -520, 4800, 30);
  // floor
  c.fillStyle = lgrad(0, FLOOR, 0, 1500, [[0, '#b77a45'], [1, '#8a5530']]); c.fillRect(-600, FLOOR, 4800, 700);
  c.strokeStyle = 'rgba(80,40,20,.35)'; c.lineWidth = 3; for (let y = FLOOR + 40, k = 0; y < 1500; y += 46 + k * 6, k++) { c.beginPath(); c.moveTo(-600, y); c.lineTo(4200, y); c.stroke(); for (let x = -600 + (k % 2) * 180; x < 4200; x += 360) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 46 - k * 6 + 6); c.stroke(); } }
  // baseboard
  c.fillStyle = '#7a4a2a'; c.fillRect(-600, FLOOR - 26, 4800, 28); c.fillStyle = '#9a6238'; c.fillRect(-600, FLOOR - 26, 4800, 6);
  // rug
  c.save(); c.fillStyle = '#9b3b3b'; c.beginPath(); c.ellipse(1800, FLOOR + 70, 950, 80, 0, 0, TAU); c.fill(); c.strokeStyle = '#e8c27a'; c.lineWidth = 8; c.setLineDash([22, 14]); c.beginPath(); c.ellipse(1800, FLOOR + 70, 900, 64, 0, 0, TAU); c.stroke(); c.restore();
  // kitchen doorway (left)
  c.fillStyle = '#6d4026'; c.fillRect(80, 20, 340, FLOOR - 20); c.fillStyle = lgrad(0, 40, 0, FLOOR, [[0, '#fff4d6'], [1, '#e9c88f']]); c.fillRect(100, 40, 300, FLOOR - 40);
  c.save(); c.beginPath(); c.rect(100, 40, 300, FLOOR - 40); c.clip(); c.strokeStyle = 'rgba(140,110,70,.35)'; c.lineWidth = 3; for (let y = 60; y < 500; y += 40) { c.beginPath(); c.moveTo(100, y); c.lineTo(400, y); c.stroke(); } for (let x = 100; x < 400; x += 40) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x, 500); c.stroke(); }
  c.fillStyle = '#8a5a3a'; c.fillRect(100, 500, 300, 380); c.fillStyle = '#c9a070'; c.fillRect(100, 500, 300, 20); c.fillStyle = '#5a3a24'; c.fillRect(120, 560, 120, 6); c.fillRect(270, 560, 110, 6);
  // pots on shelf
  c.fillStyle = '#b8bcc4'; rr(150, 420, 80, 70, 10); c.fill(); c.fillStyle = '#d86a3a'; rr(270, 440, 90, 50, 10); c.fill(); c.restore();
  if (t > 118 && t < 121.4) { const sh = Math.sin(t * 60) * 6 * pulse(t, 118.2, 121); c.save(); c.translate(sh, 0); glow(250, 600, 300, 'rgba(255,240,200,1)', .2 * pulse(t, 118.2, 121)); c.restore(); }
  // dock + photos + lamp
  c.fillStyle = '#e6e6ea'; rr(500, FLOOR - 90, 120, 90, 14); c.fill(); c.fillStyle = '#c3c5cc'; c.fillRect(500, FLOOR - 26, 120, 26); c.fillStyle = t > 17.4 ? '#4fd8ff' : '#2a9ac0'; c.beginPath(); c.arc(560, FLOOR - 60, 7, 0, TAU); c.fill();
  frame(560, 220, 160, 200, t, 0); frame(1250, 120, 220, 160, t, 1); frame(1560, 160, 140, 180, t, 2);
  // clock
  c.save(); c.translate(820, 120); c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.fillStyle = '#fff9ee'; c.fill(); c.lineWidth = 10; c.strokeStyle = '#7a4a2a'; c.stroke(); const hm = t / 60 * TAU / 12 + 1.2, mm = t / 60 * TAU + 3; c.lineWidth = 6; c.strokeStyle = INK; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(hm) * 36, -Math.cos(hm) * 36); c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(mm) * 54, -Math.cos(mm) * 54); c.stroke(); c.restore();
  // floor lamp & plant
  c.fillStyle = '#5a3a24'; c.fillRect(2690, 240, 10, FLOOR - 250); fillE(2695, FLOOR - 4, 50, 10, '#5a3a24'); c.fillStyle = '#f0c27a'; c.beginPath(); c.moveTo(2630, 260); c.lineTo(2760, 260); c.lineTo(2730, 150); c.lineTo(2660, 150); c.closePath(); c.fill();
  plant(3380, FLOOR, t);
  // window
  win(t);
  // radiator + socks
  c.fillStyle = '#f2f0ea'; for (let i = 0; i < 9; i++) { rr(2830 + i * 44, 690, 38, 160, 14); c.fill(); } c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { rr(2830 + i * 44, 690, 38, 160, 14); c.stroke(); }
  if (t < 77.3) sockDrape(2930, 694, 1); sockDrape(3110, 694, 0);
  // right door
  c.fillStyle = '#6d4026'; c.fillRect(3460, 20, 320, FLOOR - 20); const op = Math.max(pulse(t, 11.5, 14.2), pulse(t, 189, 192), pulse(t, 229.5, 233)); c.fillStyle = '#3a2416'; c.fillRect(3480, 40, 280, FLOOR - 40);
  c.save(); c.translate(3480, 40); c.scale(1 - op * .75, 1); c.fillStyle = '#b07848'; c.fillRect(0, 0, 280, FLOOR - 40); c.fillStyle = '#9a6238'; rr(30, 40, 220, 300, 10); c.fill(); rr(30, 400, 220, 360, 10); c.fill(); c.fillStyle = '#e8c27a'; c.beginPath(); c.arc(245, 450, 14, 0, TAU); c.fill(); c.restore();
}
function frame(x, y, w, h, t, k) { const c = G; c.save(); c.translate(x, y); c.rotate((k - 1) * .02); c.fillStyle = '#8a5a3a'; c.fillRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24); c.fillStyle = ['#cfe4ef', '#f4e1c4', '#e2ecd6'][k]; c.fillRect(-w / 2, -h / 2, w, h);
  if (k === 0) { fillE(0, 10, 40, 60, '#8a6fa0'); c.beginPath(); c.arc(0, -40, 26, 0, TAU); c.fillStyle = '#f2c9a5'; c.fill(); c.beginPath(); c.arc(0, -58, 20, 0, TAU); c.fillStyle = '#c8c8cc'; c.fill(); }
  if (k === 1) { c.fillStyle = '#9fc77a'; c.beginPath(); c.moveTo(-w / 2, h / 2); c.quadraticCurveTo(0, -20, w / 2, h / 2); c.fill(); c.beginPath(); c.arc(60, -40, 22, 0, TAU); c.fillStyle = '#f7c948'; c.fill(); }
  if (k === 2) { fillE(0, 30, 44, 30, '#e08a3a'); c.beginPath(); c.arc(30, 0, 22, 0, TAU); c.fill(); c.beginPath(); c.moveTo(18, -16); c.lineTo(24, -36); c.lineTo(34, -18); c.fill(); c.beginPath(); c.moveTo(36, -18); c.lineTo(46, -34); c.lineTo(50, -12); c.fill(); }
  c.restore(); }
function plant(x, y, t) { const c = G; c.fillStyle = '#c0603a'; c.beginPath(); c.moveTo(x - 50, y - 110); c.lineTo(x + 50, y - 110); c.lineTo(x + 38, y); c.lineTo(x - 38, y); c.closePath(); c.fill();
  c.fillStyle = '#4f8a3c'; for (let i = 0; i < 9; i++) { const a = -PI / 2 + (i - 4) * .3 + Math.sin(t * .8 + i) * .03; c.save(); c.translate(x, y - 110); c.rotate(a + PI / 2); fillE(0, -80 - (i % 3) * 20, 22, 80 + (i % 3) * 20, i % 2 ? '#4f8a3c' : '#5f9c48'); c.restore(); } }
function sockDrape(x, y, k) { const c = G; c.save(); c.translate(x, y); c.beginPath(); c.moveTo(-30, 0); c.lineTo(30, 0); c.lineTo(28, 110); c.quadraticCurveTo(28, 140, 0, 140); c.lineTo(-50, 140); c.quadraticCurveTo(-70, 140, -70, 120); c.quadraticCurveTo(-70, 100, -30, 100); c.closePath(); c.save(); c.clip(); c.fillStyle = k ? '#e8e2d8' : '#5a7fb8'; c.fillRect(-80, -10, 120, 160); c.fillStyle = k ? '#d6453e' : '#f2d36b'; for (let i = 0; i < 6; i++) c.fillRect(-80, 14 + i * 24, 120, 11); c.restore(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore(); }
const WIN = { x0: 2800, x1: 3250, y0: -150, y1: 620 };
let OUT_GOSHA = null;
function win(t) {
  const c = G, { x0, x1, y0, y1 } = WIN;
  c.fillStyle = '#7a4a2a'; c.fillRect(x0 - 30, y0 - 30, x1 - x0 + 60, y1 - y0 + 60);
  c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  c.fillStyle = lgrad(0, y0, 0, y1, [[0, '#7fc4f2'], [1, '#d8f0ff']]); c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < 4; i++) { const cx = x0 + ((i * 190 + t * 6) % 700) - 100, cy = y0 + 60 + i * 70; c.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(cx + k * 34, cy + (k % 2) * -14, 30 - (k % 2) * 6, 0, TAU); c.fill(); } }
  c.fillStyle = '#b9c7d4'; c.fillRect(x0, 300, 160, y1); c.fillStyle = '#a5b4c3'; c.fillRect(x0 + 200, 240, 140, y1); c.fillStyle = '#c8d3dd'; c.fillRect(x0 + 360, 330, 120, y1);
  c.fillStyle = '#eef6ff'; for (let x = x0 + 14; x < x0 + 460; x += 40) for (let y = 260; y < y1; y += 60) if (hash(x * 3 + y) > .35) c.fillRect(x, y + 50, 18, 26);
  // tree branch
  c.strokeStyle = '#5a3a24'; c.lineWidth = 22; c.beginPath(); c.moveTo(x1 + 20, 40); c.quadraticCurveTo(3100, 70, 2980, 20); c.stroke(); c.fillStyle = '#6fae4a'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(2990 + i * 32, 10 + Math.sin(i * 2) * 26, 34, 0, TAU); c.fill(); }
  // outside sill
  c.fillStyle = '#a9b0b8'; c.fillRect(x0, y1 - 26, x1 - x0, 26);
  if (OUT_GOSHA) OUT_GOSHA();
  c.restore();
  // glass
  c.save(); c.globalAlpha = .18; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x0 + 40, y1); c.lineTo(x0 + 160, y0); c.lineTo(x0 + 220, y0); c.lineTo(x0 + 100, y1); c.fill(); c.beginPath(); c.moveTo(x0 + 260, y1); c.lineTo(x0 + 360, y0); c.lineTo(x0 + 380, y0); c.lineTo(x0 + 280, y1); c.fill(); c.restore();
  if (t > 30.3 && t < 42) { c.save(); c.globalAlpha = .35 * (1 - seg(t, 40, 42)); fillE(3060, 470, 70, 48, '#ffffff'); c.restore(); }
  // frame
  c.fillStyle = '#f4efe6'; c.fillRect(x0, y0, x1 - x0, 14); c.fillRect(x0, y1 - 14, x1 - x0, 14); c.fillRect(x0, y0, 14, y1 - y0); c.fillRect(x1 - 14, y0, 14, y1 - y0); c.fillRect(3018, y0, 14, y1 - y0); c.fillRect(x0, 186, x1 - x0, 14);
  // fortochka (top-left pane), opens inward 60..230
  const op = (t > 60 && t < 232) ? 1 : 0;
  if (op) { c.save(); c.fillStyle = 'rgba(40,60,80,.18)'; c.fillRect(x0 + 14, y0 + 14, 3018 - x0 - 14, 186 - y0 - 14); c.restore();
    c.save(); c.translate(x0 + 14, y0 + 14); c.transform(.55, -.06, 0, 1, 0, 0); c.fillStyle = 'rgba(200,230,255,.45)'; c.fillRect(0, 0, 3018 - x0 - 14, 186 - y0 - 14); c.lineWidth = 12; c.strokeStyle = '#f4efe6'; c.strokeRect(6, 6, 3018 - x0 - 26, 186 - y0 - 26); c.restore(); }
  // inner sill
  c.fillStyle = '#f7f3ec'; c.fillRect(x0 - 50, y1 + 10, x1 - x0 + 100, 30); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x0 - 50, y1 + 34, x1 - x0 + 100, 6);
  // curtains
  c.fillStyle = '#d97a5a'; for (const [cx, s] of [[x0 - 70, 1], [x1 + 70, -1]]) { c.beginPath(); c.moveTo(cx - 70, y0 - 60); c.lineTo(cx + 70, y0 - 60); c.quadraticCurveTo(cx + 40 * s, 300, cx + 60 * s, y1 + 60); c.lineTo(cx - 40 * s, y1 + 60); c.quadraticCurveTo(cx - 60 * s, 300, cx - 70, y0 - 60); c.fill(); }
  c.fillStyle = '#8a5a3a'; c.fillRect(x0 - 170, y0 - 74, x1 - x0 + 340, 16);
}
function sunbeam(t) { const c = G; c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .22; c.fillStyle = lgrad(3000, 0, 2200, FLOOR + 100, [[0, 'rgba(255,240,190,1)'], [1, 'rgba(255,220,150,0)']]); c.beginPath(); c.moveTo(2820, -140); c.lineTo(3240, -140); c.lineTo(2700, FLOOR + 120); c.lineTo(1900, FLOOR + 120); c.closePath(); c.fill(); c.restore(); }
function sofa(t) {
  const c = G, { x0, x1, seat, top: back_, under } = SOFA, dy = sofaY(t);
  c.save(); c.translate(0, dy);
  const grn = '#3f7f6e', dk = '#2f6355', lt = '#57998a';
  c.fillStyle = '#4a2e1c'; for (const lx of [x0 + 30, x1 - 50]) { c.beginPath(); c.moveTo(lx, under); c.lineTo(lx + 20, under); c.lineTo(lx + 16, FLOOR - dy); c.lineTo(lx + 4, FLOOR - dy); c.fill(); }
  rr(x0 + 40, back_, x1 - x0 - 80, seat - back_ + 40, 60); c.fillStyle = dk; c.fill();
  for (let i = 0; i < 3; i++) { rr(x0 + 70 + i * 220, back_ + 20, 210, seat - back_, 44); c.fillStyle = grn; c.fill(); c.globalAlpha = .25; rr(x0 + 90 + i * 220, back_ + 34, 80, 60, 30); c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1; }
  rr(x0 + 60, seat - 10, x1 - x0 - 120, 90, 30); c.fillStyle = lt; c.fill();
  rr(x0 + 40, seat + 60, x1 - x0 - 80, under - seat - 60, 18); c.fillStyle = grn; c.fill();
  c.fillStyle = '#e8c27a'; for (let x = x0 + 50; x < x1 - 50; x += 26) { c.beginPath(); c.arc(x, under - 4, 6, 0, PI); c.fill(); }
  for (const ax of [x0, x1 - 110]) { rr(ax, seat - 50, 110, under - seat + 40, 40); c.fillStyle = dk; c.fill(); rr(ax - 6, seat - 60, 122, 50, 25); c.fillStyle = grn; c.fill(); }
  if (t > 176.5 && t < 199) { const p = back(seg(t, 176.5, 177.3)); c.save(); c.translate(1400, 730); c.scale(p, p); c.rotate(Math.sin(t * 2) * .05); c.strokeStyle = '#c0392b'; c.lineWidth = 10; c.beginPath(); c.moveTo(-30, -150); c.lineTo(0, -60); c.lineTo(30, -150); c.stroke(); c.beginPath(); c.arc(0, -30, 44, 0, TAU); c.fillStyle = '#f7c948'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#c99a1e'; c.stroke(); c.fillStyle = '#9a6a0a'; c.font = '600 44px Oswald'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1', 0, -28); c.restore(); }
  c.restore();
}
function table(t) {
  const c = G; c.fillStyle = '#6d4026'; c.fillRect(2075, 712, 18, FLOOR - 712); c.fillRect(2357, 712, 18, FLOOR - 712); c.fillStyle = '#8a5530'; rr(2040, 696, 370, 22, 8); c.fill(); c.fillStyle = '#a8703f'; c.fillRect(2050, 696, 350, 6);
  // vase
  c.fillStyle = '#5a8ac0'; c.beginPath(); c.moveTo(2340, 696); c.quadraticCurveTo(2310, 640, 2335, 610); c.lineTo(2365, 610); c.quadraticCurveTo(2390, 640, 2360, 696); c.fill(); c.strokeStyle = '#4f8a3c'; c.lineWidth = 5; for (const a of [-.3, 0, .3]) { c.beginPath(); c.moveTo(2350, 612); c.lineTo(2350 + Math.sin(a) * 60, 612 - Math.cos(a) * 60); c.stroke(); fillE(2350 + Math.sin(a) * 64, 612 - Math.cos(a) * 64, 12, 12, '#f2d36b'); }
  if (t > 194.6) plate(2150, 694, t > 202.6 ? 2 : 3, t);
}
function plate(x, y, n, t, bite = 0) { const c = G; fillE(x, y - 4, 70, 14, '#f4f4f0'); c.lineWidth = 3; c.strokeStyle = '#9ab'; ell(x, y - 4, 70, 14); c.stroke(); ell(x, y - 6, 48, 9); c.strokeStyle = 'rgba(80,120,170,.4)'; c.stroke();
  const pos = [[-26, -16], [22, -18], [0, -30]]; for (let i = 0; i < n; i++) cookie(x + pos[i][0], y + pos[i][1], 22, i); }

// ———————————————————————————— Жужа (робот-пылесос)
function zhuzha(o, t) {
  const c = G; shadow(o.x, 120 - o.lift * .2, .28 - o.lift * .001);
  c.save(); c.translate(o.x, FLOOR - o.lift); c.rotate(o.tilt); c.scale(1, o.sy);
  const f = o.face, sx = Math.sign(f) || 1, fw = Math.max(.08, Math.abs(f));
  // wheels
  c.fillStyle = '#16181c'; for (const wx of [-62, 58]) { c.beginPath(); c.arc(wx, -8, 12, 0, TAU); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 3; const a = t * 14 * (o.hum > 0 ? 1 : 0); c.beginPath(); c.moveTo(wx, -8); c.lineTo(wx + Math.cos(a) * 10, -8 + Math.sin(a) * 10); c.stroke(); }
  // cape (behind)
  if (o.cape) { c.save(); c.scale(fw * sx, 1); const fl = Math.sin(t * 7) * 10 + (o.hum > .5 ? 18 : 0); c.beginPath(); c.moveTo(-14, -92); c.quadraticCurveTo(-80, -100 - fl * .3, -150 - fl, -74 + Math.sin(t * 9) * 8); c.lineTo(-138 - fl, -40 + Math.sin(t * 9 + 1) * 10); c.quadraticCurveTo(-70, -60, -10, -76); c.closePath(); c.fillStyle = '#d6453e'; c.fill(); ink(3); c.restore(); }
  // body
  rr(-108, -66, 216, 58, 28); c.fillStyle = lgrad(0, -66, 0, -8, [[0, '#4b525e'], [1, '#262a31']]); c.fill(); ink(4);
  fillE(0, -66, 106, 16, '#5c6370'); c.lineWidth = 3; c.strokeStyle = INK; ell(0, -66, 106, 16); c.stroke();
  c.save(); c.globalAlpha = .3; fillE(-30, -70, 50, 6, '#fff'); c.restore();
  c.fillStyle = '#b9bec7'; c.fillRect(-100, -24, 200, 6);
  // turret / siren
  c.save(); c.translate(-16 * sx * fw, 0); rr(-30, -92, 60, 26, 12); c.fillStyle = '#2b2f37'; c.fill(); ink(3); fillE(0, -92, 30, 7, o.siren ? (Math.sin(t * 20) > 0 ? '#ff3b30' : '#ff9e3b') : '#3a8fd0'); c.restore();
  if (o.siren) glow(-16 * sx * fw, -96, 120, Math.sin(t * 20) > 0 ? 'rgba(255,60,48,1)' : 'rgba(255,160,60,1)', .5);
  // pan helmet
  if (o.pan) { c.save(); c.translate(-16 * sx * fw, -96); c.rotate(.1 * sx); c.beginPath(); c.moveTo(-46, 4); c.quadraticCurveTo(-44, -54, 0, -56); c.quadraticCurveTo(44, -54, 46, 4); c.closePath(); c.fillStyle = '#b8bcc4'; c.fill(); ink(3); c.fillStyle = '#2b2f37'; rr(-60 * sx - (sx < 0 ? 0 : 50), -20, 50, 14, 6); c.fill(); c.restore(); }
  // face screen (on the facing side)
  c.save(); c.scale(fw, 1); c.translate(sx * 40, 0);
  rr(-44, -60, 88, 36, 14); c.fillStyle = '#0b0e12'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#7d8592'; c.stroke();
  if (o.on > 0) eyes(o, t, sx);
  c.restore();
  // side brush
  c.save(); c.translate(sx * 96 * fw, -4); c.rotate(t * (o.hum > 0 ? 22 : 0)); c.strokeStyle = '#d6453e'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(18, 0); c.stroke(); } c.restore();
  // dust coat
  if (o.dust > 0) { c.save(); c.globalAlpha = o.dust * .85; for (let i = 0; i < 26; i++) { const a = hash(i) * TAU, rx = (hash(i + 4) - .5) * 220, ry = -20 - hash(i + 9) * 80; c.beginPath(); c.arc(rx, ry, 10 + hash(i + 2) * 18, 0, TAU); c.fillStyle = i % 3 ? '#a9a49c' : '#c4bfb6'; c.fill(); } c.restore();
    c.save(); c.scale(fw, 1); c.translate(sx * 40, 0); c.globalAlpha = .9; rr(-30, -52, 60, 22, 8); c.fillStyle = '#0b0e12'; c.fill(); eyes(o, t, sx); c.restore(); }
  c.restore();
  // stars over head when dizzy
  if (o.mood === 'dizzy') { for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3; star(o.x + Math.cos(a) * 70, FLOOR - o.lift - 120 * o.sy - 20 + Math.sin(a) * 14, 14, '#f7c948'); } }
}
function star(x, y, r, col) { const c = G; c.save(); c.translate(x, y); c.beginPath(); for (let i = 0; i < 10; i++) { const rad = i % 2 ? r * .45 : r, a = i * PI / 5 - PI / 2; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); c.restore(); }
function eyes(o, t, sx) {
  const c = G, m = o.mood, red = m === 'alarm' || m === 'narrow', col = red ? '#ff4a3d' : '#5fe8ff';
  c.save(); c.globalAlpha = o.on; c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.strokeStyle = col;
  const op = o.open, ex = [-17, 17];
  if (m === 'q') { c.scale(sx, 1); c.font = '600 32px Oswald'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, -41); c.restore(); return; }
  for (const [i, x] of ex.entries()) {
    const y = -42;
    if (m === 'happy') { c.lineWidth = 4; c.beginPath(); c.arc(x, y + 4, 8, PI, 0); c.stroke(); continue; }
    if (m === 'dizzy') { c.lineWidth = 3; c.beginPath(); for (let k = 0; k < 20; k++) { const a = k * .7 + t * 6 * (i ? 1 : -1), r = k * .45; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.stroke(); continue; }
    if (m === 'sad') { rr(x - 6, y - 4 * op, 12, 12 * op, 4); c.fill(); c.lineWidth = 3; c.beginPath(); c.moveTo(x - 9, y - 9 + (i ? 0 : -4) * sx); c.lineTo(x + 9, y - 9 + (i ? -4 : 0) * sx); c.stroke(); continue; }
    let h = 20 * op; if (m === 'sus') h = (i === (sx > 0 ? 1 : 0) ? 6 : 14) * op; if (m === 'narrow') h = 4 * op;
    rr(x - 7, y - h / 2, 14, Math.max(1.5, h), 5); c.fill();
    if (m === 'focus' || m === 'alarm') { c.save(); c.shadowBlur = 0; c.fillStyle = '#0b0e12'; c.beginPath(); const s = i === 0 ? 1 : -1; c.moveTo(x - 10, y - 14 + (s > 0 ? -6 : 6)); c.lineTo(x + 10, y - 14 + (s > 0 ? 6 : -6)); c.lineTo(x + 10, y - 20); c.lineTo(x - 10, y - 20); c.fill(); c.restore(); }
  }
  c.restore();
}

// ———————————————————————————— Гоша (голубь)
function gosha(o, t) {
  if (!o.vis) return;
  const c = G, f = o.face, sx = f >= 0 ? 1 : -1;
  if (o.y > FLOOR - 5 || o.y < FLOOR - 1) {} // shadow only on the floor
  if (Math.abs(o.y - FLOOR) < 400 && o.x < 2780) shadow(o.x, 60 * (1 - (FLOOR - o.y) / 600), .25);
  c.save(); c.translate(o.x, o.y); c.scale(sx * (o.squash < 1 ? 1 + (1 - o.squash) * .5 : 1), o.squash);
  if (o.pose === 'squeeze') { c.translate(0, 30); c.rotate(.5); }
  if (o.pose === 'flop') { c.rotate(-.06); }
  if (o.pose === 'stiff') { c.rotate(.18); }
  const bob = o.walk ? Math.abs(Math.sin(o.walk)) * 6 : 0; c.translate(0, -bob);
  // legs
  const legA = o.walk ? Math.sin(o.walk) * .5 : 0;
  c.strokeStyle = '#e06a6a'; c.lineWidth = 7; c.lineCap = 'round';
  for (const [lx, ph] of [[-10, 0], [14, PI]]) { if (o.pose === 'flop') continue; const a = o.walk ? Math.sin(o.walk + ph) * .6 : (o.pose === 'stiff' && ph ? -.9 : 0); c.save(); c.translate(lx, -40); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 36); c.stroke(); c.beginPath(); c.moveTo(-8, 40); c.lineTo(10, 40); c.moveTo(0, 36); c.lineTo(14, 44); c.stroke(); c.restore(); }
  // tail
  c.beginPath(); c.moveTo(-40, -84); c.lineTo(-108, -64); c.lineTo(-104, -48); c.lineTo(-40, -58); c.closePath(); c.fillStyle = '#5d6676'; c.fill(); ink(3); c.fillStyle = '#2f3540'; c.fillRect(-106, -64, 10, 16);
  // body
  ell(0, -80, 66, 50, -.08); c.fillStyle = lgrad(0, -130, 0, -30, [[0, '#9aa3b2'], [1, '#7d8696']]); c.fill(); ink(4);
  // neck (iridescent)
  c.beginPath(); c.moveTo(20, -116); c.quadraticCurveTo(40, -150, 50, -156); c.lineTo(72, -146); c.quadraticCurveTo(66, -110, 58, -90); c.closePath(); c.fillStyle = lgrad(20, -160, 60, -90, [[0, '#4f9a7a'], [.5, '#8a5aa8'], [1, '#9aa3b2']]); c.fill();
  // sock
  if (o.sock > 0) { c.save(); c.globalAlpha = o.sock; c.beginPath(); c.moveTo(56, -150); c.quadraticCurveTo(82, -110, 70, -70); c.quadraticCurveTo(64, -30, 10, -30); c.lineTo(-90, -34); c.quadraticCurveTo(-136, -36, -132, -70); c.quadraticCurveTo(-128, -96, -90, -96); c.lineTo(-30, -112); c.quadraticCurveTo(0, -124, 24, -154); c.closePath();
    c.save(); c.clip(); c.fillStyle = '#e8e2d8'; c.fillRect(-150, -170, 260, 150); c.fillStyle = '#d6453e'; for (let i = 0; i < 9; i++) { c.save(); c.translate(-140 + i * 30, -160); c.rotate(.5); c.fillRect(0, 0, 13, 200); c.restore(); } c.restore(); ink(4);
    c.beginPath(); c.moveTo(20, -158); c.lineTo(60, -154); c.lineTo(62, -138); c.lineTo(18, -142); c.closePath(); c.fillStyle = '#f4f0e8'; c.fill(); ink(3); c.restore(); }
  // wing
  if (o.flap > 0 || o.pose === 'squeeze') { const a = Math.sin(o.flap * TAU) * .9; c.save(); c.translate(-6, -104); c.rotate(-1.2 + a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-30, -70, -10, -120); c.quadraticCurveTo(30, -60, 20, 0); c.closePath(); c.fillStyle = o.sock > .5 ? '#d6453e' : '#6c7585'; c.fill(); ink(3); c.restore(); }
  else if (o.sock < .5) { c.beginPath(); c.moveTo(-36, -104); c.quadraticCurveTo(10, -112, 30, -84); c.quadraticCurveTo(0, -56, -60, -62); c.closePath(); c.fillStyle = '#6c7585'; c.fill(); ink(3); c.strokeStyle = '#2f3540'; c.lineWidth = 6; c.beginPath(); c.moveTo(-30, -86); c.lineTo(-4, -84); c.moveTo(-40, -74); c.lineTo(-12, -72); c.stroke(); }
  // head
  const hx = 58, hy = -164 + (o.walk ? Math.sin(o.walk * 2) * 4 : 0) + (o.pose === 'stiff' ? -6 : 0);
  c.save(); c.translate(hx + (o.walk ? Math.sin(o.walk * 2) * 6 : 0), hy); if (o.press) c.scale(.8, 1.12);
  c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fillStyle = '#8f98a8'; c.fill(); ink(4);
  // beak
  c.beginPath(); if (o.press) { c.moveTo(22, -6); c.lineTo(34, -22); c.lineTo(28, 2); } else { c.moveTo(22, -6); c.lineTo(46, 2); c.lineTo(22, 6); } c.closePath(); c.fillStyle = '#3a3a3e'; c.fill(); ink(2.5); fillE(24, -6, 7, 4, '#f4f0e8');
  // eye
  const e = o.eye; fillE(8, -6, 10, 10, '#f29a2e'); c.lineWidth = 2; c.strokeStyle = INK; ell(8, -6, 10, 10); c.stroke();
  if (e === 'heart') { c.save(); c.translate(8, -6); c.scale(.55, .55); heart(0, 0, '#e8344a'); c.restore(); }
  else if (e === 'dizzy') { c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(2, -12); c.lineTo(14, 0); c.moveTo(14, -12); c.lineTo(2, 0); c.stroke(); }
  else { const pr = e === 'wide' ? 3 : 5; fillE(10, -6, pr, pr, '#111'); fillE(12, -9, 1.6, 1.6, '#fff'); if (e === 'sly') { c.beginPath(); c.moveTo(-4, -18); c.lineTo(20, -10); c.lineTo(20, -18); c.closePath(); c.fillStyle = '#8f98a8'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(-4, -16); c.lineTo(20, -9); c.stroke(); } }
  if (o.cookie) { cookie(48, 6, 22, .3); }
  c.restore();
  // sign
  if (o.sign) { c.save(); c.translate(52, -62); c.scale(.82, .82); c.rotate(-.06 + Math.sin(t * 2) * .03); c.scale(sx, 1); rr(-120, -90, 240, 160, 6); c.fillStyle = '#c9965e'; c.fill(); ink(4); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.sign === 1) { c.font = '600 40px Oswald'; c.fillText('ПОСЫЛКА', 0, -56); c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(-40, -26, 80, 60); c.beginPath(); c.moveTo(-40, -26); c.lineTo(0, -6); c.lineTo(40, -26); c.moveTo(0, -6); c.lineTo(0, 34); c.stroke(); c.font = '500 24px Oswald'; c.fillText('ОТКРОЙТЕ', 0, 54); }
    else { c.font = '600 44px Oswald'; c.fillText('Я КУРЬЕР', 0, -30); c.font = '500 28px Oswald'; c.fillText('(ЧЕСТНО)', 0, 22); }
    c.restore(); }
  c.restore();
  if (o.hearts > 0) for (let i = 0; i < 4; i++) { const u = ((t * .6 + i / 4) % 1); c.save(); c.globalAlpha = o.hearts * (1 - u); c.translate(o.x + sx * 60 + Math.sin(u * 8 + i) * 20, o.y - 200 - u * 140); c.scale(.8, .8); heart(0, 0, '#e8344a'); c.restore(); }
}
function heart(x, y, col) { const c = G; c.save(); c.translate(x, y); c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-22, -6, -12, -26, 0, -12); c.bezierCurveTo(12, -26, 22, -6, 0, 8); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); c.restore(); }

// ———————————————————————————— Бабушка
function granny(o, t) {
  const c = G, sx = o.face; if (o.x < -140 || o.x > 3640) return;
  shadow(o.x, 120, .28);
  c.save(); c.translate(o.x, FLOOR); c.scale(sx, 1);
  const w = o.walk, sw = w ? Math.sin(w * PI) : 0, bob = w ? Math.abs(Math.sin(w * PI)) * 8 : 0;
  // legs + slippers
  for (const [lx, s] of [[-30, 1], [26, -1]]) { const a = sw * .22 * s; c.save(); c.translate(lx, -110); c.rotate(a); c.fillStyle = '#e7c6a8'; c.fillRect(-15, 0, 30, 96); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(-15, 0, 30, 96); fillE(10, 100, 40, 16, '#e88aa8'); ell(10, 100, 40, 16); ink(3); fillE(30, 92, 14, 10, '#f7c1d2'); c.restore(); }
  c.translate(0, -bob);
  c.save(); c.translate(0, -150); c.rotate(o.bend + (o.laugh ? Math.sin(t * 18) * .03 : 0)); c.translate(0, 150);
  // dress
  c.beginPath(); c.moveTo(-80, -360); c.lineTo(80, -360); c.quadraticCurveTo(120, -200, 126, -110); c.lineTo(-126, -110); c.quadraticCurveTo(-120, -200, -80, -360); c.closePath(); c.fillStyle = '#7b4b8f'; c.fill(); c.save(); c.clip(); c.fillStyle = '#e9d8f0'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(-130 + (i % 8) * 36 + (Math.floor(i / 8) % 2) * 18, -350 + Math.floor(i / 8) * 54, 5, 0, TAU); c.fill(); } c.restore(); ink(4);
  // apron
  c.beginPath(); c.moveTo(20, -300); c.lineTo(104, -300); c.quadraticCurveTo(122, -200, 120, -130); c.lineTo(36, -130); c.closePath(); c.fillStyle = '#f6eedd'; c.fill(); ink(3); c.fillStyle = '#d6453e'; c.fillRect(44, -220, 60, 6);
  // cardigan shoulders
  c.beginPath(); c.moveTo(-86, -370); c.quadraticCurveTo(0, -400, 86, -370); c.lineTo(96, -300); c.lineTo(-96, -300); c.closePath(); c.fillStyle = '#3f8a8a'; c.fill(); ink(3);
  // back arm
  c.save(); c.translate(-50, -360); c.rotate(.15 - sw * .2); c.fillStyle = '#3f8a8a'; rr(-18, 0, 36, 150, 18); c.fill(); ink(3); fillE(0, 156, 18, 18, '#f2c9a5'); c.restore();
  // head
  c.save(); c.translate(14, -440); if (o.laugh) c.translate(0, Math.sin(t * 22) * 3);
  c.beginPath(); c.arc(0, 0, 64, 0, TAU); c.fillStyle = '#f2c9a5'; c.fill(); ink(4);
  c.beginPath(); c.arc(-14, -26, 62, PI * .95, PI * 1.95); c.fillStyle = '#c9c9cf'; c.fill(); fillE(-50, -62, 34, 30, '#c9c9cf'); c.beginPath(); c.arc(-50, -62, 34, 0, TAU); ink(3);
  c.beginPath(); c.arc(-14, -26, 62, PI * .95, PI * 1.95); ink(3);
  fillE(60, 6, 12, 10, '#e9b090'); // nose
  fillE(34, 22, 14, 9, 'rgba(230,110,110,.45)');
  c.lineWidth = 3; c.strokeStyle = '#6b4a3a'; c.beginPath(); c.arc(36, -4, 15, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(21, -6); c.lineTo(-20, -10); c.stroke();
  if (o.laugh) { c.beginPath(); c.arc(38, -4, 7, PI, 0); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke(); } else { fillE(38, -4, 4.5, 5.5, INK); }
  c.beginPath(); c.moveTo(22, 34); c.quadraticCurveTo(40, 46 + (o.laugh ? 8 : 0), 54, 30); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
  c.restore();
  // front arm (with plate / cookie)
  c.save(); c.translate(54, -360);
  let a = .2 - sw * .2 * (o.plate ? 0 : 1); if (o.plate) a = -.9; if (o.give) a = lerp(.2, -.35, o.give); if (o.place) a = -.6;
  c.rotate(a); c.fillStyle = '#3f8a8a'; rr(-18, 0, 36, 150, 18); c.fill(); ink(3); fillE(0, 156, 19, 19, '#f2c9a5'); c.beginPath(); c.arc(0, 156, 19, 0, TAU); ink(3);
  if (o.give > .3) cookie(10, 176, 22, .4);
  c.restore();
  if (o.plate) { c.save(); c.translate(110, -230); plate(0, 0, 3, t); if (t < 7.6) crumbShape(sx > 0 ? -50 : 50, -12, .7); c.restore(); }
  c.restore();
  c.restore();
}

// ———————————————————————————— Барон (кот)
function baron(o, t) {
  const c = G; c.save(); c.translate(o.x, o.y + o.bounce * -1);
  const org = '#e0883a', dk = '#b5602a';
  if (o.mode === 'lie') {
    c.beginPath(); c.moveTo(-90, -20); c.quadraticCurveTo(-150, 0, -140, 70 + Math.sin(t * 1.2) * 6); c.lineWidth = 18; c.strokeStyle = org; c.lineCap = 'round'; c.stroke();
    ell(0, -42, 104, 46); c.fillStyle = org; c.fill(); ink(4); c.save(); ell(0, -42, 104, 46); c.clip(); c.fillStyle = dk; for (let i = 0; i < 5; i++) c.fillRect(-80 + i * 34, -100, 12, 50); c.restore();
    catHead(70, -76, o, t);
  } else {
    const u = o.ju ?? 1;
    if (o.mode === 'jump') { c.rotate(lerp(-.2, .3, u)); ell(0, -40, 120, 34); c.fillStyle = org; c.fill(); ink(4); catHead(110, -60, o, t); }
    else {
      c.scale(-1, 1);   // faces left toward plate
      c.beginPath(); c.moveTo(-50, -10); c.quadraticCurveTo(-110, -10, -90, -70 + Math.sin(t * 2) * 8); c.lineWidth = 16; c.strokeStyle = org; c.lineCap = 'round'; c.stroke();
      ell(0, -76, 62, 76); c.fillStyle = org; c.fill(); ink(4); c.save(); ell(0, -76, 62, 76); c.clip(); c.fillStyle = dk; for (let i = 0; i < 4; i++) c.fillRect(-70, -130 + i * 30, 50, 10); c.restore();
      fillE(-10, -40, 34, 40, '#f6dcc0');
      const pa = o.paw; c.save(); c.translate(30, -60); c.rotate(-.4 - pa * .9); c.fillStyle = org; rr(-12, 0, 24, 70, 12); c.fill(); ink(3); c.restore();
      c.scale(-1, 1); catHead(4, -160, o, t);
      if (o.cookie) cookie(-26, -122, 22, .3, o.bite || 0);
    }
  }
  c.restore();
}
function catHead(x, y, o, t) {
  const c = G; c.save(); c.translate(x, y);
  const org = '#e0883a';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 18, -30); c.lineTo(s * 40, -62); c.lineTo(s * 48, -18); c.closePath(); c.fillStyle = org; c.fill(); ink(3); c.beginPath(); c.moveTo(s * 26, -30); c.lineTo(s * 40, -50); c.lineTo(s * 42, -24); c.fillStyle = '#f2a6a6'; c.fill(); }
  ell(0, 0, 52, 44); c.fillStyle = org; c.fill(); ink(4);
  fillE(0, 18, 26, 18, '#f6dcc0');
  c.fillStyle = '#b5602a'; for (const s of [-1, 0, 1]) c.fillRect(s * 12 - 3, -42, 6, 16);
  const lk = o.look, open = o.eyes;
  for (const s of [-1, 1]) {
    const ex = s * 20, ey = -6;
    if (open < .15) { c.beginPath(); c.arc(ex, ey, 9, .2, PI - .2); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke(); continue; }
    fillE(ex, ey, 11, 11 * open, '#f2d36b'); c.lineWidth = 2.5; c.strokeStyle = INK; ell(ex, ey, 11, 11 * open); c.stroke();
    fillE(ex + (lk ? 0 : 4), ey, 3.5, 9 * open, '#111');
    c.beginPath(); c.moveTo(ex - 12, ey - 10 * open); c.lineTo(ex + 12, ey - 10 * open); c.lineTo(ex + 12, ey - 14); c.lineTo(ex - 12, ey - 14); c.closePath(); c.fillStyle = org; c.fill();   // heavy lids
    c.beginPath(); c.moveTo(ex - 12, ey - 7 * open); c.lineTo(ex + 12, ey - 7 * open); c.lineWidth = 3; c.stroke();
  }
  fillE(0, 10, 6, 4, '#d56a7a');
  const ch = o.chew; c.beginPath(); c.moveTo(-10, 22 + ch * 3); c.quadraticCurveTo(0, 28 + ch * 5, 10, 22 + ch * 3); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  if (ch > 0) { fillE(-34, 16, 10 + ch * 4, 8 + ch * 3, org); fillE(34, 16, 10 + ch * 4, 8 + ch * 3, org); }
  c.strokeStyle = 'rgba(40,20,10,.6)'; c.lineWidth = 2; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(s * 24, 16 + k * 5); c.lineTo(s * 64, 8 + k * 9); c.stroke(); }
  c.restore();
}

// ———————————————————————————— эффекты
function dustCloud(x, y, t0, t, size = 1, col = '#bdb6aa') { const u = seg(t, t0, t0 + 1.4); if (u <= 0 || u >= 1) return; const c = G; c.save(); c.globalAlpha = (1 - u) * .9; for (let i = 0; i < 14; i++) { const a = hash(i + t0) * TAU, d = eo(u) * (60 + hash(i + 7) * 90) * size; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - u * 30, (20 + hash(i + 3) * 26) * size * (1 + u), 0, TAU); c.fillStyle = col; c.fill(); } c.restore(); }
function bonkFx(x, y, t0, t, word) { const u = seg(t, t0, t0 + .9); if (u <= 0 || u >= 1) return; const c = G; c.save(); c.translate(x, y); const s = back(seg(t, t0, t0 + .25)); c.scale(s, s); c.rotate(-.1); c.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 40 : 70, a = i * PI / 8; c.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8); } c.closePath(); c.globalAlpha = 1 - seg(u, .7, 1); c.fillStyle = '#fff2a8'; c.fill(); ink(4); c.fillStyle = '#d6453e'; c.font = '600 40px Oswald'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(word, 0, 2); c.restore(); }
function speedLines(x, y, dir, t, a) { const c = G; c.save(); c.globalAlpha = a; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 5; c.lineCap = 'round'; for (let i = 0; i < 5; i++) { const yy = y - 20 - i * 26, l = 60 + hash(i + Math.floor(t * 8)) * 60; c.beginPath(); c.moveTo(x - dir * (90 + i * 6), yy); c.lineTo(x - dir * (90 + l), yy); c.stroke(); } c.restore(); }
function tumble(t) { if (t < 130.6 || t > 134.2) return; const u = seg(t, 130.6, 134.2), x = lerp(1450, 2400, u), y = FLOOR - 26 - Math.abs(Math.sin(u * 14)) * 24; const c = G; c.save(); c.translate(x, y); c.rotate(u * 20); c.strokeStyle = '#9b948a'; c.lineWidth = 3; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(0, 0, 14 + i * 1.2, i, i + 2.4); c.stroke(); } c.restore(); }

// ———————————————————————————— камера
const CAM = [
  [0, 1250, 470, .78], [9, 1700, 520, .82], [15.5, 1896, 866, 4.6], [17, 1896, 866, 4.8],
  [17, 600, 780, 2.1], [26, 640, 760, 1.6], [30, 690, 740, 1.4],
  [30, 3030, 420, 1.55], [40, 3040, 430, 1.62], [50, 3040, 420, 1.55],
  [50, 760, 760, 1.5], [57, 780, 770, 1.55], [70, 820, 760, 1.45],
  [70, 2990, 300, 1.05], [76, 2960, 520, 1.15], [82, 2900, 640, 1.0],
  [82, 2150, 660, 1.0], [90, 2050, 680, 1.08], [97.9, 1900, 700, 1.2],
  [97.9, 1560, 790, 2.2], [100, 1560, 780, 2.0],
  [100, 1800, 620, .85], [130, 1800, 620, .85],
  [130, 1890, 660, 1.05], [133.8, 1890, 660, 1.08],
  [133.8, 1768, 838, 6], [135.9, 1768, 838, 6.4], [135.9, 2002, 716, 6], [137.9, 2002, 716, 6.4], [137.9, 1894, 868, 7], [139.9, 1894, 868, 7.6],
  [139.9, 1860, 650, 1.1], [158, 1760, 740, 1.4],
  [158, 1650, 760, 1.35], [170, 1650, 760, 1.35], [190, 1600, 700, 1.0],
  [190, 3000, 520, .85], [197, 2050, 600, 1.0], [203, 1950, 640, 1.18], [210, 1850, 700, 1.25], [212, 1700, 760, 1.6], [216, 1700, 760, 1.55], [221, 1800, 680, 1.15],
  [221, 2350, 520, .85], [229.8, 2700, 500, .85],
  [229.8, 1960, 560, 1.2], [233, 2230, 560, 1.9], [238.5, 2220, 540, 2.1],
  [238.5, 1662, 836, 4.2], [242.2, 1662, 836, 5.2],
];
const CK = [1, 2, 3].map(k => K(CAM.map(r => [r[0], r[k]])));
function cam(t) {
  let x = CK[0](t), y = CK[1](t), z = CK[2](t);
  if (t < 9) x = clamp(BX(t) + 250, 1250, 2300);
  if (t >= 9 && t < 15.5) x = lerp(clamp(BX(9) + 250, 1250, 2300), 1900, eio(seg(t, 9, 15.5)));
  if (t >= 100 && t < 130) { const m = (ZX(t) + GX(t)) / 2; x = clamp(m, 1150, 2900); if (t > 116 && t < 121.5) x = lerp(x, 1150, pulse(t, 116, 121.5)); }
  if (t >= 190 && t < 197) x = clamp(BX(t) + 100, 2050, 3000);
  if (t >= 221 && t < 229.8) x = clamp(GX(t) - 100, 2300, 2900);
  // shake
  let sh = 0; for (const [a, d, m] of [[56.4, .4, 10], [62.4, .2, 4], [64.4, .2, 4], [66.4, .2, 4], [68.4, .2, 4], [155.9, .7, 18], [214, .5, 8]]) if (t > a && t < a + d) sh = Math.max(sh, m * (1 - (t - a) / d));
  if (t > 118.3 && t < 120.8) sh = Math.max(sh, 6);
  if (t > 98 && t < 130) sh = Math.max(sh, 1.6);
  return { x: x + Math.sin(t * 71) * sh, y: y + Math.cos(t * 53) * sh, z };
}

// ———————————————————————————— UI: заголовки, плашки, субтитры
function chyron(t, t0, t1, name, line) {
  const p = seg(t, t0, t0 + .5), q = seg(t, t1 - .4, t1); if (p <= 0 || q >= 1) return; const c = g;
  c.save(); c.globalAlpha = 1 - q; c.translate(-(1 - eo(p)) * 600, 0);
  c.fillStyle = 'rgba(20,16,12,.72)'; c.font = '500 54px Oswald'; c.letterSpacing = '4px'; const w1 = c.measureText(name).width; c.font = '500 30px Inter'; c.letterSpacing = '0px'; const w2 = c.measureText(line).width; const w = Math.max(w1, w2) + 80;
  c.fillRect(70, 96, w, 140); c.fillStyle = '#f7c948'; c.fillRect(70, 96, 12, 140);
  c.fillStyle = '#fff8ea'; c.textBaseline = 'middle'; c.font = '500 54px Oswald'; c.letterSpacing = '4px'; c.fillText(name, 108, 142); c.font = '500 30px Inter'; c.letterSpacing = '0px'; c.fillStyle = '#f2e3c6'; c.fillText(line, 108, 200);
  c.restore();
}
function titleCard(t) {
  const p = seg(t, .4, 1.2), q = seg(t, 5.2, 6); if (p <= 0 || q >= 1) return; const c = g;
  c.save(); c.globalAlpha = eo(p) * (1 - q); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(30,18,10,.45)'; c.fillRect(0, 300, W, 330);
  c.font = '300 40px Oswald'; c.letterSpacing = '18px'; c.fillStyle = '#f7c948'; c.fillText('СЕРИЯ 1', W / 2, 370);
  c.font = '500 132px Oswald'; c.letterSpacing = '8px'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 30; c.fillStyle = '#fff8ea'; c.fillText('ОПЕРАЦИЯ «КРОШКА»', W / 2, 480 + (1 - eo(p)) * 30);
  c.shadowBlur = 0; c.font = '500 30px Inter'; c.letterSpacing = '2px'; c.fillStyle = '#f2e3c6'; c.fillText('документальный фильм о дикой природе одной квартиры', W / 2, 580);
  c.restore();
}
function slowTag(t) { const p = pulse(t, 140.2, 157.8); if (p <= 0) return; const c = g; c.save(); c.globalAlpha = p * (.75 + .25 * Math.sin(t * 6)); c.font = '500 34px Oswald'; c.letterSpacing = '6px'; c.fillStyle = '#ff4a3d'; c.beginPath(); c.arc(W - 470, 168, 11, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText('ЗАМЕДЛЕННАЯ СЪЁМКА', W - 446, 170); c.restore(); }
function bars(t) { const p = Math.max(pulse(t, 140, 158.2), pulse(t, 133.8, 139.9)); if (p <= 0) return; const h = 120 * eo(p); g.fillStyle = '#000'; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h); }
function endCard(t) {
  if (t < 242.4) return; const c = g, p = seg(t, 242.4, 243.2); c.save(); c.globalAlpha = p; c.fillStyle = '#120c08'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '500 110px Oswald'; c.letterSpacing = '8px'; c.fillStyle = '#fff8ea'; c.globalAlpha = p * seg(t, 243, 244); c.fillText('ПРОДОЛЖЕНИЕ СЛЕДУЕТ…', W / 2, 500);
  c.font = '300 38px Oswald'; c.letterSpacing = '14px'; c.fillStyle = '#f7c948'; c.globalAlpha = p * seg(t, 244, 245); c.fillText('ОПЕРАЦИЯ «КРОШКА» · СЕРИЯ 1', W / 2, 620);
  // a tiny Zhuzha eye-blink sign-off
  c.globalAlpha = p * seg(t, 245, 245.6); c.shadowColor = '#ff4a3d'; c.shadowBlur = 20; c.fillStyle = '#ff4a3d'; const op = 1 - pulse(t, 247.4, 247.8) * .9; rr(W / 2 - 40, 760 - 4 * op, 26, 8 * op, 4); c.fill(); rr(W / 2 + 14, 760 - 4 * op, 26, 8 * op, 4); c.fill();
  c.restore();
}
function wrap(s, maxW) { const ws = s.split(' '), out = []; let cur = ''; for (const w of ws) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; }
function subs(t) {
  if (qs.get('nosub') || t > 242.4) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .15) * (1 - seg(t, v.b - .12, v.b));
  g.save(); g.globalAlpha = f; g.font = '600 46px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const Ls = wrap(v.text, 1500), y0 = H - 86 - (Ls.length - 1) * 58;
  Ls.forEach((s, i) => { g.lineWidth = 8; g.strokeStyle = 'rgba(20,12,8,.85)'; g.lineJoin = 'round'; g.strokeText(s, W / 2, y0 + i * 58); g.fillStyle = '#fff8ea'; g.fillText(s, W / 2, y0 + i * 58); });
  g.restore();
}
function grade(t) {
  // warm morning grade; slow-mo desaturates
  const sm = pulse(t, 140.2, 158); if (sm > 0) { g.save(); g.globalCompositeOperation = 'saturation'; g.globalAlpha = sm * .55; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.restore(); }
  g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = .18; g.fillStyle = '#ffb060'; g.fillRect(0, 0, W, H); g.restore();
  const vg = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,20,10,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// ———————————————————————————— кадр
function render(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; G = g; g.letterSpacing = '0px';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const C = cam(t); g.save(); g.translate(W / 2, H / 2); g.scale(C.z, C.z); g.translate(-C.x, -C.y);
  const Z = zz(t), Gs = gs(t), Gm = gm(t), B = ba(t), cr = crumbPos(t);
  const outside = t < 70.6 || (t > 227.6);
  OUT_GOSHA = outside && Gs.vis ? () => gosha(Gs, t) : null;
  room(t); sunbeam(t);
  const stuck = t > 155.6 && t < 199.4;
  if (!stuck) sofa(t);
  table(t);
  // slipper
  { const sx = SLX(t); G.save(); G.translate(sx, FLOOR); G.beginPath(); G.moveTo(-70, 0); G.quadraticCurveTo(-74, -30, -40, -34); G.lineTo(50, -40); G.quadraticCurveTo(76, -30, 70, 0); G.closePath(); G.fillStyle = '#5a7fb8'; G.fill(); ink(4); G.beginPath(); G.moveTo(10, -38); G.quadraticCurveTo(40, -66, 66, -26); G.fillStyle = '#4a6a9a'; G.fill(); ink(3); fillE(30, -50, 14, 10, '#f2f0ea'); G.restore(); }
  if (t > 199) { G.save(); G.translate(1720, FLOOR); G.scale(1, .4); G.beginPath(); G.moveTo(-80, 0); G.lineTo(60, 0); G.lineTo(60, -40); G.lineTo(-80, -40); G.closePath(); G.fillStyle = '#e8e2d8'; G.fill(); ink(3); G.restore(); }
  if (cr && t > 10) crumbShape(cr.x, cr.y, 1, cr.r);
  if (cr && t > 137.9 && t < 140) glow(cr.x + 8, cr.y - 8, 40, 'rgba(255,250,200,1)', .9 * Math.abs(Math.sin(t * 3)));
  if (!(t > 229.8)) baronLater = null;
  if (!stuck) baron(B, t);
  tumble(t);
  if (Gs.vis && !outside) gosha(Gs, t);
  zhuzha(Z, t);
  if (t > 101.5 && t < 116 || t > 121 && t < 129.5) speedLines(Gs.x, FLOOR - 40, Gs.face, t, .8);
  if (t > 103.5 && t < 118 || t > 122.5 && t < 130) speedLines(Z.x, FLOOR - 10, Z.face, t, .6);
  if (stuck) { sofa(t); baron(B, t); }
  granny(Gm, t);
  if (cr && t <= 10) crumbShape(cr.x, cr.y, 1, cr.r);
  // effects
  bonkFx(Z.x + 110, FLOOR - 90, 56.4, t, 'БОНЬК!');
  for (const a of [62.4, 64.4, 66.4, 68.4]) bonkFx(Z.x + 110, FLOOR - 100, a, t, 'тук');
  dustCloud(2930, 650, 76.6, t, .9, '#f4ece0');
  dustCloud(1700, 840, 155.8, t, 1.6);
  dustCloud(1720, 820, 199.0, t, 1);
  dustCloud(1560, 820, 201.0, t, 1);
  if (t > 213.8 && t < 215.4) { const u = seg(t, 213.8, 214.6); dustCloud(lerp(1470, 1600, u), 820, 213.8, t, 1.3, '#a9a49c'); }
  if (t > 118.3 && t < 120.8) { bonkFx(420, 520, 118.4, t, 'БДЫЩ!'); bonkFx(250, 380, 119.3, t, 'ДЗЫНЬ!'); bonkFx(380, 280, 120.0, t, 'БАМ!'); }
  if (t > 98 && t < 99.6) { const s = back(seg(t, 98, 98.3)); G.save(); G.translate(Z.x, FLOOR - 170); G.scale(s, s); G.fillStyle = '#ff4a3d'; G.font = '600 90px Oswald'; G.textAlign = 'center'; G.fillText('!', 0, 0); G.restore(); }
  g.restore();
  bars(t); grade(t);
  // UI
  titleCard(t);
  chyron(t, 20.2, 26.6, 'ЖУЖА', 'робот-пылесос · считает себя героем');
  chyron(t, 33.0, 39.6, 'ГОЛУБЬ ГОША', 'вес: как у небольшой курицы · цель: еда');
  chyron(t, 79.0, 84.0, 'ТЕХНИКА «Я НОСОК»', 'древняя · не работает');
  chyron(t, 177.0, 183.0, 'ПОБЕДИТЕЛЬ', 'диван');
  chyron(t, 234.0, 238.4, 'БАРОН', 'кот · настоящий победитель');
  slowTag(t);
  endCard(t);
  subs(t);
  // fades
  const fin = 1 - seg(t, 0, .8); if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  if (t > DUR - 1.5) { g.fillStyle = `rgba(0,0,0,${seg(t, DUR - 1.5, DUR)})`; g.fillRect(0, 0, W, H); }
}
let baronLater = null;

// ———————————————————————————— звуковые события (для mix.py)
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  // music cues: section moods
  for (const [t, d, mood] of [[0, 17, 'morning'], [17, 13, 'hero'], [30, 20, 'pigeon'], [50, 20, 'hero2'], [70, 30, 'sneak'], [100, 30, 'chase'], [130, 10, 'western'], [140, 18, 'slowmo'], [158, 32, 'stuck'], [190, 40, 'granny'], [230, 13, 'outro'], [243, 8, 'end']]) add('mus', t, { d, mood });
  add('steps', 1.6, { d: 12, rate: 3.1 }); add('steps', 190, { d: 7, rate: 2.6 }); add('steps', 199.4, { d: 3.2, rate: 2.6 }); add('steps', 223, { d: 9, rate: 2.6 });
  add('door', 12.6); add('door', 190.2); add('door', 231);
  add('tick', 8.15); add('tick', 8.5, { v: .5 }); add('sting', 15.0);
  add('boot', 17.5); add('blink', 18.2); add('blink', 18.7); add('fanfare', 23.8);
  add('tap', 29.6); add('tap', 30.0); add('flap', 29.0, { d: 1.3 }); add('squeak', 30.4, { d: .8 }); add('coo', 33.5); add('coo', 37.5); add('paper', 40.2); add('paper', 46.9); add('coo', 48.5, { v: .8 });
  add('hum', 51, { d: 19, v: .6 }); add('bonk', 56.4, { v: 1 }); add('twinkle', 57, { d: 3 }); for (const a of [62.4, 64.4, 66.4, 68.4]) add('bonk', a, { v: .45 }); add('beep', 60.6, { sad: 1 }); add('beep', 69.2, { sad: 1 });
  add('creak', 60.5); add('squeeze', 70.6, { d: 2.8 }); add('pop', 73.5); add('flap', 73.5, { d: 1 }); add('thump', 74.5, { v: .5 }); add('poof', 76.6); add('flap', 78, { d: 2 }); add('thump', 80, { v: .4 });
  for (const [a, b] of [[82, 85], [88, 90.5], [94, 96]]) add('tiptoe', a, { d: b - a });
  for (const a of [85, 90.5, 96]) { add('freeze', a); add('whoosh', a, { v: .4 }); }
  add('q', 90.8); add('hum', 83, { d: 15, v: .2 });
  add('alarm', 98, { d: 32 }); add('hum', 98, { d: 32, v: 1 }); add('coo', 98.5, { v: 1.2, eep: 1 }); add('flap', 100, { d: 1.5 }); add('scurry', 101.5, { d: 14.5 }); add('scurry', 121, { d: 8.5 }); add('clatter', 118.3, { d: 2.6 });
  add('skid', 129.3); add('skid', 129.8); add('whistle', 130.4); add('tumble', 130.6, { d: 3.6 });
  add('zoom', 133.8); add('zoom', 135.9); add('zoom', 137.9); add('gleam', 138.2);
  add('slowmo', 140, { d: 18 }); add('crash', 155.9); add('hum', 141, { d: 58, v: .45, muffle: 1 }); add('struggle', 158, { d: 41 });
  add('medal', 176.6); add('pull', 199); add('pull', 201); add('thump', 199.6, { v: .4 }); add('thump', 201.6, { v: .5 }); add('clang', 201.3);
  add('chime', 203.6); add('hum', 212.8, { d: 1.6, v: 1 }); add('poofbig', 213.9); add('cough', 214.8); add('beep', 216.2, { sad: 1 }); add('laugh', 214.6, { d: 4 });
  add('flap', 226, { d: 2.4 }); add('coo', 222.5, { v: .8 });
  add('jump', 230.2); add('thump', 231, { v: .35 }); add('munch', 232.4, { d: 10 }); add('purr', 233.4, { d: 5 });
  add('zoom', 238.5); add('narrow', 238.7); add('sting', 239.6, { v: .8 });
  for (const s of SUBS) add('sub', s.a, { t1: +s.b.toFixed(3), text: s.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = DUR; window.render = render; window.SUBS = SUBS;
await document.fonts.load('500 90px Oswald', 'ОПЕРАЦИЯ'); await document.fonts.load('300 40px Oswald', 'СЕРИЯ'); await document.fonts.load('600 46px Inter', 'Жужа'); await document.fonts.load('500 30px Inter', 'Жужа');
window.EV = events();
render(parseFloat(qs.get('t') ?? '3'));
window.READY = true;
