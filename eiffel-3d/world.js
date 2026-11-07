// Procedural cartoon world: the tower, Paris, people, props. Units: 1 = 1 m (tower ≈ 300 m + antenna).
import * as THREE from '/node_modules/three/build/three.module.js';

export const M = {};   // shared materials
export function mats() {
  const std = (c, r = .55, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...extra });
  Object.assign(M, {
    iron: std('#9a6440', .5), ironHot: std('#c4583a', .45), ironDark: std('#6e4630', .6),
    grass: std('#6cc35a', .9), path: std('#e8d2a0', .95), snow: std('#f4f8ff', .8), water: std('#3f8fd6', .2, { transparent: true, opacity: .92 }),
    trunk: std('#8a5a36', .9), leaf: std('#4fae4a', .85), leaf2: std('#7cc95a', .85),
    cloud: std('#ffffff', 1), wall: std('#f4e2c0', .9), wall2: std('#efd0a8', .9), roof: std('#5f6f8a', .7), roof2: std('#4f5c78', .7), window: std('#7cc6f0', .3),
    skin: std('#ffcfa8', .6), skin2: std('#e8a878', .6), white: std('#ffffff', .3), black: std('#1e1a22', .3), red: std('#e8453c', .5),
    yellow: std('#ffcc33', .5), blue: std('#3d7be0', .5), green: std('#3cb46e', .5), purple: std('#9a62d8', .5), orange: std('#ff8a3c', .5),
    gold: std('#ffc83a', .25, { metalness: .6, emissive: '#5a3a00', emissiveIntensity: .25 }),
    statue: std('#7cc8b0', .6, { transparent: true, opacity: .35, depthWrite: false }), statueSolid: std('#7cc8b0', .6),
    paper: std('#f7f0de', .9), grey: std('#9aa0aa', .7), brown: std('#7a4a2a', .7),
  });
}

// ———————————————— the tower
function boxBetween(list, a, b, th) { list.push([a, b, th]); }
const v = (x, y, z) => new THREE.Vector3(x, y, z);
export function tower(o = {}) {
  const segs = [];
  const H1 = 57, H2 = 116, H3 = 276, TOP = 300;
  // half-width of the whole tower at height h (outer corner), Eiffel-like curve
  const half = h => h < H2 ? 62 - (62 - 20) * Math.pow(h / H2, .75) : 20 * Math.pow(1 - (h - H2) / (TOP - H2), 1.35) + 1.6;
  const legSide = h => 16 - 8 * (h / H2);
  // four legs below the 2nd platform
  const step = 7;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let prev = null;
    for (let h = 0; h <= H2 + .1; h += step) {
      const c = half(h) - legSide(h) / 2, s = legSide(h) / 2, cx = sx * c, cz = sz * c;
      const cor = [v(cx - s, h, cz - s), v(cx + s, h, cz - s), v(cx + s, h, cz + s), v(cx - s, h, cz + s)];
      for (let k = 0; k < 4; k++) boxBetween(segs, cor[k], cor[(k + 1) % 4], .7);
      if (prev) for (let k = 0; k < 4; k++) { boxBetween(segs, prev[k], cor[k], 1.3); boxBetween(segs, prev[k], cor[(k + 1) % 4], .55); boxBetween(segs, prev[(k + 1) % 4], cor[k], .55); }
      prev = cor;
    }
  }
  // upper column
  let prev = null;
  for (let h = H2; h <= TOP + .1; h += 6) {
    const s = half(h), cor = [v(-s, h, -s), v(s, h, -s), v(s, h, s), v(-s, h, s)];
    for (let k = 0; k < 4; k++) boxBetween(segs, cor[k], cor[(k + 1) % 4], .6);
    if (prev) for (let k = 0; k < 4; k++) { boxBetween(segs, prev[k], cor[k], 1.2); boxBetween(segs, prev[k], cor[(k + 1) % 4], .45); boxBetween(segs, prev[(k + 1) % 4], cor[k], .45); }
    prev = cor;
  }
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1), inst = new THREE.InstancedMesh(geo, o.mat || M.iron, segs.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = v(0, 1, 0), sc = v(1, 1, 1), mid = v(0, 0, 0);
  segs.forEach(([a, b, th], i) => { const d = b.clone().sub(a), L = d.length(); q.setFromUnitVectors(up, d.normalize()); mid.copy(a).add(b).multiplyScalar(.5); sc.set(th, L + th * .5, th); m.compose(mid, q, sc); inst.setMatrixAt(i, m); });
  inst.castShadow = true; inst.receiveShadow = true; g.add(inst); g.userData.segs = segs.length;
  // arches between the legs
  for (let k = 0; k < 4; k++) {
    const r = 37, arc = new THREE.TorusGeometry(r, 1.8, 6, 24, Math.PI);
    const a = new THREE.Mesh(arc, o.mat || M.iron); a.position.y = 18; a.rotation.y = k * Math.PI / 2; a.translateZ(half(30) - 3); a.castShadow = true; g.add(a);
  }
  // platforms (with a slightly darker deck)
  for (const [h, w] of [[H1, half(H1) * 2 + 6], [H2, half(H2) * 2 + 4], [H3, half(H3) * 2 + 3]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, w), o.mat2 || M.ironDark); p.position.y = h; p.castShadow = true; p.receiveShadow = true; g.add(p);
  }
  // top + antenna
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 14, 10), o.mat || M.iron); top.position.y = TOP + 6; g.add(top);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1, 24, 8), M.white); ant.position.y = TOP + 25; g.add(ant); g.userData.antenna = ant;
  g.userData.top = TOP + 37;
  return g;
}

