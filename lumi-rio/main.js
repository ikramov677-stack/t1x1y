// «Город огня и город дождя» — cinematic 3D love story (vertical 1080×1920): Lumi (ember girl) and Rio (raindrop boy)
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';

const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ———————————————————————————— timeline
const LINES = [
  ['fire', 'Она жила в городе, где никогда не гаснет огонь.'], ['rain', 'Он — в городе, где всегда идёт дождь.'],
  ['map', 'Между ними — тысячи километров.'], ['phones', 'Каждый вечер они писали друг другу одно слово: «Скучаю».'],
  ['window', 'Она не могла приехать к нему: дождь бы её погасил.'], ['desert', 'Он не мог приехать к ней: жара бы его испарила.'],
  ['mid', 'Но однажды они решили встретиться посередине.'], ['bridge', 'В городе, где ни жарко, ни холодно.'],
  ['hands', 'Она протянула руку. Он не испугался.'], ['together', 'Ведь любовь — это когда вы разные, но всё равно выбираете друг друга.'],
].map(([id, text]) => ({ id, text }));
const VOICE = null;
const VOICE_OFFSET = 0.5, BPM = 72, BEAT = 60 / BPM, TAIL = 4.6;
const snapB = t => Math.round(t / (BEAT / 2)) * BEAT / 2;
const TL = (() => {
  const spans = VOICE || (() => { let t = .3; return LINES.map(l => { const d = l.text.length / 13; const s = [t, t + d]; t += d + 1.0; return s; }); })();
  const on = spans.map(s => s[0] + VOICE_OFFSET), starts = on.map((x, i) => i ? snapB(x - .4) : 0);
  const end = snapB(spans[spans.length - 1][1] + VOICE_OFFSET + TAIL);
  return { SC: LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end })), VO: LINES.map((l, i) => ({ ...l, t: on[i], d: spans[i][1] - spans[i][0] })), DUR: end };
})();
const { SC, VO } = TL;
const sceneIdx = t => { let k = 0; SC.forEach((s, i) => { if (t >= s.t0) k = i; }); return k; };

// ———————————————————————————— renderer, post
const gl = document.getElementById('gl'), ov = document.getElementById('ov'), c2 = ov.getContext('2d');
const R = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true });
R.setSize(W, H, false); R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
const S = new THREE.Scene(); S.background = new THREE.Color('#020308');
const cam = new THREE.PerspectiveCamera(35, W / H, .05, 500);
const P = makePost(R, S, cam, W, H, { ssaa: 1 });
const amb = new THREE.AmbientLight('#203050', .25); S.add(amb);
const key = new THREE.DirectionalLight('#ffffff', 0); S.add(key); S.add(key.target);
const rim = new THREE.DirectionalLight('#9ab8ff', 0); S.add(rim); S.add(rim.target);

