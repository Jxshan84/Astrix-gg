const { PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const premium = require('./premium.ts');
const ui = require('./ui.ts');
const { parseDuration, formatDuration } = require('../utils/duration.ts');

const PREMIUM_RANKS = { free: 0, premium: 1, plus: 2, elite: 3 };
const BULK_LIMITS = { premium: 50, plus: 100, elite: 200 };
const BULK_BATCH_SIZE = 5;

function ensure(guildData) {
  guildData.cases ||= [];
  guildData.nextCaseId ||= 1;
  guildData.warnings ||= {};
  guildData.warningEscalations ||= {};
  guildData.warnConfig ||= {
    enabled: true,
    thresholds: { 3: 'timeout', 5: 'kick' },
    timeoutDuration: '10m'
  };
  guildData.protectedUsers ||= [];
  guildData.protectedRoleIds ||= [];
  guildData.config ||= {};
  guildData.config.automod ||= {};
  guildData.config.automod.modules ||= {};
  guildData.config.automod.settings ||= {};
  return guildData;
}

function rankFor(interaction) {
  const tier = premium.tierFor(interaction.guildId, interaction.user.id, interaction.guild);
  return { tier, rank: PREMIUM_RANKS[tier] || 0 };
}

function requirePremium(interaction, minimum = 'premium') {
  const current = rankFor(interaction);
  if (current.rank < (PREMIUM_RANKS[minimum] || 1)) {
    throw new Error(`This advanced moderation feature requires Astrix ${premium.tierName(minimum)} or higher.`);
  }
  return current;
}

function needInteractionPermission(interaction, permission, label) {
  if (!interaction.memberPermissions?.has(permission)) throw new Error(`You need **${label}** permission.`);
  if (!interaction.guild.members.me?.permissions?.has(permission)) throw new Error(`Astrix needs **${label}** permission.`);
}

function protectedMember(interaction, member, guildData) {
  if (!member || member.id === interaction.guild.ownerId || member.id === interaction.guild.members.me?.id) return true;
  if (member.id === interaction.user.id) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if ((guildData.protectedUsers || []).includes(member.id)) return true;
  return member.roles.cache.some(role => (guildData.protectedRoleIds || []).includes(role.id));
}

function eligibleMembers(interaction, filter, limit) {
  const guildData = ensure(store.guild(interaction.guildId));
  const actorPosition = interaction.member?.roles?.highest?.position || 0;
  const botPosition = interaction.guild.members.me?.roles?.highest?.position || 0;
  const roleId = interaction.options.getRole?.('role')?.id || null;
  const result = [];
  for (const member of interaction.guild.members.cache.values()) {
    if (protectedMember(interaction, member, guildData)) continue;
    if (member.roles.highest.position >= actorPosition || member.roles.highest.position >= botPosition) continue;
    if (!member.manageable) continue;
    if (filter === 'bots' && !member.user.bot) continue;
    if (filter === 'humans' && member.user.bot) continue;
    if (filter === 'role' && (!roleId || !member.roles.cache.has(roleId))) continue;
    result.push(member);
    if (result.length >= limit) break;
  }
  return result;
}

function newCase(guildData, action, targetId, moderatorId, reason, extra = {}) {
  const id = Number(guildData.nextCaseId || 1);
  guildData.nextCaseId = id + 1;
  const record = { id, type: action, targetId: targetId || null, moderatorId, reason, at: Date.now(), closed: false, evidence: [], ...extra };
  guildData.cases.unshift(record);
  guildData.cases = guildData.cases.slice(0, 1000);
  return record;
}

function recordCase(guildData, action, targetId, moderatorId, reason, extra = {}) {
  const record = newCase(ensure(guildData), action, targetId, moderatorId, reason, extra);
  store.save();
  return record;
}

async function escalateWarning(interaction, member, guildData, reason) {
  ensure(guildData);
  const count = Number(guildData.warnings?.[member.id]?.length || 0);
  const action = guildData.warnConfig?.thresholds?.[count] || guildData.warnConfig?.thresholds?.[String(count)];
  if (!guildData.warnConfig?.enabled || !action || action === 'none') return null;

  guildData.warningEscalations[member.id] ||= [];
  if (guildData.warningEscalations[member.id].includes(count)) {
    return { action, count, repeated: true };
  }

  const reasonText = `Warning escalation at ${count} warning${count === 1 ? '' : 's'}: ${reason}`;
  try {
    if (action === 'timeout') {
      if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
        throw new Error('Astrix needs Moderate Members permission for warning escalation.');
      }
      if (!member.moderatable) throw new Error('Astrix cannot timeout this member because of role hierarchy.');
      const duration = parseDuration(guildData.warnConfig.timeoutDuration || '10m');
      await member.timeout(duration, reasonText);
      guildData.warningEscalations[member.id].push(count);
      store.save();
      return { action, count, duration };
    }

    if (action === 'kick') {
      if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.KickMembers)) {
        throw new Error('Astrix needs Kick Members permission for warning escalation.');
      }
      if (!member.kickable) throw new Error('Astrix cannot kick this member because of role hierarchy.');
      await member.kick(reasonText);
      guildData.warningEscalations[member.id].push(count);
      store.save();
      return { action, count };
    }

    if (action === 'ban') {
      if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.BanMembers)) {
        throw new Error('Astrix needs Ban Members permission for warning escalation.');
      }
      if (!member.bannable) throw new Error('Astrix cannot ban this member because of role hierarchy.');
      await member.ban({ reason: reasonText });
      guildData.warningEscalations[member.id].push(count);
      store.save();
      return { action, count };
    }
  } catch (error) {
    return { action, count, skipped: true, reason: error.message || 'Discord rejected the escalation.' };
  }
  return null;
}

