// «Эйфелева башня растёт летом» — cute 3D cartoon short (vertical 1080×1920), three.js rendered headless
import * as THREE from '/node_modules/three/build/three.module.js';
import { M, mats, tower, tree, cloud, house, person, face } from './world.js';

const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ———————————————————————————— timeline
const LINES = [
  ['summer', 'Летом Эйфелева башня становится выше!'], ['physics', 'И это не шутка, а чистая физика.'], ['iron', 'Башня сделана из железа.'],
  ['expand', 'А металл от жары расширяется.'], ['grow', 'Поэтому летом она вырастает примерно на 15 сантиметров.'], ['winter', 'А зимой от холода снова становится ниже.'],
  ['tilt', 'В солнечный день она даже немного наклоняется — в сторону от солнца.'], ['wind', 'А в сильный ветер её верхушка качается на несколько сантиметров.'],
  ['height', 'Сегодня высота башни — около 330 метров.'], ['build', 'Её построили всего за два года.'], ['expo', 'К 1889 году — для Всемирной выставки в Париже.'],
  ['eiffel', 'Проект создала компания инженера Гюстава Эйфеля.'], ['liberty', 'Кстати, он же сделал внутренний каркас Статуи Свободы!'],
  ['hate', 'Но многие парижане башню ненавидели.'], ['artists', 'Художники и писатели называли её уродливой.'], ['dismantle', 'Башню хотели разобрать уже через 20 лет.'],
  ['radio', 'Её спасло радио — на ней установили антенны.'], ['tallest', 'Больше 40 лет она была самым высоким сооружением в мире.'],
  ['rivets', 'В ней около 2,5 миллиона заклёпок.'], ['paint', 'Каждые 7 лет её перекрашивают вручную.'], ['buckets', 'И уходит на это около 60 тонн краски!'],
  ['tourists', 'Сегодня на неё поднимаются миллионы туристов каждый год.'], ['newspaper', 'А ведь когда-то её считали ошибкой.'], ['sub', 'Подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = null;           // [[start, end], …] once the voiceover arrives
const VOICE_OFFSET = 0.4, BPM = 112, BEAT = 60 / BPM;
const snapB = t => Math.round(t / BEAT) * BEAT;
const TL = (() => {
  const spans = VOICE || (() => { let t = 0; return LINES.map(l => { const d = l.text.length / 14; const s = [t, t + d]; t += d + .55; return s; }); })();
  const on = spans.map(s => s[0] + VOICE_OFFSET), starts = on.map((x, i) => i ? snapB(x - .25) : 0);
  const end = snapB(spans[spans.length - 1][1] + VOICE_OFFSET + 3.0);
  return { SC: LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end })), VO: LINES.map((l, i) => ({ ...l, t: on[i], d: spans[i][1] - spans[i][0] })), DUR: end };
})();
const { SC, VO } = TL;
const sceneIdx = t => { let k = 0; SC.forEach((s, i) => { if (t >= s.t0) k = i; }); return k; };

// ———————————————————————————— renderer + overlay
const gl = document.getElementById('gl'), ov = document.getElementById('ov'), c2 = ov.getContext('2d');
const R = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
R.setSize(W, H, false); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace; R.localClippingEnabled = true;
mats();
const S = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, W / H, .5, 6000);
// sky dome with a gradient
const skyU = { top: { value: new THREE.Color('#4fa8f0') }, bot: { value: new THREE.Color('#cdeeff') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top, bot; varying float h; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(-.05, .55, h)), 1.); }' }));
S.add(sky);
const hemi = new THREE.HemisphereLight('#d8eeff', '#7a9a5a', 1.25); S.add(hemi);
const sun = new THREE.DirectionalLight('#fff2d8', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; S.add(sun); S.add(sun.target);
function fitSun(cx, cy, cz, r, dir = [1, 1.6, 1.2]) { const L = Math.hypot(...dir); sun.position.set(cx + dir[0] / L * r * 3, cy + dir[1] / L * r * 3, cz + dir[2] / L * r * 3); sun.target.position.set(cx, cy, cz); Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 7 }); sun.shadow.camera.updateProjectionMatrix(); }
const fog = new THREE.Fog('#cdeeff', 600, 2600); S.fog = fog;
const SEASON = {
  summer: { top: '#3f9cf0', bot: '#cdeeff', hemi: ['#d8eeff', '#7a9a5a', 1.25], sun: ['#fff2d8', 2.7], fog: '#cdeeff', exp: 1.05 },
  winter: { top: '#2a3f7a', bot: '#9fb8e6', hemi: ['#b8ccff', '#6a7aa8', 1.1], sun: ['#c8d8ff', 1.3], fog: '#9fb8e6', exp: 1.0 },
  sunset: { top: '#5a5aa8', bot: '#ffb070', hemi: ['#ffd0b0', '#6a5a7a', 1.0], sun: ['#ffae6a', 2.4], fog: '#ffb88a', exp: 1.05 },
  vintage: { top: '#a8b8c8', bot: '#f0e0c0', hemi: ['#fff0d8', '#9a8a6a', 1.3], sun: ['#ffe8c0', 2.2], fog: '#f0e0c0', exp: 1.0 },
  storm: { top: '#5a6a8a', bot: '#b8c8d8', hemi: ['#d0dae8', '#6a7a6a', 1.2], sun: ['#ffffff', 1.6], fog: '#b8c8d8', exp: 1.0 },
  studio: { top: '#ffd6e8', bot: '#fff4d8', hemi: ['#ffffff', '#c8b8a8', 1.5], sun: ['#fff4e0', 2.2], fog: '#fff4d8', exp: 1.0 },
};
function season(n) { const s = SEASON[n]; skyU.top.value.set(s.top); skyU.bot.value.set(s.bot); hemi.color.set(s.hemi[0]); hemi.groundColor.set(s.hemi[1]); hemi.intensity = s.hemi[2]; sun.color.set(s.sun[0]); sun.intensity = s.sun[1]; fog.color.set(s.fog); R.toneMappingExposure = s.exp; }