// ———————————————————————————— helpers: textures, materials
const std = (c, r = .6, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
function cnv(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const softTex = cnv(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const emberTex = cnv(512, 512, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.lineCap = 'round';
  for (let k = 0; k < 90; k++) { let x = hash(k) * w, y = hash(k + 1) * h; g.strokeStyle = `rgba(255,${110 + hash(k + 2) * 90 | 0},30,${.5 + hash(k + 3) * .5})`; g.lineWidth = 1.5 + hash(k + 4) * 4; g.shadowColor = '#ff6a10'; g.shadowBlur = 10; g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 6; j++) { x += (hash(k * 9 + j) - .5) * 90; y += (hash(k * 7 + j + 50) - .5) * 90; g.lineTo(x, y); } g.stroke(); }
  for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(255,${150 + hash(k + 70) * 90 | 0},60,.8)`; g.beginPath(); g.arc(hash(k + 80) * w, hash(k + 81) * h, 1 + hash(k + 82) * 3, 0, 7); g.fill(); } });
const knitTex = cnv(128, 128, (g, w, h) => { g.fillStyle = '#2f8a3c'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16 + y / 16) % 2 ? '#3aa04a' : '#267a32'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 14); g.lineTo(x + 16, y); g.lineTo(x + 8, y + 6); g.fill(); } });
knitTex.repeat.set(6, 1);
function winTex(warm, dens, seed) { return cnv(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { if (hash(seed + x * 13 + y * 7) > dens) continue; const v = .4 + .6 * hash(seed + x + y * 31); g.fillStyle = warm ? `rgba(255,${150 + v * 70 | 0},${60 + v * 40 | 0},${v})` : `rgba(${120 + v * 60 | 0},${180 + v * 50 | 0},255,${v})`; g.fillRect(x * 42 + 8, y * 32 + 6, 24, 18); } }); }
const flameMat = (r, g, b, o = .9) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); m.color.setRGB(r, g, b); return m; };
function auraMat(col, k = 1, pw = 2.6) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { col: { value: new THREE.Color(col) }, k: { value: k }, pw: { value: pw } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 col; uniform float k, pw; varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - abs(dot(n, v)), pw); gl_FragColor = vec4(col * f * k, 1.); }' });
}
function lumpy(seed, amt = .07, det = 3) { const geo = new THREE.IcosahedronGeometry(1, det), p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 5 + seed) * Math.sin(v.y * 6 + seed * 2) * Math.sin(v.z * 4 + seed * 3) + .5 * Math.sin(v.x * 11 + v.z * 7 + seed); v.multiplyScalar(1 + amt * n); p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; }
// teardrop profile: round bottom, pointed top (s 0..1)
const dropR = (s, pw = 1.2) => { const th = Math.acos(clamp(2 * s - 1, -1, 1)); return Math.sin(th) * Math.pow(Math.sin(th / 2), pw) / .75; };
function dropGeo(h, rmax, s0 = 0, s1 = 1, seg = 40, phiStart = 0, phiLen = Math.PI * 2, pw = 1.2) { const pts = []; for (let i = 0; i <= seg; i++) { const s = s0 + (s1 - s0) * i / seg; pts.push(new THREE.Vector2(Math.max(dropR(s, pw) * rmax, .004), s * h)); } return new THREE.LatheGeometry(pts, 40, phiStart, phiLen); }
function sky(set, top, mid, bot, r = 220) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(mid) }, c: { value: new THREE.Color(bot) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 a, b, c; varying vec3 p; void main(){ float h = p.y; vec3 col = h > 0. ? mix(b, a, pow(clamp(h * 2.2, 0., 1.), .6)) : mix(b, c, clamp(-h * 5., 0., 1.)); gl_FragColor = vec4(col, 1.); }' }));
  m.renderOrder = -1; set.add(m); return m;
}
function sprite(col, s, o = 1) { const m = new THREE.SpriteMaterial({ map: softTex, color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); const sp = new THREE.Sprite(m); sp.scale.set(s, s, 1); return sp; }
function particles(n, col, size, seed, o = .9, tex = softTex) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.PointsMaterial({ color: col, size, map: tex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData = { n, seed }; return p; }
// rising motes (embers / steam): box centred on object position
function rise(pts, t, box, speed, sway = .3) { const a = pts.geometry.attributes.position, { n, seed } = pts.userData; for (let i = 0; i < n; i++) { const h = box[1], y = ((hash(i + seed) * h + t * speed * (.6 + .8 * hash(i + seed + 3))) % h); a.setXYZ(i, (hash(i + seed + 1) - .5) * box[0] + Math.sin(t * 1.3 + i) * sway * y / h, y, (hash(i + seed + 2) - .5) * box[2]); } a.needsUpdate = true; }
function rainLines(n, col, o = .45) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }); const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.userData = { n }; return l; }
function rainAt(l, t, bx, by, bz, len = .35, sp = 9) { const a = l.geometry.attributes.position; for (let i = 0; i < l.userData.n; i++) { const x = (hash(i) - .5) * bx, z = (hash(i + .5) - .5) * bz, y = by - ((hash(i + .25) * by + t * sp * (.85 + .3 * hash(i + .7))) % by); a.setXYZ(i * 2, x, y, z); a.setXYZ(i * 2 + 1, x + .03, y + len, z); } a.needsUpdate = true; }

// ———————————————————————————— characters
function eyes(parent, x, y, z, s, pupilCol = '#140806', white = '#fff6ea', scaleY = 1.25) {
  const out = []; for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * x, y, z); const w = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), new THREE.MeshBasicMaterial({ color: white })); w.scale.set(1, scaleY, .45); e.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(s * .62, 18, 12), new THREE.MeshBasicMaterial({ color: pupilCol })); p.scale.set(1, scaleY, .4); p.position.set(0, -s * .1, s * .25); e.add(p);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(s * .2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(s * .22, s * .3, s * .48); e.add(hl); parent.add(e); out.push(e); }
  return out;
}
function mouth(parent, y, z, r, col) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, r * .22, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: col })); m.position.set(0, y, z); m.rotation.z = Math.PI; parent.add(m); return m; }
function arm(parent, x, y, len, r, mat, handMat) { const a = new THREE.Group(); a.position.set(x, y, 0); const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat); c.position.y = -len / 2 - r * .3; a.add(c); const h = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 16, 12), handMat); h.position.y = -len - r * 1.2; a.add(h); a.userData.hand = h; a.userData.side = Math.sign(x); parent.add(a); return a; }
function flame(h = .3, r = .085) { const g = new THREE.Group(); const o = new THREE.Mesh(dropGeo(h, r, 0, 1, 24, 0, Math.PI * 2, 3), flameMat(1.5, .55, .1, .8)); g.add(o); const i = new THREE.Mesh(dropGeo(h * .55, r * .5, 0, 1, 20, 0, Math.PI * 2, 3), flameMat(1.6, 1.3, .6, .9)); i.position.y = .01; g.add(i); const gl2 = sprite('#ff8a30', h * 2.2, .28); gl2.position.y = h * .4; g.add(gl2); g.userData = { o, i, gl: gl2 }; return g; }

function makeLumi() {
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; const body = new THREE.Group(); g.add(body);
  const coal = new THREE.MeshStandardMaterial({ color: '#1c1310', roughness: .85, emissive: '#ff7a2a', emissiveMap: emberTex, emissiveIntensity: .75, flatShading: true });
  const torso = new THREE.Mesh(lumpy(1.3), coal); torso.scale.set(.26, .29, .24); torso.position.y = .4; body.add(torso);
  const head = new THREE.Group(); head.position.y = .82; body.add(head);
  const skull = new THREE.Mesh(lumpy(4.1, .05), coal); skull.scale.set(.25, .235, .23); head.add(skull);
  const ey = eyes(head, .085, .01, .2, .052, '#140806', '#d8ccbc');
  const cheeks = []; for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(.03, 16), flameMat(1.2, .35, .15, .5)); c.position.set(sx * .15, -.06, .2); c.rotation.y = sx * .5; head.add(c); cheeks.push(c); }
  const mo = mouth(head, -.07, .225, .028, '#ffb070');
  const fl = flame(.3, .085); fl.position.y = .2; head.add(fl);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.17, .055, 12, 32), std('#2f8a3c', 1, { map: knitTex })); scarf.rotation.x = Math.PI / 2; scarf.position.y = .63; body.add(scarf);
  const tail = new THREE.Group(); tail.position.set(.1, .62, .15); const tm = new THREE.Mesh(new THREE.BoxGeometry(.09, .26, .03), std('#2f8a3c', 1, { map: knitTex })); tm.position.y = -.13; tail.add(tm); for (let k = 0; k < 4; k++) { const fr = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .05, 4), std('#3aa04a', 1)); fr.position.set(-.03 + k * .02, -.28, 0); tail.add(fr); } body.add(tail);
  const arms = [arm(body, -.25, .54, .18, .045, coal, coal), arm(body, .25, .54, .18, .045, coal, coal)];
  const legs = []; for (const sx of [-1, 1]) { const l = new THREE.Group(); l.position.set(sx * .1, .16, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .08, 6, 10), coal); m.position.y = -.07; l.add(m); body.add(l); legs.push(l); }
  const aura = new THREE.Group(), am = auraMat('#ff7a2a', .5, 2.8); for (const [m, s] of [[torso, 1.08], [skull, 1.08]]) { const a = new THREE.Mesh(m.geometry, am); a.position.copy(m.position); a.scale.copy(m.scale).multiplyScalar(s); (m === skull ? head : body).add(a); }
  const light = new THREE.PointLight('#ff8a3a', 1.6, 5, 1.8); light.position.set(0, 1.1, .3); g.add(light);
  const phone = makePhone('#ffb070'); phone.position.set(0, -.27, .03); phone.visible = false; arms[1].add(phone);
  g.userData = { body, head, arms, legs, eyes: ey, mouth: mo, flame: fl, light, coal, am, tail, phone, kind: 'lumi', h: 1.2 };
  return g;
}
function makeRio() {
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; const body = new THREE.Group(); g.add(body);
  const H0 = .18, HD = 1.62, RM = .5;
  const water = new THREE.MeshPhysicalMaterial({ color: '#3a9aff', roughness: .06, metalness: 0, transparent: true, opacity: .82, clearcoat: 1, clearcoatRoughness: .05, emissive: '#0c3a9a', emissiveIntensity: .35, side: THREE.DoubleSide, depthWrite: false });
  const drop = new THREE.Mesh(dropGeo(HD, RM, 0, 1, 48), water); drop.position.y = H0; drop.renderOrder = 2; body.add(drop);
  const core = new THREE.Mesh(dropGeo(HD * .9, RM * .82, 0, 1, 36), new THREE.MeshBasicMaterial({ color: '#0a2a6a', transparent: true, opacity: .35, depthWrite: false })); core.position.set(0, H0 + .05, -.02); core.renderOrder = 1; body.add(core);
  for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.015 + hash(k + 40) * .025, 10, 8), new THREE.MeshBasicMaterial({ color: '#7ab0e8', transparent: true, opacity: .22 })); const s = .1 + hash(k + 41) * .3; const r = dropR(s) * RM * .6; const a = hash(k + 42) * 6.28; b.position.set(Math.sin(a) * r, H0 + s * HD, Math.cos(a) * r * .5 - .05); body.add(b); }
  const yel = new THREE.MeshPhysicalMaterial({ color: '#ffc21a', roughness: .35, clearcoat: .8, clearcoatRoughness: .2, side: THREE.DoubleSide, emissive: '#8a5a00', emissiveIntensity: .45 });
  const coat = new THREE.Mesh(dropGeo(HD * 1.03, RM * 1.05, .0, .3, 30), yel); coat.position.y = H0 - .02; body.add(coat);
  const hood = new THREE.Mesh(dropGeo(HD * 1.02, RM * 1.04, .28, .64, 24, Math.PI * .68, Math.PI * .64), yel); hood.position.y = H0 - .04; body.add(hood);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(dropR(.3) * RM * 1.05, .035, 8, 40), yel); collar.rotation.set(Math.PI / 2, 0, 0); collar.position.y = H0 + .3 * HD * 1.03 - .02; body.add(collar);
  for (let k = 0; k < 3; k++) { const s = .06 + k * .08, r = dropR(s) * RM * 1.07; for (const sx of [-1, 1]) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .01, 12), std('#d89a10', .4)); bt.rotation.x = Math.PI / 2; const a = sx * .1; bt.position.set(Math.sin(a) * (r + .01), H0 + s * HD * 1.03, Math.cos(a) * (r + .01)); body.add(bt); } }
  const head = new THREE.Group(); body.add(head);
  const fs = .47, fr = dropR(fs) * RM; const ey = eyes(head, .1, H0 + fs * HD, fr - .015, .055, '#06142e');
  const mo = mouth(head, H0 + .4 * HD, dropR(.4) * RM - .005, .035, '#0a2a6a');
  const blush = []; for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(.03, 16), new THREE.MeshBasicMaterial({ color: '#7ac8ff', transparent: true, opacity: .5 })); c.position.set(sx * .2, H0 + .42 * HD, dropR(.42) * RM * .9); c.rotation.y = sx * .45; head.add(c); blush.push(c); }
  const sr = dropR(.27) * RM * 1.07; const arms = [arm(body, -sr + .02, H0 + .27 * HD, .3, .06, yel, water), arm(body, sr - .02, H0 + .27 * HD, .3, .06, yel, water)];
  arms.forEach(a => { a.userData.hand.renderOrder = 3; });
  const legs = []; for (const sx of [-1, 1]) { const l = new THREE.Group(); l.position.set(sx * .14, H0 + .06, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .08, 6, 10), water); m.position.y = -.06; l.add(m); const boot = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .1, 16), yel); boot.position.set(0, -.15, .02); l.add(boot); body.add(l); legs.push(l); }
  const am = auraMat('#5ab0ff', .45, 2.6); const aura = new THREE.Mesh(drop.geometry, am); aura.position.copy(drop.position); aura.scale.setScalar(1.02); body.add(aura);
  const light = new THREE.PointLight('#5aa8ff', 1, 4, 1.8); light.position.set(0, 1.4, .5); g.add(light);
  const phone = makePhone('#8ac8ff'); phone.position.set(0, -.44, .04); phone.visible = false; arms[1].add(phone);
  g.userData = { body, head, arms, legs, eyes: ey, mouth: mo, light, am, water, phone, kind: 'rio', h: 1.9 };
  return g;
}
function makePhone(col) { const p = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.075, .14, .012), std('#111', .3)); p.add(b); const sc = new THREE.Mesh(new THREE.PlaneGeometry(.065, .125), flameMat(1, 1, 1, 1)); sc.material.blending = THREE.NormalBlending; sc.material.color.set(col).multiplyScalar(1.8); sc.position.z = .007; p.add(sc); const gl2 = sprite(col, .28, .35); gl2.position.z = .05; p.add(gl2); const L = new THREE.PointLight(col, 1.2, 1.5, 2); L.position.z = .15; p.add(L); p.rotation.x = -.5; p.userData = { L }; return p; }
const lumi = makeLumi(), rio = makeRio(); S.add(lumi, rio);
function resetChar(c) {
  const u = c.userData; c.visible = false; c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0); u.body.rotation.set(0, 0, 0); u.head.rotation.set(0, 0, 0);
  u.arms.forEach(a => a.rotation.set(0, 0, a.userData.side * .22)); u.legs.forEach(l => l.rotation.set(0, 0, 0)); u.mouth.rotation.z = Math.PI; u.mouth.position.y = u.mouth.userData.y0 ?? (u.mouth.userData.y0 = u.mouth.position.y);
  u.eyes.forEach(e => e.scale.set(1, 1, 1)); u.phone.visible = false; u.light.intensity = c === lumi ? 1.6 : 1; u.am.uniforms.k.value = c === lumi ? .5 : .45;
  if (c === lumi) { u.coal.emissiveIntensity = .75; u.flame.scale.setScalar(1); } else { u.water.color.set('#3a9aff'); u.water.emissive.set('#0c3a9a'); }
}
function place(c, x, y, z, ry = 0) { c.visible = true; c.position.set(x, y, z); c.rotation.y = ry; }
function alive(c, t, ph = 0) { // breathing, blinking, flame flicker
  const u = c.userData; u.body.position.y += Math.sin(t * 2.2 + ph) * .006; const bl = (t + ph * 3) % 3.7; const s = bl < .12 ? Math.max(.1, Math.abs(bl - .06) / .06) : 1; u.eyes.forEach(e => e.scale.y = s);
  if (c === lumi) { const f = u.flame, n = Math.sin(t * 11) * .5 + Math.sin(t * 17.3 + 1) * .3 + Math.sin(t * 29.1) * .2; f.scale.set(1 - n * .06, 1 + n * .14, 1 - n * .06); f.rotation.z = Math.sin(t * 3.1) * .08 + Math.sin(t * 7.7) * .04; u.light.intensity *= 1 + n * .12; u.coal.emissiveIntensity *= 1 + .12 * Math.sin(t * 2.6); u.tail.rotation.z = Math.sin(t * 1.8) * .08; }
}
function walk(c, ph, amp = 1) { const u = c.userData, s = Math.sin(ph); u.legs[0].rotation.x = s * .5 * amp; u.legs[1].rotation.x = -s * .5 * amp; u.arms[0].rotation.x = -s * .35 * amp; u.arms[1].rotation.x = s * .35 * amp; u.body.position.y += Math.abs(Math.cos(ph)) * .035 * amp; u.body.rotation.z = Math.sin(ph) * .03 * amp; }
function sad(c, k) { const u = c.userData; u.mouth.rotation.z = lerp(Math.PI, 0, k > .5 ? 1 : 0); if (k > .5) u.mouth.position.y = u.mouth.userData.y0 - .02; u.head.rotation.x = .25 * k; }

// ———————————————————————————— sets
const SETS = {}; function set(n, x = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, 0, z); S.add(g); SETS[n] = g; return g; }
// 1 fire city (x 0): balcony high above a city of lanterns
const fire = set('fire', 0);
sky(fire, '#12040a', '#5a1a10', '#2a0a06');
{ const wm = [0, 1, 2].map(i => winTex(true, .6, i * 17));
  for (let k = 0; k < 46; k++) { const w = 2 + hash(k) * 3, h = 6 + hash(k + 1) * 16, d = 2 + hash(k + 2) * 2, x = (hash(k + 3) - .5) * 44, z = -7 - hash(k + 4) * 36; const t = wm[k % 3].clone(); t.needsUpdate = true; t.repeat.set(w / 2.2, h / 2.6);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std('#1a0c08', .9, { emissive: '#ffb060', emissiveMap: t, emissiveIntensity: 1.0 })); b.position.set(x, -14 + h / 2, z); fire.add(b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * .8, 1.6, 4), std('#200c06', .9)); roof.rotation.y = Math.PI / 4; roof.position.set(x, -14 + h + .8, z); fire.add(roof); }
  // lantern strings
  for (let s = 0; s < 7; s++) { const z = -2.5 - s * 3.2, y0 = .8 + hash(s + 9) * 2.5, x0 = -6 - hash(s) * 3, x1 = 6 + hash(s + 1) * 3; for (let k = 0; k <= 12; k++) { const u = k / 12, x = lerp(x0, x1, u), y = y0 - Math.sin(u * Math.PI) * 1.2; const ln = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), flameMat(1.5, k % 3 ? .55 : .22, .08, 1)); ln.material.blending = THREE.NormalBlending; ln.scale.y = 1.3; ln.position.set(x, y, z); fire.add(ln); const sp = sprite(k % 3 ? '#ff9a30' : '#ff4a20', .7, .25); sp.position.copy(ln.position); fire.add(sp); } }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.2, .16, 1.8), std('#2a1a12', .85)); slab.position.set(0, -.08, .1); fire.add(slab);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, .05, .06), std('#3a2014', .5)); rail.position.set(0, .62, -.72); fire.add(rail);
  for (let k = 0; k < 13; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .6, 8), std('#3a2014', .5)); p.position.set(-1.5 + k * .25, .3, -.72); fire.add(p); }
  const lan = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), flameMat(1.6, .4, .12, 1)); lan.material.blending = THREE.NormalBlending; lan.scale.y = 1.3; lan.position.set(-.9, 1.55, -.55); fire.add(lan); const lsp = sprite('#ff7030', 1.0, .3); lsp.position.copy(lan.position); fire.add(lsp);
  const lL = new THREE.PointLight('#ff7a30', 4, 6, 1.6); lL.position.copy(lan.position); fire.add(lL);
  const cityL = new THREE.PointLight('#ff7a30', 30, 40, 1.2); cityL.position.set(0, -4, -10); fire.add(cityL); }
const embers = particles(160, '#ff8a30', .05, 11); fire.add(embers);
// 2 rain city (x 60): blue street
const rain = set('rain', 60);
sky(rain, '#02060e', '#0a1a30', '#02040a');
{ const wm = [0, 1].map(i => winTex(false, .3, i * 23 + 5));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 80), std('#0a1220', .12, { metalness: .5 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -30; rain.add(floor);
  const walk2 = new THREE.Mesh(new THREE.PlaneGeometry(14, 80), std('#0c1424', .2, { metalness: .4 })); walk2.rotation.x = -Math.PI / 2; walk2.position.set(0, .002, -30); walk2.scale.x = .4; rain.add(walk2);
  for (let k = 0; k < 28; k++) { const sx = k % 2 ? 1 : -1, w = 3 + hash(k) * 2, h = 6 + hash(k + 1) * 14, x = sx * (4.2 + w / 2), z = 6 - (k >> 1) * 5.5; const t = wm[k % 2].clone(); t.needsUpdate = true; t.repeat.set(w / 2.4, h / 2.6);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), std('#0a1018', .8, { emissive: '#8ac0ff', emissiveMap: t, emissiveIntensity: 1.1 })); b.position.set(x, h / 2, z); rain.add(b); }
  for (let k = 0; k < 7; k++) { const z = 2 - k * 7, sx = k % 2 ? 1 : -1; const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3.4, 8), std('#1a2230', .4, { metalness: .6 })); pole.position.set(sx * 2.4, 1.7, z); rain.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), flameMat(.8, 1.2, 1.8, 1)); bulb.material.blending = THREE.NormalBlending; bulb.position.set(sx * 2.1, 3.35, z); rain.add(bulb); const sp = sprite('#8ac8ff', 1.0, .3); sp.position.copy(bulb.position); rain.add(sp);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.3, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#4a7ac0', transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(sx * 2.1, 1.7, z); rain.add(cone);
    if (k < 4) { const L = new THREE.PointLight('#8ab8ff', 6, 9, 1.5); L.position.set(sx * 2.1, 3.2, z); rain.add(L); } } }
const rainA = rainLines(1400, '#a8d0ff', .5); rain.add(rainA);
// 3 map (x 120)
const mapS = set('map', 120);
const MAPW = 6, MAPH = 10.6;
const mapTex = cnv(1024, 1820, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0a0f1e'); bg.addColorStop(1, '#060a16'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(80,120,190,.12)'; g.lineWidth = 2; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let c = 0; c < 6; c++) { const cx = hash(c + 5) * w, cy = hash(c + 6) * h; g.fillStyle = '#1c2a4c'; for (let k = 0; k < 26; k++) { g.beginPath(); g.arc(cx + (hash(c * 40 + k) - .5) * 420, cy + (hash(c * 40 + k + 1) - .5) * 420, 50 + hash(c * 40 + k + 2) * 110, 0, 7); g.fill(); } }
  for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(200,210,255,${.1 + hash(k + 300) * .3})`; g.fillRect(hash(k + 301) * w, hash(k + 302) * h, 2, 2); }
});
const mapP = new THREE.Mesh(new THREE.PlaneGeometry(MAPW, MAPH), new THREE.MeshStandardMaterial({ map: mapTex, roughness: .9, emissive: '#ffffff', emissiveMap: mapTex, emissiveIntensity: .9 })); mapP.rotation.x = -Math.PI / 2; mapS.add(mapP);
const MAP_A = new THREE.Vector3(-1.2, 0, -2.97), MAP_B = new THREE.Vector3(1.32, 0, 3.18);
const mFl = flame(.4, .12); mFl.position.copy(MAP_A); mapS.add(mFl); const mFs = sprite('#ff7a20', 1.8, .75); mFs.position.copy(MAP_A).setY(.15); mapS.add(mFs);
const mDr = new THREE.Mesh(dropGeo(.42, .13), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 1.4, 3), toneMapped: false })); mDr.position.copy(MAP_B); mapS.add(mDr); const mDs = sprite('#4aa0ff', 1.8, .75); mDs.position.copy(MAP_B).setY(.15); mapS.add(mDs);
{ const a = new THREE.PointLight('#ff7a30', 6, 5, 1.6); a.position.copy(MAP_A).setY(.6); mapS.add(a); const b = new THREE.PointLight('#4a9aff', 6, 5, 1.6); b.position.copy(MAP_B).setY(.6); mapS.add(b); }
// 4 split night (x 180): two halves of one dark world
const split = set('split', 180);
{ const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), std('#0c0a0c', .5, { metalness: .3 })); fl.rotation.x = -Math.PI / 2; split.add(fl);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(.02, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(.7, .6, .8), toneMapped: false })); line.position.set(0, 2.2, -1.2); split.add(line);
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), new THREE.MeshBasicMaterial({ color: '#3a1206' })); lw.position.set(-2.5, 2.2, -1.3); split.add(lw);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), new THREE.MeshBasicMaterial({ color: '#061230' })); rw.position.set(2.5, 2.2, -1.3); split.add(rw);
  for (let k = 0; k < 30; k++) { const sx = k % 2 ? 1 : -1; const s = sprite(sx < 0 ? '#ff8a30' : '#6ab0ff', .2 + hash(k) * .4, .2); s.position.set(sx * (.4 + hash(k + 1) * 2.4), .6 + hash(k + 2) * 3.4, -1.25); split.add(s); }
  const a = new THREE.PointLight('#ff7a30', 5, 6, 1.6); a.position.set(-1.6, 2, 1); split.add(a); const b = new THREE.PointLight('#4a8aff', 5, 6, 1.6); b.position.set(1.6, 2, 1); split.add(b); }
