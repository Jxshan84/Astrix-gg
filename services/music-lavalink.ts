const { LavaShark, RepeatMode } = require('lavashark');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { embed, error: errorEmbed, supportComponents } = require('./ui.ts');
const musicPresence = require('./music-presence.ts');
const store = require('./store.ts');
const { nowPlayingEmbed, formatDuration: formatMusicDuration } = require('../utils/music.ts');
const musicPresets = require('../utils/music-presets.ts');

const players = new Map();
let lavashark = null;
let client = null;
let ready = false;

function enabled() {
  return Boolean(String(
    process.env.LAVALINK_HOST ||
    process.env.LAVALINK_URL ||
    process.env.LAVALINK_URI ||
    process.env.LAVALINK_ADDRESS ||
    ''
  ).trim());
}

function errorDetails(error) {
  if (!error) return 'Unknown Lavalink error';
  if (typeof error === 'string') return error;
  let message = error.message;
  if (typeof message === 'function') {
    try { message = message.call(error); } catch {}
  }
  if (message) return String(message);
  if (error.error) return String(error.error);
  try { return JSON.stringify(error); } catch { return String(error); }
}

function nodesFromEnv() {
  const configured = String(
    process.env.LAVALINK_URL ||
    process.env.LAVALINK_URI ||
    process.env.LAVALINK_ADDRESS ||
    process.env.LAVALINK_HOST ||
    ''
  ).trim();
  if (!configured) return [];

  let hostname = configured;
  let port = Number(process.env.LAVALINK_PORT || 2333);
  let secure = String(process.env.LAVALINK_SECURE || '').toLowerCase() === 'true';
  try {
    const parsed = new URL(/^[a-z]+:\/\//i.test(configured) ? configured : `http://${configured}`);
    hostname = parsed.hostname;
    if (parsed.port) port = Number(parsed.port);
    if (parsed.protocol === 'https:' || parsed.protocol === 'wss:') secure = true;
  } catch {
    const match = configured.match(/^([^/:]+)(?::(\d+))?$/);
    if (match) {
      hostname = match[1];
      if (match[2]) port = Number(match[2]);
    }
  }

  return [{
    id: String(process.env.LAVALINK_IDENTIFIER || 'Astrix Lavalink'),
    hostname,
    port: Math.max(1, port || 2333),
    password: String(
      process.env.LAVALINK_PASSWORD ||
      process.env.LAVALINK_PASS ||
      process.env.LAVALINK_NODE_PASSWORD ||
      ''
    ),
    secure
  }];
}

function playerFor(guildId) {
  return players.get(guildId) || null;
}

function sourceLabel(track) {
  const source = String(track?.source || '').toLowerCase();
  if (source.includes('youtube')) return 'YouTube';
  if (source.includes('soundcloud')) return 'SoundCloud';
  if (source.includes('spotify')) return 'Spotify';
  if (source.includes('deezer')) return 'Deezer';
  if (source.includes('apple')) return 'Apple Music';
  return track?.source || 'Lavalink';
}

function formatDuration(ms) {
  return formatMusicDuration(ms);
}

function trackText(track) {
  if (!track) return 'Nothing is playing.';
  return `**${track.title}**\nSource: **${sourceLabel(track)}**\nDuration: **${track.isStream ? '🔴 Live Stream' : formatDuration(track.duration)}**`;
}

function controls(player) {
  const pauseEmoji = String(process.env.ASTRIX_MUSIC_PAUSE_EMOJI || '⏸️');
  const playEmoji = String(process.env.ASTRIX_MUSIC_PLAY_EMOJI || '▶️');
  return [
    new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:previous').setEmoji('⏮️').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('music:pause').setEmoji(player?.paused ? playEmoji : pauseEmoji).setLabel(player?.paused ? 'Resume' : 'Pause').setStyle(player?.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music:queue').setEmoji('📜').setLabel('Queue').setStyle(ButtonStyle.Secondary)
    ),
    equalizerComponents(player?.filterPresetCategory)
  ];
}

