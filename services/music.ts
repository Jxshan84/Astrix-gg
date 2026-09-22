const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  StreamType
} = require('@discordjs/voice');
const { Readable } = require('node:stream');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const ffmpegPath = require('ffmpeg-static');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');
const { embed, error: errorEmbed, supportComponents } = require('./ui.ts');
const store = require('./store.ts');
const premiumService = require('./premium.ts');
const { nowPlayingEmbed: buildNowPlayingEmbed } = require('../utils/music.ts');
const lavalinkMusic = require('./music-lavalink.ts');
const musicPresence = require('./music-presence.ts');

const queues = new Map();
const DAILY_RESET_MS = 24 * 60 * 60 * 1000;
const DISCONNECT_PROTECTION_MESSAGE = 'This is a 24/7 server. I cannot leave this voice channel.';
const TIMEOUT = Math.max(8000, Number(process.env.MUSIC_TIMEOUT_MS || 20000));
const SEARCH_CANDIDATES = Math.max(2, Math.min(10, Number(process.env.MUSIC_SEARCH_CANDIDATES || 5)));
const STREAM_RETRIES = Math.max(0, Math.min(3, Number(process.env.MUSIC_STREAM_RETRIES || 2)));
const STREAM_RETRY_DELAY = Math.max(250, Math.min(5000, Number(process.env.MUSIC_STREAM_RETRY_DELAY_MS || 750)));
const PRIMARY_SOURCE = 'soundcloud';
const bundledYtDlp = path.resolve(__dirname, '../bin/yt-dlp');
const YTDLP_PATH = String(
  process.env.YTDLP_PATH || (fs.existsSync(bundledYtDlp) ? bundledYtDlp : 'yt-dlp')
);
// Optional browser-exported cookies can restore YouTube playback on hosts
// where anonymous requests are challenged. The file stays local to the bot;
// no credential is stored in the source tree.
const YTDLP_COOKIES_FILE = String(process.env.YTDLP_COOKIES_FILE || '').trim();
// YouTube changes which anonymous player clients are accepted fairly often.
// Keep the configured value first, then try clients that work on datacenter
// hosts instead of failing every search/play request after one blocked client.
function normalizeExtractorArgs(value) {
  const text = String(value || '').trim();
  // yt-dlp requires IE_KEY:ARGS. In particular, never pass an empty string
  // after --extractor-args; yt-dlp treats that as a malformed argument.
  return /^[^:\s]+:.+$/.test(text) ? text : '';
}

const YTDLP_EXTRACTOR_ARGS = normalizeExtractorArgs(process.env.YTDLP_EXTRACTOR_ARGS)
  || 'youtube:player_client=web_safari';
const YTDLP_EXTRACTOR_FALLBACKS = [
  YTDLP_EXTRACTOR_ARGS,
  'youtube:player_client=android_vr',
  'youtube:player_client=android_music',
  'youtube:player_client=ios',
  'youtube:player_client=tv',
  'youtube:player_client=web_embedded',
  'youtube:player_client=web_creator',
  'youtube:player_client=mweb',
].filter((value, index, values) => values.indexOf(value) === index);

function music247Config(guildId) {
  const config = store.guild(guildId).music247;
  config.is247 = Boolean(config.is247 ?? config.enabled);
  config.enabled = Boolean(config.enabled);
  config.autoplay = Boolean(config.autoplay);
  config.channelId ||= null;
  config.textChannelId ||= null;
  config.enabledBy ||= null;
  config.lastResetDay ||= '';
  if (config.lastTrack && typeof config.lastTrack !== 'object') config.lastTrack = null;
  return config;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function has247Entitlement(guildId, guild, config = music247Config(guildId)) {
  if (!config.enabledBy) return false;
  return premiumService.tierFor(guildId, config.enabledBy, guild) !== 'free';
}

function isVoiceChannel(channel) {
  return Boolean(channel?.isVoiceBased?.());
}

async function fetchGuildChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  return guild.channels.cache.get(channelId) || guild.channels.fetch(channelId).catch(() => null);
}

async function configuredVoiceChannel(guild, config = music247Config(guild.id)) {
  const channel = await fetchGuildChannel(guild, config.channelId);
  if (!isVoiceChannel(channel)) throw new Error('The configured 24/7 voice channel no longer exists. Run `/music247 setup` again.');
  const me = guild.members?.me;
  const permissions = me ? channel.permissionsFor(me) : null;
  if (permissions && (!permissions.has(PermissionsBitField.Flags.ViewChannel) || !permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak))) {
    throw new Error('Astrix needs View Channel, Connect and Speak permissions in the configured 24/7 voice channel.');
  }
  return channel;
}

async function configuredTextChannel(guild, config = music247Config(guild.id)) {
  const channel = await fetchGuildChannel(guild, config.textChannelId);
  return channel?.isTextBased?.() ? channel : null;
}

function timeout(promise, ms = TIMEOUT, label = 'Music request') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

function friendlyMusicError(error) {
  const raw = String(error?.message || error || 'Unknown music error').replace(/\s+/g, ' ').trim();
  const text = raw.toLowerCase();

  if (text.includes('sign in to confirm') || text.includes('not a bot') || text.includes('youtube playback is disabled')) {
    return 'YouTube is blocking automated playback on this host. Try another YouTube result or URL.';
  }
  if (text.includes('timed out') || text.includes('timeout')) {
    return 'The music source took too long to respond. Please try again.';
  }
  if (text.includes('403') || text.includes('forbidden')) {
    return 'The music source refused this stream. Try another track or source.';
  }
  if (text.includes('429') || text.includes('too many requests')) {
    return 'The music source is rate-limiting requests right now. Please wait a little and try again.';
  }
  if (text.includes('404')) {
    return 'The music source returned an expired or unavailable stream. Astrix refreshed the source automatically, but this track still could not be played. Try another result.';
  }
  if (text.includes('enotfound') || text.includes('econnreset') || text.includes('fetch failed') || text.includes('network')) {
    return 'The music source could not be reached. Check the host network and try again.';
  }
  if (text.includes('no track') || text.includes('not found')) {
    return 'No matching track was found. Try a more specific song name.';
  }
  if (text.includes('connect and speak') || text.includes('voice channel first')) return raw;

  return `Track could not be played. ${raw.slice(0, 180)}`;
}

