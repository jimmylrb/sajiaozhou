'use strict';
/* ============================================================
   BLACKSITE ZERO 3D — first-person extraction
   ============================================================ */
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.innerHTML = '<div style="color:#c8ff4f;font:14px monospace;padding:40px">WebGL 初始化失败。请使用支持 WebGL 的桌面浏览器。</div>';
  throw e;
}
let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 1.35);
renderer.setPixelRatio(DPR); renderer.setSize(W, H);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const worldHarbor = buildSector(renderer, 'harbor');
const worldDesert = buildDesert(renderer);
const WORLDS = { harbor: worldHarbor, desert: worldDesert };
let world = WORLDS[save.map] || worldHarbor;
let scene = world.scene;
function setupEnvironment() {
  const envScene = new THREE.Scene();
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#182a35'); gr.addColorStop(.5, '#2b4147'); gr.addColorStop(.55, '#0c1114'); gr.addColorStop(1, '#050708');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 12), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
  envScene.add(dome);
  const mk = (color, w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; envScene.add(m);
  };
  mk(0xffc27a, 2.2, 2.8, -4, 2, 1, 0); mk(0xb9d8e8, 2.5, 2.2, 4, 2.4, -2, 0); mk(0x9cc6b2, 3, 1, 0, 5, 0, 0);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(envScene, .04);
  pm.dispose(); return rt.texture;
}
const ENV_TEX = setupEnvironment();
scene.environment = ENV_TEX;
for (const k in WORLDS) WORLDS[k].scene.environment = ENV_TEX;
const camera = new THREE.PerspectiveCamera(75, W / H, .05, 320);
camera.rotation.order = 'YXZ';
scene.add(camera);
const flashlight = new THREE.SpotLight(0xcfe6ff, 2.1, 52, .5, .55, 1.2);
flashlight.position.set(.18, -.12, 0);
flashlight.target.position.set(0, -.02, -10);
camera.add(flashlight); camera.add(flashlight.target);

/* viewmodel scene */
const viewScene = new THREE.Scene();
const viewCam = new THREE.PerspectiveCamera(60, W / H, .01, 10);
viewScene.add(new THREE.AmbientLight(0xc4d2cc, .34));
const vDir = new THREE.DirectionalLight(0xffe5c4, .72); vDir.position.set(1.2, 2, 1.6); viewScene.add(vDir);
const vRim = new THREE.PointLight(0x7bb8c8, .28, 4); vRim.position.set(-.8, .4, .8); viewScene.add(new THREE.PointLight(0xffe6c4, .25, 3).translateY(.1)); viewScene.add(vRim);

const RAIDSEC = RAID_SECONDS;
let mode = 'title', deploying = false, menuT = 0;
let run = null, player = null;
let soldierGltf = null, modelReady = false, gunGltfs = {};
let pointerLocked = false, fallbackLook = false;
let enemies = [], allies = [], viewModel = null, effects = [], tracers = [], decals = [], grenades = [], interceptorSpawned = false;
let last = performance.now(), shake = 0, shakeT = 0;
let helpWasRunning = false;
const input = { keys: {}, mouseLeft: false, mouseRight: false, firePressed: false, interact: false };
const mouseDelta = { x: 0, y: 0 };
let announceTimer = null, resetArmed = false, resetTimer = null, hitTimer = null;
let lastBagSig = '', lastPromptKey = '';

const D = {
  title: $('#screen-title'), hub: $('#screen-hub'), resultScreen: $('#screen-result'), hud: $('#hud'),
  titleSave: $('#title-save'), credits: $('#res-credits'), stash: $('#res-stash'), rate: $('#res-rate'),
  hpBar: $('#hp-bar'), hpText: $('#hp-text'), arBar: $('#ar-bar'), arText: $('#ar-text'),
  timer: $('#raid-timer'), timerBar: $('#timer-bar'), phase: $('#phase-label'), objective: $('#objective-text'),
  compass: $('#compass'), mini: $('#minimap'), miniDist: $('#mini-dist'), miniTitle: $('#mini-title'),
  ammoMag: $('#ammo-mag'), ammoRes: $('#ammo-reserve'), weaponName: $('#weapon-name'), weaponClass: $('#weapon-class'),
  weaponMode: $('#weapon-mode'), reloadWrap: $('.reload-bar'), reloadFill: $('#reload-fill'),
  medHud: $('#med-hud'), nadeHud: $('#nade-hud'), medSlot: $('#med-slot'), nadeSlot: $('#nade-slot'),
  stanceFill: $('#stance-fill'), stanceText: $('#stance-text'),
  bagSlots: $('#bag-slots'), bagCount: $('#bag-count'), bagValue: $('#bag-value'),
  interact: $('#interact'), intLabel: $('#interact-label'), intSub: $('#interact-sub'), intFill: $('#interact-fill'),
  toasts: $('#toasts'), announce: $('#announce'), announceKicker: $('#announce-kicker'), announceText: $('#announce-text'),
  bossBar: $('#boss-bar'), bossFill: $('#boss-hp'), bossText: $('#boss-hp-text'),
  killfeed: $('#killfeed'), lowHealth: $('#low-health'), resultStamp: $('#result-stamp'),
  extractEdge: $('#extract-edge'), crosshair: $('#crosshair'), hitmarker: $('#hitmarker'), floaters: $('#floaters'),
  lock: $('#lock-overlay'), loading: $('#loading'), pause: $('#pause'), pauseTime: $('#pause-time'), pauseValue: $('#pause-value'),
  help: $('#help'), wipe: $('#wipe'), banner: $('#start-banner'), damage: $('#damage-flash'),
  resultCard: $('.result-card'), resultKicker: $('#result-kicker'), resultTitle: $('#result-title'), resultSub: $('#result-sub'),
  resultValue: $('#result-value'), resultBonus: $('#result-bonus'), resultKills: $('#result-kills'), resultAcc: $('#result-acc'),
  resultTime: $('#result-time'), resultLoot: $('#result-loot'), resultList: $('#result-list'), resultNew: $('#result-newbest'),
  deployBtn: $('#deploy-btn'), soundBtn: $('#sound-btn'),
  squadList: $('#squad-list'), operatorList: $('#operator-list'), operatorTag: $('#operator-tag'), skillHud: $('#skill-hud'), skillName: $('#skill-name'), skillCd: $('#skill-cd'), skillBar: $('#skill-bar'),
  mapPick: $('#map-pick'), missionName: $('#mission-name'), missionSub: $('#mission-sub'), missionThreat: $('#mission-threat'), missionEnv: $('#mission-env'), missionLoot: $('#mission-loot'),
  gs: $('#gunsmith'), gsWeapons: $('#gs-weapons'), gsPreview: $('#gs-preview'), gsStats: $('#gs-stats'), gsSlots: $('#gs-slots'), gsOptions: $('#gs-options'), gsCredits: $('#gs-credits')
};
const miniCtx = D.mini.getContext('2d');
const compassCtx = D.compass.getContext('2d');
const hudEl = D.hud;

/* ============================================================
   UTILS
   ============================================================ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const weapon = () => currentWeapon();
const _v1 = V(), _v2 = V(), _v3 = V(), _v4 = V();
const DEG = Math.PI / 180;
function loadSoldier() {
  return new Promise(resolve => {
    if (!window.SOLDIER_GLB || !THREE.GLTFLoader) { resolve(null); return; }
    try {
      const b64 = window.SOLDIER_GLB.split(',')[1];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      new THREE.GLTFLoader().parse(bytes.buffer, '', gltf => {
        soldierGltf = gltf; modelReady = true;
        resolve(gltf);
      }, err => { console.warn('model load failed', err); resolve(null); });
    } catch (e) { console.warn('model parse failed', e); resolve(null); }
  });
}
function loadGuns() {
  if (!window.GUN_GLB || !THREE.GLTFLoader) return Promise.resolve();
  const loader = new THREE.GLTFLoader();
  return Promise.all(Object.entries(window.GUN_GLB).map(([key, uri]) => new Promise(resolve => {
    try {
      const b64 = uri.split(',')[1]; const bin = atob(b64); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      loader.parse(bytes.buffer, '', gltf => { gunGltfs[key] = gltf; resolve(); }, () => resolve());
    } catch (e) { resolve(); }
  })));
}
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H, visible: p.z < 1 };
}
function toast(text, color = '#c8ff4f', cls = '', item = null) {
  const t = document.createElement('div');
  t.className = 'toast ' + cls; t.style.setProperty('--tier', color);
  t.innerHTML = `<span class="tico">${item ? item.glyph : cls === 'bad' ? '!' : '·'}</span><span>${text}</span>${item && item.value ? `<b>+₡${fmt(item.value)}</b>` : ''}`;
  D.toasts.appendChild(t);
  while (D.toasts.children.length > 6) D.toasts.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2800);
}
function announce(kicker, text, dur = 2500) {
  D.announceKicker.textContent = kicker; D.announceText.textContent = text;
  D.announce.classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => D.announce.classList.remove('show'), dur);
}
function showFloater(text, worldPos, cls = '') {
  const p = toScreen(worldPos);
  if (!p.visible) return;
  const el = document.createElement('div');
  el.className = 'floater ' + cls; el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.style.fontSize = (cls.includes('head') ? 16 : 12) + 'px';
  D.floaters.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
function showKillFeed(enemy, head = false) {
  if (!D.killfeed) return;
  const names = { scav: '散兵', smg: '突击手', shotgun: '破门者', sniper: '猎眼', guard: '金库守卫', boss: '典狱长' };
  const row = document.createElement('div');
  row.className = 'kf';
  row.innerHTML = `<b>你</b><i>▸</i><em>${names[enemy] || '目标'}</em>${head ? '<small>HEADSHOT</small>' : ''}`;
  D.killfeed.appendChild(row);
  while (D.killfeed.children.length > 4) D.killfeed.firstChild.remove();
  setTimeout(() => { row.classList.add('out'); setTimeout(() => row.remove(), 320); }, 3600);
}
function flashHit(kill = false) {
  D.hitmarker.classList.remove('show', 'kill');
  void D.hitmarker.offsetWidth;
  D.hitmarker.classList.add('show'); if (kill) D.hitmarker.classList.add('kill');
  clearTimeout(hitTimer); hitTimer = setTimeout(() => D.hitmarker.classList.remove('show'), 180);
}

/* ============================================================
   META UI
   ============================================================ */
function syncMeta() {
  D.credits.textContent = fmt(save.credits);
  D.stash.textContent = fmt(save.stash);
  D.rate.textContent = save.stats.raids ? Math.round(save.stats.extracts / save.stats.raids * 100) : '--';
  $('#st-raids').textContent = save.stats.raids;
  $('#st-extracts').textContent = save.stats.extracts;
  $('#st-kills').textContent = save.stats.kills;
  $('#st-best').textContent = '₡' + fmt(save.stats.best);
  $('#fact-bag').textContent = bagSlots() + ' 格';
  $('#fact-luck').textContent = save.upgrades.luck ? '+ ' + save.upgrades.luck * 12 + '%' : '标准';
  D.titleSave.innerHTML = save.stats.raids || save.credits !== 650
    ? `本地存档 // 信用点 <b>₡${fmt(save.credits)}</b> · 累计带出 <b>₡${fmt(save.stash)}</b>`
    : '本地存档 // 尚无行动记录';
}
function renderLoadout() {
  $('#weapon-list').innerHTML = Object.entries(WEAPONS).map(([k, w]) => {
    const sel = save.loadout.weapon === k;
    return `<button class="weapon-card ${sel ? 'sel' : ''}" data-weapon="${k}">
      <span class="wcost">${w.deposit ? '₡' + w.deposit : 'FREE'}</span>
      <div class="wc-svg">${w.icon}</div>
      <div class="wname">${w.name}<em>${w.mode}</em></div>
      <div class="wstats"><span>DMG <b>${w.dmg}</b></span><span>RPM <b>${w.rpm}</b></span><span>MAG <b>${w.mag}</b></span></div>
    </button>`;
  }).join('');
  $('#armor-list').innerHTML = Object.entries(ARMORS).map(([k, a]) => {
    const sel = save.loadout.armor === k;
    return `<button class="armor-card ${sel ? 'sel' : ''}" data-armor="${k}"><b>${a.name}</b><span>${a.armor ? a.armor + ' 护甲' : '无防护'}</span><em>${a.cost ? '₡' + a.cost : '免费'}</em></button>`;
  }).join('');
  $('#operator-list').innerHTML = Object.values(OPERATORS).map(op => `<button class="op-card ${save.loadout.operator === op.id ? 'sel' : ''}" data-op="${op.id}"><b><i>${op.icon}</i>${op.name}</b><span>${op.en} / ${op.role}</span><em>${op.passive}</em></button>`).join('');
  $('#meds-count').textContent = save.loadout.meds;
  $('#nades-count').textContent = save.loadout.nades;
  const cost = calcDeposit();
  const totalCost = cost + insuranceCost();
  $('#deposit-val').textContent = '₡' + fmt(cost);
  $('#deploy-cost').textContent = '₡' + fmt(totalCost);
  $('#deploy-balance').textContent = '₡' + fmt(save.credits);
  const insToggle = $('#insurance-toggle');
  if (insToggle) insToggle.checked = !!save.loadout.insurance;
  D.deployBtn.disabled = save.credits < totalCost || !modelReady;
  D.deployBtn.querySelector('span').textContent = !modelReady ? '载入 3D 资产' : save.credits < totalCost ? '信用点不足' : '开始行动';
  syncMeta();
}
function renderUpgrades() {
  $('#upgrade-list').innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
    const lv = save.upgrades[k], max = lv >= u.max;
    const cost = max ? 0 : u.costs[lv];
    return `<div class="upgrade">
      <div class="up-ico">${u.icon}</div>
      <div class="up-info"><div class="up-name">${u.name}<span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="up-desc">${u.desc}</div></div>
      <button class="up-buy" data-upgrade="${k}" ${max || save.credits < cost ? 'disabled' : ''}>${max ? 'MAX' : '₡' + cost}</button>
    </div>`;
  }).join('');
  syncMeta();
}
function renderHub() { renderLoadout(); renderUpgrades(); syncMeta(); renderMission(); }
function renderMission() {
  if (!world) return;
  const info = world.mapInfo || {};
  if (D.missionName) D.missionName.textContent = info.name || '灰港 · 07号联合设施';
  if (D.missionSub) D.missionSub.textContent = info.sub || '地下二层 / 信号被强干扰';
  if (D.missionThreat) D.missionThreat.textContent = 'THREAT ' + (info.threat || 4);
  if (D.missionEnv) D.missionEnv.textContent = info.env || '酸雨 / 断电';
  if (D.missionLoot) D.missionLoot.textContent = info.loot || '标准物资';
  $$('.map-card').forEach(b => b.classList.toggle('sel', b.dataset.map === (save.map || 'harbor')));
}
function switchMap(id) {
  if (mode === 'raid' || !WORLDS[id] || id === (save.map || 'harbor')) return;
  if (scene) scene.remove(camera);
  world = WORLDS[id]; scene = world.scene; scene.add(camera);
  scene.environment = ENV_TEX;
  save.map = id; persist();
  menuT = 0;
  renderer.shadowMap.needsUpdate = true;
  renderMission();
  Sound.ui && Sound.ui();
}
function showHub() {
  mode = 'hub'; deploying = false;
  $$('.screen').forEach(s => s.classList.remove('active'));
  D.hub.classList.add('active');
  D.hud.classList.remove('show');
  D.pause.classList.remove('show'); D.help.classList.remove('show'); D.lock.classList.remove('show');
  document.body.style.cursor = 'default';
  if (pointerLocked) document.exitPointerLock();
  renderHub();
}
function enterHub() { Sound.init(); Sound.ui(); showHub(); }

/* ============================================================
   BOOT / MENU
   ============================================================ */
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 1.35);
  renderer.setPixelRatio(DPR); renderer.setSize(W, H);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  viewCam.aspect = W / H; viewCam.updateProjectionMatrix();
}
addEventListener('resize', resize);

function menuCamera(dt) {
  menuT += dt;
  const m = world.menu || { radius: 64, height: 27, z: -4, target: [4, 2, 2] };
  const a = .55 + Math.sin(menuT * .035) * .55;
  const r = m.radius + Math.sin(menuT * .021) * 8;
  camera.position.set(Math.cos(a) * r, m.height + Math.sin(menuT * .07) * 2.2, Math.sin(a) * r + (m.z || 0));
  camera.lookAt(m.target[0], m.target[1], m.target[2]);
}

/* ============================================================
   RAID SETUP
   ============================================================ */