function equalizerComponents(categoryValue = '') {
  const category = categoryValue ? musicPresets.categoryFor(categoryValue) : null;
  if (!category) {
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('music:eq:category')
        .setPlaceholder('🎛️ Choose audio effect (Normal by default)...')
        .addOptions(musicPresets.categories.map(item => ({
          label: item.label.slice(0, 100),
          value: item.value,
          emoji: item.emoji
        })))
    );
  }

  const options = category.value === 'cat_reset'
    ? [{ label: 'Normal / Reset EQ', value: 'clear', emoji: '✨' }]
    : category.presets.map(label => ({
      label: label.slice(0, 100),
      value: `preset:${musicPresets.slug(label)}`,
      emoji: category.emoji
    }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music:eq:preset')
      .setPlaceholder(`${category.emoji} Choose a ${category.label} preset...`)
      .addOptions(options.slice(0, 25))
  );
}

async function restoreNative247(guild) {
  const config = guild247(guild.id);
  if (!config.is247 || !config.channelId || !lavashark) return;
  try {
    const channel = await nativeVoiceChannel(guild, config);
    let player = playerFor(guild.id);
    if (!player) {
      player = lavashark.createPlayer({
        guildId: guild.id,
        voiceChannelId: channel.id,
        textChannelId: config.textChannelId || null,
        selfDeaf: true,
        selfMute: false
      });
      player.node = await lavashark.bestNode();
      players.set(guild.id, player);
    } else if (player.voiceChannelId !== channel.id) player.setVoiceChannel(channel.id);
    player.is247 = true;
    if (player.state !== 1) await player.connect();
    if (config.autoplay && !player.current && !player.queue.size && config.lastTrack?.query) {
      const result = await search(config.lastTrack.query);
      const track = result.loadType === 'playlist' ? result.tracks?.[0] : result.tracks?.[0];
      if (track) {
        player.addTracks([track], { username: 'Astrix Autoplay' });
        await player.play();
      }
    }
  } catch (error) {
    console.error(`[Music] Native 24/7 restore failed for ${guild.id}:`, errorDetails(error));
  }
}

async function init(discordClient) {
  if (!enabled()) return false;
  client = discordClient;
  ready = false;
  musicPresence.init(discordClient);
  const nodes = nodesFromEnv();
  if (!nodes.length) throw new Error('Lavalink is enabled but no valid node host was configured.');
  const spotifyId = String(process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_ID || '').trim();
  const spotifySecret = String(process.env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_SECRET || '').trim();
  lavashark = new LavaShark({
    nodes,
    sendWS: (guildId, payload) => {
      const guild = client?.guilds?.cache?.get(guildId);
      guild?.shard?.send(payload);
    },
    ...(spotifyId && spotifySecret
      ? { spotify: { clientId: spotifyId, clientSecret: spotifySecret } }
      : {})
  });
  // Keep the manager available to the gateway bridge and to deployments that
  // wrap the Lavalink client on the Discord client object.
  client.lavashark = lavashark;
  lavashark.on('nodeConnect', node => {
    ready = true;
    console.log(`[Music] Lavalink connected: ${node.options?.identifier || node.options?.id || 'node'}`);
    for (const guild of client?.guilds?.cache?.values?.() || []) void restoreNative247(guild);
  });
  lavashark.on('nodeDisconnect', (_node, code, reason) => {
    ready = false;
    console.warn(`[Music] Lavalink disconnected (${code}): ${reason || 'unknown reason'}`);
  });
  lavashark.on('error', (node, error) => {
    ready = false;
    console.error(
      `[Music] Lavalink error (${node?.identifier || node?.options?.id || 'node'}):`,
      errorDetails(error || node)
    );
  });
  lavashark.on('trackException', (_player, _track, exception) => console.warn('[Music] Track exception:', errorDetails(exception)));
  lavashark.on('trackStart', (player, track) => {
    player.is247 = Boolean(guild247(player.guildId).is247);
    const config = guild247(player.guildId);
    config.lastTrack = {
      title: track?.title || 'Astrix Track',
      uri: track?.uri || track?.url || null,
      url: track?.uri || track?.url || null,
      source: track?.source || 'Lavalink',
      duration: track?.duration?.value ?? track?.duration ?? 0,
      isStream: Boolean(track?.isStream),
      query: track?.title || ''
    };
    if (config.is247) store.save();
    musicPresence.setTrack(player.guildId, {
      ...track,
      channelId: player.voiceChannelId
    });
  });
  lavashark.on('trackEnd', player => musicPresence.clearTrack(player.guildId));
  lavashark.on('queueEnd', player => {
    const config = guild247(player.guildId);
    // queueEnd/playerEmpty is a playback event, not a reason to disconnect a
    // native 24/7 player. The normal auto-leave path is explicitly bypassed.
    player.is247 = Boolean(config.is247);
    musicPresence.clearTrack(player.guildId);
  });
  lavashark.on('playerDestroy', player => {
    musicPresence.clearTrack(player.guildId);
    if (players.get(player.guildId) === player) players.delete(player.guildId);
    const config = guild247(player.guildId);
    if (config.is247 && client?.guilds?.cache?.get(player.guildId)) {
      setTimeout(() => restoreNative247(client.guilds.cache.get(player.guildId)), 1500).unref?.();
    }
  });

  // LavaShark does not connect automatically when it is constructed. It also
  // needs Discord's raw voice gateway packets to complete the voice handshake.
  if (!client?.user?.id) throw new Error('Discord client is not ready for Lavalink startup.');
  lavashark.start(client.user.id);
  if (!client.astrixLavalinkRawListener) {
    client.astrixLavalinkRawListener = packet => {
      try {
        if (client.lavashark && typeof client.lavashark.handleVoiceUpdate === 'function') {
          return client.lavashark.handleVoiceUpdate(packet);
        }
        if (client.manager && typeof client.manager.updateVoiceState === 'function') {
          return client.manager.updateVoiceState(packet);
        }
      } catch (error) {
        console.error('[Music] Voice packet forwarding failed:', errorDetails(error));
      }
    };
    client.on('raw', client.astrixLavalinkRawListener);
  }
  console.log(`[Music] Lavalink startup requested for ${nodes.map(node => `${node.hostname}:${node.port}`).join(', ')}`);
  return true;
}

