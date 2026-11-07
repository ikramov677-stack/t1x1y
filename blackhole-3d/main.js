// «Что будет, если упасть в чёрную дыру» — cinematic 3D short (vertical 1080×1920)
// Black hole = ray-marched lensing shader (photon geodesics around a Schwarzschild hole, accretion disk with Doppler beaming).
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';

const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ———————————————————————————— timeline
const LINES = [
  ['fall', 'Представьте: вы падаете в чёрную дыру.'], ['helmet', 'Что с вами случится? Ответ вас шокирует.'],
  ['light', 'Чёрная дыра так сильно притягивает, что из неё не вырывается даже свет.'], ['feet', 'Приближаясь, вы почувствуете, как вас тянет за ноги.'],
  ['tidal', 'Ноги притягиваются сильнее, чем голова…'], ['spaghetti', '…и вас начнёт растягивать, как спагетти.'],
  ['term', 'Учёные так и называют это — спагеттификация.'], ['friend', 'Но самое странное увидит ваш друг, который остался снаружи.'],
  ['slow', 'Для него вы будете падать всё медленнее и медленнее…'], ['red', '…пока не застынете на краю навсегда и не исчезнете, покраснев.'],
  ['clock', 'Потому что рядом с чёрной дырой время замедляется.'], ['galaxy', 'В центре нашей галактики тоже есть гигантская чёрная дыра.'],
  ['sun', 'Она тяжелее Солнца в четыре миллиона раз.'], ['earth', 'Но не бойтесь: до неё около двадцати шести тысяч световых лет.'],
  ['collapse', 'А если Солнце вдруг стало бы чёрной дырой той же массы…'], ['orbit', '…Земля продолжала бы летать по той же орбите. Только в темноте и холоде.'],
  ['sub', 'Подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.02,2.73],[3.11,5.85],[6.40,10.36],[10.88,13.69],[14.11,16.37],[16.63,19.13],[19.55,22.16],[22.64,25.96],[26.30,29.45],[29.67,33.33],[33.84,36.74],[37.23,40.33],[40.65,43.12],[43.43,46.94],[47.45,50.48],[50.88,55.10],[55.63,57.53]];
const VOICE_OFFSET = 0.4, BPM = 70, BEAT = 60 / BPM;
const snapB = t => Math.round(t / (BEAT / 2)) * BEAT / 2;
const TL = (() => {
  const spans = VOICE || (() => { let t = 0; return LINES.map(l => { const d = l.text.length / 14; const s = [t, t + d]; t += d + .7; return s; }); })();
  const on = spans.map(s => s[0] + VOICE_OFFSET), starts = on.map((x, i) => i ? snapB(x - .3) : 0);
  const end = snapB(spans[spans.length - 1][1] + VOICE_OFFSET + 3.0);
  return { SC: LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end })), VO: LINES.map((l, i) => ({ ...l, t: on[i], d: spans[i][1] - spans[i][0] })), DUR: end };
})();
const { SC, VO } = TL;
const sceneIdx = t => { let k = 0; SC.forEach((s, i) => { if (t >= s.t0) k = i; }); return k; };

// ———————————————————————————— renderer, post
const gl = document.getElementById('gl'), ov = document.getElementById('ov'), c2 = ov.getContext('2d');
const R = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true });
R.setSize(W, H, false); R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
const S = new THREE.Scene(); S.background = new THREE.Color('#000000');
const cam = new THREE.PerspectiveCamera(40, W / H, .02, 2000);
const P = makePost(R, S, cam, W, H, { ssaa: 1 });
const amb = new THREE.AmbientLight('#203050', .2); S.add(amb);
const key = new THREE.DirectionalLight('#ffb070', 0); S.add(key); S.add(key.target);
const rim = new THREE.DirectionalLight('#7aa8ff', 0); S.add(rim); S.add(rim.target);

