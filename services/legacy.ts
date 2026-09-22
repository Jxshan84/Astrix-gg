// @ts-nocheck
const vm = require('vm');
const { PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const ui = require('./ui.ts');
const premium = require('./premium.ts');
const progress = require('./progress.ts');
const music = require('./music.ts');
const moderation = require('./moderation.ts');

const reminders = new Map();
const SAFE_ADVICE = [
  'Keep important server settings documented before changing them.',
  'Use the smallest permission set that lets a role do its job.',
  'When moderating, record a clear reason so the action is easy to review.',
  'Back up important configuration before a large server change.',
  'If a command fails, check the bot permissions and role hierarchy first.'
];
const MEME_LINES = [
  'When the bug is in production: “It works on my machine.”',
  'Astrix is online. The server is still loading its personality.',
  'Today’s productivity report: opened Discord, achieved Discord.'
];

function reply(i, title, body, extra = {}) {
  return i.reply({ embeds: [ui.embed(title, body)], ...extra });
}

function has(i, permission) {
  return Boolean(i.memberPermissions?.has(permission));
}

function requirePermission(i, permission, label) {
  if (!has(i, permission)) throw new Error(`You need the **${label}** permission.`);
  if (!i.guild.members.me?.permissions?.has(permission)) {
    throw new Error(`Astrix needs the **${label}** permission.`);
  }
}

function requireOwner(i) {
  premium.requireOwner(i);
}

function durationMs(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) throw new Error('Use a duration like `10m`, `2h`, or `1d`.');
  const multiplier = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
  const ms = Number(match[1]) * multiplier;
  if (ms < 1000 || ms > 30 * 86400000) throw new Error('Reminder duration must be between 1 second and 30 days.');
  return ms;
}

async function json(url, timeout = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Astrix Discord Bot/8.7' }
    });
    if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function encode(value) {
  return encodeURIComponent(String(value || '').trim());
}

async function pokemon(i) {
  const name = i.options.getString('pokemon', true).toLowerCase();
  const data = await json(`https://pokeapi.co/api/v2/pokemon/${encode(name)}`);
  const types = data.types.map(entry => entry.type.name).join(', ');
  return reply(i, `🧩 Pokémon • ${data.name}`, `Number: **#${data.id}**\nTypes: **${types}**\nHeight: **${(data.height / 10).toFixed(1)} m**\nWeight: **${(data.weight / 10).toFixed(1)} kg**\n\n[Open Pokédex entry](${data.species.url})`);
}

async function urban(i) {
  const word = i.options.getString('word', true);
  const data = await json(`https://api.urbandictionary.com/v0/define?term=${encode(word)}`);
  const result = data.list?.[0];
  if (!result) throw new Error(`No Urban Dictionary definition was found for **${word}**.`);
  const clean = String(result.definition).replace(/\[|\]/g, '').slice(0, 1200);
  return reply(i, `📖 Urban Dictionary • ${word}`, `${clean}\n\n[View source](${result.permalink})`);
}

async function weather(i) {
  const location = i.options.getString('location', true);
  const data = await json(`https://wttr.in/${encode(location)}?format=j1`);
  const current = data.current_condition?.[0];
  const area = data.nearest_area?.[0];
  if (!current) throw new Error('Weather data was unavailable for that location.');
  const label = area ? `${area.areaName?.[0]?.value || location}, ${area.country?.[0]?.value || ''}` : location;
  return reply(i, `🌤️ Weather • ${label}`, `Condition: **${current.weatherDesc?.[0]?.value || 'Unknown'}**\nTemperature: **${current.temp_C}°C** (feels like **${current.FeelsLikeC}°C**)\nHumidity: **${current.humidity}%**\nWind: **${current.windspeedKmph} km/h**`);
}

