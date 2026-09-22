// @ts-nocheck
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const ui = require('./ui.ts');

const MAX_TIMEOUT_MS = 2_000_000_000;
const timers = new Map();
const inFlight = new Set();

function data(guildId) {
  const g = store.guild(guildId);
  g.giveaways ||= {};
  return g.giveaways;
}

function parseDuration(text) {
  const m = String(text || '').trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) throw new Error('Use a duration like `30m`, `2h`, or `1d`.');
  const n = Number(m[1]);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()];
  const ms = n * mult;
  if (ms < 30000 || ms > 30 * 86400000) throw new Error('Giveaway duration must be between 30 seconds and 30 days.');
  return ms;
}

function canManage(i) {
  return i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || i.memberPermissions?.has(PermissionFlagsBits.ManageEvents);
}

function row(messageId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:enter:${messageId}`).setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}

function embed(record, ended = false, winnerIds = []) {
  const end = Math.floor(record.endsAt / 1000);
  const entrants = record.entrants?.length || 0;
  const winners = winnerIds.length
    ? `\n**Winner${winnerIds.length === 1 ? '' : 's'}:** ${winnerIds.map(id => `<@${id}>`).join(', ')}`
    : '';
  return ui.premiumEmbed(
    ended ? '🎉 Giveaway Ended' : '🎉 Astrix Giveaway',
    `**Prize:** ${record.prize}\n**Winners:** ${record.winners}\n**Entries:** ${entrants}\n` +
    (ended ? `**Ended:** <t:${end}:R>` : `**Ends:** <t:${end}:R> (<t:${end}:F>)`) +
    `\n**Hosted by:** <@${record.hostId}>${winners}`
  );
}

function royalFrame(record, title, body) {
  return ui.royalEmbed(title, `${body}\n\n**Prize:** ${record.prize}\n**Entries:** ${record.entrants?.length || 0}`);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function playReveal(message, record, reroll) {
  const frames = [
    ['Royal Giveaway Draw', reroll ? '🔁 The royal court has called for a reroll.' : '🎲 The royal draw is beginning...'],
    ['Royal Giveaway Draw', '⚔️ Entrants are being verified and the winning names are being sealed...'],
    ['Royal Giveaway Draw', '👑 The crown is choosing the winner...'],
  ];

  for (const [title, body] of frames) {
    await message.edit({
      embeds: [royalFrame(record, title, body)],
      components: [row(record.messageId)]
    }).catch(() => {});
    await wait(850);
  }
}

function pick(record, excluded = []) {
  const excludedSet = new Set(excluded);
  let ids = [...new Set(record.entrants || [])].filter(Boolean);
  const alternateIds = ids.filter(id => !excludedSet.has(id));
  if (alternateIds.length >= Math.min(record.winners, ids.length)) ids = alternateIds;
  const winners = [];
  while (ids.length && winners.length < record.winners) {
    const idx = Math.floor(Math.random() * ids.length);
    winners.push(ids.splice(idx, 1)[0]);
  }
  return winners;
}

async function finish(client, guildId, messageId, reroll = false) {
  const record = data(guildId)[messageId];
  if (!record) throw new Error('Giveaway not found.');
  // A failed announcement must be retryable. Older records without this flag
  // are already complete and should not be announced a second time.
  if (record.ended && !reroll && record.announcementSent !== false) return record;
  const flightKey = `${guildId}:${messageId}`;
  if (inFlight.has(flightKey)) return record;
  inFlight.add(flightKey);
  const timer = timers.get(flightKey);
  if (timer) {
    clearTimeout(timer);
    timers.delete(flightKey);
  }

  try {
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(record.channelId);
  if (!channel?.isTextBased()) throw new Error('Giveaway channel is unavailable.');
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) throw new Error('Giveaway message could not be found.');

  const wasEnded = Boolean(record.ended);
  const winners = reroll
    ? pick(record, record.lastWinners || [])
    : (wasEnded ? (record.lastWinners || []) : pick(record));
  if (!wasEnded || reroll) {
    record.ended = true;
    record.endedAt = Date.now();
    record.lastWinners = winners;
    record.announcementSent = false;
    store.save();
  }

  if (!wasEnded || reroll) await playReveal(message, record, reroll);
  await message.edit({ embeds: [embed(record, true, winners)], components: [row(messageId, true)] }).catch(() => {});
  const result = winners.length
    ? `${winners.map(id => `<@${id}>`).join(', ')} won **${record.prize}**!`
    : `No valid entries were received for **${record.prize}**.`;
  const announcement = winners.length
    ? `👑 **THE ROYAL GIVEAWAY HAS SPOKEN!**\n${result}\n\nCongratulations, your crown awaits!`
    : `👑 **The royal giveaway has ended.**\n${result}`;
  if (record.announcementSent !== true || reroll) {
    await channel.send({
      content: announcement,
      embeds: [ui.royalEmbed(
        reroll ? '🔁 Royal Giveaway Rerolled' : '👑 Royal Giveaway Winners',
        winners.length
          ? `The crown has chosen:\n\n${winners.map(id => `🏆 <@${id}>`).join('\n')}\n\n**Prize:** ${record.prize}`
          : `The draw ended without any valid entries.\n\n**Prize:** ${record.prize}`
      )],
      allowedMentions: { users: winners, repliedUser: false }
    });
    record.announcementSent = true;
    store.save();
  }
  return record;
  } finally {
    inFlight.delete(flightKey);
  }
}

function schedule(client, record, delayOverride) {
  if (!client || !record?.messageId || record.ended) return;
  const key = `${record.guildId}:${record.messageId}`;
  if (timers.has(key)) return;
  const remaining = Math.max(0, Number(record.endsAt || 0) - Date.now());
  const delay = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(0, Number.isFinite(Number(delayOverride)) ? Number(delayOverride) : remaining)
  );
  const timer = setTimeout(async () => {
    timers.delete(key);
    if (record.ended) return;
    if (record.endsAt > Date.now()) {
      schedule(client, record);
      return;
    }
    await finish(client, record.guildId, record.messageId).catch(error => {
      console.error('Giveaway scheduled finish:', error.message);
    });
  }, delay);
  timer.unref?.();
  timers.set(key, timer);
}

async function startInChannel(guild, channel, hostId, durationText, prize, winners = 1, client = guild?.client) {
  const duration = parseDuration(durationText);
  if (!channel?.isTextBased()) throw new Error('A text channel is required.');
  const now = Date.now();
  const record = { guildId: guild.id, channelId: channel.id, hostId, prize: String(prize).trim(), winners: Math.max(1, Math.min(10, Number(winners)||1)), createdAt: now, endsAt: now + duration, entrants: [], ended: false, announcementSent: false };
  const msg = await channel.send({ embeds: [embed(record)], components: [row('pending')] });
  record.messageId = msg.id;
  data(guild.id)[msg.id] = record;
  store.save();
  await msg.edit({ components: [row(msg.id)] });
  schedule(client, record);
  return record;
}

async function command(i, client) {
  const sub = i.options.getSubcommand();
  if (sub === 'start') {
    if (!canManage(i)) throw new Error('Manage Server or Manage Events permission is required to start giveaways.');
    const duration = parseDuration(i.options.getString('duration', true));
    const prize = i.options.getString('prize', true).trim();
    const winners = i.options.getInteger('winners') || 1;
    const channel = i.options.getChannel('channel') || i.channel;
    if (!channel?.isTextBased()) throw new Error('Choose a text channel for the giveaway.');
    await i.deferReply({ ephemeral: true });
    const record = await startInChannel(i.guild, channel, i.user.id, i.options.getString('duration', true), prize, winners, client);
    return i.editReply({ embeds: [ui.success('Giveaway Started', `Giveaway posted in ${channel}.\nMessage ID: \`${record.messageId}\``)] });
  }
  if (sub === 'end' || sub === 'reroll') {
    if (!canManage(i)) throw new Error('Manage Server or Manage Events permission is required.');
    await i.deferReply({ ephemeral: true });
    const id = i.options.getString('message_id', true);
    await finish(client, i.guildId, id, sub === 'reroll');
    return i.editReply({ embeds: [ui.success(sub === 'reroll' ? 'Giveaway Rerolled' : 'Giveaway Ended', `Processed giveaway \`${id}\`.`)] });
  }
  const rows = Object.values(data(i.guildId)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,20).map(g => `• \`${g.messageId}\` • **${g.prize}** • ${g.ended ? 'Ended' : `<t:${Math.floor(g.endsAt/1000)}:R>`}`);
  return i.reply({ embeds: [ui.embed('🎉 Giveaways', rows.join('\n') || 'No giveaways have been created yet.')], ephemeral: true });
}