function clientIdFromText(text) {
  const patterns = [
    /client_id["']?\s*[:=]\s*["']([a-zA-Z0-9_-]{20,64})["']/i,
    /client_id=([a-zA-Z0-9_-]{20,64})/i
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function requireManager(interaction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    throw new Error('You need the **Manage Server** permission to configure native 24/7 music.');
  }
}

function runYtDlp(args, { collect = true, extractorArgs = YTDLP_EXTRACTOR_ARGS } = {}) {
  return new Promise((resolve, reject) => {
    const normalizedExtractorArgs = normalizeExtractorArgs(extractorArgs);
    const extractorOptions = normalizedExtractorArgs
      ? ['--extractor-args', normalizedExtractorArgs]
      : [];
    const cookieOptions = YTDLP_COOKIES_FILE && fs.existsSync(YTDLP_COOKIES_FILE)
      ? ['--cookies', YTDLP_COOKIES_FILE]
      : [];
    const child = spawn(YTDLP_PATH, [
      '--no-warnings',
      '--no-playlist',
      ...cookieOptions,
      ...extractorOptions,
      ...args
    ], { stdio: [ 'ignore', 'pipe', 'pipe' ] });
    const output = [];
    const errors = [];
    child.stdout.on('data', chunk => { if (collect) output.push(chunk); });
    child.stderr.on('data', chunk => errors.push(chunk));
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) return resolve(Buffer.concat(output).toString('utf8'));
      reject(new Error(errors.join('').trim() || `yt-dlp exited with code ${code}.`));
    });
  });
}

async function soundcloudJson(input) {
  let lastError;
  // SoundCloud does not use YouTube extractor clients, but repeating the
  // metadata request gives transient CDN/rate-limit failures a second chance.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await timeout(runYtDlp([
        '--dump-single-json',
        '--skip-download',
        '--socket-timeout', String(Math.ceil(TIMEOUT / 1000)),
        input
      ], { extractorArgs: '' }), TIMEOUT, 'SoundCloud metadata');
      return JSON.parse(raw);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError || new Error('SoundCloud metadata could not be loaded.');
}

function youtubeTrack(info, fallbackTitle = 'YouTube Track') {
  const id = info?.id || info?.url;
  const url = info?.webpage_url || info?.original_url ||
    (id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null);
  if (!url) throw new Error('YouTube did not return a playable video URL.');
  return {
    title: info?.title || fallbackTitle,
    url,
    duration: Number(info?.duration || 0),
    source: 'YouTube',
    thumbnail: info?.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null)
  };
}

function soundcloudTrack(info, fallbackTitle = 'SoundCloud Track') {
  const url = info?.webpage_url || info?.original_url || info?.url;
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('SoundCloud did not return a playable track URL.');
  }
  return {
    title: info?.track || info?.title || fallbackTitle,
    url,
    duration: Number(info?.duration || 0) / 1000,
    source: 'SoundCloud',
    thumbnail: info?.thumbnail || info?.artwork_url || null
  };
}

async function ytDlpStream(url, extractorArgs = YTDLP_EXTRACTOR_ARGS) {
  const normalizedExtractorArgs = normalizeExtractorArgs(extractorArgs);
  const extractorOptions = normalizedExtractorArgs
    ? ['--extractor-args', normalizedExtractorArgs]
    : [];
  const cookieOptions = YTDLP_COOKIES_FILE && fs.existsSync(YTDLP_COOKIES_FILE)
    ? ['--cookies', YTDLP_COOKIES_FILE]
    : [];
  const downloader = spawn(YTDLP_PATH, [
    '--no-warnings',
    '--no-playlist',
    '--quiet',
    ...cookieOptions,
    '--retries', '2',
    '--fragment-retries', '2',
    '--socket-timeout', String(Math.ceil(TIMEOUT / 1000)),
    '--format', 'bestaudio/best',
    '--output', '-',
    ...extractorOptions,
    url
  ], { stdio: [ 'ignore', 'pipe', 'pipe' ] });
  const transcoder = spawn(ffmpegPath && fs.existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn',
    '-c:a', 'libopus',
    '-ar', '48000',
    '-ac', '2',
    '-f', 'ogg',
    'pipe:1'
  ], { stdio: [ 'pipe', 'pipe', 'pipe' ] });

  let downloadError = '';
  let transcodeError = '';
  downloader.stderr.on('data', chunk => { downloadError += chunk.toString(); });
  transcoder.stderr.on('data', chunk => { transcodeError += chunk.toString(); });
  downloader.stdout.pipe(transcoder.stdin);

  const failStream = (error) => {
    if (!transcoder.stdout.destroyed) transcoder.stdout.destroy(error);
    try { downloader.kill('SIGKILL'); } catch {}
    try { transcoder.kill('SIGKILL'); } catch {}
  };

  downloader.once('error', error => failStream(error));
  downloader.once('close', code => {
    if (code !== 0) {
      failStream(new Error(downloadError.trim() || `yt-dlp exited with code ${code}.`));
    } else {
      transcoder.stdin.end();
    }
  });
  transcoder.once('error', error => failStream(error));
  transcoder.once('close', code => {
    if (code !== 0 && !transcoder.stdout.destroyed) {
      transcoder.stdout.destroy(new Error(transcodeError.trim() || `FFmpeg exited with code ${code}.`));
    }
  });

  return { stream: transcoder.stdout, type: StreamType.OggOpus };
}

function active247(queue, config = music247Config(queue?.guildId)) {
  return Boolean(queue?.stay247 && config.enabled && config.channelId);
}

async function restoreAutoplaySeed(queue, guild, config = music247Config(queue.guildId)) {
  if (!queue.autoplay || queue.current || queue.tracks.length || !config.lastTrack) return false;
  const seed = config.lastTrack;
  try {
    const track = await resolve(seed.query || seed.title);
    track.query = seed.query || seed.title;
    await start(queue, track);
    return true;
  } catch (error) {
    await notify(queue, {
      embeds: [errorEmbed('Autoplay Waiting', `Astrix is connected to the protected 24/7 channel, but the saved autoplay seed could not be played yet.\n${friendlyMusicError(error)}`)]
    });
    return false;
  }
}