async function bulk(interaction) {
  const current = requirePremium(interaction, 'premium');
  const action = interaction.options.getSubcommand();
  const permission = action === 'massban' ? PermissionFlagsBits.BanMembers
    : action === 'masskick' ? PermissionFlagsBits.KickMembers
      : PermissionFlagsBits.ModerateMembers;
  const label = action === 'massban' ? 'Ban Members' : action === 'masskick' ? 'Kick Members' : 'Moderate Members';
  needInteractionPermission(interaction, permission, label);
  if (!interaction.options.getBoolean('confirm', true)) throw new Error('Confirmation is required before a bulk action can run.');
  const configuredLimit = interaction.options.getInteger('limit') || BULK_LIMITS[current.tier] || 50;
  const limit = Math.min(configuredLimit, BULK_LIMITS[current.tier] || 50);
  const filter = interaction.options.getString('filter') || 'all';
  const members = eligibleMembers(interaction, filter, limit);
  const reason = interaction.options.getString('reason') || `Bulk action by ${interaction.user.tag}`;
  const guildData = ensure(store.guild(interaction.guildId));
  await interaction.deferReply();
  await interaction.editReply({ embeds: [ui.embed('Mass Moderation Confirmation', `Action: **${action}**\nFilter: **${filter}**\nEligible members: **${members.length}**\n\nProcessing in small batches. Protected members, administrators, the guild owner, and members above Astrix’s hierarchy are excluded.`)] });
  let completed = 0;
  let failed = 0;
  const duration = action === 'massmute' ? parseDuration(interaction.options.getString('duration') || '10m') : null;
  for (let index = 0; index < members.length; index += BULK_BATCH_SIZE) {
    const batch = members.slice(index, index + BULK_BATCH_SIZE);
    for (const member of batch) {
      try {
        if (action === 'massban') await member.ban({ reason });
        else if (action === 'masskick') await member.kick(reason);
        else if (action === 'massmute') await member.timeout(duration, reason);
        else if (action === 'masswarn') {
          guildData.warnings[member.id] ||= [];
          guildData.warnings[member.id].push({ reason, by: interaction.user.id, at: Date.now() });
        }
        const escalation = action === 'masswarn'
          ? await escalateWarning(interaction, member, guildData, reason)
          : null;
        newCase(guildData, action, member.id, interaction.user.id, reason, {
          ...(duration ? { duration } : {}),
          ...(escalation ? { escalation } : {})
        });
        completed++;
      } catch {
        failed++;
      }
    }
    store.save();
    if (index + BULK_BATCH_SIZE < members.length) await new Promise(resolve => setTimeout(resolve, 350));
    if ((index + BULK_BATCH_SIZE) % 25 === 0 || index + batch.length >= members.length) {
      await interaction.editReply({ embeds: [ui.embed('Mass Moderation Progress', `Action: **${action}**\nProcessed: **${Math.min(index + batch.length, members.length)} / ${members.length}**\nCompleted: **${completed}**\nFailed: **${failed}**\n\nAstrix is respecting Discord rate limits and hierarchy protection.`)] }).catch(() => {});
    }
  }
  store.save();
  return interaction.editReply({ embeds: [ui.success('Mass Moderation Complete', `Action: **${action}**\nCompleted: **${completed}**\nSkipped or failed: **${failed}**\n\nA case was recorded for every successful member action.`)] });
}