const splitRain = rainLines(500, '#a8d0ff', .45); splitRain.position.set(1.4, 0, .2); split.add(splitRain);
const splitEmb = particles(70, '#ff8a30', .04, 31); splitEmb.position.set(-1.4, 0, .2); split.add(splitEmb);
// 5 window (x 240): Lumi indoors, rain on the glass
const winS = set('window', 240);
const dropsTex = cnv(512, 512, (g, w, h) => { g.clearRect(0, 0, w, h); for (let k = 0; k < 260; k++) { const x = hash(k + 500) * w, y = hash(k + 501) * h, r = 1.5 + hash(k + 502) * 4; const gr = g.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(.5, 'rgba(160,200,255,.35)'); gr.addColorStop(1, 'rgba(120,170,255,.05)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 1.15, 0, 0, 7); g.fill(); } });
const streakTex = cnv(256, 1024, (g, w, h) => { g.clearRect(0, 0, w, h); for (let k = 0; k < 22; k++) { const x = hash(k + 600) * w, y = hash(k + 601) * h, l = 120 + hash(k + 602) * 300; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(180,215,255,0)'); gr.addColorStop(.85, 'rgba(180,215,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,.9)'); g.strokeStyle = gr; g.lineWidth = 3 + hash(k + 603) * 3; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 6, y + l * .3, x - 6, y + l * .6, x + 2, y + l); g.stroke(); } });
{ const room = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4), std('#24140e', .9, { side: THREE.BackSide })); room.position.set(0, 1.8, -2.2); winS.add(room);
  const frameM = std('#1a1410', .6); for (const [x, y, w, h] of [[0, 2.3, 2.2, .1], [0, -.05, 2.2, .1], [-1.05, 1.12, .1, 2.4], [1.05, 1.12, .1, 2.4], [0, 1.12, .05, 2.4], [0, 1.12, 2.2, .05]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .08), frameM); b.position.set(x, y, 0); winS.add(b); }
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), std('#0a1020', .9)); wall.position.set(0, 1, .05); winS.add(wall); wall.geometry = (() => { const sh = new THREE.Shape(); sh.moveTo(-6, -3); sh.lineTo(6, -3); sh.lineTo(6, 5); sh.lineTo(-6, 5); const hole = new THREE.Path(); hole.moveTo(-1.05, -.05); hole.lineTo(1.05, -.05); hole.lineTo(1.05, 2.3); hole.lineTo(-1.05, 2.3); sh.holes.push(hole); return new THREE.ShapeGeometry(sh); })(); wall.position.set(0, 0, .05);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(2.4, .08, .5), frameM); sill.position.set(0, -.02, -.2); winS.add(sill);
  const L = new THREE.PointLight('#ff8a40', 2, 5, 1.6); L.position.set(-1.2, 1.6, -1.5); winS.add(L); }
const glassDrops = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.35), new THREE.MeshBasicMaterial({ map: dropsTex, transparent: true, opacity: .45, depthWrite: false })); glassDrops.position.set(0, 1.12, .02); winS.add(glassDrops);
const glassStreak = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.35), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: .5, depthWrite: false })); glassStreak.position.set(0, 1.12, .03); winS.add(glassStreak);
const glassTint = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.35), new THREE.MeshBasicMaterial({ color: '#2a4a7a', transparent: true, opacity: .16, depthWrite: false })); glassTint.position.set(0, 1.12, .01); winS.add(glassTint);
const winRain = rainLines(500, '#9ac4ff', .4); winRain.position.set(0, -1, 1.6); winS.add(winRain);
// 6 desert (x 300)
const desert = set('desert', 300);
sky(desert, '#2a0606', '#ff6a1a', '#ff8a30');
{ const dg = new THREE.PlaneGeometry(240, 240, 140, 140), p = dg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * .18 + y * .05) * 1.4 + Math.sin(x * .07 - y * .11) * 2.2 + Math.sin(x * .5 + y * .3) * .25); } dg.computeVertexNormals();
  const dunes = new THREE.Mesh(dg, std('#e8702a', .95, { emissive: '#ff3a08', emissiveIntensity: .35 })); dunes.rotation.x = -Math.PI / 2; dunes.position.set(0, -2.2, -120); desert.add(dunes);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(14, 48), flameMat(1.8, .9, .3, 1)); sun.material.blending = THREE.NormalBlending; sun.position.set(-18, 6, -200); desert.add(sun); const ss = sprite('#ff7a20', 90, .35); ss.position.set(-18, 6, -195); desert.add(ss);
  const rock = new THREE.Mesh(lumpy(8, .12, 3), std('#141c2c', .8, { flatShading: true })); rock.scale.set(3, .6, 2.4); rock.position.set(.2, -.55, .6); desert.add(rock);
  const hot = new THREE.PointLight('#ff7a30', 30, 30, 1.2); hot.position.set(-2, 2, -6); desert.add(hot); }
