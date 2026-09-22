// @ts-nocheck

const store = require('./store.ts');

const RING_CATALOG = {
  silver_marriage_ring: { name: 'Silver Marriage Ring', emoji: '💍', rarity: 'Common', value: 2500 },
  gold_marriage_ring: { name: 'Gold Marriage Ring', emoji: '💛', rarity: 'Uncommon', value: 10000 },
  platinum_marriage_ring: { name: 'Platinum Marriage Ring', emoji: '💠', rarity: 'Rare', value: 25000 },
  diamond_marriage_ring: { name: 'Diamond Marriage Ring', emoji: '💎', rarity: 'Epic', value: 75000 },
  ruby_marriage_ring: { name: 'Ruby Marriage Ring', emoji: '❤️', rarity: 'Legendary', value: 125000 },
  royal_marriage_ring: { name: 'Royal Marriage Ring', emoji: '👑', rarity: 'Mythic', value: 250000 },
  kohinoor_marriage_ring: { name: 'Kohinoor Marriage Ring', emoji: '💎', rarity: 'Exclusive', value: 1000000 }
};

const DEFAULT_RING_ID = 'diamond_marriage_ring';
const PROPOSAL_TIMEOUT_MS = 10 * 60 * 1000;
const DIVORCE_FEE = Math.max(0, Number(process.env.DIVORCE_FEE || 50000));
const MARRIAGE_BONUS = Math.max(0, Number(process.env.MARRIAGE_BONUS || 5000));

function ringInfo(ringId) { return RING_CATALOG[ringId] || null; }

function profile(u) {
  return u.marriage && u.marriage.partnerId ? u.marriage : null;
}

function pending(guildId) {
  const g = store.guild(guildId);
  g.marriage ||= { pending: {} };
  g.marriage.pending ||= {};
  return g.marriage.pending;
}

function ensureMarriageStats(m) {
  m.stats ||= { giftsSent: 0, giftsReceived: 0, giftCoins: 0 };
  m.stats.giftsSent = Math.max(0, Number(m.stats.giftsSent || 0));
  m.stats.giftsReceived = Math.max(0, Number(m.stats.giftsReceived || 0));
  m.stats.giftCoins = Math.max(0, Number(m.stats.giftCoins || 0));
  m.achievements ||= [];
  return m;
}

function propose(guildId, fromId, toId, ringId = DEFAULT_RING_ID) {
  if (fromId === toId) throw new Error('You cannot marry yourself.');
  const from = store.user(guildId, fromId);
  const to = store.user(guildId, toId);
  if (from.marriage?.partnerId) throw new Error('You are already married.');
  if (to.marriage?.partnerId) throw new Error('That user is already married.');
  if (!ringInfo(ringId)) throw new Error('That marriage ring is unavailable.');
  if (Number(from.inventory?.[ringId] || 0) < 1) {
    throw new Error(`You need a **${ringInfo(ringId).name}** from \`/shop\` to propose.`);
  }

  const map = pending(guildId);
  if (map[toId]) throw new Error('That user already has a pending marriage proposal.');

  map[toId] = {
    fromId, toId, ringId,
    createdAt: Date.now(),
    expiresAt: Date.now() + PROPOSAL_TIMEOUT_MS
  };
  store.save();
  return map[toId];
}

function accept(guildId, toId, fromId) {
  const map = pending(guildId);
  const proposal = map[toId];
  if (!proposal || proposal.fromId !== fromId) throw new Error('That marriage proposal is missing or has expired.');
  if (Date.now() > proposal.expiresAt) {
    delete map[toId];
    store.save();
    throw new Error('That marriage proposal has expired.');
  }

  const ringId = proposal.ringId || DEFAULT_RING_ID;
  const a = store.user(guildId, fromId);
  const b = store.user(guildId, toId);

  if (a.marriage?.partnerId || b.marriage?.partnerId) throw new Error('One of you is already married.');
  if (Number(a.inventory?.[ringId] || 0) < 1) throw new Error('The proposal ring is missing.');

  a.inventory[ringId] -= 1;
  if (a.inventory[ringId] <= 0) delete a.inventory[ringId];

  const marriedAt = Date.now();
  const base = { marriedAt, ringId, anniversaryCount: 0, lastAnniversaryAt: 0 };
  a.marriage = { partnerId: toId, ...base, stats: { giftsSent: 0, giftsReceived: 0, giftCoins: 0 }, achievements: [] };
  b.marriage = { partnerId: fromId, ...base, stats: { giftsSent: 0, giftsReceived: 0, giftCoins: 0 }, achievements: [] };

  // Couple bonus: credited directly to each wallet.
  a.wallet = Number(a.wallet || 0) + MARRIAGE_BONUS;
  b.wallet = Number(b.wallet || 0) + MARRIAGE_BONUS;

  delete map[toId];
  store.save();
  return { a, b, marriedAt, ringId, bonus: MARRIAGE_BONUS };
}

function decline(guildId, toId, fromId) {
  const map = pending(guildId);
  const proposal = map[toId];
  if (!proposal || proposal.fromId !== fromId) throw new Error('That marriage proposal is missing or has expired.');
  delete map[toId];
  store.save();
}

