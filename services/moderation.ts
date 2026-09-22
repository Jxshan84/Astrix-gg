const { parseDuration, formatDuration } = require('../utils/duration.ts');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const { embed } = require('./ui.ts');
const dashboardConfig = require('./guildConfigService.ts');
const auditLogs = require('./logging.ts');
const moderationUpgrade = require('./moderation-upgrade.ts');

function warningEmbed(i, user, reason, warningCount, caseId = null) {
  const bot = i.client?.user;
  const targetAvatar = user?.displayAvatarURL?.({ extension: 'png', size: 256 });
  const moderatorTag = i.user?.tag || i.user?.username || 'Unknown moderator';
  const note = 'Please avoid issuing warnings unnecessarily or as a joke. Accumulating too many warnings can automatically result in a mute, kick, or even a ban. Use the warning system responsibly to maintain a fair and respectful environment.';
  const card = embed('User Warned', null, 0xf59e0b)
    .setAuthor({
      name: `${bot?.username || 'Astrix'} Moderation`,
      ...(bot?.displayAvatarURL ? { iconURL: bot.displayAvatarURL({ extension: 'png', size: 128 }) } : {})
    })
    .addFields(
      { name: '🎯 TARGET:', value: `${user}\n\`${user?.tag || user?.username || user?.id}\`` },
      { name: '🛠️ MODERATOR:', value: `<@${i.user.id}>\n\`${moderatorTag}\`` },
      { name: '🗂️ REASON:', value: String(reason || 'No reason provided.').slice(0, 1024) }
    )
    .setFooter({ text: `Astrix Moderation${caseId ? ` • Case #${caseId}` : ''}` });
  if (targetAvatar) card.setThumbnail(targetAvatar);
  if (warningCount) card.addFields({ name: '📋 WARNING COUNT:', value: `This member now has **${warningCount}** warning(s).` });
  card.addFields({ name: '🟡 NOTE:', value: note });
  return card;
}

function need(i, permission) {
  if (!i.memberPermissions?.has(permission)) {
    throw new Error('You do not have permission to use this moderation command.');
  }
}

function highestRolePosition(member) {
  return member?.roles?.highest?.position ?? 0;
}

function botHighestRole(i) {
  return highestRolePosition(i.guild.members.me);
}

function ensureRoleHierarchy(i, member, role) {
  if (!member || member.id === i.guild.ownerId) {
    throw new Error('The server owner cannot be managed.');
  }
  if (highestRolePosition(member) >= botHighestRole(i)) {
    throw new Error('Astrix cannot manage that member because their highest role is above or equal to mine.');
  }

  if (role.managed) {
    throw new Error('Managed integration roles cannot be changed.');
  }

  if (role.position >= botHighestRole(i)) {
    throw new Error('That role is above or equal to my highest role.');
  }

}

function ensureTargetHierarchy(i, member) {
  if (!member || member.id === i.user.id) {
    throw new Error('You cannot moderate yourself.');
  }
  if (member.id === i.guild.ownerId) {
    throw new Error('The server owner cannot be muted.');
  }
  if (highestRolePosition(member) >= botHighestRole(i)) {
    throw new Error('I cannot moderate that member because their highest role is above or equal to mine.');
  }
  if (member.manageable === false) {
    throw new Error('Astrix cannot manage that member because Discord hierarchy does not allow it.');
  }
}

function ensureMuteRoleHierarchy(i, role) {
  if (role.managed) {
    throw new Error('The configured Muted role is managed by an integration and cannot be used.');
  }
  if (role.position >= botHighestRole(i)) {
    throw new Error('The Muted role is above or equal to my highest role. Move it below Astrix and try again.');
  }
}

function ensureMassRoleHierarchy(i, role) {
  if (role.managed) {
    throw new Error('Managed integration roles cannot be changed.');
  }
  if (role.position >= botHighestRole(i)) {
    throw new Error('That role is above or equal to my highest role.');
  }
}

const MUTE_ROLE_COLORS = {
  blurple: '#5865F2',
  blue: '#3498DB',
  green: '#2ECC71',
  red: '#E74C3C',
  orange: '#E67E22',
  yellow: '#F1C40F',
  purple: '#9B59B6',
  pink: '#E91E63',
  gray: '#95A5A6',
  grey: '#95A5A6',
  black: '#000000',
  white: '#FFFFFF'
};

const MUTE_CHANNEL_PERMISSIONS = {
  SendMessages: false,
  AddReactions: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  SendMessagesInThreads: false,
  Speak: false,
  Stream: false,
  UseVAD: false
};

const QUARANTINE_CHANNEL_PERMISSIONS = {
  ViewChannel: false,
  SendMessages: false,
  AddReactions: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  SendMessagesInThreads: false,
  Speak: false,
  Stream: false,
  UseVAD: false
};

const QUARANTINE_ROOM_PERMISSIONS = {
  ViewChannel: true,
  ReadMessageHistory: true,
  SendMessages: true,
  AddReactions: true,
  SendMessagesInThreads: true
};

function muteRoleColor(value) {
  const raw = String(value || 'blurple').trim().toLowerCase();
  const color = MUTE_ROLE_COLORS[raw] || (raw.startsWith('#') ? raw : `#${raw}`);
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error('Invalid mute role color. Use a color name such as `red` or a hex value such as `#ff0000`.');
  }
  return color.toUpperCase();
}

function configuredMuteRole(guild, config = guild?.config || {}) {
  const id = config?.muteRoleId;
  const configured = id ? guild.roles.cache.get(id) : null;
  if (configured) return configured;
  return guild.roles.cache.find(role => role.name === 'Muted' && !role.managed) || null;
}

function muteRoleForInteraction(i) {
  const role = configuredMuteRole(i.guild, store.guild(i.guildId).config);
  if (!role) throw new Error('Muted role is not configured. Run `/muterole create` first.');
  ensureMuteRoleHierarchy(i, role);
  return role;
}

function muteRoleProgress(role, total, done, skipped, failed, entries, complete = false) {
  const visible = entries.slice(-12).join('\n') || 'Waiting for channel processing…';
  const heading = complete ? '✅ Muted role setup complete.' : '⏳ Applying Muted permissions…';
  return `${heading}\n\nRole: ${role}\nProgress: **${done}/${total}** processed\n✅ Updated: **${Math.max(0, done - skipped - failed)}** • ⏭️ Skipped: **${skipped}** • ❌ Failed: **${failed}**\n\n${visible}`;
}

async function muteRoleCreate(i) {
  need(i, PermissionFlagsBits.ManageRoles);
  need(i, PermissionFlagsBits.ManageChannels);
  if (!i.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Astrix needs the Manage Roles permission to create and manage the Muted role.');
  }
  if (!i.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Astrix needs the Manage Channels permission to apply Muted permissions.');
  }

  const color = muteRoleColor(i.options.getString('color'));
  await i.deferReply({ ephemeral: true });

  const guildData = store.guild(i.guildId);
  let role = configuredMuteRole(i.guild, guildData.config);
  let created = false;
  if (role) {
    ensureMuteRoleHierarchy(i, role);
    await role.edit({ color, reason: `Muted role setup by ${i.user.tag}` });
  } else {
    role = await i.guild.roles.create({
      name: 'Muted',
      color,
      mentionable: false,
      reason: `Muted role setup by ${i.user.tag}`
    });
    created = true;
    ensureMuteRoleHierarchy(i, role);
  }

  guildData.config.muteRoleId = role.id;
  guildData.config.muteRoleColor = color;
  store.save();

  let done = 0;
  let skipped = 0;
  let failed = 0;
  const entries = [`${created ? '✅ Created' : '🔧 Reusing'} ${role} with color **${color}**.`];
  let channels;
  try {
    channels = await i.guild.channels.fetch();
  } catch (error) {
    failed++;
    entries.push(`❌ Could not fetch the server channel list — ${String(error.message || 'channel fetch failed').slice(0, 120)}`);
    return i.editReply({
      embeds: [embed('Muted Role Setup Failed', muteRoleProgress(role, 0, done, skipped, failed, entries, true))]
    });
  }
  const channelList = [...channels.values()].filter(Boolean);
  const editProgress = () => i.editReply({
    embeds: [embed('Mute Role Setup', muteRoleProgress(role, channelList.length, done, skipped, failed, entries))]
  });

  await editProgress();
  for (const channel of channelList) {
    if (!channel.permissionOverwrites?.edit) {
      skipped++;
      done++;
      entries.push(`⏭️ **${channel.name || channel.id}** — no permission overwrites available.`);
    } else {
      try {
        await channel.permissionOverwrites.edit(role, MUTE_CHANNEL_PERMISSIONS, {
          reason: `Muted role channel setup by ${i.user.tag}`
        });
        done++;
        entries.push(`✅ **${channel.name || channel.id}** — mute permissions applied.`);
      } catch (error) {
        done++;
        failed++;
        entries.push(`❌ **${channel.name || channel.id}** — ${String(error.message || 'permission update failed').slice(0, 120)}`);
      }
    }
    if (done % 2 === 0 || done === channelList.length) await editProgress();
  }

  return i.editReply({
    embeds: [embed('Muted Role Ready', muteRoleProgress(role, channelList.length, done, skipped, failed, entries, true))]
  });
}

async function muteMember(i, action, moderationConfig = null) {
  need(i, PermissionFlagsBits.ManageRoles);
  if (!i.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Astrix needs the Manage Roles permission to mute members.');
  }
  const user = i.options.getUser('user', true);
  const member = await i.guild.members.fetch(user.id);
  ensureTargetHierarchy(i, member);
  const role = muteRoleForInteraction(i);
  const reason = i.options.getString('reason') || `Mute role action by ${i.user.tag}`;
  const guildData = ensureAdvancedStores(store.guild(i.guildId));
  const durationText = action === 'mute' ? i.options.getString('duration') : null;
  const durationMs = durationText ? parseDuration(durationText) : null;
  guildData.tempMutes = (guildData.tempMutes || []).filter(entry => entry.userId !== user.id);
  if (action === 'mute') {
    await member.roles.add(role, reason);
    if (durationMs) guildData.tempMutes.push({
      userId: user.id,
      roleId: role.id,
      until: Date.now() + durationMs,
      reason
    });
  } else {
    await member.roles.remove(role, reason);
  }
  store.save();
  await tryDm(
    user,
    action === 'mute' ? `You were muted in ${i.guild.name}` : `Your mute was removed in ${i.guild.name}`,
    action === 'mute'
      ? `${durationMs ? `Duration: ${formatDuration(durationMs)}\n` : ''}Reason: ${reason}`
      : `Reason: ${reason}`,
    moderationConfig
  );
  return i.reply({
    embeds: [embed(action === 'mute' ? 'Member Muted' : 'Member Unmuted',
      `${user} was ${action === 'mute' ? 'given' : 'removed from'} the ${role} role.${durationMs ? `\nDuration: **${formatDuration(durationMs)}**` : ''}\nReason: ${reason}`)]
  });
}

function configuredQuarantineRole(guild, config = guild?.config || {}) {
  const id = config?.quarantineRoleId;
  const configured = id ? guild.roles.cache.get(id) : null;
  if (configured) return configured;
  return guild.roles.cache.find(role => role.name.toLowerCase() === 'quarantine' && !role.managed) || null;
}

async function quarantineRoleForInteraction(i, requestedChannel = null) {
  need(i, PermissionFlagsBits.ManageRoles);
  need(i, PermissionFlagsBits.ManageChannels);
  if (!i.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Astrix needs the Manage Roles permission to create and manage the Quarantine role.');
  }
  if (!i.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Astrix needs the Manage Channels permission to apply Quarantine permissions.');
  }

  const guildData = ensureAdvancedStores(store.guild(i.guildId));
  let role = configuredQuarantineRole(i.guild, guildData.config);
  let created = false;
  if (role) {
    if (role.managed) throw new Error('The configured Quarantine role is managed by an integration and cannot be used.');
    if (role.position >= botHighestRole(i)) {
      throw new Error('The Quarantine role is above or equal to my highest role. Move it below Astrix and try again.');
    }
  } else {
    role = await i.guild.roles.create({
      name: 'Quarantine',
      color: '#E74C3C',
      mentionable: false,
      reason: `Quarantine role created by ${i.user.tag}`
    });
    created = true;
  }

  guildData.config.quarantineRoleId = role.id;
  let quarantineChannel = requestedChannel;
  if (quarantineChannel) {
    if (quarantineChannel.guild?.id !== i.guild.id || ![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(quarantineChannel.type)) {
      throw new Error('Choose a text-based server channel for Quarantine.');
    }
  } else {
    quarantineChannel = guildData.config.quarantineChannelId
      ? i.guild.channels.cache.get(guildData.config.quarantineChannelId)
      : null;
    if (!quarantineChannel) {
      quarantineChannel = i.guild.channels.cache.find(channel =>
        channel.name?.toLowerCase() === 'quarantine'
        && [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type)
      );
    }
  }

  let channelCreated = false;
  if (!quarantineChannel) {
    quarantineChannel = await i.guild.channels.create({
      name: 'quarantine',
      type: ChannelType.GuildText,
      topic: 'Private channel for quarantined members.',
      reason: `Quarantine channel created by ${i.user.tag}`
    });
    channelCreated = true;
  }
  if (!quarantineChannel?.permissionOverwrites?.edit) {
    throw new Error('The selected Quarantine channel cannot be configured by Astrix.');
  }
  guildData.config.quarantineChannelId = quarantineChannel.id;

  // Permission overwrites are guild-wide setup, not part of every jail
  // operation. Re-running one REST request per channel made /jail take
  // several minutes in larger servers and Discord then showed
  // "This application did not respond".
  const setup = guildData.config.quarantinePermissions;
  const setupIsCurrent = setup?.roleId === role.id && setup?.channelId === quarantineChannel.id;
  if (!setupIsCurrent) {
    const channels = await i.guild.channels.fetch().catch(() => new Map());
    const configurable = [...channels.values()].filter(channel => channel?.permissionOverwrites?.edit);
    let setupSucceeded = true;
    const configure = async channel => {
      if (channel.id === quarantineChannel.id) {
        await Promise.all([
          channel.permissionOverwrites.edit(i.guild.roles.everyone, {
            ViewChannel: false,
            SendMessages: false
          }, { reason: `Quarantine channel privacy configured by ${i.user.tag}` }),
          channel.permissionOverwrites.edit(role, QUARANTINE_ROOM_PERMISSIONS, {
            reason: `Quarantine channel access configured by ${i.user.tag}`
          }),
          channel.permissionOverwrites.edit(i.guild.members.me, {
            ViewChannel: true,
            ReadMessageHistory: true,
            SendMessages: true,
            SendMessagesInThreads: true
          }, { reason: `Astrix access configured for Quarantine channel` })
        ]);
      } else {
        await channel.permissionOverwrites.edit(role, QUARANTINE_CHANNEL_PERMISSIONS, {
          reason: `Quarantine restrictions configured by ${i.user.tag}`
        });
      }
    };

    // Discord rate-limits these requests, but small batches avoid the
    // unnecessary serial delay while still letting discord.js queue safely.
    for (let index = 0; index < configurable.length; index += 8) {
      const results = await Promise.allSettled(configurable.slice(index, index + 8).map(configure));
      if (results.some(result => result.status === 'rejected')) setupSucceeded = false;
    }
    if (setupSucceeded) {
      guildData.config.quarantinePermissions = {
        roleId: role.id,
        channelId: quarantineChannel.id,
        configuredAt: Date.now()
      };
    } else {
      delete guildData.config.quarantinePermissions;
    }
  }
  store.save();
  return { role, created, quarantineChannel, channelCreated };
}

async function jailMember(i, action, moderationConfig) {
  need(i, PermissionFlagsBits.ManageRoles);
  if (!i.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Astrix needs the Manage Roles permission to jail members.');
  }

  const user = i.options.getUser('user', true);
  const member = await i.guild.members.fetch(user.id);
  ensureTargetHierarchy(i, member);
  const reason = reasonFor(i, moderationConfig, action);
  const guildData = ensureAdvancedStores(store.guild(i.guildId));

  if (action === 'jail') {
    const requestedChannel = i.options.getChannel('channel');
    const durationText = i.options.getString('duration');
    const durationMs = durationText ? parseDuration(durationText) : null;
    const { role, created, quarantineChannel, channelCreated } = await quarantineRoleForInteraction(i, requestedChannel);
    const currentRoles = member.roles.cache
      .filter(currentRole => currentRole.id !== i.guild.id && currentRole.id !== role.id && !currentRole.managed)
      .map(currentRole => currentRole.id);
    if (!guildData.quarantines[user.id]) {
      guildData.quarantines[user.id] = { roleIds: currentRoles, at: Date.now(), by: i.user.id };
    }
    guildData.quarantines[user.id].until = durationMs ? Date.now() + durationMs : null;
    guildData.quarantines[user.id].reason = reason;
    for (const roleId of currentRoles) {
      await member.roles.remove(roleId, reason).catch(() => {});
    }
    await member.roles.add(role, reason);
    store.save();
    await tryDm(
      user,
      `You were quarantined in ${i.guild.name}`,
      `All of your server roles were temporarily removed and the ${role.name} role was applied.${durationMs ? `\nDuration: ${formatDuration(durationMs)}` : ''}\nReason: ${reason}`,
      moderationConfig
    );
    await log(i, 'Member Quarantined', `${user.tag} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.editReply({
      embeds: [embed('Member Quarantined', `${user} was jailed with ${role}.${durationMs ? `\nDuration: **${formatDuration(durationMs)}**` : '\nDuration: **Permanent until unjail**'}\nQuarantine channel: ${quarantineChannel}${created ? '\nThe Quarantine role was created.' : ''}${channelCreated ? '\nThe Quarantine channel was created.' : ''}\nThey can only see the Quarantine channel now.\nReason: ${reason}`)]
    });
  }

  const role = configuredQuarantineRole(i.guild, guildData.config);
  const saved = guildData.quarantines[user.id];
  if (!saved && (!role || !member.roles.cache.has(role.id))) {
    throw new Error('That member is not currently quarantined.');
  }
  if (role && member.roles.cache.has(role.id)) await member.roles.remove(role, reason);

  let restored = 0;
  for (const roleId of saved?.roleIds || []) {
    const previousRole = i.guild.roles.cache.get(roleId);
    if (!previousRole || previousRole.managed) continue;
    await member.roles.add(previousRole, reason).then(() => restored++).catch(() => {});
  }
  delete guildData.quarantines[user.id];
  store.save();
  await tryDm(
    user,
    `You were released from quarantine in ${i.guild.name}`,
    `${restored} of your previous server role(s) were restored.\nReason: ${reason}`,
    moderationConfig
  );
  await log(i, 'Member Released', `${user.tag} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
  return i.editReply({
    embeds: [embed('Member Released', `${user} was unjailed and **${restored}** previous role(s) were restored.\nReason: ${reason}`)]
  });
}

async function muteRole(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'create') return muteRoleCreate(i);
  if (sub === 'mute' || sub === 'unmute') return muteMember(i, sub);
  throw new Error('Use `/muterole create`, `/muterole mute`, or `/muterole unmute`.');
}

function prefixTargetMember(message, args) {
  const mentioned = message.mentions?.members?.first?.();
  if (mentioned) return mentioned;
  const id = args.find(value => /^\d{15,25}$/.test(value));
  const member = id ? message.guild.members.cache.get(id) : null;
  if (!member) throw new Error('Mention a server member or provide their Discord user ID.');
  return member;
}

function ensurePrefixTargetHierarchy(message, member) {
  if (!member || member.id === message.author.id) throw new Error('You cannot moderate yourself.');
  if (member.id === message.guild.ownerId) throw new Error('The server owner cannot be muted.');
  const targetPosition = member.roles?.highest?.position ?? 0;
  const botPosition = message.guild.members.me?.roles?.highest?.position ?? 0;
  if (targetPosition >= botPosition) throw new Error('Astrix cannot moderate that member because their highest role is above or equal to mine.');
  if (member.manageable === false) throw new Error('Astrix cannot manage that member because Discord hierarchy does not allow it.');
}

function prefixModerationReason(message, args, target) {
  const targetTokens = new Set([target.id, `<@${target.id}>`, `<@!${target.id}>`]);
  return args.filter(value => !targetTokens.has(value))
    .filter(value => !/^\d+[mhdw]$/i.test(value))
    .join(' ').trim() || `Action by ${message.author.tag}`;
}

function getPrefix(guildId) {
  const config = store.guild(guildId).config || {};
  return String(config.prefix || process.env.DEFAULT_PREFIX || 'a!');
}

async function prefixMute(message, cmd, args) {
  if (!message.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('You need the **Manage Roles** permission to use this moderation command.');
  }
  if (!message.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Astrix needs the Manage Roles permission to mute members.');
  }
  const target = prefixTargetMember(message, args);
  ensurePrefixTargetHierarchy(message, target);
  const guildData = store.guild(message.guild.id);
  const role = configuredMuteRole(message.guild, guildData.config);
  if (!role) throw new Error(`Muted role is not configured. Run \`${getPrefix(message.guild.id)}muterole create\` first.`);
  if (role.managed) throw new Error('The configured Muted role is managed by an integration and cannot be used.');
  if (role.position >= (message.guild.members.me.roles.highest.position || 0)) {
    throw new Error('I cannot manage the Muted role because it is above my highest role.');
  }
  const reason = prefixModerationReason(message, args, target);
  if (cmd === 'mute') await target.roles.add(role, reason);
  else await target.roles.remove(role, reason);
  await message.reply({ embeds: [embed(cmd === 'mute' ? 'Member Muted' : 'Member Unmuted', `${target} was ${cmd === 'mute' ? 'given' : 'removed from'} ${role}.\nReason: ${reason}`)] });
  return true;
}

async function dashboardGuard(i, commandName) {
  const ctx = await dashboardConfig.getModerationContext(i.guildId, commandName);
  const { moderation, command } = ctx;

  if (!command.enabled) {
    throw new Error(`/${commandName} is disabled for this server in the Astrix Dashboard.`);
  }

  if (!dashboardConfig.isChannelAllowed(i.channelId, command)) {
    throw new Error(`/${commandName} is not allowed in this channel.`);
  }

  if (!dashboardConfig.hasConfiguredRole(i, moderation, command)) {
    throw new Error('Your roles are not allowed to use this moderation command in the Astrix Dashboard settings.');
  }

  const remaining = dashboardConfig.checkCooldown(i, commandName, command.cooldown);
  if (remaining > 0) {
    const seconds = Math.max(1, Math.ceil(remaining / 1000));
    throw new Error(`Please wait ${seconds} second(s) before using /${commandName} again.`);
  }

  return ctx;
}

async function log(i, title, description, moderationConfig = null) {
  if (moderationConfig?.logChannelId) {
    const channel = i.guild.channels.cache.get(moderationConfig.logChannelId)
      || await i.guild.channels.fetch(moderationConfig.logChannelId).catch(() => null);
    if (channel?.send) {
      await channel.send({
        embeds: [embed(title, description)],
        allowedMentions: { parse: [] }
      }).catch(() => {});
      return;
    }
  }
  await auditLogs.sendLocal(i.guild, title, description);
  await auditLogs.sendGlobal(i.client, `Moderation • ${title}`, description, {
    guildName: i.guild.name,
    guildId: i.guild.id
  });
}

async function tryDm(user, title, description, moderationConfig) {
  if (moderationConfig?.dmModeratedUser === false) return;
  await user.send({ embeds: [embed(title, description)] }).catch(() => {});
}

function reasonFor(i, moderationConfig, commandName) {
  // Reasons are useful audit metadata, but must remain optional for every
  // moderation command, including servers with the old requireReason flag.
  const supplied = i.options.getString('reason')?.trim();
  return supplied || `Action by ${i.user.tag}`;
}

async function action(i, name) {
  const ctx = await dashboardGuard(i, name);
  const moderationConfig = ctx.moderation;
  const user = i.options.getUser('user');

  if (name === 'jail' || name === 'unjail') {
    // Quarantine setup touches many channels and can exceed Discord's
    // three-second initial response window.
    await i.deferReply();
    return jailMember(i, name, moderationConfig);
  }
  const reason = reasonFor(i, moderationConfig, name);
  if (name === 'mute' || name === 'unmute') {
    return muteMember(i, name, moderationConfig);
  }

  if (name === 'ban') {
    need(i, PermissionFlagsBits.BanMembers);
    const member = await i.guild.members.fetch(user.id);
    ensureTargetHierarchy(i, member);
    if (!member.bannable) throw new Error('I cannot ban that member. Check role hierarchy.');
    await tryDm(user, `You were banned from ${i.guild.name}`, `Reason: ${reason}`, moderationConfig);
    await member.ban({ reason });
    await log(i, 'Ban', `${user.tag} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('Member Banned', `${user} has been banned.\nReason: ${reason}`)] });
  }

  if (name === 'unban') {
    need(i, PermissionFlagsBits.BanMembers);
    const id = i.options.getString('user_id', true);
    await i.guild.members.unban(id, reason);
    await log(i, 'Unban', `User ID ${id} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('User Unbanned', `User ID **${id}** was unbanned.`)] });
  }

  if (name === 'kick') {
    need(i, PermissionFlagsBits.KickMembers);
    const member = await i.guild.members.fetch(user.id);
    ensureTargetHierarchy(i, member);
    if (!member.kickable) throw new Error('I cannot kick that member.');
    await tryDm(user, `You were kicked from ${i.guild.name}`, `Reason: ${reason}`, moderationConfig);
    await member.kick(reason);
    await log(i, 'Kick', `${user.tag} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('Member Kicked', `${user} has been kicked.\nReason: ${reason}`)] });
  }

  if (name === 'timeout' || name === 'untimeout') {
    need(i, PermissionFlagsBits.ModerateMembers);
    const member = await i.guild.members.fetch(user.id);
    ensureTargetHierarchy(i, member);
    const durationText = name === 'timeout' ? i.options.getString('duration', true) : null;
    const ms = durationText ? parseDuration(durationText) : null;
    await tryDm(user, name === 'timeout' ? `You were timed out in ${i.guild.name}` : `Your timeout was removed in ${i.guild.name}`, name === 'timeout' ? `Duration: ${formatDuration(ms)}\nReason: ${reason}` : `Reason: ${reason}`, moderationConfig);
    await member.timeout(ms, reason);
    await log(i, name === 'timeout' ? 'Timeout' : 'Timeout Removed', `${user.tag} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed(name === 'timeout' ? 'Member Timed Out' : 'Timeout Removed', `${user} ${name === 'timeout' ? `for ${formatDuration(ms)}` : ''}.`)] });
  }

  if (name === 'warn') {
    need(i, PermissionFlagsBits.ModerateMembers);
    const member = await i.guild.members.fetch(user.id);
    ensureTargetHierarchy(i, member);
    const guildData = store.guild(i.guildId);
    guildData.warnings[user.id] ||= [];
    guildData.warnings[user.id].push({ reason, by: i.user.id, at: Date.now() });
    const caseRecord = createCase(i, 'warn', user.id, reason);
    const escalation = await moderationUpgrade.escalateWarning(i, member, guildData, reason);
    store.save();
    await tryDm(user, `You received a warning in ${i.guild.name}`, `Reason: ${reason}`, moderationConfig);
    await log(i, 'Warning', `${user.tag} • Case #${caseRecord.id} • ${reason} • Moderator: ${i.user.tag}`, moderationConfig);
    const escalationText = escalation?.skipped
      ? `\nEscalation skipped: **${escalation.reason}**`
      : escalation && !escalation.repeated
        ? `\nEscalation applied: **${escalation.action}**`
        : '';
    return i.reply({ embeds: [warningEmbed(i, user, reason, guildData.warnings[user.id].length, caseRecord.id).setDescription(`${warningEmbed(i, user, reason, guildData.warnings[user.id].length, caseRecord.id).data.description || ''}${escalationText}`)] });
  }

  if (name === 'warnings') {
    need(i, PermissionFlagsBits.ModerateMembers);
    const member = await i.guild.members.fetch(user.id);
    ensureTargetHierarchy(i, member);
    const rows = (store.guild(i.guildId).warnings[user.id] || [])
      .slice(-15)
      .map((warning, index) => `${index + 1}. ${warning.reason} • <@${warning.by}> • <t:${Math.floor(warning.at / 1000)}:R>`);
    return i.reply({ embeds: [embed(`Warnings • ${user.tag}`, rows.join('\n') || 'No warnings found.')] });
  }

  if (name === 'clearwarns') {
    need(i, PermissionFlagsBits.ModerateMembers);
    const member = await i.guild.members.fetch(user.id);
    ensureTargetHierarchy(i, member);
    store.guild(i.guildId).warnings[user.id] = [];
    store.save();
    await log(i, 'Warnings Cleared', `${user.tag} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('Warnings Cleared', `Cleared warnings for ${user}.`)] });
  }

  if (name === 'purge') {
    need(i, PermissionFlagsBits.ManageMessages);
    const amount = i.options.getInteger('amount', true);
    const deleted = await i.channel.bulkDelete(amount, true);
    await log(i, 'Messages Purged', `${deleted.size} message(s) in ${i.channel} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ content: `Deleted ${deleted.size} message(s).`, ephemeral: true });
  }

  if (name === 'lock' || name === 'unlock') {
    need(i, PermissionFlagsBits.ManageChannels);
    await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: name === 'lock' ? false : null });
    await log(i, name === 'lock' ? 'Channel Locked' : 'Channel Unlocked', `${i.channel} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed(name === 'lock' ? 'Channel Locked' : 'Channel Unlocked', `${i.channel} updated.`)] });
  }

  if (name === 'slowmode') {
    need(i, PermissionFlagsBits.ManageChannels);
    const seconds = i.options.getInteger('seconds', true);
    await i.channel.setRateLimitPerUser(seconds);
    await log(i, 'Slowmode Updated', `${i.channel} → ${seconds}s • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('Slowmode Updated', `Slowmode is now **${seconds} seconds**.`)] });
  }

  if (name === 'nickname') {
    need(i, PermissionFlagsBits.ManageNicknames);
    const member = await i.guild.members.fetch(user.id);
    const nickname = i.options.getString('nickname');
    if (!member.manageable) throw new Error('I cannot manage that member.');
    await member.setNickname(nickname || null);
    await log(i, 'Nickname Updated', `${user.tag} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('Nickname Updated', `${user}'s nickname was ${nickname ? `set to **${nickname}**` : 'reset'}.`)] });
  }

  if (name === 'role') {
    need(i, PermissionFlagsBits.ManageRoles);
    const member = await i.guild.members.fetch(user.id);
    const role = i.options.getRole('role', true);
    const operation = i.options.getString('action', true);
    ensureRoleHierarchy(i, member, role);
    if (operation === 'add') await member.roles.add(role);
    else await member.roles.remove(role);
    await log(i, 'Role Updated', `${role.name} ${operation === 'add' ? 'added to' : 'removed from'} ${user.tag} • Moderator: ${i.user.tag}`, moderationConfig);
    return i.reply({ embeds: [embed('Role Updated', `${role} was ${operation === 'add' ? 'added to' : 'removed from'} ${user}.`)] });
  }
}


