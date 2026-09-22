const fs = require('fs');
const path = require('path');
const store = require('./store.ts');
const premium = require('./premium.ts');
const economy = require('./economy.ts');

const CATALOG_FILES = [
  path.join(__dirname, '..', 'data', 'free-shop.json'),
  path.join(__dirname, '..', 'data', 'premium-shop.json'),
  path.join(__dirname, '..', 'data', 'xp-shop.json'),
  path.join(__dirname, '..', 'data', 'crate-items.json'),
  path.join(__dirname, '..', 'data', 'weapon-crate-items.json')
];

let catalogCache = null;

function readJson(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function isShopItem(raw) {
  const category = String(raw?.category || '').toLowerCase();
  const itemName = String(raw?.name || '').toLowerCase();
  return category !== 'food' && !/\bjuice\b/.test(itemName);
}

function baseCatalog() {
  if (catalogCache) return catalogCache;
  const byId = new Map();
  for (const file of CATALOG_FILES) {
    for (const raw of readJson(file)) {
      if (!raw?.id || !raw?.name) continue;
      if (!isShopItem(raw)) continue;
      byId.set(String(raw.id), normalizeItem(raw));
    }
  }
  catalogCache = [...byId.values()].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  return catalogCache;
}

function levelRequirementFromPrice(price) {
  const p = Math.max(0, Number(price || 0));
  if (p <= 10_000) return 1;
  if (p <= 100_000) return 5;
  if (p <= 1_000_000) return 10;
  if (p <= 10_000_000) return 20;
  if (p <= 100_000_000) return 35;
  if (p <= 1_000_000_000) return 50;
  if (p <= 10_000_000_000) return 75;
  if (p <= 100_000_000_000) return 100;
  if (p <= 1_000_000_000_000) return 125;
  return 150;
}

function normalizeItem(raw) {
  const price = Math.max(1, Math.floor(Number(raw.price || 1)));
  return {
    ...raw,
    id: String(raw.id),
    name: String(raw.name),
    emoji: String(raw.emoji || '📦'),
    category: String(raw.category || 'General'),
    rarity: String(raw.rarity || 'Common'),
    description: String(raw.description || 'A collectible Astrix economy item.'),
    price,
    sellPrice: Math.max(0, Math.floor(Number(raw.sellPrice ?? price * 0.5))),
    minLevel: Math.max(1, Math.floor(Number(raw.minLevel || levelRequirementFromPrice(price)))),
    minStock: Math.max(1, Math.floor(Number(raw.minStock || 1))),
    maxStock: Math.max(1, Math.floor(Number(raw.maxStock || Math.max(2, raw.minStock || 1))))
  };
}

function loadCatalog(tier = 'all') {
  const all = baseCatalog();
  if (tier === 'free') return readJson(CATALOG_FILES[0]).filter(isShopItem).map(normalizeItem);
  if (tier === 'premium') return readJson(CATALOG_FILES[1]).filter(isShopItem).map(normalizeItem);
  if (tier === 'xp') return readJson(CATALOG_FILES[2]).filter(isShopItem).map(normalizeItem);
  return all;
}

function ensureMarket(guildId) {
  const g = store.guild(guildId);
  g.shop ||= {};
  const market = g.shop.market;
  if (!market || !market.stock || Date.now() >= Number(market.expiresAt || 0)) rotate(guildId, 'all');
  return store.guild(guildId).shop.market;
}

function rotate(guildId, _tier = 'all') {
  const g = store.guild(guildId);
  g.shop ||= {};
  const stock = {};
  for (const item of baseCatalog()) {
    const min = Math.max(1, Number(item.minStock || 1));
    const max = Math.max(min, Number(item.maxStock || min));
    stock[item.id] = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  g.shop.market = {
    generatedAt: Date.now(),
    expiresAt: Date.now() + Math.max(15, Number(process.env.SHOP_REFRESH_MINUTES || 120)) * 60000,
    stock
  };
  store.save();
  return g.shop.market;
}

function state(guildId, tier = 'all') {
  const market = ensureMarket(guildId);
  if (tier === 'all' || tier === 'market') return market;
  const items = loadCatalog(tier).map(item => ({ ...item, stock: Number(market.stock[item.id] || 0) }));
  return { generatedAt: market.generatedAt, expiresAt: market.expiresAt, items };
}

function tierDiscount(tier) {
  if (tier === 'elite') return Number(process.env.SHOP_ELITE_DISCOUNT_PERCENT || 20);
  if (tier === 'plus') return Number(process.env.SHOP_PLUS_DISCOUNT_PERCENT || 15);
  if (tier === 'premium') return Number(process.env.SHOP_PREMIUM_DISCOUNT_PERCENT || 10);
  return 0;
}

function discountPercent(interaction, item = null) {
  const tier = premium.tierFor(interaction.guildId, interaction.user.id, interaction.guild);
  let pct = Math.max(0, Math.min(50, tierDiscount(tier)));
  if (item?.effect === 'xp_grant') pct = Math.min(pct, Number(process.env.SHOP_XP_MAX_DISCOUNT_PERCENT || 5));
  return pct;
}

function effectivePrice(interaction, item) {
  const pct = discountPercent(interaction, item);
  const base = Math.max(1, Number(item.price || 1));
  const price = Math.max(1, Math.floor(base * (1 - pct / 100)));
  return { base, price, discount: pct };
}

function unlocked(item, user) {
  return Number(user.level || 1) >= Number(item.minLevel || 1);
}

function browse(interaction, mode = 'buy', page = 0, perPage = 4) {
  const user = store.user(interaction.guildId, interaction.user.id);
  const market = ensureMarket(interaction.guildId);
  let rows;

  if (mode === 'sell') {
    rows = Object.entries(user.inventory || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, qty]) => {
        const item = catalogItem(id);
        if (!item) return null;
        return { item, qty: Number(qty), stock: Number(market.stock[id] || 0), sellPrice: Math.max(1, Number(item.sellPrice || item.price * 0.5)) };
      })
      .filter(Boolean)
      .sort((a, b) => b.sellPrice - a.sellPrice || a.item.name.localeCompare(b.item.name));
  } else {
    rows = baseCatalog()
      .filter(item => unlocked(item, user))
      .map(item => {
        const pricing = effectivePrice(interaction, item);
        return { item, stock: Number(market.stock[item.id] || 0), ...pricing };
      });
  }

  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  page = Math.max(0, Math.min(Number(page) || 0, pages - 1));
  const items = rows.slice(page * perPage, page * perPage + perPage);
  const nextLocked = baseCatalog().find(item => !unlocked(item, user)) || null;

  return {
    mode,
    page,
    pages,
    total: rows.length,
    items,
    user,
    nextLocked,
    expiresAt: market.expiresAt,
    tier: premium.tierFor(interaction.guildId, interaction.user.id, interaction.guild),
    discount: discountPercent(interaction)
  };
}