// ———————————————————————————— black hole GLSL (shared by background and visor)
const BH_U = { uBH: { value: new THREE.Vector3() }, uS: { value: 1 }, uDisk: { value: 1 }, uTime: { value: 0 }, uGal: { value: .4 }, uDR: { value: new THREE.Matrix3() }, uStar: { value: 1 } };
const BH_GLSL = `
uniform vec3 uBH; uniform float uS, uDisk, uTime, uGal, uStar; uniform mat3 uDR;
float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 sky(vec3 d){
  vec3 c = vec3(.004, .005, .012);
  for (int k = 0; k < 2; k++) { float sc = k == 0 ? 160. : 380.; vec3 p = d * sc; vec3 id = floor(p); float h = h31(id + float(k) * 17.);
    if (h > .982) { vec3 f = fract(p) - .5; float s = exp(-dot(f, f) * 50.); vec3 col = mix(vec3(1., .82, .62), vec3(.7, .82, 1.), h31(id + 3.)); c += col * s * (h - .982) * 90. * (k == 0 ? 1. : .55) * uStar; } }
  float b = exp(-pow(dot(d, normalize(vec3(.35, 1., .25))) * 4., 2.));
  float nb = n3(d * 5.) * .55 + n3(d * 11.) * .3 + n3(d * 23.) * .15;
  c += uGal * b * smoothstep(.3, .8, nb) * vec3(.6, .48, .62) * .55;
  c += uGal * b * b * vec3(.25, .2, .3) * .25;
  return c;
}
vec3 diskCol(vec3 q, vec3 v, out float al){
  float rr = length(q.xz), ang = atan(q.z, q.x), om = 1. / pow(rr, 1.5), sw = ang + uTime * om * 4.;
  float nz = n3(vec3(cos(sw) * rr * 1.4, sin(sw) * rr * 1.4, rr * 2.3)) * .6 + n3(vec3(cos(sw) * rr * 4., sin(sw) * rr * 4., rr * 6.)) * .4;
  float tmp = pow(3. / rr, 1.6);
  vec3 c = mix(vec3(1., .3, .06), vec3(1., .86, .62), clamp(tmp * .9, 0., 1.)) * tmp * (.35 + nz * 1.1);
  vec3 vel = normalize(vec3(-q.z, 0., q.x)); float dop = 1. + .9 * dot(vel, -normalize(v)) * inversesqrt(rr) * 1.4;
  c *= max(dop, .15) * max(dop, .15) * uDisk * 2.6;
  al = clamp(tmp * 1.3 * (.35 + nz), 0., 1.) * smoothstep(2.9, 3.6, rr) * smoothstep(15., 9., rr) * clamp(uDisk * 3., 0., 1.);
  return c;
}
vec3 bhTrace(vec3 ro, vec3 rd){
  if (uS <= 0.) return sky(rd);
  vec3 p = uDR * ((ro - uBH) / uS), v = uDR * rd;
  float Rb = 30.; float b = dot(p, v), c0 = dot(p, p) - Rb * Rb, disc = b * b - c0;
  if (c0 > 0.) { if (disc < 0. || b > 0.) return sky(rd); p += v * (-b - sqrt(disc)); }
  vec3 hv = cross(p, v); float h2 = dot(hv, hv);
  vec3 col = vec3(0.); float a = 0.;
  for (int i = 0; i < 110; i++) {
    float r = length(p);
    if (r < 1.) return col;
    float dt = clamp(.07 * r, .02, 1.6);
    vec3 pn = p + v * dt; v += -1.5 * h2 * p / pow(r, 5.) * dt;
    if (p.y * pn.y < 0.) { float f = p.y / (p.y - pn.y); vec3 q = mix(p, pn, f); float rr = length(q.xz);
      if (rr > 2.9 && rr < 15.) { float al; vec3 dc = diskCol(q, v, al); col += (1. - a) * dc * al; a += (1. - a) * al; if (a > .97) return col; } }
    p = pn;
    if (dot(p, p) > Rb * Rb * 1.05 && dot(p, v) > 0.) break;
  }
  return col + (1. - a) * sky(normalize(transpose(uDR) * v));
}`;
const bgMat = new THREE.ShaderMaterial({ depthWrite: false, depthTest: false, uniforms: { ...BH_U, uInvP: { value: new THREE.Matrix4() }, uCW: { value: new THREE.Matrix4() }, uCP: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec2 vN; void main(){ vN = position.xy; gl_Position = vec4(position.xy, .9999, 1.); }',
  fragmentShader: BH_GLSL + `uniform mat4 uInvP, uCW; uniform vec3 uCP; varying vec2 vN;
    void main(){ vec4 v = uInvP * vec4(vN, 1., 1.); v /= v.w; vec3 rd = normalize((uCW * vec4(v.xyz, 0.)).xyz); gl_FragColor = vec4(bhTrace(uCP, rd), 1.); }` });
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat); bg.frustumCulled = false; bg.renderOrder = -10; S.add(bg);
const visorMat = new THREE.ShaderMaterial({ uniforms: BH_U,
  vertexShader: 'varying vec3 wp; varying vec3 wn; void main(){ vec4 w = modelMatrix * vec4(position, 1.); wp = w.xyz; wn = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: BH_GLSL + `varying vec3 wp; varying vec3 wn;
    void main(){ vec3 vd = normalize(wp - cameraPosition); vec3 n = normalize(wn); vec3 rd = reflect(vd, n); float fr = .55 + .45 * pow(1. - abs(dot(vd, n)), 3.);
      vec3 c = bhTrace(wp, rd) * vec3(1., .82, .5) * fr * 1.2 + vec3(.05, .035, .01) * fr; gl_FragColor = vec4(c, 1.); }` });
function setDisk(tilt, roll = 0) { const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt, 0, roll)); BH_U.uDR.value.setFromMatrix4(m).transpose(); }
// JS photon integrator (same equations) for drawing beams
function geodesic(p0, v0, steps = 900) { const p = p0.clone(), v = v0.clone(), hv = new THREE.Vector3().crossVectors(p, v), h2 = hv.lengthSq(), out = [p.clone()];
  for (let i = 0; i < steps; i++) { const r = p.length(); if (r < 1.01 || r > 40) break; const dt = clamp(.02 * r, .005, .3); const a = p.clone().multiplyScalar(-1.5 * h2 / Math.pow(r, 5)); p.addScaledVector(v, dt); v.addScaledVector(a, dt); if (i % 3 === 0) out.push(p.clone()); } out.push(p.clone()); return out; }

// ———————————————————————————— materials, helpers
const std = (c, r = .6, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
function cnv(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData = { c, g }; return t; }
const softTex = cnv(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
function sprite(col, s, o = 1) { const m = new THREE.SpriteMaterial({ map: softTex, color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); const sp = new THREE.Sprite(m); sp.scale.set(s, s, 1); return sp; }
const glowMat = (r, g, b, o = 1) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); m.color.setRGB(r, g, b); return m; };

// ———————————————————————————— astronaut
function makeAstro(withVisor = true) {
  const g = new THREE.Group(), mats = [];
  const suit = std('#e8e6e0', .7); const dark = std('#3a3c44', .5, { metalness: .4 }); const gold = std('#b08a40', .35, { metalness: .8 }); mats.push(suit, dark, gold);
  const add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
  const torso = add(new THREE.CapsuleGeometry(.2, .32, 8, 20), suit, 0, 1.15, 0); torso.scale.set(1.1, 1, .8);
  add(new THREE.BoxGeometry(.38, .5, .22), suit, 0, 1.2, -.22); add(new THREE.BoxGeometry(.2, .14, .03), dark, 0, 1.22, .16);
  for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(.012, 8, 6), glowMat(k ? .2 : 2, k ? 1.6 : .2, k ? .4 : .2), -.05 + k * .05, 1.25, .18);
  const head = new THREE.Group(); head.position.set(0, 1.6, 0); g.add(head);
  add(new THREE.SphereGeometry(.2, 32, 24), suit, 0, 0, 0, head);
  const visor = add(new THREE.SphereGeometry(.205, 40, 30, Math.PI * .08, Math.PI * .84, Math.PI * .22, Math.PI * .5), withVisor ? visorMat : gold, 0, 0, .0, head);
  add(new THREE.TorusGeometry(.17, .025, 10, 32), dark, 0, -.17, 0, head).rotation.x = Math.PI / 2;
  const limb = (x, y, len, r, ang) => { const a = new THREE.Group(); a.position.set(x, y, 0); const u = add(new THREE.CapsuleGeometry(r, len, 6, 14), suit, 0, -len / 2 - r * .5, 0, a); const f = new THREE.Group(); f.position.y = -len - r; a.add(f); add(new THREE.CapsuleGeometry(r * .92, len * .9, 6, 14), suit, 0, -len * .45 - r * .5, 0, f); a.userData.f = f; g.add(a); a.rotation.z = ang; return a; };
  const arms = [limb(-.3, 1.38, .22, .07, -.25), limb(.3, 1.38, .22, .07, .25)]; arms.forEach(a => add(new THREE.SphereGeometry(.075, 14, 10), dark, 0, -.25, 0, a.userData.f));
  const legs = [limb(-.12, .85, .3, .085, -.05), limb(.12, .85, .3, .085, .05)]; legs.forEach(l => add(new THREE.BoxGeometry(.15, .1, .22), dark, 0, -.33, .03, l.userData.f));
  g.userData = { head, arms, legs, mats, visor };
  return g;
}
const astro = makeAstro(true), friend = makeAstro(false); S.add(astro, friend);
function tintAstro(a, col, k, op = 1) { a.userData.mats.forEach((m, i) => { if (!m.userData.c0) m.userData.c0 = m.color.clone(); m.color.copy(m.userData.c0).lerp(new THREE.Color(col), k); m.emissive.set(col).multiplyScalar(k * .6); m.transparent = op < 1; m.opacity = op; }); a.traverse(o => { if (o.isMesh && o.material === visorMat) o.visible = op > .98; }); }
function resetAstro(a) { a.visible = false; a.position.set(0, 0, 0); a.rotation.set(0, 0, 0); a.scale.set(1, 1, 1); tintAstro(a, '#ffffff', 0, 1); const u = a.userData; u.head.rotation.set(0, 0, 0); u.arms.forEach((x, i) => { x.rotation.set(0, 0, i ? .25 : -.25); x.userData.f.rotation.set(0, 0, 0); }); u.legs.forEach((x, i) => { x.rotation.set(0, 0, i ? .05 : -.05); x.userData.f.rotation.set(0, 0, 0); }); }
function floatPose(a, t, k = 1) { const u = a.userData; u.arms[0].rotation.set(-.3 + Math.sin(t * .7) * .15 * k, 0, -.7); u.arms[1].rotation.set(-.2 + Math.sin(t * .6 + 1) * .15 * k, 0, .8); u.arms.forEach(x => x.userData.f.rotation.x = -.5); u.legs[0].rotation.x = .25 + Math.sin(t * .5) * .1 * k; u.legs[1].rotation.x = -.15; u.legs.forEach(x => x.userData.f.rotation.x = .35); }

// ———————————————————————————— props
// light beams (scene 3)
const beams = new THREE.Group(); S.add(beams);
const BEAM_B = [1.6, 2.2, 2.55, 2.75, 3.1, 3.8, 5, 6.5]; const beamMeshes = BEAM_B.map((b, i) => { const pts = geodesic(new THREE.Vector3(-30, b * (i % 2 ? 1 : -1) * 1, 0), new THREE.Vector3(1, 0, 0)); const curve = new THREE.CatmullRomCurve3(pts); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(400, pts.length * 2), .025, 6, false), glowMat(1.5, 1.3, 1.0, .8)); m.userData.n = m.geometry.index.count; beams.add(m); return m; });
// spaghetti tube (scene 6)
const spagCurve = new THREE.CatmullRomCurve3(Array.from({ length: 120 }, (_, i) => { const u = i / 119, r = lerp(9, 1.05, Math.pow(u, .8)), a = u * 5.2; return new THREE.Vector3(Math.cos(a) * r, Math.sin(u * 9) * .15 * (1 - u), Math.sin(a) * r); }));
const spagGeo = new THREE.TubeGeometry(spagCurve, 600, .06, 8, false); { const c = new Float32Array(spagGeo.attributes.position.count * 3); for (let i = 0; i < spagGeo.attributes.position.count; i++) { const u = Math.floor(i / 9) / 600; const col = new THREE.Color().setHSL(.08 - u * .08, 1, .55 + .2 * (1 - u)); c[i * 3] = col.r * 2; c[i * 3 + 1] = col.g * 2; c[i * 3 + 2] = col.b * 2; } spagGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
const spag = new THREE.Mesh(spagGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); S.add(spag);
const spagHead = sprite('#ffd0a0', .9, .9); S.add(spagHead);
// matter streams (scene 7)
const MN = 4000; const streams = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .07, map: softTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
streams.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MN * 3), 3)); { const c = new Float32Array(MN * 3); for (let i = 0; i < MN; i++) { const col = new THREE.Color().setHSL(.04 + hash(i) * .1, 1, .6); c[i * 3] = col.r * 1.6; c[i * 3 + 1] = col.g * 1.6; c[i * 3 + 2] = col.b * 1.6; } streams.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); } streams.frustumCulled = false; S.add(streams);
function streamsAt(t) { const a = streams.geometry.attributes.position; for (let i = 0; i < MN; i++) { const arm = i % 3, ph = (hash(i + 7) + t * (.08 + hash(i + 8) * .06)) % 1, r = lerp(14, 1.2, Math.pow(ph, .7)), ang = arm * 2.094 + ph * 7 + (hash(i + 9) - .5) * .4; a.setXYZ(i, Math.cos(ang) * r + (hash(i + 10) - .5) * .3, (hash(i + 11) - .5) * .25 * r * .2, Math.sin(ang) * r + (hash(i + 12) - .5) * .3); } a.needsUpdate = true; }
// ship window (scenes 8, 17)
const ship = new THREE.Group(); S.add(ship);
{ const wallM = std('#1a1c22', .6, { metalness: .5 }), trimM = std('#2a2e38', .4, { metalness: .7 });
  const sh = new THREE.Shape(); sh.moveTo(-4, -4); sh.lineTo(4, -4); sh.lineTo(4, 4); sh.lineTo(-4, 4); const hole = new THREE.Path(); hole.absellipse(0, 0, .62, .9, 0, Math.PI * 2, false); sh.holes.push(hole);
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), wallM); ship.add(wall);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .07, 12, 64), trimM); ring.scale.set(.64, .92, 1); ship.add(ring);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .03, 10), trimM); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * .76, Math.sin(a) * 1.05, .05); ship.add(b); }
  for (let k = 0; k < 6; k++) { const led = new THREE.Mesh(new THREE.SphereGeometry(.015, 8, 6), glowMat(k % 2 ? .3 : 2, k % 2 ? 1.5 : .4, k % 2 ? 2 : .2)); led.position.set(-.9 + k * .1, -1.25, .02); ship.add(led); }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, .1), trimM); panel.position.set(1.1, -1.3, .05); ship.add(panel);
  const L = new THREE.PointLight('#ff9a50', 3, 6, 1.4); L.position.set(.4, .6, 1.4); ship.add(L); }
// melting clock (scene 11)
const clockTex = cnv(512, 512, () => {});
function drawClock(t, rate) { const g = clockTex.userData.g; g.clearRect(0, 0, 512, 512); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill(); g.strokeStyle = '#8a6a30'; g.lineWidth = 16; g.stroke(); g.fillStyle = '#2a1e12'; for (let h = 0; h < 12; h++) { const a = h / 12 * Math.PI * 2; g.beginPath(); g.arc(256 + Math.sin(a) * 200, 256 - Math.cos(a) * 200, h % 3 ? 7 : 14, 0, 7); g.fill(); }
  const m = t * rate; for (const [len, w, a] of [[150, 12, m / 12], [205, 7, m], [215, 3, m * 12]]) { g.save(); g.translate(256, 256); g.rotate(a * Math.PI * 2); g.strokeStyle = len > 210 ? '#a02a1a' : '#1a120a'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 20); g.lineTo(0, -len); g.stroke(); g.restore(); } clockTex.needsUpdate = true; }
const clockGeo = new THREE.CircleGeometry(1, 64, 0, Math.PI * 2); const clockBase = clockGeo.attributes.position.array.slice();
const clockM = new THREE.Mesh(clockGeo, new THREE.MeshStandardMaterial({ map: clockTex, roughness: .5, side: THREE.DoubleSide, metalness: .1 })); S.add(clockM);
const clockRim = new THREE.Mesh(new THREE.TorusGeometry(1, .05, 10, 64), std('#c8a050', .3, { metalness: .9 })); clockM.add(clockRim);
function meltClock(k, t) { const p = clockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = clockBase[i * 3], y = clockBase[i * 3 + 1]; const drip = Math.max(0, -y) * k; const sag = k * (.25 * x * x + .15 * Math.sin(x * 3 + t)); p.setXYZ(i, x * (1 - .1 * k * Math.max(0, -y)), y - drip * drip * 1.4 - sag * .5, sag * .8 - .3 * k * Math.max(0, -y)); } p.needsUpdate = true; clockGeo.computeVertexNormals(); clockRim.visible = k < .05; }
// galaxy (scene 12)
const GN = 26000; const galaxy = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .09, map: softTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); galaxy.frustumCulled = false;
{ const p = new Float32Array(GN * 3), c = new Float32Array(GN * 3); for (let i = 0; i < GN; i++) { const arm = i % 4, u = Math.pow(hash(i + 1), 1.6), r = .3 + u * 12, ang = arm * Math.PI / 2 + Math.log(r + 1) * 2.6 + (hash(i + 2) - .5) * (.9 - u * .5), sp = (hash(i + 3) - .5) * .9 * (1 - u * .6);
  p[i * 3] = Math.cos(ang) * r + sp; p[i * 3 + 1] = (hash(i + 4) - .5) * .5 * Math.exp(-r * .2); p[i * 3 + 2] = Math.sin(ang) * r + sp; const col = new THREE.Color().setHSL(u < .15 ? .1 : (hash(i + 5) > .7 ? .62 : .08), u < .15 ? .7 : .5, .55 + .3 * (1 - u)); const k = (u < .15 ? 1.6 : .9) * (.5 + hash(i + 6)); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
  galaxy.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3)); galaxy.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
S.add(galaxy); const galCore = sprite('#ffe0b0', 5, .9); galaxy.add(galCore); const galCore2 = sprite('#ffffff', 1.5, 1); galaxy.add(galCore2);
// sun
const sunMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uK: { value: 1 } },
  vertexShader: 'varying vec3 p; varying vec3 n; varying vec3 v; void main(){ p = position; vec4 mv = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix * normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform float uTime, uK; varying vec3 p; varying vec3 n; varying vec3 v;
    float h(vec3 q){ return fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    float ns(vec3 q){ vec3 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
    void main(){ vec3 q = normalize(p) * 6. + uTime * .2; float g = ns(q) * .6 + ns(q * 2.3) * .3 + ns(q * 5.) * .1; float limb = pow(max(dot(n, v), 0.), .45);
      vec3 c = mix(vec3(1., .35, .05), vec3(1., .85, .45), g) * (.55 + limb * .9) * 2.4 * uK; gl_FragColor = vec4(c, 1.); }` });
