Const settings = require('./settings.ts');
const ui = require('./ui.ts');

function statusChannelId(guildId) {
  return String(settings.get(guildId).statusChannelId || '').trim();
}

function formatMemory() {
  return `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
}

function getStats(client, guild) {
  const ws = Math.max(0, Math.round(Number(client.ws?.ping || 0)));
  const rest = Math.max(0, Math.round(Number(client.rest?.latency || ws)));
  const users = guild
    ? guild.memberCount
    : client.guilds.cache.reduce((total, item) => total + Number(item.memberCount || 0), 0);
  const voiceConnections = client.voice?.connections?.size || 0;

  return {
    ws,
    rest,
    users,
    guilds: client.guilds.cache.size,
    voiceConnections,
    memory: formatMemory(),
    uptime: ui.formatDuration(process.uptime() * 1000),
    updatedAt: Date.now()
  };
}

function payload(client, guild) {
  const stats = getStats(client, guild);
  const health = stats.ws < 80 ? 'Excellent' : stats.ws < 150 ? 'Good' : 'Slow';
  const description = [
    `**Connection:** ${health}`,
    `Gateway ping: **${stats.ws} ms**`,
    `REST latency: **${stats.rest} ms**`,
    `Uptime: **${stats.uptime}**`,
    `Memory: **${stats.memory}**`,
    `Servers: **${stats.guilds.toLocaleString()}**`,
    `Members: **${stats.users.toLocaleString()}**`,
    `Voice connections: **${stats.voiceConnections}**`,
    '',
    `Last update: <t:${Math.floor(stats.updatedAt / 1000)}:R>`
  ].join('\n');

  return {
    embeds: [
      ui.embed(
        'Astrix Live Bot Status',
        description
      ).setColor(health === 'Excellent' ? 0x57f287 : health === 'Good' ? 0xf5b942 : 0xed4245)
    ],
    allowedMentions: { parse: [] }
  };
}

async function resolveChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  const channel = guild.channels.cache.get(channelId) ||
    await guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased?.() ? channel : null;
}

async function updateGuild(client, guild) {
  const channelId = statusChannelId(guild.id);
  if (!channelId) return false;

  const channel = await resolveChannel(guild, channelId);
  if (!channel) return false;

  const state = settings.get(guild.id);
  let message = null;
  if (state.statusMessageId) {
    message = await channel.messages.fetch(state.statusMessageId).catch(() => null);
  }

  if (message) {
    await message.edit(payload(client, guild));
  } else {
    message = await channel.send(payload(client, guild));
    settings.setStatusMessage(guild.id, message.id);
  }
  return true;
}

async function updateAll(client) {
  for (const guild of client.guilds.cache.values()) {
    await updateGuild(client, guild).catch(error =>
      console.error(`Live status update failed for ${guild.id}:`, error.message)
    );
  }
}

async function enable(client, interaction) {
  const channel = interaction.channel;
  if (!channel?.isTextBased?.()) throw new Error('Use this command in a text channel.');

  settings.setStatusChannel(interaction.guildId, channel.id);
  const state = settings.get(interaction.guildId);
  state.statusMessageId = null;
  settings.save?.();
  await updateGuild(client, interaction.guild);
  return `Live status is now running in <#${channel.id}>. Astrix will refresh it automatically.`;
}

function disable(guildId) {
  settings.clearStatusChannel(guildId);
  return 'Live bot status has been turned off for this server.';
}

function view(guildId) {
  const channelId = statusChannelId(guildId);
  return channelId
    ? `Live bot status is running in <#${channelId}>.`
    : 'No live bot status channel is configured. Run `/botstatus enable` in the channel you want to use.';
}

module.exports = { payload, updateGuild, updateAll, enable, disable, view };
?