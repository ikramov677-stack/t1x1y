// «Что будет, если Земля остановится на 1 секунду» — cinematic 3D short (vertical 1080×1920)
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';

const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); }, ei = x => Math.pow(clamp(x), 2.2);
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ———————————————————————————— timeline
const LINES = [
  ['frozen', 'Что будет, если Земля остановится всего на одну секунду?'], ['worst', 'Спойлер: это будет худшая секунда в истории.'],
  ['speed', 'Вы этого не чувствуете, но прямо сейчас вы несётесь с огромной скоростью.'], ['equator', 'На экваторе Земля крутится со скоростью около тысячи шестисот семидесяти километров в час.'],
  ['plane', 'Это быстрее, чем летит самолёт!'], ['lift', 'Если планета резко встанет, всё, что не прикреплено, продолжит лететь.'],
  ['chaos', 'Люди, машины, дома — всё сорвёт с места.'], ['storm', 'Воздух помчится над планетой ураганом, быстрее звука.'],
  ['wave', 'Океаны обрушатся на берега гигантскими волнами.'], ['calm', 'Но есть место, где вы, скорее всего, уцелеете.'],
  ['pole', 'Это полюса! Там скорость вращения почти нулевая.'], ['half', 'А если Земля так и не начнёт снова крутиться…'],
  ['year', '…один день будет длиться целый год.'], ['night', 'Полгода — палящее солнце, полгода — ледяная ночь.'],
  ['continent', 'А океаны стекут к полюсам, и на экваторе появится один огромный материк.'], ['good', 'Хорошая новость: учёные уверены, что этого не случится.'],
  ['sub', 'Подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.06,3.26],[3.77,6.57],[7.12,11.34],[11.77,16.71],[17.09,18.85],[19.27,23.19],[23.58,26.57],[26.98,30.14],[30.47,33.12],[33.54,35.98],[36.32,39.61],[40.02,42.60],[43.02,45.25],[45.64,49.19],[49.52,54.07],[54.53,57.90],[58.30,60.16]];
const VOICE_OFFSET = 0.4, BPM = 80, BEAT = 60 / BPM;
const snapB = t => Math.round(t / (BEAT / 2)) * BEAT / 2;
const TL = (() => {
  const spans = VOICE || (() => { let t = 0; return LINES.map(l => { const d = l.text.length / 15; const s = [t, t + d]; t += d + .5; return s; }); })();
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
const cam = new THREE.PerspectiveCamera(40, W / H, .05, 3000);
const P = makePost(R, S, cam, W, H, { ssaa: 1 });
const amb = new THREE.HemisphereLight('#bcd4ff', '#3a3028', .5); S.add(amb);
const key = new THREE.DirectionalLight('#fff0d8', 0); S.add(key); S.add(key.target);
const rim = new THREE.DirectionalLight('#7aa8ff', 0); S.add(rim); S.add(rim.target);

// ———————————————————————————— helpers
const std = (c, r = .6, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
function cnv(w, h, f, rep = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
const softTex = cnv(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const puffTex = cnv(256, 256, (g) => { for (let k = 0; k < 26; k++) { const x = 128 + (hash(k) - .5) * 120, y = 128 + (hash(k + 1) - .5) * 90, r = 40 + hash(k + 2) * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); } });
function sprite(col, s, o = 1, add = true, tex = softTex) { const m = new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: o, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, toneMapped: !add }); const sp = new THREE.Sprite(m); sp.scale.set(s, s, 1); return sp; }
const glowMat = (r, g, b, o = 1) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); m.color.setRGB(r, g, b); return m; };
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, H2 = (a, b) => hash(((a % s) + s) % s * 57.3 + b * 131.7); const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(H2(xi, yi), H2(xi + 1, yi), u), lerp(H2(xi, yi + 1), H2(xi + 1, yi + 1), u), v); }
function fbm(x, y, s, oct = 5) { let n = 0, a = .5, f = 1; for (let o = 0; o < oct; o++) { n += a * vnoise(x * f, y * f, s * f); a *= .5; f *= 2; } return n; }
const SETS = {}; function set(n) { const g = new THREE.Group(); S.add(g); SETS[n] = g; return g; }
function skyDome(par, r = 900) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color('#2a5aa8') }, b: { value: new THREE.Color('#bcd6f0') }, c: { value: new THREE.Color('#d8e4ee') }, sd: { value: new THREE.Vector3(0, .3, -1).normalize() }, sc: { value: new THREE.Color('#fff2d0') }, ss: { value: 1 }, st: { value: 0 }, sw: { value: 0 }, tm: { value: 0 } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 a, b, c, sd, sc; uniform float ss, st, sw, tm; varying vec3 p;
      float h(vec3 q){ return fract(sin(dot(q, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float n3(vec3 q){ vec3 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ float y = p.y; vec3 col = y > 0. ? mix(b, a, pow(clamp(y * 1.6, 0., 1.), .55)) : mix(b, c, clamp(-y * 6., 0., 1.));
        float d = max(dot(p, sd), 0.); col += sc * (pow(d, 900.) * 6. + pow(d, 40.) * .35 + pow(d, 6.) * .12) * ss;
        if (sw > 0.) { float r = atan(p.x, p.z) * 2. + y * 6. + tm * .3; float n = n3(vec3(p.x * 3. + sin(r), y * 4., p.z * 3. + tm * .1)) * .6 + n3(p * 9. + tm * .2) * .4;
          col = mix(col, mix(vec3(.9, .35, .12), vec3(.35, .12, .4), n) * (.6 + .8 * n), sw * smoothstep(-.05, .3, y)); }
        if (st > 0.) { vec3 q = p * 300.; vec3 id = floor(q); float s = h(id); if (s > .993) { vec3 f = fract(q) - .5; col += vec3(.9, .95, 1.) * exp(-dot(f, f) * 30.) * (s - .993) * 140. * st * smoothstep(0., .15, y); } }
        gl_FragColor = vec4(col, 1.); }` }));
  m.renderOrder = -1; par.add(m); return m;
}
function terrain(par, size, segs, hf, mat) { const geo = new THREE.PlaneGeometry(size, size, segs, segs); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i), p.getZ(i))); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); par.add(m); return m; }
function particles(n, col, size, o = .9, add = true, tex = softTex) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.PointsMaterial({ color: col, size, map: tex, transparent: true, opacity: o, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }); const pt = new THREE.Points(g, m); pt.frustumCulled = false; pt.userData.n = n; return pt; }

// ———————————————————————————— people
function makePerson(o = {}) {
  const g = new THREE.Group(); const coat = std(o.coat || '#3a5a8a', .8), pants = std(o.pants || '#2a2e38', .8), skin = std(o.skin || '#d8a888', .6), dark = std('#1a1a1e', .6);
  const add = (geo, m, x, y, z, par = g) => { const ms = new THREE.Mesh(geo, m); ms.position.set(x, y, z); par.add(ms); return ms; };
  const fat = o.puffy ? 1.35 : 1;
  const body = add(new THREE.CapsuleGeometry(.17 * fat, .38, 6, 16), coat, 0, 1.15, 0); body.scale.z = .75;
  const head = new THREE.Group(); head.position.set(0, 1.58, 0); g.add(head);
  add(new THREE.SphereGeometry(.11, 20, 14), skin, 0, 0, 0, head);
  if (o.hood) { const hd = add(new THREE.SphereGeometry(.15, 20, 14, 0, Math.PI * 2, 0, Math.PI * .62), coat, 0, .02, -.02, head); hd.rotation.x = -.5; const fur = add(new THREE.TorusGeometry(.12, .04, 8, 20), std('#e8e0d0', 1), 0, .0, .07, head); fur.rotation.x = -.1;
    const gog = add(new THREE.BoxGeometry(.17, .045, .04), std('#101418', .1, { metalness: .8 }), 0, .02, .1, head); }
  else add(new THREE.SphereGeometry(.115, 20, 14, 0, Math.PI * 2, 0, Math.PI * .45), std(o.hair || '#2a1c14', .9), 0, .015, -.01, head);
  const limb = (x, y, len, r, m, m2) => { const a = new THREE.Group(); a.position.set(x, y, 0); add(new THREE.CapsuleGeometry(r, len, 5, 10), m, 0, -len / 2 - r * .4, 0, a); const e = add(new THREE.SphereGeometry(r * 1.05, 10, 8), m2, 0, -len - r * 1.3, 0, a); g.add(a); return a; };
  const arms = [limb(-.22 * fat, 1.42, .5, .055 * fat, coat, o.hood ? std('#202020', .8) : skin), limb(.22 * fat, 1.42, .5, .055 * fat, coat, o.hood ? std('#202020', .8) : skin)];
  const legs = [limb(-.09, .82, .62, .07 * (o.puffy ? 1.2 : 1), pants, dark), limb(.09, .82, .62, .07 * (o.puffy ? 1.2 : 1), pants, dark)];
  arms[0].rotation.z = -.08; arms[1].rotation.z = .08;
  g.userData = { head, arms, legs, body };
  return g;
}

// ———————————————————————————— SPACE set: stars, sun, Earth
const space = set('space');
skyDome(space, 1500).material.uniforms.a.value.set('#000002'), 0;
{ const d = space.children[0].material.uniforms; d.b.value.set('#010206'); d.c.value.set('#010206'); d.st.value = 1.2; d.ss.value = 0; }
const galaxyBand = particles(5000, '#c8d0ff', 1.6, .55); { const a = galaxyBand.geometry.attributes.position; for (let i = 0; i < 5000; i++) { const th = hash(i) * Math.PI * 2, sp = (hash(i + 1) - .5) * (hash(i + 2) < .7 ? .25 : .6), r = 1200; const v = new THREE.Vector3(Math.cos(th), sp, Math.sin(th)).normalize().multiplyScalar(r); v.applyAxisAngle(new THREE.Vector3(1, 0, .3).normalize(), .9); a.setXYZ(i, v.x, v.y, v.z); } } space.add(galaxyBand);
const wn = (x, y) => { const X = x * 5, Y = y * 2.5; const qx = fbm(X + 1.7, Y + 9.2, 5, 4), qy = fbm(X + 8.3, Y + 2.8, 5, 4); return fbm(X + qx * 1.6, Y + qy * 1.6, 5, 7); };
const earthTex = cnv(2048, 1024, (g, w, h) => { const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = wn(x / w, y / h), lat = Math.abs(y / h - .5) * 2, i = (y * w + x) * 4; let c;
    if (lat > .88 + (n - .5) * .1) c = [236, 242, 248];
    else if (n > .53) { const m = fbm(x / w * 16, y / h * 8, 16, 4), dry = clamp((m - .42) * 4) * (lat < .45 ? 1 : .3), hi = clamp((n - .6) * 8), det = .7 + .6 * fbm(x / w * 90, y / h * 45, 90, 3);
      const gr = lat > .62 ? [64, 84, 58] : [40, 80, 34], de = [190, 160, 108]; c = [0, 1, 2].map(j => lerp(lerp(gr[j], de[j], dry), [108, 92, 74][j], hi * .8) * det); if (n < .545) c = c.map(v => v * .85 + 12); }
    else { const dp = clamp((.53 - n) * 8); c = [lerp(34, 4, dp), lerp(110, 26, dp), lerp(140, 72, dp)]; }
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } g.putImageData(img, 0, 0); });
const contTex = cnv(2048, 1024, (g, w, h) => { const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = wn(x / w, y / h), lat = Math.abs(y / h - .5) * 2, i = (y * w + x) * 4; let c;
    const coast = .5 + (n - .5) * .5; if (lat > .96) c = [230, 238, 248];
    else if (lat < coast) { const k = lat / coast; const m = fbm(x / w * 16, y / h * 8, 16, 4); c = [0, 1, 2].map(j => lerp([196, 164, 110][j], [62, 92, 46][j], clamp((k - .55 + (m - .5) * .5) * 3))); c = c.map(v => v * (.7 + .6 * fbm(x / w * 90, y / h * 45, 90, 3))); if (n > .68) c = [120, 100, 80]; }
    else { const dp = clamp((lat - coast) * 6); c = [lerp(28, 6, dp), lerp(96, 34, dp), lerp(140, 86, dp)]; }
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } g.putImageData(img, 0, 0); });
const cloudTex = cnv(2048, 1024, (g, w, h) => { const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x / w * 10 + 3.3 + fbm(x / w * 20, y / h * 10, 20, 3) * .8, y / h * 5 + 1.7, 10, 6), i = (y * w + x) * 4, a = clamp((n - .52) * 3.5) * 220; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a; } g.putImageData(img, 0, 0); });
const earth = new THREE.Group(); space.add(earth);
const earthMat = new THREE.MeshStandardMaterial({ map: earthTex, roughness: .75, metalness: 0 });
const earthBall = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMat); earth.add(earthBall);
const contBall = new THREE.Mesh(new THREE.SphereGeometry(1.0015, 96, 64), new THREE.MeshStandardMaterial({ map: contTex, roughness: .8, transparent: true, opacity: 0 })); earth.add(contBall);
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 64), new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false, roughness: 1 })); earth.add(clouds);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, uniforms: { col: { value: new THREE.Color('#4a9cff') }, sd: { value: new THREE.Vector3(1, 0, 0) }, k: { value: 1 } },
  vertexShader: 'varying vec3 n; varying vec3 v; varying vec3 wn; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); wn = normalize(mat3(modelMatrix)*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 col, sd; uniform float k; varying vec3 n; varying vec3 v; varying vec3 wn; void main(){ float f = pow(clamp(1. - abs(dot(n, v)), 0., 1.), 1.); float rim = smoothstep(.0, .55, f) * (1. - smoothstep(.55, 1., f)); float lit = smoothstep(-.35, .4, dot(wn, sd)); gl_FragColor = vec4(col * rim * lit * k * 1.6, 1.); }' })); earth.add(atmo);
const atmoIn = new THREE.Mesh(new THREE.SphereGeometry(1.016, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { col: { value: new THREE.Color('#5aa8ff') }, sd: { value: new THREE.Vector3(1, 0, 0) } },
  vertexShader: 'varying vec3 n; varying vec3 v; varying vec3 wn; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); wn = normalize(mat3(modelMatrix)*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 col, sd; varying vec3 n; varying vec3 v; varying vec3 wn; void main(){ float f = pow(1. - abs(dot(n, v)), 3.); float lit = smoothstep(-.2, .5, dot(wn, sd)); gl_FragColor = vec4(col * f * lit * 1.1, 1.); }' })); earth.add(atmoIn);
const eqRing = new THREE.Mesh(new THREE.TorusGeometry(1.02, .006, 8, 256), glowMat(1.6, 1.0, .35)); eqRing.rotation.x = Math.PI / 2; earth.add(eqRing);
const eqGlow = new THREE.Mesh(new THREE.TorusGeometry(1.02, .03, 8, 256), glowMat(1, .5, .15, .35)); eqGlow.rotation.x = Math.PI / 2; earth.add(eqGlow);
const eqArrows = new THREE.Group(); earth.add(eqArrows);
for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const c = new THREE.Mesh(new THREE.ConeGeometry(.025, .07, 12), glowMat(1.8, 1.2, .5)); c.position.set(Math.cos(a) * 1.05, 0, -Math.sin(a) * 1.05); c.rotation.set(0, a, -Math.PI / 2); const holder = new THREE.Group(); holder.add(c); eqArrows.add(holder); c.rotation.set(Math.PI / 2, 0, 0); c.lookAt(Math.cos(a + .1) * 1.05, 0, -Math.sin(a + .1) * 1.05); c.rotateX(Math.PI / 2); }
const sunG = new THREE.Group(); space.add(sunG);
const sunDisk = sprite('#fff6e0', 30, 1); const sunHalo = sprite('#ffc070', 140, .55); const sunHalo2 = sprite('#ff9a40', 420, .22); sunG.add(sunHalo2, sunHalo, sunDisk);
const streaks = new THREE.Group(); sunG.add(streaks); for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 6), glowMat(1, .85, .6, .18)); m.rotation.z = k / 6 * Math.PI; streaks.add(m); }
function sunAt(dir, dist = 1200) { sunG.position.copy(dir).normalize().multiplyScalar(dist); sunG.quaternion.copy(cam.quaternion); key.position.copy(dir).normalize().multiplyScalar(50); key.target.position.set(0, 0, 0); atmo.material.uniforms.sd.value.copy(dir).normalize(); atmoIn.material.uniforms.sd.value.copy(dir).normalize(); }

// ———————————————————————————— CITY set (street runs along z)
const city = set('city');
const citySky = skyDome(city);
const asphalt = cnv(512, 512, (g, w, h) => { g.fillStyle = '#3a3c40'; g.fillRect(0, 0, w, h); for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${hash(k) > .5 ? 255 : 0},${hash(k) > .5 ? 255 : 0},${hash(k) > .5 ? 255 : 0},.06)`; g.fillRect(hash(k + 1) * w, hash(k + 2) * h, 2, 2); } g.fillStyle = '#e8e0c8'; for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 6, y, 12, 64); }, true);
asphalt.repeat.set(1, 30);
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 240), std('#ffffff', .85, { map: asphalt })); road.rotation.x = -Math.PI / 2; road.position.z = -80; city.add(road);
const walkM = std('#8a867e', .9); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(3, .15, 240), walkM); w.position.set(s * 5.5, .075, -80); city.add(w); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std('#5a5a52', 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; city.add(ground);
function facade(base, glass, seed) { return cnv(256, 512, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) { const v = hash(seed + x * 13 + y * 7); g.fillStyle = v > .85 ? '#ffe2a8' : glass; g.globalAlpha = .75 + v * .25; g.fillRect(x * 42 + 7, y * 32 + 6, 28, 22); g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x * 42 + 7, y * 32 + 6, 28, 3); } }, true); }
const FAC = [facade('#b8a890', '#3a4a5a', 1), facade('#8a8e94', '#283848', 2), facade('#c8beb0', '#4a5868', 3), facade('#6a5a50', '#2a3440', 4), facade('#d0c8bc', '#5a6a7a', 5)];
const buildings = [];
for (let k = 0; k < 44; k++) { const side = k % 2 ? 1 : -1, w = 6 + hash(k) * 5, h = 14 + hash(k + 1) * 34, d = 7 + hash(k + 2) * 4; const z = 6 - Math.floor(k / 2) * 9.5 - hash(k + 3) * 2; const tex = FAC[k % 5].clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 11)));
  const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), std('#ffffff', .7, { map: tex, metalness: .1 })); m.position.set(side * (7 + d / 2), h / 2, z); m.userData.p0 = m.position.clone(); city.add(m); buildings.push(m); }