function warnConfig(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to configure warnings.');
  const guildData = ensure(store.guild(interaction.guildId));
  const sub = interaction.options.getSubcommand();
  if (sub === 'status') {
    const config = guildData.warnConfig;
    return interaction.reply({ embeds: [ui.embed('Warning Escalation', `3 warnings: **${config.thresholds[3] || 'none'}**\n5 warnings: **${config.thresholds[5] || 'none'}**\nTimeout duration: **${config.timeoutDuration}**\n\nSevere actions only run when explicitly configured here.`)], ephemeral: true });
  }
  const threshold = interaction.options.getInteger('threshold', true);
  const action = interaction.options.getString('action', true);
  if (![3, 5].includes(threshold)) throw new Error('Supported warning thresholds are 3 and 5.');
  if (!['none', 'timeout', 'kick', 'ban'].includes(action)) throw new Error('Choose none, timeout, kick, or ban.');
  guildData.warnConfig.thresholds[threshold] = action;
  if (interaction.options.getString('duration')) guildData.warnConfig.timeoutDuration = interaction.options.getString('duration');
  store.save();
  return interaction.reply({ embeds: [ui.success('Warning Escalation Updated', `At **${threshold} warnings**, Astrix will now **${action}** when configured.`)], ephemeral: true });
}

function automod(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to configure AutoMod.');
  const moduleName = interaction.options.getString('module', true);
  const enabled = interaction.options.getBoolean('enabled', true);
  const threshold = interaction.options.getInteger('threshold') || 5;
  const action = interaction.options.getString('action') || 'delete';
  const advanced = ['raid', 'webhook', 'mass-mention', 'nsfw'].includes(moduleName);
  if (advanced) requirePremium(interaction, 'premium');
  const guildData = ensure(store.guild(interaction.guildId));
  guildData.config.automod.modules[moduleName] = {
    enabled,
    threshold: Math.max(1, Math.min(100, threshold)),
    action: ['delete', 'warn', 'timeout', 'kick', 'ban'].includes(action) ? action : 'delete',
    updatedAt: Date.now(),
    updatedBy: interaction.user.id
  };
  store.save();
  return interaction.reply({ embeds: [ui.success('AutoMod Updated', `Module: **${moduleName}**\nEnabled: **${enabled ? 'yes' : 'no'}**\nThreshold: **${threshold}**\nAction: **${action}**${advanced ? '\n\nPremium advanced controls are active.' : ''}`)], ephemeral: true });
}

module.exports = {
  bulk,
  warnConfig,
  automod,
  ensure,
  requirePremium,
  rankFor,
  recordCase,
  escalateWarning,
  BULK_LIMITS
};