async function reconnect247(guild, reason = 'reconnect') {
  if (!guild?.id) return null;
  const config = music247Config(guild.id);
  if (!config.enabled || !config.channelId) return null;
  if (!has247Entitlement(guild.id, guild, config)) {
    config.enabled = false;
    store.save();
    const existing = queues.get(guild.id);
    if (existing) {
      existing.stay247 = false;
      destroyQueue(existing, guild.id, { force: true });
    }
    return null;
  }

  const queue = q(guild.id);
  queue.stay247 = true;
  queue.autoplay = Boolean(config.autoplay);
  await setQueueTextChannel(queue, guild);
  const channel = await configuredVoiceChannel(guild, config);
  await connect(queue, channel);
  config.lastResetDay = utcDay();
  store.save();
  await restoreAutoplaySeed(queue, guild, config);

  if (reason === 'daily') {
    await notify(queue, {
      embeds: [embed('🔄 24/7 Daily Reset', 'Astrix refreshed the protected voice connection and will continue playing in this server.')],
      components: controls(queue)
    });
  }
  return queue;
}

async function init(client = null) {
  if (client) musicPresence.init(client);
  try {
    await lavalinkMusic.init(client);
    if (client) {
      for (const guild of client.guilds.cache.values()) {
        const config = music247Config(guild.id);
        if (lavalinkMusic.enabled() || !config.enabled || !config.channelId) continue;
        await reconnect247(guild, 'startup').catch(error => console.error(`24/7 startup for ${guild.id}:`, error.message));
      }
    }
    return true;
  } catch (error) {
    console.warn(friendlyMusicError(error));
    return false;
  }
}

function voice(interaction) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) throw new Error('Join a voice channel first.');

  const me = interaction.guild?.members?.me;
  if (me) {
    const permissions = channel.permissionsFor(me);
    if (!permissions?.has(PermissionsBitField.Flags.ViewChannel) ||
        !permissions.has(PermissionsBitField.Flags.Connect) ||
        !permissions.has(PermissionsBitField.Flags.Speak)) {
      throw new Error('I need View Channel, Connect and Speak permissions in your voice channel.');
    }
  }
  return channel;
}

function notify(queue, payload) {
  return queue.textChannel?.send?.(payload).catch(() => {});
}

function persistQueue(queue) {
  if (!queue?.guildId) return;
  const config = music247Config(queue.guildId);
  if (!queue.stay247 && !config.enabled) return;
  config.enabled = Boolean(queue.stay247);
  config.is247 = config.enabled;
  config.channelId = queue.channelId || config.channelId;
  config.textChannelId = queue.textChannel?.id || config.textChannelId;
  config.autoplay = Boolean(queue.autoplay);
  if (queue.current?.url) {
    config.lastTrack = {
      title: queue.current.title || 'Astrix Track',
      url: queue.current.url,
      source: queue.current.source || 'Unknown',
      query: queue.current.query || queue.current.title || '',
      thumbnail: queue.current.thumbnail || null
    };
  }
  store.save();
}

function destroyQueue(queue, guildId, { force = false } = {}) {
  if (queue?.stay247 && !force) return false;
  musicPresence.clearTrack(guildId || queue?.guildId);
  queue.tracks = [];
  queue.current = null;
  queue.resource = null;
  try { queue.player.stop(true); } catch {}
  try { queue.connection?.destroy(); } catch {}
  queue.connection = null;
  if (guildId) queues.delete(guildId);
  return true;
}

function q(guildId) {
  if (queues.has(guildId)) return queues.get(guildId);

  const config = music247Config(guildId);
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
  const queue = {
    guildId,
    player,
    connection: null,
    channelId: config.channelId,
    tracks: [],
    current: null,
    resource: null,
    volume: 80,
    loop: 'off',
    autoplay: Boolean(config.autoplay),
    textChannel: null,
    history: [],
    stay247: Boolean(config.is247 || config.enabled),
    filterPreset: 'Clear',
    recoveryPromise: null,
    reconnectPromise: null
  };

  player.on(AudioPlayerStatus.Idle, () => {
    if (queue.recoveryPromise) return;
    queue.recoveryPromise = next(queue)
      .catch(error => notify(queue, { embeds: [errorEmbed('Music Error', friendlyMusicError(error))], components: supportComponents('Report Music Issue') }))
      .finally(() => { queue.recoveryPromise = null; });
  });

  player.on('error', error => {
    console.warn('Music player error:', error.message);
    if (queue.recoveryPromise) return;
    queue.recoveryPromise = recoverPlayback(queue, error)
      .catch(recoveryError => notify(queue, { embeds: [errorEmbed('Music Error', friendlyMusicError(recoveryError))], components: supportComponents('Report Music Issue') }))
      .finally(() => { queue.recoveryPromise = null; });
  });

  queues.set(guildId, queue);
  return queue;
}

async function setQueueTextChannel(queue, guild) {
  if (queue.textChannel?.isTextBased?.()) return queue.textChannel;
  const channel = await configuredTextChannel(guild);
  if (channel) queue.textChannel = channel;
  return queue.textChannel;
}

async function connect(queue, channel) {
  let connection = getVoiceConnection(channel.guild.id);
  const botVoiceChannelId = channel.guild.members?.me?.voice?.channelId || null;
  const connectionChannelId = connection?.joinConfig?.channelId || null;
  const connectionIsUsable = connection &&
    connection.state?.status !== VoiceConnectionStatus.Destroyed &&
    connection.state?.status !== VoiceConnectionStatus.Disconnected;

  // Do not reuse a stale connection or a connection that points at another
  // channel. Reusing one here can make the player start while Discord never
  // finishes the new voice join.
  if (!connectionIsUsable || queue.channelId !== channel.id || botVoiceChannelId !== channel.id || connectionChannelId !== channel.id) {
    try { connection?.destroy(); } catch {}
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });
  }

  queue.connection = connection;
  queue.channelId = channel.id;
  await timeout(entersState(connection, VoiceConnectionStatus.Ready, 15000), 16000, 'Voice connection');
  connection.subscribe(queue.player);
  queue.connection = connection;
  queue.channelId = channel.id;
  persistQueue(queue);
}

function nowPlayingEmbed(track, queue) {
  return buildNowPlayingEmbed(track, { volume: queue.volume, equalizer: queue.filterPreset || 'Clear' });
}

