
const store = require('./store.ts');
const econ = require('./economy.ts');
const crates = require('./crates.ts');

const MESSAGE_XP_COOLDOWN = Math.max(10000, Number(process.env.MESSAGE_XP_COOLDOWN_MS || 45000));
const MIN_XP = Math.max(1, Number(process.env.MESSAGE_XP_MIN || 15));
const MAX_XP = Math.max(MIN_XP, Number(process.env.MESSAGE_XP_MAX || 30));

function randomXp() {
  return Math.floor(MIN_XP + Math.random() * (MAX_XP - MIN_XP + 1));
}

function randomLevelCash(level) {
  const minimum = 100 + Math.max(1, Number(level || 1)) * 150;
  const spread = 250 + Math.max(1, Number(level || 1)) * 100;
  return minimum + Math.floor(Math.random() * spread);
}

function messageXp(guildId, userId) {
  const u = store.user(guildId, userId);
  const now = Date.now();
  u.xpCooldownUntil = Number(u.xpCooldownUntil || 0);

  if (u.xpCooldownUntil > now) return { gained: 0, levels: [] };

  u.xpCooldownUntil = now + MESSAGE_XP_COOLDOWN;
  const gained = randomXp();
  const levels = econ.addXp(u, gained);
  const crateCount = crates.addLevelCrates(u, levels);
  const weaponCrateCount = crates.addLevelWeaponCrates(u, levels);
  const rewards = levels.map(level => {
    const requestedCash = randomLevelCash(level);
    const cash = econ.creditCoins(u, requestedCash);
    return {
      level,
      requestedCash,
      cash: cash.credited,
      uncredited: cash.uncredited,
    };
  });
  store.save();

  return { gained, levels, rewards, crateCount, weaponCrateCount, crates: u.crates, weaponCrates: u.weaponCrates };
}

function xpProgress(u) {
  const level = Math.max(1, Number(u.level || 1));
  const current = Math.max(0, Number(u.xp || 0));
  const required = econ.needXp(level);
  return {
    level,
    xp: current,
    required,
    nextLevel: level + 1,
    needed: Math.max(0, required - current),
    percent: Math.max(0, Math.min(100, Math.floor((current / required) * 100)))
  };
}

module.exports = { messageXp, xpProgress, MESSAGE_XP_COOLDOWN };
