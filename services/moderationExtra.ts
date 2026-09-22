const { PermissionFlagsBits } = require('discord.js');
const moderation = require('./moderation.ts');
const ui = require('./ui.ts');

const EXTRA_COMMANDS = new Set([
  'nick',
  'hide',
  'unhide',
  'clonechannel',
  'deletechannel',
  'voiceban',
  'voiceunban',
  'massban',
  'masskick'
]);

function needBot(i, permission, label) {
  const me = i.guild?.members?.me;
  if (!me?.permissions?.has(permission)) {
    throw new Error(`Astrix needs the **${label}** permission to complete this command.`);
  }
}

function needChannelPermission(i, channel, permission, label) {
  if (!channel?.permissionOverwrites?.edit) {
    throw new Error('This channel does not support permission overwrites.');
  }
  const permissions = channel.permissionsFor?.(i.guild.members.me);
  if (!permissions?.has(permission)) {
    throw new Error(`Astrix needs the **${label}** permission in the selected channel.`);
  }
}

async function context(i, commandName) {
  return moderation.dashboardGuard(i, commandName);
}

function reason(i) {
  return i.options.getString('reason')?.trim() || `Action by ${i.user.tag}`;
}

async function targetMember(i, allowSelf = false) {
  const user = i.options.getUser('user', true);
  if (!allowSelf && user.id === i.user.id) throw new Error('You cannot target yourself.');
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  if (!member) throw new Error('That user is not currently a member of this server.');
  if (member.id === i.guild.ownerId) throw new Error('The server owner cannot be targeted.');

  const botPosition = i.guild.members.me?.roles?.highest?.position ?? 0;
  if (member.roles.highest.position >= botPosition || member.manageable === false) {
    throw new Error('Astrix cannot manage that member because of Discord role hierarchy.');
  }
  return { user, member };
}

function parseUserIds(value) {
  return [...new Set(String(value || '').match(/\d{15,25}/g) || [])].slice(0, 100);
}

async function nick(i) {
  const ctx = await context(i, 'nick');
  moderation.need(i, PermissionFlagsBits.ManageNicknames);
  needBot(i, PermissionFlagsBits.ManageNicknames, 'Manage Nicknames');
  const { user, member } = await targetMember(i);
  const nickname = i.options.getString('nickname')?.trim() || null;
  if (!member.manageable) throw new Error('Astrix cannot change that member’s nickname.');
  await member.setNickname(nickname, reason(i));
  await moderation.log(i, 'Nickname Updated', `${user.tag} • Moderator: ${i.user.tag}`, ctx.moderation);
  return i.reply({ embeds: [ui.success('Nickname Updated', `${user}’s nickname was ${nickname ? `set to **${nickname}**` : 'reset'}.`)] });
}