const steam = particles(90, '#dceeff', .35, 51, .35); desert.add(steam);
// 7–10 middle town between mountains at dusk (x 360) + bridge
const mid = set('mid', 360);
sky(mid, '#140c30', '#e88a7a', '#2a1a3a');
{ for (let k = 0; k < 12; k++) { const sx = k % 2 ? 1 : -1, h = 14 + hash(k + 20) * 18; const m = new THREE.Mesh(new THREE.ConeGeometry(10 + hash(k + 21) * 8, h, 6), std(k < 6 ? '#2a1a3e' : '#3a2448', 1, { flatShading: true })); m.position.set(sx * (12 + hash(k + 22) * 18), h / 2 - 3, -30 - hash(k + 23) * 40 - (k < 6 ? 0 : 30)); m.rotation.y = hash(k + 24) * 3; mid.add(m); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 12), std('#2a2a5a', .08, { metalness: .6, emissive: '#3a2a5a', emissiveIntensity: .4 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.4, 0); mid.add(water);
  for (const sz of [-1, 1]) { const bank = new THREE.Mesh(new THREE.BoxGeometry(200, 2, 60), std('#1e1830', .95)); bank.position.set(0, -2, sz * 36); mid.add(bank); }
  const wm = winTex(true, .25, 77);
  for (let k = 0; k < 26; k++) { const sz = k % 3 ? -1 : 1, w = 1.4 + hash(k + 30) * 1.4, h = 1.4 + hash(k + 31) * 2, x = (hash(k + 32) - .5) * 44, z = sz * (7.5 + hash(k + 33) * 14); const t = wm.clone(); t.needsUpdate = true; t.repeat.set(w / 2, h / 2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.6), std('#4a3a5a', .9, { emissive: '#ffb070', emissiveMap: t, emissiveIntensity: 1.4 })); b.position.set(x, -1 + h / 2, z); mid.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(w * .78, .9, 4), std('#5a3a4a', .9)); r.rotation.y = Math.PI / 4; r.position.set(x, -1 + h + .45, z); mid.add(r); }
  // bridge along x
  const deck = new THREE.Mesh(new THREE.BoxGeometry(20, .2, 1.8), std('#6a5a6a', .8)); deck.position.set(0, -.1, 0); mid.add(deck);
  for (const sz of [-.85]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(20, .05, .06), std('#4a3a4a', .5)); rail.position.set(0, .75, sz); mid.add(rail); for (let k = 0; k < 41; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.04, .75, .04), std('#4a3a4a', .5)); p.position.set(-10 + k * .5, .37, sz); mid.add(p); } }
  for (let k = 0; k < 3; k++) { const arch = new THREE.Mesh(new THREE.TorusGeometry(2.2, .2, 10, 32, Math.PI), std('#5a4a5a', .8)); arch.position.set(-6 + k * 6, -1.4, 0); arch.scale.y = .55; mid.add(arch); }
  for (let k = 0; k < 5; k++) { const x = -6 + k * 3, pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 2.2, 8), std('#2a2230', .4)); pole.position.set(x, 1.1, -.85); mid.add(pole); const lb = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), flameMat(1.4, 1.1, .95, 1)); lb.material.blending = THREE.NormalBlending; lb.position.set(x, 2.25, -.85); mid.add(lb); const sp = sprite('#ffd8c0', .8, .25); sp.position.copy(lb.position); mid.add(sp); }
  const L1 = new THREE.PointLight('#ffd0c0', 4, 8, 1.6); L1.position.set(0, 2.2, -.6); mid.add(L1); }
