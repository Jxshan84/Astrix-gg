// @ts-nocheck

const store = require('./store.ts');
const settings = require('./settings.ts');
const auditLogs = require('./logging.ts');
const attributionLocks = new Map();

function state(guildId) {
  const g = store.guild(guildId);
  g.invites ||= { cache: {}, initialized: false };
  g.invites.cache ||= {};
  g.invites.history ||= [];
  if (!Array.isArray(g.invites.history)) g.invites.history = [];
  g.invites.initialized = Boolean(g.invites.initialized);
  return g.invites;
}

async function refreshGuild(guild) {
  const s = state(guild.id);
  try {
    const invites = await guild.invites.fetch();
    const cache = {};
    for (const invite of invites.values()) {
      if (!invite.code) continue;
      cache[invite.code] = {
        uses: Number(invite.uses || 0),
        inviterId: invite.inviter?.id || null,
        inviterTag: invite.inviter?.tag || invite.inviter?.username || null,
        maxUses: Number(invite.maxUses || 0)
      };
    }
    s.cache = cache;
    s.initialized = true;
    store.save();
    return cache;
  } catch (error) {
    return s.cache || {};
  }
}

async function init(client) {
  for (const guild of client.guilds.cache.values()) {
    await refreshGuild(guild);
  }
}

async function findUsedInvite(guild) {
  const s = state(guild.id);
  let current;
  try {
    const invites = await guild.invites.fetch();
    current = {};
    let winner = null;
    let largestDelta = 0;

    for (const invite of invites.values()) {
      const uses = Number(invite.uses || 0);
      const previous = Number(s.cache?.[invite.code]?.uses || 0);
      const delta = uses - previous;
      const inviterId = invite.inviter?.id || s.cache?.[invite.code]?.inviterId || null;
      const inviterTag = invite.inviter?.tag || invite.inviter?.username || s.cache?.[invite.code]?.inviterTag || null;
      current[invite.code] = {
        uses,
        inviterId,
        inviterTag,
        maxUses: Number(invite.maxUses || 0)
      };
      if (delta > largestDelta) {
        largestDelta = delta;
        winner = { code: invite.code, inviterId, inviterTag };
      }
    }

    s.cache = current;
    s.initialized = true;
    store.save();
    return winner && largestDelta > 0 ? winner : null;
  } catch {
    return null;
  }
}

