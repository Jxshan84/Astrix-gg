// @ts-nocheck
const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const store = require('./store.ts');
const { embed, LYriEL_DOT_EMOJI } = require('./ui.ts');

const localChannelPromises = new Map();
const dashboardPromises = new Map();
const dashboardRefreshTimers = new Map();
let globalChannelPromise = null;
let warnedMissingGlobalGuild = false;
let liveRefreshTimer = null;
let liveClient = null;

function ownerIds() {
  return new Set([
    process.env.OWNER_ID || '',
    ...(process.env.OWNER_IDS || '').split(','),
    process.env.BOT_OWNER_ID || '',
    ...(process.env.BOT_OWNER_IDS || '').split(',')
  ].map(value => String(value).trim()).filter(Boolean));
}

function clean(value, limit = 1800) {
  return String(value ?? '')
    .replace(/`{3,}/g, '```')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, limit);
}

function errorText(error) {
  const message = clean(error?.message || error || 'Unknown error', 1200);
  const stack = clean(error?.stack || '', 2200);
  return stack && stack !== message ? `${message}\n\`\`\`\n${stack}\n\`\`\`` : message;
}

function staffOverwrites(guild, global = false) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  const allowedIds = global
    ? ownerIds()
    : new Set(
      [...guild.roles.cache.values()]
        .filter(role =>
          role.permissions.has(PermissionFlagsBits.Administrator)
          || role.permissions.has(PermissionFlagsBits.ManageGuild)
        )
        .map(role => role.id)
    );

  for (const id of allowedIds) {
    if (!id || id === guild.roles.everyone.id || id === guild.client.user.id) continue;
    overwrites.push({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (global && !allowedIds.size && guild.ownerId) {
    overwrites.push({
      id: guild.ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }
  return overwrites;
}

async function createPrivateChannel(guild, name, global = false) {
  if (!guild?.channels?.create) return null;
  const existing = guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildText && channel.name === name
  );
  if (existing) return existing;

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic: global
      ? 'Private Astrix owner bot logs. Do not share publicly.'
      : 'Private Astrix server moderation, activity and backup logs.',
    permissionOverwrites: staffOverwrites(guild, global),
    reason: global ? 'Astrix owner bot log channel' : 'Astrix automatic server log channel'
  }).catch(error => {
    console.error(`Could not create ${name}:`, error.message);
    return null;
  });
}

async function localChannel(guild) {
  if (!guild) return null;
  const guildData = store.guild(guild.id);
  guildData.config ||= {};
  const config = guildData.config;
  const configuredId = String(config.logChannelId || '').trim();
  if (configuredId) {
    const configured = guild.channels.cache.get(configuredId)
      || await guild.channels.fetch(configuredId).catch(() => null);
    if (configured?.isTextBased?.()) return configured;
    delete config.logChannelId;
    store.save();
  }

  if (!localChannelPromises.has(guild.id)) {
    localChannelPromises.set(guild.id, createPrivateChannel(guild, 'astrix-logs')
      .then(channel => {
        if (channel) {
          config.logChannelId = channel.id;
          store.save();
        }
        return channel;
      })
      .finally(() => localChannelPromises.delete(guild.id)));
  }
  return localChannelPromises.get(guild.id);
}

function liveData(guild) {
  const data = store.guild(guild.id);
  data.liveLogs ||= {};
  data.liveLogs.messageCounts ||= {};
  data.liveLogs.voiceTotals ||= {};
  data.liveLogs.voiceSessions ||= {};
  if (!Array.isArray(data.liveLogs.moderation)) data.liveLogs.moderation = [];
  return data.liveLogs;
}

function duration(ms) {
  let seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function currentVoiceTotal(data, userId, now = Date.now()) {
  const total = Number(data.voiceTotals[userId] || 0);
  const session = data.voiceSessions[userId];
  return total + (session ? Math.max(0, now - Number(session.joinedAt || now)) : 0);
}

function memberLabel(guild, userId) {
  const member = guild.members?.cache?.get(userId);
  return member?.displayName || member?.user?.username || `User ${userId}`;
}

function categoryEmbeds(guild) {
  const data = liveData(guild);
  const now = Date.now();
  const messages = Object.entries(data.messageCounts)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 15)
    .map(([userId, count], index) => `${index + 1}. <@${userId}> — **${Number(count).toLocaleString()}** message${Number(count) === 1 ? '' : 's'}`)
    .join('\n') || 'No messages tracked yet.';
  const voice = Object.keys({ ...data.voiceTotals, ...data.voiceSessions })
    .sort((a, b) => currentVoiceTotal(data, b, now) - currentVoiceTotal(data, a, now))
    .slice(0, 15)
    .map((userId, index) => `${index + 1}. <@${userId}> — **${duration(currentVoiceTotal(data, userId, now))}**`)
    .join('\n') || 'No voice activity tracked yet.';
  const moderation = data.moderation
    .slice(-12)
    .reverse()
    .map(item => `• **${clean(item.title, 100)}** — ${clean(item.description, 260)}`)
    .join('\n') || 'No moderation activity tracked yet.';
  const invites = Object.entries(data.inviteCounts)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 15)
    .map(([userId, count], index) => `${index + 1}. <@${userId}> — **${Number(count).toLocaleString()}** join${Number(count) === 1 ? '' : 's'}`)
    .join('\n') || 'No invite activity tracked yet.';
  const footer = 'Live Updates every minute • use /liveleaderboard to choose a panel';

  return {
    messages: embed(`Live Log • Message Leaderboard — ${guild.name}`, `Message leaderboard and totals.\nLast updated: <t:${Math.floor(now / 1000)}:R>`, 0x3498db)
      .addFields({ name: `Total messages • ${Number(data.messageTotal).toLocaleString()}`, value: messages.slice(0, 1024), inline: false })
      .setFooter({ text: footer }),
    voice: embed(`Live Log • Voice Leaderboard — ${guild.name}`, `Voice-channel activity and time leaderboard.\nLast updated: <t:${Math.floor(now / 1000)}:R>`, 0x9b59b6)
      .addFields({ name: 'Voice time', value: voice.slice(0, 1024), inline: false })
      .setFooter({ text: footer }),
    moderation: embed(`Live Log • Moderation Log — ${guild.name}`, `Recent moderation and message activity.\nLast updated: <t:${Math.floor(now / 1000)}:R>`, 0xed4245)
      .addFields({ name: 'Recent events', value: moderation.slice(0, 1024), inline: false })
      .setFooter({ text: footer }),
    invites: embed(`Live Log • Invite Leaderboard — ${guild.name}`, `Invite leaderboard and join totals.\nLast updated: <t:${Math.floor(now / 1000)}:R>`, 0xf1c40f)
      .addFields(
        { name: `Tracked joins • ${Number(data.inviteTotal).toLocaleString()}`, value: invites.slice(0, 1024), inline: false }
      )
      .setFooter({ text: footer })
  };
}

function normalizeLiveCategory(value) {
  const raw=String(value||'all').toLowerCase();
  if (['message','messages','msg'].includes(raw)) return 'messages';
  if (['voice','vc'].includes(raw)) return 'voice';
  if (['moderation','mod','moderate'].includes(raw)) return 'moderation';
  if (['invite','invites'].includes(raw)) return 'invites';
  return 'all';
}

async function ensureDashboard(guild, requestedCategory = 'all') {
  if (dashboardPromises.has(guild.id)) return dashboardPromises.get(guild.id);
  const pending = (async () => {
  const channel = await localChannel(guild);
  if (!channel?.send) return null;
  const data = liveData(guild);
  data.categoryMessageIds ||= {};
  const embeds = categoryEmbeds(guild);
  const messages = {};
  const selected=normalizeLiveCategory(requestedCategory);
  const categories=selected==='all' ? ['messages', 'voice', 'moderation', 'invites'] : [selected];
  for (const category of categories) {
    let message = null;
    const messageId = data.categoryMessageIds[category];
    if (messageId && data.dashboardChannelId === channel.id) {
      message = await channel.messages.fetch(messageId).catch(() => null);
    }
    if (message?.edit) {
      await message.edit({ embeds: [embeds[category]], allowedMentions: { parse: [] } }).catch(() => {});
    } else {
      message = await channel.send({
        embeds: [embeds[category]],
        allowedMentions: { parse: [] }
      }).catch(error => {
        console.error(`Could not create live ${category} log:`, error.message);
        return null;
      });
    }
    if (message) {
      data.categoryMessageIds[category] = message.id;
      messages[category] = message;
    }
  }
  data.dashboardChannelId = channel.id;
  data.dashboardMessageId = data.categoryMessageIds.messages || null;
  store.save();
  return selected==='all' ? (messages.messages || null) : (messages[selected] || null);
  })().finally(() => dashboardPromises.delete(guild.id));
  dashboardPromises.set(guild.id, pending);
  return pending;
}

async function refreshDashboard(guild) {
  if (!guild) return null;
  if (dashboardRefreshTimers.has(guild.id)) return null;
  const timer = setTimeout(() => {
    dashboardRefreshTimers.delete(guild.id);
    ensureDashboard(guild).catch(error => console.error('Live dashboard refresh:', error.message));
  }, 1500);
  timer.unref?.();
  dashboardRefreshTimers.set(guild.id, timer);
  return null;
}

async function sendLocal(guild, title, description, options: any = {}) {
  const data = liveData(guild);
  if (options.category === 'moderation' || !options.category) {
    data.moderation.push({
      title: String(title || 'Activity').slice(0, 120),
      description: String(description || '').replace(/\s+/g, ' ').slice(0, 320),
      at: Date.now()
    });
    data.moderation = data.moderation.slice(-40);
  }
  store.save();
  return refreshDashboard(guild);
}

function recordInvite(guild, inviterId = null) {
  if (!guild?.id) return null;
  const data = liveData(guild);
  data.inviteTotal += 1;
  if (inviterId) {
    data.inviteCounts[inviterId] = Number(data.inviteCounts[inviterId] || 0) + 1;
  }
  store.save();
  return refreshDashboard(guild);
}

function globalGuildId() {
  const stored = store.load().meta?.ownerLog || {};
  return String(
    process.env.ASTRIX_SUPPORT_GUILD_ID
    || process.env.SUPPORT_GUILD_ID
    || process.env.OWNER_LOG_GUILD_ID
    || stored.guildId
    || ''
  ).trim();
}

async function globalChannel(client) {
  if (!client) return null;
  const stored = store.load().meta?.ownerLog || {};
  const configuredChannelId = String(
    process.env.ASTRIX_GLOBAL_LOG_CHANNEL_ID
    || process.env.BOT_LOG_CHANNEL_ID
    || process.env.OWNER_LOG_CHANNEL_ID
    || stored.channelId
    || ''
  ).trim();
  if (configuredChannelId) {
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(configuredChannelId)
        || await guild.channels.fetch(configuredChannelId).catch(() => null);
      if (channel?.isTextBased?.()) return channel;
    }
  }

  const guildId = globalGuildId();
  const guild = guildId
    ? client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)
    : null;
  if (!guild) {
    if (!warnedMissingGlobalGuild) {
      warnedMissingGlobalGuild = true;
      console.warn('Global Astrix logs are disabled: set ASTRIX_SUPPORT_GUILD_ID or ASTRIX_GLOBAL_LOG_CHANNEL_ID.');
    }
    return null;
  }

  if (!globalChannelPromise) {
    globalChannelPromise = createPrivateChannel(guild, 'astrix-bot-logs', true)
      .finally(() => { globalChannelPromise = null; });
  }
  return globalChannelPromise;
}

