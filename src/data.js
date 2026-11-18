'use strict';
/* ============================================================
   BLACKSITE ZERO — data, save, audio
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;
const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
const fmt = n => Math.round(n).toLocaleString('en-US');
const timeFmt = s => {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hash2 = (x, y, s = 1) => {
  let h = x * 374761393 + y * 668265263 + s * 1442695040888963407;
  h = (h ^ h >>> 13) * 1274126177;
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

const TILE = 48, MAPW = 62, MAPH = 62;
const WORLD_W = TILE * MAPW, WORLD_H = TILE * MAPH;
const RAID_SECONDS = 240;

/* ---------------- SAVE ---------------- */
const SAVE_KEY = 'blacksite_zero_save_v1';
const DEFAULT_SAVE = {
  credits: 650,
  stash: 0,
  stats: { raids: 0, extracts: 0, deaths: 0, kills: 0, best: 0 },
  upgrades: { vit: 0, bag: 0, move: 0, luck: 0 },
  loadout: { weapon: 'pistol', armor: 'light', meds: 1, nades: 0, insurance: false, operator: 'assault' },
  muted: false,
  seenIntro: false
};
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const s = structuredClone(DEFAULT_SAVE);
    s.credits = Number(raw.credits) || 0;
    s.stash = Number(raw.stash) || 0;
    s.stats = Object.assign(s.stats, raw.stats || {});
    s.upgrades = Object.assign(s.upgrades, raw.upgrades || {});
    s.loadout = Object.assign(s.loadout, raw.loadout || {});
    s.muted = !!raw.muted;
    s.seenIntro = !!raw.seenIntro;
    if (!WEAPONS[s.loadout.weapon]) s.loadout.weapon = 'pistol';
    if (!ARMORS[s.loadout.armor]) s.loadout.armor = 'light';
    s.loadout.meds = clamp(Math.round(s.loadout.meds || 0), 0, 3);
    if (s.loadout.insurance === undefined) s.loadout.insurance = false;
    if (!OPERATORS[s.loadout.operator]) s.loadout.operator = 'assault';
    s.loadout.nades = clamp(Math.round(s.loadout.nades || 0), 0, 2);
    for (const k in s.upgrades) s.upgrades[k] = clamp(Math.round(s.upgrades[k] || 0), 0, 2);
    return s;
  } catch (e) { return structuredClone(DEFAULT_SAVE); }
}
let save = loadSave();
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { }
}