// ———————————————————————————— sets
const SETS = {};
function set(name) { const g = new THREE.Group(); g.name = name; S.add(g); SETS[name] = g; return g; }
// Paris at the Champ de Mars (origin)
const paris = set('paris');
const ground = new THREE.Mesh(new THREE.CircleGeometry(2400, 48), M.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; paris.add(ground);
const pathM = new THREE.Mesh(new THREE.PlaneGeometry(60, 900), M.path); pathM.rotation.x = -Math.PI / 2; pathM.position.set(0, .05, 380); pathM.receiveShadow = true; paris.add(pathM);
const seine = new THREE.Mesh(new THREE.PlaneGeometry(3000, 140), M.water); seine.rotation.x = -Math.PI / 2; seine.position.set(0, .1, -260); paris.add(seine);
const T0 = tower(); paris.add(T0);
const trees = []; for (let k = 0; k < 16; k++) { const t = tree(2.4, k); t.position.set(-210 + (k % 8) * 60, 0, k < 8 ? 140 : -130); paris.add(t); trees.push(t); }
for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2, r = 520 + (k % 3) * 70, h = house(40 + (k % 4) * 8, 36 + (k % 3) * 10, 34, k); h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); h.lookAt(0, 0, 0); h.scale.setScalar(1); paris.add(h); }
const clouds = []; for (let k = 0; k < 6; k++) { const c = cloud(2.4 + (k % 3) * .6); c.position.set(-600 + k * 260, 360 + (k % 2) * 80, -500 - (k % 3) * 120); paris.add(c); clouds.push(c); }
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), new THREE.MeshBasicMaterial({ color: '#ffe066', fog: false })); paris.add(sunBall); sunBall.visible = false;
// second tower for the winter/summer comparison
const T1 = tower(); T1.visible = false; paris.add(T1);
const snowCaps = []; for (const T of [T0, T1]) { const caps = new THREE.Group(); for (const [h, w] of [[59, 102], [118, 50], [278, 12]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(w, 2, w), M.snow); s.position.y = h; caps.add(s); } caps.visible = false; T.add(caps); snowCaps.push(caps); }
const snowGround = new THREE.Mesh(new THREE.CircleGeometry(2400, 48), M.snow); snowGround.rotation.x = -Math.PI / 2; snowGround.position.y = .2; snowGround.receiveShadow = true; snowGround.visible = false; paris.add(snowGround);
// snow particles
const snowGeo = new THREE.BufferGeometry(), SN = 1600, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { sp[i * 3] = (hash(i) - .5) * 900; sp[i * 3 + 1] = hash(i + 7) * 500; sp[i * 3 + 2] = (hash(i + 13) - .5) * 900 + 200; }
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 3.2, fog: false })); snow.visible = false; paris.add(snow);
// measuring bar (330 m)
const ruler = new THREE.Group(); for (let k = 0; k < 33; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 6), k % 2 ? M.red : M.white); b.position.y = k * 10 + 5; ruler.add(b); } ruler.position.set(95, 0, 40); ruler.visible = false; paris.add(ruler);
// wind streaks
const winds = []; for (let k = 0; k < 18; k++) { const w = new THREE.Mesh(new THREE.BoxGeometry(60 + k % 4 * 20, .8, .8), M.white); w.visible = false; paris.add(w); winds.push(w); }
// construction: cranes + workers
const cranes = []; for (let k = 0; k < 2; k++) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(3, 60, 3), M.yellow); m.position.y = 30; g.add(m); const j = new THREE.Mesh(new THREE.BoxGeometry(50, 2.4, 2.4), M.yellow); j.position.set(20, 60, 0); g.add(j); const h = new THREE.Mesh(new THREE.BoxGeometry(.6, 20, .6), M.black); h.position.set(40, 50, 0); g.add(h); g.visible = false; paris.add(g); cranes.push(g); }
// radio rings
const rings = []; for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(10, .9, 8, 48), new THREE.MeshBasicMaterial({ color: '#66e0ff', transparent: true, fog: false })); r.rotation.x = Math.PI / 2; r.visible = false; paris.add(r); rings.push(r); }
// golden crown
const crown = new THREE.Group(); { const b = new THREE.Mesh(new THREE.TorusGeometry(14, 3, 12, 32), M.gold); b.rotation.x = Math.PI / 2; crown.add(b); for (let k = 0; k < 8; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 10), M.gold); const a = k / 8 * Math.PI * 2; c.position.set(Math.cos(a) * 14, 7, Math.sin(a) * 14); crown.add(c); const gem = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), k % 2 ? M.red : M.blue); gem.position.set(Math.cos(a) * 14, 14, Math.sin(a) * 14); crown.add(gem); } }
crown.visible = false; paris.add(crown);
// paint buckets pile
const buckets = new THREE.Group(); { const cols = [M.red, M.blue, M.yellow, M.green, M.purple, M.orange]; let k = 0; for (let ly = 0; ly < 6; ly++) for (let i = 0; i < 7 - ly; i++) for (let j = 0; j < 7 - ly; j++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2, 4, 14), M.grey); b.position.set((i - (6 - ly) / 2) * 4.8, 2 + ly * 4.2, (j - (6 - ly) / 2) * 4.8); b.castShadow = true; buckets.add(b); const lid = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, .5, 14), cols[k++ % 6]); lid.position.copy(b.position); lid.position.y += 2.2; buckets.add(lid); } }
buckets.position.set(60, 0, 80); buckets.visible = false; paris.add(buckets);
// people pools
const crowdShirts = [M.red, M.blue, M.yellow, M.green, M.purple, M.orange];
function mkCrowd(n, o = {}) { const L = []; for (let i = 0; i < n; i++) { const p = person({ shirt: crowdShirts[i % 6], hat: o.hat ? o.hat(i) : (i % 4 === 0 ? 'top' : i % 4 === 1 ? 'beret' : null), hair: i % 3 === 2 ? M.brown : null, skin: i % 3 === 1 ? M.skin2 : M.skin, size: o.size || 3 }); p.visible = false; paris.add(p); L.push(p); } return L; }
const crowd = mkCrowd(18), workers = mkCrowd(6, { hat: () => 'hard', size: 3 }), painters = mkCrowd(8, { hat: () => 'hard', size: 1.6 }), tourists = mkCrowd(18, { hat: i => i % 5 === 0 ? 'beret' : null });
const signs = []; for (let k = 0; k < 6; k++) { const tx = textTex(['НЕТ!', 'УРОДЛИВА!', 'ДОЛОЙ!', 'ФУ!', 'НЕТ БАШНЕ!', 'УЖАС!'][k], '#e8453c', '#fff8e8', 512, 256, 110); const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshStandardMaterial({ map: tx, roughness: .9 })); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 6, 6), M.trunk); pole.position.y = -3; s.add(pole); s.visible = false; paris.add(s); signs.push(s); }
const cameras = tourists.map(() => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.9, .6, .4), M.black); g.add(b); const fl = new THREE.Mesh(new THREE.SphereGeometry(.35, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, fog: false })); fl.position.set(.25, .1, .25); g.add(fl); g.userData.fl = fl; return g; });
tourists.forEach((p, i) => { p.userData.arms[1].add(cameras[i]); cameras[i].position.set(0, -.95 * 3, .4); cameras[i].scale.setScalar(3); });
const ropes = painters.map(() => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1, 6), M.black); r.visible = false; paris.add(r); return r; });
// calendar
const calTex = canvasTex(512, 640); const calendar = new THREE.Mesh(new THREE.BoxGeometry(14, 17.5, 1.2), [M.paper, M.paper, M.paper, M.paper, new THREE.MeshStandardMaterial({ map: calTex.tex, roughness: .9 }), M.paper]); calendar.visible = false; paris.add(calendar);