async function sendGlobal(client, title, description, options: any = {}) {
  const channel = await globalChannel(client);
  if (!channel?.send) return null;
  const guildName = options.guildName ? `\nServer: **${clean(options.guildName, 200)}**` : '';
  const guildId = options.guildId ? `\nServer ID: \`${clean(options.guildId, 80)}\`` : '';
  return channel.send({
    embeds: [embed(`🛠️ ${title}`, `${clean(description, 3200)}${guildName}${guildId}`, options.color)],
    allowedMentions: { parse: [] }
  }).catch(error => {
    console.error('Global Astrix log:', error.message);
    return null;
  });
}

async function error(client, source, failure, context = {}) {
  const details = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `**${key}:** ${clean(value, 300)}`)
    .join('\n');
  return sendGlobal(client, `${source} Error`, `${details}${details ? '\n\n' : ''}${errorText(failure)}`, {
    ...context,
    color: 0xed4245
  });
}

async function messageCreate(message) {
  if (!message?.guild || message.author?.bot) return;
  const data = liveData(message.guild);
  data.messageTotal += 1;
  data.messageCounts[message.author.id] = Number(data.messageCounts[message.author.id] || 0) + 1;
  store.save();
  return refreshDashboard(message.guild);
}

async function messageDelete(message) {
  if (!message?.guild || message.author?.bot) return;
  return sendLocal(
    message.guild,
    'Message Deleted',
    `Author: ${message.author ? `<@${message.author.id}>` : 'Unknown'}\nChannel: <#${message.channel?.id || 'unknown'}>\nMessage ID: \`${message.id}\`\nContent:\n${clean(message.content || '[Content unavailable]', 1600)}`,
    { color: 0xed4245, category: 'moderation' }
  );
}