/* ---------------- LOADOUT DATA ---------------- */
const WEAPONS = {
  pistol: {
    name: 'P9 侧卫', cls: '半自动手枪', mode: 'SEMI', deposit: 0,
    dmg: 24, rpm: 340, mag: 12, reserve: 72, spread: .017, reload: 1.15,
    auto: false, pellets: 1, speed: 2000, range: 1000, recoil: 2.6,
    sfx: [.055, 1500], color: '#dce6e0',
    icon: '<svg viewBox="0 0 82 28"><path d="M5 9h38l7 5h19v4H48l-5 4H29l-7 6H9l6-10H5z" fill="currentColor"/><path d="M28 14h8v8h-8z" fill="#05080a" opacity=".6"/></svg>'
  },
  smg: {
    name: 'VX-9 蜂群', cls: '冲锋枪', mode: 'AUTO', deposit: 140,
    dmg: 11, rpm: 840, mag: 32, reserve: 160, spread: .052, reload: 1.55,
    auto: true, pellets: 1, speed: 1750, range: 900, recoil: 1.15,
    sfx: [.042, 1900], color: '#bfe8d9',
    icon: '<svg viewBox="0 0 82 28"><path d="M4 8h44l6 6h22v5H58l-4 5H32l-5-3H15v5H7v-8H4z" fill="currentColor"/><path d="M30 15h7l-3 12h-8z" fill="currentColor" opacity=".8"/><path d="M12 18h12v3H12z" fill="#05080a" opacity=".5"/></svg>'
  },
  shotgun: {
    name: 'M12 破门', cls: '战术霰弹枪', mode: 'PUMP', deposit: 180,
    dmg: 11, rpm: 78, mag: 6, reserve: 42, spread: .135, reload: 2.15,
    auto: false, pellets: 7, speed: 1350, range: 560, recoil: 9,
    sfx: [.13, 750], color: '#e0c7ac',
    icon: '<svg viewBox="0 0 82 28"><path d="M2 10h60v4H38v4H19l-5 5H5l7-9H2z" fill="currentColor"/><path d="M20 18h9l-2 9h-8z" fill="currentColor" opacity=".8"/><path d="M35 10h28v4H35z" fill="#05080a" opacity=".35"/></svg>'
  },
  rifle: {
    name: 'AR-7 长矛', cls: '战斗步枪', mode: 'AUTO', deposit: 260,
    dmg: 27, rpm: 620, mag: 20, reserve: 120, spread: .024, reload: 1.85,
    auto: true, pellets: 1, speed: 2300, range: 1500, recoil: 2.9,
    sfx: [.075, 1050], color: '#c9d8e2',
    icon: '<svg viewBox="0 0 82 28"><path d="M3 9h12l5 5h19V9h17v5h20v4H56v5H34l-6-5H15l-4 7H3l4-9H3z" fill="currentColor"/><path d="M30 14h8l-4 11h-8z" fill="currentColor" opacity=".85"/><path d="M40 5h17v4H40z" fill="currentColor" opacity=".55"/><path d="M58 14h18v2H58z" fill="#05080a" opacity=".45"/></svg>'
  },
  pistol2: {
    name: 'K-11 短刃', cls: '紧凑手枪', mode: 'SEMI', deposit: 60,
    dmg: 18, rpm: 430, mag: 15, reserve: 75, spread: .021, reload: .95,
    auto: false, pellets: 1, speed: 1900, range: 900, recoil: 2.0,
    sfx: [.045, 1700], color: '#d7c8b5',
    icon: '<svg viewBox="0 0 82 28"><path d="M10 9h34l7 6h17v4H47l-4 4H27l-6 6H11l5-10h-6z" fill="currentColor"/><path d="M29 14h7v7h-7z" fill="#05080a" opacity=".5"/></svg>'
  },
  smg2: {
    name: 'MP-40 洪流', cls: '全尺寸冲锋枪', mode: 'AUTO', deposit: 190,
    dmg: 10, rpm: 900, mag: 40, reserve: 200, spread: .058, reload: 1.7,
    auto: true, pellets: 1, speed: 1750, range: 950, recoil: 1.05,
    sfx: [.04, 1850], color: '#bfd8c8',
    icon: '<svg viewBox="0 0 82 28"><path d="M3 9h47l5 5h20v5H58l-4 4H33l-4-3H16v5H8v-8H3z" fill="currentColor"/><path d="M31 16h8l-3 11h-9z" fill="currentColor" opacity=".8"/><path d="M48 10h7v4h-7z" fill="#05080a" opacity=".4"/></svg>'
  },
  dmr: {
    name: 'M-14 战鹰', cls: '战斗步枪', mode: 'SEMI', deposit: 340,
    dmg: 42, rpm: 300, mag: 15, reserve: 90, spread: .014, reload: 2.0,
    auto: false, pellets: 1, speed: 2600, range: 1800, recoil: 4.2,
    sfx: [.09, 900], color: '#d8c7a0',
    icon: '<svg viewBox="0 0 82 28"><path d="M2 9h14l5 5h18V9h20v5h16v4H62l-5 5H35l-6-5H16l-4 7H4l4-9H2z" fill="currentColor"/><path d="M32 14h8l-4 11h-8z" fill="currentColor" opacity=".8"/><path d="M45 6h20v4H45z" fill="currentColor" opacity=".5"/></svg>'
  },
  sniper: {
    name: 'SV-98 长钉', cls: '栓动狙击步枪', mode: 'BOLT', deposit: 420,
    dmg: 85, rpm: 55, mag: 5, reserve: 30, spread: .004, reload: 2.6,
    auto: false, pellets: 1, speed: 3000, range: 2200, recoil: 9.5,
    sfx: [.12, 850], color: '#c9d2d8',
    icon: '<svg viewBox="0 0 82 28"><path d="M2 11h62v4H52v4H28l-6-4H14l-4 5H4l5-9H2z" fill="currentColor"/><path d="M28 18h7l-2 9h-7z" fill="currentColor" opacity=".8"/><path d="M45 3h16v5H45z" fill="currentColor" opacity=".55"/><path d="M58 11h22v2H58z" fill="#05080a" opacity=".4"/></svg>'
  }
};
const ARMORS = {
  none: { name: '便装', armor: 0, cost: 0, penalty: 0, desc: '无防护' },
  light: { name: '轻型', armor: 40, cost: 70, penalty: .02, desc: '机动优先' },
  medium: { name: '中型', armor: 80, cost: 160, penalty: .05, desc: '均衡防护' },
  heavy: { name: '重型', armor: 130, cost: 300, penalty: .09, desc: '高生存' }
};
const OPERATORS = {
  assault: {
    id: 'assault', name: '红狼', en: 'VANGUARD', role: '突击', icon: '✦',
    passive: '移速 +6% · 后坐 -8%', skill: '过载冲刺', skillEn: 'OVERDRIVE',
    cd: 26, desc: '6 秒内移速 +35%，近距离交战利器。', type: 'speed'
  },
  medic: {
    id: 'medic', name: '蜂医', en: 'APOTHECARY', role: '支援', icon: '✚',
    passive: '生命 +10 · 额外医疗针', skill: '医疗脉冲', skillEn: 'PULSE HEAL',
    cd: 30, desc: '立即回复 45 生命，并短暂抑制疼痛。', type: 'heal'
  },
  recon: {
    id: 'recon', name: '夜莺', en: 'NIGHTINGALE', role: '侦察', icon: '◉',
    passive: '战利品价值 +8%', skill: '区域扫描', skillEn: 'RECON SCAN',
    cd: 34, desc: '10 秒内标记视野外敌人，穿透显示。', type: 'scan'
  }
};
const UPGRADES = {
  vit: { name: '强化纤维', icon: '✚', desc: '基础生命上限 +20 / 级', costs: [450, 950], max: 2 },
  bag: { name: '扩容背包', icon: '▦', desc: '战术背包容量 +2 格 / 级', costs: [550, 1100], max: 2 },
  move: { name: '神经加速', icon: '⌁', desc: '闪避冷却 -1.1 秒 / 级', costs: [500, 1000], max: 2 },
  luck: { name: '拾荒直觉', icon: '◈', desc: '战利品价值 +12% / 级，稀有概率提升', costs: [650, 1300], max: 2 }
};
const CONSUMABLE_COST = { meds: 45, nades: 80 };

