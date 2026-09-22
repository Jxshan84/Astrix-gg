require('./utils/loadEnv.ts').loadEnv();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { buildCommands, HIDDEN_SECURITY_COMMANDS, LEGACY_COMMAND_NAMES } = require('./commands.ts');
const { buildExtendedCommands } = require('./extendedCommands.ts');
const { LEGACY_GROUPS } = require('./legacyCommands.ts');

// Discord allows a maximum of 100 CHAT_INPUT commands per scope. The most
// useful direct commands are kept global, while the remaining commands are
// registered per-guild below so no feature silently disappears.
const COMMAND_LIMIT = 100;
const EXTENDED_PRIORITY = [
  'mod','owner','giveaway','prefix','premiumcurrency','earlyaccess','premiumtiers',
  'noprefix','eightball','choose','rate','iq','muterole','antimention'
];

const LEGACY_GLOBAL_ALIASES = new Set([
  'avatar','jobs','applyjob','shift','career','clearwarns','givecoins','setbalance','giveitem',
  'givepremium','removepremium','shoprefresh','setcredit','announce','rps','trivia','weekly','randomnumber',
  'aiusage','rewrite','botinfo','uptime','membercount','roleinfo','userinfo','serverinfo',
  'securitystatus','wallet','trivia','botstatus','classic',
  ...LEGACY_COMMAND_NAMES
]);

function assertRequiredOrder(commands) {
  const walk=(options,path)=>{
    let optionalSeen=false;
    for(const option of options||[]){
      if(option.type===1||option.type===2){walk(option.options||[],`${path}/${option.name}`);continue;}
      if(option.required){if(optionalSeen)throw new Error(`Required option appears after an optional option at ${path}/${option.name}`);}
      else optionalSeen=true;
    }
  };
  for(const command of commands)walk(command.options||[],`/${command.name}`);
}

function commandPayload(command: any) {
  // GET responses include Discord-managed fields (id, application_id, version,
  // and sometimes guild_id). Sending those fields back during PUT can make a
  // command sync fail, so only retain fields accepted by command creation.
  const payload: any = { name: command.name };
  if (command.type !== undefined) payload.type = command.type;
  if (command.type !== undefined && command.type !== 1) return payload;
  payload.description = command.description || 'Astrix command';
  payload.options = command.options || [];
  for (const key of ['default_member_permissions', 'dm_permission', 'nsfw', 'contexts', 'integration_types']) {
    if (command[key] !== undefined) payload[key] = command[key];
  }
  return payload;
}

function removeDuplicateSubcommands(commands, duplicateNames) {
  const names = duplicateNames instanceof Set ? duplicateNames : new Set(duplicateNames || []);
  return commands.map(command => {
    if (!Array.isArray(command.options) || !command.options.length) return command;
    const options = command.options
      .filter(option => {
        if (option.type !== 1 && option.type !== 2) return true;
        return !names.has(option.name);
      })
      .map(option => {
        if (option.type !== 2 || !Array.isArray(option.options)) return option;
        return { ...option, options: option.options.filter(child => !names.has(child.name)) };
      });
    return { ...command, options };
  });
}

function cloneOption(option) {
  const copy = { ...option };
  if (Array.isArray(option.options)) copy.options = option.options.map(cloneOption);
  if (Array.isArray(option.choices)) copy.choices = option.choices.map(choice => ({ ...choice }));
  return copy;
}

