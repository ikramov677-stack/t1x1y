// «Человек светится» — cinematic 3D short (vertical 1080×1920): dark sets, glow, depth of field, bloom
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';

const W = 1080, H = 1920, qs = new URLSearchParams(location.search);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u, eo = x => 1 - Math.pow(1 - clamp(x), 3), eio = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ———————————————————————————— timeline
const LINES = [
  ['you', 'Прямо сейчас вы светитесь.'], ['hands', 'Да-да, вы. И я не шучу.'], ['mirror', 'Но почему же мы этого не видим?'],
  ['lab', 'В 2009 году японские учёные провели необычный опыт.'], ['dark', 'Они снимали людей в полной темноте сверхчувствительной камерой.'],
  ['photo', 'И камера увидела слабое свечение тела!'], ['eye', 'Но оно в тысячу раз слабее, чем может заметить глаз.'],
  ['face', 'Ярче всего светится лицо — особенно щёки и лоб.'], ['clock', 'А свечение меняется в течение дня.'], ['morning', 'Слабее всего мы светимся утром…'],
  ['evening', '…а ярче всего — ближе к вечеру.'], ['cells', 'Всё из-за химических реакций внутри наших клеток.'],
  ['fireflies', 'Светимся не только мы. Светлячки делают это гораздо ярче.'], ['sea', 'В тёмных глубинах океана светится большинство морских жителей.'],
  ['shrooms', 'А в некоторых лесах растут светящиеся грибы.'], ['switch', 'Так что в следующий раз, выключив свет, помните…'],
  ['bed', '…вы никогда не бываете в полной темноте.'], ['sub', 'Подписывайтесь на «Факты за минуту»!'],
].map(([id, text]) => ({ id, text }));
const VOICE = [[0.02,1.94],[2.30,4.50],[4.76,6.41],[6.95,10.64],[11.13,14.40],[14.81,17.34],[17.69,20.70],[21.07,24.37],[24.72,26.62],[27.04,28.88],[29.19,31.03],[31.47,34.20],[34.66,38.48],[38.88,42.10],[42.44,45.02],[45.42,48.11],[48.45,51.01],[51.50,53.40]];
const VOICE_OFFSET = 0.5, BPM = 80, BEAT = 60 / BPM;
const snapB = t => Math.round(t / (BEAT / 2)) * BEAT / 2;
const TL = (() => {
  const spans = VOICE || (() => { let t = 0; return LINES.map(l => { const d = l.text.length / 13; const s = [t, t + d]; t += d + .9; return s; }); })();
  const on = spans.map(s => s[0] + VOICE_OFFSET), starts = on.map((x, i) => i ? snapB(x - .35) : 0);
  const end = snapB(spans[spans.length - 1][1] + VOICE_OFFSET + 3.4);
  return { SC: LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end })), VO: LINES.map((l, i) => ({ ...l, t: on[i], d: spans[i][1] - spans[i][0] })), DUR: end };
})();
const { SC, VO } = TL;
const sceneIdx = t => { let k = 0; SC.forEach((s, i) => { if (t >= s.t0) k = i; }); return k; };

// ———————————————————————————— renderer, post
const gl = document.getElementById('gl'), ov = document.getElementById('ov'), c2 = ov.getContext('2d');
const R = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true });
R.setSize(W, H, false); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
const S = new THREE.Scene(); S.background = new THREE.Color('#020308');
const cam = new THREE.PerspectiveCamera(35, W / H, .05, 400);
const P = makePost(R, S, cam, W, H, { ssaa: 1 });
P.bloom.strength = .9; P.bloom.radius = .7; P.bloom.threshold = .55; P.dof.maxCoc = 14; P.dof.aper = 3;
const amb = new THREE.AmbientLight('#203050', .25); S.add(amb);
const key = new THREE.SpotLight('#6a8cff', 0, 40, .5, .7, 1.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); S.add(key); S.add(key.target);
const rim = new THREE.DirectionalLight('#9ab8ff', 0); S.add(rim);
const warm = new THREE.PointLight('#ffb070', 0, 30, 1.6); S.add(warm);