const carCols = ['#c02a1a', '#e8e8ea', '#1a3a7a', '#202226', '#d8a020', '#4a6a5a'];
function makeCar(c) { const g = new THREE.Group(); const body = std(c, .3, { metalness: .6 }), glass = std('#1a2430', .1, { metalness: .9 }), tire = std('#141414', .9);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, .55, 4.2), body); b.position.y = .55; g.add(b); const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, .5, 2.2), glass); top.position.set(0, 1.05, -.2); g.add(top);
  for (const [x, z] of [[-.85, 1.3], [.85, 1.3], [-.85, -1.3], [.85, -1.3]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .25, 16), tire); wh.rotation.z = Math.PI / 2; wh.position.set(x, .34, z); g.add(wh); }
  for (const x of [-.6, .6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.35, .12, .05), glowMat(1.6, 1.5, 1.2)); l.position.set(x, .62, 2.11); g.add(l); const r = new THREE.Mesh(new THREE.BoxGeometry(.35, .12, .05), glowMat(1.6, .1, .05)); r.position.set(x, .62, -2.11); g.add(r); }
  return g; }
const cars = []; for (let k = 0; k < 8; k++) { const c = makeCar(carCols[k % 6]); c.userData.p0 = new THREE.Vector3(k % 2 ? 1.9 : -1.9, 0, -4 - k * 9 - hash(k + 40) * 3); c.userData.r0 = k % 2 ? Math.PI : 0; city.add(c); cars.push(c); }
function makeTree() { const g = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, 2.2, 8), std('#4a3424', .9)); tr.position.y = 1.1; g.add(tr); for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.9 - k * .1, 1), std(k % 2 ? '#3a6a2a' : '#4a7a32', .9, { flatShading: true })); f.position.set((hash(k + 70) - .5) * .6, 2.4 + k * .35, (hash(k + 71) - .5) * .6); g.add(f); } return g; }
const trees = []; for (let k = 0; k < 10; k++) { const t = makeTree(); t.userData.p0 = new THREE.Vector3((k % 2 ? 1 : -1) * 4.6, .15, 2 - k * 7.5); city.add(t); trees.push(t); }
const lamps = []; for (let k = 0; k < 8; k++) { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 5, 8), std('#2a2c30', .4, { metalness: .7 })); p.position.y = 2.5; g.add(p); const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .08), p.material); arm.position.set(k % 2 ? -.6 : .6, 4.95, 0); g.add(arm); g.position.set((k % 2 ? 1 : -1) * 4.3, .15, -1 - k * 9); g.userData.p0 = g.position.clone(); city.add(g); lamps.push(g); }
const PCOL = [['#3a5a8a', '#2a2e38'], ['#a83a2a', '#1e2a3a'], ['#d8c8a0', '#3a3a40'], ['#2a6a4a', '#2a2a2a'], ['#5a3a6a', '#202428'], ['#e0a040', '#30343a'], ['#202428', '#4a5060'], ['#8a2a4a', '#2a2e38']];
const people = PCOL.map(([c, p], i) => { const m = makePerson({ coat: c, pants: p, skin: ['#d8a888', '#a87858', '#e8c0a0', '#7a5038'][i % 4], hair: ['#2a1c14', '#6a4a2a', '#101010', '#8a6a3a'][i % 4] }); city.add(m); return m; });
const PPOS = [[-4.8, -2], [-4.2, -5.5], [4.6, -3.5], [5.3, -7], [-5.6, -9], [4.2, -11], [-4.4, -14], [5, -16]];
const debris = new THREE.Group(); city.add(debris); const DEB = [];
for (let k = 0; k < 140; k++) { const s = .15 + hash(k + 90) * .6; const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * (.3 + hash(k + 91)), s * (.5 + hash(k + 92))), std(['#8a7a6a', '#5a5048', '#b0a898', '#3a3a3e', '#a04a2a'][k % 5], .8)); debris.add(m); DEB.push(m); }
const dust = new THREE.Group(); city.add(dust); const DUST = [];
for (let k = 0; k < 90; k++) { const sp = sprite('#a88a68', 14 + hash(k + 300) * 16, .5, false, puffTex); sp.material.rotation = hash(k + 301) * 6; dust.add(sp); DUST.push(sp); }
const streakL = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
streakL.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 6), 3)); streakL.frustumCulled = false; city.add(streakL);
function streaksAt(t, sp, n0 = 300) { const a = streakL.geometry.attributes.position; for (let i = 0; i < 300; i++) { const x = -6.5 + hash(i) * 1.5 - (i < n0 ? 0 : 999), y = .2 + hash(i + 1) * 12, z = 60 - ((hash(i + 2) * 120 + t * sp * (.8 + .4 * hash(i + 3))) % 120), L = 3 + hash(i + 4) * 6; a.setXYZ(i * 2, x, y, z); a.setXYZ(i * 2 + 1, x, y, z + L); } a.needsUpdate = true; }
function cityReset(t) {
  buildings.forEach(b => { b.position.copy(b.userData.p0); b.rotation.set(0, 0, 0); });
  cars.forEach(c => { c.position.copy(c.userData.p0); c.rotation.set(0, c.userData.r0, 0); });
  trees.forEach(tr => { tr.position.copy(tr.userData.p0); tr.rotation.set(0, 0, 0); }); lamps.forEach(l => { l.position.copy(l.userData.p0); l.rotation.set(0, 0, 0); });
  people.forEach((p, i) => { p.visible = true; p.position.set(PPOS[i][0], .15, PPOS[i][1]); p.rotation.set(0, i % 2 ? -Math.PI / 2 + .4 : Math.PI / 2 - .4, 0); p.userData.head.rotation.set(0, 0, 0); p.userData.arms.forEach((a, j) => a.rotation.set(0, 0, j ? .08 : -.08)); });
  debris.visible = false; dust.visible = false; streakL.visible = false;
  const u = citySky.material.uniforms; u.a.value.set('#3a6ab8'); u.b.value.set('#c4d8ee'); u.c.value.set('#9aa0a0'); u.sw.value = 0; u.st.value = 0; u.ss.value = 1; u.sd.value.set(.5, .35, -1).normalize(); u.tm.value = t;
  S.fog = new THREE.Fog('#b8c8d8', 40, 260);
}

