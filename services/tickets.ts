// @ts-nocheck
const {
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const store = require('./store.ts');
const ui = require('./ui.ts');

function root(guildId) {
  const guild = store.guild(guildId);
  guild.tickets ||= {
    config: {
      categoryId: null,
      supportRoleId: null,
      logChannelId: null,
      panelChannelId: null,
      panelMessageId: null,
      maxOpenPerUser: 1,
      counter: 0
    },
    byChannel: {}
  };
  guild.tickets.config ||= {};
  guild.tickets.byChannel ||= {};
  const cfg = guild.tickets.config;
  cfg.maxOpenPerUser = Math.min(5, Math.max(1, Number(cfg.maxOpenPerUser || 1)));
  cfg.counter = Math.max(0, Number(cfg.counter || 0));
  return guild.tickets;
}

function ownerIds() {
  return new Set(String(process.env.OWNER_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
}

function isStaff(interaction, cfg = root(interaction.guildId).config) {
  if (ownerIds().has(interaction.user.id)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  if (cfg.supportRoleId && interaction.member?.roles?.cache?.has(cfg.supportRoleId)) return true;
  return false;
}

function requireStaff(interaction) {
  if (!isStaff(interaction)) throw new Error('Ticket staff permission is required.');
}

function requireManage(interaction) {
  if (!ownerIds().has(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('Manage Server permission is required to configure tickets.');
  }
}

function ticketForChannel(interaction) {
  const data = root(interaction.guildId).byChannel[interaction.channelId];
  if (!data || data.status === 'deleted') throw new Error('This channel is not an active Astrix ticket.');
  data.priority ||= 'normal';
  data.locked = Boolean(data.locked);
  data.notes ||= [];
  data.addedUsers ||= [];
  return data;
}

function canUseTicket(interaction, data) {
  return data.ownerId === interaction.user.id || isStaff(interaction);
}

function slug(text) {
  return String(text || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 45) || 'ticket';
}

function panelEmbed(guild) {
  return ui.premiumEmbed(
    'Astrix Support Tickets',
    `Need help with **${guild.name}**? Create a private support ticket below.\n\n` +
    '• Private support channel\n' +
    '• Staff claim and priority controls\n' +
    '• Add/remove/transfer member tools\n' +
    '• Rename, move, lock, transcript and recovery controls\n\n' +
    '**Explain your issue clearly so staff can help faster.**'
  ).setThumbnail(guild.iconURL({ size: 256 }));
}

function createPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:create').setLabel('Create Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
  );
}

function openControls(data) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel(data.claimedBy ? 'Claimed' : 'Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(Boolean(data.claimedBy)),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket:add').setLabel('Add User').setEmoji('➕').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:remove').setLabel('Remove User').setEmoji('➖').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function closedControls() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:delete').setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    )
  ];
}

function priorityLabel(value) {
  const map = { low: '🟢 LOW', normal: '🔵 NORMAL', high: '🟠 HIGH', urgent: '🔴 URGENT' };
  return map[value] || map.normal;
}

function ticketEmbed(data) {
  const status = data.status === 'closed' ? '🔒 Closed' : '🟢 Open';
  const claimed = data.claimedBy ? `<@${data.claimedBy}>` : 'Unclaimed';
  return ui.premiumEmbed(
    `Ticket #${String(data.number).padStart(4, '0')} • ${data.subject}`,
    `**Owner:** <@${data.ownerId}>\n` +
    `**Status:** ${status}\n` +
    `**Priority:** ${priorityLabel(data.priority)}\n` +
    `**Chat:** ${data.locked ? '🔐 Locked' : '🔓 Unlocked'}\n` +
    `**Claimed by:** ${claimed}\n` +
    `**Created:** <t:${Math.floor(data.createdAt / 1000)}:R>\n\n` +
    `**Issue**\n${data.reason}`
  );
}

