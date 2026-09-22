const fs = require('fs');
const path = require('path');
const {
  AuditLogEvent,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/duration.ts');
const store = require('./store.ts');
const premium = require('./premium.ts');
const { ownerEmbed, embed } = require('./ui.ts');
const ai = require('./ai.ts');
const dashboardConfigSync = require('./dashboardConfigSync.ts');
const auditLogs = require('./logging.ts');

const destructive = new Map();
const joins = new Map();
const containmentCooldown = new Map();
const backupsDir = path.join(__dirname, '..', 'data', 'backups');
fs.mkdirSync(backupsDir, { recursive: true });

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
];

function req(interaction) {
  premium.requireOwner(interaction);
}

function requireSecurityAdmin(interaction) {
  if (
    interaction.guild?.ownerId === interaction.user.id
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) return;
  throw new Error('You need the **Administrator** permission to configure Anti-Nuke.');
}

function manageAutoMod(interaction) {
  if (interaction.guild?.ownerId === interaction.user.id) return;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('Manage Server permission is required to configure this safety module.');
  }
}

function clamp(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function sec(guildId) {
  const guildData = store.guild(guildId);
  guildData.security ||= {};
  guildData.security.trusted ||= [];
  guildData.security.allowedBots ||= [];
  guildData.security.antinuke ||= {
    enabled: false,
    threshold: 4,
    windowSeconds: 10,
    action: 'contain',
    lockdown: true,
  };
  return guildData.security;
}

function statusText(security) {
  const antiNuke = security.antinuke || {};
  return [
    `Anti-Nuke: **${antiNuke.enabled ? 'ON' : 'OFF'}**${antiNuke.enabled ? ` • ${antiNuke.threshold || 4}/${antiNuke.windowSeconds || 10}s • ${antiNuke.action || 'contain'}` : ''}`,
    `Anti-Bot: **${security.antibot?.enabled ? 'ON' : 'OFF'}**`,
    `Anti-Raid: **${security.antiraid?.enabled ? 'ON' : 'OFF'}**`,
    `Anti-NSFW: **${security.antinsfw?.enabled ? 'ON' : 'OFF'}**`,
    `Trusted users/bots: **${security.trusted?.length || 0}**`,
    `Lockdown: **${security.lockdown?.active ? 'ACTIVE' : 'Normal'}**`,
  ].join('\n');
}

const BACKUP_STEP_LABELS = {
  prepare: 'Prepare snapshot',
  roles: 'Capture roles and permissions',
  channels: 'Capture channels and settings',
  configuration: 'Capture Astrix configuration',
  save: 'Write backup files',
  cleanup: 'Clean old snapshots'
};

function backupProgressEmbed(steps, detail = '') {
  const lines = Object.entries(BACKUP_STEP_LABELS).map(([key, label]) => {
    const step = steps[key] || { status: 'pending', detail: '' };
    const icon = step.status === 'success'
      ? '✅'
      : step.status === 'failed'
        ? '❌'
        : step.status === 'running'
          ? '🔄'
          : '⬜';
    return `${icon} **${label}**${step.detail ? ` — ${step.detail}` : ''}`;
  });
  return ownerEmbed('Live Backup Progress', `${lines.join('\n')}${detail ? `\n\n${detail}` : ''}`);
}

function antiNukePermissionStatus(guild) {
  const me = guild.members.me;
  if (!me) return 'Bot permission check unavailable.';
  const checks = [
    ['View Audit Log', PermissionFlagsBits.ViewAuditLog],
    ['Manage Roles', PermissionFlagsBits.ManageRoles],
    ['Moderate Members', PermissionFlagsBits.ModerateMembers],
    ['Kick Members', PermissionFlagsBits.KickMembers],
    ['Ban Members', PermissionFlagsBits.BanMembers],
    ['Manage Channels', PermissionFlagsBits.ManageChannels],
  ];
  const missing = checks.filter(([, permission]) => !me.permissions.has(permission)).map(([label]) => label);
  return missing.length ? `Missing bot permissions: **${missing.join(', ')}**` : 'Bot protection permissions: **Ready**';
}

async function command(interaction, name) {
  if (name === 'antinsfw') manageAutoMod(interaction);
  else if (name === 'antinuke') requireSecurityAdmin(interaction);
  else req(interaction);

  await dashboardConfigSync.syncGuild(interaction.guildId);
  const security = sec(interaction.guildId);
  const guildData = store.guild(interaction.guildId);

  if (name === 'security' || name === 'securitystatus') {
    return interaction.reply({
      embeds: [ownerEmbed(
        'Astrix Security Center',
        `${statusText(security)}\n\nRecent incidents: **${(guildData.incidents || []).length}**\nBackups are non-destructive and recovery only recreates missing structure.`,
      )],
    });
  }

  if (name === 'antinuke') {
    const current = security.antinuke || {};
    const lockdownOption = interaction.options.getBoolean('lockdown');
    security.antinuke = {
      enabled: interaction.options.getBoolean('enabled', true),
      threshold: clamp(interaction.options.getInteger('threshold'), 2, 20, current.threshold || 4),
      windowSeconds: clamp(interaction.options.getInteger('window_seconds'), 3, 60, current.windowSeconds || 10),
      action: interaction.options.getString('action') || current.action || 'contain',
      lockdown: lockdownOption === null ? current.lockdown !== false : lockdownOption,
    };
    if (security.antinuke.enabled) {
      createBackup(interaction.guild);
      security.lastBackupAt = Date.now();
    }
    store.save();
    await dashboardConfigSync.persistSecurity(interaction.guildId, security, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [ownerEmbed(
        'Anti-Nuke Updated',
        [
          `Enabled: **${security.antinuke.enabled}**`,
          `Threshold: **${security.antinuke.threshold} destructive actions / ${security.antinuke.windowSeconds}s**`,
          `Containment action: **${security.antinuke.action}**`,
          `Emergency lockdown: **${security.antinuke.lockdown ? 'On' : 'Off'}**`,
          antiNukePermissionStatus(interaction.guild),
          security.antinuke.enabled ? 'A fresh recovery backup was created automatically.' : null,
          'Monitored: channel/role create-delete-update, permission overwrites, bans, kicks, dangerous role grants, webhooks and server-setting changes.',
        ].filter(Boolean).join('\n'),
      )],
    });
  }

  if (name === 'antibot') {
    security.antibot ||= { enabled: false };
    security.antibot.enabled = interaction.options.getBoolean('enabled', true);
    const bot = interaction.options.getUser('bot');
    const allow = interaction.options.getBoolean('allow');
    if (bot) {
      if (!bot.bot) throw new Error('The selected account is not a bot.');
      security.allowedBots ||= [];
      if (allow === false) security.allowedBots = security.allowedBots.filter(id => id !== bot.id);
      else if (!security.allowedBots.includes(bot.id)) security.allowedBots.push(bot.id);
    }
    store.save();
    await dashboardConfigSync.persistSecurity(interaction.guildId, security, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [ownerEmbed(
        'Anti-Bot Updated',
        `Enabled: **${security.antibot.enabled}**\nAllowed bots: **${security.allowedBots.length}**\nAllowed bots are still monitored by Anti-Nuke unless explicitly added with /trust.`,
      )],
    });
  }

  if (name === 'trust' || name === 'untrust') {
    const user = interaction.options.getUser('user', true);
    if (name === 'trust' && !security.trusted.includes(user.id)) security.trusted.push(user.id);
    if (name === 'untrust') security.trusted = security.trusted.filter(id => id !== user.id);
    store.save();
    await dashboardConfigSync.persistSecurity(interaction.guildId, security, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [ownerEmbed(
        'Security Trust Updated',
        `${user} ${name === 'trust' ? 'added to' : 'removed from'} the Anti-Nuke trusted list.`,
      )],
    });
  }

  if (name === 'antiraid') {
    security.antiraid = {
      enabled: interaction.options.getBoolean('enabled', true),
      joins: clamp(interaction.options.getInteger('joins'), 3, 50, security.antiraid?.joins || 8),
    };
    store.save();
    await dashboardConfigSync.persistSecurity(interaction.guildId, security, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [ownerEmbed(
        'Anti-Raid Updated',
        `Enabled: **${security.antiraid.enabled}** • Threshold: **${security.antiraid.joins} joins / 10s**`,
      )],
    });
  }

  if (name === 'antinsfw') {
    const enabled = interaction.options.getBoolean('enabled', true);
    const action = interaction.options.getString('action') || 'timeout';
    const durationInput = interaction.options.getString('duration');
    const timeoutMinutes = durationInput ? Math.round(parseDuration(durationInput) / 60000) : 60;
    const existingNsfw = guildData.config.automod?.nsfw || security.antinsfw || {};
    const dmUserOption = interaction.options.getBoolean('dm_user');
    const dmUser = dmUserOption === null ? existingNsfw.dmUser !== false : dmUserOption;
    security.antinsfw = { enabled, action, timeoutMinutes, dmUser };
    guildData.config.automod ||= {};
    guildData.config.automod.nsfw = {
      ...(guildData.config.automod.nsfw || {}),
      enabled,
      action,
      timeoutMinutes,
      dmUser,
    };
    store.save();
    await dashboardConfigSync.persistAutoMod(interaction.guildId, guildData.config.automod, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [ownerEmbed(
        'Anti-NSFW Updated',
        `Safety filter: **${enabled ? 'Enabled' : 'Disabled'}**\nPunishment: **${action}**${action === 'timeout' ? ` • **${formatDuration(timeoutMinutes * 60000)}**` : ''}\nPunishment DM: **${dmUser ? 'On' : 'Off'}**\nText, unsafe domains and suspicious media are checked. Configured vision providers are used when available.`,
      )],
    });
  }

  if (name === 'backup') {
    const action = interaction.options.getString('action') || 'create';
    const backupId = interaction.options.getString('backup_id') || 'latest';

    if (action === 'list') {
      const backups = listBackups(interaction.guildId);
      return interaction.reply({
        embeds: [ownerEmbed(
          'Available Backups',
          backups.length
            ? backups.slice(0, 10).map((backup, index) =>
              `${index + 1}. **${backup.label || 'manual'}** — \`${backup.id}\` — <t:${Math.floor(backup.createdAt / 1000)}:R>`,
            ).join('\n')
            : 'No named backups exist yet. Run `/backup action:create` first.',
        )],
        ephemeral: true,
      });
    }

    if (action === 'restore') {
      const backup = readBackup(interaction.guildId, backupId);
      if (!backup) throw new Error(`Backup \`${backupId}\` was not found.`);
      const selectedId = backup.id || backupId;
      return interaction.reply({
        embeds: [ownerEmbed(
          'Recovery Ready',
          `Selected backup: **${backup.label || 'manual'}**\nCreated: <t:${Math.floor(backup.createdAt / 1000)}:R>\nRecovery recreates missing roles/channels and restores Astrix configuration. Existing channels are not deleted.`,
        )],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`recover:confirm:${interaction.user.id}:${selectedId}`)
            .setLabel('Recover Server')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`recover:cancel:${interaction.user.id}:${selectedId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    const label = interaction.options.getString('label') || 'manual';
    const steps = {};
    await interaction.deferReply();
    const updateProgress = async (step, status, detail = '') => {
      steps[step] = { status, detail };
      await interaction.editReply({ embeds: [backupProgressEmbed(steps)] }).catch(() => {});
    };

    try {
      const backup = await createBackupLive(interaction.guild, label, updateProgress);
      guildData.security.lastBackupAt = Date.now();
      store.save();
      const completed = backupProgressEmbed(
        Object.fromEntries(Object.keys(BACKUP_STEP_LABELS).map(key => [
          key,
          { status: 'success', detail: key === 'roles'
            ? `${backup.roles.length} roles`
            : key === 'channels'
              ? `${backup.channels.length} channels`
              : '' }
        ])),
        `✅ **Backup successful**\nSnapshot: **${backup.label}**\nBackup ID: \`${backup.id}\`\nSaved **${backup.roles.length} roles**, **${backup.channels.length} channels**, and Astrix configuration.\n\nUse \`/backup action:list\` to view snapshots or \`/backup action:restore backup_id:${backup.id}\` to use this backup.`,
      );
      await interaction.editReply({ embeds: [completed] });
      await auditLogs.sendLocal(
        interaction.guild,
        'Backup Completed',
        `Moderator: <@${interaction.user.id}>\nSnapshot: \`${backup.id}\`\nRoles: **${backup.roles.length}** • Channels: **${backup.channels.length}**`,
      );
      await auditLogs.sendGlobal(interaction.client, 'Backup Completed', `Moderator: <@${interaction.user.id}>\nSnapshot: \`${backup.id}\``, {
        guildName: interaction.guild.name,
        guildId: interaction.guild.id
      });
      return;
    } catch (error) {
      const failedStep = Object.keys(BACKUP_STEP_LABELS).find(key => steps[key]?.status === 'running') || 'prepare';
      steps[failedStep] = { status: 'failed', detail: error.message };
      await interaction.editReply({
        embeds: [backupProgressEmbed(steps, `❌ **Backup failed:** ${error.message}`)]
      }).catch(() => {});
      await auditLogs.error(interaction.client, 'Backup', error, {
        guildName: interaction.guild.name,
        guildId: interaction.guild.id,
        user: interaction.user.tag
      });
      return;
    }
  }

  if (name === 'recover') {
    const backup = readBackup(interaction.guildId);
    if (!backup) throw new Error('No Astrix backup exists for this server.');
    return interaction.reply({
      embeds: [ownerEmbed(
        'Recovery Ready',
        `Latest backup: <t:${Math.floor(backup.createdAt / 1000)}:R>\nRecovery recreates missing roles/channels and restores Astrix configuration. Existing channels are not deleted.`,
      )],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`recover:confirm:${interaction.user.id}:${backup.id || 'latest'}`)
          .setLabel('Recover Server')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`recover:cancel:${interaction.user.id}:${backup.id || 'latest'}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
      )],
    });
  }

  if (name === 'nuke') {
    const channel = interaction.channel;
    if (!channel || !interaction.guild || channel.type === ChannelType.GuildCategory || channel.isThread?.()) {
      throw new Error('This command can only recreate a normal server channel, not a category or thread.');
    }
    if (!channel.clone || !channel.delete) {
      throw new Error('This channel type cannot be safely recreated by Astrix.');
    }
    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Astrix needs Manage Channels permission in this channel.');
    }

    await interaction.deferReply({ ephemeral: true });
    const backup = createBackup(interaction.guild, 'before-nuke');
    const reason = `Astrix channel nuke by ${interaction.user.tag}`;
    const oldChannelId = channel.id;
    const originalPosition = channel.rawPosition;
    const recreated = await channel.clone({
      name: channel.name,
      reason,
    });

    try {
      await channel.delete(reason);
    } catch (error) {
      await recreated.delete('Astrix nuke rollback after original channel deletion failed').catch(() => {});
      throw error;
    }

    await recreated.setPosition(originalPosition, { relative: false, reason }).catch(() => {});

    const moderatorName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
    const moderatorTag = interaction.user.tag || interaction.user.username;
    const nukeGifUrl = String(
      process.env.NUKE_GIF_URL || 'https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif',
    ).trim();
    const completion = {
      embeds: [ownerEmbed(
        'Nuclear Channel Reset',
        `Channel <#${oldChannelId}> was deleted and recreated here as <#${recreated.id}>.\nSettings, category, position, and permission overwrites were copied.\n\n**Moderator:** ${moderatorName} (${moderatorTag})\n**Backup created:** \`${backup.id}\``,
      ).setImage(nukeGifUrl)],
    };
    const posted = await recreated.send(completion).catch(() => null);
    if (posted) {
      return interaction.editReply({
        content: `Channel recreated successfully: <#${recreated.id}>`,
        embeds: [],
      });
    }
    return interaction.editReply(completion);
  }

  if (name === 'lockdown') return lockdown(interaction);
  if (name === 'unlockdown') return unlockdown(interaction);
}