function addOverflowSubcommand(group, command, name = command.name) {
  const options = (command.options || []).filter(option => option.type !== 1 && option.type !== 2).map(cloneOption);
  group.addSubcommand(subcommand => {
    subcommand.setName(name).setDescription(command.description || 'Astrix command');
    for (const option of options) {
      if (option.type === 3) subcommand.addStringOption(builder => {
        builder.setName(option.name).setDescription(option.description || 'Command input').setRequired(Boolean(option.required));
        if (option.autocomplete) builder.setAutocomplete(true);
        if (option.min_length !== undefined) builder.setMinLength(option.min_length);
        if (option.max_length !== undefined) builder.setMaxLength(option.max_length);
        if (Array.isArray(option.choices)) builder.addChoices(...option.choices);
        return builder;
      });
      else if (option.type === 4) subcommand.addIntegerOption(builder => {
        builder.setName(option.name).setDescription(option.description || 'Command input').setRequired(Boolean(option.required));
        if (option.min_value !== undefined) builder.setMinValue(option.min_value);
        if (option.max_value !== undefined) builder.setMaxValue(option.max_value);
        if (Array.isArray(option.choices)) builder.addChoices(...option.choices);
        return builder;
      });
      else if (option.type === 5) subcommand.addBooleanOption(builder => builder.setName(option.name).setDescription(option.description || 'Command input').setRequired(Boolean(option.required)));
      else if (option.type === 6) subcommand.addUserOption(builder => builder.setName(option.name).setDescription(option.description || 'User').setRequired(Boolean(option.required)));
      else if (option.type === 7) subcommand.addChannelOption(builder => builder.setName(option.name).setDescription(option.description || 'Channel').setRequired(Boolean(option.required)));
    }
    return subcommand;
  });
}

function addOverflowGroup(root, name, description, commands, nestedCommand = null) {
  if (!commands.length && !nestedCommand) return;
  root.addSubcommandGroup(group => {
    group.setName(name).setDescription(description);
    for (const command of commands) addOverflowSubcommand(group, command);
    if (nestedCommand) {
      for (const subcommand of nestedCommand.options || []) {
        const child = {
          name: subcommand.name,
          description: subcommand.description,
          options: subcommand.options || []
        };
        addOverflowSubcommand(group, child);
      }
    }
    return group;
  });
}

function buildOverflowCommand(commands) {
  const byName = new Map(commands.map(command => [command.name, command]));
  const take = name => byName.get(name);
  const root = new SlashCommandBuilder()
    .setName('extras')
    .setDescription('Additional Astrix commands moved into grouped subcommands.');

  addOverflowGroup(root, 'utility', 'Utility and reminder commands.', ['servericon', 'timer'].map(take).filter(Boolean));
  addOverflowGroup(root, 'premium-tools', 'Owner-only Premium compatibility commands.', [
    'premiumgrant', 'premiumrevoke', 'premiumserver', 'premiumservergrant', 'premiumserverrevoke'
  ].map(take).filter(Boolean));
  addOverflowGroup(root, 'moderation', 'Additional moderation commands.', [
    'nick', 'hide', 'unhide', 'clonechannel', 'deletechannel', 'voiceban', 'voiceunban', 'massban', 'masskick'
  ].map(take).filter(Boolean));
  addOverflowGroup(root, 'reactions', 'Direct reaction commands.', [
    'hug', 'kiss', 'slap', 'punch', 'fuck'
  ].map(take).filter(Boolean));
  addOverflowGroup(root, 'fun', 'Fun and interaction commands.', [
    'action', 'coinflip', 'dice', 'joke', 'fact', 'reverse', 'mock', 'randomnumber', 'ship'
  ].map(take).filter(Boolean));
  addOverflowGroup(root, 'lootbox', 'Astrix Lootbox commands.', [], take('lootbox'));
  addOverflowGroup(root, 'weaponcrate', 'Hunt Weapon Crate commands.', [], take('weaponcrate'));
  addOverflowGroup(root, 'adventure', 'Adventure and XP collection commands.', [
    'hunt', 'fish', 'dig', 'beg', 'zoo', 'collection', 'quests', 'achievements'
  ].map(take).filter(Boolean));
  addOverflowGroup(root, 'autorespond', 'Automatic response commands.', [], take('autorespond'));
  for (const [groupName, names] of Object.entries(LEGACY_GROUPS)) {
    addOverflowGroup(root, groupName, 'Compatibility commands from the original command list.', (names as any[]).map(take).filter(Boolean));
  }

  return root.toJSON();
}

