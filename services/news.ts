const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const settings = require('./settings.ts');
const ui = require('./ui.ts');

const RELEASE_PATH = path.join(__dirname, '..', 'data', 'news.json');
const release = JSON.parse(fs.readFileSync(RELEASE_PATH, 'utf8'));

function state(guildId) {
  const g = store.guild(guildId);
  g.news ||= { announced: {} };
  g.news.announced ||= {};
  return g.news;
}

function isSendable(channel, guild) {
  if (!channel?.isTextBased?.() || !channel.permissionsFor) return false;
  const me = guild.members.me || guild.members.cache.get(guild.client.user?.id);
  if (!me) return false;
  const permissions = channel.permissionsFor(me);
  return Boolean(
    permissions?.has(PermissionFlagsBits.ViewChannel) &&
    permissions?.has(PermissionFlagsBits.SendMessages) &&
    permissions?.has(PermissionFlagsBits.EmbedLinks)
  );
}

function candidates(guild) {
  const configuredId = settings.get(guild.id).newsChannelId;
  const channels = [...guild.channels.cache.values()];
  const byId = id => id ? channels.find(channel => channel.id === id) : null;
  const named = channels
    .filter(channel => /^(news|announcements?|updates?|general)$/i.test(channel.name || ''))
    .sort((a, b) => a.rawPosition - b.rawPosition);
  const fallback = channels
    .filter(channel => channel.isTextBased?.())
    .sort((a, b) => a.rawPosition - b.rawPosition);
  return [byId(configuredId), guild.systemChannel, ...named, ...fallback]
    .filter((channel, index, list) => channel && list.indexOf(channel) === index);
}

function payload() {
  const items = Array.isArray(release.items) ? release.items.map(item => `• ${item}`).join('\n') : '';
  return {
    embeds: [ui.embed(`🚀 Astrix Update • ${release.title}`, `${release.summary || ''}\n\n${items}`)]
  };
}

async function announceGuild(guild) {
  if (!guild?.available) return false;
  const s = state(guild.id);
  if (s.announced[release.id]) return false;

  const channel = candidates(guild).find(candidate => isSendable(candidate, guild));
  if (!channel) {
    console.warn(`News announcement skipped for ${guild.name}: no sendable channel.`);
    return false;
  }

  try {
    await channel.send(payload());
    s.announced[release.id] = Date.now();
    store.save();
    console.log(`News announcement posted in ${guild.name} #${channel.name}.`);
    return true;
  } catch (error) {
    console.error(`News announcement failed for ${guild.name}:`, error.message);
    return false;
  }
}

async function announcePending(client) {
  let sent = 0;
  for (const guild of client.guilds.cache.values()) {
    if (await announceGuild(guild)) sent += 1;
  }
  return sent;
}

function getChannel(guildId) {
  return settings.get(guildId).newsChannelId;
}

module.exports = { announceGuild, announcePending, getChannel };