// ———————————————— environment
export function rounded(geo) { geo.computeVertexNormals(); return geo; }
export function tree(s = 1, seed = 0) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.6 * s, .9 * s, 6 * s, 8), M.trunk); t.position.y = 3 * s; t.castShadow = true; g.add(t);
  const crown = new THREE.Group(); crown.position.y = 6 * s; g.add(crown);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry((3 + (k % 2)) * s, 16, 12), k % 2 ? M.leaf2 : M.leaf); b.position.set(Math.cos(k * 1.7 + seed) * 2 * s, (1.5 + k * .8) * s, Math.sin(k * 1.7 + seed) * 2 * s); b.castShadow = true; crown.add(b); }
  g.userData.crown = crown; return g;
}
export function cloud(s = 1) {
  const g = new THREE.Group();
  for (const [x, y, r] of [[0, 0, 10], [11, -2, 8], [-11, -2, 8], [5, 5, 8], [-5, 4, 7]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r * s, 18, 14), M.cloud); b.position.set(x * s, y * s, 0); g.add(b); }
  return g;
}
export function house(w = 14, h = 16, d = 12, seed = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seed % 2 ? M.wall : M.wall2); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(w * .42, w * .62, 6, 4, 1), seed % 2 ? M.roof : M.roof2); roof.rotation.y = Math.PI / 4; roof.scale.z = d / w; roof.position.y = h + 3; roof.castShadow = true; g.add(roof);
  for (let r = 0; r < Math.floor(h / 5); r++) for (let c = 0; c < Math.floor(w / 4.5); c++) { const wdw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, .3), M.window); wdw.position.set(-w / 2 + 2.6 + c * 4.3, 3.5 + r * 4.6, d / 2 + .1); g.add(wdw); }
  return g;
}