async function resolve(query) {
  const input = String(query || '').trim();
  if (!input) throw new Error('Enter a song name or supported audio URL.');

  if (/(?:youtube\.com|youtu\.be)/i.test(input)) {
    throw new Error('YouTube has been removed from Astrix. Search the song name for a SoundCloud result.');
  }

  if (/soundcloud\.com/i.test(input)) {
    try {
      return soundcloudTrack(await soundcloudJson(input));
    } catch (error) {
      throw new Error(friendlyMusicError(error));
    }
  }

  if (/^https?:\/\//i.test(input)) {
    return { title: 'Direct Audio', url: input, duration: 0, source: 'Direct URL' };
  }

  const searchSoundCloud = async () => {
    try {
      const result = await soundcloudJson(`scsearch${SEARCH_CANDIDATES}:${input}`);
      const entries = Array.isArray(result?.entries) ? result.entries : [result];
      return entries.filter(Boolean).map(item => soundcloudTrack(item, input));
    } catch (error) {
      console.warn('SoundCloud search unavailable:', error?.message || error);
      return [];
    }
  };

  const resultSets = await Promise.all([searchSoundCloud()]);
  const candidates = [];
  const seen = new Set();
  for (const resultSet of resultSets) {
    for (const candidate of resultSet || []) {
      if (!candidate?.url || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      candidates.push(candidate);
    }
  }

  if (!candidates.length) throw new Error('No playable result was found from the enabled music sources.');
  const first = candidates.shift();
  first.fallbacks = candidates;
  return first;
}

async function directHttpStream(url) {
  const response = await timeout(fetch(url, {
    headers: { 'User-Agent': 'AstrixDiscordBot/6.6' },
    redirect: 'follow'
  }), TIMEOUT, 'Direct audio request');

  if (!response.ok || !response.body) {
    throw new Error(`Direct audio source returned HTTP ${response.status}.`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.startsWith('audio/') && !contentType.includes('octet-stream')) {
    throw new Error(`Direct URL did not return audio data (${contentType || 'unknown content type'}).`);
  }

  // Discord voice does not reliably decode arbitrary MP3/AAC/radio bytes.
  // Normalize direct sources through the same Ogg Opus format used by
  // YouTube/SoundCloud so public radio and direct audio links also play.
  const input = Readable.fromWeb(response.body);
  const transcoder = spawn(ffmpegPath && fs.existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn',
    '-c:a', 'libopus',
    '-ar', '48000',
    '-ac', '2',
    '-f', 'ogg',
    'pipe:1'
  ], { stdio: [ 'pipe', 'pipe', 'pipe' ] });

  let transcodeError = '';
  transcoder.stderr.on('data', chunk => { transcodeError += chunk.toString(); });
  input.pipe(transcoder.stdin);
  input.once('error', error => {
    try { transcoder.kill('SIGKILL'); } catch {}
    if (!transcoder.stdout.destroyed) transcoder.stdout.destroy(error);
  });
  transcoder.once('error', error => {
    if (!transcoder.stdout.destroyed) transcoder.stdout.destroy(error);
  });
  transcoder.once('close', code => {
    if (code !== 0 && !transcoder.stdout.destroyed) {
      transcoder.stdout.destroy(
        new Error(transcodeError.trim() || `FFmpeg exited with code ${code}.`)
      );
    }
  });

  return { stream: transcoder.stdout, type: StreamType.OggOpus };
}

async function streamOnce(track, extractorArgs = YTDLP_EXTRACTOR_ARGS) {
  if (/(?:youtube\.com|youtu\.be)/i.test(track.url)) {
    throw new Error('YouTube has been removed from Astrix.');
  }

  if (/soundcloud\.com/i.test(track.url)) {
    return timeout(ytDlpStream(track.url, ''), TIMEOUT, 'SoundCloud audio stream');
  }

  if (/^https?:\/\//i.test(track.url)) return directHttpStream(track.url);
  throw new Error('Unsupported audio source.');
}

async function stream(track) {
  let lastError;
  const extractorArgs = [null];
  for (let attempt = 0; attempt <= STREAM_RETRIES; attempt++) {
    try {
      return await streamOnce(track, extractorArgs[attempt % extractorArgs.length]);
    } catch (error) {
      lastError = error;
      if (attempt >= STREAM_RETRIES) break;
      await new Promise(resolve => setTimeout(resolve, STREAM_RETRY_DELAY * (attempt + 1)));
    }
  }
  throw lastError || new Error('Audio stream could not be opened.');
}

async function recoverPlayback(queue, error) {
  const current = queue.current;
  const fallback = Array.isArray(current?.fallbacks) ? current.fallbacks.shift() : null;
  if (fallback) {
    fallback.fallbacks = current.fallbacks;
    queue.current = null;
    queue.resource = null;
    console.warn(`[Music] Stream recovery: ${current.source} -> ${fallback.source} for ${current.title}`);
    return start(queue, fallback);
  }
  await notify(queue, { embeds: [errorEmbed('Music Error', friendlyMusicError(error))], components: supportComponents('Report Music Issue') });
  return next(queue);
}

async function start(queue, track) {
  try {
    const source = await stream(track);
    const resource = createAudioResource(source.stream, {
      inputType: source.type,
      inlineVolume: true
    });
    resource.volume?.setVolume(queue.volume / 100);
    queue.resource = resource;
    track.query ||= track.title || '';
    queue.current = track;
    musicPresence.setTrack(queue.guildId, { ...track, channelId: queue.channelId });
    queue.player.play(resource);
    persistQueue(queue);

    await notify(queue, {
      embeds: [nowPlayingEmbed(track, queue)],
      components: controls(queue)
    });
  } catch (error) {
    queue.current = null;
    queue.resource = null;
    const fallback = Array.isArray(track.fallbacks) ? track.fallbacks.shift() : null;
    if (fallback) {
      fallback.fallbacks = track.fallbacks;
      console.log(`[Music] Silent fallback: ${track.source} -> ${fallback.source} for ${track.title}`);
      return start(queue, fallback);
    }
    throw error;
  }
}


async function autoplayNext(queue, seed = queue?.current) {
  if (!queue?.autoplay || !seed) return false;

  const query = seed.query || seed.title || '';
  if (!query) return false;

  try {
    const related = await resolve(query);
    if (!related) return false;

    const pool = [related, ...(Array.isArray(related.fallbacks) ? related.fallbacks : [])]
      .filter(t => t?.url && t.url !== seed.url);

    if (!pool.length) return false;

    const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 5))];
     pick.requestedBy = 'Astrix Autoplay';
     pick.query = pick.title || query;
    await start(queue, pick);
    return true;
  } catch (error) {
    console.warn('[Music] Autoplay could not find a playable related track:', friendlyMusicError(error));
    return false;
  }
}