// close-up set: beams and rivets (far away from Paris)
const close = set('close'); close.position.set(8000, 0, 0);
const beamMat = new THREE.MeshStandardMaterial({ color: '#9a6440', roughness: .5 });
const beams = new THREE.Group(); close.add(beams);
function ibeam(L) { const g = new THREE.Group(); const web = new THREE.Mesh(new THREE.BoxGeometry(L, 6, 1), beamMat); g.add(web); for (const y of [-3, 3]) { const f = new THREE.Mesh(new THREE.BoxGeometry(L, .9, 5), beamMat); f.position.y = y; g.add(f); } g.traverse(m => { m.castShadow = m.receiveShadow = true; }); return g; }
const bA = ibeam(80); beams.add(bA); const bB = ibeam(70); bB.rotation.z = Math.PI / 4; beams.add(bB); const bC = ibeam(70); bC.rotation.z = -Math.PI / 4; beams.add(bC);
const plate = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 1.6), beamMat); plate.position.z = 1.4; plate.castShadow = true; beams.add(plate);
const rivGeo = new THREE.SphereGeometry(.55, 12, 8), RV = 900, rivets = new THREE.InstancedMesh(rivGeo, beamMat, RV); { const m = new THREE.Matrix4(); let i = 0; for (const [b, L] of [[bA, 80], [bB, 70], [bC, 70]]) for (let x = -L / 2 + 1.5; x < L / 2 && i < RV; x += 2.2) for (const y of [-3, 3]) { const p = new THREE.Vector3(x, y, 2.6).applyEuler(b.rotation); m.makeTranslation(p.x, p.y, p.z); rivets.setMatrixAt(i++, m); } for (let x = -6; x <= 6; x += 2) for (let y = -6; y <= 6; y += 2) { if (i < RV) { m.makeTranslation(x, y, 2.4); rivets.setMatrixAt(i++, m); } } rivets.count = i; }
rivets.castShadow = true; beams.add(rivets);
const closeBg = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#9fd6ff', roughness: 1 })); closeBg.position.z = -60; close.add(closeBg);
const heat = []; for (let k = 0; k < 7; k++) { const g = new THREE.PlaneGeometry(4, 26, 1, 16); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * .5) * 1.4); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffb070', transparent: true, opacity: .5, side: THREE.DoubleSide, fog: false })); close.add(m); heat.push(m); }
const arrows = []; for (const s of [-1, 1]) { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 10, 10), M.red); sh.rotation.z = Math.PI / 2; g.add(sh); const hd = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 12), M.red); hd.rotation.z = -s * Math.PI / 2; hd.position.x = s * 6.5; g.add(hd); g.userData.s = s; close.add(g); arrows.push(g); }

// statue set
const statue = set('statue'); statue.position.set(-8000, 0, 0);
{ const ped = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshStandardMaterial({ color: '#d8cbb0', roughness: .9 })); ped.position.y = 20; ped.castShadow = ped.receiveShadow = true; statue.add(ped);
  const sg = new THREE.Mesh(new THREE.CircleGeometry(600, 32), M.grass); sg.rotation.x = -Math.PI / 2; sg.receiveShadow = true; statue.add(sg);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(2400, 32), M.water); sea.rotation.x = -Math.PI / 2; sea.position.y = -.5; statue.add(sea);
  const frame = tower({ mat: M.iron, mat2: M.iron }); frame.scale.set(.16, .2, .16); frame.position.y = 40; statue.add(frame);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(7, 14, 52, 20), M.statue); robe.position.y = 66; statue.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 16), M.statue); head.position.y = 98; statue.add(head);
  for (let k = 0; k < 7; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(.9, 6, 8), M.statueSolid); const a = -Math.PI / 2 + (k - 3) * .4; sp.position.set(Math.cos(a) * 6, 104, Math.sin(a) * 6 + 2); sp.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); statue.add(sp); }
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 30, 10), M.statue); arm.position.set(9, 108, 0); arm.rotation.z = -.25; statue.add(arm);
  const torch = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 14), M.gold); torch.position.set(13, 126, 0); torch.rotation.x = Math.PI; statue.add(torch);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffb040' })); flame.position.set(13, 132, 0); statue.add(flame); }