// ———————————————— a cute round person
// opts: shirt, hat ('hard'|'top'|'beret'|null), mustache, size
export function person(o = {}) {
  const s = o.size || 1, g = new THREE.Group();
  const shirt = o.shirt || M.blue;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.55 * s, .7 * s, 6, 14), shirt); body.position.y = 1.0 * s; body.castShadow = true; g.add(body);
  for (const x of [-.25, .25]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(.16 * s, .35 * s, 4, 8), M.black); l.position.set(x * s, .3 * s, 0); g.add(l); }
  const head = new THREE.Group(); head.position.y = 2.15 * s; g.add(head);
  const hs = new THREE.Mesh(new THREE.SphereGeometry(.62 * s, 24, 18), o.skin || M.skin); hs.castShadow = true; head.add(hs);
  const eyes = [];
  for (const x of [-.22, .22]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(.17 * s, 14, 10), M.white); w.position.set(x * s, .08 * s, .52 * s); w.scale.z = .6; head.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.09 * s, 10, 8), M.black); p.position.set(x * s, .08 * s, .63 * s); head.add(p); eyes.push(p);
  }
  const brows = [];
  for (const x of [-.22, .22]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.26 * s, .06 * s, .06 * s), M.black); b.position.set(x * s, .33 * s, .58 * s); head.add(b); brows.push(b); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.12 * s, .03 * s, 6, 12, Math.PI), M.black); mouth.position.set(0, -.18 * s, .58 * s); mouth.rotation.z = Math.PI; head.add(mouth);
  if (o.mustache) { for (const x of [-.14, .14]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.07 * s, .2 * s, 4, 8), M.brown); m.rotation.z = Math.PI / 2 + (x > 0 ? -.35 : .35); m.position.set(x * s, -.08 * s, .62 * s); head.add(m); } }
  if (o.hat === 'hard') { const h = new THREE.Mesh(new THREE.SphereGeometry(.66 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.yellow); h.position.y = .1 * s; head.add(h); const b = new THREE.Mesh(new THREE.CylinderGeometry(.8 * s, .8 * s, .06 * s, 18), M.yellow); b.position.y = .12 * s; head.add(b); }
  if (o.hat === 'top') { const h = new THREE.Mesh(new THREE.CylinderGeometry(.42 * s, .42 * s, .7 * s, 16), M.black); h.position.y = .75 * s; head.add(h); const b = new THREE.Mesh(new THREE.CylinderGeometry(.7 * s, .7 * s, .06 * s, 16), M.black); b.position.y = .42 * s; head.add(b); }
  if (o.hat === 'beret') { const h = new THREE.Mesh(new THREE.SphereGeometry(.6 * s, 16, 8), M.red); h.scale.y = .35; h.position.set(.1 * s, .55 * s, 0); head.add(h); }
  if (o.hair) { const h = new THREE.Mesh(new THREE.SphereGeometry(.64 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), o.hair); h.position.set(0, .05 * s, -.05 * s); head.add(h); }
  const arms = [];
  for (const x of [-1, 1]) { const a = new THREE.Group(); a.position.set(x * .62 * s, 1.45 * s, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.13 * s, .55 * s, 4, 8), shirt); m.position.y = -.38 * s; a.add(m); const hd = new THREE.Mesh(new THREE.SphereGeometry(.15 * s, 10, 8), o.skin || M.skin); hd.position.y = -.75 * s; a.add(hd); a.rotation.z = x * .15; g.add(a); arms.push(a); }
  g.userData = { head, eyes, brows, mouth, arms, s };
  return g;
}
// expressions: 'happy' | 'angry' | 'worried' | 'wow'
export function face(p, e) {
  const { brows, mouth, s } = p.userData;
  const tilt = e === 'angry' ? .45 : e === 'worried' ? -.4 : 0;
  brows[0].rotation.z = -tilt; brows[1].rotation.z = tilt;
  brows.forEach(b => b.position.y = (e === 'wow' ? .4 : .33) * s);
  mouth.rotation.z = (e === 'angry' || e === 'worried') ? 0 : Math.PI;
  mouth.position.y = (e === 'angry' || e === 'worried' ? -.26 : -.18) * s;
  mouth.scale.setScalar(e === 'wow' ? 1.5 : 1);
}
