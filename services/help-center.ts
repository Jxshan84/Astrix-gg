const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { boldSans } = require('../utils/unicode.ts');
const NOIR = 0x2B2D31;
const DASHBOARD_URL = String(process.env.ASTRIX_DASHBOARD_URL || process.env.DASHBOARD_URL || '').trim();
const { buildCommands } = require('../commands.ts');
const { buildExtendedCommands } = require('../extendedCommands.ts');
const CATEGORIES = [
  ['economy', '💰', 'Economy & Banking', ['Balance, Banking, Payments', 'Shop & Inventory', 'Trading & Robbing']],
  ['career', '💼', 'Career & Jobs', ['Work, Careers, Salaries', 'Daily Rewards & Streaks']],
  ['marriage', '💞', 'Marriage & Social', ['Marriage, Divorce, Gifts', 'Social Interactions']],
  ['shop', '🛍️', 'Shop & Inventory', ['Shop, Buy, Sell', 'Inventory & Items']],
  ['ai', '🧠', 'AI & Utilities', ['AI Chat & Image Tools', 'Reminders & Utilities']],
  ['music', '🎵', 'Music Playback', ['/play, /pause, /resume, /skip', 'Queue, Loop, Volume, Now Playing']],
  ['filters', '🎛️', 'Audio Filters & EQ', ['/filter Full Bass', '/filter Hall Reverb, 8D, Nightcore, Clear']],
  ['security', '🛡️', 'Security & Antinuke', ['Antimention, Lockdown, Security', 'Automod & Protection']],
  ['moderation', '🔨', 'Moderation & Roles', ['Moderation, Roles, Mute', 'Warnings, Cases & Logs']],
  ['tickets', '🎫', 'Tickets & Logging', ['Ticket panels and support', 'Audit and server logs']],
  ['premium', '💎', 'Premium & 24/7', ['Premium tiers and perks', '/music247 setup, enable, status']],
  ['fun', '🎮', 'Fun & Games', ['Trivia, Adventure, Collection', 'Giveaways and social fun']],
  ['owner', '👑', 'Owner', ['Owner controls and diagnostics', 'Bot configuration']]
];
const USAGES = {
  economy: ['/balance', '/shop', '/rob @user'], career: ['/work', '/daily'], marriage: ['/marry @user', '/gift'],
  shop: ['/shop', '/inventory'], ai: ['/ask <prompt>', '/remind'], music: ['/play <query>', '/queue'],
  filters: ['/filter preset', '/filter Clear'], security: ['/security', '/antimention'], moderation: ['/mod', '/warn @user'],
  tickets: ['/ticket setup', '/ticket close'], premium: ['/premium', '/music247 setup'], fun: ['/trivia', '/hunt'],
  owner: ['/owner', '/botstatus']
};
const CATEGORY_WORDS = {
  economy: new Set(['balance','wallet','bank','deposit','withdraw','pay','daily','weekly','leaderboard','credit','loan','repay','autopay']),
  career: new Set(['work','jobs','applyjob','shift','career']),
  marriage: new Set(['marry','divorce','gift','relationship']),
  shop: new Set(['shop','buy','sell','inventory','use','rob','lootbox','weaponcrate']),
  ai: new Set(['ai','ask','translate','rewrite','summarize','generate','aiusage','remind']),
  music: new Set(['play','pause','resume','skip','stop','disconnect','queue','loop','volume','nowplaying','music247']),
  filters: new Set(['filter']),
  security: new Set(['security','antinuke','antibot','antiraid','antinsfw','antilink','antiinvite','antispam','badwords','antimention','quarantine']),
  moderation: new Set(['ban','unban','kick','timeout','untimeout','warn','warnings','clearwarns','purge','lock','unlock','slowmode','nickname','role','mod','mute','unmute','nick','hide','unhide']),
  tickets: new Set(['ticket','log','logs','record']),
  premium: new Set(['premium','premiumtiers','premiumcurrency','earlyaccess']),
  fun: new Set(['trivia','action','coinflip','dice','eightball','choose','rate','iq','joke','fact','reverse','mock','randomnumber','ship','adventure','hunt','fish','dig','beg','search','zoo','collection','quests','achievements','giveaway']),
  owner: new Set(['owner','botstatus','botinfo','announce','setbalance','givecoins','giveitem','givepremium','removepremium','shoprefresh'])
};
function registeredCommands(interaction: any) {
  const live = Array.isArray(interaction.client?.astrixHelpCommands) ? interaction.client.astrixHelpCommands : [];
  const builders = live.length ? live : [...buildCommands(), ...buildExtendedCommands()];
  return builders.map((builder: any) => typeof builder.toJSON === 'function' ? builder.toJSON() : builder)
    .filter((command: any) => command?.name);
}
function categoryCommands(interaction: any, id: string) {
  const commands = registeredCommands(interaction);
  const words = CATEGORY_WORDS[id] || new Set();
  return commands.filter((command: any) => words.has(command.name) || (id === 'fun' && command.name.startsWith('action')));
}
function commandUsage(command: any) {
  const options = (command.options || []).filter((option: any) => option.type !== 1 && option.type !== 2);
  return `/${command.name}${options.map((option: any) => option.required ? ` <${option.name}>` : ` [${option.name}]`).join('')}`;
}
function botIcon(interaction: any) {
  const icon = interaction.client?.user?.displayAvatarURL?.({ extension: 'png', size: 256 });
  return icon || undefined;
}
function stats(interaction: any) { return `**Dynamic Stats**\n• Total Commands: **${registeredCommands(interaction).length}**\n• Gateway Latency: **${Math.max(0, Number(interaction.client.ws?.ping || 0))}ms**`; }
function overviewEmbed(interaction: any) {
  const tree = CATEGORIES.map((category: any[]) => {
    const commands = categoryCommands(interaction, category[0]).slice(0, 8);
    return `${category[1]} **${category[2]}**\n└ ${commands.length ? commands.map((command: any) => `\`/${command.name}\``).join(' • ') : 'No registered commands currently available.'}`;
  }).join('\n');
  return new EmbedBuilder().setColor(NOIR).setAuthor({ name: 'Astrix Help Center', iconURL: botIcon(interaction) })
    .setDescription(`*Browse commands, discover features, and configure your server.*\n\n${stats(interaction)}\n\n**Quick Shortcuts**\n• \`/help <category>\` — Open a category directly\n• \`help\` — Prefix command center\n\n${tree}`)
    .setThumbnail(botIcon(interaction)).setFooter({ text: '13 categories • Always on • Fast navigation' });
}
function categoryEmbed(interaction: any, key: string) {
  const category: any[] = (CATEGORIES.find((x: any[]) => x[0] === key) || CATEGORIES[0]) as any[];
  const [id, emoji, label] = category;
  const liveCommands = categoryCommands(interaction, id);
  const commands = liveCommands.map((command: any) => `**${emoji} ${command.name}**\n└ ${command.description || 'Astrix command'}\n└ Usage: \`${commandUsage(command)}\``).join('\n\n');
  return new EmbedBuilder().setColor(NOIR).setAuthor({ name: `Astrix Help Center • ${label}`, iconURL: botIcon(interaction) })
    .setDescription(`*${label} commands and usage.*\n\n${commands || 'No registered commands are currently available in this category.'}`).setThumbnail(botIcon(interaction))
    .setFooter({ text: '13 categories • Always on • Fast navigation' });
}
function components(selected = 'overview') {
  const menu = new StringSelectMenuBuilder().setCustomId('help_category_select').setPlaceholder('Select a category...').addOptions([
    { label: 'Overview', value: 'overview', emoji: '🏠', default: selected === 'overview' },
    ...CATEGORIES.map((x: any[]) => ({ label: x[2], value: x[0], emoji: x[1], default: selected === x[0] }))
  ]);
  const buttons = [new ButtonBuilder().setCustomId('help_switch_buttons').setLabel('Switch to Buttons').setStyle(ButtonStyle.Secondary)];
  if (DASHBOARD_URL) buttons.push(new ButtonBuilder().setLabel('Dashboard').setStyle(ButtonStyle.Link).setURL(DASHBOARD_URL));
  return [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(...buttons)];
}
function payload(interaction: any, selected = 'overview') { return { embeds: [selected === 'overview' ? overviewEmbed(interaction) : categoryEmbed(interaction, selected)], components: components(selected) }; }
async function command(interaction: any) {
  const requested = interaction.options?.getString?.('category');
  const key = requested ? String((CATEGORIES.find((x: any[]) => x[0] === requested.toLowerCase() || x[2].toLowerCase() === requested.toLowerCase()) || [])[0] || 'overview') : 'overview';
  return interaction.reply(payload(interaction, key));
}
async function prefix(message: any) { return message.reply(payload(message, 'overview')); }
async function select(interaction: any) {
  const key = interaction.values?.[0] || 'overview';
  return interaction.update(payload(interaction, key));
}
async function button(interaction: any) {
  return interaction.update({ embeds: [overviewEmbed(interaction)], components: components('overview') });
}
module.exports = { command, prefix, select, button, DASHBOARD_URL, categories: CATEGORIES, title: boldSans('Astrix Help Center') };