const midSteam = particles(120, '#f0e6ff', .28, 71, .4); mid.add(midSteam);
const heartGlow = sprite('#ff9ae0', 1.2, 0); mid.add(heartGlow);
const glowO = sprite('#ff8a30', .9, 0), glowB = sprite('#4aa8ff', .9, 0); mid.add(glowO, glowB);
const stars = new THREE.Points((() => { const g = new THREE.BufferGeometry(), n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = hash(i + 900) * 6.283, b = .15 + hash(i + 901) * 1.2, r = 200; p[i * 3] = Math.cos(a) * Math.cos(b) * r; p[i * 3 + 1] = Math.sin(b) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r; } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g; })(), new THREE.PointsMaterial({ color: '#fff0f8', size: .9, map: softTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); mid.add(stars);

// ———————————————————————————— overlay type
function title(s, y, p, size = 92, o = {}) {
  if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p) * (o.a ?? 1); c2.font = `italic ${o.w || 500} ${size}px "Cormorant Garamond"`; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.letterSpacing = (o.sp ?? .02) * size + 'px';
  const x = (o.x ?? W / 2), yy = y + (1 - eo(p)) * 18; c2.shadowColor = o.glow || 'rgba(255,190,140,.9)'; c2.shadowBlur = size * .45; c2.fillStyle = o.fill || '#fff4ea'; c2.fillText(s, x, yy); c2.shadowBlur = 0; c2.fillText(s, x, yy); c2.restore();
}
function bubble(s, x, y, p, col, tail = 1) {
  if (p <= 0) return; const k = eo(p); c2.save(); c2.globalAlpha = k; c2.font = '600 58px Inter'; const w = c2.measureText(s).width + 70, h = 104, yy = y - (1 - k) * 30; c2.translate(clamp(x, w / 2 + 24, W - w / 2 - 24), yy); c2.scale(.85 + .15 * k, .85 + .15 * k);
  c2.shadowColor = col; c2.shadowBlur = 30; c2.fillStyle = 'rgba(14,16,28,.82)'; c2.beginPath(); c2.roundRect(-w / 2, -h / 2, w, h, 36); c2.fill(); c2.shadowBlur = 0; c2.strokeStyle = col; c2.lineWidth = 3; c2.stroke();
  c2.fillStyle = 'rgba(14,16,28,.82)'; c2.beginPath(); c2.moveTo(tail * 10, h / 2 - 2); c2.lineTo(tail * 34, h / 2 + 22); c2.lineTo(tail * 40, h / 2 - 2); c2.fill();
  c2.fillStyle = '#ffffff'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(s, 0, 2); c2.restore();
}
const _v = new THREE.Vector3();
function scr(obj, dy = 0) { S.updateMatrixWorld(); cam.updateMatrixWorld(); obj.getWorldPosition(_v); _v.y += dy; _v.project(cam); return [(_v.x * .5 + .5) * W, (-_v.y * .5 + .5) * H]; }
function scrP(p) { cam.updateMatrixWorld(); _v.copy(p).project(cam); return [(_v.x * .5 + .5) * W, (-_v.y * .5 + .5) * H]; }

