const { PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const premium = require('./premium.ts');
const econ = require('./economy.ts');
const ui = require('./ui.ts');
const fun = require('./fun.ts');
const music = require('./music.ts');
const adventure = require('./adventure.ts');
const shop = require('./shop.ts');
const crates = require('./crates.ts');
const robService = require('./rob.ts');
const privacy = require('./privacy.ts');
const antiMention = require('./antimention.ts');
const moderation = require('./moderation.ts');
const economyUpgrade = require('./economy-upgrade.ts');
const moderationUpgrade = require('./moderation-upgrade.ts');
const { parseDuration, formatDuration } = require('../utils/duration.ts');
const helpCenter = require('./help-center.ts');

async function prefixCrate(message, command, args = []) {
  const rawAmount = args.find(value => String(value).toLowerCase() === 'all' || /^\d+$/.test(String(value)));
  const amount = rawAmount || 1;
  const isWeapon = command === 'weaponcrate' || command === 'weapon' || command === 'wc';
  if (command === 'alb') {
    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new Error('Manage Server permission is required for `alb`.');
    }
    const target = message.mentions?.users?.first?.() || message.author;
    const user = store.user(message.guild.id, target.id);
    const value = String(rawAmount || '').toLowerCase() === 'all' ? 100 : Math.floor(Number(rawAmount || 1));
    if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error('Use `alb all` for 100 crates or `alb <amount>` from 1 to 1,000.');
    crates.grant(user, 'lootbox', value);
    store.save();
    await message.reply({ embeds: [ui.success('📦 Lootboxes Granted', `${target} received **${value} Astrix Lootbox${value === 1 ? '' : 'es'}**.\nBalance: **${user.crates}**.`)] });
    return true;
  }
  if (!isWeapon && !['lootbox', 'crate', 'crates'].includes(command)) return false;
  if (args[0] === 'catalog') {
    await message.reply({ embeds: [ui.embed(isWeapon ? '🧰 Weapon Catalog' : '📦 Lootbox Catalog', isWeapon ? crates.weaponCatalogText() : crates.catalogText())] });
    return true;
  }
  if (args[0] === 'view' || !args.length) {
    const data = crates.view(message.guild.id, message.author.id);
    await message.reply({ embeds: [ui.embed(isWeapon ? '🧰 Hunt Weapon Inventory' : '📦 Lootbox Inventory', isWeapon
      ? `Weapon Crates: **${data.weaponCrates}**\n\n${crates.WEAPON_LOOT.map(item => `${item.emoji} **${item.name}** × ${Number(data.weapons[item.id] || 0)}`).join('\n')}`
      : `Lootboxes: **${data.crates}**\n\n${crates.catalogText()}`)] });
    return true;
  }
  const result = isWeapon
    ? crates.openWeapon(message.guild.id, message.author.id, amount)
    : crates.open(message.guild.id, message.author.id, amount);
  await message.reply({ embeds: [ui.success(isWeapon ? '🧰 Weapon Crate Opened' : '📦 Astrix Lootbox Opened',
    `${isWeapon ? crates.formatWeaponResults(result.results) : crates.formatResults(result.results)}\n\n${isWeapon ? '🧰 Weapon Crates' : '📦 Lootboxes'} remaining: **${isWeapon ? result.weaponCrates : result.crates}**`)] });
  return true;
}

function get(guildId) {
  const g = store.guild(guildId);
  g.config ||= {};
  return String(g.config.prefix || process.env.DEFAULT_PREFIX || 'a!');
}
function config(guildId) {
  const g = store.guild(guildId);
  g.config ||= {};
  return g.config;
}
function set(guildId, value) { config(guildId).prefix = value; store.save(); }

function noPrefixUsers(guildId) {
  const c = config(guildId);
  c.noPrefixUsers = [...new Set(
    (Array.isArray(c.noPrefixUsers) ? c.noPrefixUsers : [])
      .map(id => String(id || '').trim())
      .filter(id => /^\d{15,25}$/.test(id))
  )].slice(0, 100);
  return c.noPrefixUsers;
}

function hasNoPrefix(guildId, userId) {
  return noPrefixUsers(guildId).includes(String(userId));
}

function hasPremiumNoPrefix(guildId, userId, guild = null) {
  return premium.isPremium({ guildId, user: { id: userId }, guild }, userId);
}

function noPrefixCommandList() {
  return [
    'help', 'ping', 'uptime', 'users', 'servers', 'botinfo', 'nowplaying',
    'balance', 'premium', 'prefix', 'serverinfo', 'membercount', 'antimention',
    'warn', 'kick', 'ban', 'timeout', 'untimeout', 'mute', 'unmute', 'purge', 'role', 'unrole', 'cf', 'coinflip', 'give',
    'morning', 'night',
    'hunt', 'dig', 'fish', 'beg', 'search', 'collection', 'quests', 'achievements',
    'rob', 'use',
    ...fun.actionNames(),
    'givepremium', 'removepremium'
  ];
}