function clearRaidObjects() {
  if (!world) return;
  for (const e of enemies.concat(allies)) {
    if (e.laser) scene.remove(e.laser);
    if (e.group) scene.remove(e.group);
  }
  allies = [];
  for (const t of tracers) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
  for (const f of effects) if (f.mesh) { scene.remove(f.mesh); if (f.mesh.material) f.mesh.material.dispose(); }
  for (const d of decals) scene.remove(d);
  for (const g of grenades) scene.remove(g.mesh);
  for (const lf of lampsFlash) scene.remove(lf.light);
  tracers = []; effects = []; decals = []; grenades = []; lampsFlash = [];
  const base = world.baseCrates || [];
  for (const c of world.crates) { if (!c.original) scene.remove(c.group); }
  world.crates = base.slice();
  for (const c of world.crates) { c.opened = false; if (c.mark) c.mark.visible = true; if (c.ring) c.ring.visible = true; }
  D.toasts.innerHTML = ''; D.floaters.innerHTML = ''; D.announce.classList.remove('show');
}
function insuranceCost() { return save.loadout.insurance ? 40 : 0; }
function beginDeploy() {
  if (deploying || !modelReady) return;
  const deposit = calcDeposit();
  const ins = insuranceCost();
  const cost = deposit + ins;
  if (save.credits < cost) { showHub(); return; }
  deploying = true;
  save.credits -= cost; save.loadout.meds = clamp(save.loadout.meds, 0, 3); save.loadout.nades = clamp(save.loadout.nades, 0, 2);
  persist();
  D.wipe.classList.add('show'); Sound.init();
  setTimeout(() => startRaid(cost, deposit, ins), 460);
  setTimeout(() => { D.wipe.classList.remove('show'); }, 1000);
}
function startRaid(deposit, baseDeposit, ins) {
  deploying = false;
  mode = 'raid';
  $$('.screen').forEach(s => s.classList.remove('active'));
  D.hud.classList.add('show');
  D.crosshair.classList.add('active');
  D.pause.classList.remove('show'); D.help.classList.remove('show'); D.resultScreen.classList.remove('active');
  const w = weapon(), ar = ARMORS[save.loadout.armor], op = OPERATORS[save.loadout.operator] || OPERATORS.assault;
  player = {
    x: world.spawn.x, z: world.spawn.z, yaw: world.spawn.yaw, pitch: -.03,
    hp: maxHP() + (op.id === 'medic' ? 10 : 0), maxHp: maxHP() + (op.id === 'medic' ? 10 : 0), armor: ar.armor, maxArmor: ar.armor,
    eye: 1.66, crouch: false, jumpY: 0, vy: 0, bob: 0, moveSpeed: 0,
    ads: false, sprinting: false, walking: false, recoilPitch: 0, recoilVis: 0,
    stepT: 0, shakeYaw: 0, shakePitch: 0, dead: false
  };
  run = {
    time: RAIDSEC, started: false, paused: false, ended: false, deposit: baseDeposit ?? deposit, insurance: ins || 0, inspectT: 0,
    ammo: w.mag, reserve: w.reserve, reloading: false, reloadT: 0, fireCd: 0, bloom: 0,
    bag: [], meds: save.loadout.meds + (op.id === 'medic' ? 1 : 0), nades: save.loadout.nades, hasKey: false, value: 0,
    operator: op, skillCd: 0, skillT: 0, revealT: 0, lootMult: op.id === 'recon' ? 1.08 : 1, airdrop: false,
    action: null, shots: 0, hits: 0, kills: 0, containers: 0, prompt: null, interactKey: '',
    interactProgress: 0, extractStarted: false, extractSpawned: false, reinforcement: false, finalWarn: false,
    startTime: 0, bossEngaged: false, bossDead: false, hitstop: 0
  };
  clearRaidObjects();
  enemies = [];
  world.enemyDefs.forEach(def => enemies.push(makeEnemy(def)));
  world.boss = enemies.find(e => e.type === 'boss');
  spawnAllies();
  effects = []; tracers = []; decals = []; grenades = []; interceptorSpawned = false;
  if (viewModel) { viewScene.remove(viewModel.group); viewModel = null; }
  buildViewModel(save.loadout.weapon);
  camera.rotation.order = 'YXZ';
  camera.position.set(player.x, player.eye, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  document.body.style.cursor = 'default';
  D.bossBar.classList.remove('show');
  D.extractEdge.classList.remove('show');
  D.hud.classList.remove('ads');
  fallbackLook = false;
  const sb = $('#start-banner span'); if (sb) sb.textContent = world.mapInfo?.name || '07号联合设施';
  D.lock.classList.add('show');
  input.keys = {}; input.interact = false; input.mouseLeft = false; input.firePressed = false;
  lastBagSig = ''; lastPromptKey = '';
  if (D.killfeed) D.killfeed.innerHTML = '';
  if (D.lowHealth) D.lowHealth.classList.remove('on');
  D.operatorTag.textContent = `OPERATOR // ${op.name} · ${op.role}`;
  D.skillName.textContent = op.skill;
  updateHUD(true); drawMinimap(); drawCompass();
}
function beginPlay() {
  if (!run || run.started) return;
  run.started = true; run.startTime = performance.now();
  D.lock.classList.remove('show');
  document.body.style.cursor = 'none';
  requestPointerLock();
  D.banner.classList.add('show');
  setTimeout(() => D.banner.classList.remove('show'), 2000);
  setTimeout(() => { if (run && !run.ended) announce('MISSION LIVE', `搜刮物资 · 抵达 ${world.extraction?.short || 'LZ-07'} 撤离`, 2400); }, 2100);
  setTimeout(() => toast('目标：搜刮物资，活着抵达直升机坪', '#67e8ff', 'sys'), 2600);
  if (!save.seenIntro) {
    save.seenIntro = true; persist();
    setTimeout(() => toast('WASD 移动 · Shift 冲刺 · 右键机瞄 · 左键射击', '#c8ff4f', 'sys'), 6500);
    setTimeout(() => toast('靠近物资箱按住 E 搜刮 · 金库需要典狱长密钥', '#c8ff4f', 'sys'), 13000);
  }
  Sound.extract();
}
function requestPointerLock() {
  fallbackLook = true;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { fallbackLook = true; });
  } catch (e) { fallbackLook = true; }
}
function pauseGame() {
  if (!run || run.ended || !run.started) return;
  if (!run.paused) {
    run.paused = true;
    D.pauseTime.textContent = fmtTime(RAIDSEC - run.time);
    D.pauseValue.textContent = '₡' + fmt(run.bag.reduce((a, b) => a + b.value, 0));
    D.pause.classList.add('show');
    document.body.style.cursor = 'default';
  }
  if (pointerLocked) document.exitPointerLock();
}
function resumeGame() {
  if (!run || run.ended) return;
  run.paused = false; D.pause.classList.remove('show'); document.body.style.cursor = 'none';
  requestPointerLock();
}
document.addEventListener('pointerlockerror', () => {
  fallbackLook = true;
  if (mode === 'raid' && run && !run.ended) {
    document.body.style.cursor = 'none';
    toast('鼠标锁定受限 · 直接移动鼠标即可瞄准', '#ffb454', 'sys');
  }
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) {
    D.lock.classList.remove('show');
    if (run && run.paused && mode === 'raid' && !run.ended) {
      run.paused = false; D.pause.classList.remove('show'); document.body.style.cursor = 'none';
    }
  } else {
    document.body.style.cursor = 'default';
    if (mode === 'raid' && run && run.started && !run.ended && !run.paused) pauseGame();
  }
});

/* ============================================================
   MODEL BUILDERS
   ============================================================ */
const enemyTint = {
  scav: { body: 0x4e4635, visor: 0xffb454 },
  smg: { body: 0x364337, visor: 0xff7b52 },
  shotgun: { body: 0x403629, visor: 0xffb454 },
  sniper: { body: 0x2d332c, visor: 0xb9a0ff },
  guard: { body: 0x463f2b, visor: 0xffd76a },
  boss: { body: 0x371b20, visor: 0xff4058 }
};
const ENEMY_STATS = {
  scav: { hp: 55, speed: 1.9, vision: 26, fov: .9, range: 22, dmg: 7, burst: 2, fireGap: .18, delay: 1.4, spread: .045, pref: 9 },
  smg: { hp: 76, speed: 2.5, vision: 30, fov: .95, range: 24, dmg: 5, burst: 5, fireGap: .1, delay: 1.0, spread: .06, pref: 8 },
  shotgun: { hp: 118, speed: 2.8, vision: 19, fov: .8, range: 14, dmg: 6, burst: 1, fireGap: .3, delay: 1.7, spread: .11, pref: 4.5, pellets: 5 },
  sniper: { hp: 46, speed: 0, vision: 60, fov: .55, range: 55, dmg: 28, burst: 1, fireGap: .4, delay: 2.9, spread: .004, pref: 35 },
  guard: { hp: 100, speed: 2.3, vision: 30, fov: .95, range: 24, dmg: 6, burst: 4, fireGap: .12, delay: 1.1, spread: .045, pref: 8 },
  boss: { hp: 520, speed: 1.6, vision: 34, fov: 1.1, range: 28, dmg: 9, burst: 6, fireGap: .11, delay: 1.0, spread: .05, pref: 8 }
};
function makeHealthSprite() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8;
  const ctx2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
  const sp = new THREE.Sprite(mat); sp.scale.set(1.15, .14, 1); sp.visible = false; sp.renderOrder = 3;
  return { sprite: sp, cv, ctx: ctx2, tex };
}
function updateHealthSprite(hp, max) {
  const { cv, ctx: c, tex } = hp;
  c.clearRect(0, 0, 64, 8);
  c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(0, 0, 64, 8);
  c.fillStyle = '#ff5364'; c.fillRect(1, 1, 62 * clamp(hp / max, 0, 1), 6);
  tex.needsUpdate = true;
}
function makeEnemy(def) {
  const stats = ENEMY_STATS[def.type] || ENEMY_STATS.scav;
  const tint = enemyTint[def.type] || enemyTint.scav;
  const group = new THREE.Group();
  const baseY = def.y || 0;
  group.position.set(def.x, baseY, def.z);
  const scale = def.type === 'boss' ? 1.25 : 1;
  const modelWrap = new THREE.Group(); modelWrap.scale.setScalar(scale); group.add(modelWrap);
  let model = null, mixer = null, actions = {}, hand = null, muzzle = new THREE.Object3D();
  if (soldierGltf) {
    model = THREE.SkeletonUtils.clone(soldierGltf.scene);
    const box = new THREE.Box3().setFromObject(model);
    const hh = Math.max(.1, box.max.y - box.min.y);
    const fit = 1.78 / hh;
    model.scale.setScalar(fit);
    model.position.y = -box.min.y * fit;
    model.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = false; o.receiveShadow = true; o.frustumCulled = true;
        if (o.material) {
          o.material = o.material.clone();
          if (o.material.color) o.material.color = new THREE.Color(tint.body);
          if (/visor/i.test(o.name) || /visor/i.test(o.material.name || '')) {
            o.material.color = new THREE.Color(tint.visor);
            o.material.emissive = new THREE.Color(tint.visor);
            o.material.emissiveIntensity = 1.4;
          } else if (o.material.emissive) {
            o.material.emissive = new THREE.Color(0x000000);
          }
        }
      }
    });
    model.rotation.y = Math.PI;
    modelWrap.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of soldierGltf.animations) actions[clip.name] = mixer.clipAction(clip);
    if (actions.Idle) { actions.Idle.play(); }
    hand = model.getObjectByName('mixamorig:RightHand');
    if (hand) {
      const tip = new THREE.Object3D(); tip.position.set(0, 0, .5); hand.add(tip);
      muzzle = tip;
    } else { muzzle.position.set(0, 1.4, .6); group.add(muzzle); }
    if (def.type === 'boss') {
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff4058'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .25 }));
      aura.scale.set(3, 3, 1); aura.position.y = 1.2; group.add(aura);
    }
  } else {
    // fallback low-poly soldier
    const mat = new THREE.MeshStandardMaterial({ color: tint.body, roughness: .7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.62, .8, .36), mat); torso.position.y = 1.18; modelWrap.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1b201d, roughness: .8 })); head.position.y = 1.75; modelWrap.add(head);
    for (const dx of [-.18, .18]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.22, .82, .24), mat); leg.position.set(dx, .42, 0); modelWrap.add(leg); }
    muzzle.position.set(.25, 1.35, .5); group.add(muzzle);
  }
  const hp = makeHealthSprite();
  hp.sprite.position.y = 2.2; group.add(hp.sprite);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; group.add(shadow);
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff5364'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .32 }));
  marker.scale.set(.6, .6, 1); marker.position.y = 2.0; group.add(marker);
  scene.add(group);
  const e = {
    type: def.type, def, x: def.x, z: def.z, baseY, group, modelWrap, model, mixer, actions, currentAction: 'Idle', hand, muzzle,
    hpSprite: hp, marker, alive: true, hp: stats.hp, maxHp: stats.hp, speed: stats.speed,
    vision: stats.vision, fov: stats.fov, range: stats.range, dmg: stats.dmg, burst: stats.burst,
    fireGap: stats.fireGap, delay: stats.delay, spread: stats.spread, preferred: stats.pref, pellets: stats.pellets || 1,
    alert: false, state: 'patrol', lastSeen: null, losTimer: 0, path: [], pathT: 0, wait: Math.random() * 3,
    patrol: def.patrol || [[def.x, def.z]], patrolIdx: Math.floor(Math.random() * (def.patrol?.length || 1)),
    fireCd: 1 + Math.random() * 2, burstLeft: 0, shotT: 0, windup: 0, yaw: Math.random() * TAU,
    walkPhase: 0, damageTimer: 0, deadT: 0, flashT: 0, laser: null, strafe: Math.random() < .5 ? 1 : -1, strafeT: 1 + Math.random() * 2,
    stationary: !!def.stationary, scale, height: 1.8 * scale
  };
  hp.sprite.visible = false;
  group.rotation.y = e.yaw;
  return e;
}
function setEnemyAction(e, name, timeScale = 1) {
  if (!e.actions || !e.actions[name]) return;
  if (e.currentAction !== name) {
    const prev = e.actions[e.currentAction];
    const next = e.actions[name];
    next.reset().setEffectiveWeight(1).fadeIn(.22).play();
    if (prev && prev !== next) prev.fadeOut(.22);
    e.currentAction = name;
  }
  const a = e.actions[name]; if (a) a.timeScale = timeScale;
}

/* ============================================================
   VIEWMODEL / WEAPONS
   ============================================================ */