async function next(queue) {
  const finished = queue.current;
  if (finished && queue.loop === 'track') queue.tracks.unshift(finished);
  else if (finished && queue.loop === 'queue') queue.tracks.push(finished);

  if (finished && queue.loop === 'off') {
    queue.history.push(finished);
    if (queue.history.length > 20) queue.history.shift();
  }

  queue.current = null;
  queue.resource = null;
  musicPresence.clearTrack(queue.guildId);
  const nextTrack = queue.tracks.shift();
  if (!nextTrack) {
    if (await autoplayNext(queue, finished)) return;
    return;
  }

  try {
    await start(queue, nextTrack);
  } catch (error) {
    await notify(queue, { embeds: [errorEmbed('Music Error', `Could not play **${nextTrack.title}**.\n${friendlyMusicError(error)}`)], components: supportComponents('Report Music Issue') });
    return next(queue);
  }
}

function controls(queue = null) {
  const paused = queue?.player?.state?.status === AudioPlayerStatus.Paused;
  const loopLabel = queue?.loop === 'track' ? '🔂 Track' : queue?.loop === 'queue' ? '🔁 Queue' : '➡️ Loop';
  const stayLabel = queue?.stay247 ? '🟢 24/7' : '🔒 24/7';
  const autoplayLabel = queue?.autoplay ? '🟢 Autoplay' : '🔒 Autoplay';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music:previous').setLabel('⏮ Previous').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:pause').setLabel(paused ? '▶ Resume' : '⏸ Pause').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music:queue').setLabel('📜 Queue').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music:voldown').setLabel('🔉 −10').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:volup').setLabel('🔊 +10').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:loop').setLabel(loopLabel).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:shuffle').setLabel('🔀 Shuffle').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:247').setLabel(stayLabel).setStyle(queue?.stay247 ? ButtonStyle.Success : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music:clear').setLabel('🗑 Clear Queue').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:autoplay').setLabel(autoplayLabel).setStyle(queue?.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:disconnect').setLabel('🚪 Disconnect').setStyle(ButtonStyle.Danger)
    )
  ];
}

