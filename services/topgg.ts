const crypto = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const premium = require('./premium.ts');

const VOTE_DURATION_DAYS = 0.5;
const VOTE_DURATION_MS = 12 * 60 * 60 * 1000;
const recentEvents = new Map();

function botId() {
  return String(process.env.CLIENT_ID || '').trim();
}

function botVoteUrl() {
  const id = botId();
  return id ? `https://top.gg/bot/${id}/vote` : '';
}

function serverVoteUrl() {
  const guildId = String(process.env.TOPGG_SERVER_ID || process.env.GUILD_ID || '').trim();
  return guildId ? `https://top.gg/servers/${guildId}/vote` : '';
}

function voteComponents() {
  const buttons = [];
  const botUrl = botVoteUrl();
  const serverUrl = serverVoteUrl();
  if (botUrl) buttons.push(new ButtonBuilder().setLabel('Vote for Astrix Bot').setStyle(ButtonStyle.Link).setURL(botUrl));
  if (serverUrl) buttons.push(new ButtonBuilder().setLabel('Vote for Astrix Server').setStyle(ButtonStyle.Link).setURL(serverUrl));
  return buttons.length ? [new ActionRowBuilder().addComponents(...buttons)] : [];
}

function isAuthorized(request) {
  const expected = String(process.env.TOPGG_WEBHOOK_AUTH || '');
  const actual = String(request.headers.authorization || request.headers.Authorization || '');
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readUserId(payload) {
  return String(payload.user?.id || payload.user || payload.userId || '').trim();
}

function isVote(payload) {
  const type = String(payload.type || payload.event || 'upvote').toLowerCase();
  return type === 'upvote' || type === 'vote' || type === 'server_vote' || type === 'servervote';
}

function cleanupEvents() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, timestamp] of recentEvents) {
    if (timestamp < cutoff) recentEvents.delete(key);
  }
}

async function announce(client, userId, payload) {
  const channelId = String(process.env.TOPGG_ANNOUNCEMENT_CHANNEL_ID || '').trim();
  if (!channelId) return false;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return false;

  const memberName = payload.username || payload.userName || `<@${userId}>`;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Astrix Vote Reward')
    .setDescription(
      `Thank you **${String(memberName).slice(0, 100)}** for voting for Astrix.\n\n` +
      `You received **12 hours of Astrix Premium**. Vote again after it expires to keep your Premium active.`
    )
    .addFields({ name: 'Reward', value: 'Premium • 12 hours', inline: true })
    .setFooter({ text: 'Vote for both Astrix and this server to support us.' })
    .setTimestamp();

  await channel.send({ embeds: [embed], components: voteComponents() });
  return true;
}

async function handleWebhook(request, client, payload) {
  cleanupEvents();
  if (!isAuthorized(request)) return { status: 401, body: { ok: false, error: 'Unauthorized' } };
  if (!isVote(payload)) return { status: 202, body: { ok: true, ignored: true } };

  const userId = readUserId(payload);
  if (!userId) return { status: 400, body: { ok: false, error: 'Missing voter id' } };

  const eventKey = `${userId}:${String(payload.type || 'upvote')}:${String(payload.query || '')}`;
  if (recentEvents.has(eventKey)) return { status: 200, body: { ok: true, duplicate: true } };
  recentEvents.set(eventKey, Date.now());

  premium.grantGlobalMembership(userId, {
    tier: 'premium',
    days: VOTE_DURATION_DAYS,
    activatedBy: 'topgg_vote'
  });
  await announce(client, userId, payload).catch(error => console.error('Top.gg announcement:', error.message));
  return { status: 200, body: { ok: true, premiumHours: 12 } };
}

module.exports = { botVoteUrl, serverVoteUrl, voteComponents, handleWebhook };