async function log(guild, title, description) {
  const cfg = root(guild.id).config;
  if (!cfg.logChannelId) return false;
  const channel = await guild.channels.fetch(cfg.logChannelId).catch(error => {
    console.error(`Ticket log channel fetch failed (${cfg.logChannelId}):`, error.message);
    return null;
  });
  if (!channel?.isTextBased?.()) {
    console.error(`Ticket log channel ${cfg.logChannelId} is missing or is not text-based.`);
    return false;
  }
  await channel.send({
    embeds: [ui.premiumEmbed(`🎫 ${title}`, description)]
  }).catch(error => console.error('Ticket log send failed:', error.message));
  return true;
}


async function ensureTicketCategory(interaction) {
  const cfg = root(interaction.guildId).config;
  let category = cfg.categoryId ? interaction.guild.channels.cache.get(cfg.categoryId) : null;
  if (category && category.type === ChannelType.GuildCategory) return category;

  const me = interaction.guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Astrix needs Manage Channels permission to create or repair the ticket category.');
  }

  category = await interaction.guild.channels.create({
    name: 'Astrix Tickets',
    type: ChannelType.GuildCategory,
    reason: 'Astrix ticket system automatic category setup'
  });
  cfg.categoryId = category.id;
  store.save();
  return category;
}

async function setup(interaction) {
  requireManage(interaction);
  const cfg = root(interaction.guildId).config;
  const category = interaction.options.getChannel('category');
  const supportRole = interaction.options.getRole('support_role');
  const logChannel = interaction.options.getChannel('log_channel');
  const panelChannel = interaction.options.getChannel('panel_channel');

  if (category) {
    if (category.type !== ChannelType.GuildCategory) throw new Error('The ticket category must be a category channel.');
    cfg.categoryId = category.id;
  }
  if (supportRole) cfg.supportRoleId = supportRole.id;
  if (logChannel) {
    if (!logChannel.isTextBased()) throw new Error('The ticket log channel must be text-based.');
    cfg.logChannelId = logChannel.id;
  }
  if (panelChannel) {
    if (!panelChannel.isTextBased()) throw new Error('The ticket panel channel must be text-based.');
    cfg.panelChannelId = panelChannel.id;
  }
  await ensureTicketCategory(interaction);
  store.save();
  return configView(interaction, true);
}

async function publishPanel(interaction) {
  requireManage(interaction);
  await ensureTicketCategory(interaction);
  const cfg = root(interaction.guildId).config;
  const requested = interaction.options.getChannel('channel');
  const channel = requested || (cfg.panelChannelId ? interaction.guild.channels.cache.get(cfg.panelChannelId) : interaction.channel);
  if (!channel?.isTextBased()) throw new Error('Choose a text-based channel for the ticket panel.');
  const sent = await channel.send({ embeds: [panelEmbed(interaction.guild)], components: [createPanelRow()] });
  cfg.panelChannelId = channel.id;
  cfg.panelMessageId = sent.id;
  store.save();
  return interaction.reply({ embeds: [ui.success('Ticket Panel Published', `Ticket panel published in ${channel}.`)], ephemeral: true });
}

function userOpenTickets(guildId, userId) {
  return Object.values(root(guildId).byChannel).filter(t => t.ownerId === userId && t.status === 'open');
}

async function status(interaction) {
  const tickets = root(interaction.guildId);
  const mine = Object.values(tickets.byChannel).filter(t => t.ownerId === interaction.user.id && t.status !== 'deleted');
  const open = mine.filter(t => t.status === 'open');
  const closed = mine.filter(t => t.status === 'closed');
  const rows = open.slice(0, 10).map(t => `• <#${t.channelId}> — **#${String(t.number).padStart(4, '0')} ${t.subject}**`).join('\n') || 'No open ticket.';
  const staff = isStaff(interaction)
    ? `\n\n**Staff overview**\nOpen: **${Object.values(tickets.byChannel).filter(t => t.status === 'open').length}** • Closed: **${Object.values(tickets.byChannel).filter(t => t.status === 'closed').length}**`
    : '';
  return interaction.reply({
    embeds: [ui.premiumEmbed('Ticket Status', `**Your open tickets**\n${rows}\n\nClosed history: **${closed.length}**${staff}`)],
    ephemeral: true
  });
}

