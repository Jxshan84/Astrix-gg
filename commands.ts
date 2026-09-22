const { SlashCommandBuilder } = require('discord.js');
const specs = require('./data/commands.json');
const { specs: legacySpecs, LEGACY_COMMAND_NAMES } = require('./legacyCommands.ts');
const allSpecs = [...specs, ...legacySpecs];
const HIDDEN_SECURITY_COMMANDS = new Set([
  'antinuke',
  'antibot',
  'antiraid',
  'antinsfw',
  'antilink',
  'antiinvite',
  'antispam',
  'badwords',
  'securitystatus',
]);

function applyCommon(option, spec) {
  option.setName(spec.name).setDescription(spec.description).setRequired(Boolean(spec.required));
  if (spec.autocomplete && option.setAutocomplete) {
    option.setAutocomplete(true);
  } else if (Array.isArray(spec.choices) && spec.choices.length && option.addChoices) {
    option.addChoices(...spec.choices.map(([name, value]) => ({ name, value })));
  }
  if (spec.min !== undefined && option.setMinValue) option.setMinValue(spec.min);
  if (spec.max !== undefined && option.setMaxValue) option.setMaxValue(spec.max);
  return option;
}

function addOption(builder, option) {
  if (option.type === 'string') builder.addStringOption(o => applyCommon(o, option));
  else if (option.type === 'integer') builder.addIntegerOption(o => applyCommon(o, option));
  else if (option.type === 'number') builder.addNumberOption(o => applyCommon(o, option));
  else if (option.type === 'boolean') builder.addBooleanOption(o => applyCommon(o, option));
  else if (option.type === 'user') builder.addUserOption(o => applyCommon(o, option));
  else if (option.type === 'role') builder.addRoleOption(o => applyCommon(o, option));
  else if (option.type === 'channel') builder.addChannelOption(o => applyCommon(o, option));
  else if (option.type === 'attachment') builder.addAttachmentOption(o => applyCommon(o, option));
}

function buildOne(spec) {
  const cmd = new SlashCommandBuilder().setName(spec.name).setDescription(spec.description);
  if (Array.isArray(spec.subcommands) && spec.subcommands.length) {
    for (const sub of spec.subcommands) {
      cmd.addSubcommand(sc => {
        sc.setName(sub.name).setDescription(sub.description);
        for (const option of [...(sub.options || [])].sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)))) addOption(sc, option);
        return sc;
      });
    }
  } else {
    for (const option of [...(spec.options || [])].sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)))) addOption(cmd, option);
  }
  return cmd.toJSON();
}

function buildCommands() {
  return allSpecs.filter(spec => !HIDDEN_SECURITY_COMMANDS.has(spec.name)).map(buildOne);
}
module.exports = { specs: allSpecs, buildCommands, HIDDEN_SECURITY_COMMANDS, LEGACY_COMMAND_NAMES };