// desk set: the engineer and his blueprint
const desk = set('desk'); desk.position.set(0, 0, 8000);
const room = new THREE.Mesh(new THREE.BoxGeometry(80, 60, 80), new THREE.MeshStandardMaterial({ color: '#f2d8b0', roughness: 1, side: THREE.BackSide })); room.position.y = 30; room.receiveShadow = true; desk.add(room);
const table = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 14), new THREE.MeshStandardMaterial({ color: '#a86a3a', roughness: .6 })); table.position.y = 8; table.castShadow = table.receiveShadow = true; desk.add(table);
for (const [x, z] of [[-12, -6], [12, -6], [-12, 6], [12, 6]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), table.material); l.position.set(x, 4, z); desk.add(l); }
const bpTex = canvasTex(1024, 640); drawBlueprint(bpTex); const blueprint = new THREE.Mesh(new THREE.PlaneGeometry(20, 12.5), new THREE.MeshStandardMaterial({ map: bpTex.tex, roughness: .8 })); blueprint.rotation.x = -Math.PI / 2; blueprint.position.set(0, 8.85, 0); blueprint.receiveShadow = true; desk.add(blueprint);
const eng = person({ shirt: M.black, hat: 'top', mustache: true, size: 6.5 }); eng.position.set(0, 0, -10); desk.add(eng);
const lampL = new THREE.PointLight('#ffd8a0', 300, 80); lampL.position.set(-10, 26, 4); desk.add(lampL);

// newspaper set
const newsTex = canvasTex(900, 1200); drawNews(newsTex);
const news = new THREE.Mesh(new THREE.PlaneGeometry(36, 48), new THREE.MeshStandardMaterial({ map: newsTex.tex, roughness: .95, side: THREE.DoubleSide })); const newsSet = set('news'); newsSet.position.set(0, 0, -8000); newsSet.add(news);
const newsBg = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#f6c86a', roughness: 1 })); newsBg.position.z = -40; newsSet.add(newsBg);

// ———————————————————————————— canvas textures
function canvasTex(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return { c, g: c.getContext('2d'), tex }; }
function textTex(txt, col, bg, w, h, size) { const t = canvasTex(w, h); t.g.fillStyle = bg; t.g.fillRect(0, 0, w, h); t.g.strokeStyle = col; t.g.lineWidth = 16; t.g.strokeRect(8, 8, w - 16, h - 16); t.g.font = `900 ${size}px Nunito`; t.g.textAlign = 'center'; t.g.textBaseline = 'middle'; t.g.fillStyle = col; t.g.fillText(txt, w / 2, h / 2 + 6); return t.tex; }
function drawBlueprint(t) { const g = t.g, w = t.c.width, h = t.c.height; g.fillStyle = '#2c5fa8'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; const cx = 360, by = 600, th = 540; g.beginPath(); for (const s of [-1, 1]) { g.moveTo(cx + s * 180, by); g.quadraticCurveTo(cx + s * 60, by - 200, cx + s * 8, by - th); } g.stroke();
  for (const [hh, ww] of [[150, 130], [300, 60], [480, 22]]) { g.beginPath(); g.moveTo(cx - ww, by - hh); g.lineTo(cx + ww, by - hh); g.stroke(); }
  g.beginPath(); g.arc(cx, by, 110, Math.PI, 0); g.stroke(); g.font = '800 44px Nunito'; g.fillStyle = '#ffffff'; g.fillText('300 m', 640, 120); g.font = '700 32px Nunito'; g.fillText('PROJET · 1884', 640, 180); g.strokeRect(600, 420, 360, 160); g.fillText('ÉCHELLE 1:500', 640, 510); t.tex.needsUpdate = true; }
function drawNews(t) { const g = t.g, w = t.c.width, h = t.c.height; g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2420'; g.font = '900 96px Nunito'; g.textAlign = 'center'; g.fillText('LE JOURNAL', w / 2, 120); g.fillRect(40, 150, w - 80, 8); g.font = '700 40px Nunito'; g.fillText('PARIS · 1887', w / 2, 210);
  g.font = '900 80px Nunito'; g.fillText('ОШИБКА?', w / 2, 330);
  g.strokeStyle = '#2a2420'; g.lineWidth = 8; const cx = 330, by = 1080; g.beginPath(); for (const s of [-1, 1]) { g.moveTo(cx + s * 170, by); g.quadraticCurveTo(cx + s * 50, by - 300, cx + s * 6, by - 620); } g.stroke(); for (const [hh, ww] of [[220, 120], [420, 50]]) { g.beginPath(); g.moveTo(cx - ww, by - hh); g.lineTo(cx + ww, by - hh); g.stroke(); }
  g.font = '900 420px Nunito'; g.fillStyle = '#e8453c'; g.fillText('?', 690, 900); g.fillStyle = 'rgba(42,36,32,.55)'; for (let k = 0; k < 12; k++) g.fillRect(560, 420 + k * 22 + (k > 5 ? 60 : 0), 280 - (k % 3) * 40, 10); t.tex.needsUpdate = true; }
function drawCalendar(year) { const g = calTex.g, w = 512, h = 640; g.fillStyle = '#fff8ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8453c'; g.fillRect(0, 0, w, 170); g.fillStyle = '#ffffff'; g.font = '900 96px Nunito'; g.textAlign = 'center'; g.fillText('ГОД', w / 2, 125); g.fillStyle = '#2a2420'; g.font = '900 170px Nunito'; g.fillText(String(year), w / 2, 430); g.font = '800 54px Nunito'; g.fillStyle = '#8a7a6a'; g.fillText('+' + (year - 1889) + ' лет', w / 2, 560); calTex.tex.needsUpdate = true; }