const HAND_CFG = {
  pistol: { r: [.040, -.125, .135], l: [-.005, -.110, .100], rRot: [.18, -.32, -.38], lRot: [.12, .28, .34] },
  smg: { r: [.045, -.120, .155], l: [-.005, -.080, -.215], rRot: [.12, -.28, -.3], lRot: [.2, .05, .12] },
  shotgun: { r: [.045, -.120, .160], l: [0, -.080, -.320], rRot: [.12, -.24, -.24], lRot: [.15, .02, .05] },
  rifle: { r: [.045, -.120, .155], l: [0, -.080, -.290], rRot: [.12, -.26, -.26], lRot: [.17, .02, .08] },
  pistol2: { r: [.040, -.125, .135], l: [-.005, -.110, .100], rRot: [.18, -.32, -.38], lRot: [.12, .28, .34] },
  smg2: { r: [.045, -.120, .155], l: [-.005, -.080, -.215], rRot: [.12, -.28, -.3], lRot: [.2, .05, .12] },
  dmr: { r: [.045, -.120, .155], l: [0, -.080, -.300], rRot: [.12, -.24, -.24], lRot: [.17, .02, .08] },
  sniper: { r: [.045, -.120, .170], l: [0, -.080, -.360], rRot: [.12, -.22, -.22], lRot: [.16, .02, .06] }
};
function makeGlove(side) {
  const root = new THREE.Group();
  const glove = new THREE.MeshBasicMaterial({ color: 0x050806 });
  const gloveHi = new THREE.MeshBasicMaterial({ color: 0x080b08 });
  const pad = new THREE.MeshBasicMaterial({ color: 0x3c4637 });
  const sleeve = new THREE.MeshBasicMaterial({ color: 0x35412f });
  const rb = (w, h, d, r = .012) => new THREE.RoundedBoxGeometry(w, h, d, 3, r);
  const palm = new THREE.Mesh(rb(.078, .065, .105, .022), glove);
  palm.position.set(0, 0, 0); palm.rotation.z = side === 'right' ? -.12 : .12; root.add(palm);
  const back = new THREE.Mesh(rb(.058, .007, .055, .008), pad);
  back.position.set(side === 'right' ? .015 : -.015, .037, -.012); root.add(back);
  // wrapped fingers
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(rb(.072, .019, .048, .008), i % 2 ? glove : gloveHi);
    f.position.set(side === 'right' ? -.030 : .030, -.030 + i * .021, -.068);
    f.rotation.z = side === 'right' ? .20 : -.20;
    root.add(f);
    const kn = new THREE.Mesh(rb(.017, .014, .03, .006), pad);
    kn.position.set(side === 'right' ? .022 : -.022, -.024 + i * .020, -.032);
    root.add(kn);
  }
  const thumb = new THREE.Mesh(rb(.026, .028, .065, .012), glove);
  thumb.position.set(side === 'right' ? -.044 : .044, .024, -.005);
  thumb.rotation.set(.35, 0, side === 'right' ? .55 : -.55); root.add(thumb);
  // wrist + cuff
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(.040, .044, .065, 12), glove);
  wrist.rotation.x = Math.PI / 2; wrist.position.set(0, -.005, .075); root.add(wrist);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.047, .049, .027, 12), pad);
  cuff.rotation.x = Math.PI / 2; cuff.position.set(0, -.008, .105); root.add(cuff);
  // short sleeve stub only — keeps the wrist anchored without a giant floating arm
  const arm = new THREE.Mesh(rb(.09, .082, .4, .034), sleeve);
  arm.position.set(side === 'right' ? .05 : -.05, -.055, .32);
  arm.rotation.set(-.13, side === 'right' ? -.16 : .16, side === 'right' ? -.18 : .18); root.add(arm);
  const elbow = new THREE.Mesh(rb(.07, .068, .08, .02), pad);
  elbow.position.set(side === 'right' ? .05 : -.05, -.07, .45); root.add(elbow);
  const strap = new THREE.Mesh(rb(.07, .014, .028, .006), pad);
  strap.position.set(0, .026, .112); root.add(strap);
  root.scale.setScalar(.70);
  return root;
}
function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function seg(t, a, b) { return smooth01((t - a) / Math.max(.0001, b - a)); }
function applyGunAttachments(g, model, type, stats) {
  const v = stats.visuals || {};
  const dark = new THREE.MeshStandardMaterial({ color: 0x151c19, roughness: .45, metalness: .62 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x2c3531, roughness: .55, metalness: .5 });
  const lensRed = new THREE.MeshBasicMaterial({ color: 0xff4058 });
  const lensBlue = new THREE.MeshBasicMaterial({ color: 0x67e8ff });
  const rb = (w, h, d, r = .006) => new THREE.RoundedBoxGeometry(w, h, d, 2, r);
  const scope = model.getObjectByName('Attach_Scope') || g;
  const muzzle = model.getObjectByName('Attach_Muzzle') || g;
  const rail = model.getObjectByName('Attach_Rail.Bottom') || g;
  const mag = model.getObjectByName('Magazine');
  const stock = model.getObjectByName('Stock') || g;
  if (v.optic && v.optic !== 'iron') {
    const grp = new THREE.Group(); scope.add(grp);
    const base = new THREE.Mesh(rb(.032, .016, .065, .004), dark); base.position.set(0, .012, 0); grp.add(base);
    if (v.optic === 'reddot') {
      const hood = new THREE.Mesh(rb(.026, .024, .03, .004), dark); hood.position.set(0, .032, -.008); grp.add(hood);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(.019, .019), lensRed); glass.position.set(0, .033, -.024); grp.add(glass);
    } else if (v.optic === 'holo') {
      const frame = new THREE.Mesh(rb(.038, .034, .05, .004), dark); frame.position.set(0, .035, -.005); grp.add(frame);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(.029, .025), lensBlue); glass.position.set(0, .035, -.031); grp.add(glass);
    } else if (v.optic === 'scope') {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(.023, .023, .14, 12), grey);
      tube.rotation.x = Math.PI / 2; tube.position.set(0, .036, -.02); grp.add(tube);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.018, 16), lensBlue); lens.position.set(0, .036, -.091); lens.rotation.x = -Math.PI / 2; grp.add(lens);
      for (const z of [-.06, .03]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.025, .004, 6, 12), dark); ring.position.set(0, .036, z); grp.add(ring); }
    }
  }
  if (v.muzzle === 'suppressor') {
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(.027, .027, .15, 12), dark);
    sup.rotation.x = Math.PI / 2; sup.position.set(0, .015, -.075); muzzle.add(sup);
  } else if (v.muzzle === 'comp') {
    const comp = new THREE.Mesh(rb(.04, .036, .07, .008), grey); comp.position.set(0, .015, -.035); muzzle.add(comp);
    for (let i = 0; i < 3; i++) { const slot = new THREE.Mesh(new THREE.BoxGeometry(.042, .005, .008), dark); slot.position.set(0, .03, -.055 + i * .016); muzzle.add(slot); }
  } else if (v.muzzle === 'brake') {
    const brake = new THREE.Mesh(rb(.048, .04, .065, .006), grey); brake.position.set(0, .015, -.033); muzzle.add(brake);
    for (const s of [-.015, .015]) { const port = new THREE.Mesh(new THREE.BoxGeometry(.052, .012, .012), dark); port.position.set(0, .015, s); muzzle.add(port); }
  }
  if (v.grip === 'vertical' || v.grip === 'angled') {
    const grp = new THREE.Group(); rail.add(grp);
    const grip = new THREE.Mesh(rb(.03, v.grip === 'vertical' ? .09 : .075, .036, .008), dark);
    grip.position.set(0, v.grip === 'vertical' ? -.06 : -.045, -.012);
    grip.rotation.x = v.grip === 'vertical' ? .05 : .42; grp.add(grip);
  } else if (v.grip === 'laser') {
    const box = new THREE.Mesh(rb(.03, .028, .05, .005), dark); box.position.set(0, -.032, -.01); rail.add(box);
    const beam = new THREE.Mesh(new THREE.CircleGeometry(.008, 10), lensRed); beam.position.set(0, -.032, -.037); rail.add(beam);
  }
  if (v.mag === 'extended' && mag) {
    const ext = new THREE.Mesh(rb(.031, .085, .06, .006), dark); ext.position.set(0, -.075, 0); mag.add(ext);
    const plate = new THREE.Mesh(rb(.036, .012, .066, .004), grey); plate.position.set(0, -.12, 0); mag.add(plate);
  } else if (v.mag === 'quick' && mag) {
    const plate = new THREE.Mesh(rb(.036, .012, .066, .004), new THREE.MeshBasicMaterial({ color: 0xc8ff4f })); plate.position.set(0, -.055, 0); mag.add(plate);
  }
  if (v.stock && v.stock !== 'std') {
    const grp = new THREE.Group(); stock.add(grp);
    if (v.stock === 'light') {
      const pad = new THREE.Mesh(rb(.042, .06, .026, .008), grey); pad.position.set(0, 0, .02); grp.add(pad);
      for (let i = 0; i < 3; i++) { const cut = new THREE.Mesh(new THREE.BoxGeometry(.046, .012, .006), dark); cut.position.set(0, -.02 + i * .017, .034); grp.add(cut); }
    } else {
      const pad = new THREE.Mesh(rb(.05, .075, .04, .008), dark); pad.position.set(0, 0, .025); grp.add(pad);
      const cheek = new THREE.Mesh(rb(.035, .022, .09, .006), grey); cheek.position.set(0, .035, -.008); grp.add(cheek);
    }
  }
}
function buildGunModel(type) {
  const src = gunGltfs[type];
  const g = new THREE.Group();
  const model = THREE.SkeletonUtils.clone(src.scene);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const desired = { pistol: .34, pistol2: .30, smg: .62, smg2: .70, shotgun: .78, rifle: .84, dmr: .90, sniper: 1.02 }[type] || .7;
  const fit = desired / Math.max(.01, size.z);
  model.scale.setScalar(fit);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material) {
        o.material = o.material.clone();
        if (o.material.roughness !== undefined) o.material.roughness = Math.min(.78, o.material.roughness * 1.05 + .08);
        if (o.material.metalness !== undefined) o.material.metalness = Math.max(.25, o.material.metalness);
        if (o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 1.25;
      }
    }
  });
  g.add(model);
  const muzzleNode = model.getObjectByName('Attach_Muzzle') || model.getObjectByName('Attach_Muzzle') || null;
  const muzzle = new THREE.Object3D();
  if (muzzleNode) muzzleNode.add(muzzle); else { muzzle.position.set(0, .01, -desired / 2); g.add(muzzle); }
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffe3a3'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  flash.scale.set(.14, .14, 1); flash.visible = false; muzzle.add(flash);
  const light = new THREE.PointLight(0xffb45c, 0, 1.6); muzzle.add(light);
  const scope = model.getObjectByName('Attach_Scope');
  if (scope && (type === 'rifle' || type === 'smg')) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(.035, .025, .08), new THREE.MeshStandardMaterial({ color: 0x151a18, roughness: .4, metalness: .6 }));
    base.position.y = .025; scope.add(base);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.012, 12), new THREE.MeshBasicMaterial({ color: 0x67e8ff, side: THREE.DoubleSide }));
    lens.position.set(0, .038, .042); lens.rotation.x = -Math.PI / 2; scope.add(lens);
  }
  const cfg = HAND_CFG[type] || HAND_CFG.rifle;
  const rightHand = makeGlove('right'); rightHand.position.fromArray(cfg.r); rightHand.rotation.set(...cfg.rRot); g.add(rightHand);
  const leftHand = makeGlove('left'); leftHand.position.fromArray(cfg.l); leftHand.rotation.set(...cfg.lRot); g.add(leftHand);
  g.position.set(.24, -.12, -.82);
  g.rotation.set(-.015, .30, -.025);
  viewScene.add(g);
  g.updateMatrixWorld(true);
  function localOf(obj) { if (!obj) return null; const p = obj.getWorldPosition(new THREE.Vector3()); return g.worldToLocal(p.clone()); }
  const magNode = model.getObjectByName('Magazine');
  const chargeNode = model.getObjectByName('Slide') || model.getObjectByName('Charging Handle') || model.getObjectByName('Bolt');
  const pumpNode = model.getObjectByName('Pump');
  const railNode = model.getObjectByName('Attach_Rail.Bottom');
  const magPos = localOf(magNode);
  const stats = getWeaponStats(type);
  applyGunAttachments(g, model, type, stats);
  let reloadMag = null;
  if (magPos) {
    reloadMag = new THREE.Mesh(new THREE.BoxGeometry(.028, .105, .055), new THREE.MeshStandardMaterial({ color: 0x1b2420, metalness: .55, roughness: .43 }));
    reloadMag.position.set(magPos.x, magPos.y, magPos.z); reloadMag.visible = false; g.add(reloadMag);
  }
  viewModel = {
    group: g, muzzle, flash, light, type, flashT: 0, recoil: 0, swayX: 0, swayY: 0,
    base: { x: .24, y: -.12, z: -.82 }, ads: { x: 0, y: -.08, z: -.72 },
    hands: {
      right: rightHand, left: leftHand,
      leftBase: leftHand.position.clone(), leftRotBase: leftHand.rotation.clone(),
      magLocal: localOf(magNode), chargeLocal: localOf(chargeNode), pumpLocal: localOf(pumpNode)
    },
    magNode, chargeNode, pumpNode,
    magBase: magNode ? magNode.position.clone() : null,
    chargeBase: chargeNode ? chargeNode.position.clone() : null,
    pumpBase: pumpNode ? pumpNode.position.clone() : null,
    pumpKick: 0, reloadSfx: {}, reloadMag, reloadMagBase: magPos ? new THREE.Vector3(magPos.x, magPos.y, magPos.z) : null,
    parts: { slide: model.getObjectByName('Slide'), pump: pumpNode, mag: magNode, bolt: model.getObjectByName('Bolt') },
    partBase: {}
  };
  for (const k in viewModel.parts) { const p = viewModel.parts[k]; if (p) viewModel.partBase[k] = p.position.clone(); }
  animateHands(viewModel, 0, 1);
}
function buildViewModel(type) {
  if (gunGltfs[type]) { buildGunModel(type); return; }

  const w = WEAPONS[type];
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b3632, roughness: .36, metalness: .78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x090e0d, roughness: .82, metalness: .2 });
  const tan = new THREE.MeshStandardMaterial({ color: 0x5a513d, roughness: .72, metalness: .14 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x0d120f, roughness: .92 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x18221c, roughness: .95 });
  const add = (w2, h2, d2, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  let muzZ = -.78;
  if (type === 'pistol') {
    add(.085, .105, .34, 0, 0, -.2, metal);
    add(.04, .04, .15, 0, .028, -.43, metal);
    add(.075, .19, .1, 0, -.13, -.13, dark).rotation.x = -.16;
    add(.06, .045, .1, 0, .075, -.15, dark);
    add(.022, .022, .018, 0, .1, -.37, new THREE.MeshBasicMaterial({ color: 0xc8ff4f }));
    muzZ = -.51;
  } else if (type === 'smg') {
    add(.105, .13, .44, 0, 0, -.25, metal);
    add(.048, .048, .3, 0, .012, -.56, dark);
    add(.07, .23, .1, 0, -.18, -.2, dark);
    add(.09, .12, .2, 0, .005, -.42, tan);
    add(.07, .05, .16, 0, .085, -.24, dark);
    add(.022, .022, .018, 0, .115, -.32, new THREE.MeshBasicMaterial({ color: 0xff5364 }));
    add(.035, .035, .16, 0, .015, -.68, dark);
    muzZ = -.76;
  } else if (type === 'shotgun') {
    add(.1, .11, .4, 0, 0, -.22, tan);
    add(.045, .045, .6, 0, .04, -.55, dark);
    add(.07, .065, .28, 0, -.005, -.5, dark);
    add(.08, .14, .15, 0, -.14, -.16, tan);
    add(.11, .11, .22, 0, -.005, -.02, tan);
    add(.06, .045, .15, 0, .075, -.23, dark);
    add(.03, .028, .08, 0, .015, -.82, metal);
    muzZ = -.88;
  } else {
    add(.11, .135, .56, 0, 0, -.3, metal);
    add(.048, .048, .38, 0, .015, -.67, dark);
    add(.075, .22, .11, 0, -.17, -.2, dark);
    add(.095, .115, .22, 0, .005, -.5, tan);
    add(.05, .055, .15, 0, .09, -.14, dark);
    add(.045, .035, .09, 0, .13, -.14, metal);
    add(.065, .04, .04, 0, .115, -.09, new THREE.MeshBasicMaterial({ color: 0x67e8ff }));
    add(.022, .022, .018, 0, .165, -.14, new THREE.MeshBasicMaterial({ color: 0xff5364 }));
    add(.032, .032, .18, 0, .018, -.82, dark);
    muzZ = -.92;
  }
  // gloved support hand under handguard
  add(.105, .1, .15, -.015, -.09, -.45, glove).rotation.x = -.18;
  // trigger hand
  add(.095, .125, .14, .015, -.11, -.12, glove).rotation.x = .2;
  // forearms kept low and close to body, away from camera
  const armR = add(.075, .075, .24, .12, -.33, .02, sleeve);
  armR.rotation.x = .4; armR.rotation.z = -.1;
  add(.075, .075, .12, -.02, -.19, -.42, glove);
  // weapon light lens
  add(.032, .032, .025, .065, -.03, -.62, new THREE.MeshBasicMaterial({ color: 0xbdefff }));
  // top rail + edge highlights
  add(.035, .02, .3, 0, .085, -.42, dark);
  add(.018, .008, .3, -.035, .058, -.3, new THREE.MeshStandardMaterial({ color: 0x52605a, roughness: .35, metalness: .8 }));
  add(.018, .008, .2, .04, .045, -.5, new THREE.MeshStandardMaterial({ color: 0x3d4a44, roughness: .4, metalness: .7 }));
  // muzzle device + flash
  add(.036, .036, .06, 0, .02, muzZ - .04, metal);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .02, muzZ); g.add(muzzle);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffe3a3'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  flash.scale.set(.18, .18, 1); flash.position.copy(muzzle.position); flash.visible = false; g.add(flash);
  const light = new THREE.PointLight(0xffb45c, 0, 1.5); light.position.copy(muzzle.position); g.add(light);
  g.scale.setScalar(.72);
  g.position.set(.29, -.27, -.7);
  g.rotation.set(-.02, .3, -.02);
  viewScene.add(g);
  viewModel = { group: g, muzzle, flash, light, base: { x: .29, y: -.27, z: -.7 }, ads: { x: 0, y: -.16, z: -.58 }, baseRotY: .3, type, flashT: 0, recoil: 0, swayX: 0, swayY: 0, reloading: 0 };
}
function animateHands(vm, rt, dt) {
  if (!vm.hands) return;
  const L = vm.hands.left;
  const base = vm.hands.leftBase;
  if (!run.reloading) {
    L.position.lerp(base, 1 - Math.exp(-dt * 14));
    L.rotation.x = lerp(L.rotation.x, vm.hands.leftRotBase.x, 1 - Math.exp(-dt * 14));
    L.rotation.y = lerp(L.rotation.y, vm.hands.leftRotBase.y, 1 - Math.exp(-dt * 14));
    L.rotation.z = lerp(L.rotation.z, vm.hands.leftRotBase.z, 1 - Math.exp(-dt * 14));
    if (vm.magNode && vm.magBase) vm.magNode.position.copy(vm.magBase);
    if (vm.chargeNode && vm.chargeBase) vm.chargeNode.position.copy(vm.chargeBase);
    if (vm.reloadMag) vm.reloadMag.visible = false;
    const fire = clamp(vm.recoil || 0, 0, 1.6);
    if (vm.parts?.slide && vm.partBase.slide) vm.parts.slide.position.z = vm.partBase.slide.z + fire * .03;
    if (vm.parts?.bolt && vm.partBase.bolt) vm.parts.bolt.position.z = vm.partBase.bolt.z + fire * .025;
    if (vm.parts?.pump && vm.partBase.pump && !run.reloading) vm.parts.pump.position.y = vm.partBase.pump.y + Math.sin((vm.pumpKick || 0) * Math.PI) * .035;
    return;
  }
  const hasMag = !!vm.magNode && !!vm.hands.magLocal;
  const target = base.clone();
  let lift = 0;
  if (hasMag) {
    const mag = vm.hands.magLocal;
    if (rt < .14) {
      target.lerp(mag.clone().add(new THREE.Vector3(-.055, .015, .01)), seg(rt, 0, .14));
    } else if (rt < .34) {
      target.copy(mag).add(new THREE.Vector3(-.055, .015 - .13 * seg(rt, .14, .34), .01));
      if (vm.magNode) vm.magNode.position.y = vm.magBase.y - .13 * seg(rt, .14, .34);
    } else if (rt < .54) {
      target.copy(mag).add(new THREE.Vector3(-.055, .015 - .13 * (1 - seg(rt, .34, .52)), .01));
      if (vm.magNode) vm.magNode.position.y = vm.magBase.y - .13 * (1 - seg(rt, .34, .52));
    } else if (rt < .72) {
      const charge = vm.hands.chargeLocal || mag;
      target.lerp(charge.clone().add(new THREE.Vector3(-.06, .03, .0)), seg(rt, .54, .72));
    } else if (rt < .87) {
      const charge = vm.hands.chargeLocal || mag;
      target.copy(charge).add(new THREE.Vector3(-.06, .03, .0));
      lift = Math.sin(seg(rt, .72, .86) * Math.PI);
      if (vm.chargeNode) {
        vm.chargeNode.position.x = vm.chargeBase.x + lift * .022;
        vm.chargeNode.position.z = vm.chargeBase.z + lift * .022;
      }
    } else {
      const charge = vm.hands.chargeLocal || mag;
      target.copy(charge).add(new THREE.Vector3(-.06, .03, .0)).lerp(base, seg(rt, .87, 1));
    }
    if (!vm.reloadSfx.magOut && rt > .16) { vm.reloadSfx.magOut = true; Sound.noise(.07, .018, 620, .8, 0); }
    if (!vm.reloadSfx.magIn && rt > .50) { vm.reloadSfx.magIn = true; Sound.tone(190, .06, 'square', .03, 120); Sound.reload(); }
    if (!vm.reloadSfx.bolt && rt > .73) { vm.reloadSfx.bolt = true; Sound.reloadDone(); }
    if (vm.reloadMag && vm.reloadMagBase) {
      vm.reloadMag.visible = rt > .08 && rt < .46;
      const drop = rt < .32 ? seg(rt, .08, .32) : 1 - seg(rt, .32, .46);
      vm.reloadMag.position.set(vm.reloadMagBase.x, vm.reloadMagBase.y - drop * .16, vm.reloadMagBase.z + drop * .035);
      vm.reloadMag.rotation.x = drop * .45;
    }
  } else {
    // shotgun pump: hand slides along the fore-end
    const back = Math.sin(seg(rt, .12, .52) * Math.PI);
    target.copy(base).add(new THREE.Vector3(0, -.02, .10 * back));
    if (vm.pumpNode && vm.pumpBase) vm.pumpNode.position.y = vm.pumpBase.y + back * .04;
    if (!vm.reloadSfx.pump && rt > .2) { vm.reloadSfx.pump = true; Sound.reload(); }
  }
  L.position.lerp(target, 1 - Math.exp(-dt * 24));
  L.rotation.z = lerp(L.rotation.z, vm.hands.leftRotBase.z + .35 * Math.sin(clamp(rt, 0, 1) * Math.PI), 1 - Math.exp(-dt * 12));
  L.rotation.x = lerp(L.rotation.x, vm.hands.leftRotBase.x + .2 * Math.sin(clamp(rt, 0, 1) * Math.PI), 1 - Math.exp(-dt * 12));
}
function updateViewModel(dt) {
  if (!viewModel) return;
  const vm = viewModel;
  const moving = player.moveSpeed > .3;
  const targetAds = input.mouseRight && !run.reloading && !run.action && !player.sprinting ? 1 : 0;
  player.ads = targetAds === 1;
  const adsBlend = player.ads ? 1 : 0;
  const swayTargetX = clamp(-mouseDelta.x * .00035, -.03, .03);
  const swayTargetY = clamp(mouseDelta.y * .00035, -.025, .025);
  vm.swayX = lerp(vm.swayX, swayTargetX, 1 - Math.exp(-dt * 10));
  vm.swayY = lerp(vm.swayY, swayTargetY, 1 - Math.exp(-dt * 10));
  const bob = player.bob;
  const bobX = moving ? Math.sin(bob) * .012 : Math.sin(performance.now() * .0015) * .002;
  const bobY = moving ? Math.abs(Math.cos(bob)) * .012 : Math.sin(performance.now() * .0011) * .002;
  let bx = lerp(vm.base.x, vm.ads.x, adsBlend) + vm.swayX + bobX;
  let by = lerp(vm.base.y, vm.ads.y, adsBlend) + vm.swayY + bobY;
  let bz = lerp(vm.base.z, vm.ads.z, adsBlend);
  let rx = -.015, ry = lerp(.36, 0, adsBlend), rz = -.025;
  if (player.sprinting) { bx += .12; by -= .06; bz += .06; rx += .2; ry += .4; rz += .15; }
  let reloadT = 0;
  if (run.reloading) {
    reloadT = clamp(run.reloadT / weapon().reload, 0, 1);
    const dip = Math.sin(Math.min(1, reloadT * 1.2) * Math.PI);
    by -= dip * .18; rx += dip * .42; rz += dip * .2; bx += dip * .025;
  }
  let inspectLift = 0;
  if (run.inspectT > 0) {
    const p = 1 - run.inspectT / 2.4; inspectLift = Math.sin(Math.min(1, p * 1.15) * Math.PI);
    bx += inspectLift * .015; by += inspectLift * .12; bz += inspectLift * .12;
    rx += inspectLift * .24; ry += inspectLift * 1.2; rz += inspectLift * .38;
  }
  if (run.action?.type === 'med') { bx += .08; by -= .15; rx += .3; }
  bz += vm.recoil * .08;
  rx -= vm.recoil * .22;
  vm.group.position.set(bx, by, bz);
  vm.group.rotation.set(rx, ry, rz);
  animateHands(vm, reloadT, dt);
  vm.pumpKick = Math.max(0, (vm.pumpKick || 0) - dt * 3);
  if (!run.reloading && vm.pumpNode && vm.pumpBase) vm.pumpNode.position.y = vm.pumpBase.y + Math.sin(vm.pumpKick * Math.PI) * .035;
  vm.recoil = Math.max(0, vm.recoil - dt * 8);
  vm.flashT -= dt;
  if (vm.flashT > 0) {
    vm.flash.visible = true;
    const s = (.2 + Math.random() * .18) * (vm.flashScale || 1);
    vm.flash.scale.set(s, s, 1);
    vm.flash.material.rotation = Math.random() * TAU;
    vm.light.intensity = 2.2;
  } else {
    vm.flash.visible = false;
    vm.light.intensity = 0;
  }
  mouseDelta.x *= Math.exp(-dt * 12); mouseDelta.y *= Math.exp(-dt * 12);
}