function debit(u, amount) {
  let remaining = amount;
  const wallet = Math.min(Number(u.wallet || 0), remaining);
  u.wallet -= wallet;
  remaining -= wallet;
  const bank = Math.min(Number(u.bank || 0), remaining);
  u.bank -= bank;
  remaining -= bank;
  return { paid: amount - remaining, remaining };
}

function divorce(guildId, userId) {
  const u = store.user(guildId, userId);
  const partnerId = u.marriage?.partnerId;
  if (!partnerId) throw new Error('You are not married.');

  const partner = store.user(guildId, partnerId);
  const cost = DIVORCE_FEE;
  if (Number(u.wallet || 0) + Number(u.bank || 0) < cost) {
    throw new Error(`Divorce costs **${cost.toLocaleString()} coins**. You do not have enough.`);
  }

  debit(u, cost);
  u.marriage = null;
  if (partner.marriage?.partnerId === userId) partner.marriage = null;
  store.save();
  return { partnerId, fee: cost };
}

function status(guildId, userId) {
  const u = store.user(guildId, userId);
  const p = profile(u);
  if (!p) return { married: false, partnerId: null, ringId: null, ring: null };

  ensureMarriageStats(p);
  const marriedAt = Number(p.marriedAt || Date.now());
  const nextAnniversary = new Date(marriedAt);
  nextAnniversary.setFullYear(new Date().getFullYear());
  if (nextAnniversary.getTime() <= Date.now()) nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);

  return {
    married: true,
    partnerId: p.partnerId,
    marriedAt,
    ringId: p.ringId || DEFAULT_RING_ID,
    ring: ringInfo(p.ringId || DEFAULT_RING_ID),
    nextAnniversary: nextAnniversary.getTime(),
    stats: p.stats,
    achievements: p.achievements || []
  };
}

function gift(guildId, fromId, toId, amount) {
  amount = Math.floor(Number(amount || 0));
  if (amount < 1) throw new Error('Gift amount must be at least 1 coin.');
  if (fromId === toId) throw new Error('You cannot gift yourself.');

  const from = store.user(guildId, fromId);
  const to = store.user(guildId, toId);
  if (from.marriage?.partnerId !== toId || to.marriage?.partnerId !== fromId) {
    throw new Error('Marriage gifts are only available between married partners.');
  }
  if (Number(from.wallet || 0) < amount) throw new Error('You do not have enough wallet coins.');

  from.wallet -= amount;
  to.wallet += amount;

  ensureMarriageStats(from.marriage);
  ensureMarriageStats(to.marriage);
  from.marriage.stats.giftsSent += 1;
  from.marriage.stats.giftCoins += amount;
  to.marriage.stats.giftsReceived += 1;
  to.marriage.stats.giftCoins += amount;

  checkAchievements(from.marriage);
  checkAchievements(to.marriage);
  store.save();
  return { amount };
}

function checkAchievements(m) {
  ensureMarriageStats(m);
  const unlocked = new Set(m.achievements);
  if (m.stats.giftsSent >= 1) unlocked.add('first-gift');
  if (m.stats.giftCoins >= 10000) unlocked.add('gift-master');
  if (m.stats.giftCoins >= 100000) unlocked.add('generous-heart');
  m.achievements = [...unlocked];
  return m.achievements;
}

function achievements(guildId, userId) {
  const u = store.user(guildId, userId);
  if (!u.marriage?.partnerId) return [];
  const m = ensureMarriageStats(u.marriage);
  const years = Math.max(0, Math.floor((Date.now() - Number(m.marriedAt || Date.now())) / 31557600000));
  if (years >= 1) m.achievements = [...new Set([...(m.achievements || []), 'first-anniversary'])];
  checkAchievements(m);
  store.save();

  const labels = {
    'first-gift': '🎁 First Gift',
    'gift-master': '💝 Gift Master',
    'generous-heart': '💎 Generous Heart',
    'first-anniversary': '📅 First Anniversary'
  };
  return (m.achievements || []).map(x => labels[x] || x);
}

function leaderboard(guildId, limit = 10) {
  const seen = new Set();
  const rows = [];

  for (const [userId, u] of Object.entries(store.allUsers(guildId))) {
    const partnerId = u.marriage?.partnerId;
    if (!partnerId || seen.has(userId) || seen.has(partnerId)) continue;
    const key = [userId, partnerId].sort().join(':');
    seen.add(userId); seen.add(partnerId);
    const marriedAt = Number(u.marriage.marriedAt || Date.now());
    rows.push({
      key,
      a: userId,
      b: partnerId,
      marriedAt,
      days: Math.max(0, Math.floor((Date.now() - marriedAt) / 86400000)),
      ringId: u.marriage.ringId || DEFAULT_RING_ID
    });
  }

  return rows.sort((a, b) => b.days - a.days).slice(0, Math.max(1, Math.min(25, limit)));
}

module.exports = {
  RING_CATALOG,
  DEFAULT_RING_ID,
  PROPOSAL_TIMEOUT_MS,
  DIVORCE_FEE,
  MARRIAGE_BONUS,
  ringInfo,
  propose,
  accept,
  decline,
  divorce,
  status,
  gift,
  achievements,
  leaderboard
};