async function action(interaction, name) {
  if (lavalinkMusic.isReady() || (lavalinkMusic.enabled() && ['music247', 'filter'].includes(name))) return lavalinkMusic.action(interaction, name);
  const queue = q(interaction.guildId);
  queue.textChannel = interaction.channel;

  if (name === 'music247') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      requireManager(interaction);
      const channel = interaction.options.getChannel('channel', true);
      if (!isVoiceChannel(channel)) throw new Error('Choose a voice channel for native 24/7 mode.');
      const config = music247Config(interaction.guildId);
      config.channelId = channel.id;
      config.textChannelId = interaction.channel?.id || config.textChannelId;
      store.save();
      if (config.is247 || config.enabled) {
        queue.stay247 = true;
        queue.autoplay = Boolean(config.autoplay);
        await connect(queue, channel);
      }
      return interaction.reply({
        embeds: [embed('🎧 24/7 Voice Channel Set', `Astrix will stay in <#${channel.id}> when 24/7 mode is enabled.\n\nUse **/music247 enable** to turn on native protected mode.\nAutoplay: **${config.autoplay ? 'ON' : 'OFF'}**`)]
      });
    }

    if (sub === 'enable') {
      requireManager(interaction);
      const config = music247Config(interaction.guildId);
      if (!config.channelId) throw new Error('Set a voice channel first with **/music247 setup**.');
      config.enabled = true;
      config.is247 = true;
      config.enabledBy = interaction.user.id;
      config.textChannelId = interaction.channel?.id || config.textChannelId;
      config.lastResetDay = utcDay();
      store.save();
      queue.stay247 = true;
      queue.autoplay = Boolean(config.autoplay);
      try {
        await reconnect247(interaction.guild, 'enable');
      } catch (error) {
        config.enabled = false;
        queue.stay247 = false;
        store.save();
        throw error;
      }
      return interaction.reply({
        embeds: [embed('🟢 Native 24/7 Enabled', `Astrix is now locked to <#${config.channelId}> and will not leave that voice channel.\n\nAutoplay: **${config.autoplay ? 'ON' : 'OFF'}**\nDaily maintenance reset: **00:00 UTC**\n\nIf someone tries to disconnect Astrix, Astrix will stay in this channel and reply in English that this is a 24/7 server.`)]
      });
    }

    if (sub === 'toggle') {
      const config = music247Config(interaction.guildId);
      if (config.is247 || config.enabled) {
        config.enabled = false;
        config.is247 = false;
        store.save();
        queue.stay247 = false;
        destroyQueue(queue, interaction.guildId, { force: true });
        return interaction.reply({ embeds: [embed('🔴 24/7 Disabled', '24/7 protection is disabled and the fallback voice connection was released.')] });
      }
      if (!config.channelId) throw new Error('Set a voice channel first with **/music247 setup**.');
      config.enabled = true;
      config.is247 = true;
      config.enabledBy = interaction.user.id;
      store.save();
      queue.stay247 = true;
      await reconnect247(interaction.guild, 'toggle');
      return interaction.reply({ embeds: [embed('🟢 24/7 Enabled', `Astrix is now locked to <#${config.channelId}>.`)] });
    }

    if (sub === 'disable') {
      requireManager(interaction);
      const config = music247Config(interaction.guildId);
      config.enabled = false;
      config.is247 = false;
      config.lastResetDay = '';
      store.save();
      const existing = queues.get(interaction.guildId);
      if (existing) {
        existing.stay247 = false;
        destroyQueue(existing, interaction.guildId, { force: true });
      }
      return interaction.reply({ embeds: [embed('🔴 24/7 Disabled', '24/7 protection is disabled and Astrix has released the voice connection.')] });
    }

    if (sub === 'autoplay') {
      requireManager(interaction);
      if (!premiumService.isPremium(interaction)) {
        throw new Error('Premium, Premium+ or Elite is required to enable automatic song autoplay.');
      }
      const enabled = interaction.options.getBoolean('enabled', true);
      const config = music247Config(interaction.guildId);
      config.autoplay = enabled;
      store.save();
      const existing = queues.get(interaction.guildId);
      if (existing) {
        existing.autoplay = enabled;
        await restoreAutoplaySeed(existing, interaction.guild, config);
      }
      return interaction.reply({ embeds: [embed('🎶 Premium Autoplay Updated', `Automatic related-song playback is now **${enabled ? 'ON' : 'OFF'}**.\n\nAutoplay starts after the current queue finishes. Add a song with **/play** to create the first autoplay seed.`)] });
    }

    const config = music247Config(interaction.guildId);
    const queueState = queues.get(interaction.guildId);
    const tier = premiumService.tierName(premiumService.tierFor(interaction.guildId, config.enabledBy || interaction.user.id, interaction.guild));
    return interaction.reply({
      embeds: [embed('🎧 24/7 Music Status', [
        `Premium entitlement: **${tier}**`,
        `Status: **${config.enabled ? 'ENABLED' : 'DISABLED'}**`,
        `Voice channel: **${config.channelId ? `<#${config.channelId}>` : 'Not configured'}**`,
        `Autoplay: **${config.autoplay ? 'ON' : 'OFF'}**`,
        `Currently connected: **${queueState?.connection ? 'Yes' : 'No'}**`,
        `Now playing: **${queueState?.current?.title || config.lastTrack?.title || 'Nothing'}**`,
        'Daily maintenance reset: **00:00 UTC**'
      ].join('\n'))]
    });
  }

  if (name === 'play') {
    const config = music247Config(interaction.guildId);
    const channel = active247(queue, config)
      ? await configuredVoiceChannel(interaction.guild, config)
      : voice(interaction);
    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    try {
      await connect(queue, channel);
      const track = await resolve(query);
      track.query = query;
      const shouldStart = !queue.current && queue.player.state.status !== AudioPlayerStatus.Playing && queue.player.state.status !== AudioPlayerStatus.Buffering;
      if (shouldStart) await start(queue, track);
      else queue.tracks.push(track);

      return interaction.editReply({
        embeds: [embed(
          shouldStart ? '🎵 Music Started' : '🎶 Added to Queue',
          `**${track.title}**\n${shouldStart ? 'Playing now' : `Queue position: ${queue.tracks.length}`}\nSource: ${track.source}`
        )]
      });
    } catch (error) {
      if (!queue.current && !queue.tracks.length) destroyQueue(queue, interaction.guildId);
      return interaction.editReply({ embeds: [errorEmbed('Music Error', friendlyMusicError(error))], components: supportComponents('Report Music Issue') });
    }
  }

  if (name === 'filter') {
    const preset = String(interaction.options.getString('preset', true)).toLowerCase();
    const labels = { 'full-bass': 'Full Bass', 'hall-reverb': 'Hall Reverb', '8d': '8D Audio', nightcore: 'Nightcore', clear: 'Clear' };
    if (!labels[preset]) throw new Error('Choose Full Bass, Hall Reverb, 8D Audio, Nightcore, or Clear.');
    queue.filterPreset = labels[preset];
    return interaction.reply({ embeds: [embed('🎛️ Audio Filter', `Applied **${labels[preset]}** to the fallback player.`)] });
  }

  if (name === 'disconnect' || name === 'stop') {
    if (active247(queue)) {
      return interaction.reply({ content: DISCONNECT_PROTECTION_MESSAGE, ephemeral: true });
    }
    destroyQueue(queue, interaction.guildId);
    return interaction.reply({ embeds: [embed('Music Stopped', 'Queue cleared and voice connection closed.')] });
  }

  if (!queue.current && !queue.tracks.length) throw new Error('There is no active music queue.');

  if (name === 'pause') {
    if (queue.player.state.status === AudioPlayerStatus.Paused) return interaction.reply({ embeds: [embed('Music', 'Playback is already paused.')] });
    queue.player.pause();
    musicPresence.setPaused(interaction.guildId, true);
    return interaction.reply({ embeds: [embed('Music', 'Playback paused.')] });
  }

  if (name === 'resume') {
    if (queue.player.state.status !== AudioPlayerStatus.Paused) return interaction.reply({ embeds: [embed('Music', 'Playback is not paused.')] });
    queue.player.unpause();
    musicPresence.setPaused(interaction.guildId, false);
    return interaction.reply({ embeds: [embed('Music', 'Playback resumed.')] });
  }

  if (name === 'skip') {
    queue.player.stop(true);
    return interaction.reply({ embeds: [embed('Music', 'Skipped the current track.')] });
  }

  if (name === 'loop') {
    queue.loop = interaction.options.getString('mode', true);
    return interaction.reply({ embeds: [embed('Loop Mode', `Set to **${queue.loop}**.`)] });
  }

  if (name === 'volume') {
    queue.volume = interaction.options.getInteger('percent', true);
    queue.resource?.volume?.setVolume(queue.volume / 100);
    return interaction.reply({ embeds: [embed('Volume', `Set to **${queue.volume}%**.`)] });
  }

  if (name === 'queue') {
    const list = queue.tracks.slice(0, 15).map((track, index) => `${index + 1}. ${track.title}`).join('\n') || 'No upcoming tracks.';
    return interaction.reply({ embeds: [embed('🎶 Music Queue', `**Now:** ${queue.current?.title || 'Nothing'}\n\n${list}`)] });
  }

  if (name === 'nowplaying') {
    const currentEmbed = queue.current
      ? nowPlayingEmbed(queue.current, queue)
      : embed('🎧 Now Playing', 'Nothing is playing.');
    return interaction.reply({
      embeds: [currentEmbed],
      components: controls(queue)
    });
  }
}