/* ============================================================
   INPUT
   ============================================================ */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (k === 'escape') {
    if (D.help.classList.contains('show')) { closeHelp(); return; }
    if (mode === 'raid' && run && !run.ended) { pauseGame(); return; }
  }
  if (mode !== 'raid' || !run || run.ended || run.paused) return;
  input.keys[k] = true;
  if (e.repeat) return;
  if (k === 'r') startReload();
  if (k === 'v') useSkill();
  if (k === 'f') {
    if (run.inspectT > 0) run.inspectT = 0;
    else if (!run.reloading && !run.action) { run.inspectT = 2.4; Sound.reload(); toast('检视武器 · 按 F 取消', '#67e8ff', 'sys'); }
  }
  if (k === 'q') useMed();
  if (k === 'g') throwGrenade();
  if (k === 'x') discardLowest();
  if (k === 'c') { player.crouch = !player.crouch; }
  if (k === 'control') player.crouch = true;
  if (k === 'm') toggleMute();
  if (k === 'e') input.interact = true;
  if (k === ' ') { if (player.jumpY <= 0 && !player.crouch) { player.vy = 4.6; player.jumpY = .001; } }
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  input.keys[k] = false;
  if (k === 'e') input.interact = false;
  if (k === 'control' && mode === 'raid') player.crouch = false;
});
canvas.addEventListener('click', () => {
  if (mode === 'raid' && run && run.started && !run.paused && !run.ended && !pointerLocked) requestPointerLock();
});
addEventListener('mousemove', e => {
  if ((!pointerLocked && !fallbackLook) || mode !== 'raid' || !run || run.paused || run.ended) return;
  const s = player.ads ? .00125 : .00215;
  player.yaw -= e.movementX * s;
  player.pitch = clamp(player.pitch - e.movementY * s, -1.35, 1.25);
  mouseDelta.x += e.movementX; mouseDelta.y += e.movementY;
});
addEventListener('mousedown', e => {
  if (mode !== 'raid' || !run || !run.started || run.paused || run.ended) return;
  if (e.target.closest('button,.modal-layer,.screen,#lock-overlay,#pause,#help')) return;
  if (e.button === 0) { input.mouseLeft = true; input.firePressed = true; }
  if (e.button === 2) input.mouseRight = true;
});
addEventListener('mouseup', e => {
  if (e.button === 0) input.mouseLeft = false;
  if (e.button === 2) input.mouseRight = false;
});
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { input.keys = {}; input.mouseLeft = false; input.interact = false; if (mode === 'raid') pauseGame(); });

/* ============================================================
   PLAYER UPDATE
   ============================================================ */
function collides(x, z, r = .34) {
  if (x < -55 || x > 55 || z < -55 || z > 55) return true;
  for (const c of world.colliders) {
    if (c.maxY < .22 || c.minY > 1.8) continue;
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  }
  return false;
}
function movePlayer(dx, dz) {
  if (!collides(player.x + dx, player.z)) player.x += dx;
  if (!collides(player.x, player.z + dz)) player.z += dz;
}
function updatePlayer(dt) {
  const w = weapon();
  if (run.inspectT > 0) run.inspectT = Math.max(0, run.inspectT - dt);
  const forward = (input.keys['w'] ? 1 : 0) - (input.keys['s'] ? 1 : 0);
  const strafe = (input.keys['d'] ? 1 : 0) - (input.keys['a'] ? 1 : 0);
  let length = Math.hypot(forward, strafe);
  const moving = length > 0;
  const wantSprint = !!input.keys['shift'] && moving && forward > 0 && !player.ads && !run.action && !input.interact;
  player.sprinting = wantSprint && !player.crouch;
  player.walking = moving && !player.sprinting;
  let speed = 4.15;
  if (player.crouch) speed = 2.15;
  if (player.sprinting) speed = 7.0;
  if (player.ads) speed = 2.5;
  speed *= (w.moveMult || 1) * (run.skillT > 0 ? 1.35 : 1) * (run.operator?.id === 'assault' ? 1.06 : 1);
  if (run.action) speed *= .5;
  if (input.interact && run.prompt) speed *= .5;
  if (moving) {
    const nx = forward / length, nz = strafe / length;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const dx = (fx * nx + rx * nz) * speed * dt;
    const dz = (fz * nx + rz * nz) * speed * dt;
    movePlayer(dx, dz);
    player.moveSpeed = speed;
    player.bob += dt * speed * 2.4;
    player.stepT -= dt;
    if (player.stepT <= 0 && !player.crouch) {
      player.stepT = player.sprinting ? .28 : .42;
      Sound.noise(.05, player.sprinting ? .012 : .007, 260, .6, 0);
    }
  } else {
    player.moveSpeed = 0;
    player.bob += dt * 1.2;
  }
  // vertical
  if (player.jumpY > 0 || player.vy !== 0) {
    player.vy -= 16 * dt;
    player.jumpY += player.vy * dt;
    if (player.jumpY <= 0) { player.jumpY = 0; player.vy = 0; }
  }
  const targetEye = player.crouch ? 1.08 : 1.66;
  player.eye = lerp(player.eye, targetEye, 1 - Math.exp(-dt * 10));
  // recoil recovery
  player.recoilPitch = lerp(player.recoilPitch, 0, 1 - Math.exp(-dt * 7));
  player.recoilVis = Math.max(0, player.recoilVis - dt * 7);
  shake = Math.max(0, shake - dt * 22);
  // camera
  const bobY = moving && !player.ads ? Math.abs(Math.sin(player.bob)) * .035 : 0;
  const bobX = moving && !player.ads ? Math.cos(player.bob * 1) * .018 : 0;
  const roll = (strafe ? -strafe * .012 : 0) + Math.sin(player.bob) * .003;
  camera.position.set(player.x + bobX, player.eye + player.jumpY + bobY, player.z);
  camera.rotation.set(player.pitch + player.recoilPitch + (Math.random() - .5) * shake * .004, player.yaw + (Math.random() - .5) * shake * .004, roll);
  const targetFov = player.ads ? 54 : player.sprinting ? 82 : 76;
  if (Math.abs(camera.fov - targetFov) > .05) { camera.fov = lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 9)); camera.updateProjectionMatrix(); }
  // reload
  if (run.reloading) {
    run.reloadT += dt;
    if (run.reloadT >= w.reload) {
      const take = Math.min(w.mag - run.ammo, run.reserve);
      run.ammo += take; run.reserve -= take; run.reloading = false; run.reloadT = 0; Sound.reloadDone();
    }
  }
  // med channel
  if (run.action) {
    run.action.t += dt;
    if (run.action.t >= run.action.dur) {
      run.meds--; player.hp = Math.min(player.maxHp, player.hp + 45);
      toast('已使用医疗针 +45', '#c8ff4f'); Sound.reloadDone(); run.action = null;
    }
  }
  run.fireCd = Math.max(0, run.fireCd - dt);
  run.bloom = Math.max(0, run.bloom - dt * .18);
  const trigger = w.auto ? input.mouseLeft : input.firePressed;
  if (trigger && !input.interact && !run.action && !run.reloading && run.inspectT <= 0) fireWeapon();
  input.firePressed = false;
}
function useSkill() {
  if (!run || run.ended || run.paused || run.skillCd > 0 || !run.started) return;
  const op = run.operator;
  if (op.type === 'heal') {
    player.hp = Math.min(player.maxHp, player.hp + 45);
    toast(`${op.skill} · 回复 45 生命`, '#c8ff4f'); Sound.success();
  } else if (op.type === 'speed') {
    run.skillT = 6; toast(`${op.skill} · 移速提升 6 秒`, '#ffb454'); Sound.extract();
  } else {
    run.revealT = 10; toast(`${op.skill} · 敌人标记 10 秒`, '#67e8ff'); Sound.extract();
  }
  run.skillCd = op.cd;
}
function startReload() {
  if (!run || run.reloading || run.action || run.inspectT > 0) return;
  const w = weapon();
  if (run.ammo >= w.mag || run.reserve <= 0) return;
  run.reloading = true; run.reloadT = 0; if (viewModel) viewModel.reloadSfx = {}; Sound.reload();
}
function useMed() {
  if (!run || run.action) return;
  if (run.meds <= 0) { toast('没有医疗针了', '#ff5364', 'bad'); return; }
  if (player.hp >= player.maxHp) { toast('生命值已满', '#839690', 'sys'); return; }
  run.action = { type: 'med', t: 0, dur: .95 }; Sound.reload();
}
function discardLowest() {
  if (!run || !run.bag.length) return;
  let idx = -1, low = Infinity;
  run.bag.forEach((i, n) => { if (!i.key && i.value < low) { low = i.value; idx = n; } });
  if (idx < 0) return;
  const [item] = run.bag.splice(idx, 1); run.value -= item.value;
  toast(`已丢弃 ${item.name}`, '#ffb454'); updateBagUI(true); Sound.pickup();
}

/* ============================================================
   BALLISTICS / EFFECTS
   ============================================================ */