function guildBackupsDir(guildId) {
  const directory = path.join(backupsDir, String(guildId));
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function safeBackupLabel(label) {
  return String(label || 'manual')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'manual';
}

function backupPath(guildId, backupId = 'latest') {
  if (backupId === 'latest') return path.join(backupsDir, `${guildId}-latest.json`);
  if (!/^[a-z0-9_-]+$/i.test(String(backupId))) throw new Error('Invalid backup ID.');
  return path.join(guildBackupsDir(guildId), `${backupId}.json`);
}

function createBackup(guild, label = 'manual') {
  const guildData = store.guild(guild.id);
  const safeLabel = safeBackupLabel(label);
  const uniquePart = process.hrtime.bigint().toString(36).slice(-8);
  const backup = {
    id: `${Date.now()}-${safeLabel}-${uniquePart}`,
    label: safeLabel,
    createdAt: Date.now(),
    guildId: guild.id,
    guildName: guild.name,
    roles: guild.roles.cache
      .filter(role => role.id !== guild.id)
      .map(role => ({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield.toString(),
        position: role.position,
      })),
    channels: guild.channels.cache.map(channel => ({
      name: channel.name,
      type: channel.type,
      parentName: channel.parent?.name || null,
      position: channel.rawPosition,
      topic: 'topic' in channel ? channel.topic : null,
      nsfw: 'nsfw' in channel ? channel.nsfw : false,
      rateLimitPerUser: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0,
    })),
    config: guildData.config,
    security: guildData.security,
  };
  const serialized = JSON.stringify(backup, null, 2);
  fs.writeFileSync(backupPath(guild.id, backup.id), serialized);
  fs.writeFileSync(backupPath(guild.id), serialized);

  const snapshots = listBackups(guild.id);
  for (const stale of snapshots.slice(12)) {
    try {
      fs.unlinkSync(backupPath(guild.id, stale.id));
    } catch {}
  }
  return backup;
}

function listBackups(guildId) {
  const directory = guildBackupsDir(guildId);
  return fs.readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      try {
        return JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(backup => backup && backup.guildId === guildId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function readBackup(guildId, backupId = 'latest') {
  try {
    return JSON.parse(fs.readFileSync(backupPath(guildId, backupId), 'utf8'));
  } catch {
    return null;
  }
}

async function createBackupLive(guild, label = 'manual', onProgress = null) {
  const report = async (step, status, detail = '') => {
    try {
      await onProgress?.(step, status, detail);
    } catch {}
    await new Promise(resolve => setImmediate(resolve));
  };
  const guildData = store.guild(guild.id);
  const safeLabel = safeBackupLabel(label);
  const uniquePart = process.hrtime.bigint().toString(36).slice(-8);
  await report('prepare', 'running', 'Preparing a consistent server snapshot.');

  await report('roles', 'running', 'Reading server roles and permissions.');
  const roles = guild.roles.cache
    .filter(role => role.id !== guild.id)
    .map(role => ({
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
    }));
  await report('roles', 'success', `${roles.length} roles captured.`);

  await report('channels', 'running', 'Reading channels, categories and channel settings.');
  const channels = guild.channels.cache.map(channel => ({
    name: channel.name,
    type: channel.type,
    parentName: channel.parent?.name || null,
    position: channel.rawPosition,
    topic: 'topic' in channel ? channel.topic : null,
    nsfw: 'nsfw' in channel ? channel.nsfw : false,
    rateLimitPerUser: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0,
  }));
  await report('channels', 'success', `${channels.length} channels captured.`);

  await report('configuration', 'running', 'Capturing Astrix configuration and security state.');
  const backup = {
    id: `${Date.now()}-${safeLabel}-${uniquePart}`,
    label: safeLabel,
    createdAt: Date.now(),
    guildId: guild.id,
    guildName: guild.name,
    roles,
    channels,
    config: guildData.config,
    security: guildData.security,
  };
  await report('configuration', 'success', 'Astrix configuration captured.');

  await report('save', 'running', 'Writing the snapshot and latest pointer.');
  const serialized = JSON.stringify(backup, null, 2);
  fs.writeFileSync(backupPath(guild.id, backup.id), serialized);
  fs.writeFileSync(backupPath(guild.id), serialized);
  await report('save', 'success', `Snapshot ${backup.id} written.`);

  await report('cleanup', 'running', 'Removing snapshots older than the 12-snapshot retention limit.');
  const snapshots = listBackups(guild.id);
  for (const stale of snapshots.slice(12)) {
    try {
      fs.unlinkSync(backupPath(guild.id, stale.id));
    } catch {}
  }
  await report('cleanup', 'success', 'Retention cleanup completed.');
  await report('prepare', 'success', 'Backup snapshot completed.');
  return backup;
}

async function recover(guild, backupId = 'latest') {
  const backup = readBackup(guild.id, backupId);
  if (!backup) throw new Error('No backup found.');

  const existingRoles = new Set(guild.roles.cache.map(role => role.name));
  for (const role of [...backup.roles].sort((a, b) => a.position - b.position)) {
    if (existingRoles.has(role.name)) continue;
    const made = await guild.roles.create({
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: BigInt(role.permissions),
      reason: 'Astrix backup recovery',
    }).catch(() => null);
    if (made) existingRoles.add(made.name);
  }

  const existingChannels = new Set(guild.channels.cache.map(channel => `${channel.type}:${channel.name}`));
  const categories = backup.channels
    .filter(channel => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
  const others = backup.channels
    .filter(channel => channel.type !== ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const channel of [...categories, ...others]) {
    if (existingChannels.has(`${channel.type}:${channel.name}`)) continue;
    let parent = null;
    if (channel.parentName) {
      parent = guild.channels.cache.find(
        candidate => candidate.type === ChannelType.GuildCategory && candidate.name === channel.parentName,
      );
    }
    const made = await guild.channels.create({
      name: channel.name,
      type: channel.type,
      parent: parent?.id,
      topic: channel.topic || undefined,
      nsfw: channel.nsfw || false,
      rateLimitPerUser: channel.rateLimitPerUser || 0,
      reason: 'Astrix backup recovery',
    }).catch(() => null);
    if (made) existingChannels.add(`${made.type}:${made.name}`);
  }

  const guildData = store.guild(guild.id);
  guildData.config = backup.config || guildData.config;
  guildData.security = { ...(guildData.security || {}), ...(backup.security || {}) };
  store.save();
  return backup;
}

async function lockdown(interactionOrGuild) {
  const guild = interactionOrGuild.guild || interactionOrGuild;
  const security = sec(guild.id);
  if (security.lockdown?.active) {
    if (interactionOrGuild.reply) {
      return interactionOrGuild.reply({ embeds: [ownerEmbed('Lockdown', 'Lockdown is already active.')] });
    }
    return;
  }

  const states = {};
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased() || !channel.permissionOverwrites) continue;
    const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
    const value = overwrite?.allow?.has(PermissionFlagsBits.SendMessages)
      ? true
      : overwrite?.deny?.has(PermissionFlagsBits.SendMessages)
        ? false
        : null;
    states[channel.id] = value;
    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { SendMessages: false },
      { reason: 'Astrix emergency lockdown' },
    ).catch(() => {});
  }

  security.lockdown = { active: true, states, at: Date.now() };
  store.save();
  if (interactionOrGuild.reply) {
    return interactionOrGuild.reply({
      embeds: [ownerEmbed(
        'Emergency Lockdown Enabled',
        'Text channels were locked. Use `/unlockdown` to restore the saved Send Messages overwrite states.',
      )],
    });
  }
}

async function unlockdown(interaction) {
  req(interaction);
  const security = sec(interaction.guildId);
  if (!security.lockdown?.active) throw new Error('Lockdown is not active.');

  for (const [channelId, value] of Object.entries(security.lockdown.states || {})) {
    const channel = interaction.guild.channels.cache.get(channelId);
    if (channel?.permissionOverwrites) {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: value },
        { reason: 'Astrix lockdown restore' },
      ).catch(() => {});
    }
  }

  security.lockdown = { active: false, states: {} };
  store.save();
  return interaction.reply({
    embeds: [ownerEmbed('Lockdown Restored', 'Saved channel Send Messages states were restored.')],
  });
}

