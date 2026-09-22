const {
  PermissionFlagsBits
} = require('discord.js');
const catalog = require('../data/astrix-owo-catalog.json');
const store = require('./store.ts');
const economy = require('./economy.ts');
const adventure = require('./adventure.ts');
const shop = require('./shop.ts');
const crates = require('./crates.ts');
const prefixService = require('./prefix.ts');
const fun = require('./fun.ts');
const ui = require('./ui.ts');

const entries = new Map<string, any>((catalog.aliases || []).map((item: any) => [String(item.alias).toLowerCase(), item]));
const ADMIN_BLOCKED = new Set([
  'eval', 'broadcasteval', 'resetowo', 'resetbot', 'deleteuser', 'msgusers',
  'sendverif', 'pausebot', 'restartbot', 'transaction', 'giveall'
]);
const ADMIN_FORWARDABLE = new Set([
  'ban', 'kick', 'warn', 'mute', 'unmute', 'timeout', 'untimeout', 'purge',
  'clear', 'role', 'unrole', 'lock', 'unlock'
]);

function entryFor(command) {
  return entries.get(String(command || '').toLowerCase()) || null;
}

function fmt(amount) {
  return economy.fmt(Math.max(0, Math.floor(Number(amount || 0))));
}

function gameBet(user, raw, label) {
  const available = Math.floor(Number(user.wallet || 0) + Number(user.bank || 0));
  const requested = String(raw || '').toLowerCase() === 'all'
    ? available
    : Math.floor(Number(raw || 0));
  if (!Number.isFinite(requested) || requested < 1) throw new Error(`Use \`${label} <amount|all>\`.`);
  const amount = requested;
  if (amount > available) throw new Error(`You only have **${fmt(available)}** available.`);
  return amount;
}

function cooldown(user, key, ms) {
  const remaining = Math.max(0, Number(user.cooldowns?.[key] || 0) - Date.now());
  if (remaining) throw new Error(`Try again ${cooldownText(remaining)}.`);
  user.cooldowns[key] = Date.now() + ms;
}

function cooldownText(ms) {
  return `<t:${Math.ceil((Date.now() + ms) / 1000)}:R>`;
}

function hasAdminAccess(message) {
  return Boolean(
    message.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    (process.env.BOT_OWNER_ID && String(process.env.BOT_OWNER_ID) === String(message.author.id))
  );
}

async function forwardAdmin(message, command, args) {
  if (!hasAdminAccess(message)) throw new Error('Administrator permission is required for this Astrix admin command.');
  if (ADMIN_BLOCKED.has(command)) {
    return message.reply({
      embeds: [ui.error('🔒 Astrix Admin Safety', `\`${command}\` is not exposed through text aliases because it can delete data, execute code, or message users. Use Astrix’s secured owner/dashboard command instead.`)]
    });
  }
  if (!ADMIN_FORWARDABLE.has(command)) {
    return message.reply({
      embeds: [ui.embed('🛡️ Astrix Admin Commands', `\`${command}\` is present in the imported catalog, but this legacy OwO-only action has no safe Astrix equivalent yet.\n\nUse an Astrix slash command with the same purpose or ask for a dedicated adapter.`)]
    });
  }
  const prefix = prefixService.get(message.guild.id);
  const proxy = Object.create(message);
  Object.defineProperty(proxy, 'content', {
    configurable: true,
    value: `${prefix}${command}${args.length ? ` ${args.join(' ')}` : ''}`
  });
  return prefixService.message(proxy);
}

function claim(message, command) {
  const user = store.user(message.guild.id, message.author.id);
  const wait = command === 'claim' ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  cooldown(user, `astrix_${command}`, wait);
  const credit = economy.creditCoins(user, command === 'claim' ? 400 : 250);
  store.save();
  return message.reply({
    embeds: [ui.success(`💰 Astrix ${command}`, `You received **${fmt(credit.credited)}**.\nNext claim: ${cooldownText(wait)}`)]
  });
}

