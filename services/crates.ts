const store = require('./store.ts');
const premium = require('./premium.ts');

const RARITIES = {
  Common: { weight: 60, emoji: '⚪' },
  Rare: { weight: 25, emoji: '🔵' },
  Mythic: { weight: 10, emoji: '🟣' },
  Legendary: { weight: 5, emoji: '🟡' }
};

const LOOT = [
  { id: 'common_coin_cache', name: 'Coin Cache', rarity: 'Common', emoji: '🪙', type: 'coins', min: 250, max: 900 },
  { id: 'common_xp_boost', name: 'XP Spark', rarity: 'Common', emoji: '✨', type: 'xp', min: 30, max: 80 },
  { id: 'common_lucky_charm', name: 'Lucky Charm', rarity: 'Common', emoji: '🍀', type: 'item' },
  { id: 'rare_coin_cache', name: 'Royal Coin Cache', rarity: 'Rare', emoji: '💰', type: 'coins', min: 1200, max: 3500 },
  { id: 'rare_lucky_ticket', name: 'Royal Lucky Ticket', rarity: 'Rare', emoji: '🎟️', type: 'item' },
  { id: 'rare_xp_core', name: 'XP Core', rarity: 'Rare', emoji: '🔷', type: 'xp', min: 120, max: 300 },
  { id: 'mythic_coin_vault', name: 'Mythic Coin Vault', rarity: 'Mythic', emoji: '🏦', type: 'coins', min: 6000, max: 15000 },
  { id: 'mythic_astral_relic', name: 'Astral Relic', rarity: 'Mythic', emoji: '🗿', type: 'item' },
  { id: 'mythic_lucky_core', name: 'Mythic Lucky Core', rarity: 'Mythic', emoji: '🔮', type: 'item' },
  { id: 'legendary_treasure', name: 'Legendary Treasure', rarity: 'Legendary', emoji: '👑', type: 'coins', min: 25000, max: 75000 },
  { id: 'legendary_gem', name: 'Legendary Astrix Gem', rarity: 'Legendary', emoji: '💎', type: 'gems', min: 20, max: 50, premiumOnly: true },
  { id: 'legendary_crown', name: 'Crown of Astrix', rarity: 'Legendary', emoji: '👑', type: 'item' }
];

const CRATE_ITEM_IDS = new Set(LOOT.filter(item => item.type === 'item').map(item => item.id));
const WEAPON_LOOT = [
  { id: 'weapon_hunter_bow', name: 'Hunter Bow', rarity: 'Common', emoji: '🏹', power: 1, description: 'A reliable bow that slightly improves hunt rewards.' },
  { id: 'weapon_iron_spear', name: 'Iron Spear', rarity: 'Common', emoji: '🔱', power: 2, description: 'A sturdy spear for everyday hunts.' },
  { id: 'weapon_moon_blade', name: 'Moon Blade', rarity: 'Rare', emoji: '🌙', power: 4, description: 'A moonlit blade that makes uncommon creatures easier to find.' },
  { id: 'weapon_dragon_slayer', name: 'Dragon Slayer', rarity: 'Mythic', emoji: '🐲', power: 7, description: 'A mythic weapon built for legendary hunts.' },
  { id: 'weapon_astral_reaper', name: 'Astral Reaper', rarity: 'Legendary', emoji: '⚔️', power: 12, description: 'The rarest Astrix hunting weapon.' }
];
const WEAPON_CRATE_RARITIES = {
  Common: { weight: 55, emoji: '⚪' },
  Rare: { weight: 28, emoji: '🔵' },
  Mythic: { weight: 13, emoji: '🟣' },
  Legendary: { weight: 4, emoji: '🟡' }
};