async function auditEntryFor(guild, type, targetId = null, maxAgeMs = 8000) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 5 });
      const entry = logs.entries.find(candidate => {
        const recent = Date.now() - candidate.createdTimestamp < maxAgeMs;
        const targetMatches = !targetId || candidate.target?.id === targetId;
        return recent && targetMatches;
      }) || null;
      if (entry) return entry;
    } catch {
      return null;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350));
  }
  return null;
}

function roleIsDangerous(role) {
  return DANGEROUS_PERMISSIONS.some(permission => role.permissions?.has(permission));
}

async function containActor(guild, actor, antiNuke, label) {
  const member = await guild.members.fetch(actor.id).catch(() => null);
  let result = 'No member action available';

  if (member) {
    const dangerousRoles = member.roles.cache.filter(
      role => role.id !== guild.id && role.editable && roleIsDangerous(role),
    );
    if (dangerousRoles.size) {
      await member.roles.remove(dangerousRoles, `Astrix Anti-Nuke containment: ${label}`).catch(() => {});
    }

    if (antiNuke.action === 'ban' && member.bannable) {
      await member.ban({ reason: `Astrix Anti-Nuke: ${label}` }).catch(() => {});
      result = 'Member banned';
    } else if (antiNuke.action === 'kick' && member.kickable) {
      await member.kick(`Astrix Anti-Nuke: ${label}`).catch(() => {});
      result = 'Member kicked';
    } else if (antiNuke.action === 'lockdown_only') {
      result = 'Emergency lockdown only';
    } else {
      if (member.moderatable) {
        await member.timeout(10 * 60 * 1000, 'Astrix Anti-Nuke containment').catch(() => {});
      }
      result = dangerousRoles.size
        ? 'Dangerous roles removed; timeout attempted'
        : 'Timeout attempted; no editable dangerous role found';
    }
  }

  if (antiNuke.lockdown !== false) await lockdown(guild);
  return result;
}

