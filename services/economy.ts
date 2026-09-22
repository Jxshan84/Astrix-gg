// @ts-nocheck
const store = require('./store.ts');
const premium = require('./premium.ts');
const crates = require('./crates.ts');

function needXp(level) {
  return 100 + level * level * 60;
}

function addXp(u, amount) {
  const levels = [];
  u.xp += Math.max(0, Math.floor(amount));
  while (u.xp >= needXp(u.level)) {
    u.xp -= needXp(u.level);
    u.level++;
    levels.push(u.level);
  }
  store.syncCapacity?.(u);
  return levels;
}

function walletSpace(u) {
  return Math.max(0, Math.floor((u.walletLimit || 0) - (u.wallet || 0)));
}

function bankSpace(u) {
  return Math.max(0, Math.floor((u.bankLimit || 0) - (u.bank || 0)));
}

function totalSpace(u) {
  return walletSpace(u) + bankSpace(u);
}

function creditCoins(u, amount, options = {}) {
  const requested = Math.max(0, Math.floor(Number(amount || 0)));
  const spillToBank = options.spillToBank !== false;
  let remaining = requested;

  const walletAdded = Math.min(walletSpace(u), remaining);
  u.wallet += walletAdded;
  remaining -= walletAdded;

  let bankAdded = 0;
  if (spillToBank && remaining > 0) {
    bankAdded = Math.min(bankSpace(u), remaining);
    u.bank += bankAdded;
    remaining -= bankAdded;
  }

  return {
    requested,
    credited: requested - remaining,
    walletAdded,
    bankAdded,
    uncredited: remaining
  };
}

// A winning game must never lose its payout just because the player was at
// the normal wallet/bank capacity before placing the bet. The wager has
// already created room, so extend the bank capacity only for the shortfall
// and then credit the full return plus winnings.
function creditGamePayout(u, amount) {
  const requested = Math.max(0, Math.floor(Number(amount || 0)));
  const free = totalSpace(u);
  if (requested > free) {
    u.bankLimit = Math.max(
      Number(u.bankLimit || 0),
      Number(u.bank || 0) + (requested - free)
    );
  }
  return creditCoins(u, requested);
}

function addCoins(u, amount) {
  return creditCoins(u, amount).credited;
}

function fmt(n) {
  return `${Math.floor(n || 0).toLocaleString()} coins`;
}

function limitText(u) {
  return `Wallet ${Math.floor(u.wallet || 0).toLocaleString()} / ${Math.floor(u.walletLimit || 0).toLocaleString()} • Bank ${Math.floor(u.bank || 0).toLocaleString()} / ${Math.floor(u.bankLimit || 0).toLocaleString()}`;
}

async function reward(interaction, coins, xp) {
  const u = store.user(interaction.guildId, interaction.user.id);
  const mult = premium.multiplier(interaction);
  const requestedCoins = Math.floor(coins * mult);
  const credit = creditCoins(u, requestedCoins);
  const levels = addXp(u, Math.floor(xp * mult));
  store.save();

  const crateCount = crates.addLevelCrates(u, levels);
  const weaponCrateCount = crates.addLevelWeaponCrates(u, levels);
  for (const lvl of levels) {
    const bonus = lvl * 250;
    const bonusCredit = creditCoins(u, bonus);
    store.save();
    await interaction.channel.send(
      `<@${interaction.user.id}> reached **Level ${lvl}**.\nXP reward: **+${Math.floor(xp * mult)} XP** • Level bonus: **${econFormat(bonusCredit.credited)}**`
    ).catch(() => {});
  }

  return {
    coins: credit.credited,
    requestedCoins,
    walletAdded: credit.walletAdded,
    bankAdded: credit.bankAdded,
    uncredited: credit.uncredited,
    xp: Math.floor(xp * mult),
    levels,
    crateCount,
    weaponCrateCount,
    crates: u.crates
    ,weaponCrates: u.weaponCrates
  };
}

function econFormat(amount) {
  return `${Math.floor(Number(amount || 0)).toLocaleString()} coins`;
}

function cooldown(u, key, ms) {
  const now = Date.now();
  const until = Number(u.cooldowns[key] || 0);
  if (until > now) return until - now;
  u.cooldowns[key] = now + ms;
  return 0;
}

module.exports = {
  needXp,
  addXp,
  addCoins,
  creditCoins,
  creditGamePayout,
  walletSpace,
  bankSpace,
  totalSpace,
  fmt,
  limitText,
  reward,
  cooldown
};
