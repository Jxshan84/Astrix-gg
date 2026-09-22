const { SlashCommandBuilder } = require('discord.js');

const DIRECT_ACTIONS = [
  ['hug', 'Hug another user with a random SFW GIF.'],
  ['kiss', 'Send another user a lighthearted SFW kiss reaction GIF.'],
  ['slap', 'Slap another user with a random SFW GIF.'],
  ['punch', 'Punch another user with a random SFW GIF.'],
  ['fuck', 'Use a cheeky adult-language reaction GIF on another user.']
];

function directActionCommands() {
  return DIRECT_ACTIONS.map(([name, description]) =>
    new SlashCommandBuilder().setName(name).setDescription(description)
      .addUserOption(o => o.setName('user').setDescription('User to react to').setRequired(true))
  );
}

function additionalModerationCommands() {
  const reason = o => o.setName('reason').setDescription('Reason for this action').setMaxLength(500);
  const user = o => o.setName('user').setDescription('Target server member').setRequired(true);
  const channel = o => o.setName('channel').setDescription('Target channel');
  return [
    new SlashCommandBuilder().setName('warnconfig').setDescription('Configure automatic warning escalation.')
      .addSubcommand(s => s.setName('status').setDescription('View warning escalation settings.'))
      .addSubcommand(s => s.setName('threshold').setDescription('Set the action at a warning threshold.')
        .addIntegerOption(o => o.setName('threshold').setDescription('Supported threshold: 3 or 5').setRequired(true).addChoices({ name: '3 warnings', value: 3 }, { name: '5 warnings', value: 5 }))
        .addStringOption(o => o.setName('action').setDescription('Action to take').setRequired(true).addChoices({ name: 'None', value: 'none' }, { name: 'Timeout', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }))
        .addStringOption(o => o.setName('duration').setDescription('Timeout duration when applicable, e.g. 10m'))),
    new SlashCommandBuilder().setName('automod').setDescription('Configure Astrix AutoMod modules.')
      .addStringOption(o => o.setName('module').setDescription('AutoMod module').setRequired(true).addChoices(
        { name: 'Anti-spam', value: 'spam' }, { name: 'Anti-link', value: 'link' }, { name: 'Anti-invite', value: 'invite' },
        { name: 'Anti-mention', value: 'mention' }, { name: 'Anti-caps', value: 'caps' }, { name: 'Anti-flood', value: 'flood' },
        { name: 'Anti-duplicate', value: 'duplicate' }, { name: 'Anti-raid', value: 'raid' }, { name: 'Anti-webhook', value: 'webhook' },
        { name: 'Mass mention', value: 'mass-mention' }, { name: 'Anti-NSFW', value: 'nsfw' }))
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable this module').setRequired(true))
      .addIntegerOption(o => o.setName('threshold').setDescription('Trigger threshold').setMinValue(1).setMaxValue(100))
      .addStringOption(o => o.setName('action').setDescription('Punishment').addChoices(
        { name: 'Delete', value: 'delete' }, { name: 'Warn', value: 'warn' }, { name: 'Timeout', value: 'timeout' },
        { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })),
    new SlashCommandBuilder().setName('nick').setDescription('Set or reset a member nickname.')
      .addUserOption(user).addStringOption(o => o.setName('nickname').setDescription('New nickname; omit to reset').setMaxLength(32)).addStringOption(reason),
    new SlashCommandBuilder().setName('hide').setDescription('Hide a channel from @everyone.')
      .addChannelOption(channel).addStringOption(reason),
    new SlashCommandBuilder().setName('unhide').setDescription('Make a channel visible to @everyone.')
      .addChannelOption(channel).addStringOption(reason),
    new SlashCommandBuilder().setName('clonechannel').setDescription('Clone a guild channel.')
      .addChannelOption(channel).addStringOption(reason),
    new SlashCommandBuilder().setName('deletechannel').setDescription('Permanently delete a guild channel.')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to delete').setRequired(true))
      .addBooleanOption(o => o.setName('confirm').setDescription('Confirm permanent deletion').setRequired(true))
      .addStringOption(reason),
    new SlashCommandBuilder().setName('voiceban').setDescription('Block a member from joining and speaking in a voice channel.')
      .addUserOption(user).addChannelOption(channel).addStringOption(reason),
    new SlashCommandBuilder().setName('voiceunban').setDescription('Restore a member voice channel access.')
      .addUserOption(user).addChannelOption(channel).addStringOption(reason),
    new SlashCommandBuilder().setName('massban').setDescription('Ban up to 100 current members by ID or mention.')
      .addStringOption(o => o.setName('user_ids').setDescription('Member IDs or mentions separated by spaces').setRequired(true).setMaxLength(2000))
      .addBooleanOption(o => o.setName('confirm').setDescription('Confirm the mass ban').setRequired(true))
      .addStringOption(reason),
    new SlashCommandBuilder().setName('masskick').setDescription('Kick up to 100 current members by ID or mention.')
      .addStringOption(o => o.setName('user_ids').setDescription('Member IDs or mentions separated by spaces').setRequired(true).setMaxLength(2000))
      .addBooleanOption(o => o.setName('confirm').setDescription('Confirm the mass kick').setRequired(true))
      .addStringOption(reason)
  ];
}