async function listTickets(interaction) {
  requireStaff(interaction);
  const state = interaction.options.getString('state') || 'open';
  const all = Object.values(root(interaction.guildId).byChannel).filter(t => t.status !== 'deleted');
  const filtered = state === 'all' ? all : all.filter(t => t.status === state);
  filtered.sort((a, b) => b.createdAt - a.createdAt);
  const rows = filtered.slice(0, 20).map(t =>
    `• **#${String(t.number).padStart(4, '0')}** <#${t.channelId}> • <@${t.ownerId}> • ${priorityLabel(t.priority)} • ${t.claimedBy ? `<@${t.claimedBy}>` : 'Unclaimed'}`
  );
  return interaction.reply({
    embeds: [ui.premiumEmbed('Ticket List', `${rows.join('\n') || `No ${state} tickets found.`}\n\nShowing **${Math.min(filtered.length, 20)}/${filtered.length}** ticket(s).`)],
    ephemeral: true
  });
}

async function configView(interaction, fromSetup = false) {
  if (!fromSetup) requireManage(interaction);
  const cfg = root(interaction.guildId).config;
  const payload = {
    embeds: [ui.premiumEmbed(
      fromSetup ? 'Ticket System Configured' : 'Ticket Configuration',
      `Category: ${cfg.categoryId ? `<#${cfg.categoryId}>` : '**Auto-created when needed**'}\n` +
      `Support role: ${cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : '**Manage Channels staff**'}\n` +
      `Log channel: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : '**Not set**'}\n` +
      `Panel channel: ${cfg.panelChannelId ? `<#${cfg.panelChannelId}>` : '**Not set**'}\n` +
      `Max open tickets/user: **${cfg.maxOpenPerUser}**\n` +
      `Next ticket number: **${cfg.counter + 1}**\n\n` +
      'Use `/ticket panel` to publish the public ticket panel.'
    )],
    ephemeral: true
  };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function setMaxOpen(interaction) {
  requireManage(interaction);
  const amount = interaction.options.getInteger('amount', true);
  root(interaction.guildId).config.maxOpenPerUser = amount;
  store.save();
  return interaction.reply({ embeds: [ui.success('Ticket Limit Updated', `Members can now have up to **${amount}** open ticket(s).`)], ephemeral: true });
}

async function stats(interaction) {
  requireStaff(interaction);
  const all = Object.values(root(interaction.guildId).byChannel);
  const open = all.filter(t => t.status === 'open');
  const closed = all.filter(t => t.status === 'closed');
  const deleted = all.filter(t => t.status === 'deleted');
  const claimed = open.filter(t => t.claimedBy);
  const urgent = open.filter(t => t.priority === 'urgent');
  return interaction.reply({
    embeds: [ui.premiumEmbed('Ticket Statistics',
      `Open: **${open.length}**\nClosed: **${closed.length}**\nDeleted records: **${deleted.length}**\n` +
      `Claimed open: **${claimed.length}**\nUnclaimed open: **${open.length - claimed.length}**\nUrgent open: **${urgent.length}**\nTotal created: **${all.length}**`
    )],
    ephemeral: true
  });
}

async function command(interaction) {
  const action = interaction.options.getSubcommand(false) || 'home';
  if (action === 'home') {
    return interaction.reply({
      embeds: [ui.premiumEmbed(
        'Astrix Ticket Center',
        'Create and manage support tickets with the complete `/ticket` toolkit. Staff can claim, transfer, prioritize, move, lock, transcript, note and manage tickets without extra top-level commands.'
      )],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:create').setLabel('Create Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket:mystatus').setLabel('My Tickets').setEmoji('📋').setStyle(ButtonStyle.Secondary)
      )],
      ephemeral: true
    });
  }
  if (action === 'create') return showCreateModal(interaction);
  if (action === 'status') return status(interaction);
  if (action === 'list') return listTickets(interaction);
  if (action === 'setup') return setup(interaction);
  if (action === 'panel') return publishPanel(interaction);
  if (action === 'config') return configView(interaction);
  if (action === 'maxopen') return setMaxOpen(interaction);
  if (action === 'stats') return stats(interaction);

  const data = ticketForChannel(interaction);
  if (action === 'claim') return claim(interaction, data);
  if (action === 'unclaim') return unclaim(interaction, data);
  if (action === 'close') return close(interaction, data);
  if (action === 'reopen') return reopen(interaction, data);
  if (action === 'add') return addDirect(interaction, data);
  if (action === 'remove') return removeDirect(interaction, data);
  if (action === 'rename') return renameDirect(interaction, data);
  if (action === 'transfer') return transfer(interaction, data);
  if (action === 'priority') return setPriority(interaction, data);
  if (action === 'move') return moveTicket(interaction, data);
  if (action === 'lock') return setLocked(interaction, data, true);
  if (action === 'unlock') return setLocked(interaction, data, false);
  if (action === 'transcript') return transcript(interaction, data);
  if (action === 'delete') return deletePrompt(interaction);
  if (action === 'note') return addNote(interaction, data);
  if (action === 'pingstaff') return pingStaff(interaction, data);
  throw new Error('Unknown ticket action.');
}

