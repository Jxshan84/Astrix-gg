// @ts-nocheck
const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/duration.ts');
const store = require('./store.ts');
const { embed } = require('./ui.ts');
const dashboardConfigSync = require('./dashboardConfigSync.ts');
const dashboardWelcome = require('./dashboardWelcome.ts');
const dashboardLeave = require('./dashboardLeave.ts');
const auditLogs = require('./logging.ts');

const spam = new Map();
const duplicates = new Map();
const violations = new Map();

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|gg|io|co|me|xyz|dev|app|site|online|link|tv|info|biz|in|uk|us)(?:\/[^\s<]*)?/i;
const INVITE_REGEX = /(?:discord(?:app)?\.com\/invite\/|discord\.gg\/|discord\.me\/|discord\.io\/)[a-z0-9-]+/i;
const PHISHING_HINT_REGEX = /(?:free[-_ ]?nitro|nitro[-_ ]?gift|discord[-_ ]?gift|steam[-_ ]?gift|claim[-_ ]?gift|airdrop|discorcl|dlscord|discordnitro)/i;
const MAX_WELCOME_MEDIA_BYTES = 8 * 1024 * 1024;

function welcomeMediaName(media) {
  let name = String(media?.name || 'welcome-media').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const isGif = String(media?.contentType || '').toLowerCase() === 'image/gif'
    || /\.gif$/i.test(name)
    || /\.gif(?:[?#]|$)/i.test(String(media?.url || ''));
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += isGif ? '.gif' : '.png';
  return name;
}

async function cacheWelcomeMedia(media) {
  if (!media?.url) return null;
  try {
    const response = await fetch(media.url);
    if (!response.ok) return null;
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_WELCOME_MEDIA_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_WELCOME_MEDIA_BYTES) return null;
    return {
      data: bytes.toString('base64'),
      byteLength: bytes.length,
      name: welcomeMediaName(media),
      contentType: String(media.contentType || response.headers.get('content-type') || 'image/*')
    };
  } catch {
    return null;
  }
}

const AUTOMOD_DEFAULTS = Object.freeze({
  spam: { limit: 6, windowSeconds: 5 },
  duplicate: { limit: 3, windowSeconds: 20 },
  links: {},
  invites: {},
  phishing: { action: 'timeout', timeoutMinutes: 60 },
  mentions: { limit: 5 },
  caps: { limit: 75 },
  emoji: { limit: 12 },
  badwords: {},
  nsfw: { action: 'timeout', timeoutMinutes: 60 },
});

function clamp(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function normalizeRule(moduleName, current = {}) {
  const defaults = AUTOMOD_DEFAULTS[moduleName] || {};
  return {
    ...defaults,
    ...current,
    enabled: current.enabled === true,
    action: current.action || defaults.action || 'delete',
    timeoutMinutes: clamp(current.timeoutMinutes, 60, 40320, defaults.timeoutMinutes || 60),
    limit: clamp(current.limit, 1, 100, defaults.limit || 0),
    windowSeconds: clamp(current.windowSeconds, 2, 120, defaults.windowSeconds || 10),
    escalateAfter: clamp(current.escalateAfter, 0, 20, 0),
    escalateAction: current.escalateAction || 'timeout',
    escalateWindowMinutes: clamp(current.escalateWindowMinutes, 1, 1440, 10),
    dmUser: current.dmUser !== false,
  };
}

function isAutomodBypassed(messageObject, automod) {
  const configured = automod.settings?.bypassModerators;
  const bypassModerators = configured === true
    || (configured === undefined
      && String(process.env.AUTOMOD_BYPASS_MODS || 'false').toLowerCase() === 'true');
  if (!bypassModerators) return false;
  return Boolean(
    messageObject.member?.permissions?.has(PermissionFlagsBits.ManageMessages)
    || messageObject.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function countEmoji(text) {
  const custom = text.match(/<a?:[a-zA-Z0-9_]+:\d{16,22}>/g)?.length || 0;
  let unicode = 0;
  try { unicode = text.match(/\p{Extended_Pictographic}/gu)?.length || 0; } catch {}
  return custom + unicode;
}

function violationCount(guildId, userId, moduleName, windowMinutes) {
  const key = `${guildId}:${userId}:${moduleName}`;
  const now = Date.now();
  const windowMs = Math.max(1, windowMinutes) * 60 * 1000;
  const history = (violations.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  history.push(now);
  violations.set(key, history.slice(-25));
  return history.length;
}

function manage(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('Manage Server permission is required.');
  }
}

async function command(interaction, name) {
  manage(interaction);
  await dashboardConfigSync.syncGuild(interaction.guildId);
  const guildData = store.guild(interaction.guildId);
  const config = guildData.config;

  if (name === 'reactionrole') {
    const messageId = interaction.options.getString('message_id', true);
    const emoji = interaction.options.getString('emoji', true);
    const role = interaction.options.getRole('role', true);
    const mode = interaction.options.getString('mode') || 'toggle';
    const message = await interaction.channel.messages.fetch(messageId);
    await message.react(emoji);
    guildData.reactionRoles = guildData.reactionRoles.filter(
      item => !(item.messageId === messageId && item.emoji === emoji),
    );
    guildData.reactionRoles.push({
      messageId,
      channelId: interaction.channelId,
      emoji,
      roleId: role.id,
      mode,
    });
    store.save();
    return interaction.reply({
      embeds: [embed('Reaction Role Created', `${emoji} → ${role}\nMode: **${mode}**`)],
      ephemeral: true,
    });
  }

  if (name === 'buttonrole') {
    const role = interaction.options.getRole('role', true);
    const label = interaction.options.getString('label', true);
    const title = interaction.options.getString('title') || 'Choose Your Role';
    const description = interaction.options.getString('description') || 'Use the button below to toggle the role.';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rolebtn:${role.id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary),
    );
    return interaction.reply({ embeds: [embed(title, description)], components: [row] });
  }

  if (name === 'rolemenu') {
    const roleList = [];
    for (let index = 1; index <= 5; index += 1) {
      const role = interaction.options.getRole(`role${index}`);
      if (role) roleList.push(role);
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId('rolemenu:toggle')
      .setPlaceholder('Choose roles to toggle')
      .setMinValues(1)
      .setMaxValues(roleList.length)
      .addOptions(
        roleList.map(role => ({
          label: role.name,
          value: role.id,
          description: `Toggle ${role.name}`,
        })),
      );
    return interaction.reply({
      embeds: [embed('Self Role Menu', 'Choose one or more roles below. Selecting an owned role removes it; selecting a new role adds it.')],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  if (name === 'autorole') {
    const roles = ['role', 'role2', 'role3', 'role4', 'role5']
      .map(optionName => interaction.options.getRole(optionName))
      .filter(Boolean);
    const role = roles[0];
    const target = interaction.options.getString('target', true);
    const delay = interaction.options.getInteger('delay') || 0;
    const enabled = interaction.options.getBoolean('enabled') ?? true;
    if (!role) throw new Error('Select at least one role.');
    if (roles.some(item => item.managed)) throw new Error('Managed integration roles cannot be assigned by Astrix.');
    config.autorole = { roleId: role.id, roleIds: roles.map(item => item.id), target, delay, enabled };
    store.save();
    return interaction.reply({
      embeds: [embed('Auto Role Updated', `${enabled ? 'Enabled' : 'Disabled'} • ${roles.join(' ')}\nTarget: **${target}** • Delay: **${delay}s**`)],
    });
  }

  if (name === 'massrole') {
    const role = interaction.options.getRole('role', true);
    const action = interaction.options.getString('action', true);
    const target = interaction.options.getString('target', true);
    const botMember = interaction.guild.members.me;
    if (role.managed || role.id === interaction.guild.id) throw new Error('That role cannot be assigned.');
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('Astrix needs Manage Roles permission.');
    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Move the Astrix bot role above the selected role in Server Settings → Roles.');
    }

    await interaction.deferReply({ ephemeral: true });
    const members = await interaction.guild.members.fetch();
    const selected = [...members.values()].filter(member => {
      if (target === 'bots') return member.user.bot;
      if (target === 'members') return !member.user.bot;
      if (target === 'online') return member.presence?.status && member.presence.status !== 'offline';
      return true;
    });
    let changed = 0;
    let skipped = 0;
    for (const member of selected) {
      if (member.id === interaction.guild.ownerId || !member.manageable) {
        skipped += 1;
        continue;
      }
      try {
        if (action === 'add' && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, `Mass role add by ${interaction.user.tag}`);
          changed += 1;
        } else if (action === 'remove' && member.roles.cache.has(role.id)) {
          await member.roles.remove(role, `Mass role remove by ${interaction.user.tag}`);
          changed += 1;
        }
      } catch {
        skipped += 1;
      }
    }
    return interaction.editReply({
      embeds: [embed('Mass Role Complete', `Action: **${action}**\nRole: ${role}\nTarget: **${target}**\nChanged: **${changed.toLocaleString()}**\nSelected: **${selected.length.toLocaleString()}**\nPermission failures: **${skipped.toLocaleString()}**`)],
    });
  }

  if (name === 'verify') {
    const verifiedRole = interaction.options.getRole('verified_role', true);
    const unverifiedRole = interaction.options.getRole('unverified_role');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    config.verify = {
      verifiedRoleId: verifiedRole.id,
      unverifiedRoleId: unverifiedRole?.id || null,
    };
    store.save();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify:member')
        .setLabel('Verify')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );
    await channel.send({
      embeds: [embed('Astrix Verification', 'Press **Verify** to receive server access.')],
      components: [row],
    });
    return interaction.reply({ content: `Verification panel created in ${channel}.`, ephemeral: true });
  }

  if (name === 'welcome' || name === 'goodbye') {
    const channel = interaction.options.getChannel('channel', true);
    const previous = config[name] || {};
    const defaultMessage = name === 'welcome'
      ? 'Welcome {user} to **{server}**!'
      : 'Goodbye **{user}**.';
    const message = interaction.options.getString('message') || previous.message || defaultMessage;
    const enabled = interaction.options.getBoolean('enabled') ?? previous.enabled ?? true;
    const media = interaction.options.getAttachment('media');
    const removeMedia = interaction.options.getBoolean('remove_media') === true;
    if (name === 'welcome' && media && !String(media.contentType || '').toLowerCase().startsWith('image/')) {
      throw new Error('Welcome media must be an image or GIF attachment.');
    }
    if (name === 'welcome' && media) await interaction.deferReply();
    const previousMedia = previous.media;
    const cachedMedia = name === 'welcome' && media ? await cacheWelcomeMedia(media) : null;
    config[name] = {
      channelId: channel.id,
      message,
      enabled,
      ...(name === 'welcome'
        ? { media: removeMedia ? null : media
          ? {
            url: media.url,
            name: media.name || 'welcome-media',
            contentType: media.contentType || 'image/*',
            ...(cachedMedia ? { data: cachedMedia.data, byteLength: cachedMedia.byteLength } : {})
          }
          : previousMedia || null }
        : {})
    };
    store.save();
    const label = name === 'welcome' ? 'Welcome' : 'Goodbye';
    const state = enabled ? 'Enabled' : 'Disabled';
    const mediaNote = name === 'welcome'
      ? config[name].media?.url
        ? `\nMedia: **${config[name].media.name}** (shown when a member joins)`
        : '\nMedia: **None**'
      : '';
    const mediaStatus = name === 'welcome' && media && !cachedMedia
      ? '\nMedia cache: **download failed; live URL fallback saved**'
      : '';
    const response = {
      embeds: [embed(`${label} Updated`, `${state} in ${channel}.${mediaNote}`)],
    };
    if (mediaStatus) response.embeds[0].setDescription(`${state} in ${channel}.${mediaNote}${mediaStatus}`);
    return interaction.deferred ? interaction.editReply(response) : interaction.reply(response);
  }

  if (name === 'logs') {
    const channel = interaction.options.getChannel('channel', true);
    config.logChannelId = channel.id;
    store.save();
    await auditLogs.ensureDashboard(interaction.guild);
    return interaction.reply({
      embeds: [embed('Logging Updated', `Astrix will keep one live dashboard in ${channel} with Messages, VC Time and Moderation sections.`)],
    });
  }

  if (name === 'automod') {
    const selectedModule = interaction.options.getString('module');
    const allModules = Object.keys(AUTOMOD_DEFAULTS);
    const allEnabled = interaction.options.getBoolean('enabled') ?? true;
    config.automod ||= {};
    config.automod.settings ||= {};
    const allAction = interaction.options.getString('action') || 'delete';
    const durationInput = interaction.options.getString('duration');
    const allTimeoutMinutes = durationInput === null
      ? 60
      : Math.max(1, Math.round(parseDuration(durationInput) / 60000));
    const allLimit = clamp(interaction.options.getInteger('limit'), 1, 100, 6);
    const allWindowSeconds = clamp(interaction.options.getInteger('window_seconds'), 2, 120, 5);
    const allEscalateAfter = clamp(interaction.options.getInteger('escalate_after'), 0, 20, 0);
    const allEscalateAction = interaction.options.getString('escalate_action') || 'timeout';
    const allEscalateWindow = clamp(interaction.options.getInteger('escalate_window_minutes'), 1, 1440, 10);
    const bypassModerators = interaction.options.getBoolean('bypass_moderators');
    if (bypassModerators !== null) config.automod.settings.bypassModerators = bypassModerators;
    const dmUserOption = interaction.options.getBoolean('dm_user');
    const allDmUser = dmUserOption === null ? true : dmUserOption;

    for (const currentModule of allModules) {
      const current = normalizeRule(currentModule, config.automod[currentModule] || {});
      config.automod[currentModule] = {
        ...current,
        enabled: allEnabled,
        action: allAction,
        timeoutMinutes: allTimeoutMinutes,
        limit: ['spam', 'duplicate', 'mentions', 'emoji', 'caps'].includes(currentModule) ? allLimit : current.limit,
        windowSeconds: ['spam', 'duplicate'].includes(currentModule) ? allWindowSeconds : current.windowSeconds,
        escalateAfter: allEscalateAfter,
        escalateAction: allEscalateAction,
        escalateWindowMinutes: allEscalateWindow,
        dmUser: allDmUser,
      };
    }
    guildData.security ||= {};
    guildData.security.antinsfw = {
      enabled: allEnabled,
      action: allAction,
      timeoutMinutes: allTimeoutMinutes,
      dmUser: allDmUser,
    };
    store.save();
    await dashboardConfigSync.persistAutoMod(interaction.guildId, config.automod, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [embed('All-in-One AutoMod Updated', [
        `All **${allModules.length}** protections: **${allEnabled ? 'Enabled' : 'Disabled'}**`,
        selectedModule ? 'Category selection is optional and ignored; every protection was configured together.' : null,
        `Punishment: **${allAction}**${allAction === 'timeout' ? ` • ${formatDuration(allTimeoutMinutes * 60000)}` : ''}`,
        `Detection limit: **${allLimit}** • Spam window: **${allWindowSeconds}s**`,
        allEscalateAfter >= 2 ? `Escalation: **${allEscalateAction}** after **${allEscalateAfter}** violations / ${allEscalateWindow} min` : 'Escalation: **Off**',
        `Moderator bypass: **${config.automod.settings.bypassModerators ? 'On' : 'Off'}**`,
        `Punishment DM: **${allDmUser ? 'On' : 'Off'}**`,
      ].filter(Boolean).join('\n'))],
    });

    // Kept below as a compatibility reference for old persisted command data.
    // New slash-command executions return from the all-in-one flow above.
    if (false) {
    const moduleName = interaction.options.getString('module', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    config.automod ||= {};
    config.automod.settings ||= {};

    const current = normalizeRule(moduleName, config.automod[moduleName] || {});
    const action = interaction.options.getString('action') || current.action;
    const durationInput = interaction.options.getString('duration');
    const timeoutMinutes = durationInput === null ? current.timeoutMinutes : Math.round(parseDuration(durationInput) / 60000);
    const limit = clamp(interaction.options.getInteger('limit'), 1, 100, current.limit);
    const windowSeconds = clamp(
      interaction.options.getInteger('window_seconds'),
      2,
      120,
      current.windowSeconds,
    );
    const escalateAfter = clamp(
      interaction.options.getInteger('escalate_after'),
      0,
      20,
      current.escalateAfter,
    );
    const escalateAction = interaction.options.getString('escalate_action') || current.escalateAction;
    const escalateWindowMinutes = clamp(
      interaction.options.getInteger('escalate_window_minutes'),
      1,
      1440,
      current.escalateWindowMinutes,
    );
    const bypassModerators = interaction.options.getBoolean('bypass_moderators');
    if (bypassModerators !== null) config.automod.settings.bypassModerators = bypassModerators;
    const dmUserOption = interaction.options.getBoolean('dm_user');
    const dmUser = dmUserOption === null ? current.dmUser !== false : dmUserOption;

    config.automod[moduleName] = {
      ...current,
      enabled,
      action,
      timeoutMinutes,
      limit,
      windowSeconds,
      escalateAfter,
      escalateAction,
      escalateWindowMinutes,
      dmUser,
    };

    if (moduleName === 'nsfw') {
      guildData.security ||= {};
      guildData.security.antinsfw = { enabled, action, timeoutMinutes, dmUser };
    }

    store.save();
    await dashboardConfigSync.persistAutoMod(interaction.guildId, config.automod, interaction.guild?.name || '');
    const rule = config.automod[moduleName];
    const details = [
      `Module: **${moduleName}**`,
      `Status: **${enabled ? 'Enabled' : 'Disabled'}**`,
      `Action: **${action}**${action === 'timeout' ? ` • ${formatDuration(timeoutMinutes * 60000)}` : ''}`,
      rule.limit ? `Limit: **${rule.limit}**${['spam', 'duplicate'].includes(moduleName) ? ` / ${rule.windowSeconds}s` : ''}` : null,
      rule.escalateAfter >= 2 ? `Escalation: **${rule.escalateAction}** after **${rule.escalateAfter}** violations / ${rule.escalateWindowMinutes} min` : 'Escalation: **Off**',
      `Moderator bypass: **${config.automod.settings.bypassModerators ? 'On' : 'Off'}**`,
      `Punishment DM: **${rule.dmUser !== false ? 'On' : 'Off'}**`,
    ].filter(Boolean).join('\n');

    return interaction.reply({ embeds: [embed('AutoMod Updated', details)] });
    }
  }

  if (name === 'antilink' || name === 'antiinvite') {
    const key = name === 'antilink' ? 'links' : 'invites';
    config.automod ||= {};
    config.automod.settings ||= {};
    const current = normalizeRule(key, config.automod[key] || {});
    const enabled = interaction.options.getBoolean('enabled', true);
    const action = interaction.options.getString('action') || current.action;
    const durationInput = interaction.options.getString('duration');
    const timeoutMinutes = durationInput === null ? current.timeoutMinutes : Math.round(parseDuration(durationInput) / 60000);
    const bypassModerators = interaction.options.getBoolean('bypass_moderators');
    if (bypassModerators !== null) config.automod.settings.bypassModerators = bypassModerators;
    const dmUserOption = interaction.options.getBoolean('dm_user');
    const dmUser = dmUserOption === null ? current.dmUser !== false : dmUserOption;
    config.automod[key] = { ...current, enabled, action, timeoutMinutes, dmUser };
    store.save();
    await dashboardConfigSync.persistAutoMod(interaction.guildId, config.automod, interaction.guild?.name || '');
    const label = name === 'antilink' ? 'Anti-Link' : 'Anti-Invite';
    return interaction.reply({
      embeds: [embed(
        `${label} Updated`,
        `Status: **${enabled ? 'Enabled' : 'Disabled'}**
Punishment: **${action}**${action === 'timeout' ? ` • ${formatDuration(timeoutMinutes * 60000)}` : ''}
Moderator bypass: **${config.automod.settings.bypassModerators ? 'On' : 'Off'}**
Punishment DM: **${config.automod[key].dmUser !== false ? 'On' : 'Off'}**`,
      )],
    });
  }

  if (name === 'antispam') {
    config.automod ||= {};
    config.automod.settings ||= {};
    const current = normalizeRule('spam', config.automod.spam || {});
    const enabled = interaction.options.getBoolean('enabled', true);
    const action = interaction.options.getString('action') || current.action;
    const durationInput = interaction.options.getString('duration');
    const timeoutMinutes = durationInput === null ? current.timeoutMinutes : Math.round(parseDuration(durationInput) / 60000);
    const messages = clamp(interaction.options.getInteger('messages'), 3, 20, current.limit || 6);
    const seconds = clamp(interaction.options.getInteger('seconds'), 2, 30, current.windowSeconds || 5);
    const bypassModerators = interaction.options.getBoolean('bypass_moderators');
    if (bypassModerators !== null) config.automod.settings.bypassModerators = bypassModerators;
    const dmUserOption = interaction.options.getBoolean('dm_user');
    const dmUser = dmUserOption === null ? current.dmUser !== false : dmUserOption;
    config.automod.spam = {
      ...current,
      enabled,
      action,
      timeoutMinutes,
      limit: messages,
      messages,
      windowSeconds: seconds,
      seconds,
      dmUser,
    };
    store.save();
    await dashboardConfigSync.persistAutoMod(interaction.guildId, config.automod, interaction.guild?.name || '');
    return interaction.reply({
      embeds: [embed(
        'Anti-Spam Updated',
        `Status: **${enabled ? 'Enabled' : 'Disabled'}**
Threshold: **${messages} messages / ${seconds}s**
Punishment: **${action}**${action === 'timeout' ? ` • ${formatDuration(timeoutMinutes * 60000)}` : ''}
Punishment DM: **${config.automod.spam.dmUser !== false ? 'On' : 'Off'}**`,
      )],
    });
  }

  if (name === 'badwords') {
    config.badwords ||= [];
    const action = interaction.options.getString('action', true);
    const word = interaction.options.getString('word')?.trim().toLowerCase();
    if (action === 'list') {
      return interaction.reply({
        embeds: [embed('Blocked Words', config.badwords.length ? config.badwords.map(item => `• ${item}`).join('\n') : 'No custom blocked words configured.')],
        ephemeral: true,
      });
    }
    if (!word) throw new Error('Provide a word or phrase for add/remove.');
    if (action === 'add' && !config.badwords.includes(word)) config.badwords.push(word);
    if (action === 'remove') config.badwords = config.badwords.filter(item => item !== word);
    store.save();
    return interaction.reply({
      embeds: [embed('Blocked Words Updated', `**${word}** ${action === 'add' ? 'added' : 'removed'}.`)],
      ephemeral: true,
    });
  }
}

async function reaction(reactionObject, user, added) {
  if (user.bot) return;
  try {
    if (reactionObject.partial) await reactionObject.fetch();
    const guildData = store.guild(reactionObject.message.guildId);
    const mapping = guildData.reactionRoles.find(
      item => item.messageId === reactionObject.message.id && item.emoji === reactionObject.emoji.toString(),
    );
    if (!mapping) return;
    const member = await reactionObject.message.guild.members.fetch(user.id);
    if (added) await member.roles.add(mapping.roleId);
    else if (mapping.mode !== 'permanent') await member.roles.remove(mapping.roleId);
  } catch {}
}

async function button(interaction) {
  if (interaction.customId.startsWith('rolebtn:')) {
    const roleId = interaction.customId.split(':')[1];
    const member = interaction.member;
    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId);
    else await member.roles.add(roleId);
    return interaction.reply({ content: 'Your role selection was updated.', ephemeral: true });
  }

  if (interaction.customId === 'verify:member') {
    const config = store.guild(interaction.guildId).config.verify;
    if (!config) return interaction.reply({ content: 'Verification is not configured.', ephemeral: true });
    if (config.unverifiedRoleId && interaction.member.roles.cache.has(config.unverifiedRoleId)) {
      await interaction.member.roles.remove(config.unverifiedRoleId).catch(() => {});
    }
    await interaction.member.roles.add(config.verifiedRoleId);
    return interaction.reply({ content: '✅ You are verified.', ephemeral: true });
  }
}

async function select(interaction) {
  if (interaction.customId !== 'rolemenu:toggle') return;
  for (const roleId of interaction.values) {
    if (interaction.member.roles.cache.has(roleId)) await interaction.member.roles.remove(roleId);
    else await interaction.member.roles.add(roleId);
  }
  return interaction.reply({ content: 'Your role selections were updated.', ephemeral: true });
}

async function memberAdd(member) {
  await dashboardConfigSync.syncGuild(member.guild.id);
  const config = store.guild(member.guild.id).config;
  const autoRole = config.autorole;
  const targetMatch = autoRole?.target === 'both'
    || (autoRole?.target === 'bots' && member.user.bot)
    || (autoRole?.target === 'members' && !member.user.bot);
  if (autoRole?.enabled && targetMatch) {
    const roleIds = autoRole.roleIds?.length ? autoRole.roleIds : [autoRole.roleId];
    setTimeout(() => Promise.all(roleIds.filter(Boolean).map(roleId => member.roles.add(roleId).catch(() => {}))), Math.max(0, autoRole.delay || 0) * 1000);
  }

  const handledByDashboard = await dashboardWelcome.memberAdd(member).catch(error => {
    console.error(`Dashboard welcome bridge failed in guild ${member.guild.id}:`, error.message);
    return false;
  });
  if (handledByDashboard) return;

  const welcome = config.welcome;
  if (welcome?.enabled) {
    const channel = member.guild.channels.cache.get(welcome.channelId);
    const content = String(welcome.message || 'Welcome {user} to **{server}**!')
      .replaceAll('{user}', `${member}`)
      .replaceAll('{server}', member.guild.name)
      .slice(0, 2000);
    const mediaUrl = welcome.media?.url;
    if (mediaUrl) {
      const cached = welcome.media?.data;
      const name = welcomeMediaName(welcome.media);
      const image = cached ? `attachment://${name}` : mediaUrl;
      const welcomeEmbed = embed('👋 Welcome!', content).setImage(image);
      const files = cached
        ? [{ attachment: Buffer.from(String(cached), 'base64'), name }]
        : undefined;
      await channel?.send({ embeds: [welcomeEmbed], ...(files ? { files } : {}) }).catch(() => {});
    } else {
      await channel?.send(content).catch(() => {});
    }
  }
}

async function memberRemove(member) {
  await dashboardConfigSync.syncGuild(member.guild.id);
  const handledByDashboard = await dashboardLeave.memberRemove(member).catch(error => {
    console.error(`Dashboard leave bridge failed in guild ${member.guild.id}:`, error.message);
    return false;
  });
  if (handledByDashboard) return;

  const goodbye = store.guild(member.guild.id).config.goodbye;
  if (goodbye?.enabled) {
    const channel = member.guild.channels.cache.get(goodbye.channelId);
    await channel?.send(goodbye.message.replaceAll('{user}', member.user.tag).replaceAll('{server}', member.guild.name)).catch(() => {});
  }
}

async function message(messageObject) {
  if (!messageObject.guild || messageObject.author.bot || messageObject.deleted) return;
  await dashboardConfigSync.syncGuild(messageObject.guild.id);
  const guildData = store.guild(messageObject.guild.id);
  const automod = guildData.config.automod || {};
  if (isAutomodBypassed(messageObject, automod)) return;

  const text = messageObject.content || '';
  const lower = text.toLowerCase();
  let reason = null;
  let rule = null;
  let moduleName = null;

  const selectRule = (name, message) => {
    if (reason) return;
    const candidate = normalizeRule(name, automod[name] || {});
    if (!candidate.enabled) return;
    reason = message;
    rule = candidate;
    moduleName = name;
  };

  if (automod.phishing?.enabled && URL_REGEX.test(text) && PHISHING_HINT_REGEX.test(lower)) {
    selectRule('phishing', 'A suspicious phishing or fake-gift link was detected.');
  }

  if (!reason && automod.invites?.enabled && INVITE_REGEX.test(text)) {
    selectRule('invites', 'Discord invite links are blocked here.');
  }

  if (!reason && automod.links?.enabled && URL_REGEX.test(text)) {
    selectRule('links', 'Links are blocked here.');
  }

  if (!reason && automod.badwords?.enabled) {
    const blockedWords = guildData.config.badwords || [];
    if (blockedWords.some(word => word && lower.includes(String(word).toLowerCase()))) {
      selectRule('badwords', 'A blocked word or phrase was detected.');
    }
  }

  if (!reason && automod.mentions?.enabled) {
    const candidate = normalizeRule('mentions', automod.mentions);
    const mentionCount = messageObject.mentions.users.size
      + messageObject.mentions.roles.size;
    if (messageObject.mentions.everyone) {
      reason = 'Everyone/here mentions are blocked by AutoMod.';
      rule = candidate;
      moduleName = 'mentions';
    } else if (mentionCount >= Math.max(1, candidate.limit || 5)) {
      reason = `Mass mentions are blocked (${mentionCount} detected).`;
      rule = candidate;
      moduleName = 'mentions';
    }
  }

  if (!reason && automod.emoji?.enabled) {
    const candidate = normalizeRule('emoji', automod.emoji);
    const emojiCount = countEmoji(text);
    if (emojiCount >= Math.max(1, candidate.limit || 12)) {
      reason = `Emoji spam detected (${emojiCount} emoji).`;
      rule = candidate;
      moduleName = 'emoji';
    }
  }

  if (!reason && automod.caps?.enabled && text.length > 12) {
    const candidate = normalizeRule('caps', automod.caps);
    const letters = text.replace(/[^a-z]/gi, '');
    const upper = letters.replace(/[^A-Z]/g, '');
    const ratio = letters.length ? Math.round((upper.length / letters.length) * 100) : 0;
    if (letters.length > 10 && ratio >= Math.max(50, candidate.limit || 75)) {
      reason = `Excessive caps detected (${ratio}% uppercase).`;
      rule = candidate;
      moduleName = 'caps';
    }
  }

  if (!reason && automod.duplicate?.enabled && text.trim().length >= 4) {
    const candidate = normalizeRule('duplicate', automod.duplicate);
    const key = `${messageObject.guild.id}:${messageObject.author.id}`;
    const now = Date.now();
    const normalized = lower.replace(/\s+/g, ' ').trim();
    const history = (duplicates.get(key) || []).filter(item => now - item.at < candidate.windowSeconds * 1000);
    history.push({ text: normalized, at: now });
    duplicates.set(key, history.slice(-25));
    const repeats = history.filter(item => item.text === normalized).length;
    if (repeats >= Math.max(2, candidate.limit || 3)) {
      reason = `Repeated-message spam detected (${repeats} duplicates).`;
      rule = candidate;
      moduleName = 'duplicate';
    }
  }

  if (!reason && automod.spam?.enabled) {
    const candidate = normalizeRule('spam', automod.spam);
    const key = `${messageObject.guild.id}:${messageObject.author.id}`;
    const now = Date.now();
    const windowSeconds = candidate.windowSeconds || candidate.seconds || 5;
    const limit = candidate.limit || candidate.messages || 6;
    const history = (spam.get(key) || []).filter(timestamp => now - timestamp < windowSeconds * 1000);
    history.push(now);
    spam.set(key, history.slice(-50));
    if (history.length >= Math.max(3, limit)) {
      reason = `Spam detected (${history.length} messages / ${windowSeconds}s).`;
      rule = candidate;
      moduleName = 'spam';
    }
  }

  if (!reason || !rule || !moduleName) return;
  await applyAutoModAction(messageObject, guildData, rule, reason, moduleName);
}

function formatAutoModModule(moduleName) {
  const labels = {
    links: 'Anti-Link',
    invites: 'Anti-Invite',
    spam: 'Anti-Spam',
    duplicate: 'Duplicate Message Protection',
    phishing: 'Anti-Phishing',
    mentions: 'Mention Spam Protection',
    caps: 'Caps Protection',
    emoji: 'Emoji Spam Protection',
    badwords: 'Bad Word Filter',
    nsfw: 'Anti-NSFW',
  };
  return labels[moduleName] || `AutoMod: ${moduleName}`;
}

async function sendAutoModDm(messageObject, { action, reason, moduleName, timeoutMinutes, escalated }) {
  if (action === 'delete') return false;
  const hours = Math.max(1, Math.round(timeoutMinutes / 60));
  const lines = [
    `Server: **${messageObject.guild.name}**`,
    `Violation: **${formatAutoModModule(moduleName)}**`,
    `Action: **${action.toUpperCase()}**${action === 'timeout' ? ` for **${hours} hour(s)**` : ''}`,
    `Reason: ${reason}`,
    escalated ? 'Escalation: **Triggered**' : null,
    `Time: <t:${Math.floor(Date.now() / 1000)}:F>`,
    '',
    'If you believe this was a mistake, contact the server staff.',
  ].filter(Boolean).join('\n');

  try {
    await messageObject.author.send({
      embeds: [embed('🛡️ Astrix AutoMod Notice', lines).setFooter({ text: 'Powered by Astrix Moderation' })],
    });
    return true;
  } catch {
    return false;
  }
}

async function applyAutoModAction(messageObject, guildData, rule, reason, moduleName) {
  const timeoutMinutes = clamp(rule?.timeoutMinutes, 60, 40320, 60);
  let action = rule?.action || 'delete';
  let escalated = false;

  if (Number(rule?.escalateAfter || 0) >= 2) {
    const count = violationCount(
      messageObject.guild.id,
      messageObject.author.id,
      moduleName,
      clamp(rule.escalateWindowMinutes, 1, 1440, 10),
    );
    if (count >= Number(rule.escalateAfter)) {
      action = rule.escalateAction || 'timeout';
      escalated = true;
    }
  }

  await messageObject.delete().catch(() => {});

  const dmEnabled = rule?.dmUser !== false;
  const dmSent = dmEnabled
    ? await sendAutoModDm(messageObject, { action, reason, moduleName, timeoutMinutes, escalated })
    : false;

  let result = 'Message deleted';
  guildData.warnings ||= {};

  if (action === 'warn') {
    guildData.warnings[messageObject.author.id] ||= [];
    guildData.warnings[messageObject.author.id].push({
      reason: `AutoMod (${moduleName}): ${reason}`,
      by: messageObject.client.user.id,
      at: Date.now(),
    });
    store.save();
    result = 'Warning added';
  } else if (action === 'timeout') {
    if (messageObject.member?.moderatable) {
      await messageObject.member.timeout(timeoutMinutes * 60 * 1000, `Astrix AutoMod (${moduleName}): ${reason}`).catch(() => {});
      result = `Timed out for ${formatDuration(timeoutMinutes * 60000)}`;
    } else result = 'Message deleted; timeout unavailable due to role hierarchy';
  } else if (action === 'kick') {
    if (messageObject.member?.kickable) {
      await messageObject.member.kick(`Astrix AutoMod (${moduleName}): ${reason}`).catch(() => {});
      result = 'Member kicked';
    } else result = 'Message deleted; kick unavailable due to role hierarchy';
  } else if (action === 'ban') {
    if (messageObject.member?.bannable) {
      await messageObject.member.ban({ reason: `Astrix AutoMod (${moduleName}): ${reason}` }).catch(() => {});
      result = 'Member banned';
    } else result = 'Message deleted; ban unavailable due to role hierarchy';
  }

  const logChannel = guildData.config.logChannelId && messageObject.guild.channels.cache.get(guildData.config.logChannelId);
  await logChannel?.send({
    embeds: [embed(
      '🛡️ AutoMod Action',
      `${messageObject.author} • ${reason}
Module: **${moduleName}**
Channel: ${messageObject.channel}
Punishment: **${result}**${escalated ? '\nEscalation: **Triggered**' : ''}
DM: **${dmEnabled ? (dmSent ? 'Sent' : 'Could not deliver') : 'Disabled'}**`,
    )],
  }).catch(() => {});
}

module.exports = { command, reaction, button, select, memberAdd, memberRemove, message };
