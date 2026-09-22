const crypto = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('./store.ts');
const economy = require('./economy.ts');
const premium = require('./premium.ts');
const ui = require('./ui.ts');

const TRANSFER_TTL_MS = Math.max(15_000, Number(process.env.GIVE_REQUEST_TTL_MS || 60_000));
const COINFLIP_COOLDOWN_MS = Math.max(2_000, Number(process.env.COINFLIP_COOLDOWN_MS || 8_000));

function randomSide() {
  return crypto.randomInt(0, 2) === 0 ? 'heads' : 'tails';
}

function side(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['heads', 'head', 'h'].includes(normalized)) return 'heads';
  if (['tails', 'tail', 't'].includes(normalized)) return 'tails';
  if (!normalized) return null;
  throw new Error('Choose **heads** or **tails**.');
}

function cooldownMs(interactionOrMessage) {
  const guildId = interactionOrMessage.guildId || interactionOrMessage.guild?.id;
  const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
  const tier = premium.tierFor(guildId, userId, interactionOrMessage.guild || null);
  if (tier === 'elite') return Math.max(2_000, Math.floor(COINFLIP_COOLDOWN_MS * 0.5));
  if (tier === 'plus') return Math.max(3_000, Math.floor(COINFLIP_COOLDOWN_MS * 0.7));
  if (tier === 'premium') return Math.max(4_000, Math.floor(COINFLIP_COOLDOWN_MS * 0.85));
  return COINFLIP_COOLDOWN_MS;
}

function checkCooldown(user, now, duration) {
  const until = Number(user.cooldowns?.coinflipUntil || 0);
  if (until > now) {
    throw new Error(`Coin flip cooldown active. Try again <t:${Math.ceil(until / 1000)}:R>.`);
  }
  user.cooldowns ||= {};
  user.cooldowns.coinflipUntil = now + duration;
}

function parseAmount(token, user) {
  const raw = String(token || '').trim().toLowerCase();
  const amount = raw === 'all' ? Number(user.wallet || 0) : Number(raw);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error('Enter a whole-number wager of at least **1 coin**.');
  }
  if (amount > Number(user.wallet || 0)) {
    throw new Error(`You only have **${Math.floor(Number(user.wallet || 0)).toLocaleString()} coins in your wallet**.`);
  }
  return amount;
}

function coinflipPayload(userId, wager, selected, result, payout) {
  const won = selected === result;
  const selectedLabel = selected.toUpperCase();
  const resultLabel = result.toUpperCase();
  return {
    embeds: [won
      ? ui.success('🪙 Coin Flip Result', `<@${userId}>\n\nSelected: **${selectedLabel}**\nResult: **${resultLabel}**\n\n🎉 **YOU WON!**\n\nWager: **${wager.toLocaleString()} coins**\nPayout: **${payout.toLocaleString()} coins**\n💰 **${payout.toLocaleString()} coins** added to your wallet.`)
      : ui.error('🪙 Coin Flip Result', `<@${userId}>\n\nSelected: **${selectedLabel}**\nResult: **${resultLabel}**\n\n💔 **YOU LOST!**\n\nWager: **${wager.toLocaleString()} coins**\nPayout: **0 coins**`)],
    allowedMentions: { users: [userId], repliedUser: false }
  };
}

async function playCoinflip(messageLike, amountToken, selectedToken) {
  const guildId = messageLike.guildId || messageLike.guild?.id;
  const userId = messageLike.user?.id || messageLike.author?.id;
  const user = store.user(guildId, userId);
  const selected = side(selectedToken) || randomSide();
  const wager = parseAmount(amountToken, user);
  checkCooldown(user, Date.now(), cooldownMs(messageLike));

  // The wager is removed before the result is generated. This keeps the
  // wallet state correct even if the result edit or attachment fails.
  user.wallet = Math.max(0, Number(user.wallet || 0) - wager);
  store.save();
  const result = randomSide();
  const initial = {
    embeds: [ui.embed('🪙 Astrix Coin Flip', `<@${userId}> is flipping **${wager.toLocaleString()} coins**...\n\nSelected: **${selected.toUpperCase()}**\n\n🪙 Flipping...`)],
    allowedMentions: { users: [userId], repliedUser: false }
  };
  const sent = await messageLike.reply(initial);
  await new Promise(resolve => setTimeout(resolve, 2_000));

  let payout = 0;
  if (result === selected) {
    payout = wager * 2;
    economy.creditCoins(user, payout, { spillToBank: true });
  }
  store.save();
  const payload = coinflipPayload(userId, wager, selected, result, payout);
  await sent.edit(payload).catch(async () => {
    await messageLike.channel?.send(payload).catch(() => {});
  });
  return true;
}

function transfers(guildData) {
  guildData.pendingTransfers ||= {};
  return guildData.pendingTransfers;
}

