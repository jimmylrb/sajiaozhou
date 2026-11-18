'use strict';
/* ============================================================
   BLACKSITE ZERO 3D — gunsmith data + derived weapon stats
   ============================================================ */
const ATTACH_SLOTS = [
  { id: 'optic', name: '瞄具', en: 'OPTIC', icon: '◎' },
  { id: 'muzzle', name: '枪口', en: 'MUZZLE', icon: '▸' },
  { id: 'grip', name: '握把', en: 'GRIP', icon: '⌁' },
  { id: 'mag', name: '弹匣', en: 'MAG', icon: '▥' },
  { id: 'stock', name: '枪托', en: 'STOCK', icon: '◂' }
];
const ATTACHMENTS = {
  optic: [
    { id: 'iron', name: '机械瞄具', en: 'IRON SIGHTS', cost: 0, desc: '标准照门，零负担。', mods: {}, visual: 'iron' },
    { id: 'reddot', name: '微型红点', en: 'MICRO RED DOT', cost: 160, desc: '快速捕获目标，降低散布。', mods: { spread: -.18, ads: -.04 }, visual: 'reddot' },
    { id: 'holo', name: '全息瞄具', en: 'HOLO SIGHT', cost: 300, desc: '大视窗，精准度与稳定性兼顾。', mods: { spread: -.23, ads: -.06 }, visual: 'holo' },
    { id: 'scope', name: '4× 战术镜', en: '4X OPTIC', cost: 580, desc: '远距离精确射击，开镜更慢。', mods: { spread: -.34, ads: .16, recoil: -.05 }, visual: 'scope' }
  ],
  muzzle: [
    { id: 'muzzle_none', name: '标准枪口', en: 'STANDARD', cost: 0, desc: '出厂枪口装置。', mods: {}, visual: 'none' },
    { id: 'comp', name: '补偿器', en: 'COMPENSATOR', cost: 150, desc: '抑制枪口上跳。', mods: { recoil: -.22, flash: -.25 }, visual: 'comp' },
    { id: 'brake', name: '制退器', en: 'MUZZLE BRAKE', cost: 240, desc: '大幅减少后坐，但枪口焰更明显。', mods: { recoil: -.34, flash: .35 }, visual: 'brake' },
    { id: 'suppressor', name: '战术抑制器', en: 'SUPPRESSOR', cost: 460, desc: '大幅降低枪声传播，略微损失伤害。', mods: { recoil: -.1, spread: -.12, damage: -.05, suppressed: true, flash: -.7 }, visual: 'suppressor' }
  ],
  grip: [
    { id: 'grip_none', name: '标准护木', en: 'STANDARD', cost: 0, desc: '无额外握把。', mods: {}, visual: 'none' },
    { id: 'vertical', name: '垂直握把', en: 'VERTICAL GRIP', cost: 180, desc: '稳定连射，降低后坐。', mods: { recoil: -.18, ads: .03 }, visual: 'vertical' },
    { id: 'angled', name: '斜角握把', en: 'ANGLED GRIP', cost: 220, desc: '提升快速瞄准与散布控制。', mods: { spread: -.12, ads: -.08 }, visual: 'angled' },
    { id: 'laser', name: '激光指示器', en: 'LASER', cost: 280, desc: '腰射散布大幅降低，暴露激光。', mods: { hipSpread: -.3, ads: .02 }, visual: 'laser' }
  ],
  mag: [
    { id: 'mag_std', name: '标准弹匣', en: 'STANDARD MAG', cost: 0, desc: '标准容量，换弹迅速。', mods: {}, visual: 'std' },
    { id: 'extended', name: '扩容弹匣', en: 'EXTENDED MAG', cost: 260, desc: '容量 +50%，换弹变慢。', mods: { mag: 1.5, reload: .14 }, visual: 'extended' },
    { id: 'quick', name: '快拔弹匣', en: 'QUICK MAG', cost: 210, desc: '换弹 -25%，容量略降。', mods: { mag: .9, reload: -.25 }, visual: 'quick' }
  ],
  stock: [
    { id: 'stock_std', name: '标准枪托', en: 'STANDARD STOCK', cost: 0, desc: '均衡配置。', mods: {}, visual: 'std' },
    { id: 'light', name: '轻量枪托', en: 'LIGHT STOCK', cost: 200, desc: '机动性更好，后坐略增。', mods: { ads: -.12, move: .03, recoil: .1 }, visual: 'light' },
    { id: 'heavy', name: '重型枪托', en: 'HEAVY STOCK', cost: 330, desc: '显著降低后坐，开镜更慢。', mods: { recoil: -.26, ads: .12, move: -.02 }, visual: 'heavy' }
  ]
};
function defaultAttachmentSet() {
  const o = {};
  for (const s of ATTACH_SLOTS) o[s.id] = ATTACHMENTS[s.id][0].id;
  return o;
}
function ensureGunsmith() {
  if (!save.attachments || typeof save.attachments !== 'object') save.attachments = {};
  if (!save.attachmentOwned || typeof save.attachmentOwned !== 'object') save.attachmentOwned = {};
  let changed = false;
  for (const type of Object.keys(WEAPONS)) {
    if (!save.attachments[type] || typeof save.attachments[type] !== 'object') { save.attachments[type] = defaultAttachmentSet(); changed = true; }
    for (const slot of ATTACH_SLOTS) {
      const id = save.attachments[type][slot.id];
      if (!ATTACHMENTS[slot.id].some(a => a.id === id)) { save.attachments[type][slot.id] = ATTACHMENTS[slot.id][0].id; changed = true; }
    }
  }
  for (const slot of ATTACH_SLOTS) for (const a of ATTACHMENTS[slot.id]) {
    if (a.cost === 0 && save.attachmentOwned[a.id] !== true) { save.attachmentOwned[a.id] = true; changed = true; }
  }
  if (changed) persist();
}
ensureGunsmith();
function getAttachment(slot, id) {
  return (ATTACHMENTS[slot] || []).find(a => a.id === id) || ATTACHMENTS[slot][0];
}
function attachmentEquipped(type, slot) {
  ensureGunsmith();
  return getAttachment(slot, save.attachments[type]?.[slot]);
}
function attachmentOwned(opt) {
  return opt.cost === 0 || save.attachmentOwned?.[opt.id] === true;
}
function setAttachment(type, slot, id) {
  ensureGunsmith();
  save.attachments[type][slot] = id;
  persist();
}
function getWeaponStats(type) {
  const base = WEAPONS[type];
  const eq = {};
  const visuals = {};
  let spread = 1, recoil = 1, reload = 1, mag = 1, damage = 1, ads = 0, move = 1, hipSpread = 1;
  let suppressed = false, laser = false, flash = 1;
  let modCount = 0;
  for (const slot of ATTACH_SLOTS) {
    const opt = attachmentEquipped(type, slot.id);
    eq[slot.id] = opt.id; visuals[slot.id] = opt.visual;
    const m = opt.mods || {};
    if (m.spread) spread += m.spread;
    if (m.recoil) recoil += m.recoil;
    if (m.reload) reload += m.reload;
    if (m.mag) mag *= m.mag;
    if (m.damage) damage += m.damage;
    if (m.ads) ads += m.ads;
    if (m.move) move += m.move;
    if (m.hipSpread) hipSpread += m.hipSpread;
    if (m.flash) flash += m.flash;
    if (m.suppressed) suppressed = true;
    if (opt.visual === 'laser') laser = true;
    if (opt.id !== ATTACHMENTS[slot.id][0].id) modCount++;
  }
  const magSize = Math.max(3, Math.round(base.mag * mag));
  return {
    ...base,
    dmg: Math.round(base.dmg * damage * 10) / 10,
    mag: magSize,
    reserve: Math.max(magSize * 2, Math.round(base.reserve * mag)),
    spread: base.spread * Math.max(.35, spread),
    recoil: base.recoil * Math.max(.35, recoil),
    reload: Math.max(.5, base.reload * reload),
    adsTime: ads,
    moveMult: move,
    hipSpreadMult: Math.max(.3, hipSpread),
    suppressed, laser, flashMult: Math.max(.1, flash),
    modCount, attachments: eq, visuals,
    baseName: base.name
  };
}
function currentWeapon() { return getWeaponStats(save.loadout.weapon); }