function mergeCommands(existing, desired, limit = COMMAND_LIMIT) {
  const desiredByName = new Map<string, any>(desired.map(command => [command.name, command]));
  const merged = [];
  let replaced = 0;
  let added = 0;

  // Existing commands always win the slot. If Astrix owns the same name, the
  // desired definition updates that command without removing the slot.
  for (const command of existing || []) {
    const replacement = desiredByName.get(command.name);
    if (replacement) {
      merged.push(commandPayload(replacement));
      desiredByName.delete(command.name);
      replaced += 1;
    } else {
      merged.push(commandPayload(command));
    }
  }

  const skipped = [];
  for (const command of desiredByName.values()) {
    if (merged.length >= limit) {
      skipped.push(command.name);
      continue;
    }
    merged.push(commandPayload(command));
    added += 1;
  }

  return { commands: merged, replaced, added, skipped };
}

function buildGlobalCommandSet(){
  const core=buildCommands().filter(c=>!LEGACY_GLOBAL_ALIASES.has(c.name));
  const extAll=buildExtendedCommands();
  const extByName=new Map<string, any>(extAll.map(c=>[c.name,c]));
  const selected=EXTENDED_PRIORITY.map(name=>extByName.get(name)).filter(Boolean);
  const byName=new Map<string, any>();
  for(const command of core)byName.set(command.name,command);
  for(const command of selected)if(!byName.has(command.name))byName.set(command.name,command);
   const commands=removeDuplicateSubcommands([...byName.values()], new Set([...byName.keys()]));
   if(commands.length>COMMAND_LIMIT)throw new Error(`Discord global command limit exceeded: ${commands.length}/${COMMAND_LIMIT}.`);
  assertRequiredOrder(commands);
   console.log(`Global command set prepared: ${commands.length}/${COMMAND_LIMIT}.`);
  return commands;
}

async function registerGlobalCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) throw new Error('Missing DISCORD_TOKEN or CLIENT_ID.');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
   const desired = buildGlobalCommandSet();
   const route = Routes.applicationCommands(process.env.CLIENT_ID);
    // PUT is intentionally authoritative here. Preserving stale commands was
    // the reason a full old registry consumed all 100 slots and hid current
    // Astrix commands behind "skipped" warnings.
    const out = await rest.put(route, { body: desired.map(commandPayload) });
    console.log(`Global slash registration successful: ${out.length}/${COMMAND_LIMIT} current Astrix commands (stale definitions replaced).`);
  return out;
}

function getGuildOnlyCommands() {
  const all = [...buildCommands(), ...buildExtendedCommands()]
    .filter(command => !HIDDEN_SECURITY_COMMANDS.has(command.name) && command.name !== 'antimention');
  const globalNames = new Set(buildGlobalCommandSet().map(command => Object(command).name));
  const byName = new Map(all.map(command => [command.name, command]));
  const guildOnly = removeDuplicateSubcommands(
    [...byName.values()].filter(command => !globalNames.has(command.name)),
    globalNames
  );
  // Discord allows 100 top-level commands per guild. Keep the first 99
  // compatibility commands and put every remaining command under one grouped
  // /extras command (with subcommand groups), so none of the 41 overflow
  // commands disappear.
  return [...guildOnly.slice(0, COMMAND_LIMIT - 1), buildOverflowCommand(guildOnly.slice(COMMAND_LIMIT - 1))];
}

async function registerExtendedForGuild(guild) {
  if (!guild) return [];
   const desired = getGuildOnlyCommands();
    const out = await guild.commands.set(desired.map(commandPayload));
    console.log(`Guild slash registration successful for ${guild.name}: ${out.size}/${COMMAND_LIMIT} current Astrix commands (overflow grouped under /extras).`);
  return out;
}

async function registerExtendedCommands(client) {
  const results = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      results.push(await registerExtendedForGuild(guild));
    } catch (error) {
      console.error(`Could not register guild-only commands for ${guild.name}:`, error.message);
    }
  }
  return results;
}

module.exports = { registerGlobalCommands, registerExtendedCommands, registerExtendedForGuild, buildGlobalCommandSet, getGuildOnlyCommands, removeDuplicateSubcommands };
if (require.main === module) registerGlobalCommands().catch(error => { console.error('Registration failed:', error); process.exit(1); });
