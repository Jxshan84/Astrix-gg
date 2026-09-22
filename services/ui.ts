const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const COLOR = 0x6d5dfc;
const GOLD = 0xf5b942;
const RED = 0xed4245;
const GREEN = 0x57f287;
const DISCORD_CONTENT_LIMIT = 2000;
const CORRECT_EMOJI = '<a:Correct:1546107997548314674>';
const WRONG_EMOJI = '<a:wrong:1546108333688365096>';
const CORRECT_EMOJI_URL = 'https://cdn.discordapp.com/emojis/1546107997548314674.gif';
const WRONG_EMOJI_URL = 'https://cdn.discordapp.com/emojis/1546108333688365096.gif';
const LYriEL_DOT_EMOJI = '<a:lyriel_dot128:1547576769429635123>';
const EMBED_FOOTER = 'Astrix • Official';

function embed(title, description, color = COLOR) {
  const value = String(title || '');
  const decoratedTitle = value.includes('1547576769429635123') ? value : `${LYriEL_DOT_EMOJI} ${value}`;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(decoratedTitle)
    .setDescription(description || null)
    .setTimestamp()
    .setFooter({ text: EMBED_FOOTER });
}

function botLogo(client) {
  return client?.user?.displayAvatarURL?.({ size: 256, extension: 'png' }) || null;
}

function supportUrl() {
  const value = String(process.env.SUPPORT_SERVER_URL || '').trim();
  return /^https?:\/\//i.test(value) ? value : '';
}

function supportHint() {
  const url = supportUrl();
  if (url) {
    return `\n\n🛟 **Need help?** If something seems wrong, report it in our [Support Server](${url}).`;
  }
  return '\n\n🛟 **Need help?** If something seems wrong, contact the Astrix support team.';
}

function supportComponents(label = 'Support Server') {
  const url = supportUrl();
  if (!url) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(label)
        .setStyle(ButtonStyle.Link)
        .setURL(url)
    )
  ];
}

function success(title, description) {
  return embed(title, `${CORRECT_EMOJI}\n${description || ''}`, GREEN)
    .setThumbnail(CORRECT_EMOJI_URL);
}

function error(title, description) {
  const message = String(description || 'Something went wrong.');
  const reason = /^reason\s*:/i.test(message) ? message : `Reason: ${message}`;
  return embed(title, `${WRONG_EMOJI}\n${reason}${supportHint()}`, RED)
    .setThumbnail(WRONG_EMOJI_URL);
}

function errorPayload(title, description, extra = {}) {
  return {
    embeds: [error(title, description)],
    components: supportComponents('Report Issue'),
    ...extra
  };
}

function premiumEmbed(title, description) {
  return embed(`💎 ${title}`, description, GOLD);
}

function royalEmbed(title, description) {
  return embed(`👑 ${title}`, description, GOLD)
    .setAuthor({ name: 'Astrix • Royal Giveaway' })
    .setFooter({ text: 'Astrix • Royal Events' });
}

function ownerEmbed(title, description) {
  return embed(`👑 ${title}`, description, GOLD);
}

function formatDuration(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`]
    .filter(Boolean)
    .join(' ');
}

// Discord rejects message content longer than 2,000 characters. Keep the
// complete response by splitting at a readable boundary instead of slicing it
// and turning a successful AI request into an "Invalid Form Body" error.
function splitMessage(text, limit = DISCORD_CONTENT_LIMIT) {
  const value = String(text ?? '');
  if (!value) return [''];

  const chunks = [];
  let remaining = value;
  while (remaining.length > limit) {
    let boundary = remaining.lastIndexOf('\n', limit);
    if (boundary < Math.floor(limit * 0.5)) boundary = remaining.lastIndexOf(' ', limit);
    const cut = boundary >= 1 ? boundary + 1 : limit;

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  chunks.push(remaining);
  return chunks;
}

async function replyLong(message, content, extra: any = {}) {
  const chunks = splitMessage(content);
  const { content: _content, ...firstOptions } = extra;
  const first = await message.reply({ ...firstOptions, content: chunks[0] });

  for (const chunk of chunks.slice(1)) {
    await message.channel.send({
      content: chunk,
      allowedMentions: extra.allowedMentions || { parse: [] }
    });
  }
  return first;
}

async function editReplyLong(interaction, content, extra: any = {}) {
  const chunks = splitMessage(content);
  const { content: _content, ...firstOptions } = extra;
  const first = await interaction.editReply({ ...firstOptions, content: chunks[0] });

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: chunk,
      allowedMentions: extra.allowedMentions || { parse: [] }
    });
  }
  return first;
}

module.exports = {
  COLOR,
  GOLD,
  RED,
  GREEN,
  CORRECT_EMOJI,
  WRONG_EMOJI,
  LYriEL_DOT_EMOJI,
  embed,
  success,
  error,
  errorPayload,
  supportUrl,
  supportHint,
  supportComponents,
  botLogo,
  premiumEmbed,
  royalEmbed,
  ownerEmbed,
  formatDuration,
  splitMessage,
  replyLong,
  editReplyLong
};