async function showCreateModal(interaction) {
  const cfg = root(interaction.guildId).config;
  await ensureTicketCategory(interaction);
  if (userOpenTickets(interaction.guildId, interaction.user.id).length >= cfg.maxOpenPerUser) {
    throw new Error(`You already have the maximum of ${cfg.maxOpenPerUser} open ticket(s).`);
  }
  const modal = new ModalBuilder().setCustomId('ticketmodal:create').setTitle('Create Support Ticket');
  const subject = new TextInputBuilder()
    .setCustomId('subject').setLabel('Ticket subject').setStyle(TextInputStyle.Short)
    .setPlaceholder('Example: Bot command issue').setMinLength(3).setMaxLength(80).setRequired(true);
  const reason = new TextInputBuilder()
    .setCustomId('reason').setLabel('Describe the issue').setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Explain what happened and what you expected.').setMinLength(10).setMaxLength(1000).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(subject), new ActionRowBuilder().addComponents(reason));
  return interaction.showModal(modal);
}

async function createFromModal(interaction) {
  const tickets = root(interaction.guildId);
  const cfg = tickets.config;
  const category = await ensureTicketCategory(interaction);
  if (userOpenTickets(interaction.guildId, interaction.user.id).length >= cfg.maxOpenPerUser) {
    throw new Error(`You already have the maximum of ${cfg.maxOpenPerUser} open ticket(s).`);
  }
  const subject = interaction.fields.getTextInputValue('subject').trim();
  const reason = interaction.fields.getTextInputValue('reason').trim();
  const number = ++cfg.counter;
  const botId = interaction.guild.members.me?.id || interaction.client.user.id;
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    { id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }
  ];
  if (cfg.supportRoleId) {
    overwrites.push({ id: cfg.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${String(number).padStart(4, '0')}-${slug(interaction.user.username)}`.slice(0, 95),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Astrix ticket #${number} • Owner ${interaction.user.id} • ${subject}`.slice(0, 1024),
    permissionOverwrites: overwrites,
    reason: `Astrix support ticket created by ${interaction.user.tag}`
  });

  const data = {
    number,
    channelId: channel.id,
    ownerId: interaction.user.id,
    subject,
    reason,
    status: 'open',
    claimedBy: null,
    priority: 'normal',
    locked: false,
    notes: [],
    addedUsers: [],
    createdAt: Date.now(),
    closedAt: null,
    lastStaffPingAt: null
  };
  tickets.byChannel[channel.id] = data;
  store.save();

  const supportPing = cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : '';
  const welcome = await channel.send({
    content: `${interaction.user}${supportPing ? ` • ${supportPing}` : ''}`,
    allowedMentions: { users: [...new Set([interaction.user.id].filter(Boolean))], roles: cfg.supportRoleId ? [cfg.supportRoleId] : [] },
    embeds: [ticketEmbed(data)],
    components: openControls(data)
  });
  data.controlMessageId = welcome.id;
  store.save();
  await log(interaction.guild, 'Ticket Created', `Ticket **#${String(number).padStart(4, '0')}** created by ${interaction.user} in ${channel}.`);
  return interaction.reply({ embeds: [ui.success('Ticket Created', `Your private support ticket is ready: ${channel}`)], ephemeral: true });
}