async function blackjack(message, args) {
  const user = store.user(message.guild.id, message.author.id);
  const bet = gameBet(user, args[0], 'blackjack');
  const spend = Math.min(Number(user.wallet || 0), bet);
  user.wallet -= spend;
  user.bank = Math.max(0, Number(user.bank || 0) - (bet - spend));
  const player = 12 + Math.floor(Math.random() * 10);
  const dealer = 12 + Math.floor(Math.random() * 10);
  if (player > dealer) {
    const payout = economy.creditGamePayout(user, bet * 2);
    store.save();
    return message.reply({ embeds: [ui.success('🃏 Astrix Blackjack', `You: **${player}** • Dealer: **${dealer}**\nYou won **${fmt(payout.credited - bet)}** profit.`)] });
  }
  if (player === dealer) {
    economy.creditCoins(user, bet);
    store.save();
    return message.reply({ embeds: [ui.embed('🃏 Astrix Blackjack', `You: **${player}** • Dealer: **${dealer}**\nPush — your bet was returned.`)] });
  }
  store.save();
  return message.reply({ embeds: [ui.error('🃏 Astrix Blackjack', `You: **${player}** • Dealer: **${dealer}**\nYou lost **${fmt(bet)}**.`)] });
}

function market(message, command, args) {
  const interaction = { guildId: message.guild.id, user: message.author };
  if (command === 'shop' || command === 'market') {
    const view = shop.browse(interaction, 'buy', 0, 15);
    const text = view.items.map(row => `${row.item.emoji} **${row.item.name}** — ${fmt(row.price)} — \`${row.item.id}\``).join('\n');
    return message.reply({ embeds: [ui.embed('🛒 Astrix Market', text || 'The market is empty right now.')] });
  }
  const itemId = String(args[0] || '').toLowerCase();
  if (!itemId) throw new Error(`Use \`${command} <item>\`.`);
  if (command === 'buy') {
    const result = shop.buy(interaction, itemId, args[1] || 1);
    return message.reply({ embeds: [ui.success('🛒 Astrix Buy', `Bought **${result.qty} × ${result.item.name}** for **${fmt(result.cost)}**.`)] });
  }
  if (command === 'sell') {
    const result = shop.sell(interaction, itemId, args[1] || 1);
    return message.reply({ embeds: [ui.success('💵 Astrix Sell', `Sold **${result.qty} × ${result.item.name}** for **${fmt(result.value)}**.`)] });
  }
  const item = shop.catalogItem(itemId);
  return message.reply({ embeds: [ui.embed('🔎 Astrix Item', item ? `${item.emoji} **${item.name}**\n${item.description}\n\nBuy: **${fmt(item.price)}**\nSell: **${fmt(item.sellPrice)}**` : 'That item is not in the Astrix Market.')] });
}