async function setHidden(i, hidden) {
  const commandName = hidden ? 'hide' : 'unhide';
  const ctx = await context(i, commandName);
  moderation.need(i, PermissionFlagsBits.ManageChannels);
  needBot(i, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  const channel = i.options.getChannel('channel') || i.channel;
  needChannelPermission(i, channel, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  await channel.permissionOverwrites.edit(i.guild.roles.everyone, {
    ViewChannel: hidden ? false : null
  }, reason(i));
  await moderation.log(i, hidden ? 'Channel Hidden' : 'Channel Unhidden', `${channel} • Moderator: ${i.user.tag}`, ctx.moderation);
  return i.reply({ embeds: [ui.success(hidden ? 'Channel Hidden' : 'Channel Unhidden', `${channel} is now ${hidden ? 'hidden from' : 'visible to'} @everyone.`)] });
}

async function cloneChannel(i) {
  const ctx = await context(i, 'clonechannel');
  moderation.need(i, PermissionFlagsBits.ManageChannels);
  needBot(i, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  const channel = i.options.getChannel('channel') || i.channel;
  if (!channel?.clone) throw new Error('Choose a cloneable guild channel.');
  const cloned = await channel.clone({ reason: reason(i) });
  await moderation.log(i, 'Channel Cloned', `${channel} → ${cloned} • Moderator: ${i.user.tag}`, ctx.moderation);
  return i.reply({ embeds: [ui.success('Channel Cloned', `${channel} was cloned as ${cloned}.`)] });
}

async function deleteChannel(i) {
  const ctx = await context(i, 'deletechannel');
  moderation.need(i, PermissionFlagsBits.ManageChannels);
  needBot(i, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  const channel = i.options.getChannel('channel', true);
  if (!i.options.getBoolean('confirm', true)) throw new Error('Set **confirm:true** to permanently delete the selected channel.');
  if (!channel?.delete) throw new Error('Choose a deletable guild channel.');
  await i.deferReply({ ephemeral: true });
  await channel.delete(reason(i));
  await moderation.log(i, 'Channel Deleted', `#${channel.name || channel.id} • Moderator: ${i.user.tag}`, ctx.moderation);
  return i.editReply({ embeds: [ui.success('Channel Deleted', `The selected channel was permanently deleted.`)] });
}

async function voiceAccess(i, blocked) {
  const commandName = blocked ? 'voiceban' : 'voiceunban';
  const ctx = await context(i, commandName);
  moderation.need(i, PermissionFlagsBits.ManageChannels);
  needBot(i, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  const { user } = await targetMember(i);
  const channel = i.options.getChannel('channel') || i.member?.voice?.channel;
  if (!channel?.isVoiceBased?.()) throw new Error('Choose a voice or stage channel, or join one first.');
  needChannelPermission(i, channel, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  await channel.permissionOverwrites.edit(user.id, {
    Connect: blocked ? false : null,
    Speak: blocked ? false : null
  }, reason(i));
  await moderation.log(i, blocked ? 'Voice Access Blocked' : 'Voice Access Restored', `${user.tag} in ${channel} • Moderator: ${i.user.tag}`, ctx.moderation);
  return i.reply({ embeds: [ui.success(blocked ? 'Voice Access Blocked' : 'Voice Access Restored', `${user} can ${blocked ? 'no longer join or speak in' : 'join and speak in'} ${channel}.`)] });
}

async function massAction(i, action) {
  const ctx = await context(i, action);
  const permission = action === 'massban' ? PermissionFlagsBits.BanMembers : PermissionFlagsBits.KickMembers;
  const label = action === 'massban' ? 'Ban Members' : 'Kick Members';
  moderation.need(i, permission);
  needBot(i, permission, label);
  if (!i.options.getBoolean('confirm', true)) throw new Error('Set **confirm:true** before running a mass moderation action.');
  const ids = parseUserIds(i.options.getString('user_ids', true));
  if (!ids.length) throw new Error('Provide one or more valid member IDs or mentions.');

  await i.deferReply({ ephemeral: true });
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    const member = await i.guild.members.fetch(id).catch(() => null);
    if (!member) {
      failed.push(`${id}: not a current server member`);
      continue;
    }
    try {
      if (member.id === i.user.id || member.id === i.guild.ownerId) throw new Error('protected member');
      const botPosition = i.guild.members.me?.roles?.highest?.position ?? 0;
      if (member.roles.highest.position >= botPosition || member.manageable === false) {
        throw new Error('role hierarchy');
      }
      if (action === 'massban') await member.ban({ reason: reason(i) });
      else await member.kick(reason(i));
      succeeded.push(`<@${id}>`);
    } catch (error) {
      failed.push(`${id}: ${String(error.message || 'action failed').slice(0, 100)}`);
    }
  }
  await moderation.log(i, action === 'massban' ? 'Mass Ban' : 'Mass Kick',
    `Successful: ${succeeded.length} • Failed: ${failed.length} • Moderator: ${i.user.tag}\n${failed.slice(0, 10).join('\n')}`,
    ctx.moderation);
  return i.editReply({
    embeds: [ui.embed(action === 'massban' ? 'Mass Ban Complete' : 'Mass Kick Complete',
      `Successful: **${succeeded.length}**\nFailed: **${failed.length}**\n\n${succeeded.slice(0, 25).join(', ') || 'No members were changed.'}${failed.length ? `\n\nFailures:\n${failed.slice(0, 10).join('\n')}` : ''}`)]
  });
}

async function command(i, name) {
  if (!EXTRA_COMMANDS.has(name)) throw new Error('Unknown additional moderation command.');
  if (name === 'nick') return nick(i);
  if (name === 'hide') return setHidden(i, true);
  if (name === 'unhide') return setHidden(i, false);
  if (name === 'clonechannel') return cloneChannel(i);
  if (name === 'deletechannel') return deleteChannel(i);
  if (name === 'voiceban') return voiceAccess(i, true);
  if (name === 'voiceunban') return voiceAccess(i, false);
  return massAction(i, name);
}

module.exports = { command, EXTRA_COMMANDS };