function advancedModerationCommand() {
  const cmd = new SlashCommandBuilder().setName('mod').setDescription('Astrix advanced moderation center with 50+ actions.');
  const reason = o => o.setName('reason').setDescription('Reason for this action').setMaxLength(500);
  const user = o => o.setName('user').setDescription('Target user').setRequired(true);
  const role = o => o.setName('role').setDescription('Target role').setRequired(true);
  const channel = o => o.setName('channel').setDescription('Target channel').setRequired(true);
  cmd.addSubcommandGroup(g => g.setName('member').setDescription('Member punishments, notes and reports.')
    .addSubcommand(s=>s.setName('ban').setDescription('Ban a member.').addUserOption(user).addStringOption(reason))
    .addSubcommand(s=>s.setName('tempban').setDescription('Temporarily ban a member.').addUserOption(user).addStringOption(o=>o.setName('duration').setDescription('Duration: 30m, 2h, 3d, or 1w').setRequired(true)).addStringOption(reason))
    .addSubcommand(s=>s.setName('softban').setDescription('Ban and immediately unban a member to clean recent messages.').addUserOption(user).addStringOption(reason))
    .addSubcommand(s=>s.setName('unban').setDescription('Unban a user ID.').addStringOption(o=>o.setName('user_id').setDescription('Discord user ID').setRequired(true)).addStringOption(reason))
    .addSubcommand(s=>s.setName('kick').setDescription('Kick a member.').addUserOption(user).addStringOption(reason))
    .addSubcommand(s=>s.setName('timeout').setDescription('Timeout a member.').addUserOption(user).addStringOption(o=>o.setName('duration').setDescription('Duration: 30m, 2h, 3d, or 1w').setRequired(true)).addStringOption(reason))
    .addSubcommand(s=>s.setName('untimeout').setDescription('Remove a timeout.').addUserOption(user).addStringOption(reason))
    .addSubcommand(s=>s.setName('warn').setDescription('Warn a member.').addUserOption(user).addStringOption(reason))
    .addSubcommand(s=>s.setName('warnings').setDescription('View warnings.').addUserOption(user))
    .addSubcommand(s=>s.setName('clearwarnings').setDescription('Clear all warnings.').addUserOption(user).addStringOption(reason))
    .addSubcommand(s=>s.setName('removewarn').setDescription('Remove one warning by number.').addUserOption(user).addIntegerOption(o=>o.setName('number').setDescription('Warning number').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('nickname').setDescription('Set a member nickname.').addUserOption(user).addStringOption(o=>o.setName('nickname').setDescription('New nickname').setRequired(true).setMaxLength(32)))
    .addSubcommand(s=>s.setName('resetnick').setDescription('Reset a member nickname.').addUserOption(user))
    .addSubcommand(s=>s.setName('roleadd').setDescription('Add a role to a member.').addUserOption(user).addRoleOption(role))
    .addSubcommand(s=>s.setName('roleremove').setDescription('Remove a role from a member.').addUserOption(user).addRoleOption(role))
    .addSubcommand(s=>s.setName('note').setDescription('Add a private staff note.').addUserOption(user).addStringOption(o=>o.setName('note').setDescription('Staff note').setRequired(true).setMaxLength(800)))
    .addSubcommand(s=>s.setName('notes').setDescription('View staff notes.').addUserOption(user))
    .addSubcommand(s=>s.setName('removenote').setDescription('Remove a staff note by number.').addUserOption(user).addIntegerOption(o=>o.setName('number').setDescription('Note number').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('report').setDescription('Create a moderation report.').addUserOption(user).addStringOption(o=>o.setName('reason').setDescription('Report reason').setRequired(true).setMaxLength(800)))
    .addSubcommand(s=>s.setName('reports').setDescription('View reports for a user.').addUserOption(user))
  );
  cmd.addSubcommandGroup(g => g.setName('message').setDescription('Message and channel moderation.')
    .addSubcommand(s=>s.setName('purge').setDescription('Delete recent messages.').addIntegerOption(o=>o.setName('amount').setDescription('Messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('purgeuser').setDescription('Delete recent messages from one user.').addUserOption(user).addIntegerOption(o=>o.setName('amount').setDescription('Maximum messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('purgebots').setDescription('Delete recent bot messages.').addIntegerOption(o=>o.setName('amount').setDescription('Maximum messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('purgelinks').setDescription('Delete recent messages containing links.').addIntegerOption(o=>o.setName('amount').setDescription('Maximum messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('purgeimages').setDescription('Delete recent messages containing attachments.').addIntegerOption(o=>o.setName('amount').setDescription('Maximum messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('purgeembeds').setDescription('Delete recent messages containing embeds.').addIntegerOption(o=>o.setName('amount').setDescription('Maximum messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('purgeinvites').setDescription('Delete recent Discord invite links.').addIntegerOption(o=>o.setName('amount').setDescription('Maximum messages').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s=>s.setName('slowmode').setDescription('Set channel slowmode.').addIntegerOption(o=>o.setName('seconds').setDescription('Seconds').setRequired(true).setMinValue(0).setMaxValue(21600)))
    .addSubcommand(s=>s.setName('lock').setDescription('Lock the current channel.'))
    .addSubcommand(s=>s.setName('unlock').setDescription('Unlock the current channel.'))
    .addSubcommand(s=>s.setName('channelban').setDescription('Block a user from sending messages in this channel.').addUserOption(user))
    .addSubcommand(s=>s.setName('channelunban').setDescription('Remove a channel-specific user block.').addUserOption(user))
  );
  cmd.addSubcommandGroup(g => g.setName('voice').setDescription('Voice moderation actions.')
    .addSubcommand(s=>s.setName('voicekick').setDescription('Disconnect a member from voice.').addUserOption(user))
    .addSubcommand(s=>s.setName('voicemute').setDescription('Server mute a voice member.').addUserOption(user))
    .addSubcommand(s=>s.setName('voiceunmute').setDescription('Remove server mute.').addUserOption(user))
    .addSubcommand(s=>s.setName('voicedeafen').setDescription('Server deafen a voice member.').addUserOption(user))
    .addSubcommand(s=>s.setName('voiceundeafen').setDescription('Remove server deafen.').addUserOption(user))
    .addSubcommand(s=>s.setName('move').setDescription('Move a voice member.').addUserOption(user).addChannelOption(channel))
    .addSubcommand(s=>s.setName('moveall').setDescription('Move everyone from your voice channel.').addChannelOption(channel))
  );
  cmd.addSubcommandGroup(g => g.setName('cases').setDescription('Moderation cases, history and statistics.')
    .addSubcommand(s=>s.setName('case').setDescription('View a moderation case.').addIntegerOption(o=>o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('cases').setDescription('View recent moderation cases.').addIntegerOption(o=>o.setName('page').setDescription('Page').setMinValue(1)))
    .addSubcommand(s=>s.setName('caseedit').setDescription('Edit a case reason.').addIntegerOption(o=>o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('New reason').setRequired(true).setMaxLength(800)))
    .addSubcommand(s=>s.setName('casereason').setDescription('Set a case reason.').addIntegerOption(o=>o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(800)))
    .addSubcommand(s=>s.setName('caseclose').setDescription('Close a case.').addIntegerOption(o=>o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)))
    .addSubcommand(s=>s.setName('history').setDescription('View moderation history for a user.').addUserOption(user))
    .addSubcommand(s=>s.setName('modlogs').setDescription('View recent moderation logs.').addIntegerOption(o=>o.setName('page').setDescription('Page').setMinValue(1)))
    .addSubcommand(s=>s.setName('staffstats').setDescription('View server-wide staff moderation stats.'))
    .addSubcommand(s=>s.setName('modstats').setDescription('View moderation stats for a moderator.').addUserOption(o=>o.setName('user').setDescription('Moderator')))
    .addSubcommand(s=>s.setName('evidence').setDescription('Attach an evidence reference to a case.').addIntegerOption(o=>o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1)).addStringOption(o=>o.setName('reference').setDescription('Message link or evidence reference').setRequired(true).setMaxLength(1000)))
  );
  cmd.addSubcommandGroup(g => g.setName('bulk').setDescription('Premium high-volume moderation with safety checks.')
    .addSubcommand(s=>s.setName('massban').setDescription('Safely ban eligible members in batches.')
      .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm this bulk ban').setRequired(true))
      .addStringOption(o=>o.setName('filter').setDescription('Target filter').addChoices({name:'Everyone eligible',value:'all'},{name:'Bots',value:'bots'},{name:'Humans',value:'humans'},{name:'Role members',value:'role'}))
      .addIntegerOption(o=>o.setName('limit').setDescription('Maximum members').setMinValue(1).setMaxValue(200))
      .addStringOption(reason))
    .addSubcommand(s=>s.setName('masskick').setDescription('Safely kick eligible members in batches.')
      .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm this bulk kick').setRequired(true))
      .addStringOption(o=>o.setName('filter').setDescription('Target filter').addChoices({name:'Everyone eligible',value:'all'},{name:'Bots',value:'bots'},{name:'Humans',value:'humans'},{name:'Role members',value:'role'}))
      .addIntegerOption(o=>o.setName('limit').setDescription('Maximum members').setMinValue(1).setMaxValue(200))
      .addStringOption(reason))
    .addSubcommand(s=>s.setName('massmute').setDescription('Safely timeout eligible members in batches.')
      .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm this bulk timeout').setRequired(true))
      .addStringOption(o=>o.setName('duration').setDescription('Duration, e.g. 10m').setRequired(true))
      .addStringOption(o=>o.setName('filter').setDescription('Target filter').addChoices({name:'Everyone eligible',value:'all'},{name:'Bots',value:'bots'},{name:'Humans',value:'humans'},{name:'Role members',value:'role'}))
      .addIntegerOption(o=>o.setName('limit').setDescription('Maximum members').setMinValue(1).setMaxValue(200))
      .addStringOption(reason))
    .addSubcommand(s=>s.setName('masswarn').setDescription('Safely warn eligible members in batches.')
      .addBooleanOption(o=>o.setName('confirm').setDescription('Confirm this bulk warning').setRequired(true))
      .addStringOption(o=>o.setName('filter').setDescription('Target filter').addChoices({name:'Everyone eligible',value:'all'},{name:'Bots',value:'bots'},{name:'Humans',value:'humans'},{name:'Role members',value:'role'}))
      .addIntegerOption(o=>o.setName('limit').setDescription('Maximum members').setMinValue(1).setMaxValue(200))
      .addStringOption(reason)));
  cmd.addSubcommandGroup(g => g.setName('server').setDescription('Server-wide moderation tools.')
    .addSubcommand(s=>s.setName('lockdown').setDescription('Lock text channels server-wide.').addBooleanOption(o=>o.setName('confirm').setDescription('Confirm server lockdown').setRequired(true)))
    .addSubcommand(s=>s.setName('unlockdown').setDescription('Unlock text channels server-wide.').addBooleanOption(o=>o.setName('confirm').setDescription('Confirm server unlock').setRequired(true)))
    .addSubcommand(s=>s.setName('massrole').setDescription('Add or remove a role for up to 100 members.').addRoleOption(role).addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices({name:'Add',value:'add'},{name:'Remove',value:'remove'})))
    .addSubcommand(s=>s.setName('massnick').setDescription('Prefix nicknames for up to 50 members.').addStringOption(o=>o.setName('prefix').setDescription('Nickname prefix').setRequired(true).setMaxLength(12)))
    .addSubcommand(s=>s.setName('freeze').setDescription('Prevent a user from sending messages in the current channel.').addUserOption(user))
    .addSubcommand(s=>s.setName('unfreeze').setDescription('Remove a current-channel message freeze.').addUserOption(user))
  );
  return cmd;
}

function buildExtendedCommands() {
  return [
    ...additionalModerationCommands(),
    advancedModerationCommand(),
    new SlashCommandBuilder()
      .setName('muterole')
      .setDescription('Create and use a server-wide muted role.')
      .addSubcommand(s => s.setName('create').setDescription('Create or repair the Muted role and channel permissions.')
        .addStringOption(o => o.setName('color').setDescription('Role color name or hex, for example red or #ff0000').setRequired(false).setMaxLength(20)))
      .addSubcommand(s => s.setName('mute').setDescription('Give the configured Muted role to a member.')
        .addUserOption(o => o.setName('user').setDescription('Member to mute').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Optional duration: 30m, 2h, 3d, or 1w').setMaxLength(10))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(500)))
      .addSubcommand(s => s.setName('unmute').setDescription('Remove the configured Muted role from a member.')
        .addUserOption(o => o.setName('user').setDescription('Member to unmute').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(500))),
    ...directActionCommands(),
    new SlashCommandBuilder()
      .setName('lootbox')
      .setDescription('Open and inspect Astrix Lootboxes.')
      .addSubcommand(s => s.setName('open').setDescription('Open one or more Lootboxes.')
        .addIntegerOption(o => o.setName('amount').setDescription('Number to open').setMinValue(1).setMaxValue(25)))
      .addSubcommand(s => s.setName('view').setDescription('View your Lootbox balance and rewards.'))
      .addSubcommand(s => s.setName('catalog').setDescription('View possible Lootbox rewards.')),
    new SlashCommandBuilder()
      .setName('weaponcrate')
      .setDescription('Open hunting Weapon Crates and manage weapon rewards.')
      .addSubcommand(s => s.setName('open').setDescription('Open one or more Weapon Crates.')
        .addIntegerOption(o => o.setName('amount').setDescription('Number to open').setMinValue(1).setMaxValue(25)))
      .addSubcommand(s => s.setName('view').setDescription('View your Weapon Crates and hunt weapons.'))
      .addSubcommand(s => s.setName('catalog').setDescription('View possible Weapon Crate rewards.'))
      .addSubcommand(s => s.setName('grant').setDescription('Admin: grant Weapon Crates to a member.')
        .addUserOption(o => o.setName('user').setDescription('Member to receive crates').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Number of crates, or all for 100').setRequired(true).setMaxLength(10))),
    new SlashCommandBuilder()
      .setName('owner')
      .setDescription('Astrix owner-only global control center.')
      .addSubcommandGroup(g => g.setName('premium').setDescription('Manage user and server Premium.')
        .addSubcommand(s => s.setName('usergrant').setDescription('Grant Premium to a user.')
          .addUserOption(o=>o.setName('user').setDescription('User').setRequired(true))
          .addStringOption(o=>o.setName('tier').setDescription('Tier').addChoices({name:'Premium',value:'premium'},{name:'Premium+',value:'plus'},{name:'Elite',value:'elite'}))
          .addIntegerOption(o=>o.setName('days').setDescription('Days; omit for permanent').setMinValue(1).setMaxValue(3650))
          .addBooleanOption(o=>o.setName('early_access').setDescription('Also enable Early Access')))
        .addSubcommand(s => s.setName('userrevoke').setDescription('Revoke a user Premium.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('userstatus').setDescription('View a user Premium status.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('servergrant').setDescription('Grant Premium to an Astrix server.')
          .addStringOption(o=>o.setName('guild_id').setDescription('Discord server ID').setRequired(true))
          .addStringOption(o=>o.setName('tier').setDescription('Tier').addChoices({name:'Premium',value:'premium'},{name:'Premium+',value:'plus'},{name:'Elite',value:'elite'}))
          .addIntegerOption(o=>o.setName('days').setDescription('Days; omit for permanent').setMinValue(1).setMaxValue(3650)))
        .addSubcommand(s => s.setName('server').setDescription('Grant Premium to a server.')
          .addStringOption(o=>o.setName('guild_id').setDescription('Discord server ID').setRequired(true))
          .addStringOption(o=>o.setName('tier').setDescription('Tier').addChoices({name:'Premium',value:'premium'},{name:'Premium+',value:'plus'},{name:'Elite',value:'elite'}))
          .addIntegerOption(o=>o.setName('days').setDescription('Days; omit for permanent').setMinValue(1).setMaxValue(3650)))
        .addSubcommand(s => s.setName('serverrevoke').setDescription('Revoke server Premium.').addStringOption(o=>o.setName('guild_id').setDescription('Discord server ID').setRequired(true)))
        .addSubcommand(s => s.setName('serverstatus').setDescription('View server Premium status.').addStringOption(o=>o.setName('guild_id').setDescription('Discord server ID').setRequired(true))))
      .addSubcommandGroup(g => g.setName('currency').setDescription('Owner economy currency controls.')
        .addSubcommand(s=>s.setName('gemsgrant').setDescription('Grant Astrix Gems.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(1000000000)))
        .addSubcommand(s=>s.setName('gemsremove').setDescription('Remove Astrix Gems.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(1000000000)))
        .addSubcommand(s=>s.setName('gemsset').setDescription('Set Astrix Gems.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(0).setMaxValue(1000000000)))
        .addSubcommand(s=>s.setName('coinsgrant').setDescription('Grant virtual coins.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(2000000000)))
        .addSubcommand(s=>s.setName('coinsremove').setDescription('Remove virtual coins.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(2000000000)))
        .addSubcommand(s=>s.setName('coinsset').setDescription('Set wallet virtual coins.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(0).setMaxValue(2000000000))))
      .addSubcommandGroup(g => g.setName('economy').setDescription('Owner economy account controls.')
        .addSubcommand(s=>s.setName('itemgrant').setDescription('Grant a shop item.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addStringOption(o=>o.setName('item').setDescription('Item ID').setRequired(true)).addIntegerOption(o=>o.setName('quantity').setDescription('Quantity').setMinValue(1).setMaxValue(1000)))
        .addSubcommand(s=>s.setName('itemremove').setDescription('Remove a shop item.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addStringOption(o=>o.setName('item').setDescription('Item ID').setRequired(true)).addIntegerOption(o=>o.setName('quantity').setDescription('Quantity').setMinValue(1).setMaxValue(1000)))
        .addSubcommand(s=>s.setName('walletlimit').setDescription('Set wallet capacity.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Capacity').setRequired(true).setMinValue(1000).setMaxValue(2000000000)))
        .addSubcommand(s=>s.setName('banklimit').setDescription('Set bank capacity.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Capacity').setRequired(true).setMinValue(1000).setMaxValue(2000000000)))
        .addSubcommand(s=>s.setName('creditset').setDescription('Set virtual credit score.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o=>o.setName('score').setDescription('Score').setRequired(true).setMinValue(300).setMaxValue(900)))
        .addSubcommand(s=>s.setName('loanwipe').setDescription('Clear a virtual loan.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s=>s.setName('loanstatus').setDescription('View a virtual loan.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true))))
      .addSubcommandGroup(g => g.setName('access').setDescription('Owner access and blacklist controls.')
        .addSubcommand(s=>s.setName('earlygrant').setDescription('Grant Early Access.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s=>s.setName('earlyrevoke').setDescription('Revoke Early Access.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s=>s.setName('blacklistuser').setDescription('Add user to owner blacklist.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s=>s.setName('unblacklistuser').setDescription('Remove user from owner blacklist.').addUserOption(o=>o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s=>s.setName('blacklistserver').setDescription('Add server to owner blacklist.').addStringOption(o=>o.setName('guild_id').setDescription('Discord server ID').setRequired(true)))
        .addSubcommand(s=>s.setName('unblacklistserver').setDescription('Remove server from owner blacklist.').addStringOption(o=>o.setName('guild_id').setDescription('Discord server ID').setRequired(true))))
      .addSubcommandGroup(g => g.setName('broadcast').setDescription('Owner announcement and giveaway controls.')
        .addSubcommand(s=>s.setName('announce').setDescription('Send owner announcement in a channel.').addChannelOption(o=>o.setName('channel').setDescription('Channel').setRequired(true)).addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true).setMaxLength(200)).addStringOption(o=>o.setName('message').setDescription('Message').setRequired(true).setMaxLength(4000)))
        .addSubcommand(s=>s.setName('globalannounce').setDescription('Broadcast to all Astrix servers.').addStringOption(o=>o.setName('title').setDescription('Title').setRequired(true).setMaxLength(200)).addStringOption(o=>o.setName('message').setDescription('Message').setRequired(true).setMaxLength(4000)).addBooleanOption(o=>o.setName('confirm').setDescription('Confirm global broadcast').setRequired(true)))
        .addSubcommand(s=>s.setName('globalgiveaway').setDescription('Start a giveaway across Astrix servers.').addStringOption(o=>o.setName('duration').setDescription('Example: 2h or 1d').setRequired(true)).addStringOption(o=>o.setName('prize').setDescription('Prize').setRequired(true).setMaxLength(200)).addBooleanOption(o=>o.setName('confirm').setDescription('Confirm global giveaway').setRequired(true)).addIntegerOption(o=>o.setName('winners').setDescription('Winners per server').setMinValue(1).setMaxValue(10))))
      .addSubcommandGroup(g => g.setName('bot').setDescription('Manage the Astrix bot profile.')
        .addSubcommand(s=>s.setName('animatedavatar').setDescription('Set the Astrix animated avatar from a GIF.')
          .addAttachmentOption(o=>o.setName('avatar').setDescription('Animated GIF avatar').setRequired(true)))
        .addSubcommand(s=>s.setName('banner').setDescription('Set the Astrix bot banner from an image or GIF.')
          .addAttachmentOption(o=>o.setName('banner').setDescription('PNG, JPG, WebP, or GIF banner').setRequired(true))))
      .addSubcommandGroup(g => g.setName('system').setDescription('Owner bot-wide tools.')
        .addSubcommand(s=>s.setName('stats').setDescription('View owner bot stats.'))
        .addSubcommand(s=>s.setName('guilds').setDescription('List Astrix servers.'))
        .addSubcommand(s=>s.setName('users').setDescription('View stored user count.'))
        .addSubcommand(s=>s.setName('reloadshop').setDescription('Rotate a server shop.').addStringOption(o=>o.setName('guild_id').setDescription('Guild ID; omit for current server')))
        .addSubcommand(s=>s.setName('backup').setDescription('Create a security backup.').addStringOption(o=>o.setName('guild_id').setDescription('Guild ID; omit for current server')))
         .addSubcommand(s=>s.setName('logs').setDescription('View the configured owner-only bot log channel.'))
        .addSubcommand(s=>s.setName('logchannel').setDescription('Set the owner-only global bot log channel.')
          .addChannelOption(o=>o.setName('channel').setDescription('Private channel in the support server').setRequired(true)))),

    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Create and manage Astrix giveaways.')
      .addSubcommand(sc => sc.setName('start').setDescription('Start a giveaway.')
        .addStringOption(o => o.setName('duration').setDescription('Duration such as 10m, 2h or 1d').setRequired(true))
        .addStringOption(o => o.setName('prize').setDescription('Giveaway prize').setRequired(true).setMaxLength(200))
        .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10))
        .addChannelOption(o => o.setName('channel').setDescription('Channel for the giveaway')))
      .addSubcommand(sc => sc.setName('end').setDescription('End a giveaway now.')
        .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
      .addSubcommand(sc => sc.setName('reroll').setDescription('Reroll winners for an ended giveaway.')
        .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
      .addSubcommand(sc => sc.setName('list').setDescription('List giveaways in this server.')),

    new SlashCommandBuilder()
      .setName('prefix')
      .setDescription('View or change the Astrix prefix.')
      .addSubcommand(sc => sc.setName('show').setDescription('Show the current prefix.'))
      .addSubcommand(sc => sc.setName('set').setDescription('Set a new prefix.')
        .addStringOption(o => o.setName('value').setDescription('New prefix, 1-10 characters').setRequired(true).setMinLength(1).setMaxLength(10)))
      .addSubcommand(sc => sc.setName('reset').setDescription('Reset the prefix to the default.')),

    new SlashCommandBuilder()
      .setName('noprefix')
      .setDescription('Manage members who may use Astrix without the server prefix.')
      .addSubcommand(sc => sc.setName('grant').setDescription('Grant no-prefix access to a member.')
        .addUserOption(o => o.setName('user').setDescription('Member who may use no-prefix commands').setRequired(true)))
      .addSubcommand(sc => sc.setName('revoke').setDescription('Revoke no-prefix access from a member.')
        .addUserOption(o => o.setName('user').setDescription('Member who should lose no-prefix access').setRequired(true)))
      .addSubcommand(sc => sc.setName('list').setDescription('List members with no-prefix access.'))
      .addSubcommand(sc => sc.setName('status').setDescription('Show the no-prefix access status.')),

    new SlashCommandBuilder()
      .setName('premiumcurrency')
      .setDescription('View or manage Astrix Gems premium currency.')
      .addSubcommand(sc => sc.setName('balance').setDescription('View Astrix Gems.')
        .addUserOption(o => o.setName('user').setDescription('User to view')))
      .addSubcommand(sc => sc.setName('grant').setDescription('Owner: grant Astrix Gems.')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(10000000)))
      .addSubcommand(sc => sc.setName('remove').setDescription('Owner: remove Astrix Gems.')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(10000000)))
      .addSubcommand(sc => sc.setName('set').setDescription('Owner: set Astrix Gems exactly.')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(0).setMaxValue(10000000))),

    new SlashCommandBuilder()
      .setName('earlyaccess')
      .setDescription('View or manage Astrix Early Access.')
      .addSubcommand(sc => sc.setName('status').setDescription('View Early Access status.')
        .addUserOption(o => o.setName('user').setDescription('User to view')))
      .addSubcommand(sc => sc.setName('grant').setDescription('Owner: grant Early Access.')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
      .addSubcommand(sc => sc.setName('remove').setDescription('Owner: remove Early Access.')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),

    new SlashCommandBuilder()
      .setName('premiumtiers')
      .setDescription('View Astrix Premium tiers and included Gems.'),

    new SlashCommandBuilder().setName('action').setDescription('Send a random SFW reaction GIF to another user.')
      .addStringOption(o => o.setName('type').setDescription('Action to perform').setRequired(true).addChoices(
         {name:'Hug',value:'hug'},{name:'Kiss',value:'kiss'},{name:'Slap',value:'slap'},{name:'Punch',value:'punch'},{name:'Fuck',value:'fuck'},{name:'Pat',value:'pat'},{name:'Poke',value:'poke'},
        {name:'Bonk',value:'bonk'},{name:'Wave',value:'wave'},{name:'High Five',value:'highfive'},{name:'Dance',value:'dance'},
        {name:'Clap',value:'clap'},{name:'Cheer',value:'cheer'},{name:'Laugh',value:'laugh'},{name:'Facepalm',value:'facepalm'},
        {name:'Smile',value:'smile'},{name:'Shrug',value:'shrug'},{name:'Salute',value:'salute'},{name:'Handshake',value:'handshake'},
        {name:'Nod',value:'nod'},{name:'Stare',value:'stare'},{name:'Wink',value:'wink'},{name:'Thumbs Up',value:'thumbsup'}
      ))
      .addUserOption(o => o.setName('user').setDescription('User to react to').setRequired(true)),

    new SlashCommandBuilder().setName('coinflip').setDescription('Wager virtual coins on a cryptographically safe coin flip.')
      .addIntegerOption(o => o.setName('amount').setDescription('Whole-number wallet wager').setRequired(true).setMinValue(1).setMaxValue(2000000000))
      .addStringOption(o => o.setName('side').setDescription('Your selected side; random when omitted').addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),
    new SlashCommandBuilder().setName('dice').setDescription('Roll a six-sided dice.'),
    new SlashCommandBuilder().setName('eightball').setDescription('Ask the Astrix magic 8-ball a question.')
      .addStringOption(o => o.setName('question').setDescription('Question to ask').setRequired(true).setMaxLength(300)),
    new SlashCommandBuilder().setName('choose').setDescription('Let Astrix choose between comma-separated options.')
      .addStringOption(o => o.setName('options').setDescription('Example: pizza, burger, noodles').setRequired(true).setMaxLength(500)),
    new SlashCommandBuilder().setName('rate').setDescription('Give something a random fun rating.')
      .addStringOption(o => o.setName('thing').setDescription('Thing to rate').setRequired(true).setMaxLength(200)),
    new SlashCommandBuilder().setName('iq').setDescription('Generate a random joke IQ score.')
      .addUserOption(o => o.setName('user').setDescription('User to check')),
    new SlashCommandBuilder().setName('joke').setDescription('Get a random family-friendly joke.'),
    new SlashCommandBuilder().setName('fact').setDescription('Get a random interesting fact.'),
    new SlashCommandBuilder().setName('reverse').setDescription('Reverse the text you provide.')
      .addStringOption(o => o.setName('text').setDescription('Text to reverse').setRequired(true).setMaxLength(1000)),
    new SlashCommandBuilder().setName('mock').setDescription('Convert text into alternating mock case.')
      .addStringOption(o => o.setName('text').setDescription('Text to transform').setRequired(true).setMaxLength(1000)),
    new SlashCommandBuilder().setName('randomnumber').setDescription('Generate a random number in a range.')
      .addIntegerOption(o => o.setName('min').setDescription('Minimum value').setRequired(true).setMinValue(-1000000).setMaxValue(1000000))
      .addIntegerOption(o => o.setName('max').setDescription('Maximum value').setRequired(true).setMinValue(-1000000).setMaxValue(1000000)),
    new SlashCommandBuilder().setName('ship').setDescription('Generate a lighthearted compatibility score between two users.')
      .addUserOption(o => o.setName('user1').setDescription('First user').setRequired(true))
      .addUserOption(o => o.setName('user2').setDescription('Second user')),

    new SlashCommandBuilder().setName('hunt').setDescription('Hunt for a collectible creature.'),
    new SlashCommandBuilder().setName('fish').setDescription('Go fishing for collectibles.'),
    new SlashCommandBuilder().setName('dig').setDescription('Dig for collectible treasure.'),
    new SlashCommandBuilder().setName('beg').setDescription('Ask for a small fictional coin reward.'),
    new SlashCommandBuilder().setName('search').setDescription('Search a random place for fictional coins.'),
    new SlashCommandBuilder().setName('zoo').setDescription('View your Astrix creature and collectible collection.'),
    new SlashCommandBuilder().setName('collection').setDescription('View your collectible collection.'),
    new SlashCommandBuilder().setName('quests').setDescription('View your daily Astrix quests.'),
    new SlashCommandBuilder().setName('achievements').setDescription('View your unlocked Astrix achievements.'),

    new SlashCommandBuilder()
      .setName('adventure')
      .setDescription('Astrix collection, hunting and casual economy adventures.')
      .addSubcommand(sc => sc.setName('hunt').setDescription('Hunt for a collectible creature.'))
      .addSubcommand(sc => sc.setName('dig').setDescription('Dig for collectible treasure.'))
      .addSubcommand(sc => sc.setName('fish').setDescription('Go fishing for collectibles.'))
      .addSubcommand(sc => sc.setName('beg').setDescription('Ask for a small fictional coin reward.'))
      .addSubcommand(sc => sc.setName('search').setDescription('Search a random place for fictional coins.'))
      .addSubcommand(sc => sc.setName('collection').setDescription('View your collectible collection.'))
      .addSubcommand(sc => sc.setName('quests').setDescription('View daily quests.'))
      .addSubcommand(sc => sc.setName('achievements').setDescription('View unlocked achievements.')),

    new SlashCommandBuilder()
      .setName('autorespond')
      .setDescription('Configure automatic text responses.')
      .addSubcommand(sc => sc.setName('add').setDescription('Add an automatic response.')
        .addStringOption(o => o.setName('trigger').setDescription('Trigger text').setRequired(true).setMaxLength(100))
        .addStringOption(o => o.setName('response').setDescription('Bot response').setRequired(true).setMaxLength(1500))
        .addStringOption(o => o.setName('match').setDescription('Matching mode').addChoices({name:'Contains',value:'contains'},{name:'Exact',value:'exact'})))
      .addSubcommand(sc => sc.setName('remove').setDescription('Remove an automatic response.')
        .addStringOption(o => o.setName('trigger').setDescription('Trigger text').setRequired(true).setMaxLength(100)))
      .addSubcommand(sc => sc.setName('list').setDescription('List automatic responses.'))
      .addSubcommand(sc => sc.setName('toggle').setDescription('Enable or disable auto responses.')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enabled state').setRequired(true)))
  ].map(x => x.toJSON());
}

module.exports = { buildExtendedCommands };