function maxHP() { return 100 + save.upgrades.vit * 20; }
function bagSlots() { return 6 + save.upgrades.bag * 2; }
function dashCD() { return 4.7 - save.upgrades.move * 1.1; }
function lootLuck() { return save.upgrades.luck * .55; }
function calcDeposit(l = save.loadout) {
  return (WEAPONS[l.weapon]?.deposit || 0) + (ARMORS[l.armor]?.cost || 0)
    + l.meds * CONSUMABLE_COST.meds + l.nades * CONSUMABLE_COST.nades;
}

/* ---------------- LOOT ---------------- */
const CONTAINER_DEFS = {
  military: { label: '军用物资箱', time: .9, color: '#ffb454', glyph: '▣', bias: 1 },
  medical: { label: '医疗柜', time: .8, color: '#c8ff4f', glyph: '✚', bias: .3 },
  filing: { label: '文件柜', time: .7, color: '#b9a0ff', glyph: '▤', bias: .2 },
  safe: { label: '保险柜', time: 1.4, color: '#ffb454', glyph: '◉', bias: 1.4 },
  vaultsafe: { label: '中央金库', time: 2.4, color: '#b9a0ff', glyph: '❖', bias: 3, requires: 'key' },
  cache: { label: '武器箱', time: 1.1, color: '#67e8ff', glyph: '⌬', bias: 1.2 },
  corpse: { label: '敌人遗物', time: .65, color: '#ff5364', glyph: '✝', bias: 1 }
};
const TIER = {
  common: { name: '普通', color: '#a9b8b1', weight: 100 },
  rare: { name: '稀有', color: '#67e8ff', weight: 43 },
  epic: { name: '史诗', color: '#b9a0ff', weight: 10 },
  legend: { name: '传说', color: '#ffb454', weight: 1.7 },
  key: { name: '密钥', color: '#ffb454', weight: 0 }
};
const LOOT_POOL = {
  common: [
    ['弹药零件', 62, '▤'], ['铜芯线缆', 78, '≋'], ['应急口粮', 70, '▥'],
    ['医疗耗材', 92, '✚'], ['军用铭牌', 88, '◇'], ['电子元件', 116, '⌬'],
    ['密封电池', 104, '▮'], ['加密SIM卡', 128, '▦']
  ],
  rare: [
    ['加密硬盘', 268, '▣'], ['军用光学镜', 322, '◉'], ['稀土电池组', 355, '▮'],
    ['战术电台', 296, '⌁'], ['神经抑制剂', 418, '✚'], ['伺服关节', 380, '⌬']
  ],
  epic: [
    ['量子处理器', 760, '◈'], ['原型血清', 905, '✚'], ['黑匣子', 718, '▣'],
    ['钨芯弹头', 660, '▲'], ['战地AI模块', 840, '⌬']
  ],
  legend: [
    ['零点样本', 1900, '✦'], ['完整AI核心', 2380, '◈'], ['实验体胚胎', 2140, '❖'], ['金条', 5200, '▮'], ['曼德尔砖', 8888, '▰']
  ]
};
const KEY_ITEM = { name: '典狱长密钥', value: 0, tier: 'key', glyph: '⚿', key: true, uid: 0 };
let UID = 1;

