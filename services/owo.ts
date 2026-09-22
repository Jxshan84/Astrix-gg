const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const store = require('./store.ts');
const economy = require('./economy.ts');
const adventure = require('./adventure.ts');
const shop = require('./shop.ts');
const crates = require('./crates.ts');
const robService = require('./rob.ts');
const privacy = require('./privacy.ts');
const prefixService = require('./prefix.ts');
const economyUpgrade = require('./economy-upgrade.ts');
const ui = require('./ui.ts');
const owoCompat = require('./owo-compat.ts');
const owoCatalog = require('../data/astrix-owo-catalog.json');

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const DAILY_STREAK_WINDOW = 48 * 60 * 60 * 1000;
const HUNT_INTERVAL = Math.max(45_000, Number(process.env.AUTOHUNT_INTERVAL_MS || 45_000));
const MIN_MINE_BET = 10;
const MAX_MINE_BET = 250_000;
const COIN_FLIP_EMOJI = '<a:Cf:1544893738315157555>';
const CATALOG_CANONICAL_COMMANDS = new Set(
  (owoCatalog.aliases || []).map(item => String(item.canonical || '').toLowerCase()).filter(Boolean)
);
const NO_PREFIX_ALIAS_BLOCKLIST = new Set([
  'np', 'zoo', 'bal', 'cash', 'money', 'slot', 'inv', 'lb',
  'gm', 'gn', 'goodmorning', 'goodnight', 'bot', 'p', 'h', 'od', 'dex',
  'market', 'desc', 'q', 'bj', '21'
]);
const activeMines = new Map();

function enabled() {
  return String(process.env.OWO_STYLE_COMMANDS || 'true').toLowerCase() !== 'false';
}

function fmt(amount) {
  return economy.fmt(Math.max(0, Math.floor(Number(amount || 0))));
}

function remaining(until) {
  return Math.max(0, Number(until || 0) - Date.now());
}

function cooldownText(ms) {
  return `<t:${Math.ceil((Date.now() + ms) / 1000)}:R>`;
}

function takeCoins(user, amount) {
  const value = Math.floor(Number(amount || 0));
  const available = Math.floor(Number(user.wallet || 0) + Number(user.bank || 0));
  if (value < 1) throw new Error('Your bet must be at least **1 coin**.');
  if (value > available) throw new Error(`You only have **${fmt(available)}** available.`);
  const walletSpent = Math.min(Number(user.wallet || 0), value);
  user.wallet -= walletSpent;
  const bankSpent = value - walletSpent;
  user.bank = Math.max(0, Number(user.bank || 0) - bankSpent);
  return { walletSpent, bankSpent, amount: value };
}

function getBet(raw, label = 'bet', minimum = 1, maximum = MAX_MINE_BET) {
  const value = Math.floor(Number(raw || 0));
  if (!Number.isFinite(value) || value < minimum) throw new Error(`Enter a ${label} from **${minimum.toLocaleString()}** to **${maximum.toLocaleString()}**.`);
  return value;
}

function gameBet(user, raw, label) {
  const available = Math.floor(Number(user.wallet || 0) + Number(user.bank || 0));
  const requested = String(raw || '').toLowerCase() === 'all'
    ? available
    : Math.floor(Number(raw || 0));
  if (!Number.isFinite(requested) || requested < 1) throw new Error(`Enter a ${label} from **1 coin** or use **all**.`);
  const amount = requested;
  if (amount < 1) throw new Error(`You need at least **1 coin** available to play ${label}.`);
  if (amount > available) throw new Error(`You only have **${fmt(available)}** available.`);
  return amount;
}