// ———————————————————————————— frame helpers
function hideAll() {
  for (const k in SETS) SETS[k].visible = false; resetChar(lumi); resetChar(rio);
  key.intensity = 0; rim.intensity = 0; amb.intensity = .25; amb.color.set('#203050'); S.background.set('#020308'); S.fog = null;
  P.bloom.strength = .7; P.bloom.radius = .6; P.bloom.threshold = .82; P.dof.maxCoc = 16; P.dof.aper = 3; P.vig.uniforms.amt.value = .6; P.vig.uniforms.warm.value = 0; P.vig.uniforms.sat.value = 1.05; P.vig.uniforms.fade.value = 1;
}
function look(px, py, pz, tx, ty, tz, fov = 35, focus) { cam.position.set(px, py, pz); cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz); cam.fov = fov; cam.updateProjectionMatrix(); P.dof.focus = focus ?? Math.hypot(px - tx, py - ty, pz - tz); }
function keyAt(x, y, z, tx, ty, tz, i, col) { key.position.set(x, y, z); key.target.position.set(tx, ty, tz); key.intensity = i; key.color.set(col); }
function rimAt(x, y, z, tx, ty, tz, i, col) { rim.position.set(x, y, z); rim.target.position.set(tx, ty, tz); rim.intensity = i; rim.color.set(col); }