// ———————————————————————————— overlay type
function txt(s, x, y, size, o = {}) {
  const a = o.a ?? 1; if (a <= 0) return;
  c2.save(); c2.globalAlpha = a; c2.translate(x, y); const sc = o.sc ?? 1; c2.scale(sc, sc); c2.rotate(o.rot || 0);
  c2.font = `${o.w || 900} ${size}px Nunito`; c2.textAlign = o.align || 'center'; c2.textBaseline = 'middle'; c2.lineJoin = 'round';
  c2.shadowColor = 'rgba(30,20,60,.35)'; c2.shadowOffsetY = size * .08; c2.shadowBlur = size * .12;
  c2.strokeStyle = o.stroke || '#2a1f4a'; c2.lineWidth = size * .2; c2.strokeText(s, 0, 0); c2.shadowColor = 'transparent';
  c2.fillStyle = o.fill || '#ffffff'; c2.fillText(s, 0, 0); c2.restore();
}
function pop(s, x, y, size, lt, t0, o = {}) { if (lt < t0) return; const u = seg(lt, t0, t0 + .45); txt(s, x, y, size, { ...o, sc: back(u), a: clamp(u * 3) }); }
function badge(s, x, y, size, lt, t0, col = '#ff4f6a') {
  if (lt < t0) return; const u = back(seg(lt, t0, t0 + .45)); c2.save(); c2.translate(x, y); c2.scale(u, u); c2.font = `900 ${size}px Nunito`; const w = c2.measureText(s).width + size * .9;
  c2.fillStyle = 'rgba(30,20,60,.3)'; c2.beginPath(); c2.roundRect(-w / 2, -size * .62 + 10, w, size * 1.24, size * .62); c2.fill();
  c2.fillStyle = col; c2.beginPath(); c2.roundRect(-w / 2, -size * .62, w, size * 1.24, size * .62); c2.fill(); c2.strokeStyle = '#ffffff'; c2.lineWidth = 8; c2.stroke();
  c2.fillStyle = '#ffffff'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(s, 0, 4); c2.restore();
}

// ———————————————————————————— helpers per frame
function hideAll() {
  for (const k in SETS) SETS[k].visible = false;
  calendar.scale.setScalar(1);
  for (const o of [T1, sunBall, snowGround, snow, ruler, crown, buckets, calendar, ...cranes, ...rings, ...winds, ...crowd, ...workers, ...painters, ...tourists, ...signs, ...ropes]) o.visible = false;
  snowCaps.forEach(c => c.visible = false); T0.position.set(0, 0, 0); T0.rotation.set(0, 0, 0); T0.scale.set(1, 1, 1); T1.scale.set(1, 1, 1);
  trees.forEach(t => { t.userData.crown.rotation.set(0, 0, 0); }); clouds.forEach((c, k) => c.position.x = -600 + k * 260);
  setClip(null); M.iron.color.set('#9a6440'); beamMat.color.set('#9a6440'); bA.scale.set(1, 1, 1);
  heat.forEach(h => h.visible = false); arrows.forEach(a => a.visible = false);
}
let clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
function setClip(h) { const on = h != null; M.iron.clippingPlanes = on ? [clipPlane] : []; M.ironDark.clippingPlanes = on ? [clipPlane] : []; M.white.clippingPlanes = on ? [clipPlane] : []; if (on) clipPlane.constant = h; }
function look(px, py, pz, tx, ty, tz, fov = 40) { cam.position.set(px, py, pz); cam.lookAt(tx, ty, tz); cam.fov = fov; cam.updateProjectionMatrix(); }
function orbit(r, h, a, ty, fov = 40) { look(Math.sin(a) * r, h, Math.cos(a) * r, 0, ty, 0, fov); }
function place(list, n, fn) { for (let i = 0; i < n && i < list.length; i++) { list[i].visible = true; fn(list[i], i); } }
function walkBob(p, t, i) { p.position.y = Math.abs(Math.sin(t * 6 + i)) * .5; p.userData.arms[0].rotation.x = Math.sin(t * 6 + i) * .5; p.userData.arms[1].rotation.x = -Math.sin(t * 6 + i) * .5; }