// ———————————————————————————— SKY set (airliner above clouds)
const skyS = set('sky');
const skyD = skyDome(skyS, 1400);
const deck = new THREE.Mesh(new THREE.SphereGeometry(2000, 128, 64, 0, Math.PI * 2, 0, Math.PI * .2), new THREE.MeshStandardMaterial({ map: (() => { const t = cnv(1024, 1024, (g, w, h) => { const img = g.createImageData(w, h), d = img.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x / w * 16, y / h * 16, 16, 5), i = (y * w + x) * 4, v = 200 + clamp((n - .35) * 2) * 55; d[i] = v; d[i + 1] = v; d[i + 2] = v + 6; d[i + 3] = 255; } g.putImageData(img, 0, 0); }, true); t.repeat.set(6, 6); return t; })(), roughness: 1 }));
deck.material.side = THREE.DoubleSide; deck.rotation.x = Math.PI; deck.position.y = 2000 - 4; skyS.add(deck);
const puffs = new THREE.Group(); skyS.add(puffs); for (let k = 0; k < 70; k++) { const sp = sprite('#ffffff', 18 + hash(k + 500) * 30, .85, false, puffTex); sp.position.set((hash(k + 501) - .5) * 300, -9 + hash(k + 502) * 4, -40 - hash(k + 503) * 260); puffs.add(sp); }
const plane = new THREE.Group(); skyS.add(plane);
{ const white = std('#f2f2f4', .35, { metalness: .2 }), grey = std('#a8acb4', .4, { metalness: .5 }), blue = std('#1a3a8a', .4), glass = std('#0a1018', .1, { metalness: .9 });
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(.42, 6.2, 10, 24), white); fus.rotation.x = Math.PI / 2; plane.add(fus);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(.425, .425, 5.6, 24, 1, true, Math.PI * .35, Math.PI * .3), blue); stripe.rotation.x = Math.PI / 2; plane.add(stripe);
  for (const s of [-1, 1]) { const ws = new THREE.Mesh(new THREE.BoxGeometry(.14, .07, .02), glass); ws.position.set(s * .1, .24, 3.3); ws.rotation.set(-.7, s * .5, 0); plane.add(ws); }
  for (let k = 0; k < 22; k++) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(.02, .08, .06), glass); w.position.set(s * .41, .14, 2.4 - k * .22); plane.add(w); }
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, .9); wingShape.lineTo(4.3, -1.1); wingShape.lineTo(4.3, -1.5); wingShape.lineTo(0, -.9);
  for (const s of [-1, 1]) { const wg = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: .08, bevelEnabled: false }), white); wg.rotation.x = -Math.PI / 2; wg.scale.x = s; wg.position.set(0, -.15, 0); wg.rotation.y = 0; plane.add(wg); wg.rotation.z = 0;
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(.22, .18, 1.1, 18), grey); eng.rotation.x = Math.PI / 2; eng.position.set(s * 1.6, -.42, .35); plane.add(eng);
    const inl = new THREE.Mesh(new THREE.CircleGeometry(.2, 18), std('#18181c', .5)); inl.position.set(s * 1.6, -.42, .91); plane.add(inl);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), glowMat(s > 0 ? .2 : 2, s > 0 ? 2 : .2, .2)); tip.position.set(s * 4.3, -.12, -1.25); plane.add(tip); }
  const stab = new THREE.Shape(); stab.moveTo(0, .3); stab.lineTo(1.5, -.4); stab.lineTo(1.5, -.65); stab.lineTo(0, -.4);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.ExtrudeGeometry(stab, { depth: .05, bevelEnabled: false }), white); st.rotation.x = -Math.PI / 2; st.scale.x = s; st.position.set(0, .05, -3.0); plane.add(st); }
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-1.3, 0); fin.lineTo(-1.9, 1.5); fin.lineTo(-1.45, 1.5); fin.lineTo(-.2, .3);
  const fn = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: .06, bevelEnabled: false }), blue); fn.rotation.y = Math.PI / 2; fn.position.set(-.03, .3, -1.8); plane.add(fn); }