function canRunWithoutPrefix(rest) {
  const normalized = String(rest || '').trim().toLowerCase();
  if (normalized === 'bot info') return true;
  const [raw] = normalized.split(/\s+/);
  const command = String(raw || '').toLowerCase();
  return noPrefixCommandList().includes(command);
}

function premiumDuration(args = []) {
  const values = args.map(value => String(value || '').toLowerCase());
  const index = values.findIndex(value => /^\d+(?:d|w|m|y)?$/.test(value));
  if (index < 0) return { days: null, raw: 'permanent' };
  const match = values[index].match(/^(\d+)(d|w|m|y)?$/);
  const amount = Number(match[1]);
  const word = values[index + 1] || '';
  const unit = match[2] || (
    /^(?:day|days)$/.test(word) ? 'd' :
      /^(?:week|weeks)$/.test(word) ? 'w' :
        /^(?:month|months)$/.test(word) ? 'm' :
          /^(?:year|years)$/.test(word) ? 'y' : 'd'
  );
  return {
    days: amount * ({ d: 1, w: 7, m: 30, y: 365 }[unit] || 1),
    raw: values[index + (match[2] ? 0 : (word ? 1 : 0))]
  };
}

function premiumTierArg(args = []) {
  return args.map(value => String(value).toLowerCase()).find(value => ['premium', 'plus', 'elite'].includes(value)) || 'premium';
}

function isFastNoPrefixMessage(message) {
  if (!message?.guild || message.author?.bot || !message.content) return false;
  const content = message.content.trim();
  const prefix = get(message.guild.id);
  if (content.toLowerCase().startsWith(prefix.toLowerCase())) return false;
  if (!hasNoPrefix(message.guild.id, message.author.id)) return false;
  if (!hasPremiumNoPrefix(message.guild.id, message.author.id, message.guild)) return false;
  return canRunWithoutPrefix(content);
}

async function noPrefixSlash(i) {
  const sub = i.options.getSubcommand();
  const users = noPrefixUsers(i.guildId);
  const isBotOwner = premium.isOwner(i.user.id);

  // Server ownership is deliberately not an override. Only a Premium user
  // may manage no-prefix access, with the configured Astrix bot owner as the
  // sole global exception.
  if (!isBotOwner && !premium.isPremium(i)) {
    throw new Error('No-prefix access is a Premium feature. Activate Premium for this server or for your account first.');
  }
  if (!isBotOwner && !i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('Manage Server permission is required to manage no-prefix access.');
  }

  if (sub === 'list' || sub === 'status') {
    const members = users.map(id => `<@${id}>`).join(', ');
    return i.reply({
      embeds: [ui.embed(
        '⚡ No-Prefix Access',
        `Server Premium tier: **${premium.tierName(premium.tierFor(i.guildId, i.user.id, i.guild))}**\nMembers with no-prefix access: **${users.length} / 100**\n\n${members || 'No members have been granted no-prefix access yet.'}\n\nThese members can use supported Astrix text commands without typing the server prefix.`
      )],
      ephemeral: true
    });
  }

  const target = i.options.getUser('user', true);
  if (target.bot) throw new Error('No-prefix access can only be granted to a human server member.');

  if (sub === 'grant') {
    const member = await i.guild.members.fetch(target.id).catch(() => null);
    if (!member) throw new Error('Choose a member who is currently in this server.');
    if (users.includes(target.id)) {
      return i.reply({ embeds: [ui.embed('⚡ No-Prefix Access', `<@${target.id}> already has no-prefix access.`)], ephemeral: true });
    }
    if (users.length >= 100) throw new Error('This server has reached the 100-member no-prefix access limit. Revoke one member before granting another.');
    users.push(target.id);
    config(i.guildId).noPrefixUsers = users;
    store.save();
    return i.reply({
      embeds: [ui.success('No-Prefix Access Granted', `<@${target.id}> can now use supported Astrix text commands without the server prefix.\n\nExample: \`help\` instead of \`${get(i.guildId)}help\``)],
      ephemeral: true
    });
  }

  if (sub === 'revoke') {
    const next = users.filter(id => id !== target.id);
    if (next.length === users.length) {
      return i.reply({ embeds: [ui.embed('⚡ No-Prefix Access', `<@${target.id}> does not have no-prefix access.`)], ephemeral: true });
    }
    config(i.guildId).noPrefixUsers = next;
    store.save();
    return i.reply({ embeds: [ui.success('No-Prefix Access Revoked', `<@${target.id}> must use \`${get(i.guildId)}\` before Astrix text commands again.`)], ephemeral: true });
  }

  throw new Error('Unknown no-prefix action.');
}

function messagePermission(message, permission, label) {
  if (!message.member?.permissions?.has(permission)) {
    throw new Error(`You need the **${label}** permission to use this moderation command.`);
  }
}