const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), sunMat); S.add(sun); const sunGlow = sprite('#ffa040', 4, .8); sun.add(sunGlow);
// earth
const earthTex = cnv(1024, 512, (g, w, h) => { const img = g.createImageData(w, h), d = img.data; const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, H2 = (a, b) => hash(((a % s) + s) % s * 57.3 + b * 131.7); const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(H2(xi, yi), H2(xi + 1, yi), u), lerp(H2(xi, yi + 1), H2(xi + 1, yi + 1), u), v); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let n = 0, a = .5, f = 1; for (let o = 0; o < 5; o++) { n += a * vn(x / w * 8 * f, y / h * 4 * f, 8 * f); a *= .5; f *= 2; } const lat = Math.abs(y / h - .5) * 2; const i = (y * w + x) * 4; let c; if (lat > .86) c = [235, 240, 245]; else if (n > .54) c = n > .64 ? [120, 100, 70] : (lat < .35 && n < .6 ? [150, 130, 80] : [50, 90, 45]); else c = [8 + n * 20, 30 + n * 40, 70 + n * 80]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } g.putImageData(img, 0, 0);
  if (0) { for (let c = 0; c < 7; c++) { const cx = hash(c + 200) * w, cy = h * (.25 + hash(c + 201) * .5); for (let k = 0; k < 30; k++) { g.fillStyle = k % 4 ? '#3a6a2a' : '#8a7a4a'; g.beginPath(); g.arc(cx + (hash(c * 50 + k) - .5) * 220, cy + (hash(c * 50 + k + 1) - .5) * 140, 14 + hash(c * 50 + k + 2) * 40, 0, 7); g.fill(); } }
  } for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(255,255,255,${.3 + hash(k + 400) * .4})`; g.beginPath(); g.ellipse(hash(k + 401) * w, hash(k + 402) * h, 30 + hash(k + 403) * 60, 6 + hash(k + 404) * 10, 0, 0, 7); g.fill(); } });
const iceTex = cnv(1024, 512, (g, w, h) => { g.fillStyle = '#9ab8d8'; g.fillRect(0, 0, w, h); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(${200 + hash(k) * 55 | 0},${220 + hash(k + 1) * 35 | 0},255,${.3 + hash(k + 2) * .5})`; g.beginPath(); g.arc(hash(k + 3) * w, hash(k + 4) * h, 6 + hash(k + 5) * 40, 0, 7); g.fill(); } g.strokeStyle = 'rgba(60,90,140,.5)'; g.lineWidth = 2; for (let k = 0; k < 60; k++) { g.beginPath(); let x = hash(k + 50) * w, y = hash(k + 51) * h; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (hash(k * 5 + j) - .5) * 120; y += (hash(k * 5 + j + 9) - .5) * 60; g.lineTo(x, y); } g.stroke(); } });
const earthMat = new THREE.MeshStandardMaterial({ map: earthTex, roughness: .7 }); const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), earthMat); S.add(earth);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.04, 48, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { col: { value: new THREE.Color('#5ab0ff') }, k: { value: 1 } },
  vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 col; uniform float k; varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - abs(dot(n, v)), 2.5); gl_FragColor = vec4(col * f * k * 1.6, 1.); }' })); earth.add(atmo);