function renderCoin(side) {
  const canvas = createCanvas(640, 640);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(235, 190, 30, 320, 320, 340);
  gradient.addColorStop(0, side === 'heads' ? '#fff3a3' : '#d8e7ff');
  gradient.addColorStop(0.55, side === 'heads' ? '#f4bb38' : '#77a9e8');
  gradient.addColorStop(1, side === 'heads' ? '#9a5d12' : '#254e86');
  ctx.fillStyle = '#17151d';
  ctx.fillRect(0, 0, 640, 640);
  ctx.beginPath();
  ctx.arc(320, 320, 250, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 18;
  ctx.strokeStyle = side === 'heads' ? '#ffdc67' : '#a7caff';
  ctx.stroke();
  ctx.fillStyle = '#17151d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 210px sans-serif';
  ctx.fillText(side === 'heads' ? 'H' : 'T', 320, 305);
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(side.toUpperCase(), 320, 485);
  return canvas.toBuffer('image/png');
}

function daily(message) {
  const user = store.user(message.guild.id, message.author.id);
  user.owoDaily ||= { streak: 0, lastClaimAt: 0 };
  const since = Date.now() - Number(user.owoDaily.lastClaimAt || 0);
  if (since < DAILY_COOLDOWN) {
    return message.reply({
      embeds: [ui.embed('💵 Astrix Daily', `You already claimed your daily reward.\n\nCome back ${cooldownText(DAILY_COOLDOWN - since)}.`)]
    });
  }
  const streak = since <= DAILY_STREAK_WINDOW ? Number(user.owoDaily.streak || 0) + 1 : 1;
  const amount = Math.floor(700 + Math.random() * 401) + Math.min(streak, 14) * 25;
  const credit = economy.creditCoins(user, amount);
  const dailyFinds = [];
  if (Math.random() < 0.15) {
    crates.grant(user, 'lootbox', 1);
    dailyFinds.push('📦 1 Astrix Lootbox');
  }
  if (Math.random() < 0.10) {
    crates.grant(user, 'weapon', 1);
    dailyFinds.push('🧰 1 Weapon Crate');
  }
  user.owoDaily = { streak, lastClaimAt: Date.now() };
  store.save();
  return message.reply({
    embeds: [ui.success(
      '💵 Astrix Daily',
      `💰 You received **${fmt(credit.credited)}**!\n` +
      `🔥 Daily streak: **${streak}**\n` +
       `⏱️ Next daily: ${cooldownText(DAILY_COOLDOWN)}${credit.uncredited ? `\n⚠️ **${fmt(credit.uncredited)}** could not fit in your wallet or bank.` : ''}${dailyFinds.length ? `\n🎁 Daily finds: **${dailyFinds.join(' • ')}**` : ''}`
    )]
  });
}

async function coinflip(message, amountToken, choice, title = '🪙 Astrix Coinflip') {
  const user = store.user(message.guild.id, message.author.id);
  const bet = gameBet(user, amountToken, 'Coinflip bet');
  const debit = takeCoins(user, bet);
  const selected = ['heads', 'head', 'h', 'tails', 'tail', 't'].includes(String(choice || '').toLowerCase())
    ? (['heads', 'head', 'h'].includes(String(choice || '').toLowerCase()) ? 'heads' : 'tails')
    : null;
  const guessed = selected || (Math.random() < 0.5 ? 'heads' : 'tails');
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const spinning = await message.reply({
    content: `${COIN_FLIP_EMOJI} **Flipping the coin…**\nBet: **${fmt(bet)}** coins`,
    allowedMentions: { repliedUser: false }
  });
  await new Promise(resolve => setTimeout(resolve, 900));
  const resultLabel = result === 'heads' ? 'Heads' : 'Tails';
  const guessLabel = guessed === 'heads' ? 'Heads' : 'Tails';
  const finishFlip = payload => spinning.edit(payload).catch(() => message.channel.send(payload));
  if (result === guessed) {
    const payout = economy.creditGamePayout(user, bet * 2);
    store.save();
    return finishFlip({
      content: `${COIN_FLIP_EMOJI} **YOU WON!**\nThe coin landed on **${resultLabel}**.\nYour guess: **${guessLabel}**${selected ? '' : ' *(automatic guess)*'}\nBet: **${fmt(bet)}** coins`,
      embeds: [ui.success(title, `✅ **Win**\n\nCoin result: **${resultLabel}**\nGuess: **${guessLabel}**${selected ? '' : ' *(automatic)*'}\nProfit: **+${fmt(payout.credited - bet)}**\nTotal payout: **${fmt(payout.credited)}**`)],
      files: [new AttachmentBuilder(renderCoin(result), { name: `astrix-coin-${result}.png` })],
      allowedMentions: { repliedUser: false }
    });
  }
  store.save();
  return finishFlip({
    content: `${COIN_FLIP_EMOJI} **YOU LOST.**\nThe coin landed on **${resultLabel}**.\nYour guess: **${guessLabel}**${selected ? '' : ' *(automatic guess)*'}\nBet lost: **${fmt(debit.amount)}** coins`,
    embeds: [ui.error(title, `❌ **Loss**\n\nCoin result: **${resultLabel}**\nGuess: **${guessLabel}**${selected ? '' : ' *(automatic)*'}\nYou lost: **${fmt(debit.amount)}** coins`)],
    files: [new AttachmentBuilder(renderCoin(result), { name: `astrix-coin-${result}.png` })],
    allowedMentions: { repliedUser: false }
  });
}

function gamble(message, args) {
  const action = String(args[0] || '').toLowerCase();
  if (action === 'limit' || action === 'limits') {
    return message.reply({
      embeds: [ui.embed('🎲 Astrix Gamble Limits', `All betting games use coins.\nMines only: minimum **${MIN_MINE_BET} coins**, maximum **${MAX_MINE_BET.toLocaleString()} coins**.\nOther games have no 250,000 cap and can use any amount available in your wallet/bank.\n\nUse **coinflip <amount|all> [heads|tails]**, **slots <amount|all>**, **roulette <amount|all> [red|black|green]**, or **dice <amount|all>**.`)]
    });
  }
  const amount = action === 'bet' ? args[1] : args[0];
  const choice = action === 'bet' ? args[2] : args[1];
  return coinflip(message, amount, choice, '🎲 Astrix Gamble');
}

function boardRows(game, finished = false) {
  const rows = [];
  for (let row = 0; row < 3; row++) {
    const buttons = [];
    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      const revealed = game.revealed.has(index);
      const isMine = game.mines.has(index);
      const button = new ButtonBuilder()
        .setCustomId(`owo:mine:${game.guildId}:${game.userId}:${game.id}:${index}`)
        .setStyle(revealed ? (isMine ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Secondary)
        .setLabel(finished || revealed ? (isMine ? '💥' : '💎') : '?')
        .setDisabled(finished || revealed);
      buttons.push(button);
    }
    rows.push(new ActionRowBuilder().addComponents(buttons));
  }
  const cashout = new ButtonBuilder()
    .setCustomId(`owo:minecash:${game.guildId}:${game.userId}:${game.id}`)
    .setLabel(`💵 Cash Out ${fmt(game.payout)}`)
    .setStyle(ButtonStyle.Success)
    .setDisabled(finished || game.revealed.size === 0);
  rows.push(new ActionRowBuilder().addComponents(cashout));
  return rows;
}

function mineEmbed(game, state = 'started') {
  const status = state === 'lost'
    ? '💥 You touched a mine and lost your bet.'
    : state === 'won'
      ? `💵 You cashed out **${fmt(game.payout)}**.`
      : state === 'cleared'
        ? `🏆 You cleared the board and won **${fmt(game.payout)}**.`
        : 'Choose a tile. Safe tiles increase your cash-out.';
  return ui.embed(
    state === 'started' ? '💣 Astrix Mines' : `💣 Astrix Mines • ${state === 'lost' ? 'Boom' : 'Complete'}`,
    `👤 <@${game.userId}>\n\n` +
    `Bet: **${fmt(game.bet)}** • Mines: **${game.mineCount}**\n` +
    `Cash Out: **${fmt(game.payout)}** • Next: **${fmt(game.nextPayout)}**\n\n` +
    `${status}`
  );
}

function startMine(message, args) {
  const key = `${message.guild.id}:${message.author.id}`;
  if (activeMines.has(key)) throw new Error('You already have an active Mines game. Finish it or cash out first.');
  const user = store.user(message.guild.id, message.author.id);
  const requested = String(args[0] || '').toLowerCase() === 'all'
    ? Number(user.wallet || 0) + Number(user.bank || 0)
    : getBet(args[0], 'Mines amount', MIN_MINE_BET, MAX_MINE_BET);
  const bet = Math.min(requested, MAX_MINE_BET);
  if (bet < MIN_MINE_BET) throw new Error(`You need at least **${MIN_MINE_BET} coins** available to play Mines.`);
  const mineCount = Math.max(1, Math.min(7, Math.floor(Number(args[1] || 3))));
  takeCoins(user, bet);
  const mines = new Set();
  while (mines.size < mineCount) mines.add(Math.floor(Math.random() * 9));
  const game = {
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 10_000).toString(36)}`,
    key,
    guildId: message.guild.id,
    userId: message.author.id,
    bet,
    mineCount,
    mines,
    revealed: new Set(),
    payout: 0,
    nextPayout: Math.floor(bet * 1.36)
  };
  activeMines.set(key, game);
  store.save();
  return message.reply({ embeds: [mineEmbed(game)], components: boardRows(game) });
}

function finishMine(game, state) {
  activeMines.delete(game.key);
  if (state !== 'lost') {
    const user = store.user(game.guildId, game.userId);
    economy.creditGamePayout(user, state === 'cleared' ? game.nextPayout : game.payout);
    store.save();
  }
  return { embeds: [mineEmbed(game, state)], components: boardRows(game, true) };
}

async function mineButton(interaction) {
  const parts = String(interaction.customId).split(':');
  const guildId = parts[2], userId = parts[3], id = parts[4], index = Number(parts[5]);
  if (interaction.user.id !== userId) return interaction.reply({ content: 'This Mines game belongs to another player.', ephemeral: true });
  const game = activeMines.get(`${guildId}:${userId}`);
  if (!game || game.id !== id) return interaction.reply({ content: 'This Mines game has expired. Start a new one with `mine <bet>`.', ephemeral: true });
  if (!Number.isInteger(index) || index < 0 || index > 8) return interaction.reply({ content: 'That tile is invalid.', ephemeral: true });
  game.revealed.add(index);
  if (game.mines.has(index)) return interaction.update(finishMine(game, 'lost'));
  const safeTiles = 9 - game.mineCount;
  if (game.revealed.size >= safeTiles) return interaction.update(finishMine(game, 'cleared'));
  game.payout = game.nextPayout;
  game.nextPayout = Math.floor(game.bet * (1 + (game.revealed.size + 1) * 0.36));
  return interaction.update({ embeds: [mineEmbed(game)], components: boardRows(game) });
}

async function mineCashout(interaction) {
  const parts = String(interaction.customId).split(':');
  const guildId = parts[2], userId = parts[3], id = parts[4];
  if (interaction.user.id !== userId) return interaction.reply({ content: 'This Mines game belongs to another player.', ephemeral: true });
  const game = activeMines.get(`${guildId}:${userId}`);
  if (!game || game.id !== id) return interaction.reply({ content: 'This Mines game has expired.', ephemeral: true });
  if (!game.revealed.size) return interaction.reply({ content: 'Reveal one safe tile before cashing out.', ephemeral: true });
  return interaction.update(finishMine(game, 'won'));
}

function timedReward(message, key, wait, title, min, max) {
  const user = store.user(message.guild.id, message.author.id);
  const left = remaining(user.cooldowns[key]);
  if (left) throw new Error(`You can use this again ${cooldownText(left)}.`);
  user.cooldowns[key] = Date.now() + wait;
  const amount = Math.floor(min + Math.random() * (max - min + 1));
  const credit = economy.creditCoins(user, amount);
  store.save();
  return message.reply({
    embeds: [ui.success(title, `💰 You received **${fmt(credit.credited)}**!\nNext reward: ${cooldownText(wait)}${credit.uncredited ? `\n⚠️ **${fmt(credit.uncredited)}** could not fit in your wallet or bank.` : ''}`)]
  });
}

function weekly(message) {
  return timedReward(message, 'owo_weekly', 7 * 24 * 60 * 60 * 1000, '📅 Astrix Weekly', 4500, 8500);
}

function work(message) {
  return timedReward(message, 'owo_work', 15 * 60 * 1000, '💼 Astrix Work', 250, 950);
}

async function slots(message, args) {
  const user = store.user(message.guild.id, message.author.id);
  const bet = gameBet(user, args[0], 'Slots bet');
  const debit = takeCoins(user, bet);
  const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
  const reels = [0, 0, 0].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
  const spinning = await message.reply({ content: `${COIN_FLIP_EMOJI} 🎰 **Spinning the slots…**`, allowedMentions: { repliedUser: false } });
  await new Promise(resolve => setTimeout(resolve, 850));
  const triple = reels[0] === reels[1] && reels[1] === reels[2];
  const pair = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
  const multiplier = triple ? (reels[0] === '7️⃣' ? 10 : reels[0] === '💎' ? 5 : 3) : pair ? 1 : 0;
  const payout = multiplier ? economy.creditGamePayout(user, bet * multiplier) : { credited: 0 };
  store.save();
  return spinning.edit({
    content: '🎰 **Astrix Slots**',
    embeds: [multiplier
      ? ui.success('🎰 Astrix Slots', `${reels.join('  |  ')}\n\nYou hit a ${multiplier}× combination. Profit: **${fmt(payout.credited - bet)}**.`)
      : ui.error('🎰 Astrix Slots', `${reels.join('  |  ')}\n\nNo match — you lost **${fmt(debit.amount)}**.`)],
    allowedMentions: { repliedUser: false }
  });
}

function roulette(message, args) {
  const first = String(args[0] || '').toLowerCase();
  const second = String(args[1] || '').toLowerCase();
  const choice = ['red', 'black', 'green'].includes(first) ? first : ['red', 'black', 'green'].includes(second) ? second : null;
  const amountToken = ['red', 'black', 'green'].includes(first) ? second : first;
  const user = store.user(message.guild.id, message.author.id);
  const bet = gameBet(user, amountToken, 'Roulette bet');
  const debit = takeCoins(user, bet);
  const roll = Math.random();
  const result = roll < 0.08 ? 'green' : roll < 0.54 ? 'red' : 'black';
  const guess = choice || (Math.random() < 0.5 ? 'red' : 'black');
  if (result === guess) {
    const payout = economy.creditGamePayout(user, bet * (result === 'green' ? 14 : 2));
    store.save();
    return message.reply({ embeds: [ui.success('🎡 Astrix Roulette', `The wheel landed on **${result}**.\n\nYou won **${fmt(payout.credited - bet)}** profit.`)] });
  }
  store.save();
  return message.reply({ embeds: [ui.error('🎡 Astrix Roulette', `The wheel landed on **${result}**.\n\nYou lost **${fmt(debit.amount)}**.`)] });
}

function dice(message, args) {
  const user = store.user(message.guild.id, message.author.id);
  const bet = gameBet(user, args[0], 'Dice bet');
  const debit = takeCoins(user, bet);
  const roll = 1 + Math.floor(Math.random() * 6);
  if (roll >= 4) {
    const payout = economy.creditGamePayout(user, bet * 2);
    store.save();
    return message.reply({ embeds: [ui.success('🎲 Astrix Dice', `You rolled **${roll}** and won **${fmt(payout.credited - bet)}** profit.`)] });
  }
  store.save();
  return message.reply({ embeds: [ui.error('🎲 Astrix Dice', `You rolled **${roll}** and lost **${fmt(debit.amount)}**.`)] });
}

function profile(message) {
  const target = message.mentions?.users?.first?.() || message.author;
  const user = store.user(message.guild.id, target.id);
  return message.reply({ embeds: [ui.embed(`👤 ${target.username}'s Astrix Profile`,
    `Level: **${user.level}** • XP: **${user.xp}**\n` +
    `Wallet: **${fmt(user.wallet)}**\nBank: **${fmt(user.bank)}**\n` +
    `Net worth: **${fmt(Number(user.wallet || 0) + Number(user.bank || 0))}**\n` +
    `Hunts: **${Number(user.quests?.hunt || 0)}** • Daily streak: **${Number(user.owoDaily?.streak || 0)}**`)] });
}