async function compat(interaction, name) {
  const query = interaction.options?.getString?.('input')
    || interaction.options?.getString?.('query')
    || '';
  const adapted = {
    ...interaction,
    options: {
      ...interaction.options,
      getString: (key, required) => key === 'query' ? query : interaction.options.getString(key, required)
    }
  };
  if (['play', 'artistradio'].includes(name)) return action(adapted, 'play');
  const queue = q(interaction.guildId);
  queue.textChannel = interaction.channel;
  if (['pause', 'resume', 'skip', 'queue', 'nowplaying', 'loop', 'volume', 'stop', 'disconnect'].includes(name)) {
    return action(adapted, name === 'disconnect' ? 'disconnect' : name);
  }
  if (name === 'alwayson') {
    return interaction.reply({ embeds: [embed('🎵 24/7 Music', 'Use **/music247 setup** and **/music247 enable**. Native protected 24/7 playback is available for every server.')] });
  }
  if (name === 'join') {
    const channel = interaction.member?.voice?.channel;
    if (!channel) throw new Error('Join a voice channel first.');
    await connect(queue, channel);
    return interaction.reply({ embeds: [embed('🎵 Voice Connected', `Joined **${channel.name}**.`)] });
  }
  if (['leave', 'leavecleanup'].includes(name)) {
    destroyQueue(queue, interaction.guildId);
    return interaction.reply({ embeds: [embed('🎵 Disconnected', 'Voice connection closed and queue cleared.')] });
  }
  if (name === 'clearqueue') {
    queue.tracks = [];
    return interaction.reply({ embeds: [embed('🗑 Queue Cleared', 'All upcoming tracks were removed.')] });
  }
  if (name === 'shuffle') {
    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    return interaction.reply({ embeds: [embed('🔀 Queue Shuffled', `Shuffled **${queue.tracks.length}** queued track(s).`)] });
  }
  if (name === 'history') {
    const rows = queue.history.slice(-15).reverse().map((track, index) => `${index + 1}. ${track.title}`).join('\n') || 'No played tracks yet.';
    return interaction.reply({ embeds: [embed('🕘 Music History', rows)] });
  }
  if (name === 'previous' || name === 'replay') {
    const previous = name === 'replay' ? queue.current : queue.history.pop();
    if (!previous) throw new Error('There is no previous track available.');
    if (queue.current && name === 'previous') queue.tracks.unshift(queue.current);
    queue.tracks.unshift(previous);
    queue.player.stop(true);
    return interaction.reply({ embeds: [embed('⏮ Music', `Returning to **${previous.title}**.`)] });
  }
  if (name === 'autoplay') {
    if (!premiumService.isPremium(interaction)) throw new Error('Premium is required for autoplay.');
    queue.autoplay = !queue.autoplay;
    music247Config(interaction.guildId).autoplay = queue.autoplay;
    store.save();
    return interaction.reply({ embeds: [embed('🔁 Autoplay', `Autoplay is now **${queue.autoplay ? 'ON' : 'OFF'}**.`)] });
  }
  if (name === 'search' || name === 'similar' || name === 'mood') {
    const result = await resolve(query);
    const candidates = [result, ...(result?.fallbacks || [])].filter(Boolean).slice(0, 10);
    return interaction.reply({ embeds: [embed('🔎 Music Search', candidates.map((track, index) => `${index + 1}. **${track.title}** • ${track.source}`).join('\n') || 'No result found.')] });
  }
  if (['forcefix', 'forceskip'].includes(name)) {
    if (!queue.current && !queue.tracks.length) throw new Error('There is no active music queue.');
    queue.player.stop(true);
    return interaction.reply({ embeds: [embed('🛠️ Music Recovery', 'The current track was stopped and playback recovery was requested.')] });
  }
  if (['forward', 'rewind', 'seek', 'speed', 'lyrics', 'grab', 'move', 'skipto', 'sleep'].includes(name)) {
    return interaction.reply({ embeds: [embed('🎵 Music Command', `\`${name}\` is registered. This operation needs a Lavalink seek/metadata provider or a track-specific value; Astrix fallback playback remains active.`)] });
  }
  return interaction.reply({ embeds: [embed('🎵 Music', `\`${name}\` is available in Astrix.`)] });
}

async function prefix(message, name, args = []) {
  const queue = q(message.guild.id);
  queue.textChannel = message.channel;
  const query = args.join(' ').trim();
  if (['play', 'artistradio'].includes(name)) {
    const channel = message.member?.voice?.channel;
    if (!channel) throw new Error('Join a voice channel first.');
    if (!query) throw new Error('Give a song name or supported audio URL.');
    await connect(queue, channel);
    const track = await resolve(query);
    track.query = query;
    if (!queue.current) await start(queue, track); else queue.tracks.push(track);
    await message.reply({ embeds: [embed(queue.current === track ? '🎵 Music Started' : '🎶 Added to Queue', `**${track.title}**`)] });
    return true;
  }
  if (['pause', 'resume', 'skip', 'queue', 'nowplaying', 'loop', 'volume', 'stop', 'disconnect'].includes(name)) {
    if (name === 'queue') {
      return message.reply({ embeds: [embed('🎶 Music Queue', `**Now:** ${queue.current?.title || 'Nothing'}\n${queue.tracks.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || 'No upcoming tracks.'}`)] });
    }
    if (name === 'nowplaying') return message.reply({ embeds: [queue.current ? nowPlayingEmbed(queue.current, queue) : embed('🎧 Now Playing', 'Nothing is playing.')] });
    if (name === 'pause') queue.player.pause();
    if (name === 'resume') queue.player.unpause();
    if (name === 'skip') queue.player.stop(true);
    if (name === 'loop') queue.loop = ['off', 'track', 'queue'].includes(query) ? query : 'track';
    if (name === 'volume') {
      queue.volume = Math.max(0, Math.min(200, Number(args[0]) || 100));
      queue.resource?.volume?.setVolume(queue.volume / 100);
    }
    if (name === 'stop' || name === 'disconnect') { destroyQueue(queue, message.guild.id); return message.reply({ embeds: [embed('🎵 Disconnected', 'Queue cleared and voice connection closed.')] }); }
    await message.reply({ embeds: [embed('🎵 Music', `${name} completed.`)] });
    return true;
  }
  return prefixCompat(message, name, args, queue);
}

async function prefixCompat(message, name, args, queue) {
  if (name === 'join') {
    const channel = message.member?.voice?.channel;
    if (!channel) throw new Error('Join a voice channel first.');
    await connect(queue, channel);
    await message.reply({ embeds: [embed('🎵 Voice Connected', `Joined **${channel.name}**.`)] });
    return true;
  }
  if (['leave', 'leavecleanup'].includes(name)) {
    destroyQueue(queue, message.guild.id);
    await message.reply({ embeds: [embed('🎵 Disconnected', 'Voice connection closed and queue cleared.')] });
    return true;
  }
  if (name === 'clearqueue' || name === 'shuffle') {
    if (name === 'clearqueue') queue.tracks = [];
    else for (let i = queue.tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]]; }
    await message.reply({ embeds: [embed(name === 'clearqueue' ? '🗑 Queue Cleared' : '🔀 Queue Shuffled', 'Done.')] });
    return true;
  }
  await message.reply({ embeds: [embed('🎵 Music Command', `\`${name}\` is registered. Use **${message.client?.user?.username || 'Astrix'} play <song>** for native playback.`)] });
  return true;
}