function findCurrent(guildId, id) {
  const item = catalogItem(id);
  if (!item) return null;
  const market = ensureMarket(guildId);
  return { tier: 'market', item: { ...item, stock: Number(market.stock[id] || 0) }, state: market };
}

function addItem(user, id, qty = 1) {
  user.inventory ||= {};
  user.inventory[id] = Number(user.inventory[id] || 0) + Number(qty || 0);
  if (user.inventory[id] <= 0) delete user.inventory[id];
}

function debitCoins(user, amount) {
  let remaining = Math.max(0, Math.floor(Number(amount || 0)));
  const total = Number(user.wallet || 0) + Number(user.bank || 0);
  if (total < remaining) throw new Error('You do not have enough wallet + bank coins for this purchase.');
  const walletSpent = Math.min(Number(user.wallet || 0), remaining);
  user.wallet -= walletSpent;
  remaining -= walletSpent;
  const bankSpent = Math.min(Number(user.bank || 0), remaining);
  user.bank -= bankSpent;
  remaining -= bankSpent;
  return { walletSpent, bankSpent };
}

function buy(interaction, id, qty) {
  const found = findCurrent(interaction.guildId, id);
  if (!found) throw new Error('That item does not exist in the Astrix Market.');
  const user = store.user(interaction.guildId, interaction.user.id);
  const item = catalogItem(id);
  if (!unlocked(item, user)) throw new Error(`**${item.name}** unlocks at Level ${item.minLevel}.`);

  qty = Math.max(1, Math.min(100, Math.floor(Number(qty || 1))));
  if (Number(found.state.stock[id] || 0) < qty) throw new Error('Not enough market stock remains.');
  const maxOwned = Math.max(0, Math.floor(Number(item.maxOwned || 0)));
  if (maxOwned && Number(user.inventory[id] || 0) + qty > maxOwned) {
    throw new Error(`You can own at most **${maxOwned}** ${item.name}${maxOwned === 1 ? '' : 's'}.`);
  }

  const pricing = effectivePrice(interaction, item);
  const cost = pricing.price * qty;
  if (!Number.isSafeInteger(cost)) throw new Error('That purchase total is too large to process safely.');
  const debit = debitCoins(user, cost);
  found.state.stock[id] -= qty;

  let instant = null;
  if (item.effect === 'xp_grant') {
    const xp = Math.max(1, Math.floor(Number(item.value || 0))) * qty;
    const levels = economy.addXp(user, xp);
    instant = { xp, levels };
  } else {
    addItem(user, id, qty);
  }

  store.save();
  return { ...found, item, cost, qty, pricing, debit, instant };
}

