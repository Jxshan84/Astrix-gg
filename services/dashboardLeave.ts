// @ts-nocheck
const { EmbedBuilder } = require('discord.js');
const guildConfigService = require('./guildConfigService.ts');

function safeUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function ensureBranding(value) {
  const trimmed = String(value || '').trim();
  if (/powered\s+by\s+astrix/i.test(trimmed)) return trimmed;
  return trimmed ? `${trimmed} • Powered by Astrix` : 'Powered by Astrix';
}

function avatarUrl(member) {
  return member.user.displayAvatarURL({ extension: 'png', size: 256 });
}

function replaceVariables(value, member) {
  const displayName = member.displayName || member.user.globalName || member.user.username;
  return String(value || '')
    .replaceAll('{user}', `@${displayName}`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayName}', displayName)
    .replaceAll('{userId}', member.id)
    .replaceAll('{userAvatar}', avatarUrl(member))
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{serverId}', member.guild.id)
    .replaceAll('{memberCount}', member.guild.memberCount.toLocaleString('en-US'));
}

function colorNumber(value) {
  const normalized = String(value || '').trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : 0x7c5cff;
}

async function memberRemove(member) {
  const guildConfig = await guildConfigService.getGuildConfig(member.guild.id);
  const leave = guildConfig?.leave;
  const managed = guildConfig?.dashboardManaged?.leave === true;

  if (!managed || !leave) return false;
  if (leave.enabled === false) return true;
  if (leave.ignoreBots !== false && member.user.bot) return true;

  const channel = leave.channelId
    ? member.guild.channels.cache.get(leave.channelId)
      || (await member.guild.channels.fetch(leave.channelId).catch(() => null))
    : null;

  if (!channel?.isTextBased?.() || !channel?.isSendable?.()) return true;

  const mode = ['message', 'embed', 'both'].includes(leave.mode) ? leave.mode : 'embed';
  const includeContent = mode === 'message' || mode === 'both';
  const includeEmbed = mode === 'embed' || mode === 'both';
  const premiumEnabled = leave.premiumMediaEnabled === true;
  const payload = { allowedMentions: { parse: [] } };

  if (includeContent) {
    payload.content = replaceVariables(leave.content || 'Goodbye {displayName}.', member).slice(0, 2000);
  }

  if (includeEmbed) {
    const data = leave.embed || {};
    const embed = new EmbedBuilder()
      .setColor(colorNumber(data.color))
      .setTitle(replaceVariables(data.title || `Member Left ${member.guild.name}`, member).slice(0, 256))
      .setDescription(replaceVariables(data.description || '', member).slice(0, 4096));

    if (data.authorName) {
      const icon = replaceVariables(data.authorIconUrl || '', member);
      embed.setAuthor({
        name: replaceVariables(data.authorName, member).slice(0, 256),
        ...(safeUrl(icon) ? { iconURL: icon } : {}),
      });
    }

    const thumbnail = replaceVariables(data.thumbnailUrl || '', member);
    if (safeUrl(thumbnail)) embed.setThumbnail(thumbnail);

    const image = replaceVariables(data.imageUrl || '', member);
    if (premiumEnabled && safeUrl(image)) embed.setImage(image);

    let footerText = String(data.footerText || '');
    if (!premiumEnabled) footerText = ensureBranding(footerText);
    if (footerText) {
      const footerIcon = replaceVariables(data.footerIconUrl || '', member);
      embed.setFooter({
        text: footerText.slice(0, 2048),
        ...(safeUrl(footerIcon) ? { iconURL: footerIcon } : {}),
      });
    }

    if (data.timestamp) embed.setTimestamp();
    payload.embeds = [embed];
  }

  const sent = await channel.send(payload).catch(error => {
    console.error(`Dashboard leave send failed in guild ${member.guild.id}:`, error.message);
    return null;
  });

  const deleteAfterSeconds = Math.max(0, Number(leave.deleteAfterSeconds || 0));
  if (sent && deleteAfterSeconds > 0) {
    const timer = setTimeout(() => sent.delete().catch(() => {}), deleteAfterSeconds * 1000);
    timer.unref?.();
  }

  return true;
}

module.exports = { memberRemove };