async function button(i, client) {
  const [, action, messageId] = i.customId.split(':');
  if (action !== 'enter') return;
  const record = data(i.guildId)[messageId];
  if (!record || record.ended || record.endsAt <= Date.now()) return i.reply({ content: 'This giveaway has ended.', ephemeral: true });
  record.entrants ||= [];
  const idx = record.entrants.indexOf(i.user.id);
  if (idx >= 0) {
    record.entrants.splice(idx, 1);
    store.save();
    return i.reply({ content: 'You left the giveaway.', ephemeral: true });
  }
  record.entrants.push(i.user.id);
  store.save();
  await i.reply({ content: `🎉 You entered the giveaway for **${record.prize}**.`, ephemeral: true });
  const msg = await i.channel.messages.fetch(messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [embed(record)], components: [row(messageId)] }).catch(() => {});
}

async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const [id, record] of Object.entries(data(guild.id))) {
      if (record.ended) {
        if (record.announcementSent === false) {
          await finish(client, guild.id, id, false).catch(e => console.error('Giveaway announcement retry:', e.message));
        }
        continue;
      }
      if (record.endsAt <= Date.now()) {
        await finish(client, guild.id, id, false).catch(e => console.error('Giveaway finish:', e.message));
      } else {
        schedule(client, record);
      }
    }
  }
}

module.exports = { command, button, tick, parseDuration, finish, startInChannel, schedule };
