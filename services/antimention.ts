const { PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const ui = require('./ui.ts');
const { parseDuration, formatDuration } = require('../utils/duration.ts');

function state(guildId) {
  const g = store.guild(guildId);
  g.security ||= {};
  g.security.antiMention ||= { protected: {} };
  g.security.antiMention.protected ||= {};
  return g.security.antiMention;
}

function ruleMs(rule) {
  if (rule?.durationMs) return Number(rule.durationMs);
  return Math.max(1, Math.min(672, Number(rule?.hours || 1))) * 3600000;
}

async function slash(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('Manage Server permission is required to configure Anti-Mention.');
  }
  const sub = interaction.options.getSubcommand();
  const cfg = state(interaction.guildId);

  if (sub === 'add') {
    const user = interaction.options.getUser('user', true);
    const durationMs = parseDuration(interaction.options.getString('duration', true));
    cfg.protected[user.id] = { durationMs, addedBy: interaction.user.id, addedAt: Date.now() };
    store.save();
    return interaction.reply({ embeds: [ui.success('Anti-Mention Protection Added', `${user} is now protected.\nAnyone who mentions this user will receive a real Discord timeout for **${formatDuration(durationMs)}**.`)] });
  }
  if (sub === 'remove') {
    const user = interaction.options.getUser('user', true);
    delete cfg.protected[user.id];
    store.save();
    return interaction.reply({ embeds: [ui.success('Anti-Mention Protection Removed', `${user} is no longer protected.`)] });
  }
  if (sub === 'clear') {
    cfg.protected = {};
    store.save();
    return interaction.reply({ embeds: [ui.success('Anti-Mention Cleared', 'All protected users were removed.')] });
  }
  const rows = Object.entries(cfg.protected).map(([id, x]) => `• <@${id}> — **${formatDuration(ruleMs(x))}**`).slice(0, 25);
  return interaction.reply({ embeds: [ui.embed('🛡️ Anti-Mention Protection', rows.join('\n') || 'No users are currently protected.')] });
}

async function prefix(message, args) {
  if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply({ embeds: [ui.embed('Permission Required', 'Manage Server permission is required.')] });
    return true;
  }
  const sub = String(args.shift() || 'list').toLowerCase();
  const cfg = state(message.guild.id);
  if (sub === 'add') {
    const user = message.mentions.users.first();
    if (!user) { await message.reply('Usage: `<prefix>antimention add @user <duration>` (example: `30m`, `2h`, `3d`, `1w`)'); return true; }
    const durationText = args.find(x => /^\d+(m|h|d|w)$/i.test(x));
    const durationMs = parseDuration(durationText || '1h');
    cfg.protected[user.id] = { durationMs, addedBy: message.author.id, addedAt: Date.now() };
    store.save();
    await message.reply({ embeds: [ui.success('Anti-Mention Protection Added', `${user} is protected for mentions. Offenders will be timed out for **${formatDuration(durationMs)}**.`)] });
    return true;
  }
  if (sub === 'remove') {
    const user = message.mentions.users.first();
    if (!user) { await message.reply('Mention the protected user you want to remove.'); return true; }
    delete cfg.protected[user.id]; store.save();
    await message.reply({ embeds: [ui.success('Anti-Mention Protection Removed', `${user} is no longer protected.`)] });
    return true;
  }
  if (sub === 'clear') { cfg.protected = {}; store.save(); await message.reply({ embeds: [ui.success('Anti-Mention Cleared', 'All protected users were removed.')] }); return true; }
  const rows = Object.entries(cfg.protected).map(([id, x]) => `• <@${id}> — **${formatDuration(ruleMs(x))}**`).slice(0, 25);
  await message.reply({ embeds: [ui.embed('🛡️ Anti-Mention Protection', rows.join('\n') || 'No users are currently protected.')] });
  return true;
}

async function sendPunishmentDm(message, durationMs, result) {
  const content = message.content?.trim() || '[No text content]';
  const description = [
    `Server: **${message.guild.name}**`,
    'Violation: **Anti-Mention Protection**',
    `Punishment: **${result}**`,
    `Duration: **${formatDuration(durationMs)}**`,
    '',
    '**Your message was deleted.**',
    `Message: ${content.slice(0, 900)}`,
    '',
    'If you believe this was a mistake, contact the server staff.',
  ].join('\n');
  try {
    await message.author.send({ embeds: [ui.embed('🛡️ Astrix Moderation Notice', description)] });
    return true;
  } catch {
    return false;
  }
}

async function sendLog(message, durationMs, result, dmSent, reason) {
  const guildData = store.guild(message.guild.id);
  const logChannelId = guildData.config?.logChannelId;
  const logChannel = logChannelId && message.guild.channels.cache.get(logChannelId);
  if (!logChannel?.send) return false;

  const proof = message.content?.trim() || '[No text content]';
  const description = [
    `${message.author} • ${reason}`,
    `Channel: ${message.channel}`,
    `Punishment: **${result}**`,
    `Duration: **${formatDuration(durationMs)}**`,
    `DM: **${dmSent ? 'Sent' : 'Could not deliver'}**`,
    `Message: ${proof.slice(0, 1000)}`,
    `Message ID: \`${message.id}\``,
    `Jump: [Open message](${message.url})`,
  ].join('\n');

  await logChannel.send({ embeds: [ui.embed('🛡️ Anti-Mention AutoMod — Proof', description)] }).catch(() => {});
  return true;
}

async function message(message) {
  if (!message.guild || message.author.bot || !message.mentions?.users?.size) return false;
  const cfg = state(message.guild.id);
  const protectedIds = [...message.mentions.users.keys()].filter(id => cfg.protected[id]);
  if (!protectedIds.length) return false;
  const targetId = protectedIds.find(id => id !== message.author.id);
  if (!targetId) return false;
  if (message.author.id === message.guild.ownerId || message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) return false;

  const rule = cfg.protected[targetId];
  const durationMs = ruleMs(rule);
  const reason = `Astrix Anti-Mention: mentioned protected user ${targetId}`;
  const dmText = message.content;

  // Capture proof before deleting the original message.
  if (message.deletable) await message.delete().catch(() => {});

  let result = 'Message deleted';
  const member = message.member;
  if (member?.moderatable) {
    await member.timeout(durationMs, reason).catch(() => {});
    result = `Timed out for ${formatDuration(durationMs)}`;
  } else {
    result = 'Message deleted; timeout unavailable due to role hierarchy';
  }

  // Keep the original content available for DM/log proof after deletion.
  message.content = dmText;
  const dmSent = await sendPunishmentDm(message, durationMs, result);
  await sendLog(message, durationMs, result, dmSent, reason);
  return true;
}

module.exports = { slash, prefix, message, state };