async function updateControlMessage(channel, data) {
  if (!data.controlMessageId) return;
  const message = await channel.messages.fetch(data.controlMessageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [ticketEmbed(data)], components: data.status === 'closed' ? closedControls() : openControls(data) }).catch(() => {});
}

async function claim(interaction, data) {
  requireStaff(interaction);
  if (data.status !== 'open') throw new Error('This ticket is closed.');
  if (data.claimedBy && data.claimedBy !== interaction.user.id) throw new Error(`This ticket is already claimed by <@${data.claimedBy}>.`);
  data.claimedBy = interaction.user.id;
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Claimed', `${interaction.user} claimed <#${interaction.channelId}>.`);
  return interaction.reply({ embeds: [ui.success('Ticket Claimed', `${interaction.user} is now handling this ticket.`)] });
}

async function unclaim(interaction, data) {
  requireStaff(interaction);
  if (data.status !== 'open') throw new Error('This ticket is closed.');
  if (!data.claimedBy) throw new Error('This ticket is not currently claimed.');
  if (data.claimedBy !== interaction.user.id && !ownerIds().has(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error(`Only <@${data.claimedBy}> or a server manager can release this claim.`);
  }
  const previous = data.claimedBy;
  data.claimedBy = null;
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Unclaimed', `${interaction.user} released the claim on <#${interaction.channelId}> from <@${previous}>.`);
  return interaction.reply({ embeds: [ui.success('Ticket Unclaimed', 'This ticket is available for another staff member.')] });
}

async function close(interaction, data) {
  if (!canUseTicket(interaction, data)) throw new Error('Only the ticket owner or ticket staff can close this ticket.');
  if (data.status === 'closed') throw new Error('This ticket is already closed.');
  data.status = 'closed';
  data.closedAt = Date.now();
  data.closedBy = interaction.user.id;
  const userIds = [data.ownerId, ...data.addedUsers];
  for (const id of userIds) {
    await interaction.channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: false }).catch(() => {});
  }
  if (!interaction.channel.name.startsWith('closed-')) await interaction.channel.setName(`closed-${interaction.channel.name}`.slice(0, 100)).catch(() => {});
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Closed', `${interaction.user} closed <#${interaction.channelId}>.`);
  return interaction.reply({ embeds: [ui.embed('🔒 Ticket Closed', `Closed by ${interaction.user}. Staff can reopen, transcript or delete it.`)] });
}

async function reopen(interaction, data) {
  requireStaff(interaction);
  if (data.status !== 'closed') throw new Error('This ticket is already open.');
  data.status = 'open';
  data.locked = false;
  data.closedAt = null;
  data.closedBy = null;
  const userIds = [data.ownerId, ...data.addedUsers];
  for (const id of userIds) {
    await interaction.channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true }).catch(() => {});
  }
  await interaction.channel.setName(interaction.channel.name.replace(/^closed-/, '')).catch(() => {});
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Reopened', `${interaction.user} reopened <#${interaction.channelId}>.`);
  return interaction.reply({ embeds: [ui.success('Ticket Reopened', 'The ticket is open again.')] });
}

