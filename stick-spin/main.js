// «Почему мы не чувствуем, что Земля крутится» — stickman explainer (vertical 1080×1920, 2D canvas)
const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const TAU = Math.PI * 2, INK = '#16161a';

// ———————————————————————————— timeline
const LINES = [
  ['tea', 'Стик думает, что стоит на месте. Но он мчится быстрее самолёта!'],
  ['vera', 'Подписчица Вера спросила: почему мы не чувствуем вращение Земли? Ведь на экваторе это тысяча шестьсот семьдесят километров в час!'],
  ['plane', 'Представьте самолёт: он летит девятьсот километров в час, а вода в стакане не проливается.'],
  ['brake', 'Но стоит резко затормозить — и вы это сразу почувствуете.'],
  ['feel', 'Тело чувствует не скорость, а её изменение. А Земля крутится плавно и ровно.'],
  ['together', 'Вместе с нами движутся воздух, дома и деревья. Всё одновременно.'],
  ['stars', 'Но заметить вращение можно: ночью звёзды плывут по небу — это мы поворачиваемся.'],
  ['sub', 'Пишите свои вопросы в комментариях и подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.07,4.75],[5.23,13.44],[13.87,19.40],[19.76,23.27],[23.70,29.38],[29.79,34.48],[34.84,40.83],[41.26,45.26]];
// spoken phrases (voice time) — subtitles follow these; WORDS = when key words are said
const PH = [[0.07,2.17,'Стик думает, что стоит на месте.'],[2.44,4.75,'Но он мчится быстрее самолёта!'],[5.23,6.88,'Подписчица Вера спросила:'],[7.20,9.35,'почему мы не чувствуем вращение Земли?'],
  [9.68,13.44,'Ведь на экваторе это 1 670 км/ч!'],[13.87,14.96,'Представьте самолёт:'],[15.26,19.40,'он летит 900 км/ч, а вода в стакане не проливается.'],[19.76,23.27,'Но стоит резко затормозить — и вы это сразу почувствуете.'],
  [23.70,26.68,'Тело чувствует не скорость, а её изменение.'],[26.99,29.38,'А Земля крутится плавно и ровно.'],[29.79,33.00,'Вместе с нами движутся воздух, дома и деревья.'],[33.28,34.48,'Всё одновременно.'],
  [34.84,36.63,'Но заметить вращение можно:'],[37.00,38.95,'ночью звёзды плывут по небу —'],[39.27,40.83,'это мы поворачиваемся.'],[41.26,45.26,'Пишите свои вопросы в комментариях и подписывайтесь на «Факты за минуту»!']];
const WORDS = { 'tea|Но он': 2.44, 'tea|быстрее': 3.5, 'vera|Ведь': 9.68, 'vera|тысяча': 10.8, 'plane|девятьсот': 15.75, 'plane|вода': 17.3, 'plane|не проливается': 18.4, 'brake|резко': 20.45,
  'feel|Тело': 23.7, 'feel|изменение': 25.6, 'feel|А Земля': 26.99, 'together|Всё': 33.28, 'stars|ночью': 37.0, 'stars|это мы': 39.27, 'sub|вопросы': 42.0, 'sub|подписывайтесь': 43.3 };
const VOICE_OFFSET = 0.4, BPM = 104, BEAT = 60 / BPM;
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
// scene-local time when a word of that scene's line is (approximately) spoken
const word = (id, w) => { if (VOICE && WORDS[id + '|' + w] != null) return WORDS[id + '|' + w] + VOICE_OFFSET - SCN[id].t0; const v = VON[id], i = Math.max(0, v.text.indexOf(w)); return v.t + v.d * i / v.text.length - SCN[id].t0; };

const cv = document.getElementById('ov'), g = cv.getContext('2d');

// ———————————————————————————— drawing kit
function path(pts, close) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (close) g.closePath(); }
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fillStroke(fill, lw = 7, col = INK) { if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = col; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); } }
function circle(x, y, r, fill, lw = 7, col = INK) { g.beginPath(); g.arc(x, y, r, 0, TAU); fillStroke(fill, lw, col); }
function line(a, b, lw = 7, col = INK) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.stroke(); }
function txt(s, x, y, size, o = {}) {
  g.save(); g.font = `${o.w || 500} ${size}px ${o.f || 'Oswald'}`; g.textAlign = o.al || 'center'; g.textBaseline = 'middle'; g.letterSpacing = (o.sp ?? .06) * size + 'px';
  if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = o.sc || '#fff'; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = o.fill || INK; g.fillText(s, x, y); g.restore();
}
// pop-in title: scale with overshoot
function pop(p, x, y, f) { if (p <= 0) return; g.save(); g.translate(x, y); const s = back(p); g.scale(s, s); g.globalAlpha = clamp(p * 3); f(); g.restore(); }
function title(s, y, p, size = 110, o = {}) { pop(p, o.x ?? W / 2, y, () => txt(s, 0, 0, size, { stroke: size * .16, ...o })); }