function rayColliders(origin, dir, maxDist = 120) {
  let best = null;
  for (const c of world.colliders) {
    let tmin = 0, tmax = maxDist, axis = 0, sign = 1;
    const mins = [c.minX, c.minY, c.minZ], maxs = [c.maxX, c.maxY, c.maxZ];
    const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
    let hit = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-7) { if (o[a] < mins[a] || o[a] > maxs[a]) { hit = false; break; } continue; }
      let t1 = (mins[a] - o[a]) / d[a], t2 = (maxs[a] - o[a]) / d[a], s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) { hit = false; break; }
    }
    if (hit && tmin > .02 && tmin < maxDist && (!best || tmin < best.t)) {
      const normal = new THREE.Vector3();
      if (axis === 0) normal.set(sign, 0, 0); else if (axis === 1) normal.set(0, sign, 0); else normal.set(0, 0, sign);
      best = { t: tmin, point: origin.clone().addScaledVector(dir, tmin), normal, collider: c, tag: c.tag };
    }
  }
  if (dir.y < 0) {
    const t = -origin.y / dir.y;
    if (t > .02 && t < maxDist && (!best || t < best.t)) {
      best = { t, point: origin.clone().addScaledVector(dir, t), normal: new THREE.Vector3(0, 1, 0), tag: 'ground' };
    }
  }
  return best;
}
function rayPlayer(origin, dir, maxDist = 80) {
  const ox = origin.x - player.x, oz = origin.z - player.z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-6) return null;
  const b = 2 * (ox * dir.x + oz * dir.z), c = ox * ox + oz * oz - .38 * .38;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < .05) t = (-b + sq) / (2 * a);
  if (t < .05 || t > maxDist) return null;
  const y = origin.y + dir.y * t;
  if (y < 0 || y > 1.85 + player.jumpY) return null;
  return t;
}
function rayEnemy(e, origin, dir, maxDist) {
  const rad = e.type === 'boss' ? .52 : .4;
  const ox = origin.x - e.x, oz = origin.z - e.z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-6) return null;
  const b = 2 * (ox * dir.x + oz * dir.z), c = ox * ox + oz * oz - rad * rad;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < .05) t = (-b + sq) / (2 * a);
  if (t < .05 || t > maxDist) return null;
  const y = origin.y + dir.y * t;
  if (y < e.baseY + .1 || y > e.baseY + e.height) return null;
  return { t, head: y > e.baseY + e.height * .78 };
}
function addTracer(from, to, color = 0xffe6b0, width = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const line = new THREE.Line(geo, mat); line.frustumCulled = false; scene.add(line);
  tracers.push({ line, life: .1, max: .1 });
}
function impact(point, normal, color = 0xffc47a) {
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .9 }));
    const s = .06 + Math.random() * .1; m.scale.set(s, s, 1); m.position.copy(point);
    const v = normal.clone().multiplyScalar(1.5 + Math.random() * 2).add(V((Math.random() - .5) * 2, Math.random() * 2, (Math.random() - .5) * 2));
    scene.add(m); effects.push({ mesh: m, v, life: .25 + Math.random() * .3, max: .55, spin: 0 });
  }
  // bullet hole
  if (decals.length > 50) { const old = decals.shift(); scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
  const d = new THREE.Mesh(new THREE.CircleGeometry(.045 + Math.random() * .02, 6), new THREE.MeshBasicMaterial({ color: 0x020303, transparent: true, opacity: .8, depthWrite: false }));
  d.position.copy(point).addScaledVector(normal, .012);
  d.lookAt(point.clone().add(normal)); scene.add(d); decals.push(d);
}
function spawnBlood(point, color = 0x7d1f2c) {
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff5364'), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .7 }));
    const s = .08 + Math.random() * .12; m.scale.set(s, s, 1); m.position.copy(point);
    scene.add(m);
    effects.push({ mesh: m, v: V((Math.random() - .5) * 2.5, Math.random() * 2.2, (Math.random() - .5) * 2.5), life: .35, max: .35, spin: 0 });
  }
}
function fireWeapon() {
  const w = weapon();
  if (run.fireCd > 0 || run.reloading || run.action) return;
  if (run.ammo <= 0) {
    if (run.reserve > 0) startReload(); else { Sound.empty(); run.fireCd = .4; toast('弹药耗尽', '#ff5364', 'bad'); }
    return;
  }
  run.fireCd = 60 / w.rpm;
  run.ammo--;
  run.shots += w.pellets;
  player.sprinting = false;
  const spread = (w.spread * (player.ads ? .28 : 1) * (player.crouch ? .72 : 1) * (player.moveSpeed > .5 ? 1.45 : 1) * (player.ads ? 1 : (w.hipSpreadMult || 1))) + run.bloom;
  const dir = camera.getWorldDirection(V());
  const right = V().crossVectors(dir, camera.up).normalize();
  const up = V().crossVectors(right, dir).normalize();
  for (let p = 0; p < w.pellets; p++) {
    const d = dir.clone().addScaledVector(right, (Math.random() - .5) * spread * 2).addScaledVector(up, (Math.random() - .5) * spread * 2).normalize();
    tracePlayerShot(d, w.dmg);
  }
  run.bloom = Math.min(.03, run.bloom + w.recoil * .0009);
  player.recoilPitch += w.recoil * .0017 * (run.operator?.id === 'assault' ? .92 : 1);
  player.recoilVis = Math.min(1.8, player.recoilVis + w.recoil * .18);
  shake = Math.min(2.2, shake + w.recoil * .12);
  if (viewModel) { viewModel.recoil = Math.min(1.8, viewModel.recoil + w.recoil * .2); viewModel.flashT = .055; viewModel.flashScale = w.flashMult || 1; if (save.loadout.weapon === 'shotgun') viewModel.pumpKick = 1; }
  Sound.shot(save.loadout.weapon, false, 0, w.suppressed ? .55 : 1);
  alertEnemies(player.x, player.z, w.suppressed ? 12 : 34);
  if (run.ammo === 0 && run.reserve > 0) setTimeout(() => { if (run && !run.ended) startReload(); }, 160);
}
function tracePlayerShot(dir, dmg) {
  const origin = camera.position.clone();
  const wall = rayColliders(origin, dir, 120);
  let hit = null, hitEnemy = null;
  for (const e of enemies) {
    if (!e.alive) continue;
    const r = rayEnemy(e, origin, dir, wall ? wall.t : 120);
    if (r && (!hit || r.t < hit.t)) { hit = r; hitEnemy = e; }
  }
  const end = hitEnemy ? origin.clone().addScaledVector(dir, hit.t) : wall ? wall.point : origin.clone().addScaledVector(dir, 100);
  const muzzle = camera.position.clone().addScaledVector(dir, .75).addScaledVector(V().crossVectors(dir, camera.up).normalize(), .16).add(V(0, -.12, 0));
  addTracer(muzzle, end, 0xffefc2);
  if (hitEnemy) {
    const head = hit.head;
    hurtEnemy(hitEnemy, dmg * (head ? 2.1 : 1), head, end);
    spawnBlood(end);
  } else if (wall) {
    impact(wall.point, wall.normal);
    if (Math.random() < .35) Sound.noise(.04, .008, 1800, 1, 0);
  }
}
function hurtEnemy(e, dmg, head, point) {
  if (!e.alive) return;
  e.hp -= dmg; run.hits++;
  e.alert = true; e.state = 'combat'; e.lastSeen = { x: player.x, z: player.z }; e.losTimer = 0;
  e.damageTimer = 2;
  updateHealthSprite(e.hpSprite, e.hp, e.maxHp); e.hpSprite.sprite.visible = true;
  e.marker.material.opacity = .75;
  flashHit(false);
  showFloater(Math.round(dmg) + (head ? ' 爆头' : ''), point.clone().add(V(0, .18, 0)), head ? 'head' : '');
  Sound.hitmark();
  if (e.type === 'boss') run.bossEngaged = true;
  if (e.hp <= 0) killEnemy(e, head);
}
function killEnemy(e, head = false) {
  if (!e.alive) return;
  e.alive = false; e.state = 'dead'; e.deadT = 0;
  run.kills++;
  e.hpSprite.sprite.visible = false; e.marker.visible = false;
  flashHit(true); showKillFeed(e.type, head); Sound.kill();
  shake = Math.min(2.8, shake + .8);
  if (e.mixer) e.mixer.stopAllAction();
  spawnBlood(e.group.position.clone().add(V(0, 1.2, 0)));
  dropBag(e);
  if (e.type === 'boss') {
    run.bossDead = true; run.bossEngaged = false;
    D.bossBar.classList.remove('show');
    announce('HIGH VALUE TARGET DOWN', '典狱长已击破 · 金库密钥掉落', 3200);
    toast('典狱长遗物已掉落 · 搜索尸体获取密钥', '#ffb454', 'sys');
  } else {
    toast('目标清除', '#839690', 'sys');
  }
}
function dropBag(e) {
  const x = e.x, z = e.z;
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .28, .42), new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: .9 }));
  body.position.y = .14; g.add(body);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.1), new THREE.MeshBasicMaterial({ color: e.type === 'boss' ? 0xffb454 : 0xff5364 }));
  marker.position.y = .9; g.add(marker);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.38, .48, 20), new THREE.MeshBasicMaterial({ color: e.type === 'boss' ? 0xffb454 : 0xff5364, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring);
  scene.add(g);
  const c = {
    x, z, type: 'corpse', label: e.type === 'boss' ? '典狱长遗物' : '敌人遗物', time: e.type === 'boss' ? 1.2 : .65,
    color: e.type === 'boss' ? '#ffb454' : '#ff5364', glyph: '✝', bias: e.type === 'boss' ? 3 : 1,
    opened: false, group: g, mark: marker, ring, isBoss: e.type === 'boss',
    items: e.type === 'boss' ? [makeBigGold(), makeLoot(3, 'legend'), makeLoot(2, 'epic')] : [makeLoot(e.type === 'guard' ? 2 : 1)]
  };
  world.crates.push(c);
}
function damagePlayer(amount) {
  if (!run || run.ended) return;
  let remaining = amount;
  if (player.armor > 0) {
    const absorb = Math.min(player.armor, amount * .65);
    player.armor -= absorb; remaining = amount - absorb;
  }
  player.hp -= remaining;
  damageFx = Math.max(damageFx, .7);
  shake = Math.min(2.5, shake + .7);
  Sound.hurt();
  player.recoilPitch += .01;
  if (player.hp <= 0) { player.hp = 0; endRaid(false, '生命信号丢失。你倒在了灰港。'); }
}

/* ============================================================
   ENEMY AI
   ============================================================ */