async function addDirect(interaction, data) {
  requireStaff(interaction);
  if (data.status !== 'open') throw new Error('Reopen the ticket before adding users.');
  const member = interaction.options.getMember('user') || await interaction.guild.members.fetch(interaction.options.getUser('user', true).id).catch(() => null);
  if (!member) throw new Error('That member could not be found.');
  if (member.id === data.ownerId) throw new Error('That member already owns this ticket.');
  await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: !data.locked, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
  if (!data.addedUsers.includes(member.id)) data.addedUsers.push(member.id);
  store.save();
  await log(interaction.guild, 'Ticket User Added', `${interaction.user} added ${member} to <#${interaction.channelId}>.`);
  return interaction.reply({ embeds: [ui.success('User Added', `${member} can now access this ticket.`)] });
}

async function removeDirect(interaction, data) {
  requireStaff(interaction);
  const user = interaction.options.getUser('user', true);
  if (user.id === data.ownerId) throw new Error('The owner cannot be removed. Use `/ticket transfer`.');
  await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
  data.addedUsers = data.addedUsers.filter(id => id !== user.id);
  store.save();
  await log(interaction.guild, 'Ticket User Removed', `${interaction.user} removed ${user} from <#${interaction.channelId}>.`);
  return interaction.reply({ embeds: [ui.success('User Removed', `${user} no longer has ticket access.`)] });
}

async function renameDirect(interaction, data) {
  if (!canUseTicket(interaction, data)) throw new Error('Only the ticket owner or staff can rename this ticket.');
  const value = interaction.options.getString('name', true).trim();
  const prefix = data.status === 'closed' ? 'closed-ticket' : 'ticket';
  await interaction.channel.setName(`${prefix}-${String(data.number).padStart(4, '0')}-${slug(value)}`.slice(0, 100));
  data.subject = value.slice(0, 80);
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Renamed', `${interaction.user} renamed <#${interaction.channelId}> to **${interaction.channel.name}**.`);
  return interaction.reply({ embeds: [ui.success('Ticket Renamed', `Ticket renamed to **${interaction.channel.name}**.`)] });
}

async function transfer(interaction, data) {
  requireStaff(interaction);
  const member = interaction.options.getMember('user') || await interaction.guild.members.fetch(interaction.options.getUser('user', true).id).catch(() => null);
  if (!member) throw new Error('That member could not be found.');
  if (member.user.bot) throw new Error('A ticket cannot be transferred to a bot.');
  if (member.id === data.ownerId) throw new Error('That member already owns this ticket.');
  const oldOwner = data.ownerId;
  await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: data.status === 'open' && !data.locked, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
  await interaction.channel.permissionOverwrites.delete(oldOwner).catch(() => {});
  data.ownerId = member.id;
  data.addedUsers = data.addedUsers.filter(id => id !== member.id && id !== oldOwner);
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Transferred', `${interaction.user} transferred <#${interaction.channelId}> from <@${oldOwner}> to ${member}.`);
  return interaction.reply({ embeds: [ui.success('Ticket Transferred', `${member} is now the ticket owner.`)] });
}

async function setPriority(interaction, data) {
  requireStaff(interaction);
  data.priority = interaction.options.getString('level', true);
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, 'Ticket Priority Changed', `${interaction.user} set <#${interaction.channelId}> priority to **${data.priority.toUpperCase()}**.`);
  return interaction.reply({ embeds: [ui.success('Priority Updated', `Ticket priority is now ${priorityLabel(data.priority)}.`)] });
}

async function moveTicket(interaction, data) {
  requireStaff(interaction);
  const category = interaction.options.getChannel('category', true);
  if (category.type !== ChannelType.GuildCategory) throw new Error('Choose a category channel.');
  await interaction.channel.setParent(category.id, { lockPermissions: false, reason: `Astrix ticket moved by ${interaction.user.tag}` });
  await log(interaction.guild, 'Ticket Moved', `${interaction.user} moved <#${interaction.channelId}> to **${category.name}**.`);
  return interaction.reply({ embeds: [ui.success('Ticket Moved', `Moved to **${category.name}**.`)] });
}