// two-bone IK in the "0 = down, +x = positive" angle convention
const ang = (vx, vy) => Math.atan2(vx, vy);
function ik(base, target, l1, l2, bend) {
  const dx = target[0] - base[0], dy = target[1] - base[1], d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1, l1 + l2 - .01);
  const al = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), be = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  return [ang(dx, dy) + bend * al, -bend * (Math.PI - be)];
}
// stickman: (x,y) = hip; pose angles: 0 = straight down, π = up, +  = towards +x. Limbs [upper, lower(relative)] or {to:[x,y], bend}
function stick(x, y, s, p = {}, o = {}) {
  const L = { torso: 105, ua: 50, fa: 48, th: 60, sh: 58, head: 34 }, col = o.col || INK, lw = 11 * s, lean = p.lean || 0;
  const hip = [x, y], neck = [x + Math.sin(lean) * L.torso * s, y - Math.cos(lean) * L.torso * s];
  const sh = [lerp(hip[0], neck[0], .93), lerp(hip[1], neck[1], .93)];
  const limb = (base, q, l1, l2, def) => {
    const [a1, a2] = q && q.to ? ik(base, q.to, l1 * s, l2 * s, q.bend ?? 1) : (q || def);
    const j = [base[0] + Math.sin(a1) * l1 * s, base[1] + Math.cos(a1) * l1 * s], e = [j[0] + Math.sin(a1 + a2) * l2 * s, j[1] + Math.cos(a1 + a2) * l2 * s]; return [base, j, e];
  };
  const lL = limb(hip, p.legL, L.th, L.sh, [-.18, 0]), lR = limb(hip, p.legR, L.th, L.sh, [.18, 0]);
  const aL = limb(sh, p.armL, L.ua, L.fa, [-.35, .15]), aR = limb(sh, p.armR, L.ua, L.fa, [.35, -.15]);
  const hd = [neck[0] + Math.sin(lean + (p.nod || 0)) * (L.head + 6) * s, neck[1] - Math.cos(lean + (p.nod || 0)) * (L.head + 6) * s];
  if (o.shadow !== false && !o.noShadow) { g.save(); g.globalAlpha = .12; g.beginPath(); g.ellipse(x, o.floor ?? Math.max(lL[2][1], lR[2][1]) + 6 * s, 70 * s, 11 * s, 0, 0, TAU); g.fillStyle = '#000'; g.fill(); g.restore(); }
  for (const l of [lL, lR, [hip, neck], aL, aR]) { g.beginPath(); g.moveTo(...l[0]); for (const q of l.slice(1)) g.lineTo(...q); g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
  if (o.beforeHead) o.beforeHead({ handL: aL[2], handR: aR[2] });
  circle(hd[0], hd[1], L.head * s, o.headFill || '#fff', lw * .85, col);
  face(hd, s, p.face || 'calm', p.look ?? 0, col, lean + (p.nod || 0));
  return { hip, neck, head: hd, handL: aL[2], handR: aR[2], footL: lL[2], footR: lR[2], elbowR: aR[1], elbowL: aL[1] };
}
function face(c, s, kind, look, col, tilt) {
  g.save(); g.translate(c[0], c[1]); g.rotate(tilt); g.translate(look * 9 * s, 2 * s); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineWidth = 4.5 * s;
  const ex = 11 * s, ey = -6 * s;
  if (kind === 'shock') { for (const k of [-1, 1]) { g.beginPath(); g.arc(k * ex, ey - 2 * s, 7 * s, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.stroke(); g.beginPath(); g.arc(k * ex + look * 2 * s, ey - 2 * s, 2.8 * s, 0, TAU); g.fillStyle = col; g.fill(); } g.beginPath(); g.ellipse(0, 14 * s, 6 * s, 8 * s, 0, 0, TAU); g.fill(); }
  else if (kind === 'happy') { for (const k of [-1, 1]) { g.beginPath(); g.arc(k * ex, ey + 2 * s, 5.5 * s, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } g.beginPath(); g.arc(0, 6 * s, 12 * s, .15 * Math.PI, .85 * Math.PI); g.closePath(); g.fill(); }
  else if (kind === 'closed') { for (const k of [-1, 1]) { g.beginPath(); g.arc(k * ex, ey, 5.5 * s, .1 * Math.PI, .9 * Math.PI); g.stroke(); } g.beginPath(); g.arc(0, 8 * s, 8 * s, .2 * Math.PI, .8 * Math.PI); g.stroke(); }
  else if (kind === 'sip') { for (const k of [-1, 1]) { g.beginPath(); g.arc(k * ex, ey, 5.5 * s, .1 * Math.PI, .9 * Math.PI); g.stroke(); } g.beginPath(); g.arc(4 * s, 13 * s, 3.5 * s, 0, TAU); g.stroke(); }
  else if (kind === 'wow') { for (const k of [-1, 1]) { g.beginPath(); g.arc(k * ex, ey, 4 * s, 0, TAU); g.fill(); } g.beginPath(); g.arc(0, 12 * s, 7 * s, 0, Math.PI); g.closePath(); g.fill(); }
  else { for (const k of [-1, 1]) { g.beginPath(); g.arc(k * ex, ey, 4 * s, 0, TAU); g.fill(); } g.beginPath(); g.arc(0, 4 * s, 11 * s, .2 * Math.PI, .8 * Math.PI); g.stroke(); }
  g.restore();
}
// cartoon objects
function cloud(x, y, s, fill = '#fff', lw = 6) {
  g.save(); g.translate(x, y); g.scale(s, s); g.beginPath();
  g.moveTo(-110, 30); g.arc(-70, 10, 42, Math.PI * .75, Math.PI * 1.6); g.arc(-10, -22, 58, Math.PI * 1.15, Math.PI * 1.95); g.arc(62, 0, 46, Math.PI * 1.4, Math.PI * .3); g.lineTo(-110, 34); g.closePath();
  g.restore(); fillStroke(fill, lw);
}
function plane(x, y, s, flip = 1) {
  g.save(); g.translate(x, y); g.scale(s * flip, s);
  path([[-150, -50], [-120, -50], [-80, -10], [-150, -10]], true); fillStroke('#ff5a4e', 6);
  rrect(-170, -22, 330, 56, 28); fillStroke('#fff', 6);
  g.beginPath(); g.moveTo(150, -6); g.quadraticCurveTo(178, 6, 150, 30); fillStroke('#fff', 0);
  path([[-10, 10], [40, 10], [-40, 80], [-70, 80]], true); fillStroke('#9fb4c8', 6);
  for (let i = 0; i < 6; i++) circle(-90 + i * 34, -2, 7, '#5bb8ff', 3);
  rrect(118, -12, 22, 14, 5); fillStroke('#5bb8ff', 3);
  g.restore();
}
function house(x, y, s, wall = '#ffd76a', roof = '#e8573f') {
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(-70, -110, 140, 110, 4); fillStroke(wall, 6); path([[-90, -105], [0, -185], [90, -105]], true); fillStroke(roof, 6);
  rrect(-18, -62, 36, 62, 4); fillStroke('#8a5a3c', 5); rrect(-56, -90, 30, 28, 3); fillStroke('#bfe6ff', 5); rrect(26, -90, 30, 28, 3); fillStroke('#bfe6ff', 5);
  g.restore();
}
function tree(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(-12, -90, 24, 90, 6); fillStroke('#9a6440', 6); circle(0, -140, 66, '#58c25a', 6); circle(-38, -110, 40, '#58c25a', 6); circle(36, -112, 42, '#58c25a', 6);
  g.beginPath(); g.arc(0, -140, 60, 0, TAU); g.fillStyle = '#58c25a'; g.fill();
  g.restore();
}
function bird(x, y, s, t, ph = 0) { const f = Math.sin(t * 12 + ph) * 22; g.beginPath(); g.moveTo(x - 28 * s, y - f * s); g.quadraticCurveTo(x - 12 * s, y - 14 * s, x, y); g.quadraticCurveTo(x + 12 * s, y - 14 * s, x + 28 * s, y - f * s); g.lineWidth = 6 * s; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
function arrowArc(cx, cy, r, a0, a1, lw = 9, col = INK) {
  g.beginPath(); g.arc(cx, cy, r, a0, a1, a1 < a0); g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.stroke();
  const dir = a1 > a0 ? 1 : -1, ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r, tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, k = lw * 3.2;
  path([[ex + tx * k * .9, ey + ty * k * .9], [ex - ty * k * .6, ey + tx * k * .6], [ex + ty * k * .6, ey - tx * k * .6]], true); fillStroke(col, 3, col);
}
function speedLines(t, k, y0, y1, n = 26, speed = 2200, col = '#c9ccd4') {
  if (k <= 0) return; g.save(); g.globalAlpha = k; g.lineCap = 'round'; g.strokeStyle = col;
  for (let i = 0; i < n; i++) { const y = y0 + hash(i) * (y1 - y0), len = 120 + hash(i + 9) * 320, sp = speed * (.6 + hash(i + 3) * .8), x = W + 400 - ((t * sp + hash(i + 5) * 3000) % (W + 900)); g.lineWidth = 5 + hash(i + 7) * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); }
  g.restore();
}
function sign(x, y, w, h, s1, size, o = {}) { rrect(x - w / 2, y - h / 2, w, h, 22); fillStroke(o.fill || '#ffd23f', 8); txt(s1, x, y + 3, size, { fill: o.ink || INK }); }

// globe with tilt: continents are radial blobs on the sphere
const CONT = [[.2, .5, .55], [1.4, .25, .5], [2.5, -.35, .45], [3.6, .55, .6], [4.6, -.2, .5], [5.5, .3, .35], [.9, -.6, .3], [3.1, .05, .28]].map(([lon, lat, r], k) =>
  [...Array(18)].map((_, i) => { const a = i / 18 * TAU, rr = r * (.7 + .5 * hash(k * 31 + i) + .15 * Math.sin(a * 3 + k)); return [lon + rr * Math.cos(a) / Math.cos(lat), lat + rr * Math.sin(a) * .8]; }));
function sph(cx, cy, r, lon, lat, rot, e) { const x = r * Math.cos(lat) * Math.sin(lon + rot), y = r * Math.sin(lat), z = r * Math.cos(lat) * Math.cos(lon + rot); const yy = y * Math.cos(e) - z * Math.sin(e), zz = y * Math.sin(e) + z * Math.cos(e); return [cx + x, cy - yy, zz]; }
function globe(cx, cy, r, rot, o = {}) {
  const e = o.tilt ?? .32; circle(cx, cy, r, '#4fb0f0', 0); g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  for (const c of CONT) { const pts = c.map(([lo, la]) => sph(cx, cy, r, lo, la, rot, e)); if (!pts.some(p => p[2] > 0)) continue; path(pts.map(p => { if (p[2] >= 0) return p; const dx = p[0] - cx, dy = p[1] - cy, m = Math.hypot(dx, dy) || 1; return [cx + dx / m * r, cy + dy / m * r]; }), true); fillStroke('#6fcf4f', 5); }
  const np = sph(cx, cy, r, 0, Math.PI / 2, rot, e); g.beginPath(); g.ellipse(np[0], np[1], r * .42, r * .42 * Math.sin(e) + 6, 0, 0, TAU); fillStroke('#ffffff', 5);
  g.globalAlpha = .1; circle(cx + r * .35, cy + r * .3, r * 1.05, '#003', 0); g.globalAlpha = 1;
  if (o.equator) { g.setLineDash([26, 18]); g.lineDashOffset = -rot * 200; g.beginPath(); let on = false; for (let i = 0; i <= 90; i++) { const p = sph(cx, cy, r, i / 90 * TAU, 0, 0, e); if (p[2] > 0) { on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); on = true; } else on = false; } g.lineWidth = 9; g.strokeStyle = '#ff3d3d'; g.stroke(); g.setLineDash([]); }
  g.restore(); circle(cx, cy, r, null, 9);
}

// ———————————————————————————— scenes
const GROUND = 1420;
function floorLine(y = GROUND, t = 0, k = 0) {
  line([40, y], [W - 40, y], 8);
  if (k > 0) { g.save(); g.globalAlpha = k; for (let i = 0; i < 9; i++) { const x = W + 100 - ((t * 1900 + i * 160) % (W + 200)); line([x, y + 34], [x + 60, y + 34], 7, '#b8bcc6'); } g.restore(); }
}
function mug(h, a, lvl = 1, t = 0) {
  g.save(); g.translate(h[0], h[1]); g.rotate(a);
  rrect(-8, -56, 64, 70, 10); fillStroke('#ff8a3d', 7); g.beginPath(); g.arc(60, -22, 18, -Math.PI / 2, Math.PI / 2); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.restore();
}
function steam(x, y, t, k = 1, drift = 0) { g.save(); g.globalAlpha = .5 * k; g.lineWidth = 6; g.strokeStyle = '#a9adb8'; g.lineCap = 'round'; for (let j = 0; j < 3; j++) { g.beginPath(); for (let i = 0; i <= 12; i++) { const u = i / 12; const px = x + (j - 1) * 20 + Math.sin(u * 6 + t * 5 + j) * 8 - drift * u * 120, py = y - u * 110; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } g.restore(); }
function thought(x, y, w, h, s, p) { if (p <= 0) return; pop(p, x, y, () => { circle(-w * .32, h * .62 + 34, 12, '#fff', 5); circle(-w * .38, h * .62 + 66, 8, '#fff', 5); rrect(-w / 2, -h / 2, w, h, h / 2); fillStroke('#fff', 7); txt(s, 0, 4, 54, { w: 600, f: 'Inter', sp: 0 }); }); }
function cabin(t, lt, cloudV, cloudOff, shakeK) {
  g.fillStyle = '#eaf0f7'; g.fillRect(0, 0, W, H);
  rrect(-40, 1420, W + 80, 600, 0); fillStroke('#c7cfdc', 0); line([0, 1420], [W, 1420], 8);
  // window
  g.save(); rrect(110, 330, 420, 600, 200); g.fillStyle = '#8ed1ff'; g.fill(); g.clip();
  const sky = g.createLinearGradient(0, 330, 0, 930); sky.addColorStop(0, '#5fb8ff'); sky.addColorStop(1, '#c4e8ff'); g.fillStyle = sky; g.fillRect(110, 330, 420, 600);
  for (let i = 0; i < 7; i++) { const x = 700 - ((cloudOff * (.7 + hash(i) * .6) + hash(i + 4) * 1500) % 1100), y = 420 + hash(i + 2) * 460; cloud(x, y, .55 + hash(i + 8) * .5, '#fff', 0); }
  g.restore(); rrect(110, 330, 420, 600, 200); fillStroke(null, 22, '#c7cfdc'); rrect(110, 330, 420, 600, 200); fillStroke(null, 7);
  rrect(88, 308, 464, 644, 222); fillStroke(null, 7);
}

const SH = {
  tea(lt, D, t) {
    const tm = word('tea', 'Но он'), tq = word('tea', 'быстрее'), k = eo(seg(lt, tm, tm + .5));
    speedLines(lt, k, 220, 1380, 30, 2600);
    if (lt > tm) { const px = W + 260 - (lt - tm) * 420; plane(px, 520 + Math.sin(lt * 3) * 8, 1.2); speedLines(lt + 3, k * .9, 470, 600, 5, 2600, '#d7dae0'); }
    floorLine(GROUND, lt, k);
    const s = 2.3, sip = lt < tm ? eio(seg(lt % 2.6, .5, 1.1)) * (1 - eio(seg(lt % 2.6, 1.6, 2.2))) : 0;
    const wind = k * (.08 + Math.sin(lt * 17) * .02), hx = 520, hy = GROUND - 118 * s;
    const P = stick(hx, hy, s, {
      lean: -wind, face: lt > tm ? (lt > tq ? 'shock' : 'wow') : (sip > .5 ? 'sip' : 'closed'), look: lt > tm ? -1 : .4,
      armR: { to: [hx + lerp(105, 55, sip), hy - lerp(170, 235, sip)], bend: -1 }, armL: lt > tm ? [-2.4 + Math.sin(lt * 14) * .3, -.4] : [-.3, .1],
    }, { floor: GROUND });
    mug(P.handR, lerp(0, -.7, sip) - wind, 1, lt); if (lt < tm || true) steam(P.handR[0] + 25, P.handR[1] - 70, lt, 1 - sip * .7, k * 2.2);
    if (lt > tm) { g.save(); g.globalAlpha = k; for (let i = 0; i < 3; i++) line([P.head[0] + 70 + i * 6, P.head[1] - 60 + i * 34], [P.head[0] + 110 + i * 10, P.head[1] - 70 + i * 34], 7); g.restore(); }
    thought(560, 360, 640, 130, 'Я стою на месте', seg(lt, .4, .9) * (1 - seg(lt, tm - .3, tm)));
    title('СТИК', 210, seg(lt, .1, .5) * (1 - seg(lt, tm - .3, tm)), 90, { fill: '#2b6cff' });
    title('МЧИТСЯ', 250, seg(lt, tm + .1, tm + .5), 120, { fill: '#ff3d3d' }); title('БЫСТРЕЕ САМОЛЁТА!', 370, seg(lt, tq, tq + .4), 82);
  },
  vera(lt, D, t) {
    const tq = word('vera', 'Ведь'), tn = word('vera', 'тысяча'), rot = lt * .55;
    pop(seg(lt, .15, .6), W / 2, 330, () => {
      rrect(-450, -130, 900, 260, 40); g.save(); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = '#fff'; g.fill(); g.restore(); fillStroke(null, 7);
      circle(-360, -50, 50, '#ff8fc2', 6); txt('В', -360, -46, 56, { fill: '#fff' });
      txt('Вера', -285, -78, 44, { al: 'left', w: 600, f: 'Inter', sp: 0 }); txt('подписчица', -160, -78, 34, { al: 'left', w: 500, f: 'Inter', sp: 0, fill: '#8a8f99' });
      txt('Почему мы не чувствуем,', -285, -10, 48, { al: 'left', w: 500, f: 'Inter', sp: 0 }); txt('что Земля крутится?', -285, 52, 48, { al: 'left', w: 500, f: 'Inter', sp: 0 });
      g.save(); g.globalAlpha = .5 + .5 * Math.sin(lt * 6); txt('?', 380, 40, 120, { fill: '#ff3d3d' }); g.restore();
    });
    const cx = 540, cy = 1060, r = 330, gp = eo(seg(lt, .3, 1));
    g.save(); g.translate(cx, cy); g.scale(gp, gp); g.translate(-cx, -cy);
    arrowArc(cx, cy, r + 70, Math.PI * 1.15, Math.PI * 1.15 + (Math.PI * .7) * eio(seg(lt, .8, 1.8)), 10, '#2b6cff');
    globe(cx, cy, r, rot, { equator: true });
    const ep = sph(cx, cy, r, 0, 0, 0, .32), s = .85, fy = ep[1] + 2;
    const hold = eo(seg(lt, tn - .3, tn + .2));
    const P = stick(ep[0], fy - 118 * s, s, { face: lt > tq ? 'wow' : 'calm', lean: -.06, armL: hold ? { to: [ep[0] - 60, fy - 230 * s - 70 * hold], bend: -1 } : [-.5, .2], armR: hold ? { to: [ep[0] + 60, fy - 230 * s - 70 * hold], bend: 1 } : [.5, -.2], legL: [-.5 + Math.sin(lt * 9) * .5, .2], legR: [.5 - Math.sin(lt * 9) * .5, .2] }, { floor: fy, noShadow: true });
    if (hold > 0) { g.save(); const sy = P.handL[1] - 60; g.translate(ep[0], sy + (1 - back(hold)) * 80); g.globalAlpha = clamp(hold * 3); sign(0, 0, 520, 130, '1 670 КМ/Ч', 84); line([-200, 66], [-200, 120], 10); line([200, 66], [200, 120], 10); g.restore(); }
    g.restore();
    pop(seg(lt, 1.4, 1.9), 945, cy + 90, () => txt('ЭКВАТОР', 0, 0, 44, { fill: '#ff3d3d', stroke: 8 }));
  },
  plane(lt, D, t) {
    const tn = word('plane', 'девятьсот'), tw = word('plane', 'вода'), tn2 = word('plane', 'не проливается');
    cabin(t, lt, 1, lt * 700, 0);
    // display
    pop(seg(lt, tn - .2, tn + .2), 800, 250, () => { rrect(-210, -80, 420, 160, 26); fillStroke('#22262e', 7); txt('900 КМ/Ч', 0, 4, 82, { fill: '#7dff8a' }); });
    // seat
    rrect(700, 820, 190, 520, 50); fillStroke('#3d6fd6', 8); rrect(600, 1290, 300, 80, 30); fillStroke('#3d6fd6', 8); rrect(740, 1370, 30, 50, 4); fillStroke('#888', 5);
    // tray
    rrect(330, 1170, 250, 26, 8); fillStroke('#d8dde6', 7); line([560, 1196], [650, 1290], 8);
    const pour = eio(seg(lt, .6, 1.2)) * (1 - eio(seg(lt, D - 1.2, D - .5))), fill = clamp(seg(lt, .9, D - 1.4) * .75);
    const gx = 430, gy = 1170;
    const P = stick(740, 1290, 2.1, { face: lt > tn2 ? 'happy' : 'calm', look: -1, legL: [-Math.PI / 2, Math.PI / 2], legR: [-Math.PI / 2 + .12, Math.PI / 2 - .12], armR: { to: [gx + 70 - 20 * pour, gy - 170 - 40 * pour], bend: 1 }, armL: { to: [600, 1250], bend: 1 }, lean: -.05 }, { noShadow: true });
    // glass
    glass(gx, gy, fill, 0, lt);
    // bottle in hand
    const bh = P.handR, ba = -lerp(.3, 1.9, pour); g.save(); g.translate(bh[0], bh[1]); g.rotate(ba); rrect(-22, -110, 44, 120, 14); fillStroke('#bfe9ff', 6); rrect(-12, -140, 24, 32, 6); fillStroke('#2b6cff', 5); g.restore();
    if (pour > .8 && fill < .75) { const mx = bh[0] + Math.sin(ba + Math.PI) * -125, my = bh[1] - Math.cos(ba) * 125; g.save(); g.lineWidth = 9; g.strokeStyle = '#4fb0f0'; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx - 10, my + 40, gx, gy - 40); g.stroke(); g.restore(); }
    title('НЕ ПРОЛИВАЕТСЯ', 1010, seg(lt, tn2, tn2 + .4), 64, { fill: '#2b6cff', x: 330 });
  },
  brake(lt, D, t) {
    const tb = word('brake', 'резко') - .1, jolt = seg(lt, tb, tb + .25), after = lt - tb;
    const shakeK = lt > tb ? Math.exp(-after * 2.5) : 0, sx = Math.sin(lt * 61) * 22 * shakeK, sy = Math.cos(lt * 47) * 16 * shakeK;
    g.save(); g.translate(sx, sy); g.rotate(Math.sin(lt * 37) * .015 * shakeK);
    const off = lt < tb ? lt * 700 : tb * 700 + 700 * (1 - Math.exp(-after * 6)) / 6; cabin(t, lt, 1, 1000 + off, shakeK);
    pop(1, 800, 250, () => { rrect(-210, -80, 420, 160, 26); fillStroke('#22262e', 7); txt(lt < tb ? '900 КМ/Ч' : String(Math.max(0, Math.round(900 * Math.exp(-after * 5)))) + ' КМ/Ч', 0, 4, 82, { fill: lt < tb ? '#7dff8a' : '#ff5a4e' }); });
    rrect(700, 820, 190, 520, 50); fillStroke('#3d6fd6', 8); rrect(600, 1290, 300, 80, 30); fillStroke('#3d6fd6', 8); rrect(740, 1370, 30, 50, 4); fillStroke('#888', 5);
    rrect(330, 1170, 250, 26, 8); fillStroke('#d8dde6', 7); line([560, 1196], [650, 1290], 8);
    const lunge = eo(jolt) * (1 - .6 * eio(seg(after, .4, 1.4)));
    const P = stick(740 - 40 * lunge, 1290, 2.1, { face: lt > tb ? 'shock' : 'calm', look: -1, lean: -.55 * lunge, legL: [-Math.PI / 2 - .3 * lunge, Math.PI / 2 + .3 * lunge], legR: [-Math.PI / 2 + .12, Math.PI / 2 - .12],
      armR: lt > tb ? { to: [640, 1280], bend: 1 } : { to: [500, 1000], bend: 1 }, armL: lt > tb ? { to: [790 + Math.sin(lt * 20) * 5, 830], bend: -1 } : { to: [600, 1250], bend: 1 } }, { noShadow: true });
    // glass slides & falls
    const gs = seg(after, 0, .35), fall = Math.max(0, after - .35);
    let gx = 430 - 120 * eio(gs), gy = 1170, ga = 0;
    if (fall > 0) { gx -= fall * 260; gy += 4000 * fall * fall * .5 / 4; ga = -Math.min(2.6, fall * 7); }
    if (gy < 1420) glass(gx, Math.min(gy, 1400), .75 * (1 - seg(fall, 0, .15)), ga, lt);
    else { glass(gx, 1400, 0, -Math.PI / 2, lt); }
    if (fall > 0) { for (let i = 0; i < 14; i++) { const u = fall - hash(i) * .1; if (u <= 0) continue; const x = 320 - hash(i + 3) * 140 * u * 3 - u * 200, y = 1150 + (hash(i + 7) - .9) * 500 * u + 1500 * u * u; if (y < 1420) circle(x, y, 9 + hash(i) * 7, '#4fb0f0', 0); else { g.beginPath(); g.ellipse(250 - hash(i) * 60, 1424, 60 + 80 * clamp((fall - .5) * 2), 10, 0, Math.PI, TAU); g.fillStyle = '#4fb0f0'; g.fill(); } } }
    g.restore();
    if (lt > tb) { g.save(); g.globalAlpha = clamp(after * 4); txt('!!', P.head[0] + 120, P.head[1] - 90, 120, { fill: '#ff3d3d', stroke: 14 }); g.restore(); }
    title('ТОРМОЖЕНИЕ!', 520, seg(lt, tb, tb + .35), 110, { fill: '#ff3d3d', x: W / 2 + Math.sin(lt * 50) * 6 * shakeK });
  },
  feel(lt, D, t) {
    const t1 = word('feel', 'Тело'), t2 = word('feel', 'изменение'), t3 = word('feel', 'А Земля');
    rrect(70, 220, 940, 700, 44); fillStroke('#fff', 9);
    txt('ТЕЛО ЧУВСТВУЕТ', W / 2, 310, 70, {});
    line([110, 370], [970, 370], 5, '#d5d8de');
    pop(seg(lt, t1 + .3, t1 + .8), W / 2, 500, () => {
      g.save(); g.translate(-330, 0); line([-90, 0], [90, 0], 12, '#36b35a'); for (let i = 0; i < 3; i++) { const x = -80 + ((lt * 120 + i * 60) % 180); path([[x, -16], [x + 18, 0], [x, 16]]); g.lineWidth = 7; g.strokeStyle = '#36b35a'; g.stroke(); } g.restore();
      txt('Ровная скорость', 80, -42, 56, { w: 600, f: 'Inter', sp: 0 }); txt('НЕ ЧУВСТВУЕМ', 80, 34, 66, { fill: '#36b35a' });
      g.save(); g.translate(380, 0); circle(0, 0, 50, '#fff', 6); face([0, 0], 1.3, 'closed', 0, INK, 0); txt('z', 52, -58, 40, {}); g.restore();
    });
    line([110, 640], [970, 640], 5, '#d5d8de');
    pop(seg(lt, t2, t2 + .45), W / 2, 780, () => {
      g.save(); g.translate(-330, 0); path([[-90, 30], [-50, 30], [-30, -40], [0, 40], [25, -30], [50, 30], [90, 30]]); g.lineWidth = 12; g.strokeStyle = '#ff3d3d'; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); g.restore();
      txt('Изменение', 80, -42, 56, { w: 600, f: 'Inter', sp: 0 }); txt('ЧУВСТВУЕМ!', 80, 34, 66, { fill: '#ff3d3d' });
      g.save(); g.translate(380, 0); g.translate(Math.sin(lt * 40) * 4, 0); circle(0, 0, 50, '#fff', 6); face([0, 0], 1.3, 'shock', 0, INK, 0); g.restore();
    });
    const pointRow = lt < t2 ? 500 : 780;
    const P = stick(250, GROUND - 118 * 1.5, 1.5, { face: lt > t2 ? 'wow' : 'calm', look: 1, armR: { to: [380, 1080 - (pointRow - 500) * .15], bend: -1 }, armL: [-.4, .3] }, { floor: GROUND });
    line(P.handR, [P.handR[0] + (200 - P.handR[0]) * .55, P.handR[1] + (pointRow + 40 - P.handR[1]) * .55], 8, '#9a6440');
    floorLine();
    const gp = seg(lt, t3, t3 + .5); if (gp > 0) pop(gp, 790, 1200, () => { globe(0, 0, 130, lt * .5, { tilt: .3 }); arrowArc(0, 0, 175, Math.PI * 1.1, Math.PI * 1.9, 8, '#36b35a'); txt('ПЛАВНО И РОВНО', 0, -205, 52, { fill: '#36b35a', stroke: 9 }); });
  },
  together(lt, D, t) {
    const ta = word('together', 'Всё'), R = 1300, cx = 540, cy = 1080 + R, rot = lerp(.24, -.24, eio(lt / D));
    g.fillStyle = '#eef8ff'; g.fillRect(0, 0, W, H);
    circle(cx, cy, R, '#6fcf4f', 9); g.save(); g.beginPath(); g.arc(cx, cy, R - 120, 0, TAU); g.fillStyle = '#4fb0f0'; g.globalAlpha = .0; g.fill(); g.restore();
    const on = (a, h, f) => { g.save(); g.translate(cx, cy); g.rotate(a + rot); g.translate(0, -R - h); f(); g.restore(); };
    // air wisps
    for (let i = 0; i < 6; i++) on(-.5 + i * .2, 520 + hash(i) * 200, () => { g.save(); g.globalAlpha = .7; g.beginPath(); g.moveTo(-90, 0); g.bezierCurveTo(-40, -30, 10, 30, 70, 0); g.arc(70, -22, 22, Math.PI / 2, -Math.PI * .6, true); g.lineWidth = 7; g.strokeStyle = '#9fd2f2'; g.lineCap = 'round'; g.stroke(); g.restore(); });
    for (let i = 0; i < 4; i++) on(-.42 + i * .28, 640 + hash(i + 2) * 90, () => cloud(0, 0, 1.25));
    on(-.33, 0, () => house(0, 0, 1.05)); on(-.18, 0, () => tree(0, 0, 1)); on(.15, 0, () => tree(0, 0, .85)); on(.3, 0, () => house(0, 0, .9, '#9fd8ff', '#3d6fd6'));
    for (let i = 0; i < 3; i++) on(.08 + i * .07, 480 + i * 50, () => bird(0, 0, 1.1, lt, i));
    on(0, 0, () => stick(0, -118 * 1.6, 1.6, { face: 'happy', armR: [2.7 + Math.sin(lt * 8) * .3, .3], armL: [-.6, .2] }, { floor: 0 }));
    pop(seg(lt, ta, ta + .4), W / 2, 230, () => { txt('ВСЁ ВМЕСТЕ', 0, 0, 120, { fill: '#2b6cff', stroke: 18 }); });
    if (lt > ta) { g.save(); g.globalAlpha = seg(lt, ta, ta + .4); arrowArc(cx, cy, R + 960, -Math.PI / 2 + .25, -Math.PI / 2 - .25 * seg(lt, ta, ta + 1.2) - .01, 12, '#2b6cff'); g.restore(); }
    title('ВОЗДУХ · ДОМА · ДЕРЕВЬЯ', 470, seg(lt, .3, .8) * (1 - seg(lt, ta - .3, ta)), 60, {});
  },
  stars(lt, D, t) {
    const tz = word('stars', 'ночью'), tm = word('stars', 'это мы');
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b1533'); sky.addColorStop(1, '#24407a'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const px = 700, py = 470, span = clamp(lt - tz + .6, 0, 99) * .28;
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 150; i++) { const r = 40 + Math.pow(hash(i), .8) * 1300, a0 = hash(i + 50) * TAU, a1 = a0 + span, b = .4 + .6 * hash(i + 90);
      g.globalAlpha = .5 * b; g.lineWidth = 2 + 3 * b; g.strokeStyle = i % 9 ? '#cfe0ff' : '#ffd98a'; g.beginPath(); g.arc(px, py, r, a0, a1); g.stroke();
      g.globalAlpha = b; const sx = px + Math.cos(a1) * r, sy = py + Math.sin(a1) * r; g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 2.5 + 3 * b, 0, TAU); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(px, py, 10, 0, TAU); g.fill(); g.restore();
    // hill
    g.beginPath(); g.ellipse(540, 1700, 900, 420, 0, 0, TAU); fillStroke('#1f5a3a', 8, '#0a0f1e');
    for (let i = 0; i < 26; i++) { const x = 120 + i * 33, y = 1290 + Math.pow((x - 540) / 900, 2) * 420 * 1.0; line([x, y], [x + 8, y - 22], 4, '#3f8a5c'); }
    // lying stick (white on night)
    g.save(); g.translate(560, 1268); g.rotate(-Math.PI / 2);
    stick(0, 0, 1.6, { face: lt > tm ? 'wow' : 'calm', look: 0, legL: [-.05, 0], legR: [.55, -1.2], armL: [Math.PI - .5, -2.4], armR: [-Math.PI + .9, 2.2] }, { col: '#f4f6ff', headFill: '#24407a', noShadow: true });
    g.restore();
    title('ЗВЁЗДЫ ПЛЫВУТ', 1000, seg(lt, tz + .3, tz + .7) * (1 - seg(lt, tm - .2, tm)), 100, { fill: '#ffd98a', sc: '#0b1533' });
    if (lt > tm) pop(seg(lt, tm, tm + .4), W / 2, 1000, () => { txt('ЭТО МЫ ПОВОРАЧИВАЕМСЯ', 0, 0, 74, { fill: '#fff', stroke: 14, sc: '#0b1533' }); });
  },
  sub(lt, D, t) {
    const tq = word('sub', 'вопросы'), ts = word('sub', 'подписывайтесь'), tc = ts + 1.1;
    floorLine();
    const wave = Math.sin(lt * 9) * .35;
    const P = stick(300, GROUND - 118 * 2.2, 2.2, { face: 'happy', look: .5, armL: [-2.5 + wave, -.4], armR: lt > tc - .6 ? { to: [600, 1080], bend: -1 } : [.5, -.2] }, { floor: GROUND });
    pop(seg(lt, tq - .2, tq + .3), 720, 560, () => { rrect(-230, -110, 460, 200, 50); fillStroke('#fff', 8); path([[-120, 88], [-170, 160], [-60, 88]]); fillStroke('#fff', 8); g.fillStyle = '#fff'; g.fillRect(-118, 80, 56, 14); txt('?', -80, -5, 130, { fill: '#2b6cff' }); txt('?', 70, 0, 100, { fill: '#ff8a3d' }); });
    const bp = seg(lt, ts - .2, ts + .3), done = lt > tc;
    pop(bp, 720, 1080, () => { const pr = 1 - .06 * Math.exp(-Math.max(0, lt - tc) * 10) * (lt > tc ? 1 : 0); g.scale(pr, pr); rrect(-280, -80, 560, 160, 80); fillStroke(done ? '#9aa0aa' : '#ff2d2d', 8); txt(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4, done ? 62 : 68, { fill: '#fff' }); });
    if (bp > .5) { const u = eio(seg(lt, ts + .3, tc)), mx = lerp(1000, 760, u), my = lerp(1400, 1110, u); g.save(); g.translate(mx, my); path([[0, 0], [0, 64], [16, 50], [28, 76], [40, 70], [28, 46], [48, 44]], true); fillStroke('#fff', 6); g.restore(); }
    if (done) { const k = seg(lt, tc, tc + .5); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = 300 + 120 * eo(k); g.save(); g.globalAlpha = 1 - k; line([720 + Math.cos(a) * r * .9, 1080 + Math.sin(a) * r * .6], [720 + Math.cos(a) * r, 1080 + Math.sin(a) * r * .7], 8, '#ffb000'); g.restore(); } }
    title('ФАКТЫ', 220, seg(lt, .1, .5), 140, { fill: '#ff3d3d' }); title('ЗА МИНУТУ', 350, seg(lt, .3, .7), 90, {});
  },
};
function glass(x, y, fill, a, t) {
  g.save(); g.translate(x, y); g.rotate(a);
  const top = -130, wTop = 46, wBot = 36;
  if (fill > 0) { const ly = lerp(-6, top + 8, fill), wl = lerp(wBot, wTop, (ly - 0) / top); g.save(); path([[-wBot + 4, -4], [wBot - 4, -4], [wl - 4, ly], [-wl + 4, ly]], true); g.fillStyle = '#7fd0ff'; g.fill(); line([-wl + 4, ly], [wl - 4, ly], 5, '#2b8fd6'); g.restore(); }
  path([[-wTop, top], [-wBot, 0], [wBot, 0], [wTop, top]]); g.lineWidth = 7; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  g.globalAlpha = .5; line([-wTop + 18, top + 20], [-wBot + 14, -20], 5, '#fff'); g.restore();
}

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('тысяча шестьсот семьдесят километров в час', '1 670 км/ч').replace('девятьсот километров в час', '900 км/ч');
const SUBS = (() => { const out = VOICE ? PH.map(([a, b, x]) => ({ text: x, a: a + VOICE_OFFSET - .05, b: b + VOICE_OFFSET })) : VO.map(v => ({ text: SHOW(v.text), a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .5, p.a + 1.6); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t, dark) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .2) * (1 - seg(t, v.b - .15, v.b));
  g.save(); g.globalAlpha = f; g.font = '600 50px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = wrap(v.text, 900), y0 = H - 250 - (L.length - 1) * 66;
  L.forEach((s, i) => { g.lineWidth = 13; g.lineJoin = 'round'; g.strokeStyle = dark ? '#0b1533' : '#ffffff'; g.strokeText(s, W / 2, y0 + i * 66); g.fillStyle = dark ? '#ffffff' : INK; g.fillText(s, W / 2, y0 + i * 66); });
  g.restore();
}

// ———————————————————————————— frame
function render(t) {
  const k = sceneIdx(t), s = SC[k], lt = t - s.t0, D = s.t1 - s.t0;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  SH[s.name](lt, D, t);
  subs(t, s.name === 'stars');
  const fin = k ? 1 - seg(lt, 0, .22) : 1 - seg(lt, 0, .4); if (fin > 0) { g.fillStyle = `rgba(255,255,255,${fin})`; g.fillRect(0, 0, W, H); }
  if (t > TL.DUR - .8) { g.fillStyle = `rgba(255,255,255,${seg(t, TL.DUR - .8, TL.DUR)})`; g.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const X = SCN, at = (n, dt) => X[n].t0 + dt, dur = n => X[n].t1 - X[n].t0, w = (n, s) => at(n, word(n, s));
  add('sip', at('tea', 1.0)); add('whoosh', w('tea', 'Но он'), { d: dur('tea') - word('tea', 'Но он') }); add('pop', w('tea', 'быстрее'));
  add('pop', at('vera', .2)); add('swish', at('vera', .8), { d: 1.0 }); add('ding', w('vera', 'тысяча') - .1);
  add('hum', at('plane', 0), { d: dur('plane') + dur('brake') * .4 }); add('pour', at('plane', 1.0), { d: Math.max(.5, dur('plane') - 2.6) }); add('pop', w('plane', 'девятьсот') - .2); add('ding', w('plane', 'не проливается'));
  const tb = w('brake', 'резко') - .1; add('screech', tb, { d: 1.2 }); add('boing', tb + .05); add('crash', tb + .35 + .55);
  add('pop', w('feel', 'Тело') + .3); add('pop', w('feel', 'изменение')); add('boing', w('feel', 'изменение') + .1, { v: .5 }); add('swish', w('feel', 'А Земля'), { d: 1.0 });
  add('birds', at('together', 0), { d: dur('together') }); add('wind', at('together', 0), { d: dur('together') }); add('ding', w('together', 'Всё'));
  add('night', at('stars', 0), { d: dur('stars') }); add('twinkle', w('stars', 'ночью'), { d: dur('stars') - word('stars', 'ночью') }); add('pop', w('stars', 'это мы'), { v: .6 });
  add('pop', w('sub', 'вопросы') - .2); add('pop', w('sub', 'подписывайтесь') - .2); add('click', w('sub', 'подписывайтесь') + 1.1); add('chime', w('sub', 'подписывайтесь') + 1.15);
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'СТИК'); await document.fonts.load('600 50px Inter', 'Вы'); await document.fonts.load('500 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