function losClear(a, b) {
  const dir = b.clone().sub(a); const d = dir.length(); dir.normalize();
  const hit = rayColliders(a, dir, d - .1);
  return !hit;
}
function panFor(x, z) {
  const dx = x - player.x, dz = z - player.z;
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  return clamp((dx * rx + dz * rz) / 22, -1, 1);
}
function attenFor(x, z) { return clamp(1 - dist(x, z, player.x, player.z) / 60, .12, 1); }
function enemyEye(e) { return V(e.x, e.baseY + 1.55 * e.scale, e.z); }
function enemySees(e) {
  const eye = enemyEye(e);
  const target = V(player.x, player.eye + player.jumpY - .15, player.z);
  const d = eye.distanceTo(target);
  if (d > e.vision) return false;
  const dir = target.clone().sub(eye).normalize();
  const fwd = V(Math.sin(e.group.rotation.y), 0, Math.cos(e.group.rotation.y));
  if (!e.alert && fwd.dot(V(dir.x, 0, dir.z).normalize()) < Math.cos(e.fov)) return false;
  return losClear(eye, target);
}
function alertEnemies(x, z, radius) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (dist(e.x, e.z, x, z) < radius) {
      e.alert = true;
      if (e.state === 'patrol') e.state = 'search';
      if (!e.lastSeen) e.lastSeen = { x, z };
    }
  }
  if (world.boss && world.boss.alive && dist(world.boss.x, world.boss.z, x, z) < radius) {
    world.boss.alert = true; world.boss.state = 'combat'; world.boss.lastSeen = { x: player.x, z: player.z };
  }
}
function navFindPath(sx, sz, tx, tz) {
  const nav = world.nav, N = nav.n;
  const toCell = (x, z) => {
    let gx = clamp(Math.floor((x - nav.origin) / nav.cell), 0, N - 1);
    let gy = clamp(Math.floor((z - nav.origin) / nav.cell), 0, N - 1);
    if (nav.blocked[gy * N + gx]) {
      let found = -1, bestD = 99;
      for (let r = 1; r <= 4 && found < 0; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
        const ax = gx + ox, ay = gy + oy;
        if (ax < 0 || ay < 0 || ax >= N || ay >= N) continue;
        if (!nav.blocked[ay * N + ax]) { const dd = ox * ox + oy * oy; if (dd < bestD) { bestD = dd; found = ay * N + ax; } }
      }
      if (found < 0) return null;
      gx = found % N; gy = Math.floor(found / N);
    }
    return gy * N + gx;
  };
  const s = toCell(sx, sz), t = toCell(tx, tz);
  if (s == null || t == null) return null;
  if (s === t) return [{ x: tx, z: tz }];
  const open = [s], closed = new Uint8Array(N * N), g = new Float32Array(N * N).fill(1e9), came = new Int32Array(N * N).fill(-1);
  g[s] = 0; let iter = 0;
  while (open.length && iter++ < 4500) {
    let bi = 0, bf = 1e9;
    for (let i = 0; i < open.length; i++) {
      const n = open[i], f = g[n] + Math.abs(n % N - t % N) + Math.abs(Math.floor(n / N) - Math.floor(t / N));
      if (f < bf) { bf = f; bi = i; }
    }
    const cur = open.splice(bi, 1)[0];
    if (cur === t) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % N, cy = Math.floor(cur / N);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dz;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const ni = ny * N + nx;
      if (nav.blocked[ni] || closed[ni]) continue;
      const ng = g[cur] + 1;
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push(ni); }
    }
  }
  if (came[t] < 0) return null;
  const path = []; let cur = t;
  for (let guard = 0; guard < 2000 && cur !== -1; guard++) {
    path.push({ x: nav.origin + (cur % N + .5) * nav.cell, z: nav.origin + (Math.floor(cur / N) + .5) * nav.cell });
    if (cur === s) break;
    cur = came[cur];
  }
  path.reverse();
  path.push({ x: tx, z: tz });
  return path;
}
function moveEnemy(e, dx, dz) {
  const nx = e.x + dx, nz = e.z + dz;
  if (!collides(nx, e.z, .36)) e.x = nx;
  if (!collides(e.x, nz, .36)) e.z = nz;
  e.group.position.set(e.x, e.baseY, e.z);
}
function followPath(e, dt, speed) {
  if (!e.path.length) return false;
  const p = e.path[0];
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
  if (d < .5) { e.path.shift(); return true; }
  moveEnemy(e, dx / d * speed * dt, dz / d * speed * dt);
  e.walkPhase += dt * speed * 3.2;
  const targetYaw = Math.atan2(dx, dz);
  e.yaw = lerpAngle(e.yaw, targetYaw, 1 - Math.exp(-dt * 8));
  return true;
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % TAU) - Math.PI;
  return a + d * t;
}
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.damageTimer > 0) {
      e.damageTimer -= dt;
      if (e.damageTimer <= 0 && e.alive) e.hpSprite.sprite.visible = false;
      e.marker.material.opacity = e.alert ? .5 : .25;
    }
    if (!e.alive) {
      e.deadT += dt;
      if (e.modelWrap) {
        e.modelWrap.rotation.z = lerp(e.modelWrap.rotation.z, -Math.PI / 2, 1 - Math.exp(-dt * 5));
        e.modelWrap.position.y = lerp(e.modelWrap.position.y, -.12, 1 - Math.exp(-dt * 3));
      }
      if (e.deadT > 9) e.group.visible = false;
      continue;
    }
    if (e.hpSprite.sprite.visible) {
      const s = e.hpSprite.sprite; s.position.y = e.baseY + (e.height + .45);
    }
    if (e.mixer) e.mixer.update(dt);
    e.group.rotation.y = e.yaw;
    if (!run.started || run.ended) continue;
    const sees = enemySees(e);
    if (sees) {
      e.alert = true; e.state = 'combat'; e.lastSeen = { x: player.x, z: player.z }; e.losTimer = 0;
      if (e.type === 'boss') run.bossEngaged = true;
    } else if (e.alert) {
      e.losTimer += dt;
      if (e.state === 'combat' && e.losTimer > 4.5) e.state = 'search';
      if (e.losTimer > 14 && e.type !== 'boss') { e.alert = false; e.state = 'patrol'; e.lastSeen = null; }
    }
    const d = dist(e.x, e.z, player.x, player.z);
    let moving = false;
    if (e.state === 'patrol') {
      moving = updatePatrol(e, dt);
    } else if (e.state === 'search') {
      if (e.lastSeen) {
        const dd = dist(e.x, e.z, e.lastSeen.x, e.lastSeen.z);
        if (dd > 1.2) {
          if (!e.path.length || e.pathT <= 0) { e.path = navFindPath(e.x, e.z, e.lastSeen.x, e.lastSeen.z) || []; e.pathT = .9; }
          moving = followPath(e, dt, e.speed * .9);
        } else {
          e.yaw += dt * 1.1; e.path = [];
          e.wait -= dt; if (e.wait <= 0) { e.alert = false; e.state = 'patrol'; e.wait = 1.5; }
        }
      } else { e.state = 'patrol'; }
    } else if (e.state === 'combat') {
      if (sees) {
        const targetYaw = Math.atan2(player.x - e.x, player.z - e.z);
        e.yaw = lerpAngle(e.yaw, targetYaw, 1 - Math.exp(-dt * 9));
        if (!e.stationary) {
          if (d > e.preferred + 2.5) {
            if (!e.path.length || e.pathT <= 0) { e.path = navFindPath(e.x, e.z, player.x, player.z) || []; e.pathT = .9; }
            moving = followPath(e, dt, e.speed);
          } else if (d < e.preferred - 3) {
            const away = Math.atan2(e.x - player.x, e.z - player.z);
            moveEnemy(e, Math.sin(away) * e.speed * dt, Math.cos(away) * e.speed * dt);
            moving = true;
          } else {
            e.strafeT -= dt;
            if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = 1.4 + Math.random() * 1.8; }
            const side = Math.atan2(player.x - e.x, player.z - e.z) + Math.PI / 2 * e.strafe;
            moveEnemy(e, Math.sin(side) * e.speed * .55 * dt, Math.cos(side) * e.speed * .55 * dt);
            moving = true;
          }
        }
      } else if (e.lastSeen) {
        if (!e.path.length || e.pathT <= 0) { e.path = navFindPath(e.x, e.z, e.lastSeen.x, e.lastSeen.z) || []; e.pathT = .9; }
        moving = followPath(e, dt, e.speed * .9);
      }
    }
    e.pathT -= dt;
    if (moving) {
      setEnemyAction(e, 'Run', .9 + e.speed * .12);
    } else if (e.state === 'combat') {
      setEnemyAction(e, 'Idle', 1);
    } else {
      setEnemyAction(e, 'Idle', 1);
    }
    // firing
    if (e.state === 'combat' && sees && d < e.range) {
      if (e.type === 'sniper') {
        updateSniper(e, dt, d);
      } else {
        updateEnemyFire(e, dt, d);
      }
    } else if (e.windup > 0) {
      e.windup = 0;
    }
    // boss shockwave
    if (e.type === 'boss') updateBoss(e, dt, d);
  }
  // separation
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (!a.alive) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (!b.alive) continue;
      const dd = dist(a.x, a.z, b.x, b.z);
      if (dd < .9 && dd > .01) {
        const push = (.9 - dd) * .5;
        moveEnemy(a, (a.x - b.x) / dd * push, (a.z - b.z) / dd * push);
        moveEnemy(b, (b.x - a.x) / dd * push, (b.z - a.z) / dd * push);
      }
    }
  }
}
function updatePatrol(e, dt) {
  if (e.stationary) { setEnemyAction(e, 'Idle', 1); return false; }
  if (!e.path.length) {
    e.wait -= dt;
    if (e.wait <= 0) {
      const pt = e.patrol[e.patrolIdx % e.patrol.length];
      e.patrolIdx++;
      e.path = navFindPath(e.x, e.z, pt[0], pt[1]) || [];
      e.wait = 2 + Math.random() * 4;
    }
    return false;
  }
  return followPath(e, dt, e.speed * .52);
}
function updateEnemyFire(e, dt, d) {
  if (e.fireCd > 0) e.fireCd -= dt;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) { e.burstLeft = e.burst; e.shotT = 0; e.fireCd = e.delay + Math.random() * .5; }
    return;
  }
  if (e.burstLeft > 0) {
    e.shotT -= dt;
    if (e.shotT <= 0) {
      enemyShoot(e);
      e.burstLeft--; e.shotT = e.fireGap;
      if (e.burstLeft <= 0) e.fireCd = e.delay + Math.random() * .5;
    }
    return;
  }
  if (e.fireCd <= 0) { e.windup = .2 + Math.random() * .22; }
}
function enemyShoot(e) {
  const origin = e.muzzle.getWorldPosition(V());
  const target = V(player.x, player.eye + player.jumpY - .2, player.z);
  const base = target.clone().sub(origin).normalize();
  const right = V().crossVectors(base, V(0, 1, 0)).normalize();
  const up = V().crossVectors(right, base).normalize();
  const spread = e.spread * (1.4 - Math.min(.8, e.dmg / 30)) + (player.moveSpeed > 1 ? .012 : 0);
  const pellets = e.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const dir = base.clone().addScaledVector(right, (Math.random() - .5) * spread * 2).addScaledVector(up, (Math.random() - .5) * spread * 2).normalize();
    const wall = rayColliders(origin, dir, 80);
    const t = rayPlayer(origin, dir, wall ? wall.t : 80);
    const end = t ? origin.clone().addScaledVector(dir, t) : wall ? wall.point : origin.clone().addScaledVector(dir, 50);
    addTracer(origin, end, 0xff9a5c, 1);
    if (t) damagePlayer(e.dmg);
    else if (wall) impact(wall.point, wall.normal, 0xff9a5c);
  }
  const pan = panFor(e.x, e.z), atten = attenFor(e.x, e.z);
  Sound.shot(e.type === 'smg' ? 'smg' : e.type === 'shotgun' ? 'shotgun' : e.type === 'boss' ? 'rifle' : 'pistol', true, pan, atten);
  e.flashT = .07;
}
function updateSniper(e, dt, d) {
  if (!e.laser) {
    const geo = new THREE.BufferGeometry().setFromPoints([V(), V()]);
    e.laser = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff4058, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
    e.laser.frustumCulled = false; scene.add(e.laser);
  }
  if (e.fireCd > 0) e.fireCd -= dt;
  if (e.windup <= 0 && e.fireCd <= 0) { e.windup = 1.15; e.laser.visible = true; }
  if (e.windup > 0) {
    e.windup -= dt;
    const origin = e.muzzle.getWorldPosition(V());
    const target = V(player.x, player.eye + player.jumpY - .2, player.z);
    const pos = e.laser.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z); pos.setXYZ(1, target.x, target.y, target.z); pos.needsUpdate = true;
    e.laser.visible = true;
    if (e.windup <= 0) {
      e.laser.visible = false;
      enemyShoot(e);
      e.fireCd = e.delay;
    }
  }
}
function updateBoss(e, dt, d) {
  e.pulseCd = (e.pulseCd == null ? 5 : e.pulseCd) - dt;
  if (e.pulseWind > 0) {
    e.pulseWind -= dt;
    if (e.pulseWind <= 0) {
      shake = Math.min(3.5, shake + 1.4); Sound.boom();
      const ring = new THREE.Mesh(new THREE.RingGeometry(.4, .55, 32), new THREE.MeshBasicMaterial({ color: 0xff5364, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(e.x, .08, e.z); scene.add(ring);
      effects.push({ mesh: ring, ring: true, life: .6, max: .6 });
      if (d < 5.5) damagePlayer(17);
    }
  } else if (e.pulseCd <= 0 && d < 6 && e.state === 'combat') {
    e.pulseWind = .8; e.pulseCd = 6;
    announce('WARDEN // SHOCKWAVE', '范围冲击 · 拉开距离', 1500);
  }
}

/* ============================================================
   GRENADE / INTERACTION / LOOT
   ============================================================ */
function throwGrenade() {
  if (!run || run.action) return;
  if (run.nades <= 0) { toast('没有破片雷了', '#ff5364', 'bad'); return; }
  run.nades--;
  const dir = camera.getWorldDirection(V());
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4a5a36, roughness: .6 }));
  mesh.position.copy(camera.position).addScaledVector(dir, .5);
  scene.add(mesh);
  grenades.push({ mesh, v: dir.multiplyScalar(13).add(V(0, 3.5, 0)), t: 2.1, spin: V(Math.random() * 8, Math.random() * 8, 0) });
  Sound.grenade();
}
function explode(x, y, z) {
  const flash = new THREE.PointLight(0xffa04a, 6, 18, 2); flash.position.set(x, y, z); scene.add(flash); lampsFlash.push({ light: flash, t: .25 });
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffb45c'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 }));
  spr.position.set(x, y, z); spr.scale.set(7, 7, 1); scene.add(spr); effects.push({ mesh: spr, life: .22, max: .22, grow: 2.5 });
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(i % 2 ? '#ffb454' : '#ff6b3d'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .9 }));
    const s = .12 + Math.random() * .25; m.scale.set(s, s, 1); m.position.set(x, y, z);
    scene.add(m); effects.push({ mesh: m, v: V((Math.random() - .5) * 10, Math.random() * 6, (Math.random() - .5) * 10), life: .5 + Math.random() * .5, max: 1, gravity: 1 });
  }
  shake = Math.min(4, shake + 2.2); Sound.boom();
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.z, x, z);
    if (d < 7 && losClear(V(x, y, z), enemyEye(e))) hurtEnemy(e, 110 * (1 - d / 9), false, enemyEye(e));
  }
  const pd = dist(player.x, player.z, x, z);
  if (pd < 6.5) damagePlayer(20 * (1 - pd / 9));
  alertEnemies(x, z, 50);
}
let lampsFlash = [];
function getPrompt() {
  if (!run || run.ended) return null;
  const ex = world.extraction;
  const ed = dist(player.x, player.z, ex.x, ex.z);
  if (ed < ex.r) return { type: 'extract', id: 'extract', label: '呼叫撤离 · LZ-07', sub: '按住 E 坚守 4 秒', dur: 4, progress: run.interactProgress };
  let best = null, bd = 2.6;
  for (const c of world.crates) {
    if (c.opened) continue;
    const d = dist(player.x, player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return null;
  const locked = best.requires === 'key' && !run.hasKey;
  return {
    type: 'container', id: 'c' + (best.uid || (best.x + '_' + best.z)), c: best, label: best.label,
    sub: locked ? '需要「典狱长密钥」' : run.bag.length >= bagSlots() ? '背包已满 · 按 X 丢弃物品' : `按住 E 搜刮 · ${best.time.toFixed(1)} 秒`,
    dur: best.time, locked, full: run.bag.length >= bagSlots()
  };
}
function updateInteraction(dt) {
  const p = getPrompt(); run.prompt = p;
  if (!p) { run.interactProgress = 0; run.interactKey = ''; run.extractStarted = false; return; }
  if (run.interactKey !== p.id) { run.interactKey = p.id; run.interactProgress = 0; }
  if (p.type === 'extract') {
    if (input.interact && !run.action) {
      if (!run.extractStarted) {
        run.extractStarted = true;
        announce('EXTRACTION SIGNAL SENT', '坚守 4 秒 · 敌人正在逼近', 2800);
        alertEnemies(p.x || world.extraction.x, p.z || world.extraction.z, 100);
        alertEnemies(world.extraction.x, world.extraction.z, 60);
        if (!run.extractSpawned) { run.extractSpawned = true; spawnInterceptors(); }
        Sound.extract();
      }
      run.interactProgress += dt / p.dur;
      if (run.interactProgress >= 1) { run.interactProgress = 1; endRaid(true); return; }
    } else {
      run.interactProgress = Math.max(0, run.interactProgress - dt * .35);
      if (run.interactProgress <= 0) run.extractStarted = false;
    }
  } else if (p.type === 'container') {
    if (input.interact && !run.action && !p.locked && !p.full) {
      run.interactProgress += dt / p.dur;
      if (run.interactProgress >= 1) { openCrate(p.c); run.interactProgress = 0; run.interactKey = ''; }
    } else run.interactProgress = Math.max(0, run.interactProgress - dt * 2);
  }
}
function addItem(item) {
  if (run.bag.length >= bagSlots()) return false;
  run.bag.push(item); run.value += item.value; Sound.pickup();
  toast(`拾取 ${item.name}`, TIER[item.tier].color, '', item);
  updateBagUI(true); return true;
}
function openCrate(c) {
  if (!c || c.opened) return;
  if (c.requires === 'key' && !run.hasKey) return;
  if (run.bag.length >= bagSlots()) { toast('背包已满 · 按 X 丢弃后方可搜刮', '#ff5364', 'bad'); return; }
  c.opened = true; c.mark.visible = false; c.ring.visible = false;
  Sound.open(); run.containers++;
  const items = c.items && c.items.length ? c.items : [];
  if (!items.length) {
    const count = c.type === 'vaultsafe' ? 3 : 1 + (Math.random() < .45 ? 1 : 0);
    if (c.type === 'vaultsafe') items.push(makeBigGold());
    for (let i = 0; i < count; i++) items.push(makeLoot(c.bias || 1, c.type === 'vaultsafe' && i === 0 && Math.random() < .45 ? 'legend' : null));
  }
  if (c.isBoss) { run.hasKey = true; toast('获得「典狱长密钥」· 中央金库已解锁', '#ffb454', 'sys'); announce('KEY ACQUIRED', '典狱长密钥已获取 · 前往中央金库', 2600); }
  for (const it of items) if (run.bag.length < bagSlots()) addItem(it); else { toast('部分物资未能装入背包', '#ff5364', 'bad'); break; }
  if (c.type === 'vaultsafe') announce('VAULT BREACHED', '中央金库已开启', 2600);
}
function spawnInterceptors() {
  const spots = [[-22, 30], [10, 18]];
  for (let i = 0; i < 2; i++) {
    const e = makeEnemy({ type: i ? 'smg' : 'scav', x: spots[i][0], z: spots[i][1], patrol: [[-20, 36], [0, 30]] });
    e.alert = true; e.state = 'search'; e.lastSeen = { x: world.extraction.x, z: world.extraction.z }; e.losTimer = 0;
    enemies.push(e);
  }
}

/* ============================================================
   TIMER / END
   ============================================================ */
function spawnAllies() {
  allies = [];
  const names = run.operator?.id === 'medic' ? ['渡鸦', '铁壁'] : ['渡鸦', '灰雀'];
  for (let i = 0; i < 2; i++) {
    const side = i ? 1.8 : -1.8;
    const bx = player.x + Math.sin(player.yaw) * 3.0 + Math.cos(player.yaw) * side;
    const bz = player.z + Math.cos(player.yaw) * 3.0 - Math.sin(player.yaw) * side;
    const e = makeEnemy({ type: i ? 'guard' : 'smg', x: bx, z: bz, patrol: [] });
    e.ally = true; e.name = names[i]; e.squadIndex = i; e.hp = e.maxHp = 9999; e.speed = 3.2;
    e.hpSprite.sprite.visible = false;
    e.marker.visible = false;
    if (e.model) e.model.traverse(o => { if (o.isMesh && o.material && o.material.color) o.material.color.lerp(new THREE.Color(0x3f6f66), .55); });
    const chev = new THREE.Mesh(new THREE.ConeGeometry(.11, .18, 4), new THREE.MeshBasicMaterial({ color: 0x67e8ff }));
    chev.rotation.x = Math.PI; chev.position.y = 2.25; e.group.add(chev);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 20), new THREE.MeshBasicMaterial({ color: 0x67e8ff, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03; e.group.add(ring);
    allies.push(e);
  }
}
function updateAllies(dt) {
  if (!run || !run.started || run.ended) return;
  for (const e of allies) {
    if (e.mixer) e.mixer.update(dt);
    let target = null, td = 30;
    for (const en of enemies) {
      if (!en.alive) continue;
      const d = dist(e.x, e.z, en.x, en.z);
      if (d < td && losClear(enemyEye(e), enemyEye(en))) { td = d; target = en; }
    }
    let moving = false;
    if (target) {
      const ta = Math.atan2(target.x - e.x, target.z - e.z);
      e.yaw = lerpAngle(e.yaw, ta, 1 - Math.exp(-dt * 10));
      if (td > 8) { moveEnemy(e, Math.sin(ta) * e.speed * dt, Math.cos(ta) * e.speed * dt); moving = true; }
      e.fireCd = (e.fireCd || 0) - dt;
      if (e.fireCd <= 0 && td < 28) {
        const origin = e.muzzle.getWorldPosition(V());
        const point = enemyEye(target);
        addTracer(origin, point, 0x8ff4ff);
        hurtEnemy(target, 10, false, point);
        Sound.shot('smg', true, panFor(e.x, e.z), .4);
        e.fireCd = .75 + Math.random() * .4;
      }
      e.squadState = '交战';
      setEnemyAction(e, 'Idle', 1);
    } else {
      const side = e.squadIndex ? 2.0 : -2.0;
      const tx = player.x + Math.sin(player.yaw) * 5.2 + Math.cos(player.yaw) * side;
      const tz = player.z + Math.cos(player.yaw) * 5.2 - Math.sin(player.yaw) * side;
      const d = dist(e.x, e.z, tx, tz);
      if (d > 2) {
        const ta = Math.atan2(tx - e.x, tz - e.z);
        e.yaw = lerpAngle(e.yaw, ta, 1 - Math.exp(-dt * 8));
        moveEnemy(e, Math.sin(ta) * e.speed * dt, Math.cos(ta) * e.speed * dt);
        moving = true;
      }
      if (dist(e.x, e.z, player.x, player.z) > 22) { e.x = tx; e.z = tz; }
      e.squadState = d > 5 ? '跟随' : '警戒';
      setEnemyAction(e, moving ? 'Run' : 'Idle', .9);
    }
    e.group.rotation.y = e.yaw;
    e.group.position.set(e.x, e.baseY, e.z);
    if (e.marker) e.marker.rotation.y += dt * 2;
  }
}
function spawnAirdrop() {
  if (!run || run.airdrop) return;
  const spots = [[10, 16], [-6, 12], [22, 8], [-18, 28], [2, 32]];
  let px = spots[0][0], pz = spots[0][1];
  for (const [x, z] of spots) { if (!collides(x, z, .8)) { px = x; pz = z; break; } }
  const g = new THREE.Group(); g.position.set(px, 0, pz);
  const gold = new THREE.MeshStandardMaterial({ color: 0x8f6b2b, emissive: 0x6b4a12, emissiveIntensity: .5, metalness: .7, roughness: .35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, .9, 1.0), gold); body.position.y = .45; body.castShadow = true; g.add(body);
  for (const dy of [.3, .6]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(1.45, .05, .1), new THREE.MeshStandardMaterial({ color: 0x17120a, roughness: .7 })); strap.position.set(0, dy, .52); g.add(strap); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.85, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(.18), new THREE.MeshBasicMaterial({ color: 0xffd18a })); mark.position.y = 1.6; g.add(mark);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffb454'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 }));
  beacon.position.set(px, 1.4, pz); beacon.scale.set(7, 7, 1); scene.add(beacon);
  const light = new THREE.PointLight(0xffb454, 1.6, 20, 2); light.position.set(px, 2.2, pz); scene.add(light);
  scene.add(g);
  const c = { x: px, z: pz, type: 'airdrop', label: '空投补给', time: 1.8, color: '#ffb454', glyph: '✦', bias: 4, opened: false, group: g, mark, ring, isAirdrop: true, items: [makeBigGold(), makeLoot(3, 'legend'), makeLoot(2, 'epic')] };
  world.crates.push(c);
  for (let i = 0; i < 2; i++) {
    const e = makeEnemy({ type: 'smg', x: px + (i ? 4 : -4), z: pz + 3, patrol: [] });
    e.alert = true; e.state = 'search'; e.lastSeen = { x: px, z: pz }; enemies.push(e);
  }
  run.airdrop = true;
  announce('SUPPLY DROP // 空投抵达', '高价值补给已落入区域 · 小心守军', 3600);
  toast('空投补给已抵达 · 小地图已标记', '#ffb454', 'sys');
  Sound.alarm();
}
function endRaid(success, reason) {
  if (!run || run.ended) return;
  run.ended = true; run.paused = false;
  mode = 'result';
  D.hud.classList.remove('show');
  D.crosshair.classList.remove('active');
  if (D.lowHealth) D.lowHealth.classList.remove('on');
  if (D.killfeed) D.killfeed.innerHTML = '';
  D.pause.classList.remove('show'); D.lock.classList.remove('show');
  document.body.style.cursor = 'default';
  if (pointerLocked) document.exitPointerLock();
  const bagValue = run.bag.reduce((a, b) => a + b.value, 0);
  const best = success && bagValue > save.stats.best;
  save.stats.raids++; save.stats.kills += run.kills;
  let secureValue = 0, insuranceRefund = 0;
  if (success) {
    save.credits += run.deposit + bagValue; save.stash += bagValue; save.stats.extracts++;
    if (bagValue > save.stats.best) save.stats.best = bagValue;
  } else {
    save.stats.deaths++;
    const secured = run.bag[0];
    if (secured && !secured.key) { secureValue = secured.value; save.credits += secureValue; save.stash += secureValue; }
    if (run.insurance) { insuranceRefund = Math.round(run.deposit * .5); save.credits += insuranceRefund; }
  }
  persist();
  D.resultCard.classList.toggle('fail', !success);
  D.resultKicker.textContent = success ? 'RAID COMPLETE // EXFIL SUCCESS' : 'SIGNAL LOST // OPERATOR MIA';
  if (D.resultStamp) { D.resultStamp.textContent = success ? 'EXFIL' : 'MIA'; }
  D.resultTitle.textContent = success ? '撤离成功' : '信号中断';
  D.resultSub.textContent = success ? '直升机升空。你带着战利品活着离开了灰港。' : reason || '行动失败。装备押金与战利品全部损失。';
  D.resultValue.closest('.result-value').querySelector('span').textContent = success ? '带出物资估值' : '遗失物资估值';
  animateResultValue(bagValue);
  D.resultBonus.textContent = success
    ? `装备押金 ₡${fmt(run.deposit)} 已返还 · 信用点 +₡${fmt(run.deposit + bagValue)}`
    : `装备押金 ₡${fmt(run.deposit)} 已损失${insuranceRefund ? ` · 保险理赔 +₡${fmt(insuranceRefund)}` : ''}${secureValue ? ` · 安全箱回收 +₡${fmt(secureValue)}` : ''}`;
  D.resultKills.textContent = run.kills;
  D.resultAcc.textContent = run.shots ? Math.round(run.hits / run.shots * 100) + '%' : '0%';
  D.resultTime.textContent = fmtTime(Math.max(0, RAIDSEC - run.time));
  D.resultLoot.textContent = run.bag.length;
  D.resultNew.textContent = best ? '★ 新纪录' : '';
  D.resultList.innerHTML = run.bag.length ? run.bag.map((i, idx) => itemCard(i, !success && idx !== 0)).join('') : '<div class="result-empty">背包里空无一物。</div>';
  if (success) Sound.success(); else { Sound.fail(); damageFx = .8; }
  syncMeta();
  setTimeout(() => { if (mode === 'result') D.resultScreen.classList.add('active'); }, 500);
}
function animateResultValue(target) {
  const el = D.resultValue; const start = performance.now(); const dur = 780;
  function tick(now) {
    const p = clamp((now - start) / dur, 0, 1); const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target);
  }
  requestAnimationFrame(tick);
}
function itemCard(i, lost = false) {
  const color = TIER[i.tier]?.color || '#ccc';
  return `<div class="result-item ${i.big ? 'big' : ''}" style="--tier:${color};${lost ? 'opacity:.62' : ''};${i.big ? 'box-shadow:0 0 12px rgba(255,180,84,.18);' : ''}"><span class="ri-ico">${i.glyph}</span>${i.name}<b>${i.key ? 'KEY' : '₡' + fmt(i.value)}</b></div>`;
}
function updateRaid(dt) {
  if (!run || !run.started || run.paused || run.ended) return;
  if (run.hitstop > 0) { run.hitstop -= dt; return; }
  run.time -= dt;
  if (run.time <= 0) { endRaid(false, '情报窗口关闭。直升机已离场，你被困在灰港。'); return; }
  if (!run.reinforcement && run.time < 95) {
    run.reinforcement = true;
    spawnInterceptors(); announce('LOCKDOWN PROTOCOL', '增援部队已进入港区', 2800); Sound.alarm();
    toast('侦测到增援信号', '#ff5364', 'bad');
  }
  if (!run.finalWarn && run.time < 40) { run.finalWarn = true; announce('SIGNAL WINDOW CLOSING', '撤离窗口即将关闭', 2800); Sound.alarm(); }
  run.skillCd = Math.max(0, run.skillCd - dt);
  run.skillT = Math.max(0, run.skillT - dt);
  run.revealT = Math.max(0, run.revealT - dt);
  updatePlayer(dt);
  updateViewModel(dt);
  updateEnemies(dt);
  updateAllies(dt);
  if (!run.airdrop && run.time < 150) spawnAirdrop();
  updateWorldEffects(dt);
  updateInteraction(dt);
  updateHUD();
  drawMinimap(); drawCompass();
}

/* ============================================================
   EFFECTS UPDATE
   ============================================================ */
function updateWorldEffects(dt) {
  for (const g of grenades) {
    g.t -= dt;
    g.v.y -= 15 * dt;
    const nx = g.mesh.position.x + g.v.x * dt, nz = g.mesh.position.z + g.v.z * dt;
    if (!collides(nx, g.mesh.position.z, .1)) g.mesh.position.x = nx; else g.v.x *= -.45;
    if (!collides(g.mesh.position.x, nz, .1)) g.mesh.position.z = nz; else g.v.z *= -.45;
    g.mesh.position.y += g.v.y * dt;
    if (g.mesh.position.y < .12) { g.mesh.position.y = .12; g.v.y *= -.45; g.v.x *= .7; g.v.z *= .7; }
    g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt;
    if (g.t <= 0) {
      g.dead = true;
      explode(g.mesh.position.x, g.mesh.position.y, g.mesh.position.z);
      scene.remove(g.mesh);
    }
  }
  grenades = grenades.filter(g => !g.dead);
  for (const t of tracers) {
    t.life -= dt; t.line.material.opacity = clamp(t.life / t.max, 0, 1) * .9;
    if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
  }
  tracers = tracers.filter(t => t.life > 0);
  for (const f of effects) {
    f.life -= dt;
    if (f.mesh) {
      if (f.ring) { const s = 1 + (1 - f.life / f.max) * 5; f.mesh.scale.setScalar(s); f.mesh.material.opacity = f.life / f.max; }
      else {
        if (f.v) {
          f.mesh.position.addScaledVector(f.v, dt);
          if (f.gravity) f.v.y -= 9 * dt;
          f.v.multiplyScalar(.96);
        }
        if (f.grow) f.mesh.scale.multiplyScalar(1 + dt * f.grow);
        f.mesh.material.opacity = clamp(f.life / f.max, 0, 1);
      }
    }
    if (f.life <= 0) { if (f.mesh) { scene.remove(f.mesh); if (f.mesh.material) f.mesh.material.dispose(); } }
  }
  effects = effects.filter(f => f.life > 0);
  for (const lf of lampsFlash) {
    lf.t -= dt; lf.light.intensity = Math.max(0, lf.t / .25) * 6;
    if (lf.t <= 0) scene.remove(lf.light);
  }
  lampsFlash = lampsFlash.filter(l => l.t > 0);
  // enemy muzzle flash lights / sprites are handled with small glows
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.flashT > 0) {
      e.flashT -= dt;
      if (!e.flashSprite) {
        e.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffd9a0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        e.flashSprite.scale.set(.5, .5, 1); e.group.add(e.flashSprite); e.flashSprite.position.set(.2, 1.35, .8);
      }
      e.flashSprite.visible = true;
    } else if (e.flashSprite) e.flashSprite.visible = false;
  }
}