async function button(interaction, actionName) {
  if (lavalinkMusic.isReady() && actionName !== '247' && actionName !== 'autoplay') return lavalinkMusic.button(interaction, actionName);
  const queue = queues.get(interaction.guildId) || q(interaction.guildId);
  const config = music247Config(interaction.guildId);

  if (actionName === 'pause') {
    if (!queue.current && !queue.tracks.length) return interaction.reply({ content: 'No active music queue.', ephemeral: true });
    if (queue.player.state.status === AudioPlayerStatus.Paused) queue.player.unpause();
    else queue.player.pause();
    return interaction.update({ components: controls(queue) });
  }
  if (actionName === '247') {
    requireManager(interaction);
    if (active247(queue, config)) {
      config.enabled = false;
      config.lastResetDay = '';
      queue.stay247 = false;
      store.save();
      destroyQueue(queue, interaction.guildId, { force: true });
      return interaction.update({ components: [] });
    }
    if (!config.channelId) {
      return interaction.reply({ content: 'Set the protected voice channel first with `/music247 setup`.', ephemeral: true });
    }
    config.enabled = true;
    config.enabledBy = interaction.user.id;
    config.textChannelId = interaction.channel?.id || config.textChannelId;
    config.lastResetDay = utcDay();
    queue.stay247 = true;
    queue.autoplay = Boolean(config.autoplay);
    store.save();
    try {
      await reconnect247(interaction.guild, 'enable');
    } catch (error) {
      config.enabled = false;
      queue.stay247 = false;
      store.save();
      throw error;
    }
    return interaction.update({ components: controls(queue) });
  }
  if (actionName === 'autoplay') {
    if (!premiumService.isPremium(interaction)) {
      return interaction.reply({ embeds: [errorEmbed('🔒 Premium Feature', 'Automatic related-song autoplay requires Astrix Premium, Premium+ or Elite.')], ephemeral: true });
    }
    config.autoplay = !queue.autoplay;
    queue.autoplay = config.autoplay;
    store.save();
    await restoreAutoplaySeed(queue, interaction.guild, config);
    return interaction.update({ components: controls(queue) });
  }
  if (actionName === 'skip') { queue.player.stop(true); return interaction.reply({ content: '⏭ Skipped.', ephemeral: true }); }
  if (actionName === 'stop' || actionName === 'disconnect') {
    if (active247(queue, config)) return interaction.reply({ content: DISCONNECT_PROTECTION_MESSAGE, ephemeral: true });
    destroyQueue(queue, interaction.guildId);
    return interaction.update({ components: [] });
  }
  if (actionName === 'voldown' || actionName === 'volup') {
    queue.volume = Math.max(0, Math.min(200, queue.volume + (actionName === 'volup' ? 10 : -10)));
    queue.resource?.volume?.setVolume(queue.volume / 100);
    return interaction.reply({ content: `🔊 Volume: ${queue.volume}%`, ephemeral: true });
  }
  if (actionName === 'loop') {
    queue.loop = queue.loop === 'off' ? 'track' : queue.loop === 'track' ? 'queue' : 'off';
    return interaction.update({ components: controls(queue) });
  }
  if (actionName === 'shuffle') {
    for (let i = queue.tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]]; }
    return interaction.reply({ content: `🔀 Shuffled ${queue.tracks.length} queued track(s).`, ephemeral: true });
  }
  if (actionName === 'queue') {
    const list = queue.tracks.slice(0, 15).map((t, i) => `${i + 1}. ${t.title}`).join('\n') || 'No upcoming tracks.';
    return interaction.reply({ embeds: [embed('📜 Music Queue', `**Now:** ${queue.current?.title || 'Nothing'}\n**Volume:** ${queue.volume}%\n**Loop:** ${queue.loop}\n**24/7:** ${queue.stay247 ? 'On' : 'Off'}\n**Autoplay:** ${queue.autoplay ? 'On' : 'Off'}\n\n${list}`)], ephemeral: true });
  }
  if (actionName === 'clear') { queue.tracks = []; return interaction.reply({ content: '🗑 Upcoming queue cleared.', ephemeral: true }); }
  if (actionName === 'previous') {
    const previous = queue.history.pop();
    if (!previous) return interaction.reply({ content: 'There is no previous track in history.', ephemeral: true });
    if (queue.current) queue.tracks.unshift(queue.current);
    queue.tracks.unshift(previous);
    queue.player.stop(true);
    return interaction.reply({ content: `⏮ Returning to **${previous.title}**.`, ephemeral: true });
  }
}


function setAutoplay(guildId, enabled) {
  const queue = queues.get(guildId);
  if (!queue) return false;
  queue.autoplay = Boolean(enabled);
  const config = music247Config(guildId);
  config.autoplay = queue.autoplay;
  store.save();
  return true;
}

async function tick(client) {
  if (!client?.guilds?.cache) return;
  if (lavalinkMusic.enabled()) return;
  const day = utcDay();
  for (const guild of client.guilds.cache.values()) {
    const config = music247Config(guild.id);
    if (!config.enabled || !config.channelId) continue;
    const queue = queues.get(guild.id);
    const disconnected = !queue?.connection || queue.connection.state?.status !== VoiceConnectionStatus.Ready;
    if (config.lastResetDay !== day || disconnected) {
      await reconnect247(guild, config.lastResetDay !== day ? 'daily' : 'reconnect')
        .catch(error => console.error(`24/7 maintenance for ${guild.id}:`, error.message));
    }
  }
}

async function voiceStateUpdate(oldState, newState) {
  if (lavalinkMusic.enabled()) return;
  const guild = newState?.guild || oldState?.guild;
  const botId = guild?.client?.user?.id;
  if (!guild?.id || !botId || newState?.id !== botId) return;
  const config = music247Config(guild.id);
  if (!config.enabled || !config.channelId) return;

  const queue = q(guild.id);
  await setQueueTextChannel(queue, guild);
  if (newState.channelId === config.channelId) {
    queue.channelId = config.channelId;
    return;
  }
  if (queue.reconnectPromise) return;

  await notify(queue, { content: DISCONNECT_PROTECTION_MESSAGE });
  queue.reconnectPromise = (async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await reconnect247(guild, 'voice protection');
  })().catch(error => console.error(`24/7 voice protection for ${guild.id}:`, error.message))
    .finally(() => { queue.reconnectPromise = null; });
  await queue.reconnectPromise;
}

module.exports = {
  action,
  compat,
  prefix,
  button,
  queues,
  init,
  tick,
  voiceStateUpdate,
  friendlyMusicError,
  resolve,
  setAutoplay,
  getActivity: musicPresence.getActivity
};