function voice(interaction) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) throw new Error('Join a voice channel first.');
  return channel;
}

function isReady() {
  return Boolean(ready && lavashark);
}

async function getOrCreatePlayer(interaction) {
  if (!lavashark) throw new Error('Lavalink is not initialized. Check the Lavalink environment variables.');
  const guildId = interaction.guildId;
  const config = guild247(guildId);
  const channel = voice(interaction);
  let player = playerFor(guildId);
  if (!player) {
    const node = await lavashark.bestNode();
    player = lavashark.createPlayer({
      guildId,
      voiceChannelId: channel.id,
      textChannelId: interaction.channelId,
      selfDeaf: true,
      selfMute: false
    });
    // LavaShark's Player assigns asynchronously in its constructor. Assigning
    // the already-connected node here prevents the first play request from
    // silently updating a player whose node is still undefined.
    player.node = node;
    players.set(guildId, player);
  } else if (player.voiceChannelId !== channel.id) {
    player.setVoiceChannel(channel.id);
  }
  player.is247 = Boolean(config.is247);
  if (player.state !== 1) await player.connect();
  return player;
}

async function search(query) {
  const result = await lavashark.search(String(query || '').trim());
  if (result.loadType === 'empty') throw new Error('No playable result was found.');
  if (result.loadType === 'error') throw new Error(result.exception?.message || 'Lavalink could not load that source.');
  return result;
}

function guild247(guildId) {
  const config = store.guild(guildId).music247;
  config.is247 = Boolean(config.is247 ?? config.enabled);
  config.enabled = Boolean(config.enabled || config.is247);
  return config;
}

async function nativeVoiceChannel(guild, config) {
  const channel = guild?.channels?.cache?.get(config.channelId)
    || await guild?.channels?.fetch?.(config.channelId).catch?.(() => null);
  if (!channel?.isVoiceBased?.()) throw new Error('Set a voice channel first with **/music247 setup**.');
  return channel;
}

async function applyFilter(player, preset) {
  const selected = musicPresets.presetFor(preset);
  if (!selected) throw new Error('Choose a valid Astrix audio preset from the Now Playing menu.');
  await player.filters.set(musicPresets.payloadFor(selected.label));
  player.filterPreset = selected.label;
  player.filterPresetCategory = selected.category;
  return selected;
}