function ensure(u) {
  // New users start with one crate, but an opened inventory is allowed to
  // reach zero. The old minimum of 1 silently recreated a crate every time
  // store.user() was called, making crates effectively unlimited.
  const startingCrates = Math.max(1, Math.floor(Number(u.level || 1)));
  const current = Number(u.crates);
  u.crates = Number.isFinite(current)
    ? Math.max(0, Math.floor(current))
    : startingCrates;
  u.weaponCrates = Math.max(0, Math.floor(Number(u.weaponCrates || 0)));
  u.crateLoot ||= {};
  u.weaponLoot ||= {};
  return u;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRarity() {
  const total = Object.values(RARITIES).reduce((n, r) => n + r.weight, 0);
  let roll = Math.random() * total;
  for (const [rarity, data] of Object.entries(RARITIES)) {
    roll -= data.weight;
    if (roll < 0) return rarity;
  }
  return 'Common';
}

function pickLoot(canReceiveGems = false) {
  const rarity = pickRarity();
  const pool = LOOT.filter(item => item.rarity === rarity && (!item.premiumOnly || canReceiveGems));
  return pool[Math.floor(Math.random() * pool.length)];
}

function addLevelCrates(u, levels) {
  ensure(u);
  const count = Math.max(0, Number(levels?.length || 0));
  if (count) u.crates += count;
  return count;
}

function addLevelWeaponCrates(u, levels) {
  ensure(u);
  const count = (levels || []).filter(level => Number(level) > 0 && Number(level) % 3 === 0).length;
  if (count) u.weaponCrates += count;
  return count;
}

function grant(u, kind, quantity) {
  ensure(u);
  const key = kind === 'weapon' ? 'weaponCrates' : 'crates';
  const amount = Math.max(0, Math.floor(Number(quantity || 0)));
  u[key] += amount;
  return amount;
}

function open(guildId, userId, quantity = 1) {
  const economy = require('./economy.ts');
  const u = ensure(store.user(guildId, userId));
  const canReceiveGems = premium.tierFor(guildId, userId) !== 'free';
  const requested = String(quantity || 1).toLowerCase() === 'all' ? u.crates : Number(quantity || 1);
  const qty = Math.max(1, Math.min(25, Math.floor(requested)));
  if (u.crates < qty) throw new Error(`You only have **${u.crates}** Only Crate${u.crates === 1 ? '' : 's'}.`);

  const results = [];
  for (let n = 0; n < qty; n++) {
    const loot = pickLoot(canReceiveGems);
    u.crates--;
    let amount = null;
    if (loot.type === 'coins') {
      amount = randomInt(loot.min, loot.max);
      const credit = economy.creditCoins(u, amount);
      results.push({ loot, amount, credited: credit.credited, uncredited: credit.uncredited });
    } else if (loot.type === 'gems') {
      amount = randomInt(loot.min, loot.max);
      u.premiumGems = Math.max(0, Math.floor(Number(u.premiumGems || 0))) + amount;
      results.push({ loot, amount, credited: amount, uncredited: 0 });
    } else if (loot.type === 'xp') {
      amount = randomInt(loot.min, loot.max);
      const levels = economy.addXp(u, amount);
      results.push({ loot, amount, levels, credited: amount, uncredited: 0 });
      if (levels.length) {
        addLevelCrates(u, levels);
        addLevelWeaponCrates(u, levels);
      }
    } else {
      // Crate collectibles are real economy items as well as collection
      // statistics. Keeping them in inventory makes them visible to
      // /inventory and sellable through the unified shop.
      u.inventory ||= {};
      u.inventory[loot.id] = Number(u.inventory[loot.id] || 0) + 1;
      u.crateLoot[loot.id] = Number(u.crateLoot[loot.id] || 0) + 1;
      results.push({ loot, amount: 1, credited: 1, uncredited: 0 });
    }
  }

  store.save();
  return { quantity: qty, crates: u.crates, weaponCrates: u.weaponCrates, results, user: u };
}

function pickWeapon() {
  const total = Object.values(WEAPON_CRATE_RARITIES).reduce((sum, rarity) => sum + rarity.weight, 0);
  let roll = Math.random() * total;
  let rarity = 'Common';
  for (const [name, data] of Object.entries(WEAPON_CRATE_RARITIES)) {
    roll -= data.weight;
    if (roll < 0) {
      rarity = name;
      break;
    }
  }
  const pool = WEAPON_LOOT.filter(item => item.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

function openWeapon(guildId, userId, quantity = 1) {
  const u = ensure(store.user(guildId, userId));
  const requested = String(quantity || 1).toLowerCase() === 'all' ? u.weaponCrates : Number(quantity || 1);
  const qty = Math.max(1, Math.min(25, Math.floor(requested)));
  if (u.weaponCrates < qty) {
    throw new Error(`You only have **${u.weaponCrates}** Weapon Crate${u.weaponCrates === 1 ? '' : 's'}.`);
  }
  const results = [];
  for (let n = 0; n < qty; n++) {
    const weapon = pickWeapon();
    u.weaponCrates--;
    u.inventory[weapon.id] = Number(u.inventory[weapon.id] || 0) + 1;
    u.weaponLoot[weapon.id] = Number(u.weaponLoot[weapon.id] || 0) + 1;
    results.push({ weapon });
  }
  store.save();
  return { quantity: qty, weaponCrates: u.weaponCrates, results, user: u };
}

function formatWeaponResults(results) {
  return results.map(({ weapon }) =>
    `${weapon.emoji} **${weapon.rarity}** — **${weapon.name}** added to your hunt inventory.\n_${weapon.description}_`
  ).join('\n');
}

function weaponCatalogText() {
  return Object.entries(WEAPON_CRATE_RARITIES)
    .map(([rarity, data]) => `${data.emoji} **${rarity}** — ${WEAPON_LOOT.filter(item => item.rarity === rarity).map(item => `${item.emoji} ${item.name}`).join(' • ')}`)
    .join('\n');
}

function view(guildId, userId) {
  const u = ensure(store.user(guildId, userId));
  return {
    crates: u.crates,
    weaponCrates: u.weaponCrates,
    level: u.level,
    probabilities: Object.fromEntries(Object.entries(RARITIES).map(([k, v]) => [k, v.weight])),
    loot: u.crateLoot || {},
    weapons: u.weaponLoot || {}
  };
}

function catalogText() {
  return Object.entries(RARITIES)
    .map(([rarity, data]) => {
      const rewards = LOOT
        .filter(item => item.rarity === rarity)
        .map(item => `${item.emoji} ${item.name}`)
        .join(' • ');
      return `${data.emoji} **${rarity}** — ${data.weight}%\n${rewards}`;
    })
    .join('\n\n');
}

function formatResults(results) {
  const lines = [];
  for (const r of results) {
    const e = r.loot.emoji;
    const rarity = `${RARITIES[r.loot.rarity].emoji} **${r.loot.rarity}**`;
    let reward = r.loot.name;
    if (r.loot.type === 'coins') reward += ` • +${Number(r.credited || 0).toLocaleString()} coins`;
    if (r.loot.type === 'gems') reward += ` • +${Number(r.amount || 0).toLocaleString()} Gems`;
    if (r.loot.type === 'xp') reward += ` • +${Number(r.amount || 0).toLocaleString()} XP`;
    if (r.loot.type === 'item') reward += ' • added to your collection';
    if (r.levels?.length) reward += ` • Level ${r.levels.join(', ')} reached!`;
    lines.push(`${e} ${rarity} — **${reward}**`);
  }
  return lines.join('\n');
}

module.exports = {
  RARITIES, LOOT, CRATE_ITEM_IDS, WEAPON_LOOT, ensure,
  addLevelCrates, addLevelWeaponCrates, grant, open, openWeapon, view,
  catalogText, weaponCatalogText, formatResults, formatWeaponResults
};
