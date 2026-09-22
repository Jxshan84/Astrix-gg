const { PermissionFlagsBits } = require('discord.js');
const store = require('./store.ts');
const premium = require('./premium.ts');
const ui = require('./ui.ts');

function cfg(guildId) {
  const g = store.guild(guildId);
  g.config ||= {};
  g.config.autoRespond ||= { enabled: true, items: [] };
  g.config.autoRespond.items ||= [];
  return g.config.autoRespond;
}

function manager(i) { return i.memberPermissions?.has(PermissionFlagsBits.ManageGuild); }

async function command(i) {
  if (!manager(i)) throw new Error('Manage Server permission is required to configure auto responses.');
  const c = cfg(i.guildId);
  const sub = i.options.getSubcommand();
  if (sub === 'add') {
    const limit = premium.isPremium(i) ? 100 : 10;
    if (c.items.length >= limit) throw new Error(`Your plan allows up to ${limit} auto responses in this server.`);
    const trigger = i.options.getString('trigger', true).trim();
    const response = i.options.getString('response', true).trim();
    const match = i.options.getString('match') || 'contains';
    const existing = c.items.find(x => x.trigger.toLowerCase() === trigger.toLowerCase());
    if (existing) Object.assign(existing, { response, match });
    else c.items.push({ trigger, response, match });
    store.save();
    return i.reply({ embeds: [ui.success('Auto Response Saved', `Trigger: \`${trigger}\`\nMode: **${match}**\nUsage: **${c.items.length}/${limit}**`)], ephemeral: true });
  }
  if (sub === 'remove') {
    const trigger = i.options.getString('trigger', true).trim().toLowerCase();
    const before = c.items.length;
    c.items = c.items.filter(x => x.trigger.toLowerCase() !== trigger);
    store.save();
    if (c.items.length === before) throw new Error('No auto response matched that trigger.');
    return i.reply({ embeds: [ui.success('Auto Response Removed', 'The trigger was removed.')], ephemeral: true });
  }
  if (sub === 'toggle') {
    c.enabled = i.options.getBoolean('enabled', true);
    store.save();
    return i.reply({ embeds: [ui.success('Auto Respond Updated', `Auto responses are now **${c.enabled ? 'enabled' : 'disabled'}**.`)], ephemeral: true });
  }
  const rows = c.items.map((x, n) => `${n+1}. \`${x.trigger}\` → ${x.response.slice(0,80)}${x.response.length>80?'…':''} (${x.match})`);
  return i.reply({ embeds: [ui.embed('🤖 Auto Responses', `Status: **${c.enabled ? 'Enabled' : 'Disabled'}**\n\n${rows.join('\n') || 'No auto responses configured.'}`)], ephemeral: true });
}

async function message(message) {
  if (!message.guild || message.author.bot || !message.content) return false;
  const c = cfg(message.guild.id);
  if (!c.enabled) return false;
  const text = message.content.trim().toLowerCase();
  const hit = c.items.find(x => x.match === 'exact' ? text === x.trigger.toLowerCase() : text.includes(x.trigger.toLowerCase()));
  if (!hit) return false;
  await message.reply({ content: hit.response, allowedMentions: { repliedUser: false, parse: [] } }).catch(() => {});
  return true;
}

module.exports = { command, message, cfg };