function transferButtons(id) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`transfer:accept:${id}`).setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`transfer:reject:${id}`).setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger)
  )];
}

function transferEmbed(request, state = 'pending') {
  const amount = Number(request.amount || 0).toLocaleString();
  if (state === 'completed') return ui.success('✅ Transfer Completed', `<@${request.senderId}> sent **${amount} coins** to <@${request.recipientId}>.\n\nTransaction: \`${request.id}\``);
  if (state === 'rejected') return ui.error('❌ Transfer Rejected', `<@${request.recipientId}> rejected the transfer.\n\nTransaction: \`${request.id}\``);
  if (state === 'expired') return ui.error('⌛ Transfer Expired', 'No coins were moved because the request expired.');
  return ui.embed('💰 Astrix Transfer', `<@${request.senderId}> wants to send **${amount} coins** to <@${request.recipientId}>.\n\n**Terms & Conditions**\n• Transfers are virtual Astrix economy coins.\n• The sender must have sufficient wallet balance.\n• The recipient must accept the transfer.\n• This request expires in **60 seconds**.\n• The transfer cannot be exchanged for real-world currency.`);
}

async function expireTransfer(message, guildId, id) {
  const request = transfers(store.guild(guildId))[id];
  if (!request || request.status !== 'pending' || Number(request.expiresAt) > Date.now()) return;
  request.status = 'expired';
  store.save();
  await message.edit({ embeds: [transferEmbed(request, 'expired')], components: [] }).catch(() => {});
}

async function startTransfer(message, args = []) {
  const target = message.mentions?.users?.first?.();
  if (!target || target.bot || target.id === message.author.id) {
    throw new Error('Mention another human user to send coins to.');
  }
  const token = args.find(value => /^\d+$/.test(String(value)));
  const amount = Number(token);
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Enter a whole-number transfer of at least **1 coin**.');
  const sender = store.user(message.guild.id, message.author.id);
  if (amount > Number(sender.wallet || 0)) throw new Error('You do not have enough coins in your wallet.');
  const id = crypto.randomUUID();
  const request = {
    id,
    senderId: message.author.id,
    recipientId: target.id,
    amount,
    createdAt: Date.now(),
    expiresAt: Date.now() + TRANSFER_TTL_MS,
    status: 'pending'
  };
  transfers(store.guild(message.guild.id))[id] = request;
  store.save();
  const sent = await message.reply({
    embeds: [transferEmbed(request)],
    components: transferButtons(id),
    allowedMentions: { users: [message.author.id, target.id], repliedUser: false }
  });
  setTimeout(() => expireTransfer(sent, message.guild.id, id), TRANSFER_TTL_MS + 250).unref?.();
  return true;
}

async function transferButton(interaction) {
  const [, action, id] = String(interaction.customId || '').split(':');
  const request = transfers(store.guild(interaction.guildId))[id];
  if (!request) throw new Error('This transfer request is no longer available.');
  if (interaction.user.id !== request.recipientId) {
    return interaction.reply({ content: 'Only the intended recipient can accept or reject this transfer.', ephemeral: true });
  }
  if (request.status !== 'pending' || Number(request.expiresAt) <= Date.now()) {
    request.status = 'expired';
    store.save();
    return interaction.update({ embeds: [transferEmbed(request, 'expired')], components: [] });
  }
  if (action === 'reject') {
    request.status = 'rejected';
    request.completedAt = Date.now();
    store.save();
    return interaction.update({ embeds: [transferEmbed(request, 'rejected')], components: [] });
  }
  if (action !== 'accept') throw new Error('Unknown transfer action.');

  const sender = store.user(interaction.guildId, request.senderId);
  const recipient = store.user(interaction.guildId, request.recipientId);
  if (Number(sender.wallet || 0) < request.amount) {
    request.status = 'expired';
    store.save();
    return interaction.update({ embeds: [ui.error('Transfer Cancelled', 'The sender no longer has enough wallet coins. No coins were moved.')], components: [] });
  }
  sender.wallet -= request.amount;
  const credit = economy.creditCoins(recipient, request.amount, { spillToBank: true });
  if (credit.uncredited) {
    sender.wallet += credit.uncredited;
    request.status = 'expired';
    store.save();
    return interaction.update({ embeds: [ui.error('Transfer Cancelled', 'The recipient has no available wallet or bank space. No coins were moved.')], components: [] });
  }
  request.status = 'completed';
  request.completedAt = Date.now();
  store.save();
  return interaction.update({ embeds: [transferEmbed(request, 'completed')], components: [] });
}

async function coinflipInteraction(interaction) {
  const amount = interaction.options.getInteger('amount', true);
  const selected = interaction.options.getString('side');
  return playCoinflip(interaction, amount, selected);
}

module.exports = {
  playCoinflip,
  startTransfer,
  transferButton,
  coinflipInteraction,
  transferEmbed,
  transferButtons
};