function ensureAdvancedStores(g){g.cases||=[];g.notes||={};g.reports||={};g.modStats||={};g.tempBans||=[];g.tempMutes||=[];g.quarantines||={};return g;}
function bumpStat(g,userId,key){g.modStats[userId]||={total:0};g.modStats[userId].total=(g.modStats[userId].total||0)+1;g.modStats[userId][key]=(g.modStats[userId][key]||0)+1;}
function createCase(i,type,targetId,reason,extra={}){const g=ensureAdvancedStores(store.guild(i.guildId));const id=Number(g.nextCaseId||1);g.nextCaseId=id+1;const c={id,type,targetId:targetId||null,moderatorId:i.user.id,reason:reason||'No reason provided.',at:Date.now(),closed:false,evidence:[],...extra};g.cases.unshift(c);g.cases=g.cases.slice(0,1000);bumpStat(g,i.user.id,type);store.save();return c;}
function pageRows(items,page=1,per=10){const pages=Math.max(1,Math.ceil(items.length/per));page=Math.max(1,Math.min(pages,Number(page)||1));return{page,pages,items:items.slice((page-1)*per,page*per)}}
async function fetchMember(i,user){const m=await i.guild.members.fetch(user.id);if(user.id===i.user.id)throw new Error('You cannot target yourself with this action.');return m;}
function advReason(i){return i.options.getString('reason')||`Action by ${i.user.tag}`;}
async function filteredPurge(i,predicate:(message:any)=>boolean,max){need(i,PermissionFlagsBits.ManageMessages);const fetched=await i.channel.messages.fetch({limit:100});const selected=fetched.filter(m=>!m.pinned&&predicate(m)).first(Math.min(100,max));if(!selected.length)return 0;const deleted=await i.channel.bulkDelete(selected,true);return deleted.size;}
async function advanced(i){
  const group=i.options.getSubcommandGroup(),name=i.options.getSubcommand();
  if (group === 'bulk') return moderationUpgrade.bulk(i);
  const guardName=['ban','unban','kick','timeout','untimeout','warn','warnings','purge','lock','unlock','slowmode','nickname'].includes(name)?name:'warn';
  const ctx=await dashboardGuard(i,guardName),modCfg=ctx.moderation,g=ensureAdvancedStores(store.guild(i.guildId)),reason=advReason(i);
  if(group==='member'){
    const user=i.options.getUser('user');
    if(name==='ban'||name==='tempban'||name==='softban'){need(i,PermissionFlagsBits.BanMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);if(!m.bannable)throw new Error('I cannot ban that member. Check role hierarchy.');await tryDm(user,`Moderation action in ${i.guild.name}`,`${name}: ${reason}`,modCfg);await m.ban({reason,deleteMessageSeconds:name==='softban'?86400:0});const c=createCase(i,name,user.id,reason);if(name==='softban')await i.guild.members.unban(user.id,'Softban completed');if(name==='tempban'){const durationMs=parseDuration(i.options.getString('duration',true));g.tempBans.push({userId:user.id,until:Date.now()+durationMs,caseId:c.id});store.save();}await log(i,name.toUpperCase(),`${user.tag} • Case #${c.id} • ${reason}`,modCfg);return i.reply({embeds:[embed('Moderation Complete',`${user} • **${name}** • Case **#${c.id}**${name==='tempban'?`\nExpires: <t:${Math.floor(g.tempBans.at(-1).until/1000)}:R>`:''}`)]});}
    if(name==='unban'){need(i,PermissionFlagsBits.BanMembers);const id=i.options.getString('user_id',true);await i.guild.members.unban(id,reason);const c=createCase(i,'unban',id,reason);return i.reply({embeds:[embed('User Unbanned',`User ID **${id}** • Case **#${c.id}**`)]});}
    if(name==='kick'){need(i,PermissionFlagsBits.KickMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);if(!m.kickable)throw new Error('I cannot kick that member.');await tryDm(user,`You were kicked from ${i.guild.name}`,`Reason: ${reason}`,modCfg);await m.kick(reason);const c=createCase(i,'kick',user.id,reason);return i.reply({embeds:[embed('Member Kicked',`${user} • Case **#${c.id}**`)]});}
    if(name==='timeout'||name==='untimeout'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);const durationMs=name==='timeout'?parseDuration(i.options.getString('duration',true)):null;if(name==='timeout'&&!m.moderatable)throw new Error('I cannot timeout that member because of role hierarchy.');await m.timeout(durationMs,reason);const c=createCase(i,name,user.id,reason,{durationMs});return i.reply({embeds:[embed(name==='timeout'?'Member Timed Out':'Timeout Removed',`${user} • Case **#${c.id}**${durationMs?` • ${formatDuration(durationMs)}`:''}`)]});}
     if(name==='warn'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);g.warnings[user.id]||=[];g.warnings[user.id].push({reason,by:i.user.id,at:Date.now()});const c=createCase(i,'warn',user.id,reason);const escalation=await moderationUpgrade.escalateWarning(i,m,g,reason);await tryDm(user,`Warning in ${i.guild.name}`,`Reason: ${reason}`,modCfg);const escalationText=escalation?.skipped?`\nEscalation skipped: **${escalation.reason}**`:escalation&&!escalation.repeated?`\nEscalation applied: **${escalation.action}**`:'';const card=warningEmbed(i,user,reason,g.warnings[user.id].length,c.id);if(escalationText)card.setDescription(`${card.data.description||''}${escalationText}`);return i.reply({embeds:[card]});}
    if(name==='warnings'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);const arr=g.warnings[user.id]||[];return i.reply({embeds:[embed(`Warnings • ${user.tag}`,arr.slice(-20).map((w,x)=>`**${x+1}.** ${w.reason} • <@${w.by}> • <t:${Math.floor(w.at/1000)}:R>`).join('\n')||'No warnings found.')]});}
    if(name==='clearwarnings'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);g.warnings[user.id]=[];const c=createCase(i,'clearwarnings',user.id,reason);store.save();return i.reply({embeds:[embed('Warnings Cleared',`${user} • Case **#${c.id}**`)]});}
    if(name==='removewarn'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);const arr=g.warnings[user.id]||[],num=i.options.getInteger('number',true);if(!arr[num-1])throw new Error('That warning number does not exist.');const [removed]=arr.splice(num-1,1);const c=createCase(i,'removewarn',user.id,`Removed warning: ${removed.reason}`);store.save();return i.reply({embeds:[embed('Warning Removed',`${user} • Case **#${c.id}**`)]});}
    if(name==='nickname'||name==='resetnick'){need(i,PermissionFlagsBits.ManageNicknames);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);if(!m.manageable)throw new Error('I cannot manage that member.');const nick=name==='nickname'?i.options.getString('nickname',true):null;await m.setNickname(nick,reason);const c=createCase(i,name,user.id,reason,{nickname:nick});return i.reply({embeds:[embed('Nickname Updated',`${user} • Case **#${c.id}**`)]});}
    if(name==='roleadd'||name==='roleremove'){need(i,PermissionFlagsBits.ManageRoles);const m=await fetchMember(i,user),role=i.options.getRole('role',true);ensureRoleHierarchy(i,m,role);if(name==='roleadd')await m.roles.add(role,reason);else await m.roles.remove(role,reason);const c=createCase(i,name,user.id,reason,{roleId:role.id});return i.reply({embeds:[embed('Role Updated',`${role} ${name==='roleadd'?'added to':'removed from'} ${user} • Case **#${c.id}**`)]});}
    if(name==='note'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);g.notes[user.id]||=[];g.notes[user.id].push({text:i.options.getString('note',true),by:i.user.id,at:Date.now()});store.save();return i.reply({embeds:[embed('Staff Note Added',`Private note saved for ${user}.`)],ephemeral:true});}
    if(name==='notes'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);const arr=g.notes[user.id]||[];return i.reply({embeds:[embed(`Staff Notes • ${user.tag}`,arr.slice(-20).map((x,n)=>`**${n+1}.** ${x.text} • <@${x.by}> • <t:${Math.floor(x.at/1000)}:R>`).join('\n')||'No notes found.')],ephemeral:true});}
    if(name==='removenote'){need(i,PermissionFlagsBits.ModerateMembers);const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);const arr=g.notes[user.id]||[],num=i.options.getInteger('number',true);if(!arr[num-1])throw new Error('That note number does not exist.');arr.splice(num-1,1);store.save();return i.reply({embeds:[embed('Staff Note Removed',`Removed note **#${num}** for ${user}.`)],ephemeral:true});}
    if(name==='report'){const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);g.reports[user.id]||=[];g.reports[user.id].push({reason:i.options.getString('reason',true),by:i.user.id,at:Date.now(),status:'open'});store.save();return i.reply({embeds:[embed('Report Created',`Report for ${user} has been recorded.`)],ephemeral:true});}
    if(name==='reports'){need(i,PermissionFlagsBits.ModerateMembers);const arr=g.reports[user.id]||[];return i.reply({embeds:[embed(`Reports • ${user.tag}`,arr.slice(-20).map((x,n)=>`**${n+1}.** ${x.reason} • ${x.status} • <@${x.by}>`).join('\n')||'No reports found.')],ephemeral:true});}
  }
  if(group==='message'){
    if(name==='purge'){const count=await filteredPurge(i,()=>true,i.options.getInteger('amount',true));return i.reply({content:`Deleted ${count} message(s).`,ephemeral:true});}
    if(name.startsWith('purge')){const max=i.options.getInteger('amount',true),target=i.options.getUser('user');let pred:(message:any)=>boolean=()=>false;if(name==='purgeuser')pred=m=>m.author.id===target.id;if(name==='purgebots')pred=m=>m.author.bot;if(name==='purgelinks')pred=m=>/https?:\/\//i.test(m.content);if(name==='purgeimages')pred=m=>m.attachments.size>0;if(name==='purgeembeds')pred=m=>m.embeds.length>0;if(name==='purgeinvites')pred=m=>/(discord\.gg|discord\.com\/invite)\//i.test(m.content);const count=await filteredPurge(i,pred,max);createCase(i,name,target?.id||null,`${count} messages removed`,{channelId:i.channelId});return i.reply({content:`Deleted ${count} matching message(s).`,ephemeral:true});}
    if(name==='slowmode'){need(i,PermissionFlagsBits.ManageChannels);const s=i.options.getInteger('seconds',true);await i.channel.setRateLimitPerUser(s);createCase(i,'slowmode',null,`${s}s`,{channelId:i.channelId});return i.reply({embeds:[embed('Slowmode Updated',`${i.channel} → **${s}s**`)]});}
    if(name==='lock'||name==='unlock'){need(i,PermissionFlagsBits.ManageChannels);await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:name==='lock'?false:null});createCase(i,name,null,reason,{channelId:i.channelId});return i.reply({embeds:[embed(name==='lock'?'Channel Locked':'Channel Unlocked',`${i.channel} updated.`)]});}
     if(name==='channelban'||name==='channelunban'){need(i,PermissionFlagsBits.ManageChannels);const user=i.options.getUser('user',true),member=await fetchMember(i,user);ensureTargetHierarchy(i,member);await i.channel.permissionOverwrites.edit(user.id,{SendMessages:name==='channelban'?false:null,AddReactions:name==='channelban'?false:null});createCase(i,name,user.id,reason,{channelId:i.channelId});return i.reply({embeds:[embed('Channel Permission Updated',`${user} ${name==='channelban'?'blocked in':'restored in'} ${i.channel}.`)]});}
  }
  if(group==='voice'){
     need(i,PermissionFlagsBits.MuteMembers);const user=i.options.getUser('user');
     if(name==='moveall'){const dest=i.options.getChannel('channel',true),source=i.member.voice.channel;if(!source)throw new Error('Join the source voice channel first.');const botPosition=botHighestRole(i);let moved=0;for(const m of source.members.values()){if(m.id===i.guild.ownerId||highestRolePosition(m)>=botPosition||m.manageable===false)continue;if(m.voice.setChannel){await m.voice.setChannel(dest).catch(()=>{});moved++;}}createCase(i,'moveall',null,`${moved} members moved`,{channelId:dest.id});return i.reply({embeds:[embed('Voice Members Moved',`Moved **${moved}** member(s) to ${dest}.`)]});}
     const m=await fetchMember(i,user);ensureTargetHierarchy(i,m);if(name==='voicekick')await m.voice.disconnect(reason);if(name==='voicemute')await m.voice.setMute(true,reason);if(name==='voiceunmute')await m.voice.setMute(false,reason);if(name==='voicedeafen')await m.voice.setDeaf(true,reason);if(name==='voiceundeafen')await m.voice.setDeaf(false,reason);if(name==='move')await m.voice.setChannel(i.options.getChannel('channel',true),reason);const c=createCase(i,name,user.id,reason);return i.reply({embeds:[embed('Voice Moderation Complete',`${user} • **${name}** • Case **#${c.id}**`)]});
  }
  if(group==='cases'){
    need(i,PermissionFlagsBits.ModerateMembers);const cases=g.cases||[];
    if(name==='case'){const c=cases.find(x=>x.id===i.options.getInteger('id',true));if(!c)throw new Error('Case not found.');return i.reply({embeds:[embed(`Case #${c.id}`,`Type: **${c.type}**\nTarget: ${c.targetId?`<@${c.targetId}>`:'N/A'}\nModerator: <@${c.moderatorId}>\nReason: ${c.reason}\nStatus: **${c.closed?'Closed':'Open'}**\nEvidence: ${c.evidence?.length?c.evidence.join('\n'):'None'}\nCreated: <t:${Math.floor(c.at/1000)}:F>`)]});}
    if(name==='cases'||name==='modlogs'){const pg=pageRows(cases,i.options.getInteger('page')||1);return i.reply({embeds:[embed(name==='cases'?'Moderation Cases':'Moderation Logs',pg.items.map(c=>`**#${c.id}** • ${c.type} • ${c.targetId?`<@${c.targetId}>`:'N/A'} • <@${c.moderatorId}> • ${c.closed?'Closed':'Open'}`).join('\n')||'No cases yet.').setFooter({text:`Page ${pg.page}/${pg.pages}`})]});}
    if(name==='caseedit'||name==='casereason'){const c=cases.find(x=>x.id===i.options.getInteger('id',true));if(!c)throw new Error('Case not found.');c.reason=i.options.getString('reason',true);store.save();return i.reply({embeds:[embed('Case Updated',`Case **#${c.id}** reason updated.`)]});}
    if(name==='caseclose'){const c=cases.find(x=>x.id===i.options.getInteger('id',true));if(!c)throw new Error('Case not found.');c.closed=true;c.closedAt=Date.now();c.closedBy=i.user.id;store.save();return i.reply({embeds:[embed('Case Closed',`Case **#${c.id}** is now closed.`)]});}
    if(name==='history'){const user=i.options.getUser('user',true),arr=cases.filter(c=>c.targetId===user.id).slice(0,20);return i.reply({embeds:[embed(`Moderation History • ${user.tag}`,arr.map(c=>`**#${c.id}** ${c.type} • ${c.reason}`).join('\n')||'No moderation history found.')]});}
    if(name==='staffstats'){const rows=(Object.entries(g.modStats||{}) as [string,any][]).sort((a,b)=>(b[1].total||0)-(a[1].total||0)).slice(0,15).map(([id,s],n)=>`**${n+1}.** <@${id}> — **${s.total||0}** actions`);return i.reply({embeds:[embed('Staff Moderation Stats',rows.join('\n')||'No staff actions recorded.')]});}
    if(name==='modstats'){const user=i.options.getUser('user')||i.user,s:any=g.modStats?.[user.id]||{total:0};const rows=(Object.entries(s) as [string,number][]).filter(([k])=>k!=='total').sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>`${k}: **${v}**`);return i.reply({embeds:[embed(`Moderator Stats • ${user.tag}`,`Total actions: **${s.total||0}**\n${rows.join('\n')||'No action breakdown yet.'}`)]});}
    if(name==='evidence'){const c=cases.find(x=>x.id===i.options.getInteger('id',true));if(!c)throw new Error('Case not found.');c.evidence||=[];c.evidence.push(i.options.getString('reference',true));c.evidence=c.evidence.slice(-10);store.save();return i.reply({embeds:[embed('Evidence Added',`Evidence reference added to case **#${c.id}**.`)]});}
  }
  if(group==='server'){
    need(i,PermissionFlagsBits.ManageChannels);
    if(name==='lockdown'||name==='unlockdown'){if(!i.options.getBoolean('confirm',true))throw new Error('Confirmation is required.');let changed=0;for(const ch of i.guild.channels.cache.values()){if(!ch.isTextBased?.()||!ch.permissionOverwrites)continue;await ch.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:name==='lockdown'?false:null}).catch(()=>{});changed++;}createCase(i,name,null,reason,{changed});return i.reply({embeds:[embed(name==='lockdown'?'Server Lockdown':'Server Unlocked',`Updated **${changed}** text channel(s).`)]});}
     if(name==='massrole'){need(i,PermissionFlagsBits.ManageRoles);const role=i.options.getRole('role',true),op=i.options.getString('action',true);ensureMassRoleHierarchy(i,role);await i.guild.members.fetch();let count=0;const botPosition=botHighestRole(i);for(const m of i.guild.members.cache.filter(x=>!x.user.bot)){if(m.id===i.guild.ownerId||highestRolePosition(m)>=botPosition||m.manageable===false)continue;if(op==='add')await m.roles.add(role).catch(()=>{});else await m.roles.remove(role).catch(()=>{});count++;if(count>=100)break;}createCase(i,'massrole',null,`${op} ${role.name}`,{count});return i.reply({embeds:[embed('Mass Role Complete',`${op==='add'?'Added':'Removed'} ${role} for **${count}** member(s).`)]});}
    if(name==='massnick'){need(i,PermissionFlagsBits.ManageNicknames);const prefix=i.options.getString('prefix',true);await i.guild.members.fetch();let count=0;for(const m of i.guild.members.cache.filter(x=>!x.user.bot&&x.id!==i.guild.ownerId&&x.manageable).first(50)){const base=m.displayName.replace(/^\[[^\]]+\]\s*/,'');await m.setNickname(`[${prefix}] ${base}`.slice(0,32)).catch(()=>{});count++;}createCase(i,'massnick',null,`Prefix ${prefix}`,{count});return i.reply({embeds:[embed('Mass Nickname Complete',`Updated **${count}** member(s).`)]});}
    if(name==='freeze'||name==='unfreeze'){const user=i.options.getUser('user',true),member=await fetchMember(i,user);ensureTargetHierarchy(i,member);await i.channel.permissionOverwrites.edit(user.id,{SendMessages:name==='freeze'?false:null,AddReactions:name==='freeze'?false:null});const c=createCase(i,name,user.id,reason,{channelId:i.channelId});return i.reply({embeds:[embed(name==='freeze'?'Member Frozen':'Member Unfrozen',`${user} in ${i.channel} • Case **#${c.id}**`)]});}
  }
  throw new Error('This moderation action is not implemented.');
}
async function tick(client){
  const snap=store.snapshot();
  let dirty=false;
  for(const [guildId,g0] of Object.entries(snap.guilds||{}) as [string,any][]){
    const list=g0.tempBans||[];
    for(const x of list.filter(t=>Number(t.until)<=Date.now())){
      const guild=client.guilds.cache.get(guildId);
      if(guild)await guild.members.unban(x.userId,'Temporary ban expired').catch(()=>{});
      const g=ensureAdvancedStores(store.guild(guildId));
      g.tempBans=g.tempBans.filter(t=>!(t.userId===x.userId&&t.until===x.until));
      dirty=true;
    }
    const dueMutes=(g0.tempMutes||[]).filter(t=>Number(t.until)<=Date.now());
    if(dueMutes.length){
      const guild=client.guilds.cache.get(guildId);
      const g=ensureAdvancedStores(store.guild(guildId));
      const handled=new Set();
      if(!guild)continue;
      for(const mute of dueMutes){
        const member=await guild.members.fetch(mute.userId).catch(()=>null);
        if(member){
          const role=mute.roleId?guild.roles.cache.get(mute.roleId):null;
          if(role&&member.roles.cache.has(role.id))await member.roles.remove(role,'Temporary mute expired').catch(()=>{});
          await member.user.send({embeds:[embed(`Your mute expired in ${guild.name}`,'Your temporary mute has ended and the Muted role was removed.')]}).catch(()=>{});
        }
        handled.add(`${mute.userId}:${mute.until}`);
        dirty=true;
      }
      g.tempMutes=g.tempMutes.filter(mute=>!handled.has(`${mute.userId}:${mute.until}`));
    }
    const dueQuarantines=(Object.entries(g0.quarantines||{}) as [string,any][]).filter(([, quarantine]) => Number(quarantine.until) > 0 && Number(quarantine.until) <= Date.now());
    if(dueQuarantines.length){
      const guild=client.guilds.cache.get(guildId);
      const g=ensureAdvancedStores(store.guild(guildId));
      if(!guild)continue;
      const quarantineRoleId=g.config.quarantineRoleId;
      const quarantineChannel=g.config.quarantineChannelId ? guild.channels.cache.get(g.config.quarantineChannelId) : null;
      for(const [userId, quarantine] of dueQuarantines){
        const member=await guild.members.fetch(userId).catch(()=>null);
        if(member){
          if(quarantineRoleId && member.roles.cache.has(quarantineRoleId)){
            await member.roles.remove(quarantineRoleId,'Temporary quarantine expired').catch(()=>{});
          }
          let restored=0;
          for(const roleId of quarantine.roleIds||[]){
            const previousRole=guild.roles.cache.get(roleId);
            if(!previousRole||previousRole.managed)continue;
            await member.roles.add(previousRole,'Temporary quarantine expired').then(()=>restored++).catch(()=>{});
          }
          await member.user.send({embeds:[embed(`Your quarantine expired in ${guild.name}`,`${restored} of your previous server role(s) were restored.`)]}).catch(()=>{});
          if(quarantineChannel?.send){
            await quarantineChannel.send({embeds:[embed('Quarantine Expired', `${member.user} was automatically released and **${restored}** previous role(s) were restored.`)]}).catch(()=>{});
          }
        }
        delete g.quarantines[userId];
        dirty=true;
      }
    }
  }
  if(dirty)store.save();
}

module.exports = {
  action,
  advanced,
  tick,
  log,
  need,
  dashboardGuard,
  muteRole,
  prefixMute,
  ensureTargetHierarchy,
  ensureRoleHierarchy,
  ensurePrefixTargetHierarchy
};