// ———————————————————————————— scenes
const SH = {
  fire(lt, D, t) { SETS.fire.visible = true; S.fog = new THREE.FogExp2('#2a0c06', .022); amb.intensity = .35; amb.color.set('#4a2010'); keyAt(2, 3, 3, 0, .8, 0, .8, '#ffb080'); rimAt(-1, 2, -3, 0, .8, 0, 1.5, '#ff7a30');
    place(lumi, 0, 0, 0, .55); alive(lumi, t); lumi.userData.head.rotation.y = -.25 + Math.sin(lt * .5) * .1; lumi.userData.arms[1].rotation.set(-.3, 0, .2);
    rise(embers, t, [8, 7, 6], .45, .6); embers.position.set(0, -2, -2.5);
    const u = eio(lt / D); look(lerp(1.6, .95, u), lerp(1.25, 1.05, u), lerp(3.2, 2.1, u), lerp(-.1, .05, u), .78, 0, 34); P.dof.aper = 6; P.vig.uniforms.warm.value = .3;
    title('Город огня', 300, seg(lt, .6, 1.8), 110); },
  rain(lt, D, t) { SETS.rain.visible = true; S.fog = new THREE.FogExp2('#06101e', .045); amb.intensity = .35; amb.color.set('#1a2a4a'); keyAt(62, 4, 3, 60, 1, 0, .7, '#8ab0ff'); rimAt(60, 3, -6, 60, 1, 0, 2, '#9ac8ff');
    const z = lerp(-3, -.6, lt / D); place(rio, 60, 0, z, 0); alive(rio, t); walk(rio, lt * 5.2, .8); rio.userData.head.rotation.x = .12; rio.userData.body.rotation.x = .05;
    rainA.position.set(0, -.2, z + 1); rainAt(rainA, t, 9, 7, 9, .4, 10);
    look(60 + lerp(.9, .6, lt / D), 1.15, z + 3.6, 60, 1.05, z, 36); P.dof.aper = 5;
    title('Город дождя', 300, seg(lt, .5, 1.7), 110, { glow: 'rgba(120,180,255,.9)', fill: '#eef6ff' }); },
  map(lt, D, t) { SETS.map.visible = true; amb.intensity = .25; const u = eio(seg(lt, .1, D * .55));
    mFl.children[0].scale.y = 1 + .12 * Math.sin(t * 12); mDr.position.y = .05 + Math.sin(t * 2) * .03;
    const A = new THREE.Vector3(120, 0, 0).add(MAP_A); look(lerp(A.x, 120.05, u), lerp(3.2, 13.5, u), lerp(A.z + 1.6, .8, u), lerp(A.x, 120.05, u), 0, lerp(A.z - .1, .1, u), 38); P.dof.aper = lerp(5, 1.2, u);
    // dashed arc between the lights, drawn on the overlay
    const pr = seg(lt, D * .45, D * .9); if (pr > 0) { const pa = new THREE.Vector3(120, 0, 0).add(MAP_A), pb = new THREE.Vector3(120, 0, 0).add(MAP_B), pts = []; for (let i = 0; i <= 60; i++) { const s = i / 60; pts.push(scrP(new THREE.Vector3(lerp(pa.x, pb.x, s) + Math.sin(s * Math.PI) * 1.4, Math.sin(s * Math.PI) * .6, lerp(pa.z, pb.z, s)))); }
      c2.save(); c2.setLineDash([18, 16]); c2.lineWidth = 5; c2.shadowBlur = 16; const gr = c2.createLinearGradient(pts[0][0], pts[0][1], pts[60][0], pts[60][1]); gr.addColorStop(0, '#ffb070'); gr.addColorStop(1, '#8ac8ff'); c2.strokeStyle = gr; c2.shadowColor = 'rgba(255,220,255,.7)'; c2.beginPath(); const n = Math.round(60 * eio(pr)); pts.slice(0, n + 1).forEach(([x, y], i) => i ? c2.lineTo(x, y) : c2.moveTo(x, y)); c2.stroke(); c2.restore(); }
    title('тысячи', 860, seg(lt, D * .55, D * .55 + 1), 120, { glow: 'rgba(230,200,255,.9)' }); title('километров', 980, seg(lt, D * .6, D * .6 + 1), 92, { glow: 'rgba(230,200,255,.9)' }); },
  phones(lt, D, t) { SETS.split.visible = true; amb.intensity = .2;
    place(lumi, 180 - .42, 0, 0, .15); place(rio, 180 + .5, 0, -.1, -.15); alive(lumi, t); alive(rio, t, 1.3);
    for (const [c, a] of [[lumi, -1.15], [rio, -1.05]]) { const u = c.userData; u.phone.visible = true; u.arms[1].rotation.set(a, 0, -.55); u.arms[0].rotation.set(-.2, 0, -.25); u.head.rotation.x = .28; u.phone.rotation.set(-.2 - (-a - 1), .4, 0); u.phone.userData.L.intensity = 1.2 + .3 * Math.sin(t * 3); }
    rainAt(splitRain, t, 2.6, 5, 2.4, .35, 8); rise(splitEmb, t, [2.6, 3, 2], .4, .4);
    const u = eio(lt / D); look(180, lerp(1.35, 1.2, u), lerp(5.6, 4.8, u), 180, .9, 0, 36); P.dof.aper = 2.5;
    const [lx, ly] = scr(lumi.userData.phone), [rx, ry] = scr(rio.userData.phone);
    bubble('Скучаю', lx + 30, ly - 330, seg(lt, D * .5, D * .5 + .5), 'rgba(255,150,80,1)', -1); bubble('Скучаю', rx - 30, ry - 470, seg(lt, D * .62, D * .62 + .5), 'rgba(120,190,255,1)', 1);
    title('каждый вечер', 300, seg(lt, .4, 1.5), 96, { glow: 'rgba(230,200,255,.9)' }); },
  window(lt, D, t) { SETS.window.visible = true; amb.intensity = .2; amb.color.set('#3a2010'); rimAt(242, 3, 4, 240, 1, 0, 1.6, '#6a9aff');
    place(lumi, 240 + .5, .04, -.42, -.2); alive(lumi, t); sad(lumi, 1); const u = lumi.userData; u.arms[0].rotation.set(-1.35, .3, .25); u.flame.scale.multiplyScalar(lerp(1, .78, eio(lt / D)));
    u.light.intensity *= .8; glassStreak.material.map.offset.y = -t * .08; rainAt(winRain, t, 4, 4, 1.2, .3, 8);
    const k = eio(lt / D); look(240 + lerp(.85, .62, k), lerp(1.05, .98, k), lerp(2.9, 2.0, k), 240 + .5, .8, -.4, 32, lerp(2.9, 2.0, k) + .4); P.dof.aper = 4; P.vig.uniforms.amt.value = .8;
    title('дождь бы её погасил', 300, seg(lt, D * .4, D * .4 + 1.2), 80, { glow: 'rgba(140,190,255,.9)' }); },
  desert(lt, D, t) { SETS.desert.visible = true; S.fog = new THREE.Fog('#ff6a2a', 30, 210); amb.intensity = .45; amb.color.set('#6a3020'); keyAt(296, 4, -8, 300, 1, 0, 2.2, '#ff8a40'); rimAt(304, 3, 4, 300, 1, 0, 1, '#6aa8ff');
    const back = eio(seg(lt, D * .5, D * .8)) * .35; place(rio, 300, 0, .3 + back, -.55); alive(rio, t); sad(rio, 1); rio.userData.head.rotation.y = .5; rio.userData.arms[0].rotation.set(-.4, 0, -.5);
    rio.userData.water.emissive.set('#3a2a6a'); rise(steam, t, [.9, 2.6, .8], .7, .5); steam.position.set(299.75, .9, .3 + back);
    const k = eio(lt / D); look(300 + lerp(2.6, 2.2, k), lerp(1.5, 1.35, k), lerp(3.6, 3.0, k), 300 - .3, 1.05, -.2, 36, 3.6); P.dof.aper = 4; P.vig.uniforms.warm.value = .4;
    title('жара бы его испарила', 300, seg(lt, D * .4, D * .4 + 1.2), 80); },
  mid(lt, D, t) { SETS.mid.visible = true; S.fog = new THREE.FogExp2('#7a5a7a', .012); amb.intensity = .55; amb.color.set('#8a6a9a'); keyAt(330, 8, -60, 360, 0, 0, 1.6, '#ffb08a'); rimAt(390, 6, 30, 360, 0, 0, .6, '#8ab0ff');
    rise(midSteam, t, [30, 6, 10], .1, .4); midSteam.position.set(360, -1.2, -4); midSteam.material.opacity = .15;
    const k = eio(lt / D); look(360 + lerp(9, 6, k), lerp(9, 4.5, k), lerp(26, 15, k), 360, lerp(1, .4, k), 0, 40, 24); P.dof.aper = 1.2;
    title('посередине', 300, seg(lt, D * .45, D * .45 + 1.2), 110, { glow: 'rgba(255,190,220,.9)' }); },
  bridge(lt, D, t) { SETS.mid.visible = true; S.fog = new THREE.FogExp2('#7a5a7a', .012); amb.intensity = .5; amb.color.set('#8a6a9a'); keyAt(330, 8, -60, 360, 0, 0, 1.4, '#ffb08a'); rimAt(390, 6, 30, 360, 0, 0, .7, '#8ab0ff');
    const k = eo(seg(lt, 0, D * .92)); const lx = lerp(-2.3, -.5, k), rx = lerp(2.4, .62, k), wk = 1 - seg(lt, D * .75, D * .92);
    place(lumi, 360 + lx, 0, .1, Math.PI / 2); place(rio, 360 + rx, 0, .1, -Math.PI / 2); alive(lumi, t); alive(rio, t, 1.2); walk(lumi, lt * 7, wk); walk(rio, lt * 5, wk);
    const c = eio(lt / D); look(360 + lerp(.3, .06, c), lerp(1.2, 1.0, c), lerp(8.5, 6.2, c), 360 + .06, .8, 0, 38); P.dof.aper = 2.5;
    title('ни жарко, ни холодно', 300, seg(lt, .6, 1.8), 84, { glow: 'rgba(255,190,220,.9)' }); },
  hands(lt, D, t) { SETS.mid.visible = true; S.fog = new THREE.FogExp2('#7a5a7a', .012); amb.intensity = .4; amb.color.set('#8a6a9a'); keyAt(330, 8, -60, 360, 0, 0, 1.0, '#ffb08a');
    place(lumi, 360 - .36, 0, .1, Math.PI / 2); place(rio, 360 + .55, 0, .1, -Math.PI / 2); alive(lumi, t); alive(rio, t, 1.2);
    const r = eio(seg(lt, .2, D * .55)); lumi.userData.arms[0].rotation.set(-lerp(.1, 1.45, r), 0, -.15); lumi.userData.head.rotation.x = -.15;
    const r2 = eio(seg(lt, D * .4, D * .8)); rio.userData.arms[1].rotation.set(-lerp(.2, 1.0, r2), 0, .1); rio.userData.body.rotation.x = lerp(.03, .12, r2); rio.userData.head.rotation.x = .1;
    rise(midSteam, t, [.25, 1.1, .25], .35, .2); midSteam.position.set(360 + .02, .5, .32); midSteam.material.opacity = .5 * r2; midSteam.material.size = .16;
    glowO.position.set(360 - .1, .6, .35); glowO.material.opacity = .35 * r; glowB.position.set(360 + .14, .58, .4); glowB.material.opacity = .35 * r2;
    const c = eio(lt / D); look(360 + .1, lerp(1.05, .9, c), lerp(5.2, 4.4, c), 360 + .1, .7, .1, 40, lerp(5.1, 4.3, c)); P.dof.aper = 2.5; },
  together(lt, D, t) { SETS.mid.visible = true; S.fog = new THREE.FogExp2('#5a4a6a', .012); amb.intensity = .4; amb.color.set('#6a5a8a'); keyAt(330, 8, -60, 360, 0, 0, .8, '#ffb08a');
    const k = eio(seg(lt, 0, 2.2)); place(lumi, 360 - .26, 0, .1, Math.PI / 2); place(rio, 360 + lerp(.6, .4, k), lerp(0, -.1, k), .1, -Math.PI / 2); alive(lumi, t); alive(rio, t, 1.2);
    rio.userData.body.rotation.x = lerp(.1, .24, k); rio.userData.legs.forEach(l => l.rotation.x = -.3 * k); lumi.userData.head.rotation.x = -.18 * k; lumi.userData.body.rotation.x = .08 * k;
    lumi.userData.arms[0].rotation.set(-.9 * k, 0, -.2); rio.userData.arms[1].rotation.set(-.8 * k, 0, .15); lumi.userData.flame.scale.multiplyScalar(1 + .25 * k);
    const mixK = eio(seg(lt, 1.5, 5)); rio.userData.water.emissive.lerpColors(new THREE.Color('#0c3a9a'), new THREE.Color('#5a2a8a'), mixK * .6);
    glowO.position.set(360 - .2, .9, .35); glowO.material.opacity = .5 * k; glowB.position.set(360 + .12, .9, .35); glowB.material.opacity = .5 * k; heartGlow.position.set(360 - .03, .95, .45); heartGlow.material.opacity = .55 * mixK; heartGlow.scale.setScalar(.9 + .15 * Math.sin(t * 2));
    rise(midSteam, t, [.5, 2.5, .4], .3, .4); midSteam.position.set(360 - .03, .9, .25); midSteam.material.opacity = .35 * k; midSteam.material.size = .14;
    const end = seg(lt, D - TAIL + .3, D - .4); stars.material.opacity = eio(end);
    const c = eio(lt / D); look(360 + lerp(.08, -.1, end), lerp(1.05, 1.0, c) + 2.2 * eio(end), lerp(4.6, 3.9, c) + 4 * eio(end), 360 + .08, .82 + 1.0 * eio(end), .1, 40, lerp(4.5, 3.8, c));
    P.dof.aper = 5 - 3 * end;
    title('Город огня', 320, seg(lt, D - TAIL + 1.0, D - TAIL + 2.2), 110); title('и город дождя', 440, seg(lt, D - TAIL + 1.5, D - TAIL + 2.7), 96, { glow: 'rgba(130,190,255,.95)' }); },
};

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c2.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SUBS = (() => { const out = VO.map(v => ({ text: v.text, a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .6, p.a + 1.8); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .2) * (1 - seg(t, v.b - .15, v.b));
  c2.save(); c2.globalAlpha = f; c2.font = '600 50px Inter'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  const L = wrap(v.text, 920), y0 = H - 260 - (L.length - 1) * 64;
  L.forEach((s, i) => { c2.shadowColor = 'rgba(0,0,0,.95)'; c2.shadowBlur = 14; c2.fillStyle = '#ffffff'; c2.fillText(s, W / 2, y0 + i * 64); c2.fillText(s, W / 2, y0 + i * 64); });
  c2.restore();
}

// ———————————————————————————— frame
function render(t) {
  const k = sceneIdx(t), s = SC[k], lt = t - s.t0, D = s.t1 - s.t0;
  hideAll(); c2.clearRect(0, 0, W, H);
  SH[s.name](lt, D, t);
  if (qs.get('hide')) { const M = { lumi, rio, midSteam, glowO, glowB, heartGlow, stars }; for (const n of qs.get('hide').split(',')) if (M[n]) M[n].visible = false; else if (n === 'mid') SETS.mid.visible = false; }
  const fin = seg(lt, 0, .35), fout = 1 - seg(lt, D - .3, D); P.vig.uniforms.fade.value *= Math.min(k ? fin : seg(lt, 0, .6), k === SC.length - 1 ? 1 : fout) * .999 + .001;
  P.composer.render();
  c2.save(); c2.globalAlpha = .045; for (let i = 0; i < 900; i++) { const x = hash(i + Math.floor(t * 24) * 13.1) * W, y = hash(i * 7.3 + Math.floor(t * 24)) * H; c2.fillStyle = i % 2 ? '#fff' : '#000'; c2.fillRect(x, y, 2, 2); } c2.restore();
  subs(t);
  if (t > TL.DUR - .9) { c2.fillStyle = `rgba(0,0,0,${seg(t, TL.DUR - .9, TL.DUR)})`; c2.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const X = Object.fromEntries(SC.map(s => [s.name, s])), at = (n, dt) => X[n].t0 + dt, dur = n => X[n].t1 - X[n].t0;
  add('crackle', at('fire', 0), { d: dur('fire') }); add('rain', at('rain', 0), { d: dur('rain'), v: 1 }); add('whoosh', at('map', .2), { d: dur('map') * .7 }); add('chime', at('map', dur('map') * .45));
  add('rain', at('phones', 0), { d: dur('phones'), v: .4 }); add('crackle', at('phones', 0), { d: dur('phones'), v: .5 }); add('ping', at('phones', dur('phones') * .5)); add('ping', at('phones', dur('phones') * .62), { v: .9, hi: 1 });
  add('rain', at('window', 0), { d: dur('window'), v: .7, lp: 1 }); add('wind', at('desert', 0), { d: dur('desert') }); add('hiss', at('desert', .4), { d: dur('desert') - .6 });
  add('dusk', at('mid', 0), { d: dur('mid') + dur('bridge') + dur('hands') + dur('together') });
  const B = X.bridge; for (let s = .3; s < dur('bridge') * .85; s += .3) add('step', B.t0 + s, { v: .35 }); for (let s = .45; s < dur('bridge') * .85; s += .42) add('step', B.t0 + s, { v: .5, lo: 1 });
  add('hiss', at('hands', dur('hands') * .45), { d: dur('hands') * .55, v: .5 }); add('chime', at('together', 1.6)); add('swell', at('together', 0), { d: dur('together') });
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('italic 500 90px "Cormorant Garamond"', 'Город'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