function leaderboard(message) {
  const users = store.allUsers(message.guild.id);
  const rows = Object.entries(users)
    .map(([id, user]) => {
      const account = user as any;
      return { id, total: Number(account.wallet || 0) + Number(account.bank || 0) };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const text = rows.map((row, index) => `${index + 1}. <@${row.id}> — **${fmt(row.total)}**`).join('\n') || 'No economy users yet.';
  return message.reply({ embeds: [ui.embed('🏆 Astrix Leaderboard', text)] });
}

function social(message, command, args) {
  const target = message.mentions?.users?.first?.();
  if (command === 'choose') {
    const options = args.join(' ').split(',').map(value => value.trim()).filter(Boolean);
    if (options.length < 2) throw new Error('Give at least two choices separated by commas.');
    return message.reply({ embeds: [ui.embed('🤔 Astrix Choose', `I choose **${options[Math.floor(Math.random() * options.length)]}**.`)] });
  }
  if (command === 'rate') return message.reply({ embeds: [ui.embed('⭐ Astrix Rate', `**${args.join(' ') || 'That'}** → **${Math.floor(Math.random() * 101)}/100**`)] });
  if (command === 'ship') {
    if (!target) throw new Error('Mention someone to ship with.');
    return message.reply({ embeds: [ui.embed('💞 Astrix Ship', `<@${message.author.id}> + <@${target.id}> → **${Math.floor(Math.random() * 101)}%** compatibility.`)] });
  }
  if (command === '8ball') {
    const answers = ['Yes.', 'No.', 'Maybe.', 'Very likely.', 'Ask again later.', 'The stars say yes.'];
    return message.reply({ embeds: [ui.embed('🎱 Astrix 8-Ball', `Question: **${args.join(' ') || 'Will it work?'}**\nAnswer: **${answers[Math.floor(Math.random() * answers.length)]}**`)] });
  }
  if (command === 'curse' || command === 'pray') {
    return message.reply({ embeds: [ui.embed(command === 'pray' ? '🙏 Astrix Pray' : '🌀 Astrix Curse', target ? `<@${target.id}> has been ${command === 'pray' ? 'blessed' : 'cursed'} by fate.` : `You have been ${command === 'pray' ? 'blessed' : 'cursed'} by fate.`)] });
  }
  if (command === 'crime') return message.reply({ embeds: [Math.random() < 0.48 ? ui.success('🕶️ Astrix Crime', 'The crime worked. You escaped with a mysterious reward.') : ui.error('🚓 Astrix Crime', 'The police caught you. Better luck next time.')] });
  if (command === 'battle') {
    if (!target) throw new Error('Mention another player to battle.');
    const won = Math.random() < 0.5;
    return message.reply({ embeds: [ui.embed('⚔️ Astrix Battle', `${won ? `<@${message.author.id}> wins` : `<@${target.id}> wins`} the friendly battle.`)] });
  }
  return false;
}

async function autoHunt(message, args) {
  const user = store.user(message.guild.id, message.author.id);
  const action = String(args[0] || 'status').toLowerCase();
  user.autoHunt ||= { enabled: false, channelId: null, nextAt: 0 };
  if (['on', 'start', 'enable'].includes(action)) {
    user.autoHunt = { enabled: true, channelId: message.channel.id, nextAt: Date.now() + HUNT_INTERVAL };
    store.save();
    return message.reply({ embeds: [ui.success('🤖 Astrix AutoHunt', `AutoHunt is now **enabled** in this channel.\nAstrix will hunt every **${Math.round(HUNT_INTERVAL / 1000)} seconds**.\n\nUse **autohunt off** to stop it.`)] });
  }
  if (['off', 'stop', 'disable'].includes(action)) {
    user.autoHunt.enabled = false;
    user.autoHunt.nextAt = 0;
    store.save();
    return message.reply({ embeds: [ui.success('🤖 Astrix AutoHunt', 'AutoHunt is now **disabled**.')] });
  }
  return message.reply({
    embeds: [ui.embed('🤖 Astrix AutoHunt', user.autoHunt.enabled
      ? `Status: **Enabled**\nChannel: <#${user.autoHunt.channelId}>\nNext hunt: ${user.autoHunt.nextAt > Date.now() ? cooldownText(user.autoHunt.nextAt - Date.now()) : 'starting soon'}`
      : 'Status: **Disabled**\n\nUse **autohunt on** to let Astrix hunt collectible creatures automatically.')]
  });
}

function balance(message) {
  const target = message.mentions?.users?.first?.() || message.author;
  const user = store.user(message.guild.id, target.id);
  return message.reply({
    embeds: [ui.embed(`💰 ${target.username}'s Balance`, `Wallet: **${fmt(user.wallet)}**\nBank: **${fmt(user.bank)}**\nNet worth: **${fmt(Number(user.wallet || 0) + Number(user.bank || 0))}**\nAstrix Gems: **💎 ${Number(user.premiumGems || 0).toLocaleString()}**`)]
  });
}

function inventory(message) {
  const user = store.user(message.guild.id, message.author.id);
  const items = Object.entries(user.inventory || {})
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => `${shop.catalogItem(id)?.emoji || '📦'} **${shop.catalogItem(id)?.name || id}** × ${quantity}`)
    .join('\n');
  return message.reply({
    embeds: [ui.embed('🎒 Astrix Inventory', `📦 **Only Crates:** ${Number(user.crates || 0)}\n${items || 'Your inventory is empty.'}`)]
  });
}

async function useItem(message, args) {
  const itemId = String(args[0] || '').toLowerCase();
  if (!itemId) return inventory(message);
  const user = store.user(message.guild.id, message.author.id);
  if (['only_crate', 'astrix_crate', 'crate', 'crates'].includes(itemId)) {
    const result = crates.open(message.guild.id, message.author.id, 1);
    return message.reply({ embeds: [ui.success('📦 Only Crate Opened', `${crates.formatResults(result.results)}\n\nCrates remaining: **${result.crates}**`)] });
  }
  const target = message.mentions?.users?.first?.();
  const result = shop.use({ guildId: message.guild.id, user: message.author }, itemId, target);
  return message.reply({ embeds: [ui.success('✅ Item Used', result.text)] });
}

async function runAdventure(message, action) {
  if (await privacy.promptMessage(message)) return true;
  await adventure.prefix(message, action);
  return true;
}

async function runRob(message) {
  if (await privacy.promptMessage(message)) return true;
  const target = message.mentions?.users?.first?.();
  if (!target || target.bot) throw new Error('Mention a human user. Example: `rob @user`.');
  const result = robService.rob(message.guild.id, message.author.id, target.id);
  if (result.protected && result.protection === 'lock') {
    await message.reply({ embeds: [ui.error('🔒 Rob Failed', `<@${target.id}> blocked your robbery with a Lock.`)] });
  } else if (result.protected && result.protection === 'mine') {
    await message.reply({ embeds: [ui.error('💣 BOOM! Rob Failed', `A Mine exploded and you paid **${fmt(result.fine)}** to <@${target.id}>.`)] });
  } else if (result.success) {
    await message.reply({ embeds: [ui.success('💰 Rob Successful', `You stole **${fmt(result.amount)}** from <@${target.id}>.`)] });
  } else {
    await message.reply({ embeds: [ui.error('🚨 Rob Failed', `You paid **${fmt(result.fine)}** to <@${target.id}>.\n\nTry again in **15 minutes**.`)] });
  }
  return true;
}

async function message(message) {
  if (!enabled() || !message.guild || message.author.bot || !message.content) return false;
  const content = message.content.trim();
  const serverPrefix = prefixService.get(message.guild.id);
  if (content.toLowerCase().startsWith(serverPrefix.toLowerCase())) return false;
  // Bare OwO-style commands are a premium no-prefix surface. Explicit
  // `astrix <command>` commands are handled by the normal prefix dispatcher.
  if (!prefixService.hasNoPrefix(message.guild.id, message.author.id)
    || !prefixService.hasPremiumNoPrefix(message.guild.id, message.author.id, message.guild)) return false;
  const tokens = content.split(/\s+/);
  const keyword = String(tokens[0] || '').toLowerCase().replace(/[,:]$/, '');
  if (keyword === 'astrix') tokens.shift();
  const [raw, ...args] = tokens;
  let command = String(raw || '').toLowerCase();
  if (command === 'cf') command = 'coinflip';
  // The no-prefix surface intentionally accepts canonical command names only.
  // Imported OwO aliases are not dispatched here; users must use the exact
  // Astrix command name shown by help.
  const supported = new Set([
    'help', 'balance', 'daily', 'weekly', 'work', 'profile', 'coinflip',
    'gamble', 'mine', 'slots', 'roulette', 'dice', 'hunt', 'autohunt', 'fish',
    'dig', 'beg', 'search', 'collection', 'quests', 'achievements',
    'inventory', 'use', 'rob', 'give', 'leaderboard', 'choose', 'rate', 'ship',
    'pray', 'curse', 'crime', 'battle', '8ball'
  ]);
  if (!supported.has(command)) {
    // Keep imported canonical commands available, but never let their short
    // aliases become no-prefix triggers.
    if (!CATALOG_CANONICAL_COMMANDS.has(command) || NO_PREFIX_ALIAS_BLOCKLIST.has(command)) return false;
    return owoCompat.message(message, command, args);
  }
  if (['coinflip', 'gamble', 'mine', 'slots', 'roulette', 'dice', 'hunt', 'autohunt', 'fish', 'dig', 'beg', 'search', 'rob', 'use', 'give', 'crime', 'battle'].includes(command)) {
    if (await privacy.promptMessage(message)) return true;
  }
  if (command === 'help') {
    return message.reply({ embeds: [ui.embed('✨ Astrix Economy Help', '**Premium no-prefix economy commands**\n\n**Economy:** `daily` • `weekly` • `work` • `balance` • `profile` • `leaderboard` • `give @user 100`\n**Market:** `shop` • `buy <item>` • `sell <item>` • `lootbox` • `blackjack`\n**Games:** `coinflip all heads` • `coinflip all tails` • `gamble bet limit` • `mine 100` • `slots all` • `roulette all red` • `dice all`\n**Mines rule:** amount is accepted by `mine` from **10** to **250,000** coins. `mine all` is capped at **250,000**.\n**Other games:** coins are deducted too; their bet has no 250,000 cap and `all` uses the full available balance.\n**Adventure:** `hunt` • `autohunt on` • `fish` • `dig` • `beg` • `search` • `collection`\n**Items:** `inventory` • `use crate` • `rob @user`\n**Fun/social:** `choose tea, coffee` • `rate me` • `ship @user` • `pray` • `curse @user` • `crime` • `battle @user` • `8ball`')] });
  }
  if (command === 'balance') return balance(message);
  if (command === 'daily') return daily(message);
  if (command === 'weekly') return weekly(message);
  if (command === 'work') return work(message);
  if (command === 'profile') return profile(message);
  if (command === 'coinflip') return economyUpgrade.playCoinflip(message, args[0], args[1]);
  if (command === 'gamble') return gamble(message, args);
  if (command === 'mine') return startMine(message, args);
  if (command === 'slots') return slots(message, args);
  if (command === 'roulette') return roulette(message, args);
  if (command === 'dice') return dice(message, args);
  if (command === 'autohunt') return autoHunt(message, args);
  if (['hunt', 'fish', 'dig', 'beg', 'search', 'collection', 'quests', 'achievements'].includes(command)) {
    return runAdventure(message, command);
  }
  if (command === 'inventory') return inventory(message);
  if (command === 'use') return useItem(message, args);
  if (command === 'rob') return runRob(message);
  if (command === 'give') return economyUpgrade.startTransfer(message, args);
  if (command === 'leaderboard') return leaderboard(message);
  if (['choose', 'rate', 'ship', 'pray', 'curse', 'crime', 'battle', '8ball'].includes(command)) return social(message, command, args);
  return false;
}

async function tick(client) {
  const now = Date.now();
  let processed = 0;
  for (const guild of client.guilds.cache.values()) {
    if (processed >= 25) break;
    const users = store.allUsers(guild.id);
    for (const userId of Object.keys(users)) {
      if (processed >= 25) break;
      const user = store.user(guild.id, userId);
      if (!user.autoHunt?.enabled || Number(user.autoHunt.nextAt || 0) > now) continue;
      user.autoHunt.nextAt = now + HUNT_INTERVAL;
      processed++;
      const channel = await guild.channels.fetch(user.autoHunt.channelId).catch(() => null);
      if (!channel?.isTextBased?.()) continue;
      const discordUser = await client.users.fetch(userId).catch(() => null);
      if (!discordUser) continue;
      await adventure.run({
        guildId: guild.id,
        user: discordUser,
        reply: payload => channel.send(payload)
      }, 'hunt').catch(() => {});
    }
  }
  if (processed) store.save();
}

module.exports = { message, button: mineButton, cashout: mineCashout, tick };