function catalogItem(id) {
  // Keep inventories from the previous Mine Lock version usable after the
  // protection item was split into separate Mine and Lock items.
  const aliases = {
    mine_lock: 'lock',
    astrix_crate: 'only_crate'
  };
  const lookupId = aliases[id] || id;
  return baseCatalog().find(item => item.id === lookupId) || null;
}

function couponDrop(item) {
  const chance = Number(item.couponChance || 0);
  if (chance <= 0 || Math.random() >= chance) return null;
  const pool = Array.isArray(item.couponPool) ? item.couponPool.filter(Boolean) : [];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function use(interaction, id, target) {
  const user = store.user(interaction.guildId, interaction.user.id);
  const canonicalId = id === 'mine_lock' ? 'lock' : id === 'astrix_crate' ? 'only_crate' : id;
  // Migrate the old combined Mine Lock inventory entry when it is used.
  if (canonicalId === 'lock' && (user.inventory.lock || 0) < 1 && (user.inventory.mine_lock || 0) > 0) {
    user.inventory.lock = user.inventory.mine_lock;
    delete user.inventory.mine_lock;
  }
  // Migrate the old crate id without losing user-owned crates.
  if (canonicalId === 'only_crate' && !user.inventory.only_crate && user.inventory.astrix_crate) {
    user.inventory.only_crate = user.inventory.astrix_crate;
    delete user.inventory.astrix_crate;
  }
  if ((user.inventory[canonicalId] || 0) < 1) throw new Error('You do not own that item.');
  const item = catalogItem(canonicalId);
  id = canonicalId;
  if (!item) throw new Error('Item definition not found.');

  if (item.effect === 'crate') {
    const reward = Math.floor(Math.random() * (item.maxReward - item.minReward + 1)) + item.minReward;
    const credit = economy.creditCoins(user, reward);
    const coupon = couponDrop(item);
    if (coupon && catalogItem(coupon)) addItem(user, coupon, 1);
    addItem(user, id, -1);
    store.save();
    const parts = [`You opened **${item.name}** and received **${credit.credited.toLocaleString()} coins**.`];
    if (credit.bankAdded > 0) parts.push(`Wallet was near its limit, so **${credit.bankAdded.toLocaleString()}** went to your bank.`);
    if (credit.uncredited > 0) parts.push(`**${credit.uncredited.toLocaleString()} coins** could not be stored because both limits are full.`);
    if (coupon) parts.push(`🎟️ Lucky drop: **${catalogItem(coupon)?.name || coupon}**!`);
    return { text: parts.join('\n'), coupon, credit };
  }

  if (item.effect === 'wallet_limit_coupon') {
    user.walletLimit += Math.max(1000, Number(item.value || 5000));
    addItem(user, id, -1);
    store.save();
    return { text: `🎟️ **${item.name}** used. Your wallet limit is now **${user.walletLimit.toLocaleString()} coins**.` };
  }

  if (item.effect === 'bank_limit_coupon') {
    user.bankLimit += Math.max(1000, Number(item.value || 5000));
    addItem(user, id, -1);
    store.save();
    return { text: `🎟️ **${item.name}** used. Your bank limit is now **${user.bankLimit.toLocaleString()} coins**.` };
  }

  if (item.effect === 'rob_protection') {
    throw new Error('This old protection item is no longer usable. Buy the separate Lock item instead.');
  }

  if (item.effect === 'rob_lock') {
    user.robLockCharges = Math.min(3, Number(user.robLockCharges || 0) + 1);
    addItem(user, id, -1);
    store.save();
    return { text: `🔒 **${item.name}** activated manually. Your next rob attempt is blocked. Active locks: **${user.robLockCharges}/3**.` };
  }

  if (item.effect === 'rob_mine') {
    if (!target || target.id === interaction.user.id || target.bot) {
      throw new Error('Choose another human target. Example: use **Mine** on a user to plant it.');
    }
    const targetUser = store.user(interaction.guildId, target.id);
    if (targetUser.robMine) throw new Error('That user already has an armed Mine.');
    targetUser.robMine = { armedBy: interaction.user.id, armedAt: Date.now() };
    addItem(user, id, -1);
    store.save();
    return { text: `💣 Mine planted on <@${target.id}>. It will explode on their next robbery attempt.` };
  }

  if (item.effect === 'xp_boost') {
    user.boosts.xp = { multiplier: item.value, until: Date.now() + item.durationMinutes * 60000 };
    addItem(user, id, -1);
    store.save();
    return { text: `**${item.name}** activated for ${item.durationMinutes} minutes.` };
  }

  if (item.effect === 'work_boost') {
    user.boosts.nextWork = item.value;
    addItem(user, id, -1);
    store.save();
    return { text: `**${item.name}** will boost your next completed shift.` };
  }

  if (item.effect === 'work_pass') {
    user.shiftCooldownUntil = 0;
    addItem(user, id, -1);
    store.save();
    return { text: 'Your work shift cooldown has been cleared.' };
  }

  if (item.effect === 'badge') {
    if (!user.badges.includes(item.badge)) user.badges.push(item.badge);
    addItem(user, id, -1);
    store.save();
    return { text: `Profile badge unlocked: **${item.badge}**.` };
  }

  if (id === 'slap') {
    if (!target) throw new Error('Choose a target user when using Slap.');
    if (target.id === interaction.user.id) throw new Error('Choose someone else.');
    addItem(user, id, -1);
    store.save();
    return { text: `✋ <@${interaction.user.id}> used a **Slap** on <@${target.id}>.`, public: true };
  }

  if (item.effect === 'collectible') throw new Error('This is a collectible item and does not need to be used.');
  if (item.effect === 'xp_grant') throw new Error('XP packs are applied instantly when purchased.');
  throw new Error('This item has no usable effect.');
}

function sell(interaction, id, qty) {
  const user = store.user(interaction.guildId, interaction.user.id);
  const item = catalogItem(id);
  if (!item) throw new Error('Unknown item.');
  if (item.effect === 'xp_grant') throw new Error('XP packs are applied instantly and cannot be resold.');
  qty = Math.max(1, Math.min(100, Math.floor(Number(qty || 1))));
  if ((user.inventory[id] || 0) < qty) throw new Error('You do not own enough of that item.');
  const unit = Math.max(1, Math.floor(Number(item.sellPrice || item.price * 0.5)));
  const value = unit * qty;
  if (!Number.isSafeInteger(value)) throw new Error('That sale total is too large to process safely.');
  if (economy.totalSpace(user) < value) throw new Error('Your wallet and bank do not have enough free capacity for this sale. Increase your limits first.');
  addItem(user, id, -qty);
  const credit = economy.creditCoins(user, value);
  const market = ensureMarket(interaction.guildId);
  market.stock[id] = Math.min(999999, Number(market.stock[id] || 0) + qty);
  store.save();
  return { item, qty, value: credit.credited, unit, credit };
}

function autocomplete(interaction, mode, query = '') {
  const user = store.user(interaction.guildId, interaction.user.id);
  const search = String(query || '').trim().toLowerCase();
  let items;
  if (mode === 'sell') {
    items = Object.entries(user.inventory || {}).filter(([, qty]) => Number(qty) > 0).map(([id]) => catalogItem(id)).filter(Boolean);
  } else {
    items = baseCatalog().filter(item => unlocked(item, user));
  }
  return items
    .filter(item => !search || item.name.toLowerCase().includes(search) || item.id.toLowerCase().includes(search))
    .slice(0, 25)
    .map(item => ({ name: `${item.emoji} ${item.name} • L${item.minLevel} • ${item.price.toLocaleString()}`.slice(0, 100), value: item.id }));
}

module.exports = {
  loadCatalog,
  rotate,
  state,
  findCurrent,
  buy,
  use,
  sell,
  catalogItem,
  addItem,
  browse,
  discountPercent,
  effectivePrice,
  autocomplete,
  levelRequirementFromPrice
};