const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(1, .006, 6, 256), glowMat(.4, .7, 1.4, .6)); orbitRing.rotation.x = Math.PI / 2; S.add(orbitRing);
const frost = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .05, map: softTex, color: '#cfe6ff', transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })); { const p = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) { p[i * 3] = (hash(i + 700) - .5) * 14; p[i * 3 + 1] = (hash(i + 701) - .5) * 14; p[i * 3 + 2] = (hash(i + 702) - .5) * 14; } frost.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3)); } S.add(frost);
// ghost trail for slow-fall
const ghosts = [0, 1, 2, 3].map(() => { const gh = makeAstro(false); gh.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: '#ffb080', transparent: true, opacity: .15, blending: THREE.AdditiveBlending, depthWrite: false }); } }); S.add(gh); return gh; });

// ———————————————————————————— overlay type
function title(s, y, p, size = 92, o = {}) {
  if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p) * (o.a ?? 1); c2.font = `${o.w || 500} ${size}px Oswald`; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.letterSpacing = (o.sp ?? .12) * size + 'px';
  const x = o.x ?? W / 2, yy = y + (1 - eo(p)) * 22; c2.shadowColor = o.glow || 'rgba(255,150,60,.85)'; c2.shadowBlur = size * .4; c2.fillStyle = o.fill || '#fff6ec'; c2.fillText(s, x, yy); c2.shadowBlur = 0; c2.fillText(s, x, yy); c2.restore();
}
function label(s, x, y, p, size = 40, col = '#ffe0c0') { if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p); c2.font = `500 ${size}px Oswald`; c2.letterSpacing = size * .1 + 'px'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.shadowColor = 'rgba(0,0,0,.9)'; c2.shadowBlur = 14; c2.fillStyle = col; c2.fillText(s, x, y); c2.restore(); }
function arrow(x0, y0, x1, y1, p, col, w = 6) { if (p <= 0) return; const x = lerp(x0, x1, eo(p)), y = lerp(y0, y1, eo(p)); c2.save(); c2.strokeStyle = col; c2.fillStyle = col; c2.lineWidth = w; c2.shadowColor = col; c2.shadowBlur = 16; c2.beginPath(); c2.moveTo(x0, y0); c2.lineTo(x, y); c2.stroke(); const a = Math.atan2(y - y0, x - x0); c2.beginPath(); c2.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); c2.lineTo(x - Math.cos(a - .5) * 26, y - Math.sin(a - .5) * 26); c2.lineTo(x - Math.cos(a + .5) * 26, y - Math.sin(a + .5) * 26); c2.fill(); c2.restore(); }
const _v = new THREE.Vector3();
function scr(p) { cam.updateMatrixWorld(); _v.copy(p).project(cam); return [(_v.x * .5 + .5) * W, (-_v.y * .5 + .5) * H]; }