// ———————————————————————————— scenes
const SH = {
  summer(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(0, 120, 0, 260); orbit(lerp(520, 430, eo(lt / D)), 40, .35 + lt * .05, 150, 42);
    pop('ЛЕТОМ', 540, 260, 130, lt, .3, { fill: '#ffd33d' }); pop('ВЫШЕ?!', 540, 410, 150, lt, .6, { fill: '#ffffff' }); },
  physics(lt, D) { season('summer'); SETS.paris.visible = true; fitSun(0, 120, 0, 260); orbit(470, 120, -.45 - lt * .04, 160, 40);
    const b = Math.sin(lt * 2.2) * 14; c2.save(); c2.translate(560, 980 + b); c2.rotate(-.05); const u = back(seg(lt, .2, .7)); c2.scale(u, u);
    c2.fillStyle = 'rgba(255,255,255,.92)'; c2.beginPath(); c2.roundRect(-330, -110, 660, 220, 50); c2.fill(); c2.strokeStyle = '#3d7be0'; c2.lineWidth = 10; c2.stroke();
    c2.fillStyle = '#2a1f4a'; c2.font = '900 92px Nunito'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('ΔL = α·L·ΔT', 0, 6); c2.restore();
    pop('ФИЗИКА!', 540, 300, 140, lt, .5, { fill: '#7fe0ff' }); },
  iron(lt, D) { season('summer'); SETS.close.visible = true; fitSun(8000, 0, 0, 70, [.6, 1, 1.4]); look(8000 + lerp(30, 10, eo(lt / D)), lerp(-8, 4, eo(lt / D)), 70 - lt * 4, 8000, 0, 0, 40);
    pop('ЖЕЛЕЗО', 540, 300, 140, lt, .3, { fill: '#ffb36b' }); badge('Fe', 860, 520, 110, lt, .7, '#7a4ad8'); },
  expand(lt, D, t) { season('summer'); SETS.close.visible = true; fitSun(8000, 0, 0, 70, [.6, 1, 1.4]); look(8000, 6, 74, 8000, 0, 0, 40);
    const h = eio(seg(lt, .3, D - .4)); beamMat.color.lerpColors(new THREE.Color('#9a6440'), new THREE.Color('#e0603a'), h); bA.scale.x = 1 + h * .08;
    heat.forEach((m, k) => { m.visible = true; const ph = (lt * .6 + k / 7) % 1; m.position.set(-36 + k * 12, 6 + ph * 22, 4); m.material.opacity = .55 * Math.sin(ph * Math.PI) * h; });
    arrows.forEach(a => { a.visible = h > .1; a.position.set(a.userData.s * (44 + h * 8), 0, 4); a.scale.setScalar(.6 + .4 * h); });
    pop('ЖАРА!', 540, 300, 150, lt, .3, { fill: '#ff8a3c' }); pop('→ РАСШИРЯЕТСЯ ←', 540, 1240, 74, lt, 1.0, { fill: '#ffd33d' }); },
  grow(lt, D) { season('summer'); SETS.paris.visible = true; fitSun(0, 120, 0, 400); T0.position.x = -95; T1.visible = true; T1.position.x = 95; snowCaps[0].visible = true;
    const g = eo(seg(lt, .8, 2.2)); T1.scale.y = 1 + g * .045; look(0, 160, 820, 0, 165, 0, 42);
    pop('ЗИМА', 300, 300, 100, lt, .2, { fill: '#9fd8ff' }); pop('ЛЕТО', 780, 300, 100, lt, .4, { fill: '#ffd33d' }); badge('+15 см', 780, 470, 90, lt, 1.6, '#ff4f6a'); },
  winter(lt, D, t) { season('winter'); SETS.paris.visible = true; fitSun(0, 120, 0, 300, [-1, 1.2, .6]); snowGround.visible = true; snowCaps[0].visible = true; snow.visible = true;
    snow.position.y = -((t * 30) % 250); T0.scale.y = 1 - eo(seg(lt, .6, 2)) * .03; orbit(500, 50, 2.2 + lt * .05, 150, 42);
    pop('ЗИМОЙ — НИЖЕ', 540, 300, 110, lt, .3, { fill: '#cfe8ff' }); pop('брр!', 820, 470, 90, lt, 1.0, { fill: '#ffffff', rot: .1 }); },
  tilt(lt, D) { season('summer'); SETS.paris.visible = true; fitSun(0, 120, 0, 300, [-1.4, 1.2, .5]); sunBall.visible = true; sunBall.position.set(-420, 300, -120);
    T0.rotation.z = -eio(seg(lt, .5, 2.2)) * .035; look(0, 150, 700, -40, 170, 0, 44);
    pop('НАКЛОН', 540, 300, 130, lt, .3, { fill: '#ffd33d' }); pop('от солнца →', 640, 440, 80, lt, 1.2, { fill: '#ffffff' }); },
  wind(lt, D, t) { season('storm'); SETS.paris.visible = true; fitSun(0, 120, 0, 300); const sw = Math.sin(t * 3.2) * .012; T0.rotation.z = sw; T0.rotation.x = sw * .4;
    trees.forEach((tr, k) => { tr.userData.crown.rotation.z = -.25 - Math.sin(t * 4 + k) * .12; }); clouds.forEach((c, k) => c.position.x = -600 + k * 260 + ((t * 120) % 400));
    winds.forEach((w, k) => { w.visible = true; const ph = (t * .8 + k / 18) % 1; w.position.set(-500 + ph * 1000, 20 + (k * 37) % 260, 120 + (k % 5) * 30); });
    orbit(460, 60, .9, 160, 42); pop('ВЕТЕР!', 540, 300, 150, lt, .3, { fill: '#cfe8ff' }); pop('качается ↔', 540, 450, 84, lt, 1.0); },
  height(lt, D) { season('summer'); SETS.paris.visible = true; fitSun(0, 120, 0, 300); ruler.visible = true; const u = eio(seg(lt, 0, D - .3));
    look(240, lerp(30, 230, u), 380, 40, lerp(60, 250, u), 0, 46); const n = Math.round(330 * eo(seg(lt, .3, D - .5)));
    badge(n + ' м', 540, 1180, 150, lt, .3, '#ff4f6a'); pop('ВЫСОТА', 540, 300, 130, lt, .2, { fill: '#ffd33d' }); },
  build(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(0, 80, 0, 300); const h = lerp(40, 200, eio(seg(lt, 0, D))); setClip(h);
    cranes.forEach((c, k) => { c.visible = true; c.position.set(k ? 30 : -40, h - 10, k ? -20 : 25); c.rotation.y = Math.sin(t * .6 + k) * .6; });
    place(workers, 6, (p, i) => { p.position.set(-60 + i * 22, 0, 90 + (i % 2) * 14); walkBob(p, t, i); p.rotation.y = Math.sin(t + i) * .5; });
    look(260, 90, 400, 0, 100, 40, 44); pop('2 ГОДА', 540, 300, 150, lt, .3, { fill: '#ffd33d' }); pop('1887 → 1889', 540, 450, 80, lt, .9); },
  expo(lt, D, t) { season('vintage'); SETS.paris.visible = true; fitSun(0, 80, 0, 300);
    place(crowd, 18, (p, i) => { p.position.set(-80 + (i % 9) * 20, 0, 230 + Math.floor(i / 9) * 22 + Math.sin(i) * 5); p.rotation.y = Math.PI + Math.sin(i) * .3; walkBob(p, t * .6, i); face(p, 'wow'); });
    look(0, 14, 330, 0, 120, 0, 50); badge('1889', 540, 420, 140, lt, .3, '#c8963a'); pop('ВСЕМИРНАЯ ВЫСТАВКА', 540, 250, 64, lt, .6, { fill: '#fff0c8' }); return { sepia: .55 }; },
  eiffel(lt, D, t) { season('studio'); SETS.desk.visible = true; fitSun(0, 10, 8000, 40, [.4, 1.4, .8]); eng.userData.head.rotation.x = .35 + Math.sin(t * 1.3) * .05; face(eng, 'happy');
    look(lerp(16, 6, eo(lt / D)), 19, 8000 + lerp(34, 26, eo(lt / D)), 0, 12, 8000 - 4, 44); pop('ГЮСТАВ ЭЙФЕЛЬ', 540, 280, 96, lt, .3, { fill: '#ffd33d' }); pop('и его инженеры', 540, 400, 64, lt, .8); },
  liberty(lt, D) { season('summer'); SETS.statue.visible = true; fitSun(-8000, 60, 0, 120); const a = .6 + lt * .12; look(-8000 + Math.sin(a) * 150, 60, Math.cos(a) * 150, -8000, 78, 0, 46);
    pop('СТАТУЯ СВОБОДЫ', 540, 280, 96, lt, .3, { fill: '#9ff0d8' }); pop('каркас — Эйфель!', 540, 410, 76, lt, 1.0, { fill: '#ffd33d' }); },
  hate(lt, D, t) { season('vintage'); SETS.paris.visible = true; fitSun(0, 80, 0, 300);
    place(crowd, 14, (p, i) => { p.position.set(-70 + (i % 7) * 22, 0, 200 + Math.floor(i / 7) * 24); p.rotation.y = Math.PI; face(p, 'angry'); p.position.y = Math.abs(Math.sin(t * 8 + i)) * .6; p.userData.arms[i % 2].rotation.z = (i % 2 ? 1 : -1) * (2.4 + Math.sin(t * 8 + i) * .3); });
    look(0, 40, 320, 0, 60, 0, 48); pop('ФУ!', 260, 520, 120, lt, .4, { fill: '#ff6a5a', rot: -.15 }); pop('УЖАС!', 800, 640, 100, lt, .8, { fill: '#ff6a5a', rot: .12 }); pop('НЕНАВИСТЬ', 540, 280, 110, lt, .2, { fill: '#ffffff' }); return { sepia: .45 }; },
  artists(lt, D, t) { season('vintage'); SETS.paris.visible = true; fitSun(0, 80, 0, 300);
    place(crowd, 12, (p, i) => { p.position.set(-60 + (i % 6) * 24, 0, 190 + Math.floor(i / 6) * 26); p.rotation.y = Math.PI * 1.0 + .25; face(p, 'angry'); p.userData.arms[1].rotation.z = 2.8; });
    place(signs, 6, (s, i) => { s.position.set(-60 + i * 24 + 3, 10 + Math.sin(t * 5 + i) * .8, 195 + (i % 2) * 26); s.rotation.y = .25; s.rotation.z = Math.sin(t * 4 + i) * .08; });
    look(60, 26, 300, 0, 40, 160, 46); pop('«УРОДЛИВАЯ!»', 540, 290, 110, lt, .3, { fill: '#ffb3c8' }); return { sepia: .45 }; },
  dismantle(lt, D, t) { season('vintage'); SETS.paris.visible = true; fitSun(0, 80, 0, 300); calendar.visible = true; calendar.position.set(5, 26, 262); calendar.rotation.y = -.15; calendar.scale.setScalar(1.3);
    const y = Math.min(1909, 1889 + Math.floor(seg(lt, .4, D - .8) * 20)); if (calendar.userData.y !== y) { drawCalendar(y); calendar.userData.y = y; }
    place(workers, 1, p => { p.position.set(-14, 0, 268); p.rotation.y = .6; face(p, 'worried'); p.userData.arms[0].rotation.z = -2.6; p.userData.head.rotation.z = Math.sin(t * 2) * .1; });
    look(0, 22, 330, -2, 24, 250, 46); badge('20 ЛЕТ', 540, 300, 120, lt, .3, '#ff8a3c'); return { sepia: .35 }; },
  radio(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(0, 300, 0, 120); const top = T0.userData.top;
    rings.forEach((r, k) => { r.visible = true; const ph = (t * .7 + k / 4) % 1; r.position.set(0, top - 8, 0); r.scale.setScalar(1 + ph * 14); r.material.opacity = (1 - ph) * .9; });
    look(120, top - 30, 160, 0, top - 30, 0, 42); pop('РАДИО!', 540, 300, 150, lt, .3, { fill: '#7fe0ff' }); pop('антенны спасли башню', 540, 450, 66, lt, 1.0); },
  tallest(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(0, 150, 0, 400); crown.visible = true; const top = T0.userData.top; crown.position.set(0, top + 45 + Math.sin(t * 2) * 6, 0); crown.rotation.y = t * .8; crown.scale.setScalar(3 * back(seg(lt, .4, 1.0)) + .001);
    orbit(450, 25, -.3 + lt * .04, 190, 52); pop('САМАЯ ВЫСОКАЯ', 540, 280, 100, lt, .2, { fill: '#ffd33d' }); badge('41 ГОД', 540, 430, 100, lt, .8, '#7a4ad8'); },
  rivets(lt, D) { season('summer'); SETS.close.visible = true; fitSun(8000, 0, 0, 70, [.6, 1, 1.4]); look(8000 + 6, 4 + lt * 1.5, lerp(26, 14, eo(lt / D)), 8000, 0, 0, 40);
    const n = Math.round(2500000 * eo(seg(lt, .2, D - .4))); badge(n.toLocaleString('ru-RU'), 540, 1180, 110, lt, .1, '#ff4f6a'); pop('ЗАКЛЁПКИ', 540, 300, 130, lt, .2, { fill: '#ffd33d' }); },
  paint(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(30, 40, 30, 120);
    place(painters, 8, (p, i) => { const x = -40 + (i % 4) * 22, y = 26 + Math.floor(i / 4) * 22 + Math.sin(t * 2 + i) * 1.2; p.position.set(x, y, 46); p.rotation.y = Math.PI; p.userData.arms[1].rotation.x = -1.6 + Math.sin(t * 8 + i) * .5; ropes[i].visible = true; ropes[i].position.set(x, (y + 2 + 60) / 2 + 1.5, 46); ropes[i].scale.y = 60 - y; });
    M.iron.color.lerpColors(new THREE.Color('#9a6440'), new THREE.Color('#b0703f'), seg(lt, .3, D)); look(20, 44, 108, -10, 40, 46, 46);
    badge('КАЖДЫЕ 7 ЛЕТ', 540, 300, 96, lt, .3, '#3cb46e'); pop('вручную!', 540, 450, 80, lt, 1.0); },
  buckets(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(60, 10, 80, 80); buckets.visible = true; buckets.scale.setScalar(back(seg(lt, .1, .7)) + .001);
    look(lerp(125, 110, eo(lt / D)), 34, 112, 60, 10, 80, 44); badge('60 ТОНН', 540, 300, 130, lt, .5, '#ff4f6a'); pop('краски!', 540, 460, 90, lt, .9); },
  tourists(lt, D, t) { season('summer'); SETS.paris.visible = true; fitSun(0, 40, 120, 200);
    place(tourists, 18, (p, i) => { p.position.set(-90 + (i % 9) * 22 + Math.sin(i) * 4, 0, 150 + Math.floor(i / 9) * 26); p.rotation.y = Math.PI + Math.sin(i * 2) * .2; face(p, 'wow'); p.userData.arms[1].rotation.x = -2.2; cameras[i].userData.fl.material.opacity = ((t * 3 + i * .37) % 1) < .08 ? 1 : 0; });
    look(0, 20, 300, 0, 80, 0, 50); pop('МИЛЛИОНЫ', 540, 280, 130, lt, .3, { fill: '#ffd33d' }); pop('туристов в год', 540, 420, 76, lt, .8); },
  newspaper(lt, D, t) { season('studio'); SETS.news.visible = true; fitSun(0, 0, -8000, 60, [.3, .6, 1.4]); const u = eo(seg(lt, 0, .9)); news.rotation.z = (1 - u) * Math.PI * 4; news.scale.setScalar(.15 + u * .85); news.position.set(0, 0, 0);
    look(0, 0, -8000 + 62, 0, 0, -8000, 46); return { sepia: .25 }; },
  sub(lt, D, t) { season('sunset'); SETS.paris.visible = true; fitSun(0, 150, 0, 400, [-1, .45, -1.4]); sunBall.visible = true; sunBall.position.set(-500, 70, -900);
    look(lerp(-80, 40, eio(lt / D)), 12, -420, 0, 150, 0, 44); pop('ФАКТЫ', 540, 300, 150, lt, .6, { fill: '#ffd33d' }); pop('ЗА МИНУТУ', 540, 450, 110, lt, .9);
    badge('▶ ПОДПИСАТЬСЯ', 540, 1200, 80, lt, 1.6, '#ff2a4a'); },
};

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c2.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SUBS = (() => { const out = VO.map(v => ({ text: v.text, a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .6, p.a + 1.8); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return;
  c2.save(); c2.font = '800 58px Nunito'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.lineJoin = 'round';
  const L = wrap(v.text, 960), y0 = H - 230 - (L.length - 1) * 70;
  L.forEach((s, i) => { c2.strokeStyle = 'rgba(25,15,45,.9)'; c2.lineWidth = 13; c2.strokeText(s, W / 2, y0 + i * 70); c2.fillStyle = '#ffffff'; c2.fillText(s, W / 2, y0 + i * 70); });
  c2.restore();
}

// ———————————————————————————— frame
function render(t) {
  const k = sceneIdx(t), s = SC[k], lt = t - s.t0, D = s.t1 - s.t0;
  hideAll(); c2.clearRect(0, 0, W, H);
  // draw scene text after the 3D render: collect into the overlay
  const fx = SH[s.name](lt, D, t) || {};
  sky.position.copy(cam.position);
  R.render(S, cam);
  // sepia/vintage grade + grain (overlay)
  if (fx.sepia) { c2.save(); c2.globalCompositeOperation = 'destination-over'; c2.restore(); }
  subs(t);
  // cut accents: a soft white pop on every cut
  const cf = 1 - seg(lt, 0, .16); if (k > 0 && cf > 0) { c2.fillStyle = `rgba(255,255,255,${.55 * cf})`; c2.fillRect(0, 0, W, H); }
  if (t < .3) { c2.fillStyle = `rgba(0,0,0,${1 - t / .3})`; c2.fillRect(0, 0, W, H); }
  if (t > TL.DUR - .5) { c2.fillStyle = `rgba(0,0,0,${seg(t, TL.DUR - .5, TL.DUR)})`; c2.fillRect(0, 0, W, H); }
  gl.style.filter = fx.sepia ? `sepia(${fx.sepia}) saturate(${1 - fx.sepia * .3})` : 'none';
}
// sepia via CSS filter is applied to the WebGL canvas element: the screenshot captures it
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const Sx = Object.fromEntries(SC.map(s => [s.name, s]));
  const at = (n, dt) => Sx[n].t0 + dt;
  for (const s of SC) add('pop', s.t0 + .3, { v: .7 });
  add('sizzle', at('expand', .3), { d: Sx.expand.t1 - Sx.expand.t0 - .5 }); add('stretch', at('grow', .8), { d: 1.4 }); add('ding', at('grow', 1.6));
  add('wind', at('winter', 0), { d: Sx.winter.t1 - Sx.winter.t0, v: .5 }); add('creak', at('tilt', .6), { d: 1.6 }); add('wind', at('wind', 0), { d: Sx.wind.t1 - Sx.wind.t0, v: 1.2 });
  add('roll', at('height', .3), { d: Sx.height.t1 - Sx.height.t0 - .8 }); for (let k = 0; k < 6; k++) add('clank', at('build', .4 + k * .45));
  add('fanfare', at('expo', .3)); add('crowd', at('expo', 0), { d: Sx.expo.t1 - Sx.expo.t0, v: .6 });
  add('boo', at('hate', .3), { d: Sx.hate.t1 - Sx.hate.t0 - .3 }); add('boo', at('artists', .2), { d: Sx.artists.t1 - Sx.artists.t0 - .3, v: .7 });
  add('flip', at('dismantle', .4), { d: Sx.dismantle.t1 - Sx.dismantle.t0 - 1.2 }); add('radio', at('radio', .2), { d: Sx.radio.t1 - Sx.radio.t0 - .3 }); add('ding', at('tallest', .8)); add('fanfare', at('tallest', .5));
  add('roll', at('rivets', .2), { d: Sx.rivets.t1 - Sx.rivets.t0 - .6 }); add('brush', at('paint', .3), { d: Sx.paint.t1 - Sx.paint.t0 - .5 }); add('clank', at('buckets', .2)); add('clank', at('buckets', .45));
  add('crowd', at('tourists', 0), { d: Sx.tourists.t1 - Sx.tourists.t0, v: .5 }); for (let k = 0; k < 8; k++) add('shutter', at('tourists', .4 + k * .33));
  add('whoosh', at('newspaper', 0)); add('fanfare', at('sub', .6));
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('900 60px Nunito', 'ЛЕТОМ'); await document.fonts.load('800 58px Nunito', 'Летом');
drawBlueprint(bpTex); drawNews(newsTex); drawCalendar(1889); signs.forEach(s => s.material.map.needsUpdate = true);
window.EV = events();
render(parseFloat(qs.get('t') ?? '1.5'));
window.READY = true;