function targetMember(message, args) {
  const mentioned = message.mentions?.members?.first?.();
  if (mentioned) return mentioned;
  const id = args.find(value => /^\d{15,25}$/.test(value));
  const member = id ? message.guild.members.cache.get(id) : null;
  if (!member) throw new Error('Mention a server member or provide their Discord user ID.');
  return member;
}

function ensureTargetHierarchy(message, target) {
  if (!target || target.id === message.author.id) {
    throw new Error('You cannot moderate yourself.');
  }
  const actorPosition = message.member?.roles?.highest?.position ?? 0;
  const targetPosition = target.roles?.highest?.position ?? 0;
  const botPosition = message.guild.members.me?.roles?.highest?.position ?? 0;
  if (targetPosition >= actorPosition) {
    throw new Error('You can only moderate members whose highest role is below your highest role.');
  }
  if (targetPosition >= botPosition) {
    throw new Error('Astrix cannot moderate that member because their highest role is above or equal to mine.');
  }
}

function moderationReason(message, args, target) {
  const targetTokens = new Set([
    target.id,
    `<@${target.id}>`,
    `<@!${target.id}>`
  ]);
  const reason = args
    .filter(value => !targetTokens.has(value))
    .filter(value => !/^\d+[mhdw]$/i.test(value))
    .join(' ')
    .trim();
  return reason || `Action by ${message.author.tag}`;
}

async function prefixModeration(message, cmd, args, noPrefix = false) {
  if (cmd === 'purge' || cmd === 'clear') {
    messagePermission(message, PermissionFlagsBits.ManageMessages, 'Manage Messages');
    const amount = Number(args[0]);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      throw new Error('Use a message count from 1 to 100. Example: `purge 10`.');
    }
    const deleted = await message.channel.bulkDelete(amount, true);
    await message.channel.send({ embeds: [ui.success('Messages Purged', `Deleted **${deleted.size}** message(s).`)] })
      .then(sent => setTimeout(() => sent.delete().catch(() => {}), 5000).unref?.())
      .catch(() => {});
    return true;
  }

  if (cmd === 'role' || cmd === 'unrole') {
    const target = targetMember(message, args);
    const isAdministrator = message.member?.permissions?.has(PermissionFlagsBits.Administrator);
    const actorPosition = message.member?.roles?.highest?.position ?? 0;
    const botPosition = message.guild.members.me?.roles?.highest?.position ?? 0;
    const fallback = async (detail) => {
      if (!noPrefix) return false;
      await message.reply({
        embeds: [ui.error('Role Action Blocked', `${detail}\n\nNo-prefix role add/remove commands require Administrator permission and cannot manage a role at or above your highest role.`)]
      }).catch(() => {});
      return true;
    };
    if (noPrefix && (!isAdministrator || target.id === message.author.id || (target.roles?.highest?.position ?? 0) >= actorPosition || (target.roles?.highest?.position ?? 0) >= botPosition)) {
      return fallback(!isAdministrator
        ? 'You do not have Administrator permission.'
        : target.id === message.author.id
          ? 'You cannot change your own roles with this command.'
          : (target.roles?.highest?.position ?? 0) >= botPosition
            ? 'The target member has a role equal to or higher than Astrix’s highest role.'
            : 'The target member has a role equal to or higher than your highest role.');
    }
    messagePermission(message, PermissionFlagsBits.ManageRoles, 'Manage Roles');
    ensureTargetHierarchy(message, target);
    const roleMention = message.mentions?.roles?.first?.();
    const roleId = roleMention?.id || args.find(value => /^\d{15,25}$/.test(value) && value !== target.id);
    const role = roleId ? message.guild.roles.cache.get(roleId) : null;
    if (!role) throw new Error(`Mention a role. Example: \`${get(message.guild.id)}role @member @role\`.`);
    if (role.managed) throw new Error('Managed/integration roles cannot be assigned manually.');
    if (!message.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Astrix needs the Manage Roles permission.');
    }
    if (role.position >= message.guild.members.me.roles.highest.position) {
      if (await fallback('The selected role is equal to or higher than Astrix’s highest role.')) return true;
      throw new Error('I cannot manage that role because it is above my highest role.');
    }
    if (role.position >= actorPosition && !isAdministrator) {
      if (await fallback('The selected role is equal to or higher than your highest role.')) return true;
      throw new Error('You cannot manage a role at or above your highest role.');
    }
    if (noPrefix && role.position >= actorPosition) {
      return fallback('The selected role is equal to or higher than your highest role.');
    }
    if (cmd === 'role') {
      await target.roles.add(role, `Astrix prefix role command by ${message.author.tag}`);
      await message.reply({ embeds: [ui.success('Role Added', `${role} was given to ${target}.`)] });
    } else {
      await target.roles.remove(role, `Astrix prefix role command by ${message.author.tag}`);
      await message.reply({ embeds: [ui.success('Role Removed', `${role} was removed from ${target}.`)] });
    }
    return true;
  }

  const target = targetMember(message, args);
  const reason = moderationReason(message, args, target);
  const user = target.user;
  ensureTargetHierarchy(message, target);

  if (cmd === 'warn') {
    messagePermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members');
    const guildData = store.guild(message.guild.id);
    guildData.warnings ||= {};
    guildData.warnings[target.id] ||= [];
    guildData.warnings[target.id].push({ reason, by: message.author.id, at: Date.now() });
    const caseRecord = moderationUpgrade.recordCase(guildData, 'warn', target.id, message.author.id, reason);
    const escalation = await moderationUpgrade.escalateWarning(
      {
        guild: message.guild,
        guildId: message.guild.id,
        user: message.author
      },
      target,
      guildData,
      reason
    );
    store.save();
    await user.send({ embeds: [ui.embed(`Warning in ${message.guild.name}`, `Reason: ${reason}`)] }).catch(() => {});
    await moderation.log({ guildId: message.guild.id, guild: message.guild, user: message.author, client: message.client }, 'Warning', `${user.tag} • ${reason} • Moderator: ${message.author.tag}`).catch(() => {});
    const escalationText = escalation?.skipped
      ? `\nEscalation skipped: **${escalation.reason}**`
      : escalation && !escalation.repeated
        ? `\nEscalation applied: **${escalation.action}**`
        : '';
    await message.reply({ embeds: [ui.success('Member Warned', `${user} received a warning.\nCase: **#${caseRecord.id}**\nReason: ${reason}${escalationText}`)] });
    return true;
  }

  if (cmd === 'kick') {
    messagePermission(message, PermissionFlagsBits.KickMembers, 'Kick Members');
    if (!target.kickable) throw new Error('I cannot kick that member. Check role hierarchy.');
    await user.send({ embeds: [ui.embed(`You were kicked from ${message.guild.name}`, `Reason: ${reason}`)] }).catch(() => {});
    await target.kick(reason);
    await message.reply({ embeds: [ui.success('Member Kicked', `${user} has been kicked.\nReason: ${reason}`)] });
    return true;
  }

  if (cmd === 'ban') {
    messagePermission(message, PermissionFlagsBits.BanMembers, 'Ban Members');
    if (!target.bannable) throw new Error('I cannot ban that member. Check role hierarchy.');
    await user.send({ embeds: [ui.embed(`You were banned from ${message.guild.name}`, `Reason: ${reason}`)] }).catch(() => {});
    await target.ban({ reason });
    await message.reply({ embeds: [ui.success('Member Banned', `${user} has been banned.\nReason: ${reason}`)] });
    return true;
  }

  if (cmd === 'timeout' || cmd === 'untimeout') {
    messagePermission(message, PermissionFlagsBits.ModerateMembers, 'Moderate Members');
    const ms = cmd === 'timeout' ? parseDuration(args.find(value => /^\d+[mhdw]$/i.test(value))) : null;
    if (cmd === 'timeout' && !target.moderatable) throw new Error('Astrix cannot timeout that member because of role hierarchy.');
    await target.timeout(ms, reason);
    await message.reply({
      embeds: [ui.success(cmd === 'timeout' ? 'Member Timed Out' : 'Timeout Removed', `${user} ${cmd === 'timeout' ? `for **${formatDuration(ms)}**` : 'can speak again'}.\nReason: ${reason}`)]
    });
    return true;
  }

  return false;
}