// ———————————————————————————— frame helpers
const PROPS = [astro, friend, beams, spag, spagHead, streams, ship, clockM, galaxy, sun, earth, orbitRing, frost, ...ghosts];
function hideAll() {
  PROPS.forEach(o => o.visible = false); resetAstro(astro); resetAstro(friend); ghosts.forEach(g => g.visible = false);
  BH_U.uS.value = 1; BH_U.uBH.value.set(0, 0, 0); BH_U.uDisk.value = 1; BH_U.uGal.value = .4; BH_U.uStar.value = 1; setDisk(.18); bg.visible = true;
  key.intensity = 0; rim.intensity = 0; amb.intensity = .2; amb.color.set('#203050'); sunMat.uniforms.uK.value = 1; earth.material = earthMat; atmo.material.uniforms.col.value.set('#5ab0ff'); atmo.material.uniforms.k.value = 1;
  P.bloom.strength = .75; P.bloom.radius = .6; P.bloom.threshold = .78; P.dof.maxCoc = 14; P.dof.aper = 2; P.vig.uniforms.amt.value = .6; P.vig.uniforms.warm.value = 0; P.vig.uniforms.sat.value = 1.05; P.vig.uniforms.fade.value = 1;
}
function look(px, py, pz, tx, ty, tz, fov = 40, focus) { cam.position.set(px, py, pz); cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz); cam.fov = fov; cam.updateProjectionMatrix(); P.dof.focus = focus ?? Math.hypot(px - tx, py - ty, pz - tz); }
function keyAt(x, y, z, i, col = '#ffb070') { key.position.set(x, y, z); key.target.position.set(0, 0, 0); key.intensity = i; key.color.set(col); }
function rimAt(x, y, z, i, col = '#7aa8ff') { rim.position.set(x, y, z); rim.target.position.set(0, 0, 0); rim.intensity = i; rim.color.set(col); }

