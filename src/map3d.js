'use strict';
/* ============================================================
   BLACKSITE ZERO 3D — procedural sector builder
   ============================================================ */
const M3 = { colliders: [], zones: [], crates: [], lamps: [], animated: [], markers: [] };
const glCanvas = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h); return c;
};
function texFromCanvas(c, repX = 1, repY = 1, aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = aniso;
  t.encoding = THREE.sRGBEncoding;
  return t;
}
function noiseOn(g, w, h, n, color, alpha = .1, size = 2) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (.4 + Math.random() * .6);
    g.fillRect(Math.random() * w, Math.random() * h, Math.random() * size + .5, Math.random() * size + .5);
  }
  g.globalAlpha = 1;
}
function textSign(title, sub, accent = '#c8ff4f', w = 512, h = 160) {
  const c = glCanvas(w, h, (g) => {
    g.fillStyle = 'rgba(5,9,10,.0)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(4,7,8,.72)'; g.fillRect(0, 10, w, h - 20);
    g.strokeStyle = accent; g.globalAlpha = .75; g.lineWidth = 2;
    g.strokeRect(4, 14, w - 8, h - 28);
    g.globalAlpha = .9;
    g.fillStyle = accent; g.font = '700 20px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText(sub, 28, 52);
    g.fillStyle = '#e8f1ec'; g.font = '800 54px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText(title, 26, 118);
    g.fillStyle = accent; g.globalAlpha = .5; g.fillRect(28, 68, 90, 2);
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
function glowTexture(color = '#ffd9a0') {
  if (typeof color === 'number') color = '#' + color.toString(16).padStart(6, '0');
  return new THREE.CanvasTexture(glCanvas(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color); gr.addColorStop(.18, color); gr.addColorStop(.45, 'rgba(255,180,90,.28)'); gr.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }));
}
function smokeTexture(color = 'rgba(120,255,170,') {
  return new THREE.CanvasTexture(glCanvas(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color + '.55)'); gr.addColorStop(.4, color + '.22)'); gr.addColorStop(1, color + '0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }));
}
function rainTexture() {
  return new THREE.CanvasTexture(glCanvas(16, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(180,220,255,0)'); gr.addColorStop(.45, 'rgba(180,220,255,.75)'); gr.addColorStop(1, 'rgba(180,220,255,0)');
    g.fillStyle = gr; g.fillRect(6, 0, 3, 64);
  }));
}

function buildSector(renderer, theme = 'harbor') {
  const desert = theme === 'desert';
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  const colliders = [], zones = [], crates = [], lamps = [], animated = [], markers = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(desert ? 0x2b1d12 : 0x050b10);
  scene.fog = new THREE.FogExp2(desert ? 0x4a3521 : 0x071015, desert ? .011 : .0125);
  const world = { scene, colliders, zones, crates, lamps, animated, markers, nav: null, miniBase: null };

  /* ---------- textures ---------- */
  const concreteCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#4a4e49'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 9000, '#2b2f2b', .16, 2.2);
    noiseOn(g, w, h, 5000, '#757a72', .07, 1.5);
    g.strokeStyle = 'rgba(20,23,21,.5)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = 'rgba(18,21,19,' + (.15 + Math.random() * .2) + ')'; g.lineWidth = 1;
      g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (Math.random() - .5) * 60; y += Math.random() * 40; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(20,23,21,.18)'; g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 18 + Math.random() * 55, 8 + Math.random() * 25, Math.random() * 3, 0, Math.PI * 2); g.fill();
    }
  });
  const asphaltCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#242a29'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 14000, '#0e1313', .22, 2.4);
    noiseOn(g, w, h, 6000, '#59605b', .05, 1.2);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(8,11,11,.18)'; g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 25 + Math.random() * 80, 12 + Math.random() * 40, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(5,8,8,.4)'; g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - .5) * 40; y += (Math.random() - .3) * 30; g.lineTo(x, y); } g.stroke(); }
  });
  const sandCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#9b8058'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 16000, '#5a452c', .2, 2);
    noiseOn(g, w, h, 7000, '#d0b27d', .12, 1.4);
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = 'rgba(70,50,30,' + (.08 + Math.random() * .15) + ')'; g.lineWidth = 1 + Math.random() * 2;
      g.beginPath(); const y = Math.random() * h;
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * .03 + i) * 8);
      g.stroke();
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = 'rgba(210,190,150,' + (.08 + Math.random() * .2) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
    }
  });
  const wallCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#62665f'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 7000, '#333834', .16, 2.4);
    noiseOn(g, w, h, 3500, '#90978b', .06, 1.4);
    g.strokeStyle = 'rgba(24,28,25,.5)'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(30,34,30,.16)';
      g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 100, 2 + Math.random() * 6);
    }
    g.fillStyle = 'rgba(18,21,19,.4)'; g.fillRect(0, h - 24, w, 24);
  });
  const metalCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#3b4545'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = x % 32 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.16)'; g.fillRect(x, 0, 8, h);
    }
    noiseOn(g, w, h, 5000, '#111918', .18, 2);
    g.fillStyle = 'rgba(200,255,79,.06)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 30 + Math.random() * 80);
    g.strokeStyle = 'rgba(10,14,14,.6)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = 'rgba(10,14,14,.5)'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  });
  const containerCv = glCanvas(512, 256, (g, w, h) => {
    g.fillStyle = '#6a6f68'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 12) {
      g.fillStyle = x % 24 ? 'rgba(25,28,25,.3)' : 'rgba(255,255,255,.06)';
      g.fillRect(x, 16, 5, h - 32);
    }
    g.fillStyle = 'rgba(10,12,11,.65)'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 16, w, 16);
    noiseOn(g, w, h, 5000, '#2f2a20', .13, 2.5);
    g.fillStyle = 'rgba(20,23,21,.6)'; g.font = '700 18px monospace';
    g.fillText('GRAYHARBOR // 07', 24, h - 44);
    g.fillStyle = 'rgba(200,255,79,.2)'; g.fillRect(24, 44, 90, 2);
  });
  const crateCv = glCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4a34'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 3000, '#23251a', .18, 2);
    g.strokeStyle = 'rgba(20,22,15,.55)'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.strokeStyle = 'rgba(190,200,150,.16)'; g.lineWidth = 3; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = 'rgba(200,255,79,.32)'; g.font = '700 26px monospace'; g.fillText('07', 26, 56);
    g.fillStyle = 'rgba(230,240,220,.35)'; g.font = '12px monospace'; g.fillText('MIL-SUPPLY', 26, 76);
  });
  const hazardCv = glCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#151915'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(-64, 0); g.rotate(-.6);
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#c8a23c' : '#171b17'; g.fillRect(i * 48, -80, 24, 420); }
    g.restore();
    noiseOn(g, w, h, 1800, '#0a0d0a', .2, 2);
  });
  const roofCv = glCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#202727'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, 4, h); }
    noiseOn(g, w, h, 4000, '#090e0e', .2, 2);
    g.strokeStyle = 'rgba(180,200,190,.04)'; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  const texLoader = new THREE.TextureLoader();
  function pbrTex(name, kind, rx, ry, srgb = false) {
    if (!window.PBR_TEX || !window.PBR_TEX[name]) return null;
    const t = texLoader.load(window.PBR_TEX[name][kind]);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = aniso; t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    return t;
  }
  const asphD = pbrTex('asphalt_02', 'diff', 28, 28, true);
  const asphN = pbrTex('asphalt_02', 'nor_gl', 28, 28);
  const asphR = pbrTex('asphalt_02', 'rough', 28, 28);
  const wallD = pbrTex('concrete_wall_008', 'diff', 3, 2, true);
  const wallN = pbrTex('concrete_wall_008', 'nor_gl', 3, 2);
  const wallR = pbrTex('concrete_wall_008', 'rough', 3, 2);
  const concD = pbrTex('concrete_wall_008', 'diff', 8, 8, true);
  const concN = pbrTex('concrete_wall_008', 'nor_gl', 8, 8);
  const concR = pbrTex('concrete_wall_008', 'rough', 8, 8);
  const tCon = texFromCanvas(concreteCv, 8, 8, aniso);
  const tAsphalt = texFromCanvas(desert ? sandCv : asphaltCv, 26, 26, aniso);
  const tWall = texFromCanvas(wallCv, 2, 2, aniso);
  const tMetal = texFromCanvas(metalCv, 2, 1, aniso);
  const tContainer = texFromCanvas(containerCv, 2, 1, aniso);
  const tCrate = texFromCanvas(crateCv, 1, 1, aniso);
  const tHazard = texFromCanvas(hazardCv, 2, 1, aniso);
  const tRoof = texFromCanvas(roofCv, 8, 8, aniso);

  const MAT = {
    concrete: new THREE.MeshStandardMaterial({ map: concD || tCon, normalMap: concN, roughnessMap: concR, color: 0x737a71, roughness: .92, metalness: .06, normalScale: new THREE.Vector2(.45, .45) }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphD || tAsphalt, normalMap: asphN, roughnessMap: asphR, color: desert ? 0xb59a6d : 0x777e76, roughness: desert ? .97 : .88, metalness: desert ? .02 : .08, normalScale: new THREE.Vector2(.7, .7) }),
    wall: new THREE.MeshStandardMaterial({ map: wallD || tWall, normalMap: wallN, roughnessMap: wallR, color: desert ? 0xa18762 : 0x8a9087, roughness: .9, metalness: .07, normalScale: new THREE.Vector2(.55, .55) }),
    wallDark: new THREE.MeshStandardMaterial({ map: wallD || tWall, normalMap: wallN, roughnessMap: wallR, color: desert ? 0x6e5a40 : 0x555d58, roughness: .88, metalness: .12, normalScale: new THREE.Vector2(.55, .55) }),
    metal: new THREE.MeshStandardMaterial({ map: tMetal, color: 0x8b9692, roughness: .64, metalness: .45 }),
    metalDark: new THREE.MeshStandardMaterial({ map: tMetal, color: 0x455050, roughness: .7, metalness: .5 }),
    containerBlue: new THREE.MeshStandardMaterial({ map: tContainer, color: 0x4b6a72, roughness: .82, metalness: .25 }),
    containerRed: new THREE.MeshStandardMaterial({ map: tContainer, color: 0x80504a, roughness: .85, metalness: .2 }),
    containerGreen: new THREE.MeshStandardMaterial({ map: tContainer, color: 0x52654f, roughness: .84, metalness: .2 }),
    containerGrey: new THREE.MeshStandardMaterial({ map: tContainer, color: 0x6a716b, roughness: .82, metalness: .22 }),
    crate: new THREE.MeshStandardMaterial({ map: tCrate, color: 0xa8ab8a, roughness: .88, metalness: .12 }),
    crateDark: new THREE.MeshStandardMaterial({ map: tCrate, color: 0x656b52, roughness: .9, metalness: .1 }),
    hazard: new THREE.MeshStandardMaterial({ map: tHazard, color: 0xb9bfa7, roughness: .85, metalness: .1 }),
    roof: new THREE.MeshStandardMaterial({ map: tRoof, color: 0x6c7774, roughness: .83, metalness: .25 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b1112, roughness: .8, metalness: .3 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x202826, roughness: .5, metalness: .7 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x101413, roughness: .92 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x172a2e, roughness: .15, metalness: .8, transparent: true, opacity: .55 }),
    greenLight: new THREE.MeshStandardMaterial({ color: 0x0c1a14, emissive: 0x62ff9a, emissiveIntensity: 2.1, roughness: .3 }),
    amberLight: new THREE.MeshStandardMaterial({ color: 0x20180d, emissive: 0xffb454, emissiveIntensity: 2.4, roughness: .3 }),
    coolLight: new THREE.MeshStandardMaterial({ color: 0x142021, emissive: 0xbde8de, emissiveIntensity: 1.35, roughness: .2 }),
    skylight: new THREE.MeshStandardMaterial({ color: 0x0d1918, emissive: 0x5d817a, emissiveIntensity: .3, roughness: .55 }),
    redLight: new THREE.MeshStandardMaterial({ color: 0x1a0c0d, emissive: 0xff4058, emissiveIntensity: 2.2, roughness: .3 })
  };
  function matForContainer() { return [MAT.containerBlue, MAT.containerRed, MAT.containerGreen, MAT.containerGrey][Math.floor(Math.random() * 4)]; }

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(desert ? 0xffc98a : 0x5b7b91, desert ? 0x332010 : 0x0d0f0d, desert ? .78 : .62));
  const moon = new THREE.DirectionalLight(desert ? 0xffc078 : 0x9fc5e8, desert ? 1.15 : .58);
  moon.position.set(-48, 72, -38);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -72; moon.shadow.camera.right = 72;
  moon.shadow.camera.top = 72; moon.shadow.camera.bottom = -72;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 190;
  moon.shadow.bias = -.0008;
  scene.add(moon);
  const ambient = new THREE.AmbientLight(0x334449, .3); scene.add(ambient);

  /* ---------- helpers ---------- */
  function addCollider(cx, cz, w, d, minY, maxY, tag = 'wall') {
    const c = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY, maxY, tag };
    colliders.push(c); return c;
  }
  function box(w, h, d, x, yBottom, z, mat, opt = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, yBottom + h / 2, z);
    if (opt.rotY) m.rotation.y = opt.rotY;
    m.castShadow = opt.cast !== false; m.receiveShadow = opt.receive !== false;
    scene.add(m);
    if (opt.collide !== false) addCollider(x, z, opt.cw || w, opt.cd || d, yBottom, yBottom + h, opt.tag || 'prop');
    return m;
  }
  function cylinder(rTop, rBot, h, x, yBottom, z, mat, seg = 12, opt = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
    m.position.set(x, yBottom + h / 2, z); m.castShadow = opt.cast !== false; m.receiveShadow = true; scene.add(m);
    if (opt.collide) addCollider(x, z, rBot * 2, rBot * 2, yBottom, yBottom + h, opt.tag || 'prop');
    return m;
  }
  function wallX(x1, x2, z, h = 4, t = .35, mat = MAT.wall, tag = 'wall') {
    return box(Math.abs(x2 - x1), h, t, (x1 + x2) / 2, 0, z, mat, { collide: true, tag, cw: Math.abs(x2 - x1), cd: t });
  }
  function wallZ(z1, z2, x, h = 4, t = .35, mat = MAT.wall, tag = 'wall') {
    return box(t, h, Math.abs(z2 - z1), x, 0, (z1 + z2) / 2, mat, { collide: true, tag, cw: t, cd: Math.abs(z2 - z1) });
  }
  function roof(x1, z1, x2, z2, y, mat = MAT.roof) {
    const m = box(Math.abs(x2 - x1), .22, Math.abs(z2 - z1), (x1 + x2) / 2, y, (z1 + z2) / 2, mat, { cast: false, collide: false });
    addCollider((x1 + x2) / 2, (z1 + z2) / 2, Math.abs(x2 - x1), Math.abs(z2 - z1), y, y + .22, 'roof');
    return m;
  }
  function stripLight(x, z, len = 4, rot = 0, colorMat = MAT.coolLight, y = 6.7) {
    const m = box(len, .09, .18, x, y, z, colorMat, { collide: false, cast: false });
    m.rotation.y = rot;
    return m;
  }
  function signPlane(title, sub, x, y, z, w, h, rotY = 0, accent = '#c8ff4f') {
    const mat = new THREE.MeshBasicMaterial({ map: textSign(title, sub, accent), transparent: true, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
  }
  function glowSprite(x, y, z, color, scale = 6, opacity = .35) {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(color), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity });
    const s = new THREE.Sprite(mat); s.position.set(x, y, z); s.scale.set(scale, scale, 1); scene.add(s); return s;
  }
  function pointLight(x, y, z, color, intensity, distance) {
    const l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(x, y, z); scene.add(l); lamps.push(l); return l;
  }
  function addTowerLight(x, z, color = 0xffb454, withLight = true) {
    cylinder(.09, .13, 8.5, x, 0, z, MAT.metalDark, 8, { collide: true });
    box(.9, .28, .5, x, 8.5, z, MAT.black, { collide: false });
    const head = box(.65, .18, .4, x, 8.38, z, MAT.amberLight, { collide: false });
    const l = withLight ? pointLight(x, 8.2, z, color, 1.3, 45) : null;
    glowSprite(x, 8.15, z, '#ffc177', 7, .5);
    return l;
  }

  /* ---------- ground ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), MAT.asphalt);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true; scene.add(ground);
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(50, 55), MAT.concrete);
  slab.rotation.x = -Math.PI / 2; slab.position.set(17, .018, -19); slab.receiveShadow = true; scene.add(slab);
  const slab2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 34), MAT.concrete);
  slab2.rotation.x = -Math.PI / 2; slab2.position.set(-34, .019, -27); slab2.receiveShadow = true; scene.add(slab2);
  // road markings
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x9a9d7b, transparent: true, opacity: .22 });
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .16), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(-2 + i * 4, .03, 10.5); scene.add(l);
  }
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.14, 2.4), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(-52 + i * 4, .03, 26); scene.add(l);
  }
  // puddles
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0b1417, roughness: .12, metalness: .65, transparent: true, opacity: .7 });
  for (let i = 0; i < 22; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1 + Math.random() * 2.5, 12), puddleMat);
    p.rotation.x = -Math.PI / 2; p.scale.y = .4 + Math.random() * .4;
    const pos = [[-50, 34], [-20, 28], [12, 12], [42, 10], [-44, -8], [30, -48]][i % 6];
    p.position.set(pos[0] + (Math.random() - .5) * 16, .025, pos[1] + (Math.random() - .5) * 12); scene.add(p);
  }

  /* ---------- perimeter ---------- */
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x3b4644, roughness: .7, metalness: .55 });
  for (let i = -56; i <= 56; i += 4) {
    if (i < -50 || i > 48) continue;
    box(.1, 2.4, .1, i, 0, -56, fenceMat, { collide: false, cast: false });
    box(.1, 2.4, .1, i, 0, 56, fenceMat, { collide: false, cast: false });
  }
  for (let i = -56; i <= 56; i += 4) {
    if (i < -50 || i > 48) continue;
    box(.1, 2.4, .1, -56, 0, i, fenceMat, { collide: false, cast: false });
    box(.1, 2.4, .1, 56, 0, i, fenceMat, { collide: false, cast: false });
  }
  [[0, -56, 112, .18], [0, 56, 112, .18], [-56, 0, .18, 112], [56, 0, .18, 112]].forEach(([x, z, w, d]) => {
    box(w, .1, d, x, 2.2, z, fenceMat, { collide: false, cast: false });
    box(w, .1, d, x, 1.1, z, fenceMat, { collide: false, cast: false });
    addCollider(x, z, w, d, 0, 2.4, 'fence');
  });
  // barbed top
  for (let i = -54; i < 55; i += 6) {
    box(6, .04, .04, i, 2.6, -56, fenceMat, { collide: false, cast: false });
  }

  /* ---------- warehouse ---------- */
  const WH = { x1: -6, z1: -44, x2: 40, z2: 6, h: 7.6 };
  // west wall with passage gap
  wallZ(-44, -29.5, WH.x1, WH.h, .4, MAT.wallDark);
  wallZ(-22.5, 6, WH.x1, WH.h, .4, MAT.wallDark);
  // east wall with door gap
  wallZ(-44, -21, WH.x2, WH.h, .4, MAT.wallDark);
  wallZ(-15, 6, WH.x2, WH.h, .4, MAT.wallDark);
  // north wall with gap
  wallX(-6, 16, WH.z1, WH.h, .4, MAT.wallDark);
  wallX(22, 40, WH.z1, WH.h, .4, MAT.wallDark);
  // south wall with big door
  wallX(-6, 9, WH.z2, WH.h, .4, MAT.wallDark);
  wallX(17, 40, WH.z2, WH.h, .4, MAT.wallDark);
  roof(WH.x1, WH.z1, WH.x2, WH.z2, WH.h);
  // door frame headers
  box(8.5, 1.1, .65, 13, WH.h - 1.1, WH.z2, MAT.metalDark, { collide: false });
  box(.65, 1.1, 6, WH.x2, WH.h - 1.1, -18, MAT.metalDark, { collide: false });
  box(6, 1.1, .65, 19, WH.h - 1.1, WH.z1, MAT.metalDark, { collide: false });
  box(.65, 1.1, 6, WH.x1, WH.h - 1.1, -26, MAT.metalDark, { collide: false });
  // trim
  box(46, .25, .5, 17, 0, WH.z2 - .1, MAT.hazard, { collide: false, cast: false });
  box(.5, .25, 50, WH.x1 + .1, 0, -19, MAT.hazard, { collide: false, cast: false });
  // roof beams
  for (let x = -4; x < 40; x += 6) box(.18, .22, 50, x, WH.h - .5, -19, MAT.metalDark, { collide: false, cast: false });
  // skylights
  for (let i = 0; i < 4; i++) {
    const x = 0 + i * 10;
    box(4, .05, 10, x, WH.h - .08, -22, MAT.skylight, { collide: false, cast: false });
    box(4.2, .08, .16, x, WH.h - .14, -27, MAT.metalDark, { collide: false, cast: false });
    box(4.2, .08, .16, x, WH.h - .14, -17, MAT.metalDark, { collide: false, cast: false });
  }
  pointLight(17, 6.2, -22, 0xcfe6da, .75, 38);
  stripLight(-1, -29, 4, 0, MAT.coolLight, 5.8); stripLight(8, -17, 4, 0, MAT.coolLight, 5.8);
  stripLight(28, -32, 4, 0, MAT.coolLight, 5.8); stripLight(30, -10, 5, 0, MAT.amberLight, 5.8);
  pointLight(2, 5.5, -26, 0xcfe3d6, 1.0, 32);
  // warehouse signs
  signPlane('仓库 B 区', 'WAREHOUSE B // LOGISTICS', 20, 6.9, WH.z2 + .25, 7, 2, 0, '#ffb454');
  signPlane('高价值货区', 'RESTRICTED STORAGE', 28, 6.2, WH.z1 - .25, 7, 2, Math.PI, '#ff5364');

  // interior shelving racks
  function rack(x, z, len = 8, rot = 0) {
    const g = new THREE.Group();
    const postMat = MAT.metalDark;
    const w = 2.2;
    for (let s = 0; s < 3; s++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, .12, len), MAT.metal);
      shelf.position.set(0, .6 + s * .95, 0); shelf.castShadow = true; shelf.receiveShadow = true; g.add(shelf);
      for (let q = 0; q < 2; q++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(.11, 2.35, .11), postMat);
        p.position.set(q ? w / 2 - .1 : -w / 2 + .1, 1.2, -len / 2 + .1); g.add(p);
        const p2 = p.clone(); p2.position.z = len / 2 - .1; g.add(p2);
      }
      for (let q = 0; q < Math.floor(len / 2); q++) {
        if (Math.random() < .55) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, .55, 1.2), Math.random() < .5 ? MAT.crate : MAT.crateDark);
          b.position.set((Math.random() - .5) * .6, 1.25 + s * .95, -len / 2 + 1 + q * 2); b.castShadow = true; g.add(b);
        }
      }
    }
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    addCollider(x, z, rot ? len : w, rot ? w : len, 0, 2.4, 'shelf');
    // loot marker light
    if (Math.random() < .7) {
      const p = new THREE.Vector3((Math.random() - .5) * 1.2, 1.8, (Math.random() - .5) * (len - 2)).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      glowSprite(x + p.x, p.y, z + p.z, '#c8ff4f', 1.8, .16);
    }
  }
  rack(-1, -34, 10); rack(3.4, -34, 10); rack(-1, -20, 10); rack(3.4, -20, 10);
  rack(35, -35, 9, Math.PI / 2); rack(35, -24, 9, Math.PI / 2);
  // pallets / floor cargo
  for (let i = 0; i < 7; i++) {
    const x = 8 + Math.random() * 20, z = -8 - Math.random() * 26;
    if (Math.abs(x - 22) < 7 && z < -24) continue;
    box(2.4, .18, 2.4, x, 0, z, MAT.metalDark, { collide: false, cast: false });
    box(1.8, .9, 1.8, x, .18, z, MAT.crate, { collide: true, tag: 'cargo' });
  }
  const forklift = new THREE.Group();
  forklift.position.set(31, 0, -4);
  const fbody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 2.2), MAT.hazard); fbody.position.y = .8; forklift.add(fbody);
  const fcage = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.2), MAT.black); fcage.position.set(0, 1.9, -.3); forklift.add(fcage);
  for (let i = 0; i < 4; i++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .3, 12), MAT.rubber); wh.rotation.z = Math.PI / 2; wh.position.set(i % 2 ? .8 : -.8, .35, i < 2 ? .7 : -.7); forklift.add(wh); }
  scene.add(forklift); addCollider(31, -4, 2.2, 3.2, 0, 2.5, 'forklift');

  // vault
  const V = { x1: 12, z1: -39, x2: 33, z2: -25, h: 5.4 };
  wallX(12, 21, V.z2, V.h, .5, MAT.metalDark); wallX(25, 33, V.z2, V.h, .5, MAT.metalDark);
  wallZ(-39, -25, V.x1, V.h, .5, MAT.metalDark); wallZ(-39, -25, V.x2, V.h, .5, MAT.metalDark);
  wallX(12, 33, V.z1, V.h, .5, MAT.metalDark);
  roof(V.x1, V.z1, V.x2, V.z2, V.h, MAT.metalDark);
  box(4, 1, .6, 23, V.h - 1, V.z2, MAT.hazard, { collide: false });
  signPlane('金库', 'VAULT // AUTHORIZED ONLY', 23, 4.1, V.z2 + .28, 5, 1.4, 0, '#ff5364');
  pointLight(23, 4.3, -32, 0xff5a5a, .65, 15);
  stripLight(23, -32, 5, 0, MAT.redLight, 4.8);

  /* ---------- admin building ---------- */
  const AD = { x1: -52, z1: -42, x2: -16, z2: -12, h: 4.6 };
  wallX(AD.x1, -38, AD.z1, AD.h, .35, MAT.wall);
  wallX(-31, AD.x2, AD.z1, AD.h, .35, MAT.wall);
  wallX(AD.x1, -36, AD.z2, AD.h, .35, MAT.wall);
  wallX(-30, AD.x2, AD.z2, AD.h, .35, MAT.wall);
  wallZ(-42, -30, AD.x1, AD.h, .35, MAT.wall);
  wallZ(-24, -12, AD.x1, AD.h, .35, MAT.wall);
  wallZ(-42, -31, AD.x2, AD.h, .35, MAT.wall); // east door gap -31..-25
  wallZ(-25, -12, AD.x2, AD.h, .35, MAT.wall);
  roof(AD.x1, AD.z1, AD.x2, AD.z2, AD.h);
  // interior partitions
  wallZ(-41, -28.5, -34, 3.4, .25, MAT.wall);
  wallZ(-24, -12.5, -34, 3.4, .25, MAT.wall);
  wallX(-52, -45, -28.5, 3.4, .25, MAT.wall);
  wallX(-40, -34, -28.5, 3.4, .25, MAT.wall);
  wallX(-34, -28, -34, 3.4, .25, MAT.wall);
  wallX(-22, -16, -34, 3.4, .25, MAT.wall);
  // corridor to warehouse
  box(10, .2, 8, -11, 3.3, -26, MAT.roof, { collide: false, cast: false });
  wallX(-16, -6, -22, 3.4, .3, MAT.wallDark);
  wallX(-16, -6, -30, 3.4, .3, MAT.wallDark);
  stripLight(-11, -26, 3, Math.PI / 2, MAT.coolLight, 3.1);
  // admin lights
  pointLight(-35, 3.9, -28, 0xd7e4dd, .9, 30);
  stripLight(-44, -36, 4, 0, MAT.coolLight, 4.3); stripLight(-23, -22, 4, 0, MAT.coolLight, 4.3);
  signPlane('行政楼', 'ADMINISTRATION // A-02', -35, 3.8, AD.z2 + .22, 6, 1.8, 0, '#67e8ff');
  // furniture
  function desk(x, z, rot = 0) {
    box(2.6, .12, 1.1, x, .72, z, MAT.metal, { collide: false, rotY: rot });
    for (const dx of [-1.1, 1.1]) for (const dz of [-.4, .4]) box(.1, .72, .1, x + dx, 0, z + dz, MAT.metalDark, { collide: false });
    addCollider(x, z, 2.7, 1.2, 0, .9, 'desk');
    box(.45, .06, .5, x - .4, .78, z, MAT.black, { collide: false });
    const chair = box(.55, .55, .55, x + .2, 0, z + .95, MAT.black, { collide: false }); chair.rotation.y = rot;
  }
  desk(-46, -37, 0); desk(-46, -20, 0); desk(-28, -38, .2); desk(-20, -20, -.2);
  for (const [x, z] of [[-51, -31], [-51, -26], [-51, -21], [-14, -40], [-20, -40]]) {
    box(.7, 1.9, .5, x, 0, z, MAT.metalDark, { collide: true, tag: 'locker' });
    box(.5, .02, .04, x, 1.2, z + .26, MAT.coolLight, { collide: false, cast: false });
  }
  // server rack
  box(1.2, 2.1, 2.8, -26, 0, -28, MAT.black, { collide: true, tag: 'server' });
  for (let i = 0; i < 5; i++) box(.9, .03, .03, -26, .8 + i * .22, -26.6, MAT.greenLight, { collide: false, cast: false });
  glowSprite(-26, 1.5, -28, '#62ff9a', 2.2, .12);
  // evidence board / poster
  signPlane('行动记录', 'OPERATION RECORDS', -42, 2.2, -41.8, 4, 1.2, 0, '#b9a0ff');
  // boxes
  for (let i = 0; i < 6; i++) box(1.1, .8 + Math.random(), 1.1, -48 + Math.random() * 3, 0, -16 - Math.random() * 8, MAT.crateDark, { collide: true, tag: 'crate' });

  /* ---------- container yard ---------- */
  function container(x, z, len = 12.2, rot = 0, stack = 0) {
    const mat = matForContainer();
    const w = 2.44, h = 2.6;
    const cw = rot ? w : len, cd = rot ? len : w;
    for (let s = 0; s <= stack; s++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mat);
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      // doors
      for (let d = 0; d < 2; d++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(.06, h - .2, w / 2 - .08), MAT.metalDark);
        door.position.set(len / 2 + .02, h / 2, (d - .5) * (w / 2)); g.add(door);
        for (let b = 0; b < 2; b++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(.08, h - .4, .07), MAT.metal);
          bar.position.set(len / 2 + .08, h / 2, (d - .5) * (w / 2) + (b ? .3 : -.3)); g.add(bar);
        }
      }
      // corner castings
      for (const dx of [-len / 2 + .12, len / 2 - .12]) for (const dz of [-w / 2 + .12, w / 2 - .12]) {
        const cast = new THREE.Mesh(new THREE.BoxGeometry(.28, .3, .28), MAT.metalDark);
        cast.position.set(dx, s * 2.6 + .15, dz); g.add(cast);
      }
      g.position.set(x, s * 2.6, z); g.rotation.y = rot; scene.add(g);
    }
    addCollider(x, z, cw, cd, 0, 2.6 * (stack + 1), 'container');
    return { x, z, cw, cd };
  }
  container(-46, 14, 12.2, Math.PI / 2, 0);
  container(-46, 28, 12.2, Math.PI / 2, 1);
  container(-30, 16, 12.2, 0, 0);
  container(-24, 22, 12.2, Math.PI / 2, 0);
  container(-16, 40, 12.2, 0, 0);
  container(-48, 42, 12.2, 0, 0);
  container(-30, 46, 12.2, 0, 0);
  container(10, 30, 12.2, Math.PI / 2, 0);
  // open container with interior light and loot
  {
    const x = -18, z = 29;
    container(x, z, 12.2, Math.PI / 2, 0);
    // remove collider? interior inaccessible; leave as solid, loot in front
    pointLight(x, 2.2, z + 3, 0xffc177, .35, 8);
  }
  signPlane('集装箱场', 'CONTAINER YARD // C-04', -32, 3.3, 8.5, 6, 1.6, 0, '#ffb454');

  /* ---------- checkpoint / yard props ---------- */
  function sandbag(x, z, len = 5, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    for (let i = 0; i < len * 2; i++) for (let s = 0; s < 3; s++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(.62, .28, .34), MAT.crateDark);
      bag.position.set(-len / 2 + .35 + i * .31, .16 + s * .28, (s % 2) * .04); bag.rotation.z = (Math.random() - .5) * .1;
      bag.castShadow = true; g.add(bag);
    }
    scene.add(g);
    addCollider(x, z, rot ? 1.1 : len, rot ? len : 1.1, 0, .9, 'sandbag');
  }
  sandbag(-2, 18, 6, 0); sandbag(10, 18, 6, 0); sandbag(22, 22, 5, Math.PI / 2);
  sandbag(-40, -8, 7, 0); sandbag(42, 2, 5, Math.PI / 2);
  // truck
  function truck(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 2.8), MAT.containerGreen); cab.position.set(3.2, 1.2, 0); cab.castShadow = true; g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(.06, .8, 2.2), MAT.glass); glass.position.set(4.42, 1.7, 0); g.add(glass);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(7.4, .8, 2.5), MAT.metalDark); bed.position.set(-1.6, .9, 0); g.add(bed);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.6, 2.3), MAT.containerGrey); cargo.position.set(-1.7, 2.5, 0); cargo.castShadow = true; g.add(cargo);
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .35, 12), MAT.rubber); w.rotation.z = Math.PI / 2; w.position.set(i < 3 ? 3.3 : -3.2, .5, i % 2 ? 1.15 : -1.15); g.add(w); }
    scene.add(g); addCollider(x, z, rot ? 3 : 10.5, rot ? 10.5 : 3, 0, 3.8, 'truck');
  }
  truck(3, 27, 0);
  // barrels
  for (let i = 0; i < 12; i++) {
    const x = -14 + Math.random() * 40, z = 12 + Math.random() * 26;
    if (Math.abs(x - 3) < 6 && Math.abs(z - 27) < 6) continue;
    cylinder(.34, .38, .95, x, 0, z, Math.random() < .5 ? MAT.containerRed : MAT.metalDark, 12, { collide: true });
  }
  // generator
  box(3, 1.2, 1.4, 28, 0, 35, MAT.hazard, { collide: true, tag: 'generator' });
  box(1.2, .8, 1, 28, 1.2, 35, MAT.black, { collide: false });
  glowSprite(28, 1.4, 35, '#ffb454', 2.4, .14);

  // floodlight towers
  addTowerLight(-52, 8, 0xffb454, true); addTowerLight(33, 8, 0xffb454, true);
  addTowerLight(-8, 52, 0xffb454, false); addTowerLight(44, -6, 0xffb454, false);
  // extra emissive lamp without light
  box(.7, .18, .4, -52, 8.3, 8, MAT.amberLight, { collide: false, cast: false });

  // watchtower
  (() => {
    const x = 47, z = 14;
    for (const dx of [-1.8, 1.8]) for (const dz of [-1.8, 1.8]) box(.16, 6, .16, x + dx, 0, z + dz, MAT.metalDark, { collide: true });
    box(5.5, .25, 5.5, x, 6, z, MAT.metalDark, { collide: true });
    box(5.6, .06, 5.6, x, 6.3, z, MAT.metal, { collide: false });
    for (const d of [[-2.7, 0, .08, 5.4], [2.7, 0, .08, 5.4], [0, -2.7, 5.4, .08], [0, 2.7, 5.4, .08]]) {
      box(d[2], 1.0, d[3], x + d[0], 6.3, z + d[1], MAT.metalDark, { collide: false });
    }
    box(5.8, .18, 5.8, x, 7.5, z, MAT.roof, { collide: false });
    for (const dx of [-2.6, 2.6]) for (const dz of [-2.6, 2.6]) box(.1, 1, .1, x + dx, 6.3, z + dz, MAT.metalDark, { collide: false });
    box(.1, 1.2, 1.2, x - 4, 0, z, MAT.metal, { collide: false });
    stripLight(x, z, 3, 0, MAT.amberLight, 7.3);
    signPlane('哨塔', 'OVERWATCH', x, 5.2, z + 2.85, 3, .9, 0, '#ffb454');
    glowSprite(x, 7.2, z, '#ffc177', 4, .3);
  })();

  /* ---------- distant scenery ---------- */
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * TAU, r = 78 + Math.random() * 35;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 4 + Math.random() * 8;
    box(4 + Math.random() * 8, h, 4 + Math.random() * 8, x, 0, z, MAT.wallDark, { collide: false, cast: false });
  }
  // gantry crane silhouette
  (() => {
    const x = 8, z = -78;
    for (const dx of [-16, 16]) {
      box(1.2, 18, 1.2, x + dx, 0, z, MAT.metalDark, { collide: false, cast: false });
      box(3.2, 1, 3.2, x + dx, 0, z, MAT.metalDark, { collide: false, cast: false });
    }
    box(36, 1.4, 2.2, x, 18, z, MAT.metalDark, { collide: false, cast: false });
    box(4, 2.2, 4, x - 4, 19.4, z, MAT.metalDark, { collide: false, cast: false });
    glowSprite(x + 10, 19, z, '#ff5b5b', 1.4, .5);
  })();
  // cargo ship silhouette
  box(42, 5, 11, -72, 0, 18, MAT.metalDark, { collide: false, cast: false });
  box(10, 8, 8, -54, 5, 18, MAT.wallDark, { collide: false, cast: false });
  for (let i = 0; i < 5; i++) box(5, 2.6, 8, -70 + i * 6, 5, 18, i % 2 ? MAT.containerBlue : MAT.containerRed, { collide: false, cast: false });

  /* ---------- extraction ---------- */
  const EX = { x: -35, z: 37, r: 5.2 };
  const heliCv = glCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#242a27'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 5000, '#111714', .16, 2);
    g.strokeStyle = 'rgba(220,235,220,.5)'; g.lineWidth = 4;
    g.beginPath(); g.arc(w / 2, h / 2, 175, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,180,84,.65)'; g.lineWidth = 8;
    g.beginPath(); g.arc(w / 2, h / 2, 205, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(235,245,235,.72)'; g.font = '900 210px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('H', w / 2, h / 2 + 6);
    g.fillStyle = 'rgba(200,255,79,.45)'; g.font = '700 20px monospace'; g.fillText('LZ-07 // EXFIL', w / 2, h / 2 + 150);
  });
  const tHeli = texFromCanvas(heliCv, 1, 1, aniso);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: tHeli, roughness: .8, metalness: .15, color: 0xa9b0a6 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(EX.x, .035, EX.z); pad.receiveShadow = true; scene.add(pad);
  // extraction zone
  const zoneMat = new THREE.MeshBasicMaterial({ color: 0x62ff9a, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false });
  const zone = new THREE.Mesh(new THREE.CircleGeometry(EX.r, 40), zoneMat);
  zone.rotation.x = -Math.PI / 2; zone.position.set(EX.x, .05, EX.z); scene.add(zone);
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(EX.r - .18, EX.r, 48), new THREE.MeshBasicMaterial({ color: 0x62ff9a, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
  zoneRing.rotation.x = -Math.PI / 2; zoneRing.position.set(EX.x, .06, EX.z); scene.add(zoneRing);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), MAT.greenLight);
    l.position.set(EX.x + Math.cos(a) * (EX.r + .8), .12, EX.z + Math.sin(a) * (EX.r + .8)); scene.add(l);
  }
  pointLight(EX.x, 3, EX.z, 0x62ff9a, 1.4, 24);
  glowSprite(EX.x, 1.2, EX.z, '#62ff9a', 14, .26);

  // helicopter
  const heli = new THREE.Group(); heli.position.set(EX.x - 5.2, 0, EX.z + 2.3); heli.rotation.y = -.5; scene.add(heli);
  const heliMat = new THREE.MeshStandardMaterial({ color: 0x33403a, roughness: .55, metalness: .45 });
  const heliDark = new THREE.MeshStandardMaterial({ color: 0x1b2321, roughness: .7, metalness: .4 });
  const fus = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.0, 2.35), heliMat); fus.position.y = 2.1; fus.castShadow = true; heli.add(fus);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 2.1), heliMat); nose.position.set(2.9, 2.0, 0); heli.add(nose);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, .7, 1.8), MAT.glass); cockpit.position.set(2.55, 2.65, 0); heli.add(cockpit);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(4.8, .42, .42), heliDark); boom.position.set(-4.4, 2.45, 0); heli.add(boom);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.5, .8), heliDark); tail.position.set(-6.7, 2.9, 0); heli.add(tail);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .7, 8), heliDark); mast.position.y = 3.3; heli.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 3.7; heli.add(rotor);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(5.4, .04, .22), heliDark);
    blade.rotation.y = i * Math.PI / 2; blade.position.x = Math.cos(i * Math.PI / 2) * 2.4; blade.position.z = -Math.sin(i * Math.PI / 2) * 2.4; rotor.add(blade);
  }
  const trotor = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.2, .1), heliDark); trotor.position.set(-6.8, 3.0, 0); heli.add(trotor);
  const tailRotor = new THREE.Group(); tailRotor.position.set(-6.85, 3.0, .15); heli.add(tailRotor);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.1, .1), heliDark); b.rotation.x = i * Math.PI / 3; tailRotor.add(b); }
  for (const dz of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(4.4, .1, .12), heliDark); skid.position.set(0, .65, dz * 1.3); heli.add(skid);
    for (const dx of [-1.5, 1.5]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(.1, .8, .1), heliDark); strut.position.set(dx, 1.05, dz * 1.3); heli.add(strut); }
  }
  heli.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .1, 1.3), heliDark));
  addCollider(EX.x - 5.2, EX.z + 2.3, 7.2, 3.4, 0, 3, 'helicopter');
  animated.push({ type: 'rotor', rotor, tailRotor });
  glowSprite(EX.x - 5.2, 3.8, EX.z + 2.3, '#ff5b5b', 1.3, .4);
  // smoke
  const smokeTex = smokeTexture('rgba(120,255,170,');
  const smokeGeo = new THREE.BufferGeometry();
  const N = 70, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    sp[i * 3] = EX.x + (Math.random() - .5) * 3;
    sp[i * 3 + 1] = Math.random() * 7;
    sp[i * 3 + 2] = EX.z + 2 + (Math.random() - .5) * 3;
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smokeMat = new THREE.PointsMaterial({ map: smokeTex, color: 0x8dffc0, size: 2.4, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending });
  const smoke = new THREE.Points(smokeGeo, smokeMat); scene.add(smoke);
  animated.push({ type: 'smoke', points: smoke, base: { x: EX.x, z: EX.z + 2 } });
  // hazard barrier around pad
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + .4;
    box(3, .3, .3, EX.x + Math.cos(a) * (EX.r + 2), 0, EX.z + Math.sin(a) * (EX.r + 2), MAT.hazard, { collide: true, rotY: -a });
  }

  /* ---------- spawn ---------- */
  const spawn = { x: 47, z: -51, yaw: Math.PI };
  const spawnPad = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ color: 0x67e8ff, transparent: true, opacity: .12, depthWrite: false }));
  spawnPad.rotation.x = -Math.PI / 2; spawnPad.position.set(spawn.x, .04, spawn.z); scene.add(spawnPad);
  signPlane('入口', 'INSERTION // N-01', 47, 2.7, -55.6, 4.5, 1.2, 0, '#67e8ff');
  // gates and cover near spawn
  sandbag(38, -48, 6, 0); sandbag(52, -42, 5, Math.PI / 2);
  container(52, -36, 12.2, Math.PI / 2, 0);

  /* ---------- loot crates ---------- */
  const lootMat = {
    military: new THREE.MeshStandardMaterial({ map: tCrate, color: 0xc4b88c, roughness: .82, metalness: .18 }),
    medical: new THREE.MeshStandardMaterial({ color: 0xb9c9bd, roughness: .75, metalness: .1 }),
    filing: new THREE.MeshStandardMaterial({ color: 0x59615d, roughness: .8, metalness: .2 }),
    safe: new THREE.MeshStandardMaterial({ color: 0x303d3d, roughness: .55, metalness: .65 }),
    cache: new THREE.MeshStandardMaterial({ map: tCrate, color: 0x829398, roughness: .7, metalness: .3 }),
    vaultsafe: new THREE.MeshStandardMaterial({ color: 0x3f3a2a, roughness: .45, metalness: .7 })
  };
  const lootDefs = [
    ['military', 1.15, -33], ['military', 7.8, -28], ['cache', 12, -15], ['safe', 30, -8],
    ['military', 36, -29], ['cache', 18, -42], ['vaultsafe', 28, -33],
    ['safe', -46, -38], ['filing', -22, -38], ['medical', -20, -18], ['filing', -47, -22],
    ['military', -44, 12], ['cache', -28, 30], ['military', -8, 26], ['safe', 24, 34], ['medical', 6, 22],
    ['military', -34, 44], ['cache', -48, 36]
  ];
  for (const [type, x, z] of lootDefs) {
    const def = CONTAINER_DEFS[type];
    const big = type === 'vaultsafe';
    const w = big ? 1.25 : .9, h = big ? 1.05 : .65, d = big ? 1.0 : .6;
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = Math.random() * .4 - .2; scene.add(group);
    const bodyMat = lootMat[type] || lootMat.military;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2; body.castShadow = true; group.add(body);
    // latches / straps
    const latch = new THREE.Mesh(new THREE.BoxGeometry(.06, h * .3, .04), MAT.amberLight);
    latch.position.set(w / 2 + .02, h * .55, 0); group.add(latch);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .66, 28), new THREE.MeshBasicMaterial({ color: type === 'vaultsafe' ? 0xb9a0ff : 0x67e8ff, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03; group.add(ring);
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(.11, 0), new THREE.MeshBasicMaterial({ color: type === 'vaultsafe' ? 0xb9a0ff : 0xffb454 }));
    mark.position.y = 1.25; group.add(mark);
    glowSprite(x, 1.2, z, type === 'vaultsafe' ? '#b9a0ff' : '#ffb454', 1.3, .2);
    const c = { x, z, y: .65, type, label: def.label, time: def.time, color: def.color, glyph: def.glyph, bias: def.bias, requires: def.requires, opened: false, original: true, group, mark, ring, body };
    crates.push(c);
  }

  /* ---------- navigation grid ---------- */
  const CELL = 2, ORIGIN = -60, GN = 60;
  const nav = { cell: CELL, origin: ORIGIN, n: GN, blocked: new Uint8Array(GN * GN) };
  for (let gy = 0; gy < GN; gy++) for (let gx = 0; gx < GN; gx++) {
    const x = ORIGIN + gx * CELL + CELL / 2, z = ORIGIN + gy * CELL + CELL / 2;
    let blocked = false;
    if (x < -55 || x > 55 || z < -55 || z > 55) blocked = true;
    for (const c of colliders) {
      if (c.maxY < .25 || c.minY > 1.9) continue;
      if (x > c.minX - .45 && x < c.maxX + .45 && z > c.minZ - .45 && z < c.maxZ + .45) { blocked = true; break; }
    }
    nav.blocked[gy * GN + gx] = blocked ? 1 : 0;
  }
  world.baseCrates = crates.slice();
  world.nav = nav;
  world.navOpen = (x, z) => {
    const gx = Math.floor((x - ORIGIN) / CELL), gy = Math.floor((z - ORIGIN) / CELL);
    return gx >= 0 && gy >= 0 && gx < GN && gy < GN && !nav.blocked[gy * GN + gx];
  };

  zones.push({ x1: WH.x1, z1: WH.z1, x2: WH.x2, z2: WH.z2, color: 'rgba(200,255,79,.018)' });
  zones.push({ x1: AD.x1, z1: AD.z1, x2: AD.x2, z2: AD.z2, color: 'rgba(103,232,255,.018)' });
  zones.push({ x1: -52, z1: 10, x2: -10, z2: 50, color: 'rgba(255,180,84,.014)' });
  zones.push({ x1: EX.x - 9, z1: EX.z - 9, x2: EX.x + 9, z2: EX.z + 9, color: 'rgba(98,255,154,.03)' });

  /* ---------- minimap base ---------- */
  const mini = glCanvas(240, 240, (g) => {
    const s = 240 / 120;
    g.fillStyle = '#060d0f'; g.fillRect(0, 0, 240, 240);
    // zones
    for (const zn of zones) {
      g.fillStyle = zn.color || 'rgba(200,255,79,.025)';
      g.fillRect((zn.x1 + 60) * s, (zn.z1 + 60) * s, (zn.x2 - zn.x1) * s, (zn.z2 - zn.z1) * s);
    }
    // grid
    g.strokeStyle = 'rgba(120,150,145,.085)'; g.lineWidth = 1;
    for (let i = 0; i < 120; i += 10) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 240); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(240, i * s); g.stroke(); }
    // walls
    for (const c of colliders) {
      if (c.tag === 'roof' || c.tag === 'fence' || c.maxY > 8) continue;
      g.fillStyle = c.tag === 'container' || c.tag === 'truck' ? '#394646' : c.tag === 'sandbag' ? '#4b4d3b' : '#5b6b6b';
      g.fillRect((c.minX + 60) * s, (c.minZ + 60) * s, Math.max(1, (c.maxX - c.minX) * s), Math.max(1, (c.maxZ - c.minZ) * s));
    }
    // extraction
    g.strokeStyle = '#62ff9a'; g.lineWidth = 2;
    g.beginPath(); g.arc((EX.x + 60) * s, (EX.z + 60) * s, EX.r * s, 0, TAU); g.stroke();
    g.fillStyle = '#62ff9a'; g.font = '700 8px monospace'; g.fillText('LZ', (EX.x + 60) * s - 5, (EX.z + 60) * s + 3);
  });
  world.miniBase = mini;
  world.extraction = { ...EX, y: 0, name: 'LZ-07 直升机坪' };
  world.spawn = spawn;
  world.inside = (x, z) => (
    (x > WH.x1 && x < WH.x2 && z > WH.z1 && z < WH.z2) ||
    (x > AD.x1 && x < AD.x2 && z > AD.z1 && z < AD.z2) ||
    (x > -16 && x < -6 && z > -30 && z < -22) ||
    (x > V.x1 && x < V.x2 && z > V.z1 && z < V.z2)
  );
  /* ---------- rain / dust ---------- */
  const rainGeo = new THREE.BufferGeometry();
  const RN = 850, rp = new Float32Array(RN * 3), rs = new Float32Array(RN);
  for (let i = 0; i < RN; i++) {
    rp[i * 3] = (Math.random() - .5) * 70;
    rp[i * 3 + 1] = Math.random() * 30;
    rp[i * 3 + 2] = (Math.random() - .5) * 70;
    rs[i] = 10 + Math.random() * 16;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ map: rainTexture(), color: desert ? 0xd8b47a : 0x9bc5d6, size: desert ? .38 : .55, transparent: true, opacity: desert ? .4 : .5, depthWrite: false, blending: THREE.NormalBlending }));
  rain.frustumCulled = false; scene.add(rain);
  animated.push({ type: 'rain', points: rain, speeds: rs });
  const dustGeo = new THREE.BufferGeometry();
  const DN = 240, dp = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) {
    dp[i * 3] = -4 + Math.random() * 42;
    dp[i * 3 + 1] = .5 + Math.random() * 6;
    dp[i * 3 + 2] = -42 + Math.random() * 46;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xbfd8ce, size: .035, transparent: true, opacity: .35, depthWrite: false }));
  scene.add(dust);
  animated.push({ type: 'dust', points: dust });

  /* ---------- sky & moon ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(desert ? 0x0c1724 : 0x020509) }, bottom: { value: new THREE.Color(desert ? 0x7a4a2a : 0x132a32) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(normalize(vP).y * .55 + .3, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,.7)), 1.0); }'
  }));
  scene.add(sky);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#cfe6ff'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .85 }));
  moonSprite.position.set(-110, 120, -140); moonSprite.scale.set(28, 28, 1); scene.add(moonSprite);
  // star points
  const starGeo = new THREE.BufferGeometry(); const starN = 300; const star = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = Math.random() * TAU, e = .15 + Math.random() * .8, r = 240;
    star[i * 3] = Math.cos(a) * Math.cos(e) * r; star[i * 3 + 1] = Math.sin(e) * r; star[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(star, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x94b4c8, size: .7, transparent: true, opacity: .5, depthWrite: false })));

  /* ---------- enemy / patrol metadata ---------- */
  const enemyDefs = [
    { type: 'guard', x: -44, z: -34, zone: 'admin', patrol: [[-44, -18], [-22, -18], [-22, -36], [-44, -36]] },
    { type: 'scav', x: -24, z: -20, zone: 'admin', patrol: [[-24, -38], [-40, -38], [-40, -20], [-24, -20]] },
    { type: 'smg', x: -1, z: -12, zone: 'warehouse', patrol: [[-1, -30], [7, -30], [7, -10], [-3, -10]] },
    { type: 'shotgun', x: 28, z: -16, zone: 'warehouse', patrol: [[28, -38], [35, -38], [35, -10], [28, -10]] },
    { type: 'sniper', x: 47, z: 14, y: 6.5, stationary: true, zone: 'tower' },
    { type: 'smg', x: -28, z: 34, zone: 'yard', patrol: [[-30, 14], [-14, 20], [-30, 40], [-48, 34]] },
    { type: 'scav', x: 16, z: 20, zone: 'yard', patrol: [[8, 12], [30, 16], [28, 38], [4, 32]] },
    { type: 'shotgun', x: -48, z: 44, zone: 'yard', patrol: [[-48, 32], [-34, 46], [-14, 40]] },
    { type: 'boss', x: 23, z: -32, zone: 'vault', stationary: true },
    { type: 'guard', x: 16, z: -29, zone: 'vault', patrol: [[16, -37], [30, -37], [30, -28]] }
  ];
  world.enemyDefs = enemyDefs;
  world.lootCount = crates.length;
  world.update = (dt, camera, inside) => {
    for (const a of animated) {
      if (a.type === 'rotor') { a.rotor.rotation.y += dt * 13; a.tailRotor.rotation.x += dt * 22; }
      else if (a.type === 'smoke') {
        const p = a.points.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) + dt * (1.4 + (i % 5) * .25);
          let x = p.getX(i) + Math.sin(performance.now() * .0007 + i) * dt * .6;
          let z = p.getZ(i) + Math.cos(performance.now() * .0005 + i) * dt * .4;
          if (y > 8) { y = .2; x = a.base.x + (Math.random() - .5) * 2; z = a.base.z + (Math.random() - .5) * 2; }
          p.setXYZ(i, x, y, z);
        }
        p.needsUpdate = true;
      } else if (a.type === 'rain') {
        a.points.visible = !inside;
        if (!inside) {
          a.points.position.set(camera.position.x, 0, camera.position.z);
          const p = a.points.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            let y = p.getY(i) - dt * a.speeds[i];
            let x = p.getX(i) + dt * 4.2;
            if (y < 0) { y = 28 + Math.random() * 4; x = (Math.random() - .5) * 70; }
            if (x > 35) x -= 70;
            p.setXYZ(i, x, y, p.getZ(i));
          }
          p.needsUpdate = true;
        }
      } else if (a.type === 'dust') {
        a.points.visible = inside;
        a.points.rotation.y += dt * .008;
      }
    }
    // marker bob
    for (const c of crates) {
      if (c.opened) continue;
      c.mark.rotation.y += dt * 1.7;
      c.mark.position.y = 1.2 + Math.sin(performance.now() * .002 + c.x) * .08;
      c.ring.material.opacity = .2 + Math.sin(performance.now() * .002 + c.z) * .1;
    }
    zoneMat.opacity = .1 + Math.sin(performance.now() * .0025) * .04;
    zoneRing.material.opacity = .42 + Math.sin(performance.now() * .003) * .15;
  };
  world.theme = theme;
  world.mapInfo = desert ? {
    id: 'desert', name: '沙脊 · 边境前哨', sub: '荒原封锁区 / 沙暴逼近', env: '沙暴 / 高温',
    threat: 5, window: '04:00', loot: '高价值物资', accent: '#ffb454',
    desc: '边境哨站，沙暴中能见度极低。高价值补给与更密集的守军。'
  } : {
    id: 'harbor', name: '灰港 · 07号联合设施', sub: '地下二层 / 信号被强干扰', env: '酸雨 / 断电',
    threat: 4, window: '04:00', loot: '标准物资', accent: '#c8ff4f',
    desc: '夜雨中的港区设施。仓库、行政楼与中央金库。'
  };
  world.menu = desert ? { radius: 72, height: 32, z: 2, target: [0, 2, -2] } : { radius: 64, height: 27, z: -4, target: [4, 2, 2] };
  world.getMarker = (x, z) => ({ x, z });
  world.scene = scene;
  world.sky = sky;
  return world;
}
