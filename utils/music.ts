const { EmbedBuilder } = require('discord.js');
const { boldSans } = require('./unicode.ts');
const NOIR = 0x2B2D31;
const VINYL_GIF = 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif';
function durationValue(duration: any) {
  if (duration && typeof duration === 'object') return Number(duration.value ?? duration.ms ?? duration.milliseconds ?? 0);
  return Number(duration || 0);
}
function formatDuration(duration: any) {
  if (typeof duration === 'string' && /live|stream/i.test(duration)) return '🔴 Live Stream';
  const ms = durationValue(duration);
  if (!Number.isFinite(ms) || ms <= 0) return '🔴 Live Stream';
  const total = Math.floor(ms / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ''}${hours ? String(minutes).padStart(2, '0') : minutes}:${String(seconds).padStart(2, '0')}`;
}
function sourceLabel(track: any) {
  const source = String(track?.sourceName || track?.source || track?.platform || 'Unknown');
  return source.toLowerCase().includes('youtube') ? 'YouTube' : source[0]?.toUpperCase() + source.slice(1);
}
function requesterLabel(track: any) {
  const requester = track?.requester;
  if (!requester) return 'Astrix';
  if (typeof requester === 'string') return requester;
  return requester.globalName || requester.username || requester.tag || 'Astrix';
}
function nowPlayingEmbed(track: any, state: any = {}) {
  const title = String(track?.title || 'Nothing is playing.');
  const artist = track?.author || track?.artist || track?.channel || 'Unknown Artist / Channel';
  const thumbnail = track?.thumbnail || track?.artworkUrl || null;
  const rawDuration = track?.duration ?? track?.info?.length ?? track?.length;
  const duration = track?.isStream ? '🔴 Live Stream' : formatDuration(rawDuration);
  const equalizer = state.equalizer || track?.equalizer || 'Clear';
  const titleUrl = track?.uri || track?.url || null;
  const discEmoji = String(process.env.ASTRIX_MUSIC_DISC_EMOJI || '💿');
  const linkedTitle = title.slice(0, 256);
  const messageEmbed = new EmbedBuilder().setColor(NOIR)
    .setAuthor({ name: `${discEmoji} Astrix Music` })
    .setTitle(linkedTitle)
    .setDescription(`🎶 ${boldSans('NOW PLAYING')}`)
    .setThumbnail(VINYL_GIF)
    .addFields(
      { name: '👤 Artist / Channel', value: String(artist).slice(0, 1024), inline: true },
      { name: '⏱️ Duration', value: duration, inline: true },
      { name: '🔊 Volume', value: `${Number(state.volume ?? 100)}%`, inline: true },
      { name: '🎛️ Equalizer', value: String(equalizer).slice(0, 1024), inline: true },
      { name: '🎧 Requested By', value: requesterLabel(track).slice(0, 1024), inline: true }
    ).setFooter({ text: 'Astrix • High-Fidelity Audio' });
  if (/^https?:\/\//i.test(String(titleUrl || ''))) messageEmbed.setURL(titleUrl);
  if (/^https?:\/\//i.test(String(thumbnail || ''))) messageEmbed.setImage(thumbnail);
  return messageEmbed;
}
module.exports = { NOIR, VINYL_GIF, durationValue, formatDuration, sourceLabel, nowPlayingEmbed };