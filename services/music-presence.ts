const { ActivityType } = require('discord.js');
const { boldSans } = require('../utils/unicode.ts');

let client = null;
let sequence = 0;
const activeTracks = new Map();
const statusWrites = new Map();
const channelStatuses = new Map();

function cleanTitle(track) {
  const title = String(track?.title || 'Astrix Music')
    .replace(/\s+/g, ' ')
    .trim();
  return title.slice(0, 120) || 'Astrix Music';
}

function currentTrack() {
  let latest = null;
  for (const value of activeTracks.values()) {
    if (!latest || value.sequence > latest.sequence) latest = value;
  }
  return latest;
}

function writeVoiceStatus(channelId, status) {
  if (!client?.rest || !channelId) return;
  const id = String(channelId);
  const nextStatus = status || '';
  if (channelStatuses.get(id) === nextStatus) return;
  channelStatuses.set(id, nextStatus);

  const previous = statusWrites.get(id) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => client.rest.put(`/channels/${id}/voice-status`, {
      body: { status: nextStatus }
    }))
    .catch(() => {});
  statusWrites.set(id, next);
  void next.finally(() => {
    if (statusWrites.get(id) === next) statusWrites.delete(id);
  });
}

function sync() {
  if (!client?.user) return;
  const active = currentTrack();
  client.user.setPresence({
    status: 'online',
    activities: active
      ? [{
        name: `🎶 ${boldSans('Now Streaming')}: ${boldSans(cleanTitle(active.track))}`.slice(0, 128),
        type: ActivityType.Streaming,
        url: String(process.env.ASTRIX_STREAMING_URL || process.env.STREAMING_URL || 'https://www.twitch.tv/astrix').trim()
      }]
      : []
  });
}

function init(nextClient) {
  client = nextClient || client;
  sync();
}

function setTrack(guildId, track) {
  if (!guildId || !track) return;
  const id = String(guildId);
  const previous = activeTracks.get(id);
  if (previous?.channelId && previous.channelId !== track.channelId) {
    writeVoiceStatus(previous.channelId, null);
  }
  const channelId = track.channelId || null;
  activeTracks.set(id, { track, channelId, sequence: ++sequence });
  writeVoiceStatus(channelId, `🎵 ${boldSans('Now Streaming')}: ${boldSans(cleanTitle(track))}`.slice(0, 120));
  sync();
}

function clearTrack(guildId) {
  if (guildId) {
    const id = String(guildId);
    const previous = activeTracks.get(id);
    activeTracks.delete(id);
    writeVoiceStatus(previous?.channelId, null);
  } else {
    for (const previous of activeTracks.values()) writeVoiceStatus(previous.channelId, null);
    activeTracks.clear();
  }
  sync();
}

function getActivity() {
  const active = currentTrack();
  return active ? { name: cleanTitle(active.track), type: ActivityType.Streaming } : null;
}

function setPaused(guildId, paused) {
  const current = activeTracks.get(String(guildId));
    if (current?.channelId) writeVoiceStatus(
      current.channelId,
      paused ? `⏸ ${boldSans('PAUSED')}` : `🎵 ${boldSans('Now Streaming')}: ${boldSans(cleanTitle(current.track))}`
    );
}

module.exports = { init, setTrack, setPaused, clearTrack, getActivity };