async function message(message, command, args) {
  const entry = entryFor(command);
  if (!entry) return false;
  const canonical = String(entry.canonical || command).toLowerCase();
  const category = String(entry.category || '').toLowerCase();

  if (category === 'admin') return forwardAdmin(message, canonical, args);
  if (['claim', 'reward', 'compensation'].includes(canonical)) return claim(message, canonical);
  if (['blackjack', 'bj', '21'].includes(canonical)) return blackjack(message, args);
  if (['shop', 'market', 'buy', 'sell', 'describe', 'desc'].includes(canonical)) return market(message, canonical, args);
  if (['quest', 'q'].includes(canonical)) {
    await adventure.prefix(message, 'quests');
    return true;
  }
  if (['lootbox'].includes(canonical)) {
    const result = crates.open(message.guild.id, message.author.id, 1);
    return message.reply({ embeds: [ui.success('📦 Astrix Lootbox', `${crates.formatResults(result.results)}\n\nCrates remaining: **${result.crates}**`)] });
  }
  if (['owodex', 'od', 'dex', 'd', 'zoo'].includes(canonical)) {
    await adventure.prefix(message, 'collection');
    return true;
  }
  if (['sacrifice', 'essence', 'butcher', 'sac', 'sc'].includes(canonical)) {
    return message.reply({ embeds: [ui.embed('♻️ Astrix Sacrifice', 'Astrix keeps collectibles in your collection. Use `inventory` to manage items; no animal is destroyed by this compatibility command.')] });
  }
  if (['upgrade', 'upg'].includes(canonical)) {
    return message.reply({ embeds: [ui.embed('⬆️ Astrix Upgrade', 'Astrix upgrades are tied to levels, shop items, crates, and collection progress. Use `profile`, `shop`, or `collection` to continue.')] });
  }
  if (['top', 'rank', 'ranking', 'my', 'me', 'guild', 'level', 'lvl', 'levels', 'xp'].includes(canonical)) {
    return message.reply({ embeds: [ui.embed('🏆 Astrix Ranking', 'Use `profile` for your Astrix level and `lb` for the server economy leaderboard.')] });
  }
  if (['drop', 'pickup'].includes(canonical)) {
    await adventure.prefix(message, 'search');
    return true;
  }
  if (['lottery', 'bet', 'lotto'].includes(canonical)) {
    const amount = args[0] || 'all';
    const color = args[1] || 'red';
    const proxy = Object.create(message);
    Object.defineProperty(proxy, 'content', { configurable: true, value: `roulette ${amount} ${color}` });
    const owo = require('./owo.ts');
    return owo.message(proxy);
  }
  if (fun.actionNames().includes(canonical)) {
    await fun.prefix(message, canonical);
    return true;
  }
  if (category === 'zoo') {
    if (['catch', 'hunt', 'h'].includes(canonical)) await adventure.prefix(message, 'hunt');
    else if (['autohunt', 'huntbot', 'hb', 'ah'].includes(canonical)) return message.reply({ embeds: [ui.embed('🤖 Astrix AutoHunt', 'Use `autohunt on`, `autohunt off`, or `autohunt` for status.')] });
    else if (['zoo', 'owodex', 'od', 'dex', 'd'].includes(canonical)) await adventure.prefix(message, 'collection');
    else return message.reply({ embeds: [ui.embed(`🐾 Astrix ${canonical}`, 'This Astrix collection command is available through `hunt`, `collection`, `inventory`, and `use`.')] });
    return true;
  }
  if (category === 'patreon') {
    const user = store.user(message.guild.id, message.author.id);
    cooldown(user, `collector_${canonical}`, 60 * 60 * 1000);
    user.inventory[`astrix:${canonical}`] = Number(user.inventory[`astrix:${canonical}`] || 0) + 1;
    store.save();
    return message.reply({ embeds: [ui.success('✨ Astrix Collector', `You collected **${canonical}** and added it to your Astrix inventory.`)] });
  }
  if (category === 'memegen' || category === 'emotes') {
    return message.reply({ embeds: [ui.embed(`🎨 Astrix ${canonical}`, `Astrix ${canonical} is ready as a fun response. Add a mention or text to customize it.`)] });
  }
  if (category === 'utils' || category === 'ranking' || category === 'points' || category === 'social') {
    return message.reply({ embeds: [ui.embed(`✨ Astrix ${canonical}`, `The imported Astrix alias \`${command}\` is recognized. Use \`help\` to see its Astrix equivalent.`)] });
  }
  if (category === 'battle') {
    return message.reply({ embeds: [ui.embed('⚔️ Astrix Battle', 'Astrix battle data is imported and this alias is registered. Use `battle @user` for the safe Astrix battle flow.')] });
  }
  return message.reply({ embeds: [ui.embed(`✨ Astrix ${canonical}`, `Astrix recognized \`${command}\`, but that legacy command needs a dedicated adapter before it can run safely.`)] });
}

function aliases() {
  return [...entries.keys()];
}

module.exports = { message, entryFor, aliases };