async function slash(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'show') return i.reply({ embeds: [ui.embed('⌨️ Astrix Prefix', `Current prefix: \`${get(i.guildId)}\``)], ephemeral: true });
  if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to change the prefix.');
  if (sub === 'reset') { delete store.guild(i.guildId).config.prefix; store.save(); return i.reply({ embeds: [ui.success('Prefix Reset', `Prefix is now \`${get(i.guildId)}\`.`)], ephemeral: true }); }
  const value = i.options.getString('value', true).trim();
  if (!value || value.length > 10 || /\s/.test(value)) throw new Error('Prefix must be 1-10 characters and cannot contain spaces.');
  set(i.guildId, value);
  return i.reply({ embeds: [ui.success('Prefix Updated', `Astrix prefix is now \`${value}\`.`)], ephemeral: true });
}


const quickCooldowns = new Map();
function duration(ms) {
  let seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours || days) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes || hours || days) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(', ');
}
function uniqueUsers(client) {
  const ids = new Set();
  for (const guild of client.guilds.cache.values()) {
    for (const id of guild.members.cache.keys()) ids.add(id);
  }
  return ids.size;
}
async function quick(message) {
  if (!message.guild || message.author.bot || !message.content) return false;
  // Bare quick commands are opt-in. Prefix commands must always be handled by message().
  // This prevents messages such as "ping" from hijacking the configured prefix flow.
  if (String(process.env.BARE_QUICK_COMMANDS || 'false').toLowerCase() !== 'true') return false;
  const key = message.content.trim().toLowerCase().replace(/\s+/g, ' ');
  const aliases = new Map([
    ['uptime', 'uptime'], ['users', 'users'], ['servers', 'servers'],
    ['ping', 'ping'], ['botinfo', 'botinfo'], ['nowplaying', 'nowplaying']
  ]);
  const cmd = aliases.get(key);
  if (!cmd) return false;
  const cooldownKey = `${message.guild.id}:${message.author.id}:${cmd}`;
  const now = Date.now(), last = quickCooldowns.get(cooldownKey) || 0;
  if (now - last < 3000) return true;
  quickCooldowns.set(cooldownKey, now);
  setTimeout(() => quickCooldowns.delete(cooldownKey), 5000).unref?.();

  if (cmd === 'uptime') {
    await message.reply({ embeds: [ui.embed(`${message.client.user.username}'s Uptime !`, `▶ I have been online for **${duration(message.client.uptime || process.uptime() * 1000)}**`)] });
    return true;
  }
  if (cmd === 'users') {
    const users = uniqueUsers(message.client);
    await message.reply({ embeds: [ui.embed(`${message.client.user.username}'s Users !`, `▶ Total of **${users.toLocaleString()} cached users** in **${message.client.guilds.cache.size.toLocaleString()} servers**.`)] });
    return true;
  }
  if (cmd === 'servers') {
    await message.reply({ embeds: [ui.embed(`${message.client.user.username}'s Servers !`, `▶ I am currently active in **${message.client.guilds.cache.size.toLocaleString()} servers**.`)] });
    return true;
  }
  if (cmd === 'ping') {
    const ws = Math.max(0, Number(message.client.ws?.ping || 0));
    const rest = Math.max(0, Math.round(message.client.rest?.latency || ws));
    const rating = ws < 80 ? 'Excellent' : ws < 150 ? 'Good' : 'Slow';
    await message.reply({
      embeds: [ui.success('Astrix Ping', `Gateway: **${ws} ms**\nREST: **${rest} ms**\nMemory: **${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB**\nUptime: **${duration(process.uptime() * 1000)}**\nStatus: **${rating}**`)],
      allowedMentions: { repliedUser: false }
    });
    return true;
  }
  if (cmd === 'botinfo') {
    const users = uniqueUsers(message.client);
    await message.reply({ embeds: [ui.embed('🤖 Astrix Bot Info', `▶ **Servers:** ${message.client.guilds.cache.size.toLocaleString()}\n▶ **Cached users:** ${users.toLocaleString()}\n▶ **Uptime:** ${duration(message.client.uptime || process.uptime() * 1000)}\n▶ **Ping:** ${message.client.ws.ping} ms\n▶ **Node.ts:** ${process.version}`)] });
    return true;
  }
  if (cmd === 'nowplaying') {
    const queue = music.queues.get(message.guild.id);
    if (!queue?.current) {
      await message.reply({ embeds: [ui.embed('⚠️ Music Player', '**There is no music player active in this server.**')] });
      return true;
    }
    await message.reply({ embeds: [ui.embed('🎧 Now Playing', `**${queue.current.title}**\nSource: ${queue.current.source || 'Unknown'}\nVolume: **${queue.volume}%**\nQueue: **${queue.tracks?.length || 0}**`)] });
    return true;
  }
  return false;
}