async function messageUpdate(oldMessage, newMessage) {
  if (!newMessage?.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  return sendLocal(
    newMessage.guild,
    'Message Edited',
    `Author: <@${newMessage.author.id}>\nChannel: <#${newMessage.channel.id}>\nMessage ID: \`${newMessage.id}\`\nBefore:\n${clean(oldMessage.content || '[Unavailable]', 700)}\nAfter:\n${clean(newMessage.content || '[Empty]', 700)}`,
    { color: 0xf5b942, category: 'moderation' }
  );
}

async function voiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user?.bot) return;
  const data = liveData(member.guild);
  const userId = member.id;
  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;
  if (oldChannelId !== newChannelId) {
    const session = data.voiceSessions[userId];
    if (session) {
      data.voiceTotals[userId] = Number(data.voiceTotals[userId] || 0) +
        Math.max(0, Date.now() - Number(session.joinedAt || Date.now()));
      delete data.voiceSessions[userId];
    }
    if (newChannelId) data.voiceSessions[userId] = { channelId: newChannelId, joinedAt: Date.now() };
  }
  const before = oldState.channel ? `<#${oldState.channel.id}>` : 'Not connected';
  const after = newState.channel ? `<#${newState.channel.id}>` : 'Not connected';
  const changes = [];
  if (before !== after) changes.push(`Channel: ${before} → ${after}`);
  if (oldState.serverMute !== newState.serverMute) {
    changes.push(`Server mute: **${newState.serverMute ? 'On' : 'Off'}**`);
  }
  if (oldState.serverDeaf !== newState.serverDeaf) {
    changes.push(`Server deaf: **${newState.serverDeaf ? 'On' : 'Off'}**`);
  }
  if (oldState.selfMute !== newState.selfMute) {
    changes.push(`Self mute: **${newState.selfMute ? 'On' : 'Off'}**`);
  }
  if (oldState.selfDeaf !== newState.selfDeaf) {
    changes.push(`Self deaf: **${newState.selfDeaf ? 'On' : 'Off'}**`);
  }
  if (oldState.streaming !== newState.streaming) {
    changes.push(`Streaming: **${newState.streaming ? 'Started' : 'Stopped'}**`);
  }
  if (oldState.selfVideo !== newState.selfVideo) {
    changes.push(`Camera: **${newState.selfVideo ? 'On' : 'Off'}**`);
  }
  store.save();
  if (!changes.length) return refreshDashboard(member.guild);
  data.moderation.push({
    title: 'Voice Activity',
    description: `${member.user?.tag || member.displayName || member.id}: ${changes.join(' • ')}`,
    at: Date.now()
  });
  data.moderation = data.moderation.slice(-40);
  return refreshDashboard(member.guild);
}

function start(client) {
  liveClient = client;
  if (liveRefreshTimer) return;
  liveRefreshTimer = setInterval(() => {
    for (const guild of liveClient?.guilds?.cache?.values?.() || []) {
      const data = liveData(guild);
      if (data.dashboardMessageId || Object.keys(data.voiceSessions).length) {
        refreshDashboard(guild).catch(error => console.error('Live dashboard refresh:', error.message));
      }
    }
  }, 60_000);
  liveRefreshTimer.unref?.();
}

module.exports = {
  localChannel,
  ensureDashboard,
  normalizeLiveCategory,
  start,
  sendLocal,
  recordInvite,
  sendGlobal,
  error,
  messageCreate,
  messageDelete,
  messageUpdate,
  voiceStateUpdate
};