// ———————————————————————————— scenes (BH at origin; 1 unit = Schwarzschild radius × uS)
const SH = {
  fall(lt, D, t) { const u = eio(lt / D); setDisk(.22); astro.visible = true; floatPose(astro, t); astro.position.set(.5, -.6, lerp(29, 26, u)); astro.rotation.set(-.3, Math.PI + .2, .15 + lt * .03); keyAt(0, 3, 0, 2.2); rimAt(-4, 6, 30, .6);
    look(.3, .3 + lerp(0, -.3, u), lerp(34.5, 31, u), 0, .4, 0, 42, lerp(5.2, 4.7, u)); P.dof.aper = 2.5;
    title('ВЫ ПАДАЕТЕ', 300, seg(lt, .4, 1.3), 120, { w: 500 }); title('В ЧЁРНУЮ ДЫРУ', 430, seg(lt, .9, 1.8), 84); },
  helmet(lt, D, t) { setDisk(.22); astro.visible = true; floatPose(astro, t, .3); astro.position.set(0, -1.6, 24); astro.rotation.set(0, Math.PI + Math.sin(lt * .3) * .12 - .1, 0); keyAt(0, 2, 0, 2.4); rimAt(3, 2, 30, .5);
    const u = eio(lt / D); look(lerp(.3, .14, u), .1, 24 - lerp(1.15, .8, u), 0, .02, 24, 32, lerp(1.15, .8, u)); P.dof.aper = 4;
    title('ЧТО С ВАМИ', 300, seg(lt, .3, 1.1), 96); title('СЛУЧИТСЯ?', 420, seg(lt, .7, 1.5), 120, { w: 500 }); },
  light(lt, D, t) { setDisk(Math.PI / 2 - .04); BH_U.uDisk.value = .35; beams.visible = true; const pr = seg(lt, .2, D * .85);
    beamMeshes.forEach((m, i) => m.geometry.setDrawRange(0, Math.floor(m.userData.n * eio(seg(pr, i * .04, .6 + i * .04)) / 3) * 3));
    const u = eio(lt / D); look(lerp(-1, 1, u), 0, lerp(26, 22, u), 0, 0, 0, 40, 22); P.dof.aper = 1; P.bloom.strength = .9;
    title('ДАЖЕ СВЕТ', 300, seg(lt, D * .45, D * .45 + 1), 120, { w: 500, glow: 'rgba(255,230,180,.9)' }); label('не может вырваться', 540, 420, seg(lt, D * .55, D * .55 + 1), 48); },
  feet(lt, D, t) { setDisk(.32); astro.visible = true; floatPose(astro, t, .4); const u = eio(lt / D); astro.position.set(0, lerp(9, 7.2, u), 8); astro.rotation.set(.9, 0, Math.PI + lt * .05); keyAt(0, -2, 0, 2.6); rimAt(3, 12, 14, .8);
    astro.userData.legs.forEach(l => l.rotation.x = .1);
    look(2.2, 11.2, 11.6, .2, 7.6, 8, 40, 4.2); P.dof.aper = 3;
    const [fx, fy] = scr(new THREE.Vector3(0, 7.2 + lerp(1.8, 0, 0), 8)); title('ТЯНЕТ ЗА НОГИ', 300, seg(lt, D * .35, D * .35 + 1), 96); },
  tidal(lt, D, t) { setDisk(.32); astro.visible = true; const k = eio(seg(lt, .3, D)); astro.position.set(0, 5.6, 6.6); astro.rotation.set(.9, 0, Math.PI); astro.scale.set(1 - .12 * k, 1 + .35 * k, 1 - .12 * k); keyAt(0, -2, 0, 2.8); rimAt(3, 12, 14, .8);
    look(2.4, 8.6, 9.8, .2, 5.3, 6.4, 40, 4.5); P.dof.aper = 3;
    const head = astro.userData.head.getWorldPosition(new THREE.Vector3()), foot = astro.userData.legs[0].userData.f.getWorldPosition(new THREE.Vector3()), dirW = foot.clone().sub(head).normalize();
    const [hx, hy] = scr(head), [fx, fy] = scr(foot), [ex, ey] = scr(foot.clone().addScaledVector(dirW, 1.4)), [gx, gy] = scr(head.clone().addScaledVector(dirW, .5));
    arrow(fx + 70, fy, ex + 70, ey, seg(lt, .4, 1.2), 'rgba(255,120,60,1)', 10); arrow(hx + 70, hy, gx + 70, gy, seg(lt, .7, 1.5), 'rgba(255,200,120,1)', 6);
    label('СИЛЬНЕЕ', ex + 70, ey + 50, seg(lt, 1.0, 1.6), 40, '#ffb080'); label('СЛАБЕЕ', hx + 200, hy - 20, seg(lt, 1.2, 1.8), 36, '#ffe0b0'); },
  spaghetti(lt, D, t) { setDisk(.3); spag.visible = true; spagHead.visible = true; const pr = eio(seg(lt, .1, D * .95)); const n = Math.floor(spagGeo.index.count * pr / 3) * 3; spag.geometry.setDrawRange(0, Math.max(3, n)); const hp = spagCurve.getPoint(clamp(pr, .001, 1)); spagHead.position.copy(hp);
    const u = eio(lt / D); look(lerp(4, 2, u), lerp(9, 7, u), lerp(17, 14, u), 0, 0, 0, 44, 15); P.dof.aper = 1; P.bloom.strength = .95;
    title('КАК СПАГЕТТИ', 300, seg(lt, D * .3, D * .3 + 1), 100); },
  term(lt, D, t) { setDisk(.38); streams.visible = true; streamsAt(t); BH_U.uDisk.value = 1.2; const u = eio(lt / D); look(Math.sin(lt * .1) * 4, lerp(10, 8, u), lerp(24, 20, u), 0, 0, 0, 44, 22); P.dof.aper = 1; P.bloom.strength = 1;
    title('СПАГЕТТИ-', 300, seg(lt, .4, 1.2), 120, { w: 500 }); title('ФИКАЦИЯ', 430, seg(lt, .7, 1.5), 120, { w: 500 }); },
  friend(lt, D, t) { setDisk(.2); BH_U.uS.value = 1; ship.visible = true; ship.position.set(0, 0, 40); friend.visible = true; friend.position.set(-.5, -1.9, 41.7); friend.rotation.set(0, Math.PI + .2, 0); friend.userData.head.rotation.set(-.1, -.2, 0);
    amb.intensity = .25; amb.color.set('#3a3040'); keyAt(0, 0, -10, .5); rimAt(0, 0, 0, 1.2, '#ff9a50');
    const u = eio(lt / D); look(lerp(-.15, .1, u), lerp(-.05, .05, u), 40 + lerp(4.0, 3.6, u), 0, 0, 0, 40, 2.4); P.dof.aper = 3;
    const [px, py] = scr(new THREE.Vector3(.4, -.2, 12)); c2.save(); c2.globalAlpha = .9; c2.fillStyle = '#fff'; c2.shadowColor = '#fff'; c2.shadowBlur = 10; c2.beginPath(); c2.arc(px, py, 3, 0, 7); c2.fill(); c2.restore();
    title('ДРУГ', 300, seg(lt, .4, 1.2), 120, { w: 500 }); label('остался снаружи', 540, 420, seg(lt, .8, 1.6), 48); },
  slow(lt, D, t) { setDisk(.22); astro.visible = true; floatPose(astro, t, .2); const sl = 1 - Math.exp(-lt * .9); const z = lerp(7.5, 4.0, sl); astro.position.set(.2, -.4, z); astro.rotation.set(-.3, Math.PI + .3, .3); keyAt(0, 2, 0, 2.5); rimAt(3, 3, 10, .5);
    ghosts.forEach((g, i) => { g.visible = true; const sg = 1 - Math.exp(-(lt - (i + 1) * .35) * .9); g.position.set(.2, -.4, lerp(7.5, 4.0, Math.max(0, sg))); g.rotation.copy(astro.rotation); g.traverse(o => { if (o.isMesh) o.material.opacity = .12 * (1 - i * .2); }); });
    look(1.6, .6, 12.5, 0, -.2, 4, 40, lerp(5, 8.5, sl)); P.dof.aper = 2;
    title('МЕДЛЕННЕЕ', 300, seg(lt, .4, 1.4), 110); title('И МЕДЛЕННЕЕ…', 430, seg(lt, D * .5, D * .5 + 1.4), 84, { a: .75 }); },
  red(lt, D, t) { setDisk(.22); astro.visible = true; floatPose(astro, t, .05); astro.position.set(.2, -.4, 3.9); astro.rotation.set(-.3, Math.PI + .3, .3); keyAt(0, 2, 0, 2.5);
    const k = eio(seg(lt, .2, D * .6)), op = 1 - eio(seg(lt, D * .45, D * .95)); tintAstro(astro, '#ff2a10', k, Math.max(op, .001)); astro.visible = op > .01;
    look(1.2, .4, 9.5, 0, -.3, 3.9, 38, 5.6); P.dof.aper = 2; P.vig.uniforms.warm.value = .4 * k;
    title('ЗАСТЫНЕТЕ', 300, seg(lt, .4, 1.3), 110, { glow: 'rgba(255,60,30,.9)' }); label('навсегда', 540, 420, seg(lt, .9, 1.7), 50, '#ffb0a0'); },
  clock(lt, D, t) { setDisk(.26); clockM.visible = true; const k = eio(seg(lt, .3, D)); meltClock(k, t); drawClock(t, lerp(.5, .03, k)); clockM.position.set(-1.2, 2.2, 13); clockM.rotation.set(-.2, .4, .1 + lt * .04); clockM.scale.setScalar(1.4); keyAt(-2, 4, 20, 1.6, '#ffd0a0'); rimAt(0, 0, 0, 1.5, '#ff8a40');
    look(.5, 2.2, 19.5, -.8, 1.4, 12, 40, 6.6); P.dof.aper = 2.5;
    title('ВРЕМЯ', 300, seg(lt, .4, 1.2), 120, { w: 500 }); title('ЗАМЕДЛЯЕТСЯ', 430, seg(lt, .8, 1.6), 92); },
  galaxy(lt, D, t) { BH_U.uS.value = 0; BH_U.uGal.value = .2; galaxy.visible = true; galaxy.position.set(0, 0, 0); galaxy.rotation.set(0, lt * .05, 0); galCore.material.opacity = .8 + .2 * Math.sin(t * 2);
    const u = eio(lt / D); look(0, lerp(18, 9, u), lerp(14, 9, u), 0, 0, 0, 44, 12); P.dof.aper = .6; P.bloom.strength = 1; P.bloom.threshold = .6;
    title('НАША ГАЛАКТИКА', 300, seg(lt, .4, 1.2), 86); label('в центре — чёрная дыра', 540, 410, seg(lt, D * .5, D * .5 + 1), 46); },
  sun(lt, D, t) { setDisk(.28); BH_U.uDisk.value = .45; sun.visible = true; sunMat.uniforms.uTime.value = t; sun.scale.setScalar(.06); sun.position.set(2.6, -2.6, 5); sunGlow.scale.set(5, 5, 1);
    const u = eio(lt / D); look(lerp(1.5, 1.8, u), lerp(1.2, 1, u), lerp(22, 19, u), 1.6, .2, 0, 40, 18); P.dof.aper = .8;
    const [sx, sy] = scr(sun.position); label('СОЛНЦЕ', sx, sy + 70, seg(lt, .6, 1.3), 38, '#ffd8a0'); title('× 4 000 000', 300, seg(lt, D * .35, D * .35 + 1), 120, { w: 500 }); label('масса Солнца', 540, 420, seg(lt, D * .45, D * .45 + 1), 46); },
  earth(lt, D, t) { BH_U.uS.value = 0; BH_U.uGal.value = 1.6; BH_U.uStar.value = 1.3; earth.visible = true; earth.position.set(0, -1.5, 0); earth.rotation.set(.3, lt * .06 + 1.5, 0); keyAt(-5, 2, 3, 2.6, '#fff4e0'); amb.intensity = .05;
    const u = eio(lt / D); look(lerp(.5, .2, u), lerp(-.3, -.1, u), lerp(3.4, 3.0, u), 0, .3, 0, 40, 30); P.dof.aper = .5;
    title('26 000', 300, seg(lt, D * .35, D * .35 + 1), 140, { w: 500 }); label('световых лет', 540, 430, seg(lt, D * .45, D * .45 + 1), 54); },
  collapse(lt, D, t) { const k = eio(seg(lt, D * .3, D * .75)); sun.visible = k < .99; sunMat.uniforms.uTime.value = t; sun.position.set(0, 0, 0); sun.scale.setScalar(lerp(1.6, .05, k)); sunMat.uniforms.uK.value = lerp(1, .2, k); sunGlow.material.opacity = .8 * (1 - k);
    BH_U.uS.value = .3 * eio(seg(lt, D * .6, D * .8)); BH_U.uDisk.value = 0; setDisk(.2); earth.visible = true; earth.position.set(-1.0, -1.7, 7); earth.scale.setScalar(.4); earth.rotation.y = lt * .1; keyAt(4, 3, -6, 2.2 * (1 - k) + .05, '#fff0d0'); amb.intensity = .05;
    look(-1.2, -.6, 11.5, 0, -.2, 0, 40, 11); P.dof.aper = 1.5; P.bloom.strength = .9;
    if (lt > D * .74 && lt < D * .86) { c2.fillStyle = `rgba(255,240,220,${.6 * (1 - seg(lt, D * .74, D * .86))})`; c2.fillRect(0, 0, W, H); }
    title('ТОЙ ЖЕ МАССЫ', 300, seg(lt, .4, 1.2), 90); },
  orbit(lt, D, t) { BH_U.uS.value = .3; BH_U.uDisk.value = 0; earth.visible = true; earth.material = new THREE.MeshStandardMaterial({ map: iceTex, roughness: .4, metalness: .1, emissive: '#0a1a3a', emissiveIntensity: .4 }); atmo.material.uniforms.col.value.set('#8ac8ff'); atmo.material.uniforms.k.value = .6;
    const a = .6 + lt * .14; earth.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5); earth.scale.setScalar(.7); orbitRing.visible = true; orbitRing.scale.setScalar(5); frost.visible = true; frost.rotation.y = t * .02;
    keyAt(-3, 4, 10, .5, '#8ab8ff'); rimAt(0, 2, -10, .8, '#6a9aff'); amb.intensity = .15; amb.color.set('#2a4a8a');
    const u = eio(lt / D); look(lerp(1.5, -.5, u), lerp(3.2, 2.6, u), lerp(12.5, 11, u), earth.position.x * .4, 0, earth.position.z * .4, 40, 8); P.dof.aper = 1; P.vig.uniforms.sat.value = .8;
    title('ТА ЖЕ ОРБИТА', 300, seg(lt, .4, 1.2), 96, { glow: 'rgba(120,180,255,.9)' }); label('в темноте и холоде', 540, 420, seg(lt, D * .5, D * .5 + 1), 48, '#cfe4ff'); },
  sub(lt, D, t) { BH_U.uS.value = 0; BH_U.uGal.value = 2.2; BH_U.uStar.value = 1.4; ship.visible = true; ship.position.set(0, 0, 40); friend.visible = true; friend.position.set(.45, -1.9, 41.7); friend.rotation.set(0, Math.PI - .15, 0); friend.userData.head.rotation.set(-.15, .1, 0); amb.intensity = .25; amb.color.set('#30344a'); rimAt(0, 0, 0, .8, '#9ab0ff'); ship.children.find(o => o.isPointLight).color.set('#8ab0ff');
    const u = eio(lt / D); look(lerp(.2, -.1, u), 0, 40 + lerp(4.0, 3.6, u), 0, .2, 0, 40, 2.4); P.dof.aper = 3;
    title('ФАКТЫ', 300, seg(lt, .5, 1.3), 140, { w: 500, glow: 'rgba(150,180,255,.9)' }); title('ЗА МИНУТУ', 430, seg(lt, .8, 1.6), 88, { glow: 'rgba(150,180,255,.9)' }); label('ПОДПИСЫВАЙТЕСЬ', 540, 1300, seg(lt, 1.3, 2), 54, '#ffe0a0'); },
};

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c2.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('четыре миллиона', '4 миллиона').replace('двадцати шести тысяч', '26 тысяч');
const SUBS = (() => { const out = VO.map(v => ({ text: SHOW(v.text), a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .5, p.a + 1.6); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
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
  hideAll(); c2.clearRect(0, 0, W, H); BH_U.uTime.value = t;
  SH[s.name](lt, D, t);
  cam.updateMatrixWorld(); bgMat.uniforms.uInvP.value.copy(cam.projectionMatrixInverse); bgMat.uniforms.uCW.value.copy(cam.matrixWorld); bgMat.uniforms.uCP.value.copy(cam.position);
  const fin = seg(lt, 0, .3), fout = 1 - seg(lt, D - .25, D); P.vig.uniforms.fade.value *= Math.min(k ? fin : seg(lt, 0, .5), k === SC.length - 1 ? 1 : fout) * .999 + .001;
  P.composer.render();
  c2.save(); c2.globalAlpha = .045; for (let i = 0; i < 900; i++) { const x = hash(i + Math.floor(t * 24) * 13.1) * W, y = hash(i * 7.3 + Math.floor(t * 24)) * H; c2.fillStyle = i % 2 ? '#fff' : '#000'; c2.fillRect(x, y, 2, 2); } c2.restore();
  subs(t);
  if (t > TL.DUR - .8) { c2.fillStyle = `rgba(0,0,0,${seg(t, TL.DUR - .8, TL.DUR)})`; c2.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const X = Object.fromEntries(SC.map(s => [s.name, s])), at = (n, dt) => X[n].t0 + dt, dur = n => X[n].t1 - X[n].t0;
  add('boom', at('fall', .4)); add('breath', at('helmet', 0), { d: dur('helmet') }); add('hit', at('helmet', .7)); add('sweep', at('light', .2), { d: dur('light') * .8 }); add('hit', at('light', dur('light') * .45));
  add('rumble', at('feet', 0), { d: dur('feet') + dur('tidal') }); add('stretch', at('tidal', .3), { d: dur('tidal') }); add('rise', at('spaghetti', 0), { d: dur('spaghetti') }); add('boom', at('term', .4)); add('swirl', at('term', 0), { d: dur('term') });
  add('hum', at('friend', 0), { d: dur('friend') }); add('tick', at('slow', 0), { d: dur('slow') + dur('red') * .6, slow: 1 }); add('down', at('red', 0), { d: dur('red') }); add('tick', at('clock', 0), { d: dur('clock'), slow: 1 }); add('hit', at('clock', .4));
  add('shimmer', at('galaxy', 0), { d: dur('galaxy') }); add('hit', at('sun', dur('sun') * .35)); add('boom', at('earth', dur('earth') * .35), { v: .6 }); add('implode', at('collapse', dur('collapse') * .3), { d: dur('collapse') * .45 }); add('boom', at('collapse', dur('collapse') * .75));
  add('wind', at('orbit', 0), { d: dur('orbit') }); add('boom', at('sub', .5), { v: .7 });
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'ВЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