/* ============================================================
   HUD
   ============================================================ */
function updateHUD(force = false) {
  if (!run || !player) return;
  D.hpBar.style.transform = `scaleX(${clamp(player.hp / player.maxHp, 0, 1)})`;
  D.hpText.textContent = Math.ceil(player.hp);
  D.arBar.style.transform = `scaleX(${player.maxArmor ? clamp(player.armor / player.maxArmor, 0, 1) : 0})`;
  D.arText.textContent = Math.ceil(player.armor);
  D.timer.textContent = fmtTime(run.time);
  D.timer.classList.toggle('warn', run.time < 40);
  D.timerBar.style.transform = `scaleX(${clamp(run.time / RAIDSEC, 0, 1)})`;
  D.phase.textContent = run.time < 40 ? '撤离窗口即将关闭' : run.bossDead ? '密钥已获取 · 金库解锁' : '目标：搜刮物资并撤离';
  const lzShort = world.extraction?.short || 'LZ-07';
  D.objective.textContent = run.hasKey ? `金库已解锁 → ${lzShort} 撤离` : `搜刮物资 → ${lzShort} 撤离`;
  const w = weapon();
  D.weaponName.textContent = w.name; D.weaponClass.textContent = w.cls; D.weaponMode.textContent = run.inspectT > 0 ? 'INSPECT' : w.mode;
  D.ammoMag.textContent = String(run.ammo).padStart(2, '0'); D.ammoRes.textContent = String(run.reserve).padStart(2, '0');
  D.medHud.textContent = run.meds; D.nadeHud.textContent = run.nades;
  D.medSlot.classList.toggle('empty', run.meds <= 0); D.nadeSlot.classList.toggle('empty', run.nades <= 0);
  if (run.reloading) { D.reloadWrap.classList.add('show'); D.reloadFill.style.transform = `scaleX(${clamp(run.reloadT / w.reload, 0, 1)})`; }
  else D.reloadWrap.classList.remove('show');
  let stance = '作战', ratio = .65;
  if (player.sprinting) { stance = '冲刺'; ratio = 1; }
  else if (player.crouch) { stance = '蹲伏'; ratio = .3; }
  else if (player.ads) { stance = '机瞄'; ratio = .5; }
  else if (player.moveSpeed > .5) { stance = '移动'; ratio = .8; }
  D.stanceText.textContent = stance; D.stanceText.style.color = player.sprinting ? '#ffb454' : player.crouch ? '#67e8ff' : '#c8ff4f';
  D.stanceFill.style.transform = `scaleX(${ratio})`;
  const gap = 7 + (player.ads ? -2 : 0) + (player.moveSpeed > 3 ? 4 : 0) + run.bloom * 300;
  D.crosshair.style.setProperty('--gap', gap + 'px');
  D.hud.classList.toggle('ads', player.ads);
  D.crosshair.classList.toggle('ads', player.ads);
  const boss = world.boss;
  const bossShow = boss && boss.alive && (run.bossEngaged || dist(boss.x, boss.z, player.x, player.z) < 13);
  D.bossBar.classList.toggle('show', !!bossShow);
  if (bossShow) {
    D.bossFill.style.transform = `scaleX(${clamp(boss.hp / boss.maxHp, 0, 1)})`;
    D.bossText.textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`;
  }
  updatePromptUI();
  updateBagUI(force);
  if (D.lowHealth) D.lowHealth.classList.toggle('on', player.hp / player.maxHp < .3 && !run.ended);
  if (D.squadList) D.squadList.innerHTML = allies.map(a => `<div class="squad-row"><i></i><b>${a.name}</b><em class="${a.squadState === '交战' ? 'fight' : ''}">${a.squadState || '跟随'}</em></div>`).join('');
  if (D.skillHud) {
    const ready = run.skillCd <= 0;
    D.skillHud.classList.toggle('ready', ready);
    D.skillCd.textContent = ready ? '就绪 · 按 V' : `${run.skillCd.toFixed(1)}s 冷却`;
    D.skillCd.style.color = ready ? '#67e8ff' : '#5b6d68';
    D.skillBar.style.transform = `scaleX(${1 - clamp(run.skillCd / (run.operator?.cd || 30), 0, 1)})`;
    D.skillBar.style.background = ready ? '#67e8ff' : '#3b4a48';
  }
  for (const e of enemies) {
    if (!e.marker) continue;
    e.marker.material.depthTest = run.revealT <= 0;
    e.marker.material.opacity = run.revealT > 0 ? .95 : (e.alert ? .5 : .22);
  }
  D.extractEdge.classList.remove('show');
  if (damageFx > 0) { damageFx = Math.max(0, damageFx - .025); D.damage.style.opacity = damageFx; } else D.damage.style.opacity = 0;
}
function updatePromptUI() {
  let show = false, label = '', sub = '', prog = 0;
  if (!run) return;
  if (run.action) { show = true; label = '注射医疗针'; sub = '正在处理伤口…'; prog = clamp(run.action.t / run.action.dur, 0, 1); }
  else if (run.prompt) { show = true; label = run.prompt.label; sub = run.prompt.sub; prog = clamp(run.interactProgress, 0, 1); }
  D.interact.classList.toggle('show', show);
  if (!show) { lastPromptKey = ''; return; }
  const key = label + sub;
  if (key !== lastPromptKey) {
    D.intLabel.textContent = label; D.intSub.textContent = sub;
    D.intLabel.style.color = run.prompt?.locked || run.prompt?.full ? '#ff5364' : '';
    lastPromptKey = key;
  }
  D.intFill.style.transform = `scaleX(${prog})`;
}
function updateBagUI(force = false) {
  if (!run) return;
  const sig = run.bag.map(i => i.uid).join(',') + '|' + bagSlots();
  if (!force && sig === lastBagSig) return;
  lastBagSig = sig;
  D.bagCount.textContent = `${run.bag.length}/${bagSlots()}`;
  D.bagValue.textContent = fmt(run.bag.reduce((a, b) => a + b.value, 0));
  let html = '';
  for (let i = 0; i < bagSlots(); i++) {
    const it = run.bag[i];
    if (it) html += `<div class="bag-slot filled ${i === 0 ? 'secure' : ''} ${it.big ? 'big' : ''}" style="--tier:${TIER[it.tier].color}" title="${it.name} · ₡${fmt(it.value)}">${it.glyph}</div>`;
    else html += `<div class="bag-slot ${i === 0 ? 'secure' : ''}">·</div>`;
  }
  D.bagSlots.innerHTML = html;
}
function drawCompass() {
  if (!run || !player) return;
  const c = compassCtx, w = 360, h = 30;
  c.clearRect(0, 0, w, h);
  const heading = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const grad = c.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(5,12,14,0)'); grad.addColorStop(.18, 'rgba(5,12,14,.6)'); grad.addColorStop(.82, 'rgba(5,12,14,.6)'); grad.addColorStop(1, 'rgba(5,12,14,0)');
  c.fillStyle = grad; c.fillRect(0, 0, w, h);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let deg = Math.floor(heading / 10) * 10 - 60; deg <= heading + 60; deg += 10) {
    const rel = deg - heading;
    const x = w / 2 + rel * 2.45;
    if (x < 10 || x > w - 10) continue;
    const d = ((deg % 360) + 360) % 360;
    const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d];
    c.strokeStyle = cardinal ? 'rgba(230,240,235,.72)' : 'rgba(160,185,175,.28)';
    c.lineWidth = cardinal ? 1.5 : 1;
    c.beginPath(); c.moveTo(x, cardinal ? 8 : 13); c.lineTo(x, 21); c.stroke();
    if (cardinal) { c.fillStyle = d === 0 ? '#c8ff4f' : 'rgba(220,235,225,.8)'; c.font = '700 9px "SFMono-Regular",monospace'; c.fillText(cardinal, x, 4); }
    else if (d % 30 === 0) { c.fillStyle = 'rgba(160,185,175,.5)'; c.font = '6px monospace'; c.fillText(String(d).padStart(3, '0'), x, 4); }
  }
  // extraction bearing
  const ex = world.extraction;
  const bearing = ((Math.atan2(ex.x - player.x, -(ex.z - player.z)) * 180 / Math.PI) + 360) % 360;
  let rel = bearing - heading;
  while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
  if (Math.abs(rel) < 65) {
    const x = w / 2 + rel * 2.45;
    c.fillStyle = '#62ff9a'; c.beginPath(); c.moveTo(x, 16); c.lineTo(x - 4, 23); c.lineTo(x + 4, 23); c.closePath(); c.fill();
    c.fillStyle = 'rgba(98,255,154,.85)'; c.font = '700 6px "SFMono-Regular",monospace'; c.fillText('LZ ' + Math.round(dist(player.x, player.z, ex.x, ex.z)) + 'm', x, 27);
  } else {
    c.fillStyle = 'rgba(98,255,154,.8)'; c.font = '700 7px monospace';
    c.fillText(rel > 0 ? 'LZ ▶' : '◀ LZ', rel > 0 ? w - 24 : 24, 20);
  }
  c.fillStyle = 'rgba(200,255,79,.9)';
  c.fillRect(w / 2 - .5, 0, 1, 4);
  c.fillStyle = 'rgba(220,235,225,.55)'; c.font = '7px "SFMono-Regular",monospace';
  c.fillText(Math.round(heading) + '°', w / 2, 27);
}
const miniRange = 240;
function drawMinimap() {
  if (!run || !player) return;
  const c = miniCtx;
  c.clearRect(0, 0, 200, 200);
  c.drawImage(world.miniBase, 0, 0, 240, 240, 0, 0, 200, 200);
  const S = 200 / 120;
  // view cone
  c.save(); c.translate((player.x + 60) * 200 / 120, (player.z + 60) * 200 / 120); c.rotate(-player.yaw);
  c.fillStyle = 'rgba(200,255,79,.06)';
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 26, -Math.PI / 2 - .45, -Math.PI / 2 + .45); c.closePath(); c.fill();
  c.restore();
  // loot nearby
  for (const cr of world.crates) {
    if (cr.opened) continue;
    if (cr.isAirdrop) { c.fillStyle = '#ffb454'; c.beginPath(); c.arc((cr.x + 60) * S, (cr.z + 60) * S, 3, 0, TAU); c.fill(); continue; }
    const d = dist(cr.x, cr.z, player.x, player.z);
    if (d > 26) continue;
    c.fillStyle = cr.requires === 'key' ? '#b9a0ff' : '#67e8ff';
    c.fillRect((cr.x + 60) * S - 1, (cr.z + 60) * S - 1, 2, 2);
  }
  // extraction
  const ex = world.extraction;
  c.save(); c.translate((ex.x + 60) * S, (ex.z + 60) * S);
  c.strokeStyle = 'rgba(98,255,154,.55)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, ex.r * S, 0, TAU); c.stroke();
  c.fillStyle = '#62ff9a'; c.font = '700 7px monospace'; c.textAlign = 'center'; c.fillText('LZ', 0, 3);
  c.restore();
  // enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.z, player.x, player.z);
    if (!e.alert && d > 16 && run.revealT <= 0) continue;
    if (d > 55) continue;
    c.fillStyle = e.type === 'boss' ? '#ff4058' : 'rgba(255,83,100,.85)';
    c.beginPath(); c.arc((e.x + 60) * S, (e.z + 60) * S, e.type === 'boss' ? 3 : 1.7, 0, TAU); c.fill();
  }
  // player
  c.save(); c.translate((player.x + 60) * S, (player.z + 60) * S); c.rotate(-player.yaw);
  c.fillStyle = '#c8ff4f'; c.beginPath(); c.moveTo(0, -5); c.lineTo(3.4, 3.2); c.lineTo(0, 1.4); c.lineTo(-3.4, 3.2); c.closePath(); c.fill();
  c.restore();
  D.miniDist.textContent = 'LZ ' + Math.round(dist(player.x, player.z, ex.x, ex.z)) + 'm';
  if (D.miniTitle) D.miniTitle.textContent = (world.mapInfo?.name || '07号设施').split(' · ')[0];
}

/* ============================================================
   RENDER / LOOP
   ============================================================ */
function render() {
  renderer.render(scene, camera);
  if (mode === 'raid' && run && viewModel) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(viewScene, viewCam);
    renderer.autoClear = true;
  }
}
function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0);
  last = t;
  if (mode === 'title' || mode === 'hub') {
    menuCamera(dt);
    world.update(dt, camera, false);
  } else if (mode === 'raid' && run) {
    if (run.started && !run.paused && !run.ended) updateRaid(dt);
    world.update(dt, camera, world.inside(player.x, player.z));
  } else {
    if (player) world.update(dt, camera, world.inside(player.x, player.z));
  }
  render();
  requestAnimationFrame(loop);
}

/* ============================================================
   UI EVENTS / BOOT
   ============================================================ */
function toggleMute() { Sound.setMuted(!save.muted); updateSoundBtn(); }
function updateSoundBtn() { if (D.soundBtn) D.soundBtn.innerHTML = `<span>◖</span> 音效 ${save.muted ? '关' : '开'}`; }
function openHelp() {
  if (mode === 'raid' && run && !run.paused) { helpWasRunning = true; run.paused = true; pauseGame(); }
  else helpWasRunning = false;
  D.help.classList.add('show'); document.body.style.cursor = 'default';
}
function closeHelp() {
  D.help.classList.remove('show');
  if (helpWasRunning && run && !run.ended) { helpWasRunning = false; resumeGame(); }
  helpWasRunning = false;
}
$('#enter-btn').addEventListener('click', enterHub);
$('#title-help-btn').addEventListener('click', () => { Sound.init(); Sound.ui(); openHelp(); });
$('#help-btn').addEventListener('click', openHelp);
$('#pause-help-btn').addEventListener('click', openHelp);
$('#help-close').addEventListener('click', closeHelp);
$('#help-ok').addEventListener('click', closeHelp);
$('#help').addEventListener('click', e => { if (e.target.id === 'help') closeHelp(); });
$('#sound-btn').addEventListener('click', () => { Sound.init(); toggleMute(); Sound.ui(); });
$('#deploy-btn').addEventListener('click', beginDeploy);
$('#resume-btn').addEventListener('click', resumeGame);
$('#abandon-btn').addEventListener('click', () => endRaid(false, '你主动切断了信号。装备押金与战利品全部损失。'));
$('#result-hub').addEventListener('click', () => { D.resultScreen.classList.remove('active'); showHub(); });
$('#result-again').addEventListener('click', () => {
  D.resultScreen.classList.remove('active');
  if (save.credits < calcDeposit()) { showHub(); return; }
  beginDeploy();
});
$('#reset-btn').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true; $('#reset-btn').textContent = '再次点击确认清除';
    clearTimeout(resetTimer); resetTimer = setTimeout(() => { resetArmed = false; $('#reset-btn').textContent = '清除存档'; }, 3000); return;
  }
  localStorage.removeItem(SAVE_KEY); save = structuredClone(DEFAULT_SAVE); persist(); renderHub(); updateSoundBtn();
  $('#reset-btn').textContent = '已清除'; resetArmed = false;
  setTimeout(() => { $('#reset-btn').textContent = '清除存档'; }, 1400);
});
$('#weapon-list').addEventListener('click', e => {
  const b = e.target.closest('[data-weapon]'); if (!b) return;
  save.loadout.weapon = b.dataset.weapon; persist(); renderLoadout(); Sound.ui();
});
$('#armor-list').addEventListener('click', e => {
  const b = e.target.closest('[data-armor]'); if (!b) return;
  save.loadout.armor = b.dataset.armor; persist(); renderLoadout(); Sound.ui();
});
$$('.stepper button').forEach(b => b.addEventListener('click', () => {
  const key = b.dataset.cons, dir = Number(b.dataset.dir);
  save.loadout[key] = clamp(save.loadout[key] + dir, 0, key === 'meds' ? 3 : 2);
  persist(); renderLoadout(); Sound.ui();
}));
$('#upgrade-list').addEventListener('click', e => {
  const b = e.target.closest('[data-upgrade]'); if (!b) return;
  const id = b.dataset.upgrade, u = UPGRADES[id], lv = save.upgrades[id];
  if (lv >= u.max) return;
  const cost = u.costs[lv]; if (save.credits < cost) return;
  save.credits -= cost; save.upgrades[id]++; persist(); Sound.success(); renderHub();
});
D.lock.addEventListener('click', () => { Sound.init(); beginPlay(); });
$('#operator-list').addEventListener('click', e => {
  const b = e.target.closest('[data-op]'); if (!b) return;
  save.loadout.operator = b.dataset.op; persist(); renderLoadout(); Sound.ui();
});
$('#insurance-toggle').addEventListener('change', e => {
  save.loadout.insurance = e.target.checked; persist(); renderLoadout(); Sound.ui();
});
$('#gunsmith-btn').addEventListener('click', () => { Sound.init(); Sound.ui(); openGunsmith(); });
$('#gs-close').addEventListener('click', closeGunsmith);
$('#gs-done').addEventListener('click', closeGunsmith);
$('#gunsmith').addEventListener('click', e => { if (e.target.id === 'gunsmith') closeGunsmith(); });
$('#gs-weapons').addEventListener('click', e => {
  const b = e.target.closest('[data-gsw]'); if (!b) return;
  gsWeapon = b.dataset.gsw; save.loadout.weapon = gsWeapon; persist(); renderLoadout(); renderGunsmith(); Sound.ui();
});
$('#gs-slots').addEventListener('click', e => {
  const b = e.target.closest('[data-gsslot]'); if (!b) return;
  gsSlot = b.dataset.gsslot; renderGunsmith(); Sound.ui();
});
$('#gs-options').addEventListener('click', e => {
  const b = e.target.closest('[data-gsopt]'); if (!b || b.classList.contains('disabled')) return;
  const opt = getAttachment(gsSlot, b.dataset.gsopt);
  if (!attachmentOwned(opt)) {
    if (save.credits < opt.cost) return;
    save.credits -= opt.cost; save.attachmentOwned[opt.id] = true;
    toast(`已解锁 ${opt.name}`, '#c8ff4f');
    Sound.success();
  } else Sound.ui();
  setAttachment(gsWeapon, gsSlot, opt.id);
  persist(); syncMeta(); renderLoadout(); renderGunsmith();
});
$('#map-pick').addEventListener('click', e => {
  const b = e.target.closest('[data-map]'); if (!b) return;
  Sound.init(); switchMap(b.dataset.map); renderHub();
});
window.addEventListener('blur', () => { input.keys = {}; input.mouseLeft = false; input.mouseRight = false; input.interact = false; if (mode === 'raid') pauseGame(); });

let gsWeapon = save.loadout.weapon, gsSlot = 'optic';
function openGunsmith() {
  if (mode === 'raid') return;
  gsWeapon = save.loadout.weapon; gsSlot = 'optic';
  D.gs.classList.add('show'); document.body.style.cursor = 'default';
  renderGunsmith();
}
function closeGunsmith() { D.gs.classList.remove('show'); renderHub(); document.body.style.cursor = 'default'; }
function gsBar(label, value, ratio, suffix = '') {
  return `<div class="gs-stat"><span>${label}</span><b>${value}${suffix}</b><i><em style="transform:scaleX(${clamp(ratio,0,1)})"></em></i></div>`;
}
function drawGunBlueprint(type, stats) {
  const host = D.gsPreview; if (!host) return;
  host.innerHTML = '<canvas width="300" height="132"></canvas>';
  const c = host.querySelector('canvas').getContext('2d');
  c.clearRect(0, 0, 300, 132);
  c.strokeStyle = 'rgba(157,190,184,.09)'; c.lineWidth = 1;
  for (let x = 0; x < 300; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 132); c.stroke(); }
  for (let y = 0; y < 132; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(300, y); c.stroke(); }
  const accent = '#c8ff4f'; const dim = 'rgba(200,220,210,.42)';
  c.save(); c.translate(150, 68);
  const long = type !== 'pistol';
  const L = long ? 100 : 58;
  c.strokeStyle = dim; c.lineWidth = 2;
  // barrel
  c.beginPath(); c.moveTo(-L * .55, -4); c.lineTo(L * .62, -4); c.stroke();
  // body
  c.strokeStyle = accent; c.lineWidth = 3;
  c.strokeRect(-L * .38, -14, L * .52, 22);
  // stock
  c.strokeStyle = dim; c.lineWidth = 2; c.strokeRect(L * .14, -11, L * .22, 16);
  // grip
  c.beginPath(); c.moveTo(-L * .12, 8); c.lineTo(-L * .22, 34); c.lineTo(-L * .07, 34); c.lineTo(0, 8); c.closePath(); c.stroke();
  // magazine
  c.beginPath(); c.moveTo(-L * .02, 8); c.lineTo(-L * .06, 30); c.lineTo(L * .08, 30); c.lineTo(L * .1, 8); c.closePath(); c.stroke();
  // optic
  if (stats.visuals.optic !== 'iron') {
    c.fillStyle = accent; c.fillRect(-L * .12, -23, 26, 8);
    c.strokeStyle = 'rgba(103,232,255,.8)'; c.strokeRect(-L * .1, -26, 22, 4);
  }
  // muzzle
  if (stats.visuals.muzzle === 'suppressor') { c.fillStyle = dim; c.fillRect(L * .58, -8, 22, 9); }
  c.fillStyle = 'rgba(200,220,210,.55)'; c.font = '7px monospace'; c.fillText('07 // GUNSMITH', -145, 56);
  c.restore();
}
function renderGunsmith() {
  if (!D.gs) return;
  const stats = getWeaponStats(gsWeapon);
  D.gsWeapons.innerHTML = Object.entries(WEAPONS).map(([k, w]) => {
    const mod = getWeaponStats(k).modCount;
    return `<button class="gs-w ${k === gsWeapon ? 'sel' : ''}" data-gsw="${k}">${w.name}<em style="font-style:normal;color:${mod ? '#c8ff4f' : '#5b6d68'};font-size:7px;margin-left:4px">${mod ? 'MOD ' + mod : 'STOCK'}</em></button>`;
  }).join('');
  const rows = [
    ['伤害', stats.dmg, stats.dmg / 40, ''],
    ['控制', (1 - Math.min(1, stats.recoil / 10)).toFixed(2), 1 - Math.min(1, stats.recoil / 10)],
    ['精度', (1 - Math.min(1, stats.spread / .16)).toFixed(2), 1 - Math.min(1, stats.spread / .16)],
    ['操控', (1 - Math.min(1, (.2 + stats.adsTime) / .7)).toFixed(2), 1 - Math.min(1, (.2 + stats.adsTime) / .7)],
    ['弹容', stats.mag, stats.mag / 48, ' 发']
  ];
  D.gsStats.innerHTML = rows.map(r => gsBar(r[0], r[1], r[2], r[3] || '')).join('');
  D.gsSlots.innerHTML = ATTACH_SLOTS.map(sl => {
    const opt = getAttachment(sl.id, save.attachments[gsWeapon][sl.id]);
    return `<button class="gs-slot ${sl.id === gsSlot ? 'sel' : ''}" data-gsslot="${sl.id}"><b>${sl.icon} ${sl.name}</b><span>${opt.name}</span></button>`;
  }).join('');
  D.gsOptions.innerHTML = ATTACHMENTS[gsSlot].map(opt => {
    const equipped = save.attachments[gsWeapon][gsSlot] === opt.id;
    const owned = attachmentOwned(opt);
    const canBuy = save.credits >= opt.cost;
    let btn;
    if (equipped) btn = '<span class="gs-opt-btn equipped">已装备</span>';
    else if (owned) btn = `<button class="gs-opt-btn" data-gsopt="${opt.id}">装备</button>`;
    else btn = `<button class="gs-opt-btn ${canBuy ? '' : 'disabled'}" data-gsopt="${opt.id}" data-buy="1">₡${opt.cost}</button>`;
    const mods = Object.entries(opt.mods || {}).filter(([k]) => k !== 'suppressed').map(([k, v]) => {
      const good = (k === 'spread' || k === 'recoil' || k === 'reload' || k === 'damage' || k === 'hipSpread') ? v < 0 : (k === 'mag' ? v > 1 : false);
      const label = { spread: '散布', recoil: '后坐', reload: '换弹', mag: '弹容', damage: '伤害', ads: '开镜', move: '机动', hipSpread: '腰射' }[k] || k;
      return `<em style="color:${good ? '#c8ff4f' : '#ffb454'}">${label} ${v > 0 ? '+' : ''}${k === 'mag' ? Math.round((v - 1) * 100) + '%' : Math.round(v * 100) + '%'}</em>`;
    }).join('');
    return `<div class="gs-option ${equipped ? 'equipped' : ''}"><div class="gs-opt-icon">${ATTACH_SLOTS.find(x => x.id === gsSlot).icon}</div><div class="gs-opt-info"><b>${opt.name} <small style="color:#5b6d68;font-weight:400">${opt.en}</small></b><span>${opt.desc} ${mods}</span></div>${btn}</div>`;
  }).join('');
  D.gsCredits.textContent = '₡' + fmt(save.credits);
  drawGunBlueprint(gsWeapon, stats);
}
async function boot() {
  resize();
  updateSoundBtn();
  renderHub();
  world.update(0, camera, false);
  menuCamera(0);
  renderer.shadowMap.needsUpdate = true;
  D.loading.classList.add('hide');
  requestAnimationFrame(loop);
  await Promise.all([loadSoldier(), loadGuns()]);
  modelReady = true;
  renderLoadout();
  setTimeout(() => { if (mode === 'title') D.loading.classList.add('hide'); }, 100);
}
boot();