async function setLocked(interaction, data, locked) {
  requireStaff(interaction);
  if (!locked && data.status !== 'open') throw new Error('Reopen the ticket before unlocking it.');
  data.locked = locked;
  const userIds = [data.ownerId, ...data.addedUsers];
  for (const id of userIds) {
    await interaction.channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: locked ? false : true }).catch(() => {});
  }
  store.save();
  await updateControlMessage(interaction.channel, data);
  await log(interaction.guild, locked ? 'Ticket Locked' : 'Ticket Unlocked', `${interaction.user} ${locked ? 'locked' : 'unlocked'} <#${interaction.channelId}>.`);
  return interaction.reply({ embeds: [ui.success(locked ? 'Ticket Locked' : 'Ticket Unlocked', locked ? 'Ticket users can read but cannot send messages.' : 'Ticket users can send messages again.')] });
}

function userModal(action, title, label, placeholder) {
  const modal = new ModalBuilder().setCustomId(`ticketmodal:${action}`).setTitle(title);
  const input = new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(TextInputStyle.Short).setPlaceholder(placeholder).setRequired(true).setMaxLength(100);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function modalValue(interaction, action) {
  const data = ticketForChannel(interaction);
  const value = interaction.fields.getTextInputValue('value').trim();
  if (action === 'add') {
    requireStaff(interaction);
    const member = await interaction.guild.members.fetch(value).catch(() => null);
    if (!member) throw new Error('No server member was found with that user ID.');
    if (member.id === data.ownerId) throw new Error('That user already owns this ticket.');
    await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: !data.locked, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
    if (!data.addedUsers.includes(member.id)) data.addedUsers.push(member.id);
    store.save();
    return interaction.reply({ embeds: [ui.success('User Added', `${member} can now access this ticket.`)] });
  }
  if (action === 'remove') {
    requireStaff(interaction);
    if (value === data.ownerId) throw new Error('The ticket owner cannot be removed.');
    await interaction.channel.permissionOverwrites.delete(value).catch(() => {});
    data.addedUsers = data.addedUsers.filter(id => id !== value);
    store.save();
    return interaction.reply({ embeds: [ui.success('User Removed', `<@${value}> no longer has ticket access.`)] });
  }
  if (action === 'rename') {
    if (!canUseTicket(interaction, data)) throw new Error('Only the ticket owner or staff can rename this ticket.');
    const prefix = data.status === 'closed' ? 'closed-ticket' : 'ticket';
    await interaction.channel.setName(`${prefix}-${String(data.number).padStart(4, '0')}-${slug(value)}`.slice(0, 100));
    data.subject = value.slice(0, 80);
    store.save();
    await updateControlMessage(interaction.channel, data);
    return interaction.reply({ embeds: [ui.success('Ticket Renamed', `Ticket renamed to **${interaction.channel.name}**.`)] });
  }
}

async function fetchTranscript(channel) {
  const all = [];
  let before;
  for (let page = 0; page < 5; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = all.map(message => {
    const time = new Date(message.createdTimestamp).toISOString();
    const attachments = [...message.attachments.values()].map(a => a.url).join(' ');
    const content = String(message.cleanContent || message.content || '').replace(/\r?\n/g, ' ↩ ');
    return `[${time}] ${message.author?.tag || message.author?.username || 'Unknown'} (${message.author?.id || 'unknown'}): ${content}${attachments ? ` | Attachments: ${attachments}` : ''}`;
  });
  return Buffer.from(lines.join('\n') || 'No messages were available for this transcript.', 'utf8');
}

async function transcript(interaction, data) {
  if (!canUseTicket(interaction, data)) throw new Error('Only the ticket owner or staff can export this transcript.');
  await interaction.deferReply({ ephemeral: true });
  const buffer = await fetchTranscript(interaction.channel);
  const file = new AttachmentBuilder(buffer, { name: `ticket-${String(data.number).padStart(4, '0')}-transcript.txt` });
  return interaction.editReply({ embeds: [ui.embed('📄 Ticket Transcript', `Transcript generated for ticket **#${String(data.number).padStart(4, '0')}**.`)], files: [file] });
}

async function addNote(interaction, data) {
  requireStaff(interaction);
  const text = interaction.options.getString('text', true).slice(0, 1000);
  data.notes.push({ by: interaction.user.id, text, at: Date.now() });
  if (data.notes.length > 50) data.notes.shift();
  store.save();
  await log(interaction.guild, 'Private Ticket Note', `Ticket **#${String(data.number).padStart(4, '0')}** • ${interaction.user}\n${text}`);
  return interaction.reply({ embeds: [ui.success('Private Note Saved', 'The note was saved to the ticket record and ticket log.')], ephemeral: true });
}

async function pingStaff(interaction, data) {
  if (!canUseTicket(interaction, data)) throw new Error('Only the ticket owner or staff can ping support staff.');
  const cfg = root(interaction.guildId).config;
  if (!cfg.supportRoleId) throw new Error('No support role is configured.');
  const now = Date.now();
  if (!isStaff(interaction) && data.lastStaffPingAt && now - data.lastStaffPingAt < 10 * 60 * 1000) {
    const left = Math.ceil((10 * 60 * 1000 - (now - data.lastStaffPingAt)) / 60000);
    throw new Error(`Please wait about ${left} minute(s) before pinging support staff again.`);
  }
  data.lastStaffPingAt = now;
  store.save();
  return interaction.reply({
    content: `<@&${cfg.supportRoleId}> support is requested for ticket **#${String(data.number).padStart(4, '0')}**.`,
    allowedMentions: { roles: [...new Set([cfg.supportRoleId].filter(Boolean))] }
  });
}

async function deletePrompt(interaction) {
  requireStaff(interaction);
  return interaction.reply({
    embeds: [ui.error('Delete Ticket?', 'This permanently deletes the Discord ticket channel. The saved record will be marked deleted.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:deleteconfirm').setLabel('Delete Permanently').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket:deletecancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    )],
    ephemeral: true
  });
}

async function deleteConfirm(interaction, data) {
  requireStaff(interaction);
  data.status = 'deleted';
  data.deletedAt = Date.now();
  data.deletedBy = interaction.user.id;
  store.save();
  await log(interaction.guild, 'Ticket Deleted', `${interaction.user} deleted ticket **#${String(data.number).padStart(4, '0')}**.`);
  await interaction.reply({ content: 'Deleting ticket channel…', ephemeral: true }).catch(() => {});
  setTimeout(() => interaction.channel.delete(`Astrix ticket deleted by ${interaction.user.tag}`).catch(() => {}), 1200);
}

async function button(interaction) {
  const id = interaction.customId;
  if (id === 'ticket:create') return showCreateModal(interaction);
  if (id === 'ticket:mystatus') return status(interaction);
  if (!id.startsWith('ticket:')) return;
  const data = ticketForChannel(interaction);
  if (id === 'ticket:claim') return claim(interaction, data);
  if (id === 'ticket:close') return close(interaction, data);
  if (id === 'ticket:reopen') return reopen(interaction, data);
  if (id === 'ticket:add') return interaction.showModal(userModal('add', 'Add User to Ticket', 'Discord user ID', '123456789012345678'));
  if (id === 'ticket:remove') return interaction.showModal(userModal('remove', 'Remove User from Ticket', 'Discord user ID', '123456789012345678'));
  if (id === 'ticket:rename') return interaction.showModal(userModal('rename', 'Rename Ticket', 'New ticket name', 'payment-help'));
  if (id === 'ticket:transcript') return transcript(interaction, data);
  if (id === 'ticket:delete') return deletePrompt(interaction);
  if (id === 'ticket:deleteconfirm') return deleteConfirm(interaction, data);
  if (id === 'ticket:deletecancel') return interaction.update({ content: 'Ticket deletion cancelled.', embeds: [], components: [] });
}

async function modal(interaction) {
  if (interaction.customId === 'ticketmodal:create') return createFromModal(interaction);
  if (!interaction.customId.startsWith('ticketmodal:')) return;
  return modalValue(interaction, interaction.customId.split(':')[1]);
}

module.exports = { command, button, modal, root, isStaff, panelEmbed, createPanelRow };