function rollTier(bias = 0, luck = 0) {
  const rare = 43 * (1 + bias * .18 + luck * .5);
  const epic = 10 * (1 + bias * .25 + luck * .8);
  const legend = 1.7 * (1 + bias * .4 + luck * 1.1);
  const total = 100 + rare + epic + legend;
  let r = Math.random() * total;
  if ((r -= 100) < 0) return 'common';
  if ((r -= rare) < 0) return 'rare';
  if ((r -= epic) < 0) return 'epic';
  return 'legend';
}
function makeLoot(bias = 0, tierOverride = null) {
  const tier = tierOverride || rollTier(bias, lootLuck());
  const pool = LOOT_POOL[tier];
  const base = pick(pool);
  const value = Math.round(base[1] * (.86 + Math.random() * .3) * (1 + save.upgrades.luck * .12));
  return { uid: UID++, name: base[0], value, tier, glyph: base[2], key: false };
}
function makeKey() { return { ...KEY_ITEM, uid: UID++ }; }
function makeBigGold() {
  const base = pick([['金条', 5200, '▮'], ['曼德尔砖', 8888, '▰']]);
  return { uid: UID++, name: base[0], value: Math.round(base[1] * (.9 + Math.random() * .25)), tier: 'legend', glyph: base[2], key: false, big: true };
}

