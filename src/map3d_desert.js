'use strict';
/* ============================================================
   BLACKSITE ZERO 3D — SAND RIDGE OUTPOST (new layout)
   ============================================================ */
function buildDesert(renderer) {
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  const colliders = [], zones = [], crates = [], lamps = [], animated = [], markers = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x22170f);
  scene.fog = new THREE.FogExp2(0x4a3422, .0105);
  const world = { scene, colliders, zones, crates, lamps, animated, markers };

  const sandCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#9b7f55'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 15000, '#5a452b', .18, 2);
    noiseOn(g, w, h, 6000, '#d2b47f', .1, 1.4);
    for (let i = 0; i < 28; i++) {
      g.strokeStyle = 'rgba(74,53,31,' + (.08 + Math.random() * .12) + ')'; g.lineWidth = 1 + Math.random() * 2;
      g.beginPath(); const y = Math.random() * h;
      for (let x = 0; x <= w; x += 14) g.lineTo(x, y + Math.sin(x * .028 + i) * 9);
      g.stroke();
    }
  });
  const wallCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#8c7454'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 9000, '#4a3722', .2, 2.2);
    noiseOn(g, w, h, 3000, '#c5a97a', .08, 1.5);
    g.strokeStyle = 'rgba(46,33,20,.45)'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 96) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
  const metalCv = glCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4840'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = x % 32 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 8, h); }
    noiseOn(g, w, h, 3000, '#1b1a14', .2, 2);
  });
  const hazardCv = glCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#17140f'; g.fillRect(0, 0, w, h); g.save(); g.translate(-60, 0); g.rotate(-.6);
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#c8a23c' : '#17140f'; g.fillRect(i * 48, -80, 24, 420); }
    g.restore();
  });
  const tSand = texFromCanvas(sandCv, 28, 28, aniso);
  const tWall = texFromCanvas(wallCv, 2, 2, aniso);
  const tMetal = texFromCanvas(metalCv, 2, 1, aniso);
  const tHazard = texFromCanvas(hazardCv, 2, 1, aniso);
  const MAT = {
    sand: new THREE.MeshStandardMaterial({ map: tSand, color: 0xb59a6d, roughness: .98, metalness: .01 }),
    wall: new THREE.MeshStandardMaterial({ map: tWall, color: 0xa98a5c, roughness: .94, metalness: .03 }),
    wallDark: new THREE.MeshStandardMaterial({ map: tWall, color: 0x78603f, roughness: .92, metalness: .06 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x8a7d64, roughness: .9, metalness: .08 }),
    metal: new THREE.MeshStandardMaterial({ map: tMetal, color: 0x9a9682, roughness: .65, metalness: .4 }),
    metalDark: new THREE.MeshStandardMaterial({ map: tMetal, color: 0x5d5b4c, roughness: .7, metalness: .45 }),
    container: new THREE.MeshStandardMaterial({ map: tMetal, color: 0x8b7652, roughness: .82, metalness: .2 }),
    hazard: new THREE.MeshStandardMaterial({ map: tHazard, color: 0xb8ad8c, roughness: .85 }),
    black: new THREE.MeshStandardMaterial({ color: 0x12100c, roughness: .85, metalness: .2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x233034, roughness: .2, metalness: .7, transparent: true, opacity: .5 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x2a1a0b, emissive: 0xffb454, emissiveIntensity: 2.2 }),
    green: new THREE.MeshStandardMaterial({ color: 0x0d1a12, emissive: 0x62ff9a, emissiveIntensity: 2.2 }),
    cool: new THREE.MeshStandardMaterial({ color: 0x1a2020, emissive: 0xa8d8c8, emissiveIntensity: 1.2 })
  };

  function addCollider(cx, cz, w, d, minY, maxY, tag = 'wall') {
    const c = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY, maxY, tag }; colliders.push(c); return c;
  }
  function box(w, h, d, x, y, z, mat, opt = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z);
    if (opt.rotY) m.rotation.y = opt.rotY; m.castShadow = opt.cast !== false; m.receiveShadow = true; scene.add(m);
    if (opt.collide !== false) addCollider(x, z, opt.cw || w, opt.cd || d, y, y + h, opt.tag || 'prop');
    return m;
  }
  function cylinder(r, h, x, y, z, mat, seg = 12, opt = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; scene.add(m);
    if (opt.collide) addCollider(x, z, r * 2, r * 2, y, y + h, opt.tag || 'prop'); return m;
  }
  function wallX(x1, x2, z, h = 3.2, t = .4, mat = MAT.wall, tag = 'wall') {
    return box(Math.abs(x2 - x1), h, t, (x1 + x2) / 2, 0, z, mat, { collide: true, tag, cw: Math.abs(x2 - x1), cd: t });
  }
  function wallZ(z1, z2, x, h = 3.2, t = .4, mat = MAT.wall, tag = 'wall') {
    return box(t, h, Math.abs(z2 - z1), x, 0, (z1 + z2) / 2, mat, { collide: true, tag, cw: t, cd: Math.abs(z2 - z1) });
  }
  function roof(x1, z1, x2, z2, y, mat = MAT.metalDark) {
    box(Math.abs(x2 - x1), .22, Math.abs(z2 - z1), (x1 + x2) / 2, y, (z1 + z2) / 2, mat, { collide: false, cast: false });
    addCollider((x1 + x2) / 2, (z1 + z2) / 2, Math.abs(x2 - x1), Math.abs(z2 - z1), y, y + .22, 'roof');
  }
  function glow(x, y, z, color, scale = 5, op = .35) {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: op });
    const s = new THREE.Sprite(mat); s.position.set(x, y, z); s.scale.set(scale, scale, 1); scene.add(s); return s;
  }
  function sign(title, sub, x, y, z, w, h, rot = 0, accent = '#ffb454') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textSign(title, sub, accent), transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = rot; scene.add(m);
  }
  function point(x, y, z, color, int, dist) { const l = new THREE.PointLight(color, int, dist, 2); l.position.set(x, y, z); scene.add(l); lamps.push(l); return l; }

  /* lights */
  scene.add(new THREE.HemisphereLight(0xffc98a, 0x33200f, .8));
  const sun = new THREE.DirectionalLight(0xffb36b, 1.25);
  sun.position.set(-55, 42, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 180; sun.shadow.bias = -.0008; scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6a4a2e, .25));

  /* ground & dunes */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), MAT.sand); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * TAU, r = 92 + Math.random() * 32;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 18, 14, 8), MAT.sand);
    dune.scale.set(1.8, .28, .9); dune.rotation.y = Math.random() * TAU;
    if (Math.hypot(Math.cos(a) * r - 40, Math.sin(a) * r - 38) < 30) continue;
    dune.position.set(Math.cos(a) * r, -1.2, Math.sin(a) * r); dune.receiveShadow = true; scene.add(dune);
  }

  /* perimeter */
  for (let i = -56; i <= 56; i += 4) {
    box(.12, 2.2, .12, i, 0, -56, MAT.metalDark, { collide: false, cast: false });
    box(.12, 2.2, .12, i, 0, 56, MAT.metalDark, { collide: false, cast: false });
    box(.12, 2.2, .12, -56, 0, i, MAT.metalDark, { collide: false, cast: false });
    box(.12, 2.2, .12, 56, 0, i, MAT.metalDark, { collide: false, cast: false });
  }
  addCollider(0, -56, 112, .2, 0, 2.4, 'fence'); addCollider(0, 56, 112, .2, 0, 2.4, 'fence');
  addCollider(-56, 0, .2, 112, 0, 2.4, 'fence'); addCollider(56, 0, .2, 112, 0, 2.4, 'fence');

  /* outer compound walls with gates */
  wallX(-32, -14, 22, 3.4, .55, MAT.wall); wallX(-4, 18, 22, 3.4, .55, MAT.wall);
  wallX(-32, 10, -26, 3.4, .55, MAT.wall); wallZ(-26, -2, -32, 3.4, .55, MAT.wall);
  wallZ(8, 22, -32, 3.4, .55, MAT.wall); wallZ(-26, -2, 18, 3.4, .55, MAT.wall);
  wallZ(8, 22, 18, 3.4, .55, MAT.wall);
  box(8, 1, .65, -9, 2.4, 22, MAT.hazard, { collide: false });
  sign('前哨站', 'RIDGELINE OUTPOST // A-09', -9, 3.5, 22.35, 7, 1.8, 0);

  /* command bunker */
  const B = { x1: -4, z1: -52, x2: 22, z2: -30 };
  wallX(B.x1, 6, B.z1, 5.2, .65, MAT.concrete); wallX(14, B.x2, B.z1, 5.2, .65, MAT.concrete);
  wallZ(-52, -30, B.x1, 5.2, .65, MAT.concrete); wallZ(-52, -30, B.x2, 5.2, .65, MAT.concrete);
  wallX(B.x1, 7, B.z2, 5.2, .65, MAT.concrete); wallX(15, B.x2, B.z2, 5.2, .65, MAT.concrete);
  roof(B.x1, B.z1, B.x2, B.z2, 5.2, MAT.concrete);
  sign('地下指挥所', 'COMMAND // RESTRICTED', 11, 4.2, B.z2 + .35, 7, 1.8, 0, '#ff5364');
  point(9, 4.2, -40, 0xff5a5a, .7, 16);
  box(16, .2, .6, 9, 4.6, -41, MAT.hazard, { collide: false });
  // vault room inside
  wallX(6, 12, -40, 3.2, .35, MAT.metalDark); wallX(16, 22, -40, 3.2, .35, MAT.metalDark); wallZ(-52, -40, 6, 3.2, .35, MAT.metalDark);
  box(1.4, 1.2, 1.0, 18, 0, -45, MAT.metalDark, { collide: true, tag: 'vault' });
  sign('金库', 'VAULT // 09', 14, 2.6, -39.8, 4, 1.2, 0, '#ffb454');

  /* barracks */
  const Q = { x1: -52, z1: -22, x2: -32, z2: 2 };
  wallX(Q.x1, -46, Q.z1, 3.8, .35, MAT.wall); wallX(-38, Q.x2, Q.z1, 3.8, .35, MAT.wall);
  wallZ(-22, -12, Q.x1, 3.8, .35, MAT.wall); wallZ(0, 2, Q.x1, 3.8, .35, MAT.wall);
  wallZ(-22, -18, Q.x2, 3.8, .35, MAT.wall); wallZ(-10, 2, Q.x2, 3.8, .35, MAT.wall);
  wallX(Q.x1, Q.x2, Q.z2, 3.8, .35, MAT.wall);
  roof(Q.x1, Q.z1, Q.x2, Q.z2, 3.8);
  wallZ(-22, -16, -42, 3.1, .25, MAT.wall); wallZ(-12, -6, -42, 3.1, .25, MAT.wall); wallX(-52, -42, -6, 3.1, .25, MAT.wall);
  point(-42, 3.2, -12, 0xffcf9a, .9, 26);
  for (let i = 0; i < 4; i++) box(2.4, .12, .9, -47 + i * 4, .75, -4, MAT.metal, { collide: false });
  for (let i = 0; i < 5; i++) box(.8, 1.9, .5, -50, 0, -18 + i * 3, MAT.metalDark, { collide: true, tag: 'locker' });
  sign('兵营', 'BARRACKS // Q-02', -42, 2.8, 2.35, 5, 1.4, 0, '#67e8ff');

  /* motor pool hangar */
  const M = { x1: 24, z1: -22, x2: 48, z2: 6 };
  for (const [x, z] of [[M.x1, M.z1], [M.x2, M.z1], [M.x1, M.z2], [M.x2, M.z2]]) box(.3, 6, .3, x, 0, z, MAT.metalDark, { collide: true });
  roof(M.x1, M.z1, M.x2, M.z2, 6, MAT.metalDark);
  box(8, .6, 5, 36, 0, -8, MAT.metal, { collide: true, tag: 'truck' });
  for (let i = 0; i < 4; i++) { const w = cylinder(.55, .4, 31 + i * 3, .2, -8, MAT.black, 12, { collide: false }); w.rotation.z = Math.PI / 2; }
  point(36, 4.8, -8, 0xa8d8c8, .6, 24);
  sign('机修库', 'MOTOR POOL // M-03', 36, 5.0, 6.35, 6, 1.5, 0, '#ffb454');
  for (let i = 0; i < 6; i++) box(1.2, 1, 1.2, 27 + Math.random() * 15, 0, -20 + Math.random() * 22, MAT.container, { collide: true, tag: 'crate' });

  /* fuel depot */
  for (let i = 0; i < 3; i++) { cylinder(1.6, 3.2, -48 + i * 5, 0, 12, MAT.metal, 16, { collide: true, tag: 'tank' }); box(3.6, .3, 3.6, -48 + i * 5, 0, 12, MAT.hazard, { collide: false }); }
  for (let i = 0; i < 8; i++) cylinder(.35, .95, -50 + Math.random() * 10, 0, 18 + Math.random() * 4, i % 2 ? MAT.hazard : MAT.metalDark, 10, { collide: true });
  glow(-45, 1.5, 12, '#ffb454', 3, .2);

  /* watchtowers */
  function tower(x, z) {
    for (const dx of [-1.8, 1.8]) for (const dz of [-1.8, 1.8]) box(.18, 6, .18, x + dx, 0, z + dz, MAT.metalDark, { collide: true });
    box(5.4, .25, 5.4, x, 6, z, MAT.metalDark, { collide: true });
    box(5.6, 1, .08, x, 6.3, z - 2.7, MAT.metalDark, { collide: false });
    box(5.6, .12, 5.6, x, 7.3, z, MAT.metalDark, { collide: false });
    box(4, .05, 4, x, 7.42, z, MAT.cool, { collide: false, cast: false });
    glow(x, 7.2, z, '#ffc177', 4, .25);
    return { x, z, y: 6.4 };
  }
  const towers = [tower(-30, -24), tower(16, 20), tower(44, -26)];

  /* rocks / barriers outside */
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - .5) * 100, z = (Math.random() - .5) * 100;
    if (Math.abs(x) < 34 && Math.abs(z) < 26) continue;
    if (Math.hypot(x - 40, z - 38) < 14 || Math.hypot(x + 44, z - 40) < 14) continue;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + Math.random() * 3, 0), new THREE.MeshStandardMaterial({ color: 0x6d5b41, roughness: .95 }));
    r.position.set(x, .4, z); r.scale.y = .55; r.rotation.y = Math.random() * TAU; r.castShadow = true; scene.add(r);
    addCollider(x, z, 3, 3, 0, 2, 'rock');
  }
  for (let i = 0; i < 12; i++) {
    const x = -20 + Math.random() * 60, z = 8 + Math.random() * 30;
    box(1.6, 1.1, .8, x, 0, z, MAT.wallDark, { collide: true, tag: 'hesco' });
  }
  for (let i = 0; i < 5; i++) box(3, .9, .9, -28 + i * 4, 0, 20, MAT.wallDark, { collide: true, tag: 'sandbag' });

  /* loot */
  const lootMat = {
    military: new THREE.MeshStandardMaterial({ map: tWall, color: 0xb39a6d, roughness: .85 }),
    cache: new THREE.MeshStandardMaterial({ map: tMetal, color: 0x8a8a74, roughness: .7, metalness: .3 }),
    safe: new THREE.MeshStandardMaterial({ color: 0x3b3a30, roughness: .55, metalness: .6 }),
    medical: new THREE.MeshStandardMaterial({ color: 0xc0c9b8, roughness: .78 }),
    filing: new THREE.MeshStandardMaterial({ color: 0x625c47, roughness: .8 }),
    vaultsafe: new THREE.MeshStandardMaterial({ color: 0x3d3524, roughness: .45, metalness: .7 })
  };
  const lootDefs = [
    ['military', -38, -4], ['military', -30, 8], ['safe', -48, -16], ['filing', -38, -18],
    ['military', 30, -16], ['cache', 42, -4], ['military', 27, 2], ['safe', 44, -20],
    ['military', 2, 14], ['military', -16, 16], ['cache', 8, 4], ['medical', -44, 4],
    ['vaultsafe', 18, -45], ['cache', 10, -48], ['military', -20, -35], ['medical', 20, 10]
  ];
  for (const [type, x, z] of lootDefs) {
    const def = CONTAINER_DEFS[type]; const big = type === 'vaultsafe';
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(big ? 1.2 : .9, big ? 1 : .62, big ? 1 : .6), lootMat[type] || lootMat.military);
    body.position.y = big ? .5 : .31; body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 24), new THREE.MeshBasicMaterial({ color: type === 'vaultsafe' ? 0xb9a0ff : 0xffb454, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring);
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(.11), new THREE.MeshBasicMaterial({ color: type === 'vaultsafe' ? 0xb9a0ff : 0xffb454 })); mark.position.y = 1.2; g.add(mark);
    glow(x, 1.2, z, type === 'vaultsafe' ? '#b9a0ff' : '#ffb454', 1.4, .2);
    crates.push({ x, z, type, label: def.label, time: def.time, color: def.color, glyph: def.glyph, bias: def.bias, requires: def.requires, opened: false, group: g, mark, ring, body });
  }

  /* LZ */
  const EX = { x: -44, z: 40, r: 5.2 };
  const padCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#5b4a35'; g.fillRect(0, 0, w, h); noiseOn(g, w, h, 4000, '#2e2418', .2, 2);
    g.strokeStyle = 'rgba(255,210,150,.55)'; g.lineWidth = 5; g.beginPath(); g.arc(256, 256, 190, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(240,225,200,.7)'; g.font = '900 220px Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 256, 262);
    g.fillStyle = 'rgba(98,255,154,.5)'; g.font = '700 20px monospace'; g.fillText('LZ-09 // SAND RIDGE', 256, 420);
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: texFromCanvas(padCv, 1, 1, aniso), roughness: .9 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(EX.x, .03, EX.z); pad.receiveShadow = true; scene.add(pad);
  const zone = new THREE.Mesh(new THREE.CircleGeometry(EX.r, 40), new THREE.MeshBasicMaterial({ color: 0x62ff9a, transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false }));
  zone.rotation.x = -Math.PI / 2; zone.position.set(EX.x, .05, EX.z); scene.add(zone);
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(EX.r - .2, EX.r, 48), new THREE.MeshBasicMaterial({ color: 0x62ff9a, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
  zoneRing.rotation.x = -Math.PI / 2; zoneRing.position.set(EX.x, .06, EX.z); scene.add(zoneRing);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), MAT.green); l.position.set(EX.x + Math.cos(a) * (EX.r + .8), .12, EX.z + Math.sin(a) * (EX.r + .8)); scene.add(l); }
  point(EX.x, 3, EX.z, 0x62ff9a, 1.4, 24); glow(EX.x, 1.2, EX.z, '#62ff9a', 14, .24);
  // simple helicopter
  const heli = new THREE.Group(); heli.position.set(EX.x - 5, 0, EX.z + 2); heli.rotation.y = -.5; scene.add(heli);
  const hm = new THREE.MeshStandardMaterial({ color: 0x4e503c, roughness: .6, metalness: .4 });
  const fus = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2.3), hm); fus.position.y = 2.1; heli.add(fus);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 2), hm); nose.position.set(2.9, 2, 0); heli.add(nose);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(4.6, .4, .4), MAT.metalDark); boom.position.set(-4.4, 2.4, 0); heli.add(boom);
  const rotor = new THREE.Group(); rotor.position.y = 3.7; heli.add(rotor);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.4, .04, .2), MAT.metalDark); b.rotation.y = i * Math.PI / 2; rotor.add(b); }
  for (const dz of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(4.2, .1, .12), MAT.metalDark); s.position.set(0, .6, dz * 1.3); heli.add(s); }
  addCollider(EX.x - 5, EX.z + 2, 7, 3.2, 0, 3, 'helicopter');
  animated.push({ type: 'rotor', rotor, tailRotor: rotor });
  // smoke
  const smokeGeo = new THREE.BufferGeometry(); const SN = 60, sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = EX.x + (Math.random() - .5) * 3; sp[i * 3 + 1] = Math.random() * 7; sp[i * 3 + 2] = EX.z + 2 + (Math.random() - .5) * 3; }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ map: smokeTexture('rgba(255,210,120,'), color: 0xffd18a, size: 2.6, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(smoke); animated.push({ type: 'smoke', points: smoke, base: { x: EX.x, z: EX.z + 2 } });
  sign('LZ-09 撤离点', 'EXTRACTION // HOLD E', EX.x, 3.5, EX.z - 9, 6.5, 1.8, 0, '#62ff9a');

  /* spawn */
  const spawn = { x: 40, z: 38, yaw: 0.88 };
  const spad = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ color: 0x67e8ff, transparent: true, opacity: .12 }));
  spad.rotation.x = -Math.PI / 2; spad.position.set(spawn.x, .04, spawn.z); scene.add(spad);
  sign('入口', 'INSERTION // E-01', 44, 2.8, 41, 4.5, 1.2, .55, '#67e8ff');

  /* lamps */
  [[-20, 20], [26, 8], [-46, 26], [20, -28]].forEach(([x, z]) => {
    cylinder(.1, 7, x, 0, z, MAT.metalDark, 8, { collide: true });
    box(.8, .2, .45, x, 7.1, z, MAT.amber, { collide: false });
    point(x, 7, z, 0xffb454, 1.2, 36); glow(x, 7, z, '#ffc177', 6, .45);
  });

  /* nav */
  const CELL = 2, ORIGIN = -60, GN = 60, nav = { cell: CELL, origin: ORIGIN, n: GN, blocked: new Uint8Array(GN * GN) };
  for (let gy = 0; gy < GN; gy++) for (let gx = 0; gx < GN; gx++) {
    const x = ORIGIN + gx * CELL + 1, z = ORIGIN + gy * CELL + 1;
    let blocked = x < -55 || x > 55 || z < -55 || z > 55;
    if (!blocked) for (const c of colliders) {
      if (c.maxY < .25 || c.minY > 1.9) continue;
      if (x > c.minX - .45 && x < c.maxX + .45 && z > c.minZ - .45 && z < c.maxZ + .45) { blocked = true; break; }
    }
    nav.blocked[gy * GN + gx] = blocked ? 1 : 0;
  }
  world.nav = nav;
  world.navOpen = (x, z) => { const gx = Math.floor((x - ORIGIN) / CELL), gy = Math.floor((z - ORIGIN) / CELL); return gx >= 0 && gy >= 0 && gx < GN && gy < GN && !nav.blocked[gy * GN + gx]; };

  /* minimap */
  const mini = glCanvas(240, 240, (g) => {
    const s = 2;
    g.fillStyle = '#150f09'; g.fillRect(0, 0, 240, 240);
    g.strokeStyle = 'rgba(220,180,120,.06)';
    for (let i = 0; i < 240; i += 20) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 240); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(240, i); g.stroke(); }
    for (const c of colliders) {
      if (c.tag === 'roof' || c.tag === 'fence') continue;
      g.fillStyle = c.tag === 'rock' ? '#3d3021' : c.tag === 'tank' || c.tag === 'container' ? '#6b5637' : '#7d6747';
      g.fillRect((c.minX + 60) * s, (c.minZ + 60) * s, Math.max(1, (c.maxX - c.minX) * s), Math.max(1, (c.maxZ - c.minZ) * s));
    }
    g.strokeStyle = '#62ff9a'; g.lineWidth = 2; g.beginPath(); g.arc((EX.x + 60) * s, (EX.z + 60) * s, EX.r * s, 0, TAU); g.stroke();
    g.fillStyle = '#62ff9a'; g.font = '700 8px monospace'; g.textAlign = 'center'; g.fillText('LZ', (EX.x + 60) * s, (EX.z + 60) * s + 3);
  });

  /* enemies */
  const enemyDefs = [
    { type: 'guard', x: -42, z: -10, patrol: [[-48, -18], [-34, -18], [-34, -2], [-48, -2]] },
    { type: 'scav', x: -35, z: 12, patrol: [[-46, 8], [-32, 8], [-32, 18], [-46, 18]] },
    { type: 'smg', x: 30, z: -10, patrol: [[26, -18], [44, -18], [44, 2], [26, 2]] },
    { type: 'shotgun', x: 10, z: 10, patrol: [[0, 6], [14, 6], [14, 18], [0, 18]] },
    { type: 'sniper', x: towers[0].x, z: towers[0].z, y: towers[0].y, stationary: true },
    { type: 'smg', x: -20, z: -34, patrol: [[-28, -38], [-8, -38], [-8, -30], [-28, -30]] },
    { type: 'scav', x: 36, z: 26, patrol: [[26, 20], [44, 20], [44, 34], [26, 34]] },
    { type: 'shotgun', x: -48, z: 34, patrol: [[-52, 32], [-30, 32], [-30, 44]] },
    { type: 'boss', x: 14, z: -45, stationary: true },
    { type: 'guard', x: 8, z: -38, patrol: [[8, -50], [20, -50], [20, -34]] }
  ];

  world.enemyDefs = enemyDefs;
  world.lootCount = crates.length;
  world.baseCrates = crates.slice();
  world.miniBase = mini;
  world.extraction = { ...EX, name: 'LZ-09 沙脊', short: 'LZ-09', y: 0 };
  world.spawn = spawn;
  world.bossName = '沙蝎 · 卡里姆';
  world.inside = (x, z) => (x > B.x1 && x < B.x2 && z > B.z1 && z < B.z2) || (x > Q.x1 && x < Q.x2 && z > Q.z1 && z < Q.z2) || (x > M.x1 && x < M.x2 && z > M.z1 && z < M.z2);
  world.mapInfo = { id: 'desert', name: '沙脊 · 边境前哨', sub: '荒原封锁区 / 沙暴逼近', env: '沙暴 / 高温', threat: 5, window: '04:00', loot: '高价值物资', accent: '#ffb454', desc: '真正的前哨站布局：兵营、机修库、燃料库、地下指挥所与环形围墙。' };
  world.menu = { radius: 72, height: 31, z: 0, target: [0, 2, -2] };
  world.theme = 'desert';
  world.update = (dt, cam, inside) => {
    for (const a of animated) {
      if (a.type === 'rotor') { a.rotor.rotation.y += dt * 14; }
      else if (a.type === 'smoke') {
        const p = a.points.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) + dt * (1.4 + (i % 5) * .25);
          let x = p.getX(i) + Math.sin(performance.now() * .0007 + i) * dt * .6;
          if (y > 8) { y = .2; x = a.base.x + (Math.random() - .5) * 2; }
          p.setXYZ(i, x, y, p.getZ(i));
        }
        p.needsUpdate = true;
      }
    }
    for (const c of crates) {
      if (c.opened) continue;
      c.mark.rotation.y += dt * 1.6; c.mark.position.y = 1.15 + Math.sin(performance.now() * .002 + c.x) * .07;
      c.ring.material.opacity = .2 + Math.sin(performance.now() * .002 + c.z) * .1;
    }
    zone.material.opacity = .08 + Math.sin(performance.now() * .0025) * .04;
    zoneRing.material.opacity = .4 + Math.sin(performance.now() * .003) * .15;
  };
  world.scene = scene;
  world.getMarker = (x, z) => ({ x, z });
  return world;
}