const contrail = new THREE.Group(); plane.add(contrail); for (const s of [-1, 1]) for (let k = 0; k < 30; k++) { const sp = sprite('#ffffff', .4 + k * .07, .45 * (1 - k / 30), false); sp.position.set(s * 1.6, -.42, -1 - k * .9); contrail.add(sp); }

// ———————————————————————————— COAST set (giant wave)
const coast = set('coast');
const coastSky = skyDome(coast);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200, 1, 1), std('#0e3a4a', .25, { metalness: .3 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.4; coast.add(sea);
const beach = new THREE.Mesh(new THREE.PlaneGeometry(400, 80), std('#b8a080', 1)); beach.rotation.x = -Math.PI / 2; beach.position.set(0, -.1, 30); coast.add(beach);
const shoreCity = new THREE.Group(); coast.add(shoreCity);
for (let k = 0; k < 40; k++) { const w = 5 + hash(k + 600) * 6, h = 10 + hash(k + 601) * 40, x = (hash(k + 602) < .5 ? -1 : 1) * (7 + hash(k + 602.5) * 55), z = -12 + hash(k + 603) * 26; const tex = FAC[k % 5].clone(); tex.needsUpdate = true; tex.repeat.set(1, Math.round(h / 11)); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), std('#ffffff', .7, { map: tex })); m.position.set(x, h / 2, z); shoreCity.add(m); }
const WS = 160, WU = 70, waveGeo = new THREE.PlaneGeometry(1, 1, WS, WU); const WAVE_H = 70;
const waveMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { tm: { value: 0 }, sd: { value: new THREE.Vector3(.3, .5, .6).normalize() } },
  vertexShader: `attribute float u; varying float vu; varying vec3 wn; varying vec3 wp; void main(){ vu = u; wn = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float tm; uniform vec3 sd; varying float vu; varying vec3 wn; varying vec3 wp;
    float h(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
    float n2(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){ vec3 n = normalize(wn); vec3 v = normalize(cameraPosition - wp); if (dot(n, v) < 0.) n = -n;
      float st = n2(vec2(wp.x * .15, wp.y * .4 - tm * 2.)) * .6 + n2(vec2(wp.x * .6, wp.y * 1.2 - tm * 4.)) * .4;
      vec3 deep = vec3(.02, .14, .18), mid = vec3(.05, .42, .45), crest = vec3(.5, .85, .82);
      vec3 c = mix(deep, mid, smoothstep(.15, .62, vu)); c = mix(c, crest, smoothstep(.55, .7, vu) * .7);
      float sss = pow(max(dot(-v, sd), 0.), 2.) * smoothstep(.3, .65, vu); c += vec3(.1, .5, .45) * sss * .8;
      float dif = max(dot(n, sd), 0.); c *= .45 + .7 * dif; float fr = pow(1. - max(dot(n, v), 0.), 3.); c += vec3(.5, .65, .75) * fr * .35;
      float foam = smoothstep(.62, .75, vu + st * .2) + smoothstep(.62, .9, st) * .6 * smoothstep(.3, .7, vu) + smoothstep(.12, .0, vu) * st;
      c = mix(c, vec3(.92, .96, .98) * (.6 + .5 * dif), clamp(foam, 0., 1.));
      gl_FragColor = vec4(c, 1.); }` });
{ const p = waveGeo.attributes.position, uu = new Float32Array(p.count); for (let j = 0; j <= WU; j++) for (let i = 0; i <= WS; i++) uu[j * (WS + 1) + i] = 1 - j / WU; waveGeo.setAttribute('u', new THREE.BufferAttribute(uu, 1)); }
const wave = new THREE.Mesh(waveGeo, waveMat); wave.frustumCulled = false; coast.add(wave);
function waveShape(t, k) { const p = waveGeo.attributes.position; const r = WAVE_H * .26;
  for (let j = 0; j <= WU; j++) for (let i = 0; i <= WS; i++) { const u = 1 - j / WU, x = (i / WS - .5) * 400, idx = j * (WS + 1) + i; const ph = Math.sin(x * .02 + 1) * .5 + Math.sin(x * .053) * .3, Hh = WAVE_H * (1 + .15 * ph) * k; let y, z;
    const curl = clamp(k * 1.1 - .1) * (.8 + .2 * Math.sin(x * .03)); if (u < .62) { const s = u / .62; z = -120 * Math.pow(1 - s, 2); y = Hh * Math.pow(Math.sin(s * Math.PI / 2), 1.6); }
    else { const s = (u - .62) / .38, f = Math.PI - s * Math.PI * 1.35 * curl; z = r * (1 + Math.cos(f)) * k; y = Hh + r * Math.sin(f) * k; }
    p.setXYZ(idx, x, y + Math.sin(x * .3 + t * 2 + u * 6) * .6, z); }
  p.needsUpdate = true; waveGeo.computeVertexNormals(); }
const spray = particles(2500, '#ffffff', 9, .3, false, puffTex);
coast.add(spray);
function sprayAt(t, wz, k) { const a = spray.geometry.attributes.position; for (let i = 0; i < 2500; i++) { const x = (hash(i) - .5) * 400, ph = (hash(i + 1) + t * .35) % 1; a.setXYZ(i, x, WAVE_H * k * (1.05 + .12 * Math.sin(x * .02 + 1)) + ph * 22 - 4, wz + WAVE_H * .4 * k + ph * 30 + hash(i + 2) * 8); } a.needsUpdate = true; }

// ———————————————————————————— POLAR / DESERT / NIGHT terrain sets
const polar = set('polar');
const polarSky = skyDome(polar);
const snowTex = cnv(512, 512, (g, w, h) => { g.fillStyle = '#eef3f8'; g.fillRect(0, 0, w, h); for (let k = 0; k < 5000; k++) { const v = 220 + hash(k) * 35 | 0; g.fillStyle = `rgba(${v - 10},${v},255,.25)`; g.fillRect(hash(k + 1) * w, hash(k + 2) * h, 3, 2); } }, true); snowTex.repeat.set(30, 30);
const snowMat = std('#ffffff', .85, { map: snowTex });
const snowHF = (x, z) => fbm(x * .01 + 50, z * .01 + 50, 1e9, 4) * 14 - 7 + Math.sin(x * .05) * Math.cos(z * .04) * 2 - Math.exp(-(x * x + z * z) / 800) * 3;
const snowGround = terrain(polar, 800, 160, snowHF, snowMat);
const ridges = new THREE.Group(); polar.add(ridges); for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.ConeGeometry(30 + hash(k + 800) * 50, 30 + hash(k + 801) * 50, 6), std('#e8eef6', .8, { flatShading: true })); m.position.set((hash(k + 802) - .5) * 600, 0, -220 - hash(k + 803) * 200); m.rotation.y = hash(k) * 3; ridges.add(m); }
const snowfall = particles(2500, '#ffffff', .12, .85, false); polar.add(snowfall);
function snowAt(t, sp = 1, wind = .3) { const a = snowfall.geometry.attributes.position; for (let i = 0; i < 2500; i++) { const h = 30, y = h - ((hash(i) * h + t * sp * (1 + hash(i + 1))) % h) - 6; a.setXYZ(i, (hash(i + 2) - .5) * 60 + Math.sin(t * .6 + i) * .4 + wind * y, y, (hash(i + 3) - .5) * 60 - 10); } a.needsUpdate = true; }
const explorer = makePerson({ coat: '#e85a1a', pants: '#2a2e3a', hood: true, puffy: true, skin: '#c89070' }); polar.add(explorer);
const poleTex = cnv(64, 256, (g, w, h) => { for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? '#d8202a' : '#f4f4f4'; g.fillRect(0, y * 32, w, 32); } });
const poleM = new THREE.Group(); polar.add(poleM); { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.6, 16), std('#ffffff', .4, { map: poleTex })); p.position.y = 1.3; poleM.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(.28, 32, 20), std('#e8ecf4', .25, { metalness: .3 })); b.position.y = 2.75; poleM.add(b); }
const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(.9, .55, 12, 6), std('#2a6ad8', .7, { side: THREE.DoubleSide })); poleM.add(flagCloth); flagCloth.position.set(.45, 2.2, 0);
const aurora = new THREE.Group(); polar.add(aurora);
for (let k = 0; k < 3; k++) { const geo = new THREE.PlaneGeometry(600, 90, 80, 1); const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { tm: { value: 0 }, k: { value: 1 }, sd: { value: k } },
  vertexShader: 'uniform float tm, sd; varying vec2 vu; void main(){ vu = uv; vec3 p = position; p.z += sin(p.x * .01 + tm * .3 + sd) * 40. + sin(p.x * .023 - tm * .2) * 20.; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }',
  fragmentShader: 'uniform float tm, k, sd; varying vec2 vu; void main(){ float a = pow(vu.y, 1.5) * (1. - vu.y) * 4. * (.6 + .4 * sin(vu.x * 60. + tm + sd * 3.)); vec3 c = mix(vec3(.1, 1., .5), vec3(.5, .3, 1.), vu.y); gl_FragColor = vec4(c * a * k * .5, 1.); }' }));
  m.position.set(k * 60 - 60, 90 + k * 15, -320 - k * 40); m.rotation.x = .25; aurora.add(m); }