/* ---------------- AUDIO ---------------- */
const Sound = {
  ctx: null, master: null, droneGain: null, noiseBuf: null, nextPing: 0, started: false,
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = save.muted ? 0 : .55;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.buildBed();
    this.started = true;
  },
  buildBed() {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = .018; g.connect(this.master);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = .8; f.connect(g);
    [41.2, 61.7, 82.4].forEach((hz, i) => {
      const o = c.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine';
      o.frequency.value = hz; const og = c.createGain(); og.gain.value = i === 2 ? .18 : .4;
      o.connect(og); og.connect(f); o.start();
    });
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 320; nf.Q.value = .5;
    const ng = c.createGain(); ng.gain.value = .025;
    n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start();
    this.droneGain = g;
  },
  setMuted(m) {
    save.muted = m; persist();
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : .55, this.ctx.currentTime, .05);
  },
  tick() {
    if (!this.ctx || save.muted) return;
    const t = this.ctx.currentTime;
    if (t > this.nextPing) {
      this.nextPing = t + 9 + Math.random() * 13;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = pick([523.25, 659.25, 783.99, 392]) / 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.014, t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t + 3.2);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 3.3);
    }
  },
  tone(freq, dur, type = 'sine', vol = .08, endFreq = null, pan = 0) {
    if (!this.ctx || save.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    p.pan.value = clamp(pan, -1, 1);
    o.connect(g); g.connect(p); p.connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol, freq, q = 1, pan = 0, type = 'bandpass') {
    if (!this.ctx || save.muted) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * .35), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + .02);
  },
  shot(key, enemy = false, pan = 0, atten = 1) {
    if (!this.ctx) return;
    const w = WEAPONS[key] || WEAPONS.pistol;
    const [dur, freq] = w.sfx;
    const vol = (enemy ? .05 : .115) * atten;
    this.noise(dur * (enemy ? 1.15 : 1), vol, freq * (enemy ? .8 : 1), .9, pan);
    this.tone(enemy ? 92 : 74, .12, 'sine', vol * .9, 38, pan);
    if (key === 'shotgun') this.noise(.24, vol * .7, 420, .7, pan);
    if (key === 'rifle') this.noise(.05, vol * .6, 2600, 1.4, pan);
  },
  hitmark() { this.tone(1300, .035, 'square', .018); this.tone(2100, .03, 'sine', .012); },
  kill() { this.tone(330, .18, 'triangle', .05, 160); this.noise(.12, .04, 800, 1); },
  hurt() { this.tone(70, .24, 'sawtooth', .09, 38); this.noise(.18, .06, 260, .7); },
  empty() { this.tone(900, .035, 'square', .02, 600); },
  reload() { this.tone(360, .04, 'square', .018, 240); },
  reloadDone() { this.tone(620, .05, 'square', .022); this.tone(840, .06, 'square', .018); },
  pickup() { this.tone(720, .07, 'sine', .035); setTimeout(() => this.tone(1080, .1, 'sine', .03), 55); },
  open() { this.noise(.2, .035, 600, .8); this.tone(180, .12, 'triangle', .03, 90); },
  dash() { this.noise(.18, .045, 1200, .6); this.tone(180, .18, 'sine', .025, 560); },
  grenade() { this.tone(300, .1, 'triangle', .03, 500); },
  boom() {
    this.noise(.6, .16, 160, .5); this.tone(55, .7, 'sine', .12, 28);
    this.noise(.3, .06, 900, .7);
  },
  extract() { this.tone(440, .3, 'sine', .035, 660); this.tone(660, .35, 'triangle', .022, 880); },
  success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, .55, 'sine', .045), i * 110)); },
  fail() { [220, 174, 130].forEach((f, i) => setTimeout(() => this.tone(f, .7, 'triangle', .05, f * .8), i * 180)); },
  ui() { this.tone(680, .04, 'square', .015); },
  alarm() { this.tone(180, .35, 'sawtooth', .035, 320); setTimeout(() => this.tone(180, .35, 'sawtooth', .035, 320), 420); }
};

/* ---------------- MISC DOM ---------------- */
const damageFlashEl = $('#damage-flash');
let damageFx = 0;