async function action(interaction, name) {
  if (name === 'music247') {
    const sub = interaction.options.getSubcommand();
    const config = guild247(interaction.guildId);
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      if (!channel.isVoiceBased?.()) throw new Error('Choose a voice channel for 24/7 mode.');
      config.channelId = channel.id;
      config.textChannelId = interaction.channelId;
      store.save();
      return interaction.reply({ embeds: [embed('🎧 24/7 Voice Channel Set', `Astrix will use <#${channel.id}> when native 24/7 mode is enabled.`)] });
    }
    if (sub === 'enable' || sub === 'toggle' && !config.is247) {
      if (!config.channelId) throw new Error('Set a voice channel first with **/music247 setup**.');
      config.enabled = true; config.is247 = true; config.enabledBy = interaction.user.id; config.textChannelId = interaction.channelId;
      store.save();
      const channel = await nativeVoiceChannel(interaction.guild, config);
      const player = await getOrCreatePlayer({ ...interaction, member: { ...interaction.member, voice: { channel } } });
      player.is247 = true;
      return interaction.reply({ embeds: [embed('🟢 Native 24/7 Enabled', `Astrix will remain connected to <#${channel.id}> through Lavalink persistence.`)] });
    }
    if (sub === 'disable' || sub === 'toggle') {
      config.enabled = false; config.is247 = false; store.save();
      const player = playerFor(interaction.guildId);
      if (player) { player.is247 = false; player.destroy(); players.delete(interaction.guildId); }
      return interaction.reply({ embeds: [embed('🔴 24/7 Disabled', 'Native 24/7 persistence is disabled and the voice connection was released.')] });
    }
    if (sub === 'autoplay') {
      config.autoplay = interaction.options.getBoolean('enabled', true); store.save();
      return interaction.reply({ embeds: [embed('🎶 Autoplay Updated', `Native 24/7 autoplay is now **${config.autoplay ? 'ON' : 'OFF'}**.`)] });
    }
    return interaction.reply({ embeds: [embed('🎧 24/7 Music Status', `Status: **${config.is247 ? 'ENABLED' : 'DISABLED'}**\nVoice channel: ${config.channelId ? `<#${config.channelId}>` : 'Not configured'}\nAutoplay: **${config.autoplay ? 'ON' : 'OFF'}**\nConnected: **${playerFor(interaction.guildId) ? 'Yes' : 'No'}**`)] });
  }
  if (name === 'filter') {
    const player = playerFor(interaction.guildId);
    if (!player) throw new Error('Start playback before applying an audio filter.');
    const preset = interaction.options.getString('preset', true);
    const selected = await applyFilter(player, preset);
    return interaction.reply({ embeds: [embed('🎛️ Audio Filter', `Applied **${selected.label}**.`)] });
  }
  if (name === 'play') {
    const query = interaction.options.getString('query', true);
    await interaction.deferReply();
    try {
      const player = await getOrCreatePlayer(interaction);
      const result = await search(query);
      const tracks = result.loadType === 'playlist' ? result.tracks : [result.tracks[0]];
      const usable = tracks.filter(Boolean);
      if (!usable.length) throw new Error('No playable track was found.');
      const wasPlaying = player.playing || Boolean(player.current);
      player.addTracks(usable, interaction.user);
      if (!player.playing && !player.paused) await player.play();
      const first = usable[0];
      return interaction.editReply({
        embeds: [embed(result.loadType === 'playlist' ? '🎶 Playlist Added' : wasPlaying ? '🎶 Added to Queue' : '🎵 Music Started',
          `${trackText(first)}\n${result.loadType === 'playlist' ? `Tracks added: **${usable.length}**` : wasPlaying ? `Queue position: **${player.queue.size}**` : 'Playing now.'}`)],
        components: controls(player)
      });
    } catch (error) {
      const raw = String(error?.message || error);
      const message = /no connected nodes/i.test(raw)
        ? 'The Lavalink node is not connected yet. Check its host, port, password, secure setting, and Lavalink logs, then try `/play` again.'
        : raw;
      return interaction.editReply({ embeds: [errorEmbed('Music Error', message)], components: supportComponents('Report Music Issue') });
    }
  }

  const player = playerFor(interaction.guildId);
  if (!player || (!player.current && !player.queue.size)) throw new Error('There is no active music queue.');

  if (name === 'pause') {
    await player.pause(!player.paused);
    musicPresence.setPaused(interaction.guildId, player.paused);
    return interaction.reply({ embeds: [embed('Music', player.paused ? 'Playback paused.' : 'Playback resumed.')] });
  }
  if (name === 'resume') {
    await player.resume();
    return interaction.reply({ embeds: [embed('Music', 'Playback resumed.')] });
  }
  if (name === 'skip') {
    await player.skip();
    return interaction.reply({ embeds: [embed('Music', 'Skipped the current track.')] });
  }
  if (name === 'stop' || name === 'disconnect') {
    if (player.is247) return interaction.reply({ content: 'Astrix is protected by native 24/7 mode. Use `/music247 disable` first.', ephemeral: true });
    player.destroy();
    players.delete(interaction.guildId);
    return interaction.reply({ embeds: [embed('Music Stopped', 'Queue cleared and voice connection closed.')] });
  }
  if (name === 'volume') {
    const volume = interaction.options.getInteger('percent', true);
    await player.filters.setVolume(volume);
    return interaction.reply({ embeds: [embed('Volume', `Set to **${volume}%**.`)] });
  }
  if (name === 'loop') {
    const mode = interaction.options.getString('mode', true);
    player.setRepeatMode(mode === 'track' ? RepeatMode.TRACK : mode === 'queue' ? RepeatMode.QUEUE : RepeatMode.OFF);
    return interaction.reply({ embeds: [embed('Loop Mode', `Set to **${mode}**.`)] });
  }
  if (name === 'queue') {
    const list = player.queue.tracks.slice(0, 15).map((track, index) => `${index + 1}. ${track.title}`).join('\n') || 'No upcoming tracks.';
    return interaction.reply({ embeds: [embed('🎶 Music Queue', `**Now:** ${player.current?.title || 'Nothing'}\n\n${list}`)] });
  }
  if (name === 'nowplaying') {
    return interaction.reply({ embeds: [nowPlayingEmbed(player.current, { volume: player.volume || 100, equalizer: player.filterPreset || 'Clear' })], components: controls(player) });
  }
}

async function button(interaction, actionName) {
  const player = playerFor(interaction.guildId);
  if (!player) return interaction.reply({ content: 'No active music queue.', ephemeral: true });
  if (actionName === 'pause') {
    await player.pause(!player.paused);
    musicPresence.setPaused(interaction.guildId, player.paused);
    return interaction.update({ components: controls(player) });
  }
  if (actionName === 'skip') {
    await player.skip();
    return interaction.reply({ content: '⏭ Skipped.', ephemeral: true });
  }
  if (actionName === 'stop' || actionName === 'disconnect') {
    if (player.is247) return interaction.reply({ content: 'Astrix is protected by native 24/7 mode. Use `/music247 disable` first.', ephemeral: true });
    player.destroy();
    players.delete(interaction.guildId);
    return interaction.update({ components: [] });
  }
  if (actionName === 'queue') {
    const list = player.queue.tracks.slice(0, 15).map((track, index) => `${index + 1}. ${track.title}`).join('\n') || 'No upcoming tracks.';
    return interaction.reply({ content: `**Now:** ${player.current?.title || 'Nothing'}\n\n${list}`, ephemeral: true });
  }
  return interaction.reply({ content: 'This control is unavailable in Lavalink mode.', ephemeral: true });
}

async function select(interaction) {
  const player = playerFor(interaction.guildId);
  if (!player) return interaction.reply({ content: 'Start playback before choosing an audio effect.', ephemeral: true });
  if (interaction.customId === 'music:eq:category') {
    const category = musicPresets.categoryFor(interaction.values?.[0]);
    player.filterPresetCategory = category.value;
    return interaction.update({ components: controls(player) });
  }
  if (interaction.customId === 'music:eq:preset') {
    const selected = await applyFilter(player, interaction.values?.[0]);
    player.filterPresetCategory = '';
    await interaction.update({ components: controls(player) });
    return interaction.followUp({ content: `🎛️ Applied **${selected.label}** to the current player.`, ephemeral: true });
  }
}

module.exports = { enabled, isReady, init, action, button, select, players };