async function findUsedInviteSerial(guild) {
  const guildId = guild.id;
  const previous = attributionLocks.get(guildId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  attributionLocks.set(guildId, current);
  await previous.catch(() => {});
  try {
    return await findUsedInvite(guild);
  } finally {
    release();
    if (attributionLocks.get(guildId) === current) attributionLocks.delete(guildId);
  }
}

function ensureInviteStats(u) {
  u.invites ||= {
    regular: 0,
    joins: 0,
    leaves: 0,
    fake: 0,
    lastJoinAt: 0
  };
  u.invites.regular = Math.max(0, Number(u.invites.regular || 0));
  u.invites.joins = Math.max(0, Number(u.invites.joins || 0));
  u.invites.leaves = Math.max(0, Number(u.invites.leaves || 0));
  u.invites.fake = Math.max(0, Number(u.invites.fake || 0));
  return u.invites;
}

async function sendInviteReport(member, result) {
  const channelId = settings.get(member.guild.id).inviteLogChannelId;
  if (!channelId) return;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;

  const leaders = Object.entries(store.allUsers(member.guild.id))
    .map(([userId, user]) => ({
      userId,
      joins: Number(user.invites?.joins || 0),
      active: Number(user.invites?.regular || 0),
      leaves: Number(user.invites?.leaves || 0)
    }))
    .filter(entry => entry.joins > 0)
    .sort((a, b) => b.joins - a.joins || b.active - a.active)
    .slice(0, 25);
  const activeMembers = state(member.guild.id).history
    .sort((a, b) => Number(b.joinedAt || 0) - Number(a.joinedAt || 0))
    .slice(0, 25);
  const leaderText = leaders.length
    ? leaders.map((entry, index) => `${index + 1}. <@${entry.userId}> — **${entry.joins}** joins • **${entry.active}** active • ${entry.leaves} left`).join('\n')
    : 'No confirmed inviters yet.';
  const memberText = activeMembers.length
    ? activeMembers.map(entry => `${entry.active ? '✅' : '↩️'} <@${entry.memberId}> ← ${entry.inviterId ? `<@${entry.inviterId}>` : '**Unknown / vanity invite**'}`).join('\n')
    : 'No tracked invite records yet.';

  await channel.send({
    embeds: [{
      color: 0x8b5cf6,
      title: '🎟️ Invite Report',
      description: `New member: <@${member.id}>\nInvited by: ${result?.inviterId ? `<@${result.inviterId}>` : '**Unknown / vanity invite**'}${result?.code ? `\nInvite code: \`${result.code}\`` : ''}`,
      fields: [
        { name: '🏆 All inviters', value: leaderText.slice(0, 1024), inline: false },
        { name: '👥 Members they invited (tracked history)', value: memberText.slice(0, 1024), inline: false }
      ],
      footer: { text: 'Astrix invite tracker • newest join report' },
      timestamp: new Date().toISOString()
    }],
    allowedMentions: { parse: [] }
  }).catch(error => console.error('Invite report:', error.message));
}

async function memberAdd(member) {
  if (!member?.guild || member.user?.bot) return null;
  // Serialize invite snapshots per guild so two near-simultaneous joins do
  // not both inspect the same old cache and lose their attribution.
  const used = await findUsedInviteSerial(member.guild);
  const inviterId = used?.inviterId || null;
  const inviterTag = used?.inviterTag || null;
  const joinedAt = Date.now();
  const joined = store.user(member.guild.id, member.id);
  joined.invitedBy = inviterId;
  joined.inviteCode = used?.code || null;
  joined.inviterTag = inviterTag;
  joined.invitedAt = joinedAt;

  const s = state(member.guild.id);
  s.history.push({
    memberId: member.id,
    inviterId: inviterId === member.id ? null : inviterId,
    inviterTag: inviterId === member.id ? null : inviterTag,
    inviteCode: used?.code || null,
    joinedAt,
    active: true
  });
  s.history = s.history.slice(-100);

  if (!inviterId || inviterId === member.id) {
    store.save();
    auditLogs.recordInvite(member.guild, null);
    await sendInviteReport(member, { inviterId: null, code: used?.code || null });
    return null;
  }

  const inviter = store.user(member.guild.id, inviterId);
  const stats = ensureInviteStats(inviter);
  stats.regular += 1;
  stats.joins += 1;
  stats.lastJoinAt = joinedAt;

  store.save();
  auditLogs.recordInvite(member.guild, inviterId);
  await sendInviteReport(member, { inviterId, code: used.code });
  return { inviterId, code: used.code };
}

function memberRemove(member) {
  if (!member?.guild || member.user?.bot) return;
  const joined = store.user(member.guild.id, member.id);
  const inviterId = joined.invitedBy;
  const s = state(member.guild.id);
  const historyEntry = [...s.history].reverse().find(entry => entry.memberId === member.id && entry.active);
  if (!inviterId) {
    if (historyEntry) {
      historyEntry.active = false;
      historyEntry.leftAt = Date.now();
      store.save();
    }
    return;
  }

  const inviter = store.user(member.guild.id, inviterId);
  const stats = ensureInviteStats(inviter);
  stats.regular = Math.max(0, stats.regular - 1);
  stats.leaves += 1;

  joined.invitedBy = null;
  if (historyEntry) {
    historyEntry.active = false;
    historyEntry.leftAt = Date.now();
  }
  store.save();
}

function get(guildId, userId) {
  const u = store.user(guildId, userId);
  const stats = ensureInviteStats(u);
  return { ...stats, total: stats.regular };
}

function leaderboard(guildId, limit = 10) {
  return Object.entries(store.allUsers(guildId))
    .map(([userId, u]) => {
      const user = JSON.parse(JSON.stringify(u));
      return {
        userId,
        invites: Number(user.invites?.regular || 0),
        joins: Number(user.invites?.joins || 0),
        leaves: Number(user.invites?.leaves || 0)
      };
    })
    .filter(x => x.invites > 0)
    .sort((a, b) => b.invites - a.invites || b.joins - a.joins)
    .slice(0, Math.max(1, Math.min(25, limit)));
}

function invitedBy(guildId, memberId) {
  const u = store.user(guildId, memberId);
  return {
    inviterId: u.invitedBy || null,
    inviterTag: u.inviterTag || null,
    inviteCode: u.inviteCode || null,
    invitedAt: Number(u.invitedAt || 0)
  };
}

function recent(guildId, limit = 10) {
  const s = state(guildId);
  return [...s.history]
    .sort((a, b) => Number(b.joinedAt || 0) - Number(a.joinedAt || 0))
    .slice(0, Math.max(1, Math.min(25, Number(limit) || 10)));
}

function serverStats(guildId) {
  const users = Object.values(store.allUsers(guildId)).map(user => JSON.parse(JSON.stringify(user)));
  return {
    trackedInviters: users.filter(user => Number(user.invites?.joins || 0) > 0).length,
    totalJoins: users.reduce((sum, user) => sum + Number(user.invites?.joins || 0), 0),
    totalLeaves: users.reduce((sum, user) => sum + Number(user.invites?.leaves || 0), 0),
    activeInvites: users.reduce((sum, user) => sum + Number(user.invites?.regular || 0), 0),
    recentEntries: state(guildId).history.length
  };
}

module.exports = {
  invitedBy,
  init,
  refreshGuild,
  memberAdd,
  memberRemove,
  get,
  leaderboard,
  recent,
  serverStats
};