// ———————————————————————————— materials
const std = (c, r = .55, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
const skin = new THREE.MeshPhysicalMaterial({ color: '#c99a80', roughness: .5, sheen: .4, sheenColor: '#ffb0a0', clearcoat: .1 });
const cloth = std('#2a3448', .85), clothLight = std('#e8ecf2', .7), hairM = std('#1a1410', .6), darkM = std('#0c0e14', .9), woodM = std('#4a2e1e', .7);
function auraMat(col, a = 1) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { col: { value: new THREE.Color(col) }, k: { value: a } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 col; uniform float k; varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - abs(dot(n, v)), 3.6); gl_FragColor = vec4(col * f * k, 1.); }' });
}
// face glow map: forehead + cheeks brightest (in local head coordinates)
const faceGlow = new THREE.ShaderMaterial({ uniforms: { k: { value: 0 }, base: { value: new THREE.Color('#2a3048') } },
  vertexShader: 'varying vec3 p; varying vec3 n; varying vec3 v; void main(){ p = position; vec4 mv = modelViewMatrix*vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: `uniform float k; uniform vec3 base; varying vec3 p; varying vec3 n; varying vec3 v;
    void main(){ float front = smoothstep(-.1, .8, p.z);
      float fore = exp(-pow((p.y - .55) / .22, 2.)) * exp(-pow(p.x / .55, 2.));
      float cheek = exp(-pow((p.y + .05) / .2, 2.)) * exp(-pow((abs(p.x) - .42) / .2, 2.));
      float g = (fore * .9 + cheek) * front;
      vec3 c = mix(vec3(.03,.08,.45), vec3(.55,.7,1.), g) * g * .85 * k;
      float l = max(dot(n, normalize(vec3(.3,.4,1.))), 0.) * .08;
      gl_FragColor = vec4(base * (l * 4. + .05) + c, 1.); }` });

// ———————————————————————————— a human figure (stylised, sculpted look)
function human(o = {}) {
  const g = new THREE.Group(), mat = o.mat || skin;
  const head = new THREE.Group(); head.position.y = 1.62; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), o.faceMat || mat); skull.scale.set(.105, .13, .115); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat); jaw.scale.set(.085, .07, .09); jaw.position.set(0, -.07, .02); head.add(jaw);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.02, 16, 12), mat); nose.scale.set(.8, 1.4, 1); nose.position.set(0, -.01, .112); head.add(nose);
  const eyes = []; for (const x of [-.04, .04]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.014, 16, 12), std('#0a0a10', .2)); e.position.set(x, .02, .1); head.add(e); eyes.push(e); }
  if (!o.bald) { const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * .55), hairM); hair.scale.set(.112, .14, .124); hair.position.set(0, .012, -.008); hair.rotation.x = -.25; head.add(hair); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .14, 16), mat); neck.position.y = 1.47; g.add(neck);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .38, 8, 24), o.cloth || cloth); torso.position.y = 1.18; torso.scale.set(1.15, 1, .7); g.add(torso);
  const arms = []; for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * .23, 1.36, 0); const up = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .26, 6, 12), o.cloth || cloth); up.position.y = -.16; a.add(up); const fore = new THREE.Group(); fore.position.y = -.33; a.add(fore); const lo = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .24, 6, 12), mat); lo.position.y = -.15; fore.add(lo); const hand = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), mat); hand.scale.set(.8, 1.1, .5); hand.position.y = -.32; fore.add(hand); a.userData.fore = fore; g.add(a); arms.push(a); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // aura: slightly scaled additive shells over head, neck, torso
  const aura = new THREE.Group(); const am = auraMat(o.aura || '#7ab0ff', 0);
  for (const [geo, pos, sc] of [[skull.geometry, [0, 1.62, 0], [.112, .139, .123]], [torso.geometry, [0, 1.18, 0], [1.2, 1.04, .75]]]) { const m = new THREE.Mesh(geo, am); m.position.set(...pos); m.scale.set(...sc); aura.add(m); }
  g.add(aura);
  g.userData = { head, arms, aura, am, eyes, skull };
  return g;
}
function glowLevel(p, k) { p.userData.am.uniforms.k.value = k; }
function handMesh(mat) {
  const g = new THREE.Group(); const palm = new THREE.Mesh(new THREE.BoxGeometry(.085, .1, .025, 4, 4, 2), mat); g.add(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(.009, .06, 4, 10), mat); f.position.set(-.03 + i * .02, .085 - Math.abs(i - 1.5) * .006, 0); g.add(f); }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(.011, .045, 4, 10), mat); th.position.set(.055, .01, .005); th.rotation.z = -.8; g.add(th);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); return g;
}

// ———————————————————————————— sets
const SETS = {}; function set(n, x = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, 0, z); S.add(g); SETS[n] = g; return g; }
// dark room (also mirror / switch / bed live here)
const room = set('room');
{ const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), std('#14161c', .9)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), std('#1a1d26', .95)); wall.position.set(0, 3, -2.2); wall.receiveShadow = true; room.add(wall);
  const chair = new THREE.Group(); const seatM = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .5), woodM); seatM.position.y = .48; chair.add(seatM); const backM = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .05), woodM); backM.position.set(0, .8, -.24); chair.add(backM); for (const [x, z] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.04, .48, .04), woodM); l.position.set(x, .24, z); chair.add(l); } chair.traverse(m => { if (m.isMesh) m.castShadow = true; }); room.add(chair); room.userData.chair = chair; }
const youP = human({ aura: '#86b8ff' }); youP.position.set(0, -.36, .05); room.add(youP);
// mirror
const mirror = new THREE.Group(); { const fr = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.7, .06), std('#3a2a1e', .5)); mirror.add(fr); const gl2 = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.6), new THREE.MeshPhysicalMaterial({ color: '#05060a', roughness: .05, metalness: .2, clearcoat: 1 })); gl2.position.z = .035; mirror.add(gl2); } mirror.position.set(0, 1.3, -1.6); room.add(mirror);
// bed + lamp + switch
const bedG = new THREE.Group(); { const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, .4, 2.2), woodM); frame.position.y = .2; bedG.add(frame); const mat2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, .2, 2.1), std('#d8d0c4', .9)); mat2.position.y = .5; bedG.add(mat2); const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.55, .14, 1.4, 8, 1, 8), std('#3a4a7a', .9)); blanket.position.set(0, .64, .32); bedG.add(blanket); const pillow = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .5, 6, 12), std('#efe8dc', .9)); pillow.rotation.z = Math.PI / 2; pillow.position.set(0, .7, -.8); bedG.add(pillow); bedG.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); }
bedG.position.set(.6, 0, -.8); room.add(bedG);
const sleeper = human({ aura: '#ffc890', cloth: std('#6a5a8a', .9) }); sleeper.rotation.x = -Math.PI / 2; sleeper.position.set(.6, .72, .07); room.add(sleeper);
const lamp = new THREE.Group(); { const st = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .5, 10), std('#888', .4)); st.position.y = .25; lamp.add(st); const shade = new THREE.Mesh(new THREE.ConeGeometry(.18, .22, 20, 1, true), std('#f2d8a8', .8, { side: THREE.DoubleSide, emissive: '#ffb060', emissiveIntensity: 0 })); shade.position.y = .55; lamp.add(shade); lamp.userData.shade = shade; } lamp.position.set(-.5, .55, -1.6); room.add(lamp);
const nightstand = new THREE.Mesh(new THREE.BoxGeometry(.5, .55, .45), woodM); nightstand.position.set(-.5, .27, -1.6); room.add(nightstand);
const switchG = new THREE.Group(); { const plate = new THREE.Mesh(new THREE.BoxGeometry(.12, .18, .02), std('#e8e4dc', .4)); switchG.add(plate); const tog = new THREE.Mesh(new THREE.BoxGeometry(.04, .07, .03), std('#f4f0e8', .3)); tog.position.z = .02; switchG.add(tog); switchG.userData.tog = tog; } switchG.position.set(-1.4, 1.3, -2.18); room.add(switchG);
const finger = handMesh(skin); finger.scale.setScalar(1.4); room.add(finger);
// window + sun beams (morning / evening)
const win = new THREE.Group(); { const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshBasicMaterial({ color: '#ffd8a0' })); win.add(pane); for (const [x, y, w, h] of [[0, 0, .05, 1.6], [0, 0, 1.2, .05]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), woodM); b.position.set(x, y, .02); win.add(b); } win.userData.pane = pane; } win.position.set(1.4, 1.6, -2.15); room.add(win);
const beams = []; for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(.25, 4), new THREE.MeshBasicMaterial({ color: '#ffcc88', transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.position.set(1.0 - k * .25, 1.0, -.9); b.rotation.set(0, -.6, .55); room.add(b); beams.push(b); }
// dust motes
const dustGeo = new THREE.BufferGeometry(), DN = 500, dp = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) { dp[i * 3] = (hash(i) - .5) * 4; dp[i * 3 + 1] = hash(i + 3) * 3; dp[i * 3 + 2] = (hash(i + 5) - .5) * 3; } dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#9ab8ff', size: .012, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })); room.add(dust);
// hands close-up (the "you" figure's own hands raised)
const handsG = new THREE.Group(); const hL = handMesh(skin), hR = handMesh(skin); hL.position.set(-.08, 0, 0); hL.rotation.z = .2; hR.position.set(.08, 0, 0); hR.rotation.z = -.2; hR.scale.x = -1; handsG.add(hL, hR);
const handAura = auraMat('#8ac0ff', 0); for (const h of [hL, hR]) h.children.slice().forEach(m => { const a = new THREE.Mesh(m.geometry, handAura); a.position.copy(m.position); a.rotation.copy(m.rotation); a.scale.copy(m.scale).multiplyScalar(1.35); h.add(a); });
handsG.position.set(0, 1.12, .38); room.add(handsG);

// lab
const lab = set('lab', 40, 0);
{ const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), std('#101318', .6, { metalness: .2 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; lab.add(floor); }
const bigCam = new THREE.Group(); { const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .45, .7), std('#1c1e24', .35, { metalness: .6 })); bigCam.add(body); const lens = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .55, 32), std('#0e0f12', .3, { metalness: .7 })); lens.rotation.x = Math.PI / 2; lens.position.z = .6; bigCam.add(lens); const glass = new THREE.Mesh(new THREE.CircleGeometry(.15, 32), new THREE.MeshPhysicalMaterial({ color: '#203050', roughness: .02, metalness: .5, clearcoat: 1 })); glass.position.z = .88; bigCam.add(glass); const led = new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3030' })); led.position.set(.22, .17, .36); bigCam.add(led); const tri = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.1, 8), std('#2a2a30', .5)); tri.position.y = -.75; bigCam.add(tri); bigCam.traverse(m => { if (m.isMesh) m.castShadow = true; }); }
bigCam.position.set(0, 1.3, 0); lab.add(bigCam);
const monTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 384; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), tex }; })();
const monitor = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .75), new THREE.MeshBasicMaterial({ map: monTex.tex, toneMapped: false })); monitor.position.set(-1.1, 1.35, -.4); monitor.rotation.y = .5; lab.add(monitor);
const sci = [human({ cloth: clothLight, aura: '#000000' }), human({ cloth: clothLight, aura: '#000000', bald: true })]; sci[0].position.set(.7, 0, -.5); sci[0].rotation.y = -.7; sci[1].position.set(-.6, 0, -.9); sci[1].rotation.y = .7; sci.forEach(s => lab.add(s));
const subject = human({ aura: '#86b8ff' }); subject.position.set(0, -.36, -4); lab.add(subject); const subChair = room.userData.chair.clone(); subChair.position.set(0, 0, -4.05); lab.add(subChair);
// eye
const eyeSet = set('eye', 80, 0);
const eyeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#f2ece6'; g.fillRect(0, 0, 512, 512); const gr = g.createRadialGradient(256, 256, 30, 256, 256, 130); gr.addColorStop(0, '#1a3a2a'); gr.addColorStop(.35, '#3a7a5a'); gr.addColorStop(.8, '#5a9a7a'); gr.addColorStop(1, '#203a30'); g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 130, 0, 7); g.fill(); for (let k = 0; k < 160; k++) { const a = k / 160 * 6.283; g.strokeStyle = `rgba(${150 + (k % 5) * 20},${190},${140},.3)`; g.lineWidth = 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * 45, 256 + Math.sin(a) * 45); g.lineTo(256 + Math.cos(a) * 128, 256 + Math.sin(a) * 128); g.stroke(); } g.fillStyle = '#040404'; g.beginPath(); g.arc(256, 256, 48, 0, 7); g.fill(); for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(200,60,60,.25)'; g.lineWidth = 1.5; g.beginPath(); const a = k * .45; g.moveTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); g.quadraticCurveTo(256 + Math.cos(a + .3) * 200, 256 + Math.sin(a + .3) * 200, 256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const eyeball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: .1, clearcoat: 1, clearcoatRoughness: .02 })); eyeball.rotation.y = -Math.PI / 2; eyeSet.add(eyeball);
for (const s of [1, -1]) { const lid = new THREE.Mesh(new THREE.TorusGeometry(1.02, .32, 24, 64, Math.PI), skin); lid.rotation.z = s > 0 ? 0 : Math.PI; lid.scale.set(1.05, .45, 1); lid.position.z = .05; eyeSet.add(lid); }
const faintDot = new THREE.Mesh(new THREE.SphereGeometry(.02, 12, 8), new THREE.MeshBasicMaterial({ color: '#9ac0ff', toneMapped: false, transparent: true })); faintDot.position.set(1.4, 1.6, .5); eyeSet.add(faintDot);
// face glow head
const faceSet = set('face', 120, 0);
const fHead = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), faceGlow); { const p = fHead.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const jaw = y < 0 ? 1 - Math.pow(-y, 1.6) * .28 : 1; x *= .82 * jaw; z *= .9; if (z > .4 && Math.abs(x) < .14 && y > -.3 && y < .2) z += .18 * (1 - Math.abs(x) / .14) * (1 - Math.abs(y + .05) / .25); if (z > .5 && y > .1 && y < .3) z -= .05 * Math.exp(-Math.pow((Math.abs(x) - .3) / .12, 2)); p.setXYZ(i, x, y * 1.18, z); } fHead.geometry.computeVertexNormals(); }
faceSet.add(fHead);
// clock
const clockSet = set('clock', 160, 0);
const clockTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(512, 512, 500, 0, 7); g.fill(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 18; g.stroke(); g.fillStyle = '#2a1e12'; g.font = '600 86px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let h = 1; h <= 12; h++) { const a = h / 12 * 6.283 - Math.PI / 2; g.fillText(['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][h - 1], 512 + Math.cos(a) * 390, 512 + Math.sin(a) * 390); }
  g.fillStyle = '#e8a030'; g.beginPath(); g.arc(512, 250, 60, 0, 7); g.fill(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.strokeStyle = '#e8a030'; g.lineWidth = 10; g.beginPath(); g.moveTo(512 + Math.cos(a) * 75, 250 + Math.sin(a) * 75); g.lineTo(512 + Math.cos(a) * 100, 250 + Math.sin(a) * 100); g.stroke(); }
  g.fillStyle = '#3a4a8a'; g.beginPath(); g.arc(512, 770, 60, 0, 7); g.fill(); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(540, 750, 55, 0, 7); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const clockFace = new THREE.Mesh(new THREE.CircleGeometry(.6, 64), new THREE.MeshStandardMaterial({ map: clockTex, roughness: .6 })); clockSet.add(clockFace);
const clockRim = new THREE.Mesh(new THREE.TorusGeometry(.62, .05, 16, 64), std('#b08a3a', .3, { metalness: .8 })); clockSet.add(clockRim);
const hH = new THREE.Mesh(new THREE.BoxGeometry(.03, .3, .01), std('#1a120a', .5)), hM = new THREE.Mesh(new THREE.BoxGeometry(.02, .45, .01), std('#1a120a', .5)); hH.geometry.translate(0, .14, 0); hM.geometry.translate(0, .21, 0); hH.position.z = hM.position.z = .02; clockSet.add(hH, hM);
const clockP = human({ aura: '#86b8ff' }); clockP.position.set(.95, -1.6, -.4); clockP.rotation.y = -.4; clockSet.add(clockP);
// cells
const cellSet = set('cells', 200, 0); const cells = [];
for (let k = 0; k < 26; k++) { const c = new THREE.Group(); const memb = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#d0607a', roughness: .3, transmission: .5, transparent: true, opacity: .55, thickness: .5 })); c.add(memb); const nuc = new THREE.Mesh(new THREE.SphereGeometry(.38, 24, 16), std('#6a2a5a', .4)); nuc.position.set(.15, .1, .1); c.add(nuc); const r = .5 + hash(k) * .6; c.scale.setScalar(r); c.position.set((hash(k + 1) - .5) * 7, (hash(k + 2) - .5) * 12, -hash(k + 3) * 8); cellSet.add(c); cells.push(c); }
const sparkGeo = new THREE.BufferGeometry(), SPN = 300, spp = new Float32Array(SPN * 3); for (let i = 0; i < SPN; i++) { const c = cells[i % cells.length]; spp[i * 3] = c.position.x + (hash(i) - .5) * .8 * c.scale.x; spp[i * 3 + 1] = c.position.y + (hash(i + 9) - .5) * .8 * c.scale.x; spp[i * 3 + 2] = c.position.z + (hash(i + 4) - .5) * .8 * c.scale.x; } sparkGeo.setAttribute('position', new THREE.BufferAttribute(spp, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#e0f0ff', size: .08, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); cellSet.add(sparks);
// meadow with fireflies
const meadow = set('meadow', 240, 0);
{ const gnd = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std('#0c1a10', 1)); gnd.rotation.x = -Math.PI / 2; meadow.add(gnd); const blade = new THREE.ConeGeometry(.02, .5, 4); blade.translate(0, .25, 0); const GN = 5000, gi = new THREE.InstancedMesh(blade, std('#1e4a24', .9), GN); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); for (let i = 0; i < GN; i++) { e.set((hash(i) - .5) * .5, hash(i + 1) * 6, (hash(i + 2) - .5) * .5); q.setFromEuler(e); m.compose(new THREE.Vector3((hash(i + 3) - .5) * 14, 0, -hash(i + 4) * 16 + 3), q, new THREE.Vector3(1, .6 + hash(i + 5), 1)); gi.setMatrixAt(i, m); } meadow.add(gi);
  for (let k = 0; k < 7; k++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(1.2 + hash(k) * .8, 5 + hash(k + 1) * 3, 10), std('#05080a', 1)); tr.position.set(-8 + k * 2.6, 3, -14 - hash(k + 2) * 3); meadow.add(tr); }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 20), new THREE.MeshBasicMaterial({ color: '#8a96b0' })); moon.position.set(5, 12, -26); meadow.add(moon); }
const flyGeo = new THREE.BufferGeometry(), FN = 160, fpos = new Float32Array(FN * 3); flyGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: '#d8ff6a', size: .09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); meadow.add(flies);
// deep sea
const sea = set('sea', 280, 0); const jellies = [], fish = [];
for (let k = 0; k < 7; k++) { const j = new THREE.Group(); const col = k % 2 ? '#ff6ad8' : '#5af0ff'; const bell = new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, transparent: true, opacity: .55, side: THREE.DoubleSide, toneMapped: false })); j.add(bell);
  for (let i = 0; i < 8; i++) { const pts = []; for (let s = 0; s < 12; s++) pts.push(new THREE.Vector3(Math.cos(i * .8) * .3, -s * .14, Math.sin(i * .8) * .3)); const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .012, 4), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .6, toneMapped: false })); j.add(tube); }
  const s = .5 + hash(k) * .9; j.scale.setScalar(s); j.position.set((hash(k + 1) - .5) * 5, (hash(k + 2) - .5) * 8, -2 - hash(k + 3) * 7); j.userData.ph = hash(k + 4) * 6; sea.add(j); jellies.push(j); }
for (let k = 0; k < 14; k++) { const f = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 10), std('#0a0e18', .5)); b.scale.set(1.8, .8, .6); f.add(b); for (let i = 0; i < 5; i++) { const ph = new THREE.Mesh(new THREE.SphereGeometry(.015, 8, 6), new THREE.MeshBasicMaterial({ color: '#7affd8', toneMapped: false })); ph.position.set(-.15 + i * .07, -.06, .06); f.add(ph); } const tl = new THREE.Mesh(new THREE.ConeGeometry(.08, .15, 6), std('#0a0e18', .5)); tl.rotation.z = Math.PI / 2; tl.position.x = -.26; f.add(tl); f.position.set((hash(k + 20) - .5) * 6, (hash(k + 21) - .5) * 9, -1 - hash(k + 22) * 6); f.userData.ph = hash(k + 23) * 6; sea.add(f); fish.push(f); }
const snowGeo = new THREE.BufferGeometry(), MS = 800, msp = new Float32Array(MS * 3); for (let i = 0; i < MS; i++) { msp[i * 3] = (hash(i + 50) - .5) * 10; msp[i * 3 + 1] = (hash(i + 51) - .5) * 14; msp[i * 3 + 2] = -hash(i + 52) * 10; } snowGeo.setAttribute('position', new THREE.BufferAttribute(msp, 3));
const marine = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#8ab8d8', size: .025, transparent: true, opacity: .6, depthWrite: false })); sea.add(marine);
// mushrooms on a log
const forest = set('forest', 320, 0);
{ const gnd = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), std('#0e120c', 1)); gnd.rotation.x = -Math.PI / 2; forest.add(gnd); const log = new THREE.Mesh(new THREE.CylinderGeometry(.35, .4, 4, 24), std('#2a1c12', .9)); log.rotation.z = Math.PI / 2; log.position.y = .35; log.castShadow = true; forest.add(log); const moss = new THREE.Mesh(new THREE.CylinderGeometry(.37, .42, 3.6, 24, 1, true, Math.PI * .6, Math.PI * .8), std('#1e3a18', 1)); moss.rotation.z = Math.PI / 2; moss.position.y = .36; forest.add(moss);
  for (let k = 0; k < 16; k++) { const m = new THREE.Group(); const stem = new THREE.Mesh(new THREE.CylinderGeometry(.015, .025, .12, 10), new THREE.MeshStandardMaterial({ color: '#c8f0a0', emissive: '#7aff5a', emissiveIntensity: .7 })); stem.position.y = .06; m.add(stem); const cap = new THREE.Mesh(new THREE.SphereGeometry(.06, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a8ff7a', emissive: '#6aff4a', emissiveIntensity: .9 })); cap.position.y = .11; cap.scale.y = .7; m.add(cap); const s = .7 + hash(k) * .9; m.scale.setScalar(s); m.position.set(-1.6 + k * .21 + (hash(k + 1) - .5) * .1, .62 + (hash(k + 2) - .5) * .08, (hash(k + 3) - .5) * .4); m.rotation.z = (hash(k + 4) - .5) * .5; forest.add(m); }
  for (let k = 0; k < 9; k++) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(.3, .4, 12, 12), std('#0a0806', 1)); tr.position.set(-6 + k * 1.6, 6, -4 - hash(k) * 4); forest.add(tr); } }
const spores = new THREE.Points((() => { const g = new THREE.BufferGeometry(), n = 300, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (hash(i + 70) - .5) * 4; p[i * 3 + 1] = .6 + hash(i + 71) * 2; p[i * 3 + 2] = (hash(i + 72) - .5) * 2; } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g; })(), new THREE.PointsMaterial({ color: '#b8ff8a', size: .02, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); forest.add(spores);
// night town
const town = set('town', 360, 0);
{ const starGeo = new THREE.BufferGeometry(), n = 2500, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = hash(i + 90) * 6.283, b = hash(i + 91) * 1.3 + .05, r = 150; p[i * 3] = Math.cos(a) * Math.cos(b) * r; p[i * 3 + 1] = Math.sin(b) * r; p[i * 3 + 2] = -Math.abs(Math.sin(a) * Math.cos(b) * r) - 20; } starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); town.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: .45, sizeAttenuation: true, toneMapped: false })));
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std('#05060a', 1)); gnd.rotation.x = -Math.PI / 2; town.add(gnd);
  for (let k = 0; k < 22; k++) { const w = 2 + hash(k) * 2, h = 2 + hash(k + 1) * 4, d = 2; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std('#0a0c14', 1)); b.position.set(-20 + k * 2, h / 2, -14 - hash(k + 2) * 6); town.add(b); const roof = new THREE.Mesh(new THREE.ConeGeometry(w * .75, 1.4, 4), std('#080a10', 1)); roof.rotation.y = Math.PI / 4; roof.position.set(b.position.x, h + .7, b.position.z); town.add(roof); for (let r = 0; r < 3; r++) if (hash(k * 3 + r) > .55) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(.35, .45), new THREE.MeshBasicMaterial({ color: '#ffc870', toneMapped: false })); wl.position.set(b.position.x - w / 4 + r * .4, 1 + r * 1.1, b.position.z + d / 2 + .01); town.add(wl); } }
  const church = new THREE.Mesh(new THREE.ConeGeometry(.9, 6, 4), std('#0a0c14', 1)); church.position.set(2, 7, -18); town.add(church); }

// ———————————————————————————— overlay type
function title(s, y, p, size = 92, o = {}) {
  if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p) * (o.a ?? 1); c2.font = `${o.w || 300} ${size}px Oswald`; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.letterSpacing = (o.sp ?? .18) * size + 'px';
  c2.shadowColor = o.glow || 'rgba(120,170,255,.9)'; c2.shadowBlur = size * .5; c2.fillStyle = o.fill || '#eef4ff'; c2.fillText(s, W / 2 + (o.dx || 0), y + (1 - eo(p)) * 20); c2.shadowBlur = 0; c2.fillText(s, W / 2 + (o.dx || 0), y + (1 - eo(p)) * 20); c2.restore();
}
function label(s, x, y, p, size = 44, col = '#cfe0ff') { if (p <= 0) return; c2.save(); c2.globalAlpha = eo(p); c2.font = `500 ${size}px Oswald`; c2.letterSpacing = size * .12 + 'px'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.shadowColor = 'rgba(0,0,0,.8)'; c2.shadowBlur = 12; c2.fillStyle = col; c2.fillText(s, x, y); c2.restore(); }
function bars() { c2.fillStyle = 'rgba(0,0,0,.0)'; }

// ———————————————————————————— frame helpers
function hideAll() { for (const k in SETS) SETS[k].visible = false; for (const o of [mirror, bedG, sleeper, lamp, nightstand, switchG, finger, win, handsG, ...beams]) o.visible = false; youP.visible = true; room.userData.chair.visible = true; key.intensity = 0; rim.intensity = 0; warm.intensity = 0; amb.intensity = .25; amb.color.set('#203050'); S.background.set('#020308'); S.fog = null; P.bloom.strength = .9; P.bloom.threshold = .55; P.dof.aper = 3; P.vig.uniforms.amt.value = .55; P.vig.uniforms.warm.value = 0; P.vig.uniforms.sat.value = 1; P.vig.uniforms.fade.value = 1; youP.userData.head.rotation.set(0, 0, 0); bigCam.children[3].material.color.set('#ff3030'); youP.userData.arms.forEach(a => { a.rotation.set(0, 0, 0); a.userData.fore.rotation.set(0, 0, 0); }); glowLevel(youP, 0); }
function look(px, py, pz, tx, ty, tz, fov = 35, focus) { cam.position.set(px, py, pz); cam.lookAt(tx, ty, tz); cam.fov = fov; cam.updateProjectionMatrix(); P.dof.focus = focus ?? Math.hypot(px - tx, py - ty, pz - tz); }
function keyAt(x, y, z, tx, ty, tz, i, col = '#6a8cff', angle = .5) { key.position.set(x, y, z); key.target.position.set(tx, ty, tz); key.intensity = i; key.color.set(col); key.angle = angle; }
function seatedPose(p) { const a = p.userData.arms; a.forEach((arm, i) => { arm.rotation.x = -.9; arm.userData.fore.rotation.x = -.4; arm.rotation.z = (i ? -1 : 1) * .1; }); }

// ———————————————————————————— scenes
const SH = {
  you(lt, D, t) { SETS.room.visible = true; seatedPose(youP); glowLevel(youP, 1.3 + .4 * Math.sin(t * 1.3)); keyAt(1.5, 3, 1.5, 0, 1.2, 0, 6, '#5a7ae0'); rim.intensity = .6; rim.position.set(-2, 2, -2);
    const u = eio(lt / D); look(lerp(.5, .25, u), lerp(1.45, 1.35, u), lerp(3.4, 2.2, u), 0, 1.2, 0, 32);
    title('ВЫ', 330, seg(lt, .6, 1.6), 150, { w: 500 }); title('СВЕТИТЕСЬ', 470, seg(lt, 1.0, 2.0), 96); },
  hands(lt, D, t) { SETS.room.visible = true; const r = eio(seg(lt, 0, 1.0)); youP.userData.arms.forEach((a, i) => { a.rotation.x = -lerp(.9, 1.15, r); a.rotation.z = (i ? 1 : -1) * .12; a.userData.fore.rotation.x = -lerp(.4, 1.0, r); }); youP.userData.head.rotation.x = .35 * r;
    glowLevel(youP, 1.6 + .5 * Math.sin(t * 2)); keyAt(.8, 2.5, 1.5, 0, 1.2, .3, 4, '#5a7ae0'); rim.intensity = .8; rim.position.set(-2, 2, -2); look(.45, 1.55, 1.25, 0, 1.3, .1, 32); P.dof.aper = 3;
    title('ДА-ДА,', 320, seg(lt, .2, 1), 96); title('ВЫ', 450, seg(lt, .6, 1.4), 140, { w: 500 }); },
  mirror(lt, D, t) { SETS.room.visible = true; mirror.visible = true; youP.rotation.y = Math.PI; youP.position.set(0, -.36, -.6); room.userData.chair.visible = false; glowLevel(youP, .25);
    keyAt(1, 2.5, 1, 0, 1.3, -1.2, 2.5, '#4a6ad0'); look(.35, 1.45, .9, 0, 1.35, -1.4, 34); P.dof.aper = 4;
    title('ПОЧЕМУ', 320, seg(lt, .3, 1.1), 110); title('МЫ НЕ ВИДИМ?', 450, seg(lt, .7, 1.5), 84); },
  lab(lt, D, t) { SETS.lab.visible = true; amb.intensity = .35; keyAt(2, 4, 3, 0, 1.2, 0, 10, '#7a9aff', .6); rim.intensity = 1.2; rim.position.set(40 - 3, 3, -3); rim.target.position.set(40, 1, 0); drawMonitor(t, .15);
    const a = .5 + lt * .06; look(40 + Math.sin(a) * 3.4, 1.7, Math.cos(a) * 3.4, 40, 1.25, 0, 34);
    title('2009', 330, seg(lt, .3, 1.1), 170, { w: 500, sp: .1 }); title('ЯПОНИЯ', 480, seg(lt, .8, 1.6), 64); },
  dark(lt, D, t) { SETS.lab.visible = true; amb.intensity = .04; seatedPose(subject); glowLevel(subject, 1.6); bigCam.children[3].material.color.set('#300808'); const u = eio(lt / D);
    look(40 + .75, 1.5, lerp(1.4, .9, u), 40, 1.2, -4, 30, 5.0); P.dof.aper = 7; bigCam.position.set(0, 1.3, 0);
    title('ПОЛНАЯ ТЕМНОТА', 330, seg(lt, .3, 1.1), 84); },
  photo(lt, D, t) { SETS.lab.visible = true; amb.intensity = .05; drawMonitor(t, eio(seg(lt, .3, 2.0)));
    const u = eio(lt / D); look(40 - 1.1 + Math.sin(.5) * lerp(1.6, .9, u), 1.35, -.4 + Math.cos(.5) * lerp(1.6, .9, u), 40 - 1.1, 1.35, -.4, 30); P.bloom.strength = 1.4;
    title('СВЕЧЕНИЕ', 300, seg(lt, .8, 1.6), 110); label('сверхчувствительная камера · 2009', 540, 420, seg(lt, 1.3, 2.0), 36, '#9ab8e8'); },
  eye(lt, D, t) { SETS.eye.visible = true; amb.intensity = .3; keyAt(80 + 2, 2, 4, 80, 0, 0, 8, '#ffd8c0', .4); P.bloom.threshold = .8; faintDot.material.opacity = .25 + .15 * Math.sin(t * 3);
    eyeball.rotation.y = -Math.PI / 2 + Math.sin(t * .5) * .08; const u = eio(lt / D); look(80 + lerp(.8, .4, u), lerp(.3, .2, u), lerp(5, 3.8, u), 80 + .3, .4, 0, 34, 3.8); P.dof.aper = 4;
    title('× 1000', 320, seg(lt, .6, 1.4), 150, { w: 500, sp: .05 }); title('СЛАБЕЕ', 470, seg(lt, 1.0, 1.8), 84); },
  face(lt, D, t) { SETS.face.visible = true; faceGlow.uniforms.k.value = eo(seg(lt, .2, 2.0)) * (.9 + .1 * Math.sin(t * 2)); const a = Math.sin(lt * .25) * .35;
    look(120 + Math.sin(a) * 3.6, .1, Math.cos(a) * 3.6, 120, .05, 0, 34); P.bloom.strength = 1.0; P.bloom.threshold = .45;
    label('ЛОБ', 540, 640, seg(lt, 1.3, 1.9), 46); label('ЩЁКИ', 540, 1240, seg(lt, 1.7, 2.3), 46); title('ЛИЦО', 330, seg(lt, .3, 1.1), 120); },
  clock(lt, D, t) { SETS.clock.visible = true; amb.intensity = .3; keyAt(160 + 1.5, 1.5, 2, 160, 0, 0, 8, '#ffe0c0', .5); const hr = lt * 2.2; hM.rotation.z = -hr * Math.PI * 2; hH.rotation.z = -hr / 12 * Math.PI * 2;
    glowLevel(clockP, .3 + .5 * (.5 + .5 * Math.sin(hr / 12 * Math.PI * 2 - 1.2))); look(160 + .3, .05, 3.0, 160 + .25, -.1, 0, 36);
    title('В ТЕЧЕНИЕ ДНЯ', 300, seg(lt, .3, 1.1), 84); },
  morning(lt, D, t) { SETS.room.visible = true; win.visible = true; win.userData.pane.material.color.set('#ffd8b0'); beams.forEach(b => { b.visible = true; b.material.opacity = .06; b.material.color.set('#ffd0a0'); }); seatedPose(youP); glowLevel(youP, .08);
    amb.intensity = .35; amb.color.set('#4a5a7a'); keyAt(1.6, 2, -1.8, 0, 1.2, 0, 8, '#ffc8a0'); P.vig.uniforms.warm.value = .3; look(-.6, 1.4, 1.6, .1, 1.3, 0, 34);
    title('УТРОМ', 320, seg(lt, .3, 1.1), 120); label('свечение слабее всего', 540, 450, seg(lt, .9, 1.6)); },
  evening(lt, D, t) { SETS.room.visible = true; win.visible = true; win.userData.pane.material.color.set('#ff9a50'); beams.forEach(b => { b.visible = true; b.material.opacity = .13; b.material.color.set('#ffa060'); }); seatedPose(youP); glowLevel(youP, .55 + .2 * Math.sin(t * 1.5));
    amb.intensity = .3; amb.color.set('#5a3a3a'); keyAt(1.6, 1.6, -1.8, 0, 1.2, 0, 12, '#ff9a50'); P.vig.uniforms.warm.value = .8; look(-.5, 1.38, 1.3, .1, 1.3, 0, 34);
    title('ВЕЧЕРОМ', 320, seg(lt, .3, 1.1), 120, { glow: 'rgba(255,170,90,.9)', fill: '#fff0e0' }); label('ярче всего', 540, 450, seg(lt, .9, 1.6), 44, '#ffd8b0'); },
  cells(lt, D, t) { SETS.cells.visible = true; amb.intensity = .4; amb.color.set('#4a2a3a'); keyAt(200 + 3, 4, 6, 200, 0, -3, 12, '#ff9ab0', .8);
    sparks.material.opacity = .6 + .4 * Math.sin(t * 9); sparks.material.size = .06 + .04 * Math.abs(Math.sin(t * 5)); cells.forEach((c, k) => { c.rotation.y = t * .2 + k; });
    look(200 + Math.sin(lt * .2) * .6, lerp(-1, 1, eio(lt / D)), 6, 200, 0, -2, 40, 6); P.dof.aper = 9;
    title('ХИМИЯ КЛЕТОК', 300, seg(lt, .3, 1.1), 88, { glow: 'rgba(255,140,190,.9)' }); },
  fireflies(lt, D, t) { SETS.meadow.visible = true; amb.intensity = .12; amb.color.set('#2a3a6a'); rim.intensity = .5; rim.position.set(240 + 4, 9, -20); rim.target.position.set(240, 0, 0);
    const p = flyGeo.attributes.position; for (let i = 0; i < FN; i++) { p.setXYZ(i, (hash(i) - .5) * 10 + Math.sin(t * .7 + i) * .4, .3 + hash(i + 1) * 2.2 + Math.sin(t * 1.1 + i * 2) * .15, -hash(i + 2) * 12 + 2); } p.needsUpdate = true;
    flies.material.opacity = .9; flies.material.size = .05 + .02 * Math.sin(t * 6); look(240 + lerp(-.5, .5, eio(lt / D)), .7, 4.2, 240, 1.0, -2, 40, 4); P.bloom.strength = 1.6; P.bloom.threshold = .2;
    title('СВЕТЛЯЧКИ', 300, seg(lt, .3, 1.1), 110, { glow: 'rgba(210,255,110,.9)', fill: '#f4ffe0' }); },
  sea(lt, D, t) { SETS.sea.visible = true; S.background.set('#010612'); S.fog = new THREE.FogExp2('#020a1a', .09); amb.intensity = .2; amb.color.set('#1a3a6a');
    jellies.forEach((j, k) => { j.position.y += Math.sin(t * .8 + j.userData.ph) * .002; j.scale.y = j.scale.x * (1 + .12 * Math.sin(t * 2 + j.userData.ph)); j.children[0].material.emissiveIntensity = 1.2 + .8 * Math.sin(t * 1.5 + k); });
    fish.forEach((f, k) => { f.position.x = ((hash(k + 20) - .5) * 6 + t * .4 * (k % 2 ? 1 : -1) + 30) % 6 - 3; f.rotation.y = k % 2 ? 0 : Math.PI; });
    marine.position.y = (t * .15) % 2; look(280 + Math.sin(lt * .2) * .5, lerp(.8, -.6, eio(lt / D)), 5, 280, 0, -3, 42, 5); P.bloom.strength = 1.5; P.bloom.threshold = .25; P.dof.aper = 5;
    title('ГЛУБИНЫ', 300, seg(lt, .3, 1.1), 110, { glow: 'rgba(90,240,255,.9)' }); label('светится большинство жителей', 540, 430, seg(lt, 1.0, 1.7), 40, '#a8f0ff'); },
  shrooms(lt, D, t) { SETS.forest.visible = true; amb.intensity = .1; amb.color.set('#1a2a1a'); spores.position.y = (t * .08) % .6; look(320 + lerp(-.6, .4, eio(lt / D)), 1.0, 2.6, 320 - .3, .6, 0, 36, 2.6); P.bloom.strength = 1.1; P.bloom.threshold = .4; P.dof.aper = 5;
    title('ГРИБЫ', 300, seg(lt, .3, 1.1), 120, { glow: 'rgba(130,255,110,.9)', fill: '#eaffe0' }); },
  switch(lt, D, t) { SETS.room.visible = true; switchG.visible = true; finger.visible = true; bedG.visible = true; lamp.visible = true; nightstand.visible = true; youP.visible = false; room.userData.chair.visible = false;
    const off = lt > D * .55; const pr = seg(lt, D * .35, D * .55); finger.position.set(-1.4 + .02, 1.22 - .05 * (1 - pr), -2.18 + lerp(.4, .05, eo(pr))); finger.rotation.set(-.3, 0, .3); switchG.userData.tog.rotation.x = off ? .5 : -.5;
    lamp.userData.shade.material.emissiveIntensity = off ? 0 : 1.2; warm.intensity = off ? 0 : 14; warm.position.set(-.7, 1.4, -1.6); amb.intensity = off ? .15 : .9; amb.color.set('#6a5a4a'); keyAt(-.6, 2, -.6, -1.4, 1.3, -2.18, off ? .6 : 5, off ? '#4a5a9a' : '#ffc890', .5);
    look(-1.05, 1.32, -1.45, -1.4, 1.28, -2.18, 36, .78); P.dof.aper = 5; title('ВЫКЛЮЧИВ СВЕТ…', 300, seg(lt, .3, 1.1), 80, { glow: 'rgba(255,190,120,.9)' }); },
  bed(lt, D, t) { SETS.room.visible = true; bedG.visible = true; sleeper.visible = true; lamp.visible = true; nightstand.visible = true; youP.visible = false; room.userData.chair.visible = false; glowLevel(sleeper, .45 + .15 * Math.sin(t * 1.2));
    amb.intensity = .12; keyAt(1.2, 3.2, .2, .6, .8, -2, 7, '#5a6ab0', .6); const u = eio(lt / D); look(lerp(2.8, 2.4, u), lerp(2.4, 2.1, u), lerp(1.4, 1.0, u), .6, .75, -.9, 38);
    title('ВЫ НИКОГДА', 300, seg(lt, .3, 1.1), 96, { glow: 'rgba(255,200,140,.9)' }); title('НЕ В ПОЛНОЙ ТЕМНОТЕ', 420, seg(lt, .8, 1.6), 66, { glow: 'rgba(255,200,140,.9)' }); },
  sub(lt, D, t) { SETS.town.visible = true; amb.intensity = .15; look(360, lerp(1.5, 5, eio(lt / D)), 10, 360, lerp(6, 12, eio(lt / D)), -20, 50, 40); P.dof.aper = 1; P.bloom.strength = 1.2; P.bloom.threshold = .3;
    title('ФАКТЫ', 330, seg(lt, .6, 1.5), 150, { w: 500 }); title('ЗА МИНУТУ', 470, seg(lt, 1.0, 1.9), 92); label('ПОДПИСЫВАЙТЕСЬ', 540, 1260, seg(lt, 1.6, 2.3), 52, '#ffe0a0'); },
};
function drawMonitor(t, k) {
  const g = monTex.g, w = 512, h = 384; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data; let s = Math.floor(t * 12) * 7919;
  for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = (s / 0x7fffffff) * 40; d[i] = n * .5; d[i + 1] = n * .6; d[i + 2] = n; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  if (k > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.filter = 'blur(10px)'; g.fillStyle = `rgba(110,160,255,${.75 * k})`; g.beginPath(); g.ellipse(256, 130, 44, 54, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(256, 300, 105, 110, 0, 0, 7); g.fill(); g.fillStyle = `rgba(200,220,255,${.6 * k})`; g.beginPath(); g.ellipse(240, 120, 14, 12, 0, 0, 7); g.ellipse(275, 120, 14, 12, 0, 0, 7); g.fill(); g.restore(); }
  monTex.tex.needsUpdate = true;
}

// ———————————————————————————— subtitles
function wrap(s, maxW) { const words = s.split(' '), L = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c2.measureText(t2).width > maxW && cur) { L.push(cur); cur = w; } else cur = t2; } if (cur) L.push(cur); return L; }
const SUBS = (() => { const out = VO.map(v => ({ text: v.text, a: v.t - .05, b: v.t + v.d })); out.forEach((p, i) => { p.b = Math.max(p.b + .6, p.a + 1.8); if (out[i + 1]) p.b = Math.min(p.b, out[i + 1].a); }); return out; })();
function subs(t) {
  if (qs.get('nosub')) return; const v = SUBS.find(s => t >= s.a && t < s.b); if (!v) return; const f = seg(t, v.a, v.a + .2) * (1 - seg(t, v.b - .15, v.b));
  c2.save(); c2.globalAlpha = f; c2.font = '600 50px Inter'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  const L = wrap(v.text, 940), y0 = H - 250 - (L.length - 1) * 64;
  L.forEach((s, i) => { c2.shadowColor = 'rgba(0,0,0,.95)'; c2.shadowBlur = 14; c2.fillStyle = '#ffffff'; c2.fillText(s, W / 2, y0 + i * 64); c2.fillText(s, W / 2, y0 + i * 64); });
  c2.restore();
}

// ———————————————————————————— frame
function render(t) {
  const k = sceneIdx(t), s = SC[k], lt = t - s.t0, D = s.t1 - s.t0;
  hideAll(); youP.rotation.y = 0; youP.position.set(0, -.36, .05); c2.clearRect(0, 0, W, H);
  SH[s.name](lt, D, t);
  // fade through black between scenes (cinematic dip)
  const fin = seg(lt, 0, .35), fout = 1 - seg(lt, D - .3, D); P.vig.uniforms.fade.value *= Math.min(fin, k === SC.length - 1 ? 1 : fout) * 0.999 + .001;
  P.composer.render();
  // letterbox-free; film grain on the overlay
  c2.save(); c2.globalAlpha = .05; for (let i = 0; i < 900; i++) { const x = hash(i + Math.floor(t * 24) * 13.1) * W, y = hash(i * 7.3 + Math.floor(t * 24)) * H; c2.fillStyle = i % 2 ? '#fff' : '#000'; c2.fillRect(x, y, 2, 2); } c2.restore();
  subs(t);
  if (t > TL.DUR - .8) { c2.fillStyle = `rgba(0,0,0,${seg(t, TL.DUR - .8, TL.DUR)})`; c2.fillRect(0, 0, W, H); }
}
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ type, t: +t.toFixed(3), ...o });
  for (const s of SC) add('cut', s.t0, { name: s.name, d: s.t1 - s.t0 });
  const X = Object.fromEntries(SC.map(s => [s.name, s])), at = (n, dt) => X[n].t0 + dt;
  add('boom', at('you', .6)); add('shimmer', at('hands', .2), { d: 2 }); add('hit', at('lab', .3)); add('shutter', at('dark', .8)); add('shutter', at('dark', 1.6)); add('rise', at('photo', .3), { d: 2.2 }); add('hit', at('eye', .6));
  add('shimmer', at('face', .4), { d: 2.5 }); add('tick', at('clock', 0), { d: X.clock.t1 - X.clock.t0 }); add('birds', at('morning', 0), { d: X.morning.t1 - X.morning.t0 });
  add('sparkle', at('cells', .2), { d: X.cells.t1 - X.cells.t0 - .3 }); add('crickets', at('fireflies', 0), { d: X.fireflies.t1 - X.fireflies.t0 }); add('underwater', at('sea', 0), { d: X.sea.t1 - X.sea.t0 });
  add('forest', at('shrooms', 0), { d: X.shrooms.t1 - X.shrooms.t0 }); add('click', at('switch', (X.switch.t1 - X.switch.t0) * .55)); add('boom', at('sub', .6), { v: .7 });
  for (const p of SUBS) add('sub', Math.max(0, p.a), { t1: +p.b.toFixed(3), text: p.text });
  return ev.sort((a, b) => a.t - b.t);
}
window.DUR = TL.DUR; window.SC = SC; window.VO = VO; window.render = render;
await document.fonts.load('300 90px Oswald', 'ВЫ'); await document.fonts.load('500 90px Oswald', 'ВЫ'); await document.fonts.load('600 50px Inter', 'Вы');
window.EV = events();
render(parseFloat(qs.get('t') ?? '2'));
window.READY = true;