async function message(message) {
  if (!message.guild || message.author.bot || !message.content) return false;

  // Astrix natural action syntax works even when the configured prefix is different.
  // Example: astrix hug @user
  const natural = message.content.trim().match(/^astrix\s+([a-z]+)\b/i);
  if (natural) {
    const action = natural[1].toLowerCase();
    if (fun.actionNames().includes(action)) { if (await privacy.promptMessage(message)) return true; return fun.prefix(message, action); }
    const naturalArgs = message.content.trim().split(/\s+/).slice(2);
    if (action === 'open' && ['lootbox', 'crate', 'crates', 'weaponcrate', 'weapon'].includes(String(naturalArgs[0] || '').toLowerCase())) {
      return prefixCrate(message, String(naturalArgs[0]).toLowerCase(), naturalArgs.slice(1));
    }
  }

  const p = get(message.guild.id);
  const content = message.content.trim();
  const hasConfiguredPrefix = content.toLowerCase().startsWith(p.toLowerCase());
  const noPrefix = !hasConfiguredPrefix && hasNoPrefix(message.guild.id, message.author.id);
  const astrixCommand = !hasConfiguredPrefix && /^astrix\s+/i.test(content)
    ? content.replace(/^astrix\s+/i, '').trim()
    : content;
  const explicitAstrix = !hasConfiguredPrefix && /^astrix\s+/i.test(content);
  const rest = hasConfiguredPrefix ? content.slice(p.length).trim() : (noPrefix || explicitAstrix) ? astrixCommand : '';
  if (!hasConfiguredPrefix && !explicitAstrix && (!noPrefix || !hasPremiumNoPrefix(message.guild.id, message.author.id, message.guild) || !canRunWithoutPrefix(rest))) return false;
  if (!rest) return false;
  const [raw, ...args] = rest.split(/\s+/);
  const cmd = raw.toLowerCase();

  if (['lootbox', 'crate', 'crates', 'weaponcrate', 'weapon', 'wc', 'alb'].includes(cmd)) {
    return prefixCrate(message, cmd, args);
  }
  if (cmd === 'open' && ['lootbox', 'crate', 'crates', 'weaponcrate', 'weapon', 'wc'].includes(String(args[0] || '').toLowerCase())) {
    return prefixCrate(message, String(args[0]).toLowerCase(), args.slice(1));
  }

  if (cmd === 'antimention') return antiMention.prefix(message, args);
  if (cmd === 'cf' || cmd === 'coinflip') return economyUpgrade.playCoinflip(message, args[0], args[1]);
  if (cmd === 'give') return economyUpgrade.startTransfer(message, args);
  if (cmd === 'mute' || cmd === 'unmute') return moderation.prefixMute(message, cmd, args);
  if (['warn', 'kick', 'ban', 'timeout', 'untimeout', 'purge', 'clear', 'role', 'unrole'].includes(cmd)) {
    return prefixModeration(message, cmd, args, noPrefix);
  }
  if (['morning', 'goodmorning', 'gm'].includes(cmd)) {
    await message.react('🌅').catch(() => {});
    await message.reply({ embeds: [ui.embed('🌅 Good Morning', `Good morning, <@${message.author.id}>. Astrix is online and ready to help.`)], allowedMentions: { users: [message.author.id], repliedUser: false } });
    return true;
  }
  if (['night', 'goodnight', 'gn'].includes(cmd)) {
    await message.react('🌙').catch(() => {});
    await message.reply({ embeds: [ui.embed('🌙 Good Night', `Good night, <@${message.author.id}>. Rest well and come back anytime.`)], allowedMentions: { users: [message.author.id], repliedUser: false } });
    return true;
  }
  if (fun.actionNames().includes(cmd)) { if (await privacy.promptMessage(message)) return true; return fun.prefix(message, cmd); }
  if (cmd === 'rob') {
    if (await privacy.promptMessage(message)) return true;
    const target = message.mentions?.users?.first?.();
    if (!target || target.bot) throw new Error(`Mention a human user. Example: \`${p}rob @user\`.`);
    const result = robService.rob(message.guild.id, message.author.id, target.id);
    if (result.protected && result.protection === 'lock') {
      await message.reply({ embeds: [ui.error('🔒 Rob Failed', `<@${target.id}> manually activated a Lock. Your robbery was blocked.\nActive Locks: **${result.locksRemaining}/3**`)] });
      return true;
    }
    if (result.protected && result.protection === 'mine') {
      await message.reply({ embeds: [ui.error('💣 BOOM! Rob Failed', `The manually planted Mine on <@${target.id}> exploded!\nYou paid **${econ.fmt(result.fine)}** to them.`)] });
      return true;
    }
    if (result.success) {
      await message.reply({ embeds: [ui.success('💰 Rob Successful', `🕵️‍♂️ You stole **${econ.fmt(result.amount)}** from <@${target.id}>.`)] });
      return true;
    }
    await message.reply({ embeds: [ui.error('🚨 Rob Failed', `🤡 Plot twist: **${econ.fmt(result.fine)}** was sent to <@${target.id}>.\n\n⏱️ Cooldown: **15 minutes**.`)] });
    return true;
  }
  if (cmd === 'use') {
    if (await privacy.promptMessage(message)) return true;
    const owned = Object.entries(store.user(message.guild.id, message.author.id).inventory || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, qty]) => `${shop.catalogItem(id)?.emoji || '📦'} **${shop.catalogItem(id)?.name || id}** × ${qty}`)
      .join('\n');
    const crateCount = Number(store.user(message.guild.id, message.author.id).crates || 0);
    const weaponCrateCount = Number(store.user(message.guild.id, message.author.id).weaponCrates || 0);
    const itemId = String(args[0] || '').toLowerCase();
    if (!itemId) {
      const e = ui.premiumEmbed('🎒 Your Items', `📦 **Astrix Lootboxes:** ${crateCount}\n🧰 **Weapon Crates:** ${weaponCrateCount}\n${owned || 'You do not own any shop items yet.'}\n\nUse \`${p}lootbox open\` or \`${p}weaponcrate open\` to open crates.\nUse \`${p}use lock\` or \`${p}use mine @user\` to activate protection manually.`);
      const current = store.user(message.guild.id, message.author.id);
      e.addFields({ name: '💰 Wallet', value: `⏣ ${econ.fmt(current.wallet)} / ${econ.fmt(current.walletLimit)}`, inline: true }, { name: '💎 Gems', value: Number(current.premiumGems || 0).toLocaleString(), inline: true });
      await message.reply({ embeds: [e] });
      return true;
    }
    const target = message.mentions?.users?.first?.();
    const adapter = { guildId: message.guild.id, user: message.author };
    if (['only_crate', 'astrix_crate', 'crate', 'crates'].includes(itemId)) {
      const result = crates.open(message.guild.id, message.author.id, 1);
      await message.reply({ embeds: [ui.success('📦 Only Crate Opened', `${crates.formatResults(result.results)}\n\nCrates remaining: **${result.crates}**`)] });
      return true;
    }
    const result = shop.use(adapter, itemId, target);
    await message.reply({ embeds: [ui.success('✅ Item Used', result.text)] });
    return true;
  }
  if (['hunt','dig','fish','beg','search','collection','zoo','quests','achievements'].includes(cmd)) { if (await privacy.promptMessage(message)) return true; return adventure.prefix(message, cmd === 'zoo' ? 'collection' : cmd); }

  if (cmd === 'help') return helpCenter.prefix(message);
  if (cmd === 'help') {
    const actionExamples = [`${p}hug @user`, `${p}slap @user`, `${p}pat @user`, `${p}poke @user`, `${p}bonk @user`, `${p}wave @user`].map(x => `\`${x}\``).join(' • ');
    const sent=await message.reply({embeds:[ui.embed('⏳ Loading Astrix Help','Opening the command center…\n\n`[■■□□□□]`')]});
    await new Promise(resolve=>setTimeout(resolve,450));
   await sent.edit({embeds:[ui.embed('✨ Astrix Help',`Prefix: \`${p}\`\n\n**🛡️ Moderation**\nUse moderation, AutoMod and \`${p}mute @user\` / \`${p}unmute @user\` to keep your server safe.\n\n**⭐ XP & Levels**\nAstrix awards XP automatically from activity and levels up users.\n\n**💎 Premium**\nUse \`${p}premium\` or \`/premium\` to view Premium and upgrade options.\n\n**Premium no-prefix commands**\nEligible Premium members can use the listed command names directly, or write \`astrix <command>\`. Basic members should use the configured prefix.\n\n**Quick Commands**\n\`${p}help\` • \`${p}ping\` • \`${p}balance\` • \`${p}premium\` • \`${p}prefix\` • \`${p}serverinfo\` • \`${p}membercount\`\n\n**Economy & Protection**\n\`${p}shop\` • \`${p}buy <item>\` • \`${p}sell <item>\` • \`${p}inventory\` • \`${p}use\` • \`${p}use lock\` • \`${p}use mine @user\` • \`${p}rob @user\`\n\n**Actions**\n${actionExamples}\n\n**Adventure / Collection**\n\`${p}hunt\` • \`${p}fish\` • \`${p}dig\` • \`${p}beg\` • \`${p}search\` • \`${p}collection\` • \`${p}quests\` • \`${p}achievements\``)]});
    return true;
  }
  if (cmd === 'ping') { await message.reply({ embeds: [ui.embed('📡 Pong', `WebSocket: **${message.client.ws.ping} ms**`)] }); return true; }
  if (cmd === 'uptime') { await message.reply({ embeds: [ui.embed(`${message.client.user.username}'s Uptime !`, `▶ I have been online for **${duration(message.client.uptime || process.uptime() * 1000)}**`)] }); return true; }
  if (cmd === 'users') { const users = uniqueUsers(message.client); await message.reply({ embeds: [ui.embed(`${message.client.user.username}'s Users !`, `▶ Total of **${users.toLocaleString()} cached users** in **${message.client.guilds.cache.size.toLocaleString()} servers**.`)] }); return true; }
  if (cmd === 'servers') { await message.reply({ embeds: [ui.embed(`${message.client.user.username}'s Servers !`, `▶ I am currently active in **${message.client.guilds.cache.size.toLocaleString()} servers**.`)] }); return true; }
  if (cmd === 'botinfo' || (cmd === 'bot' && String(args[0] || '').toLowerCase() === 'info')) { const users = uniqueUsers(message.client); await message.reply({ embeds: [ui.embed('🤖 Astrix Bot Info', `▶ **Servers:** ${message.client.guilds.cache.size.toLocaleString()}\n▶ **Cached users:** ${users.toLocaleString()}\n▶ **Uptime:** ${duration(message.client.uptime || process.uptime() * 1000)}\n▶ **Ping:** ${message.client.ws.ping} ms\n▶ **Node.js:** ${process.version}`)] }); return true; }
  if (cmd === 'nowplaying') { const queue = music.queues.get(message.guild.id); if (!queue?.current) { await message.reply({ embeds: [ui.embed('⚠️ Music Player', '**There is no music player active in this server.**')] }); return true; } await message.reply({ embeds: [ui.embed('🎧 Now Playing', `**${queue.current.title}**\nSource: ${queue.current.source || 'Unknown'}\nVolume: **${queue.volume}%**\nQueue: **${queue.tracks?.length || 0}**`)] }); return true; }
  if (cmd === 'balance') {
    if (await privacy.promptMessage(message)) return true;
    const target = message.mentions.users.first() || message.author;
    const u = store.user(message.guild.id, target.id);
    await message.reply({ embeds: [ui.embed(`💰 ${target.username}'s Balance`, `Wallet: **${econ.fmt(u.wallet)}**\nBank: **${econ.fmt(u.bank)}**\nAstrix Gems: **💎 ${Number(u.premiumGems||0).toLocaleString()}**`)] });
    return true;
  }
  if (cmd === 'premium') {
    const u = store.user(message.guild.id, message.author.id);
    await message.reply({ embeds: [ui.premiumEmbed('Astrix Premium', `Tier: **${premium.tierName(premium.tierFor(message.guild.id, message.author.id, message.guild))}**\nAstrix Gems: **💎 ${Number(u.premiumGems||0).toLocaleString()}**\nEarly Access: **${u.earlyAccess ? 'Enabled' : 'Not enabled'}**`)] });
    return true;
  }
  if (['givepremium', 'premiumgrant', 'grantpremium', 'removepremium', 'premiumrevoke'].includes(cmd)) {
    if (!premium.isOwner(message.author.id)) throw new Error('This Premium command is restricted to the configured Astrix owner.');
    const target = message.mentions.users.first();
    if (!target || target.bot) throw new Error(`Mention a human user. Example: \`${p}givepremium @user 30d premium\`.`);
    if (['removepremium', 'premiumrevoke'].includes(cmd)) {
      premium.removeMembership(message.guild.id, target.id);
      await target.send({ embeds: [ui.embed('Astrix Premium Removed', `Your manual Astrix Premium was removed in **${message.guild.name}**.`)] }).catch(() => {});
      await message.reply({ embeds: [ui.ownerEmbed('Premium Removed', `Manual Premium was removed from ${target}.\n\nAstrix also attempted to notify them by DM.`)] });
      return true;
    }
    const duration = premiumDuration(args);
    const days = duration.days;
    const tier = premiumTierArg(args);
    const result = premium.grantMembership(message.guild.id, target.id, { tier, days });
    const durationText = days ? `for **${days} day(s)**` : '**permanently**';
    const dm = `You received **${premium.tierName(result.tier)}** from Astrix ${durationText} in **${message.guild.name}**.\n\nThe grant was created with:\n\`${p}givepremium @user ${duration.raw} ${tier}\``;
    const dmSent = await target.send({ embeds: [ui.success('Astrix Premium Granted', dm)] }).then(() => true).catch(() => false);
    await message.reply({ embeds: [ui.ownerEmbed('Premium Granted', `${target} received **${premium.tierName(result.tier)}** ${durationText}.\n\nDM notification: **${dmSent ? 'sent' : 'blocked by their privacy settings'}**`)] });
    return true;
  }
  if (['serverpremium', 'premiumserver', 'premiumservergrant', 'premiumserverrevoke'].includes(cmd)) {
    if (!premium.isOwner(message.author.id)) throw new Error('Server Premium commands are restricted to the configured Astrix owner.');
    const guild = store.guild(message.guild.id);
    guild.config ||= {};
    if (cmd === 'premiumserverrevoke') {
      guild.config.serverPremiumTier = 'free';
      guild.config.serverPremiumPermanent = false;
      guild.config.serverPremiumUntil = 0;
      store.save();
      await message.reply({ embeds: [ui.ownerEmbed('Server Premium Removed', `Premium was removed from **${message.guild.name}**.`)] });
      return true;
    }
    const duration = premiumDuration(args);
    const days = duration.days;
    const tier = premiumTierArg(args);
    guild.config.serverPremiumTier = tier;
    guild.config.serverPremiumPermanent = !days;
    guild.config.serverPremiumUntil = days ? Date.now() + days * 86400000 : 0;
    store.save();
    await message.reply({ embeds: [ui.ownerEmbed('Server Premium Granted', `**${message.guild.name}** received **${premium.tierName(tier)}** ${days ? `for ${days} day(s)` : 'permanently'}.`)] });
    return true;
  }
  if (cmd === 'prefix') { await message.reply(`Current Astrix prefix: \`${p}\``); return true; }
  if (cmd === 'serverinfo') { await message.reply({ embeds: [ui.embed(`🏠 ${message.guild.name}`, `Members: **${message.guild.memberCount}**\nServer ID: \`${message.guild.id}\``)] }); return true; }
  if (cmd === 'membercount') { await message.reply(`👥 **${message.guild.memberCount}** members.`); return true; }

  if (noPrefix) return false;
  await message.reply({ embeds: [ui.embed('❓ Unknown Prefix Command', `I could not find \`${p}${cmd}\`.\nUse \`${p}help\` to see available prefix commands.`)] }).catch(() => {});
  return true;
}

module.exports = {
  get,
  set,
  slash,
  noPrefixSlash,
  hasNoPrefix,
  noPrefixUsers,
  hasPremiumNoPrefix,
  isFastNoPrefixMessage,
  message,
  quick
};