async function processDestructiveActor(guild, actor, label) {
  const security = sec(guild.id);
  const antiNuke = security.antinuke || {};
  if (!antiNuke.enabled || !actor) return;
  if (actor.id === guild.client.user?.id) return;
  if (premium.isOwner(actor.id) || security.trusted.includes(actor.id)) return;

  const now = Date.now();
  const windowMs = clamp(antiNuke.windowSeconds, 3, 60, 10) * 1000;
  const key = `${guild.id}:${actor.id}`;
  const history = (destructive.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  history.push(now);
  destructive.set(key, history.slice(-30));

  if (history.length < clamp(antiNuke.threshold, 2, 20, 4)) return;

  const cooldownKey = `${guild.id}:${actor.id}`;
  if ((containmentCooldown.get(cooldownKey) || 0) > now) return;
  containmentCooldown.set(cooldownKey, now + 30000);

  const containment = await containActor(guild, actor, antiNuke, label);
  const guildData = store.guild(guild.id);
  guildData.incidents ||= [];
  guildData.incidents.push({
    id: `INC-${Date.now()}`,
    actor: actor.id,
    label,
    action: antiNuke.action || 'contain',
    at: now,
  });
  guildData.incidents = guildData.incidents.slice(-50);
  store.save();

  await auditLogs.sendLocal(
    guild,
    '🚨 Anti-Nuke Incident',
    `${actor} triggered the Anti-Nuke threshold.\nAction detected: **${label}**\nContainment: **${containment}**\nEmergency lockdown: **${antiNuke.lockdown !== false ? 'Enabled' : 'Disabled'}**`,
  );
  await auditLogs.sendGlobal(guild.client, 'Anti-Nuke Incident', `${actor} triggered the Anti-Nuke threshold.\nAction: **${label}**\nContainment: **${containment}**`, {
    guildName: guild.name,
    guildId: guild.id
  });
}

async function destructiveEvent(guild, type, targetId, label) {
  await dashboardConfigSync.syncGuild(guild.id);
  const security = sec(guild.id);
  if (!security.antinuke?.enabled) return;
  const entry = await auditEntryFor(guild, type, targetId);
  if (!entry?.executor) return;
  await processDestructiveActor(guild, entry.executor, label);
}

async function channelUpdate(oldChannel, newChannel) {
  await dashboardConfigSync.syncGuild(newChannel.guild.id);
  const security = sec(newChannel.guild.id);
  if (!security.antinuke?.enabled) return;
  const types = [
    [AuditLogEvent.ChannelUpdate, 'Channel Update'],
    [AuditLogEvent.ChannelOverwriteCreate, 'Channel Permission Create'],
    [AuditLogEvent.ChannelOverwriteUpdate, 'Channel Permission Update'],
    [AuditLogEvent.ChannelOverwriteDelete, 'Channel Permission Delete'],
  ];
  let newest = null;
  let label = null;
  for (const [type, candidateLabel] of types) {
    const entry = await auditEntryFor(newChannel.guild, type, newChannel.id, 6000);
    if (entry && (!newest || entry.createdTimestamp > newest.createdTimestamp)) {
      newest = entry;
      label = candidateLabel;
    }
  }
  if (newest?.executor) {
    await processDestructiveActor(newChannel.guild, newest.executor, label || 'Channel Update');
  }
}

async function webhooksUpdate(channel) {
  await dashboardConfigSync.syncGuild(channel.guild.id);
  const security = sec(channel.guild.id);
  if (!security.antinuke?.enabled) return;
  const types = [
    [AuditLogEvent.WebhookCreate, 'Webhook Create'],
    [AuditLogEvent.WebhookUpdate, 'Webhook Update'],
    [AuditLogEvent.WebhookDelete, 'Webhook Delete'],
  ];
  let newest = null;
  let label = null;
  for (const [type, candidateLabel] of types) {
    const entry = await auditEntryFor(channel.guild, type, null, 6000);
    if (entry && (!newest || entry.createdTimestamp > newest.createdTimestamp)) {
      newest = entry;
      label = candidateLabel;
    }
  }
  if (newest?.executor) await processDestructiveActor(channel.guild, newest.executor, label || 'Webhook Change');
}

async function memberUpdate(oldMember, newMember) {
  await dashboardConfigSync.syncGuild(newMember.guild.id);
  const security = sec(newMember.guild.id);
  if (!security.antinuke?.enabled) return;
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (!addedRoles.some(roleIsDangerous)) return;
  await destructiveEvent(
    newMember.guild,
    AuditLogEvent.MemberRoleUpdate,
    newMember.id,
    'Dangerous Role Grant',
  );
}

async function memberRemove(member) {
  await dashboardConfigSync.syncGuild(member.guild.id);
  const security = sec(member.guild.id);
  if (!security.antinuke?.enabled) return;
  const entry = await auditEntryFor(member.guild, AuditLogEvent.MemberKick, member.id, 6000);
  if (entry?.executor) await processDestructiveActor(member.guild, entry.executor, 'Member Kick');
}

async function memberAdd(member) {
  await dashboardConfigSync.syncGuild(member.guild.id);
  const security = sec(member.guild.id);
  if (
    member.user.bot
    && security.antibot?.enabled
    && !security.allowedBots.includes(member.id)
    && !premium.isOwner(member.id)
  ) {
    await member.kick('Astrix Anti-Bot: unauthorized bot').catch(() => {});
    return;
  }

  if (security.antiraid?.enabled && !member.user.bot) {
    const now = Date.now();
    const history = (joins.get(member.guild.id) || []).filter(timestamp => now - timestamp < 10000);
    history.push(now);
    joins.set(member.guild.id, history.slice(-100));
    if (history.length >= (security.antiraid.joins || 8) && !security.lockdown?.active) {
      await lockdown(member.guild);
    }
  }
}

async function message(messageObject) {
  if (!messageObject.guild || messageObject.author.bot || messageObject.deleted) return;
  await dashboardConfigSync.syncGuild(messageObject.guild.id);
  const security = sec(messageObject.guild.id);
  const guildData = store.guild(messageObject.guild.id);
  const rule = guildData.config.automod?.nsfw || security.antinsfw;
  if (!rule?.enabled) return;
  if (messageObject.channel.nsfw) return;
  const bypassSetting = guildData.config.automod?.settings?.bypassModerators;
  const bypassModerators = bypassSetting === true
    || (bypassSetting === undefined && String(process.env.AUTOMOD_BYPASS_MODS || 'false').toLowerCase() === 'true');
  if (
    bypassModerators
    && (
      messageObject.member?.permissions?.has(PermissionFlagsBits.ManageMessages)
      || messageObject.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
    )
  ) return;

  const blockedDomains = (process.env.NSFW_BLOCKED_DOMAINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const lower = (messageObject.content || '').toLowerCase();
  let blocked = blockedDomains.some(domain => lower.includes(domain.toLowerCase()));
  let reason = blocked ? 'Blocked unsafe domain detected.' : '';

  if (!blocked && /(?:https?:\/\/|www\.)/i.test(lower) && /(?:nsfw|adult|xxx)/i.test(lower)) {
    blocked = true;
    reason = 'Suspicious adult-content link detected.';
  }

  if (!blocked && /(?:\bnsfw\b|\bporn(?:ography)?\b|\bxxx\b)/i.test(lower)) {
    blocked = true;
    reason = 'Unsafe/adult text keyword detected.';
  }

  if (!blocked && lower.trim()) {
    blocked = await ai.moderation(lower).catch(() => false);
    if (blocked) reason = 'Unsafe/adult text content detected.';
  }

  if (!blocked && messageObject.attachments.size) {
    for (const attachment of messageObject.attachments.values()) {
      const name = String(attachment.name || '');
      const contentType = String(attachment.contentType || '');
      if (/(nsfw|adult|explicit)/i.test(name)) {
        blocked = true;
        reason = 'Suspicious unsafe attachment detected.';
        break;
      }
      const hasVisionProvider = process.env.OPENROUTER_VISION_MODEL
        || (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)
        || process.env.POLLINATIONS_API_KEY
        || process.env.GEMINI_API_KEY
        || process.env.OPENAI_API_KEY;
      if (/^image\//i.test(contentType) && hasVisionProvider) {
        const unsafe = await ai.moderationMedia(attachment.url).catch(() => false);
        if (unsafe) {
          blocked = true;
          reason = 'Unsafe image/GIF content detected.';
          break;
        }
      }
    }
  }

  if (!blocked) return;
  await applySafetyAction(messageObject, guildData, rule, reason || 'Unsafe content detected.');
}

async function sendSafetyDm(messageObject, action, reason, timeoutMinutes) {
  if (action === 'delete') return false;
  const hours = Math.max(1, Math.round(timeoutMinutes / 60));
  const proof = messageObject.content?.trim() || '[No text content]';
  const description = [
    `Server: **${messageObject.guild.name}**`,
    'Violation: **AutoMod / Unsafe Content**',
    `Action: **${action.toUpperCase()}**${action === 'timeout' ? ` for **${hours} hour(s)**` : ''}`,
    `Reason: ${reason}`,
    '',
    '**Your message was deleted.**',
    `Message: ${proof.slice(0, 900)}`,
    `Time: <t:${Math.floor(Date.now() / 1000)}:F>`,
    '',
    'If you believe this was a mistake, contact the server staff.',
  ].join('\n');
  try {
    await messageObject.author.send({
      embeds: [embed('🛡️ Astrix Safety Notice', description).setFooter({ text: 'Powered by Astrix Moderation' })],
    });
    return true;
  } catch {
    return false;
  }
}

async function applySafetyAction(messageObject, guildData, rule, reason) {
  const action = rule.action || 'timeout';
  const timeoutMinutes = clamp(rule.timeoutMinutes, 60, 40320, 60);
  await messageObject.delete().catch(() => {});
  const dmEnabled = rule.dmUser !== false;
  const dmSent = dmEnabled ? await sendSafetyDm(messageObject, action, reason, timeoutMinutes) : false;

  let result = 'Message deleted';
  guildData.warnings ||= {};
  if (action === 'warn') {
    guildData.warnings[messageObject.author.id] ||= [];
    guildData.warnings[messageObject.author.id].push({
      reason: `Safety filter: ${reason}`,
      by: messageObject.client.user.id,
      at: Date.now(),
    });
    store.save();
    result = 'Warning added';
  } else if (action === 'timeout') {
    if (messageObject.member?.moderatable) {
      await messageObject.member.timeout(
        timeoutMinutes * 60 * 1000,
        `Astrix Safety: ${reason}`,
      ).catch(() => {});
      result = `Timed out for ${Math.max(1, Math.round(timeoutMinutes / 60))} hour(s)`;
    } else result = 'Message deleted; timeout unavailable due to role hierarchy';
  } else if (action === 'kick') {
    if (messageObject.member?.kickable) {
      await messageObject.member.kick(`Astrix Safety: ${reason}`).catch(() => {});
      result = 'Member kicked';
    } else result = 'Message deleted; kick unavailable due to role hierarchy';
  } else if (action === 'ban') {
    if (messageObject.member?.bannable) {
      await messageObject.member.ban({ reason: `Astrix Safety: ${reason}` }).catch(() => {});
      result = 'Member banned';
    } else result = 'Message deleted; ban unavailable due to role hierarchy';
  }

  const proof = messageObject.content?.trim() || '[No text content]';
  await auditLogs.sendLocal(
    messageObject.guild,
    '🛡️ Safety AutoMod Action — Proof',
    `${messageObject.author} • ${reason}\nChannel: ${messageObject.channel}\nPunishment: **${result}**\nDM: **${dmEnabled ? (dmSent ? 'Sent' : 'Could not deliver') : 'Disabled'}**\nMessage: ${proof.slice(0, 1000)}\nMessage ID: \`${messageObject.id}\`\nJump: [Open message](${messageObject.url})`,
  );
  await auditLogs.sendGlobal(messageObject.client, 'Safety AutoMod Action', `${messageObject.author} • ${reason}\nPunishment: **${result}**\nMessage: ${proof.slice(0, 700)}`, {
    guildName: messageObject.guild.name,
    guildId: messageObject.guild.id
  });
}

async function button(interaction) {
  const [kind, action, userId, backupId = 'latest'] = interaction.customId.split(':');
  if (kind !== 'recover') return;
  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: 'This recovery confirmation belongs to another user.',
      ephemeral: true,
    });
  }
  req(interaction);
  if (action === 'cancel') {
    return interaction.update({ content: 'Recovery cancelled.', embeds: [], components: [] });
  }
  await interaction.deferUpdate();
  await recover(interaction.guild, backupId);
  return interaction.editReply({
    content: '✅ Recovery completed. Missing structure was recreated where possible.',
    embeds: [],
    components: [],
  });
}

module.exports = {
  command,
  destructiveEvent,
  channelUpdate,
  webhooksUpdate,
  memberUpdate,
  memberRemove,
  memberAdd,
  message,
  button,
  createBackup,
  listBackups,
  recover,
};