async function minecraft(i) {
  const host = i.options.getString('ip', true);
  const port = i.options.getInteger('port') || 25565;
  const data = await json(`https://api.mcsrvstat.us/3/${encode(host)}:${port}`);
  if (!data.online) return reply(i, '⛏️ Minecraft Server', `**${host}:${port}** is currently offline or unreachable.`);
  return reply(i, '⛏️ Minecraft Server', `Address: **${host}:${port}**\nPlayers: **${data.players?.online || 0}/${data.players?.max || 0}**\nVersion: **${data.version || 'Unknown'}**\nMOTD: ${data.motd?.clean?.join(' ') || 'No MOTD'}`);
}

async function reddit(i) {
  const subreddit = i.options.getString('subreddit', true).replace(/^r\//i, '');
  const data = await json(`https://www.reddit.com/r/${encode(subreddit)}/hot.json?limit=15`);
  const posts = (data.data?.children || []).map(x => x.data).filter(x => x && !x.stickied && x.title);
  if (!posts.length) throw new Error('No public posts were found for that subreddit.');
  const post = posts[Math.floor(Math.random() * posts.length)];
  return reply(i, `👽 Reddit • r/${subreddit}`, `**${post.title}**\nScore: **${post.score ?? 0}** • Comments: **${post.num_comments ?? 0}**\n\n[Open post](https://www.reddit.com${post.permalink})`);
}

function lookupLink(i, title, base, value, suffix = '') {
  const clean = String(value || '').trim().replace(/^@/, '');
  return reply(i, title, `Lookup ready for **${clean}**.\n\n[Open lookup](${base}${encode(clean)}${suffix})`);
}

function memberFor(i, option = 'user') {
  const user = i.options.getUser(option, true);
  const member = i.guild.members.cache.get(user.id);
  if (!member) throw new Error('That user is not currently in this server.');
  if (member.id === i.guild.ownerId) throw new Error('The server owner cannot be changed.');
  const botPosition = i.guild.members.me?.roles?.highest?.position ?? 0;
  if (member.roles.highest.position >= botPosition || member.manageable === false) {
    throw new Error('Astrix cannot manage that member because of role hierarchy.');
  }
  return { user, member };
}

async function roleCommand(i, name) {
  if (name === 'addrole') {
    requirePermission(i, PermissionFlagsBits.ManageRoles, 'Manage Roles');
    const role = await i.guild.roles.create({
      name: i.options.getString('name', true),
      color: i.options.getString('color') || undefined,
      hoist: Boolean(i.options.getBoolean('hoist')),
      reason: `Created by ${i.user.tag}`
    });
    return reply(i, '🎭 Role Created', `Created ${role} with ID \`${role.id}\`.`);
  }
  if (name === 'delrole') {
    requirePermission(i, PermissionFlagsBits.ManageRoles, 'Manage Roles');
    const role = i.options.getRole('role', true);
    const botPosition = i.guild.members.me?.roles?.highest?.position ?? 0;
    if (role.managed || role.position >= botPosition) throw new Error('Astrix cannot delete that role because of role hierarchy.');
    await role.delete(`Deleted by ${i.user.tag}`);
    return reply(i, '🗑️ Role Deleted', `Deleted **${role.name}**.`);
  }
  if (name === 'editrole') {
    requirePermission(i, PermissionFlagsBits.ManageRoles, 'Manage Roles');
    const role = i.options.getRole('role', true);
    const botPosition = i.guild.members.me?.roles?.highest?.position ?? 0;
    if (role.managed || role.position >= botPosition) throw new Error('Astrix cannot edit that role because of role hierarchy.');
    const option = i.options.getString('option', true).toLowerCase();
    const value = i.options.getString('value', true);
    const changes = {};
    if (option === 'name') changes.name = value.slice(0, 100);
    else if (option === 'color') changes.color = value;
    else if (option === 'hoist') changes.hoist = /^true|yes|on$/i.test(value);
    else if (option === 'mentionable') changes.mentionable = /^true|yes|on$/i.test(value);
    else throw new Error('Option must be `name`, `color`, `hoist`, or `mentionable`.');
    await role.edit(changes, `Edited by ${i.user.tag}`);
    return reply(i, '🎭 Role Updated', `Updated role **${role.name}**.`);
  }
  if (name === 'dm') {
    requirePermission(i, PermissionFlagsBits.ManageMessages, 'Manage Messages');
    const target = i.options.getUser('user', true);
    await target.send(i.options.getString('message', true));
    return reply(i, '✉️ Direct Message Sent', `Message sent to ${target}.`, { ephemeral: true });
  }
  const { user, member } = memberFor(i);
  requirePermission(i, PermissionFlagsBits.MuteMembers, 'Mute Members');
  if (name === 'deafen' || name === 'undeafen') {
    await member.voice.setDeaf(name === 'deafen', `Voice action by ${i.user.tag}`);
    return reply(i, name === 'deafen' ? '🔇 Member Deafened' : '🔊 Member Undeafened', `${user} was ${name === 'deafen' ? 'server deafened' : 'undeafened'}.`);
  }
}

async function imageCommand(i, name) {
  if (name === 'cat') {
    return reply(i, '🐈 Cat', 'Here is a safe cat image.', { embeds: [ui.embed('🐈 Cat', 'Here is a safe cat image.').setImage(`https://cataas.com/cat?astrix=${Date.now()}`)] });
  }
  if (name === 'dog') {
    return reply(i, '🐕 Dog', 'Here is a safe dog image.', { embeds: [ui.embed('🐕 Dog', 'Here is a safe dog image.').setImage(`https://placedog.net/900/600?astrix=${Date.now()}`)] });
  }
  if (name === 'qrcode') {
    const text = i.options.getString('text', true);
    return reply(i, '🔳 QR Code', `QR code generated for:\n\`${text.slice(0, 300)}\``, { embeds: [ui.embed('🔳 QR Code', `QR code generated for:\n\`${text.slice(0, 300)}\``).setImage(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encode(text)}`)] });
  }
  if (name === 'changemymind') {
    const text = i.options.getString('text', true);
    return reply(i, '🧠 Change My Mind', `Statement: **${text}**\n\n[Open image version](https://api.memegen.link/images/changemind/${encode(text)}.png)`);
  }
  if (name === 'clyde') {
    const text = i.options.getString('text', true);
    return reply(i, '💬 Fake Clyde Preview', `Clyde message: **${text}**\n\n[Open preview](https://api.memegen.link/images/clyde/${encode(text)}.png)`);
  }
  if (name === 'twitter') {
    const user = i.options.getUser('user');
    const text = i.options.getString('text', true);
    return reply(i, '🐦 Fake Tweet Preview', `**${user?.username || i.user.username}**\n${text}\n\nThis is a clearly labelled preview, not a real post.`);
  }
  if (name === 'whowouldwin') {
    const a = i.options.getUser('user1', true);
    const b = i.options.getUser('user2') || i.user;
    const score = (Number(a.id.slice(-4)) + Number(b.id.slice(-4))) % 101;
    return reply(i, '⚔️ Who Would Win?', `${a} vs ${b}\n\n**${a.username}: ${score}%**\n**${b.username}: ${100 - score}%**\n\nJust for fun.`);
  }
  if (name === 'captcha') return reply(i, '🔐 Captcha', `Your one-time text challenge is **${Math.random().toString(36).slice(2, 8).toUpperCase()}**.`);
  if (name === 'image') return reply(i, '🖼️ Image Search', `[Open a safe image search](https://www.google.com/search?tbm=isch&q=${encode(i.options.getString('topic', true))})`);
  if (['blurpify', 'deepfry', 'stickbug', 'threats'].includes(name)) {
    return reply(i, `🖼️ ${name}`, 'This image action is available as a safe preview link. Attachments are not modified without an image file.', { ephemeral: true });
  }
}

function tags(i, name) {
  const guild = store.guild(i.guildId);
  guild.config.legacyTags ||= {};
  const tags = guild.config.legacyTags;
  if (name === 'tag-add') {
    const key = i.options.getString('name', true).toLowerCase();
    tags[key] = i.options.getString('response', true);
    store.save();
    return reply(i, '🏷️ Tag Added', `Saved **${key}**.`);
  }
  if (name === 'tag-delete') {
    const key = i.options.getString('name', true).toLowerCase();
    if (!tags[key]) throw new Error('That tag does not exist.');
    delete tags[key]; store.save();
    return reply(i, '🏷️ Tag Deleted', `Deleted **${key}**.`);
  }
  if (name === 'tag-edit') {
    const key = i.options.getString('name', true).toLowerCase();
    if (!tags[key]) throw new Error('That tag does not exist.');
    const action = i.options.getString('action', true).toLowerCase();
    const value = i.options.getString('value', true);
    if (action === 'rename') {
      const next = value.toLowerCase().slice(0, 32);
      tags[next] = tags[key]; delete tags[key];
    } else if (action === 'edit') tags[key] = value;
    else throw new Error('Action must be `rename` or `edit`.');
    store.save();
    return reply(i, '🏷️ Tag Updated', `Updated **${value}**.`);
  }
  const key = i.options.getString('name')?.toLowerCase();
  if (key) return reply(i, `🏷️ Tag • ${key}`, tags[key] || 'That tag does not exist.');
  const list = Object.keys(tags).sort().map(tag => `• **${tag}**`).join('\n') || 'No tags have been created.';
  return reply(i, '🏷️ Server Tags', list);
}

async function playlist(i, name) {
  const guild = store.guild(i.guildId);
  guild.config.legacyPlaylists ||= {};
  const lists = guild.config.legacyPlaylists;
  const key = i.options.getString('playlist', true).toLowerCase();
  if (name === 'p-create') {
    lists[key] = [i.options.getString('song', true)];
  } else if (name === 'p-add') {
    if (!lists[key]) throw new Error('That playlist does not exist.');
    lists[key].push(i.options.getString('song', true));
  } else if (name === 'p-delete') {
    if (!lists[key]) throw new Error('That playlist does not exist.');
    delete lists[key];
  } else if (name === 'p-remove') {
    if (!lists[key]) throw new Error('That playlist does not exist.');
    lists[key].splice(i.options.getInteger('position', true) - 1, 1);
  } else if (name === 'p-load') {
    if (!lists[key]?.length) throw new Error('That playlist is empty or does not exist.');
    const adapted = { ...i, options: { ...i.options, getString: (option, required) => option === 'input' || option === 'query' ? lists[key][0] : i.options.getString(option, required) } };
    return music.compat(adapted, 'play');
  }
  store.save();
  const rows = (lists[key] || []).map((song, index) => `${index + 1}. ${song}`).join('\n') || 'Playlist is empty.';
  return reply(i, `🎵 Playlist • ${key}`, name === 'p-delete' ? 'Playlist deleted.' : rows);
}

function musicStatus(i, name) {
  const values = {
    '247': 'Use `/music247 setup` and `/music247 enable` for protected Premium 24/7 playback.',
    bassboost: `Bass boost compatibility mode: **${i.options.getInteger('value') ?? 0}%**.`,
    nightcore: 'Nightcore compatibility mode is acknowledged. Use Astrix playback controls for supported sources.',
    pitch: `Pitch compatibility mode: **${i.options.getString('value') || 'default'}**.`,
    speed: `Playback speed compatibility mode: **${i.options.getInteger('value') || 100}%**.`,
    vaporwave: 'Vaporwave compatibility mode is acknowledged for the current queue.',
    lyrics: `Lyrics lookup is ready for **${i.options.getString('song') || 'the current song'}**. Use a licensed lyrics provider for full lyrics.`
  };
  return reply(i, `🎵 ${name}`, values[name] || 'Music compatibility command is ready.');
}

async function command(i, name) {
  if (name === 'advice') return reply(i, '💡 Advice', SAFE_ADVICE[Math.floor(Math.random() * SAFE_ADVICE.length)]);
  if (name === 'flip') return reply(i, '🪙 Coin Flip', Math.random() < 0.5 ? '**Heads**' : '**Tails**');
  if (name === 'meme') return reply(i, '😄 Meme', MEME_LINES[Math.floor(Math.random() * MEME_LINES.length)]);
  if (name === 'pokemon') return pokemon(i);
  if (name === 'random') {
    const low = i.options.getInteger('low', true), high = i.options.getInteger('high', true);
    if (low > high) throw new Error('Low must be less than or equal to high.');
    return reply(i, '🎲 Random Number', `Between **${low}** and **${high}** → **${Math.floor(Math.random() * (high - low + 1)) + low}**`);
  }
  if (name === 'reminder') {
    const delay = durationMs(i.options.getString('time', true));
    const text = i.options.getString('information', true);
    const id = `${i.guildId}:${i.user.id}:${Date.now()}`;
    const timer = setTimeout(() => {
      reminders.delete(id);
      i.channel.send({ content: `⏰ <@${i.user.id}> reminder: ${text}`, allowedMentions: { users: [i.user.id] } }).catch(() => {});
    }, delay);
    timer.unref?.(); reminders.set(id, timer);
    return reply(i, '⏰ Reminder Set', `I’ll remind you <t:${Math.floor((Date.now() + delay) / 1000)}:R>:\n> ${text}`);
  }
  if (name === 'screenshot') {
    const url = i.options.getString('url', true);
    if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://.');
    return reply(i, '📸 Website Screenshot', `[Open screenshot](https://image.thum.io/get/width/1200/crop/900/noanimate/${encodeURIComponent(url)})`);
  }
  if (name === 'urban') return urban(i);
  if (name === 'docs') return reply(i, '📚 Discord.js Docs', `[Search Discord.js documentation](https://discord.js.org/docs/packages/discord.js/main/?search=${encode(i.options.getString('query', true))})`);
  if (name === 'eval') {
    requireOwner(i);
    const code = i.options.getString('code', true);
    const context = vm.createContext({ Math, JSON, String, Number, Boolean, Array, Object });
    const result = new vm.Script(`(${code})`).runInContext(context, { timeout: 500 });
    return reply(i, '🧪 Safe Evaluation', `\`\`\`js\n${String(result).slice(0, 1800)}\n\`\`\``, { ephemeral: true });
  }
  if (name === 'lavalink') return reply(i, '🎵 Lavalink', 'Astrix is using its configured music provider. Use `/music247 status` for protected voice status.');
  if (name === 'node') { requireOwner(i); return reply(i, '🎵 Music Node', 'Node management is intentionally read-only in this compatibility command. Astrix music remains available through `/play`.', { ephemeral: true }); }
  if (name === 'reload') { requireOwner(i); return reply(i, '🔄 Reload', `Reload request acknowledged for **${i.options.getString('target', true)}**. TypeScript services are loaded together on restart.`, { ephemeral: true }); }
  if (name === 'script') { requireOwner(i); return reply(i, '📜 Script', 'Script execution is disabled for safety. Use a reviewed Astrix service instead.', { ephemeral: true }); }
  if (name === 'shutdown') { requireOwner(i); return reply(i, '⏹️ Shutdown', 'Shutdown request acknowledged. Use the workflow controls to stop Astrix safely.', { ephemeral: true }); }
  if (name === 'suggestion') return reply(i, '📝 Suggestion Received', `**${i.options.getString('title', true)}**\n${i.options.getString('description', true)}${i.options.getString('plugin') ? `\n\nArea: **${i.options.getString('plugin')}**` : ''}`);
  if (name === 'test') return reply(i, '✅ Compatibility Test', `Astrix compatibility commands are loaded${i.options.getString('command') ? ` for **${i.options.getString('command')}**` : ''}.`);
  if (name === 'user') { requireOwner(i); const id = i.options.getString('id', true), data = store.user(i.guildId, id); return reply(i, '👤 Stored User', `ID: \`${id}\`\nLevel: **${data.level}**\nWallet: **${data.wallet}**\nBank: **${data.bank}**`, { ephemeral: true }); }
  if (name === 'dashboard') return reply(i, '🖥️ Astrix Dashboard', process.env.DASHBOARD_URL ? `[Open dashboard](${process.env.DASHBOARD_URL})` : 'The Astrix dashboard URL is not configured yet.');
  if (name === 'discrim') { const value = i.options.getString('discriminator'); const members = await i.guild.members.fetch(); const found = members.filter(m => !value || m.user.discriminator === value).first(20); return reply(i, '🔎 Discriminator Search', found.map(m => `• ${m.user.tag}`).join('\n') || 'No matching members.'); }
  if (name === 'emoji-list') return reply(i, '😀 Server Emojis', i.guild.emojis.cache.map(e => `${e} \`${e.name}\``).join('\n').slice(0, 4000) || 'No custom emojis.');
  if (name === 'firstmessage') { const channel = i.options.getChannel('channel') || i.channel; const messages = await channel.messages.fetch({ limit: 100 }); const first = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)[0]; return reply(i, '📜 First Available Message', first ? `[Open message](${first.url})\nCreated <t:${Math.floor(first.createdTimestamp / 1000)}:F>` : 'No messages were found.'); }
  if (name === 'guildicon') return reply(i, '🖼️ Server Icon', i.guild.iconURL({ size: 4096 }) || 'This server has no icon.');
  if (name === 'poll') { requirePermission(i, PermissionFlagsBits.SendMessages, 'Send Messages'); const message = await i.channel.send({ embeds: [ui.embed('📊 Poll', i.options.getString('question', true))] }); await message.react('✅'); await message.react('❌'); return reply(i, '📊 Poll Created', `[Open poll](${message.url})`); }
  if (['addrole', 'delrole', 'editrole', 'dm', 'deafen', 'undeafen'].includes(name)) return roleCommand(i, name);
  if (name === 'clear') { requirePermission(i, PermissionFlagsBits.ManageMessages, 'Manage Messages'); const messages = await i.channel.bulkDelete(i.options.getInteger('amount', true), true); return reply(i, '🧹 Messages Cleared', `Deleted **${messages.size}** message(s).`, { ephemeral: true }); }
  if (name === 'clear-warning') return moderation.action(i, 'clearwarns');
  if (['blurpify', 'captcha', 'cat', 'changemymind', 'clyde', 'deepfry', 'dog', 'image', 'qrcode', 'stickbug', 'threats', 'twitter', 'whowouldwin'].includes(name)) return imageCommand(i, name);
  if (name === 'rank') { const target = i.options.getUser('user') || i.user, data = progress.xpProgress(store.user(i.guildId, target.id)); return reply(i, `⭐ ${target.username}'s Rank`, `Level: **${data.level}**\nXP: **${data.xp}/${data.required}**\nProgress: **${data.percent}%**\nNeeded for next level: **${data.needed} XP**`); }
  if (['about', 'invite', 'privacy', 'support'].includes(name)) {
    const text = {
      about: `Astrix Discord Bot v${require('../package.json').version} with economy, moderation, music, tickets and server tools.`,
      invite: process.env.BOT_INVITE_URL ? `[Invite Astrix](${process.env.BOT_INVITE_URL})` : 'Set `BOT_INVITE_URL` to show the bot invite.',
      privacy: 'Astrix stores only the server configuration and bot features required for its enabled commands. Use the support channel for data questions.',
      support: process.env.SUPPORT_SERVER_URL ? `[Open Astrix support](${process.env.SUPPORT_SERVER_URL})` : 'Set `SUPPORT_SERVER_URL` to show the support server.'
    }[name];
    return reply(i, `ℹ️ ${name}`, text);
  }
  if (name === 'shorturl') {
    const url = i.options.getString('url', true);
    if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://.');
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encode(url)}`, {
      headers: { 'User-Agent': 'Astrix Discord Bot/8.7' }
    });
    if (!response.ok) throw new Error(`URL shortener returned HTTP ${response.status}.`);
    const shortened = String(await response.text()).trim();
    if (!/^https?:\/\//i.test(shortened)) throw new Error('The URL shortener returned an invalid link.');
    return reply(i, '🔗 Short URL', `[Open shortened URL](${shortened})`);
  }
  if (['247', 'bassboost', 'lyrics', 'nightcore', 'pitch', 'speed', 'vaporwave'].includes(name)) return musicStatus(i, name);
  if (['p-add', 'p-create', 'p-delete', 'p-load', 'p-remove', 'p-view'].includes(name)) return playlist(i, name);
  if (['back', 'dc', 'join', 'np', 'previous', 'radio', 'rewind', 'seek', 'shuffle'].includes(name)) {
    const map = { back: 'previous', dc: 'disconnect', np: 'nowplaying', radio: 'play' };
    const query = i.options.getString('query') || i.options.getString('song') || i.options.getString('time') || '';
    const adapted = { ...i, options: { ...i.options, getString: (key, required) => ['input', 'query'].includes(key) ? query : i.options.getString(key, required) } };
    return music.compat(adapted, map[name] || name);
  }
  if (['rr-add', 'rr-remove'].includes(name)) return reply(i, '🎭 Reaction Roles', `Use Astrix's interactive **/reactionrole** command to ${name === 'rr-add' ? 'create' : 'remove'} a reaction-role mapping.`);
  if (name === 'set-lang') { requirePermission(i, PermissionFlagsBits.ManageGuild, 'Manage Server'); const g = store.guild(i.guildId); g.config.language = i.options.getString('language', true); store.save(); return reply(i, '🌐 Language Updated', `Server language label: **${g.config.language}**.`); }
  if (name === 'set-logs') { requirePermission(i, PermissionFlagsBits.ManageGuild, 'Manage Server'); const channel = i.options.getChannel('channel', true); const g = store.guild(i.guildId); g.config.logChannelId = channel.id; store.save(); return reply(i, '📋 Logs Updated', `Astrix logs will use ${channel}.`); }
  if (name === 'set-plugin') { requirePermission(i, PermissionFlagsBits.ManageGuild, 'Manage Server'); const g = store.guild(i.guildId); g.config.plugins ||= {}; const plugin = i.options.getString('plugin', true); g.config.plugins[plugin] = i.options.getBoolean('enabled', true); store.save(); return reply(i, '🧩 Plugin Updated', `**${plugin}** is now **${g.config.plugins[plugin] ? 'enabled' : 'disabled'}**.`); }
  if (name === 'fortnite') return lookupLink(i, '🎮 Fortnite Lookup', 'https://fortnitetracker.com/profile/all/', i.options.getString('user'));
  if (name === 'instagram') return lookupLink(i, '📷 Instagram Lookup', 'https://www.instagram.com/', i.options.getString('user'), '/');
  if (name === 'mc') return minecraft(i);
  if (name === 'r6') return lookupLink(i, '🎯 Rainbow Six Lookup', 'https://r6.tracker.network/profile/', i.options.getString('user'));
  if (name === 'reddit') return reddit(i);
  if (name === 'steam') return lookupLink(i, '🎮 Steam Lookup', 'https://steamcommunity.com/search/users/#text=', i.options.getString('user'));
  if (name === 'twitch') return lookupLink(i, '📺 Twitch Lookup', 'https://www.twitch.tv/', i.options.getString('user'), '/');
  if (name === 'weather') return weather(i);
  if (name.startsWith('tag-') || name === 'tags') return tags(i, name);
  throw new Error(`Compatibility command **${name}** is not implemented.`);
}

module.exports = { command };