const desert = set('desert');
const desertSky = skyDome(desert);
const sandTex = cnv(512, 512, (g, w, h) => { g.fillStyle = '#d8a868'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(120,70,30,${.05 + hash(y) * .06})`; g.fillRect(0, y + Math.sin(y) * 2, w, 1.5); } for (let k = 0; k < 6000; k++) { g.fillStyle = `rgba(255,230,190,${hash(k) * .2})`; g.fillRect(hash(k + 1) * w, hash(k + 2) * h, 2, 2); } }, true); sandTex.repeat.set(40, 40);
const duneHF = (x, z) => { const r = Math.sin(x * .03 + Math.sin(z * .02) * 2) * 8 + Math.sin(x * .011 + z * .007) * 14 + fbm(x * .008 + 9, z * .008 + 9, 1e9, 3) * 10; return Math.abs(r) * .7 - 12; };
terrain(desert, 900, 200, duneHF, std('#ffffff', .95, { map: sandTex }));
const desertSun = new THREE.Group(); desert.add(desertSun); desertSun.add(sprite('#fff4d0', 60, 1), sprite('#ffb040', 260, .5), sprite('#ff7a20', 700, .25));
const heat = particles(800, '#fff0c0', 2.5, .06); desert.add(heat);
const skull = new THREE.Group(); desert.add(skull); { const bone = std('#e8dcc0', .7); for (let k = 0; k < 9; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.1 - Math.abs(k - 4) * .12, .06, 8, 24, Math.PI), bone); r.position.set(0, 0, k * .4); skull.add(r); } const sp = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 4, 8), bone); sp.rotation.x = Math.PI / 2; sp.position.set(0, 1.05, 1.6); skull.add(sp); }
const cracks = cnv(1024, 1024, (g, w, h) => { g.fillStyle = '#c89860'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,40,20,.8)'; g.lineWidth = 3; for (let k = 0; k < 160; k++) { let x = hash(k) * w, y = hash(k + 1) * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (hash(k * 7 + j) - .5) * 120; y += (hash(k * 7 + j + 3) - .5) * 120; g.lineTo(x, y); } g.stroke(); } }, true); cracks.repeat.set(8, 8);
const flat = new THREE.Mesh(new THREE.CircleGeometry(60, 48), std('#ffffff', 1, { map: cracks })); flat.rotation.x = -Math.PI / 2; flat.position.y = -4; desert.add(flat);

// ———————————————————————————— overlay type
function title(s, y, p, size = 92, o = {}) {
  if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p) * (o.a ?? 1); c2.font = `${o.w || 500} ${size}px Oswald`; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.letterSpacing = (o.sp ?? .1) * size + 'px';
  const x = o.x ?? W / 2, yy = y + (1 - eo(p)) * 22; c2.shadowColor = o.glow || 'rgba(0,0,0,.85)'; c2.shadowBlur = size * .45; c2.fillStyle = o.fill || '#fffaf0'; c2.fillText(s, x, yy); c2.shadowBlur = size * .12; c2.shadowColor = 'rgba(0,0,0,.6)'; c2.fillText(s, x, yy); c2.restore();
}
function label(s, x, y, p, size = 40, col = '#ffe8c8') { if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p); c2.font = `500 ${size}px Oswald`; c2.letterSpacing = size * .1 + 'px'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.shadowColor = 'rgba(0,0,0,.95)'; c2.shadowBlur = 16; c2.fillStyle = col; c2.fillText(s, x, y); c2.fillText(s, x, y); c2.restore(); }
function bar(x, y, w, frac, p, col, txt, val) { if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p); c2.fillStyle = 'rgba(0,0,0,.45)'; c2.fillRect(x, y, w, 26); c2.fillStyle = col; c2.shadowColor = col; c2.shadowBlur = 18; c2.fillRect(x, y, w * frac * eio(seg(p, 0, 1)), 26);
  c2.shadowBlur = 12; c2.shadowColor = '#000'; c2.font = '500 40px Oswald'; c2.letterSpacing = '3px'; c2.textBaseline = 'bottom'; c2.textAlign = 'left'; c2.fillStyle = '#fff'; c2.fillText(txt, x, y - 10); c2.textAlign = 'right'; c2.fillStyle = col; c2.fillText(val, x + w, y - 10); c2.restore(); }
const _v = new THREE.Vector3();
function scr(p) { S.updateMatrixWorld(); cam.updateMatrixWorld(); _v.copy(p).project(cam); return [(_v.x * .5 + .5) * W, (-_v.y * .5 + .5) * H]; }

// ———————————————————————————— frame helpers
function hideAll(t) {
  Object.values(SETS).forEach(g => g.visible = false); S.fog = null;
  earth.position.set(0, 0, 0); earth.rotation.set(0, 0, .41); earth.scale.setScalar(1); clouds.rotation.set(0, 0, 0); contBall.material.opacity = 0; contBall.visible = false; eqRing.visible = eqGlow.visible = eqArrows.visible = false; atmo.material.uniforms.k.value = 1; earthMat.color.set('#ffffff');
  sunG.visible = true; sunG.scale.setScalar(1); streaks.visible = true; galaxyBand.visible = true;
  key.intensity = 0; rim.intensity = 0; amb.intensity = .5; amb.color.set('#bcd4ff'); amb.groundColor.set('#3a3028');
  P.bloom.strength = .55; P.bloom.radius = .6; P.bloom.threshold = .85; P.dof.maxCoc = 12; P.dof.aper = 1.5; P.vig.uniforms.amt.value = .55; P.vig.uniforms.warm.value = 0; P.vig.uniforms.sat.value = 1.08; P.vig.uniforms.fade.value = 1;
}
function look(px, py, pz, tx, ty, tz, fov = 40, focus) { cam.position.set(px, py, pz); cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz); cam.fov = fov; cam.updateProjectionMatrix(); P.dof.focus = focus ?? Math.hypot(px - tx, py - ty, pz - tz); }
function keyAt(x, y, z, tx, ty, tz, i, col = '#fff0d8') { key.position.set(x, y, z); key.target.position.set(tx, ty, tz); key.intensity = i; key.color.set(col); }
function rimAt(x, y, z, tx, ty, tz, i, col = '#7aa8ff') { rim.position.set(x, y, z); rim.target.position.set(tx, ty, tz); rim.intensity = i; rim.color.set(col); }
function shake(k, t) { cam.position.x += Math.sin(t * 37) * k * .6 + Math.sin(t * 23) * k * .4; cam.position.y += Math.sin(t * 41 + 1) * k * .5; cam.rotation.z += Math.sin(t * 29) * k * .02; }
function spaceScene(sunDir, sunVis = true) { SETS.space.visible = true; sunAt(sunDir); sunG.visible = sunVis; amb.intensity = .02; amb.color.set('#4060a0'); amb.groundColor.set('#000000'); key.intensity = 3.2; key.color.set('#fff4e4'); }
const SPIN = .9;   // rad per second, cinematic Earth spin

// ———————————————————————————— scenes
const SH = {
  frozen(lt, D, t) { spaceScene(new THREE.Vector3(-.7, .3, 1)); const stopT = D * .42, sp = lt < stopT ? SPIN * .25 : 0; const ang = lt < stopT ? lt * SPIN * .25 : stopT * SPIN * .25;
    earth.rotation.y = 1.2 + ang; clouds.rotation.y = lt < stopT ? ang * .3 : stopT * SPIN * .25 * .3 + (1 - Math.exp(-(lt - stopT) * 3)) * .08;
    const u = eio(lt / D); look(lerp(.3, .1, u), lerp(-.1, 0, u), lerp(4.6, 4.0, u), 0, -.1, 0, 40, 4.0); P.dof.aper = .3;
    if (lt > stopT) { const f = seg(lt, stopT, stopT + .5); shake(.02 * (1 - f), t); P.vig.uniforms.sat.value = lerp(.4, 1, f); if (lt < stopT + .15) { c2.fillStyle = `rgba(255,255,255,${.5 * (1 - seg(lt, stopT, stopT + .15))})`; c2.fillRect(0, 0, W, H); } }
    title('ЗЕМЛЯ', 290, seg(lt, .3, 1.1), 130, { w: 500 }); title('ОСТАНОВИТСЯ', 420, seg(lt, .7, 1.5), 96);
    label('НА 1 СЕКУНДУ', 540, 530, seg(lt, stopT, stopT + .5), 54, '#ffd080'); },
  worst(lt, D, t) { SETS.city.visible = true; cityReset(t); const k = eio(seg(lt, 0, D * .7)); const u = citySky.material.uniforms; u.sw.value = .2 + .8 * k; u.ss.value = 1 - k * .6; u.a.value.set('#2a2040'); S.fog.color.set('#a08070');
    keyAt(30, 40, -60, 0, 0, 0, 1.6, '#ffb080'); amb.intensity = .55; amb.color.set('#d0a0a0');
    people.forEach((p, i) => { p.userData.head.rotation.x = -.55 * eio(seg(lt, .2 + i * .08, 1 + i * .08)); p.rotation.y = (i % 2 ? -Math.PI / 2 + .9 : Math.PI / 2 - .9); if (i < 3) { p.userData.arms[1].rotation.x = -1.8 * eio(seg(lt, .8 + i * .2, 1.5 + i * .2)); } });
    look(-.6, .45, 4, 0, 6, -30, 52, 9); P.dof.aper = 1.2;
    title('ХУДШАЯ', 290, seg(lt, .4, 1.1), 130, { w: 500 }); title('СЕКУНДА', 420, seg(lt, .7, 1.4), 110); label('в истории', 540, 520, seg(lt, 1.1, 1.8), 50); },
  speed(lt, D, t) { SETS.city.visible = true; cityReset(t); people.forEach(p => p.visible = false); const me = people[0]; me.visible = true; me.position.set(0, .15, 0); me.rotation.set(0, Math.PI / 2, 0);
    const off = (t * 40) % 9.5; buildings.forEach(b => { if (b.position.x < 0) b.position.z = b.userData.p0.z + off; });
    lamps.forEach(l => l.position.z = l.userData.p0.z + ((t * 40) % 9)); trees.forEach(tr => tr.position.z = tr.userData.p0.z + ((t * 40) % 7.5));
    streakL.visible = true; streaksAt(t, 220); keyAt(20, 30, 10, 0, 0, 0, 2.2); amb.intensity = .6;
    const u = eio(lt / D); look(lerp(8.5, 7.5, u), 1.5, lerp(1.2, .6, u), 0, 1.1, 0, 32, 7.6); P.dof.aper = 2.5;
    title('ВЫ НЕСЁТЕСЬ', 290, seg(lt, D * .45, D * .45 + .8), 112, { w: 500 }); label('с огромной скоростью', 540, 410, seg(lt, D * .55, D * .55 + .8), 48); },
  equator(lt, D, t) { spaceScene(new THREE.Vector3(-1, .3, .6)); earth.rotation.set(.15, 2 + lt * SPIN * .35, 0); clouds.rotation.y = lt * .02; eqRing.visible = eqGlow.visible = eqArrows.visible = true; const g = eio(seg(lt, .2, 1.2)); eqRing.material.opacity = g; eqGlow.material.opacity = .35 * g; eqArrows.children.forEach(h => h.children[0].material.opacity = g);
    const u = eio(lt / D); look(lerp(.2, 0, u), lerp(.7, .55, u), lerp(4.4, 3.9, u), 0, -.1, 0, 40, 3.9); P.dof.aper = .3; P.bloom.strength = .8;
    title('1 670', 300, seg(lt, D * .4, D * .4 + .8), 160, { w: 500, glow: 'rgba(255,170,60,.9)' }); label('КМ/Ч  НА ЭКВАТОРЕ', 540, 440, seg(lt, D * .5, D * .5 + .8), 50, '#ffd090'); },
  plane(lt, D, t) { SETS.sky.visible = true; const sd = new THREE.Vector3(.6, .25, -1).normalize(); const u2 = skyD.material.uniforms; u2.a.value.set('#0e3a96'); u2.b.value.set('#7aaee8'); u2.c.value.set('#c8d8ea'); u2.sd.value.copy(sd); u2.ss.value = .6;
    plane.position.set(0, 3, 0); plane.rotation.set(.04, -.5, Math.sin(lt * .5) * .03 - .05); puffs.position.z = (lt * 30) % 40; keyAt(sd.x * 50, sd.y * 50, sd.z * 50, 0, 0, 0, 2.6); amb.intensity = .8; amb.color.set('#c8dcff'); amb.groundColor.set('#e8e8f0'); S.fog = new THREE.Fog('#c8dcf0', 200, 1600);
    const u = eio(lt / D); look(lerp(-9, -7.5, u), lerp(1.6, 1.9, u), lerp(9, 7.5, u), 0, 3.6, -1, 42, 11); P.dof.aper = 1;
    bar(140, 330, 800, .55, seg(lt, .1, .7), '#9ad0ff', 'САМОЛЁТ', '≈ 900 км/ч'); bar(140, 470, 800, 1, seg(lt, .4, 1.0), '#ffb060', 'ЗЕМЛЯ', '1 670 км/ч'); },
  lift(lt, D, t) { SETS.city.visible = true; cityReset(t); keyAt(30, 40, 20, 0, 0, 0, 2.2); amb.intensity = .55; citySky.material.uniforms.sw.value = .35;
    const k = seg(lt, D * .2, D);
    cars.forEach((c, i) => { const d = Math.max(0, k - i * .04); c.position.x += ei(d) * 30 * (1 + hash(i) * .5); c.position.y += Math.sin(clamp(d) * Math.PI * .9) * (2 + hash(i + 1) * 3); c.rotation.z = -d * (2 + hash(i + 2) * 3); c.rotation.x = d * hash(i + 3); });
    trees.forEach((tr, i) => { const d = Math.max(0, k - .1 - i * .03); tr.rotation.z = -Math.min(1.3, d * 3); tr.position.x += ei(d) * 22; tr.position.y += d * 2; });
    people.forEach((p, i) => { const d = Math.max(0, k - .05 - i * .05); p.position.x += ei(d) * 18; p.position.y += Math.sin(clamp(d) * Math.PI) * 2.5; p.rotation.z = -d * 3; p.userData.arms.forEach((a, j) => a.rotation.z = (j ? 1 : -1) * (.1 + d * 2.5)); });
    debris.visible = true; DEB.forEach((m, i) => { const d = Math.max(0, k - hash(i + 5) * .4); m.position.set(-8 + hash(i) * 16 + ei(d) * 40, .2 + hash(i + 1) * .5 + d * 4 * hash(i + 2), -2 - hash(i + 3) * 40); m.rotation.set(d * 9 * hash(i + 6), d * 7, d * 11 * hash(i + 7)); m.visible = i < 60; });
    look(-2, 2.2, 9, 1, 1.5, -12, 46, 12); shake(.03 * k, t); P.dof.aper = 1.2;
    title('ВСЁ', 290, seg(lt, .4, 1), 130, { w: 500 }); title('ПРОДОЛЖИТ ЛЕТЕТЬ', 410, seg(lt, .7, 1.4), 86); },
  chaos(lt, D, t) { SETS.city.visible = true; cityReset(t); keyAt(30, 40, 20, 0, 0, 0, 1.8, '#ffd0b0'); amb.intensity = .45; citySky.material.uniforms.sw.value = .6; S.fog.near = 10; S.fog.far = 160; S.fog.color.set('#9a8a7a');
    const k = .4 + lt / D * .6;
    buildings.forEach((b, i) => { const d = clamp(k - hash(i + 20) * .5); b.rotation.z = -d * .35 * (b.position.x < 0 ? .4 : 1); b.position.x += d * 4; });
    cars.forEach((c, i) => { c.position.x = -10 + ((lt * (18 + hash(i) * 10) + hash(i + 1) * 30) % 40); c.position.y = 2 + hash(i + 2) * 6 + Math.sin(lt * 2 + i) * 1.5; c.rotation.set(lt * hash(i + 3) * 3, lt, -lt * (2 + hash(i + 4) * 3)); });
    trees.forEach((tr, i) => { tr.position.x = -12 + ((lt * 22 + hash(i + 9) * 40) % 44); tr.position.y = 1 + hash(i + 10) * 8; tr.rotation.set(lt * 2, 0, -lt * 4 - i); });
    people.forEach((p, i) => { p.position.set(-10 + ((lt * 15 + hash(i + 30) * 36) % 36), 1.5 + hash(i + 31) * 6, -4 - i * 2.2); p.rotation.set(lt * 2 + i, i, -lt * 3 - i); p.userData.arms.forEach((a, j) => a.rotation.z = (j ? 1 : -1) * 2.4); });
    debris.visible = true; DEB.forEach((m, i) => { m.visible = true; const sp = 20 + hash(i) * 25; m.position.set(-25 + ((lt * sp + hash(i + 1) * 60) % 60), .5 + hash(i + 2) * 18, -1 - hash(i + 3) * 50); m.rotation.set(lt * 6 * hash(i + 4), lt * 5, lt * 8 * hash(i + 5)); });
    look(-3, 2.5, 10, 0, 4, -14, 48, 12); shake(.06, t); P.dof.aper = 1;
    title('ВСЁ СОРВЁТ', 290, seg(lt, .4, 1.1), 120, { w: 500 }); title('С МЕСТА', 410, seg(lt, .7, 1.4), 96); },
  storm(lt, D, t) { SETS.city.visible = true; cityReset(t); keyAt(30, 40, 20, 0, 0, 0, 1.2, '#ffc890'); amb.intensity = .45; amb.color.set('#c8a080'); const sk = citySky.material.uniforms; sk.sw.value = .5; sk.a.value.set('#5a4030'); sk.b.value.set('#b08a68');
    people.forEach(p => p.visible = false); const front = lerp(-60, 30, eio(seg(lt, 0, D * .9)));
    S.fog.color.set('#8a6a50'); S.fog.near = 5; S.fog.far = lerp(220, 40, seg(lt, D * .3, D));
    dust.visible = true; DUST.forEach((s, i) => { const lag = hash(i + 7) * 40; s.position.set(front - lag + Math.sin(t * 3 + i) * 2, hash(i + 8) * 40, -hash(i + 9) * 80 + 6); s.material.opacity = .55 * clamp((front - lag + 60) / 30); s.material.rotation = hash(i) * 6 + t * (hash(i + 2) - .5); });
    debris.visible = true; DEB.forEach((m, i) => { m.visible = i < 70; const sp = 30 + hash(i) * 30; m.position.set(Math.min(front + 5, -30 + ((lt * sp + hash(i + 1) * 60) % 60)), .5 + hash(i + 2) * 20, -2 - hash(i + 3) * 40); m.rotation.set(lt * 6, lt * 4, lt * 9 * hash(i + 5)); });
    trees.forEach((tr, i) => { const bend = clamp((front - tr.position.x + 10) / 20); tr.rotation.z = -bend * .6 - Math.sin(t * 9 + i) * .08 * bend; });
    look(-4, 3, 14, 0, 7, -20, 50, 16); shake(.04 * clamp((front + 10) / 30), t); P.dof.aper = .8; P.vig.uniforms.warm.value = .3;
    title('УРАГАН', 290, seg(lt, .4, 1.1), 130, { w: 500 }); label('БЫСТРЕЕ ЗВУКА', 540, 410, seg(lt, D * .45, D * .45 + .8), 60, '#ffd8a8'); },
  wave(lt, D, t) { SETS.coast.visible = true; const sk = coastSky.material.uniforms; sk.a.value.set('#2a3a50'); sk.b.value.set('#8a9aa8'); sk.c.value.set('#6a7a80'); sk.sw.value = 0; sk.ss.value = .4; sk.sd.value.set(-.3, .3, -1).normalize(); waveMat.uniforms.tm.value = t;
    const k = eio(seg(lt, 0, D * .8)), wz = lerp(-220, -90, eio(seg(lt, 0, D))); waveShape(t, .55 + .45 * k); wave.position.z = wz; sprayAt(t, wz, .55 + .45 * k);
    keyAt(-40, 60, -100, 0, 0, 0, 1.6, '#e0e8f0'); amb.intensity = .6; amb.color.set('#a8b8c8'); S.fog = new THREE.Fog('#7a8a98', 60, 500);
    look(2, 2, 34, 0, 20, -60, 52, 90); shake(.03 * k, t); P.dof.aper = .5;
    title('ГИГАНТСКИЕ', 290, seg(lt, .4, 1.1), 110, { w: 500 }); title('ВОЛНЫ', 410, seg(lt, .7, 1.4), 130); },
  calm(lt, D, t) { SETS.polar.visible = true; explorer.visible = false; poleM.visible = false; aurora.visible = false; snowGround.material.color.set('#ffffff'); const sk = polarSky.material.uniforms; sk.a.value.set('#5a8ad0'); sk.b.value.set('#d8e8f6'); sk.c.value.set('#ffffff'); sk.sd.value.set(.6, .12, -1).normalize(); sk.ss.value = 1; sk.st.value = 0;
    snowfall.visible = true; snowAt(t, .8, .1); keyAt(60, 15, -100, 0, 0, 0, 2.2, '#ffe8d0'); amb.intensity = .8; amb.color.set('#d0e0ff'); amb.groundColor.set('#a0b0c8'); S.fog = new THREE.Fog('#dce8f4', 60, 600);
    const u = eio(lt / D); look(0, lerp(9, 6, u), lerp(30, 20, u), 0, 3, -60, 44, 60); P.dof.aper = .3;
    title('НО ЕСТЬ МЕСТО…', 290, seg(lt, .4, 1.2), 96, { w: 500 }); label('где вы уцелеете', 540, 400, seg(lt, D * .5, D * .5 + .8), 52, '#ffffff'); },
  pole(lt, D, t) { SETS.polar.visible = true; explorer.visible = true; poleM.visible = true; aurora.visible = false; const sk = polarSky.material.uniforms; sk.a.value.set('#4a7ac8'); sk.b.value.set('#d0e2f4'); sk.c.value.set('#ffffff'); sk.sd.value.set(-.5, .1, -1).normalize(); sk.ss.value = 1; sk.st.value = 0;
    const gy = snowHF(0, 0); poleM.position.set(.9, gy, -.3); explorer.position.set(-.3, gy, 0); explorer.rotation.set(0, .3, 0); explorer.userData.arms[1].rotation.set(-.3, 0, .9); explorer.userData.head.rotation.set(.05, -.2, 0);
    const fp = flagCloth.geometry.attributes.position; if (!flagCloth.userData.b) flagCloth.userData.b = fp.array.slice(); const b = flagCloth.userData.b; for (let i = 0; i < fp.count; i++) { const x = b[i * 3] + .45; fp.setZ(i, Math.sin(x * 6 - t * 5) * .06 * x); } fp.needsUpdate = true; flagCloth.geometry.computeVertexNormals();
    snowfall.visible = true; snowAt(t, 1.2, .5); keyAt(-40, 12, -60, 0, 0, 0, 2.4, '#ffe8d0'); rimAt(30, 10, 40, 0, 0, 0, .8, '#a0c0ff'); amb.intensity = .7; amb.color.set('#d0e0ff'); amb.groundColor.set('#a0b0c8'); S.fog = new THREE.Fog('#dce8f4', 40, 500);
    const u = eio(lt / D); look(lerp(1.2, .6, u), gy + 1.5, lerp(5.4, 4.6, u), .2, gy + 1.45, 0, 38, 4.7); P.dof.aper = 3;
    title('ПОЛЮСА', 290, seg(lt, .4, 1.1), 130, { w: 500 }); label('СКОРОСТЬ ≈ 0', 540, 410, seg(lt, D * .45, D * .45 + .8), 64, '#ffffff'); },
  half(lt, D, t) { spaceScene(new THREE.Vector3(1, 0, 0)); earth.rotation.set(0, 2.4, .41); const a = lerp(.35, .05, eio(lt / D)); look(Math.sin(a) * 4.3, .4, Math.cos(a) * 4.3, 0, -.1, 0, 40, 4.3); P.dof.aper = .2; key.intensity = 3.4;
    title('А ЕСЛИ', 290, seg(lt, .4, 1.1), 120, { w: 500 }); title('ОНА НЕ ЗАКРУТИТСЯ?', 410, seg(lt, .8, 1.5), 74); },
  year(lt, D, t) { SETS.desert.visible = true; const sk = desertSky.material.uniforms; sk.a.value.set('#4a7ab0'); sk.b.value.set('#f0d8a8'); sk.c.value.set('#e8c890'); sk.sd.value.set(0, .55, -1).normalize(); sk.ss.value = .8; sk.sw.value = 0;
    desertSun.position.copy(sk.sd.value).multiplyScalar(800); keyAt(0, 50, -80, 0, 0, 0, 3.2, '#fff0d0'); amb.intensity = .8; amb.color.set('#ffe0b0'); amb.groundColor.set('#a87848'); S.fog = new THREE.Fog('#f0d8a8', 80, 700);
    skull.position.set(3, -3.6, -6); skull.rotation.set(0, .8, .2); heat.visible = true; { const a = heat.geometry.attributes.position; for (let i = 0; i < 800; i++) a.setXYZ(i, (hash(i) - .5) * 60, -3 + ((hash(i + 1) * 10 + t * 1.5) % 10), -hash(i + 2) * 60); a.needsUpdate = true; }
    const u = eio(lt / D); look(0, lerp(-1.5, -2.2, u), lerp(8, 6, u), 0, 6, -60, 46, 12); P.dof.aper = .6; P.vig.uniforms.warm.value = .35; P.bloom.strength = .8;
    title('1 ДЕНЬ', 290, seg(lt, D * .3, D * .3 + .7), 130, { w: 500, glow: 'rgba(90,40,0,.95)' }); title('= 1 ГОД', 420, seg(lt, D * .45, D * .45 + .7), 120, { glow: 'rgba(90,40,0,.95)' }); },
  night(lt, D, t) { const sw = D * .38; if (lt < sw) { SETS.desert.visible = true; const sk = desertSky.material.uniforms; sk.a.value.set('#5a80b0'); sk.b.value.set('#ffe0a0'); sk.c.value.set('#f0c080'); sk.sd.value.set(.2, .5, -1).normalize(); sk.ss.value = 1.8;
      desertSun.position.copy(sk.sd.value).multiplyScalar(800); keyAt(10, 50, -80, 0, 0, 0, 3.4, '#ffe0b0'); amb.intensity = .8; amb.color.set('#ffd0a0'); amb.groundColor.set('#a87848'); S.fog = new THREE.Fog('#f8d8a0', 50, 600); skull.position.set(-3, -3.6, -8); heat.visible = false;
      look(-1, -1, 9 - lt * .4, 0, 4, -60, 44, 12); P.vig.uniforms.warm.value = .5; P.bloom.strength = .9;
      title('ПОЛГОДА', 290, seg(lt, .3, .9), 120, { w: 500, glow: 'rgba(255,140,40,.9)' }); label('ПАЛЯЩЕЕ СОЛНЦЕ', 540, 400, seg(lt, .5, 1.1), 56, '#ffd090');
      if (lt > sw - .3) { c2.fillStyle = `rgba(255,255,255,${seg(lt, sw - .3, sw)})`; c2.fillRect(0, 0, W, H); } }
    else { const l2 = lt - sw; SETS.polar.visible = true; explorer.visible = false; poleM.visible = false; aurora.visible = true; aurora.children.forEach(a => { a.material.uniforms.tm.value = t; a.material.uniforms.k.value = eio(seg(l2, .3, 1.5)); });
      snowGround.material.color.set('#7a9ac8'); const sk = polarSky.material.uniforms; sk.a.value.set('#010308'); sk.b.value.set('#0a1830'); sk.c.value.set('#0a1424'); sk.ss.value = 0; sk.st.value = 1.4;
      snowfall.visible = true; snowAt(t, .5, .6); keyAt(-40, 30, -60, 0, 0, 0, .5, '#8ab0ff'); amb.intensity = .25; amb.color.set('#4a6aaa'); amb.groundColor.set('#0a1020'); S.fog = new THREE.Fog('#0a1424', 80, 700);
      look(0, 6, 22 - l2 * .5, 0, 20, -100, 46, 80); P.dof.aper = .3; P.vig.uniforms.sat.value = .9; P.bloom.strength = .8;
      if (l2 < .4) { c2.fillStyle = `rgba(255,255,255,${1 - seg(l2, 0, .4)})`; c2.fillRect(0, 0, W, H); }
      title('ПОЛГОДА', 290, seg(l2, .3, .9), 120, { w: 500, glow: 'rgba(80,140,255,.9)' }); label('ЛЕДЯНАЯ НОЧЬ', 540, 400, seg(l2, .5, 1.1), 56, '#cfe2ff'); } },
  continent(lt, D, t) { spaceScene(new THREE.Vector3(-.6, .4, 1)); earth.rotation.set(.1, 1.0 + lt * .12, .0); contBall.visible = true; const k = eio(seg(lt, D * .2, D * .75)); contBall.material.opacity = k; clouds.material.opacity = 1 - k * .7;
    const u = eio(lt / D); look(0, lerp(.8, 1.1, u), lerp(4.4, 4.0, u), 0, -.1, 0, 40, 4.0); P.dof.aper = .2;
    title('ОДИН', 290, seg(lt, D * .45, D * .45 + .7), 120, { w: 500 }); title('ОГРОМНЫЙ МАТЕРИК', 410, seg(lt, D * .55, D * .55 + .7), 78); },
  good(lt, D, t) { spaceScene(new THREE.Vector3(-1, .25, .7)); clouds.material.opacity = 1; earth.rotation.set(0, 2.2 + lt * SPIN * .3, .41); clouds.rotation.y = lt * .03;
    const u = eio(lt / D); look(lerp(-.4, .2, u), .2, lerp(4.6, 4.0, u), 0, -.1, 0, 40, 4.0); P.dof.aper = .2;
    title('ЭТОГО', 290, seg(lt, D * .45, D * .45 + .7), 120, { w: 500, glow: 'rgba(90,170,255,.9)' }); title('НЕ СЛУЧИТСЯ', 410, seg(lt, D * .55, D * .55 + .7), 104, { glow: 'rgba(90,170,255,.9)' }); },
  sub(lt, D, t) { const sd = new THREE.Vector3(0, -.02 + .1 * eio(seg(lt, 0, D * .8)), -1).normalize(); spaceScene(sd); clouds.material.opacity = 1; earth.scale.setScalar(10); earth.position.set(0, -10.35, -1); earth.rotation.set(.4, 1.5 + lt * .02, 0);
    look(0, .2, 3, 0, .2, -10, 40, 30); P.dof.aper = .1; P.bloom.strength = 1.1; P.bloom.threshold = .7; sunG.scale.setScalar(lerp(.5, 1, eio(seg(lt, 0, D))));
    title('ФАКТЫ', 300, seg(lt, .5, 1.3), 150, { w: 500, glow: 'rgba(255,170,80,.9)' }); title('ЗА МИНУТУ', 440, seg(lt, .8, 1.6), 92, { glow: 'rgba(255,170,80,.9)' }); label('ПОДПИСЫВАЙТЕСЬ', 540, 1350, seg(lt, 1.3, 2), 56, '#ffe0a0'); },
};

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c2.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SHOW = s => s.replace('тысячи шестисот семидесяти километров в час', '1 670 км/ч');
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
  hideAll(t); c2.clearRect(0, 0, W, H);
  SH[s.name](lt, D, t);
  if (SETS.space.visible) sunG.quaternion.copy(cam.quaternion);
  const fin = seg(lt, 0, .3), fout = 1 - seg(lt, D - .25, D); P.vig.uniforms.fade.value *= Math.min(k ? fin : seg(lt, 0, .5), k === SC.length - 1 ? 1 : fout) * .999 + .001;
  P.composer.render();
  c2.save(); c2.globalAlpha = .04; for (let i = 0; i < 900; i++) { const x = hash(i + Math.floor(t * 24) * 13.1) * W, y = hash(i * 7.3 + Math.floor(t * 24)) * H; c2.fillStyle = i % 2 ? '#fff' : '#000'; c2.fillRect(x, y, 2, 2); } c2.restore();
  subs(t);
  if (t > TL.DUR - .8) { c2.fillStyle = `rgba(0,0,0,${seg(t, TL.DUR - .8, TL.DUR)})`; c2.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const X = Object.fromEntries(SC.map(s => [s.name, s])), at = (n, dt) => X[n].t0 + dt, dur = n => X[n].t1 - X[n].t0;
  add('hum', at('frozen', 0), { d: dur('frozen') * .42 }); add('stop', at('frozen', dur('frozen') * .42)); add('drone', at('worst', 0), { d: dur('worst') }); add('hit', at('worst', .4));
  add('whoosh', at('speed', 0), { d: dur('speed') }); add('rise', at('equator', 0), { d: dur('equator') }); add('hit', at('equator', dur('equator') * .4)); add('jet', at('plane', 0), { d: dur('plane') });
  add('boom', at('lift', dur('lift') * .2)); add('rumble', at('lift', dur('lift') * .2), { d: dur('lift') * .8 + dur('chaos') }); add('debris', at('chaos', 0), { d: dur('chaos') });
  add('storm', at('storm', 0), { d: dur('storm') }); add('boom', at('storm', dur('storm') * .45), { v: .7 }); add('surf', at('wave', 0), { d: dur('wave') }); add('boom', at('wave', dur('wave') * .8));
  add('wind', at('calm', 0), { d: dur('calm') + dur('pole') }); add('chime', at('calm', .3)); add('hit', at('pole', .4), { v: .6 }); add('drone', at('half', 0), { d: dur('half') });
  add('heat', at('year', 0), { d: dur('year') + dur('night') * .38 }); add('hit', at('year', dur('year') * .3)); add('swap', at('night', dur('night') * .38)); add('wind', at('night', dur('night') * .38), { d: dur('night') * .62, cold: 1 });
  add('rise', at('continent', 0), { d: dur('continent') }); add('chime', at('good', dur('good') * .45)); add('swell', at('sub', 0), { d: dur('sub') }); add('boom', at('sub', .5), { v: .6 });
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('500 90px Oswald', 'ЗЕМЛЯ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
