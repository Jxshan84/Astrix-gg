const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prism = require('prism-media');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const ui = require('./ui.ts');
const store = require('./store.ts');

const sessions = new Map();
const dir = path.join(__dirname, '..', 'recordings');
const announcementFile = path.join(__dirname, '..', 'assets', 'now-recording.ogg');
fs.mkdirSync(dir, { recursive: true });

function wavHeader(dataLength, sampleRate = 48000, channels = 2, bits = 16) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataLength, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * channels * bits / 8, 28); b.writeUInt16LE(channels * bits / 8, 32); b.writeUInt16LE(bits, 34);
  b.write('data', 36); b.writeUInt32LE(dataLength, 40); return b;
}
function id() { return crypto.randomBytes(6).toString('base64url'); }
function isManager(i) { return Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)); }
function canControl(i, s) { return i.user.id === s.owner || isManager(i); }
function cfg(guildId) {
  const g = store.guild(guildId); g.config ||= {}; g.config.recording ||= {};
  if (!g.config.recording.silenceMinutes) g.config.recording.silenceMinutes = 3;
  return g.config.recording;
}
function addActivity(s, text) { s.activity.unshift({ at: Date.now(), text: String(text).slice(0, 160) }); s.activity = s.activity.slice(0, 6); }
function controls(s) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`record:stop:${s.id}`).setLabel('Stop recording').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`record:note:${s.id}`).setLabel('Add a note').setEmoji('📝').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`record:refresh:${s.id}`).setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`record:privacy:${s.id}`).setLabel('Encryption info').setEmoji('🔐').setStyle(ButtonStyle.Secondary)
  );
}
function channelMembers(s, guild) {
  const channel = guild.channels.cache.get(s.channelId);
  if (!channel?.members) return [];
  return [...channel.members.values()].filter(m => !m.user.bot);
}
function panelEmbed(s, guild) {
  const channel = guild.channels.cache.get(s.channelId);
  const active = channelMembers(s, guild);
  const activeText = active.length ? active.slice(0, 8).map(m => `<@${m.id}>`).join(', ') + (active.length > 8 ? ` +${active.length - 8} more` : '') : 'No members currently in the voice channel.';
  const activityText = s.activity.length ? s.activity.map(x => `<t:${Math.floor(x.at / 1000)}:T> • ${x.text}`).join('\n') : 'Waiting for voice activity...';
  const lastAudio = s.receivedAudio ? `<t:${Math.floor(s.lastAudioAt/1000)}:R>` : 'No audio received yet';
  return ui.embed('🔴 Recording...',
    `**Recording ID:** \`${s.id}\`\n**Channel:** ${channel ? `<#${channel.id}>` : 'Unknown'}\n` +
    `**Started:** <t:${Math.floor(s.startedAt/1000)}:T> (<t:${Math.floor(s.startedAt/1000)}:R>)\n` +
    `**Last audio:** ${lastAudio}\n**Silence protection:** ${s.silenceMinutes} minute(s)\n` +
    `**Voice security:** 🔐 Discord-managed voice encryption; Astrix does not expose an encryption toggle.\n\n` +
    `**Active users**\n${activeText}\n\n**Activity**\n${activityText}`, 0x57f287);
}
function stoppedEmbed(s, reason = 'manual') {
  const reasonText = reason === 'silence' ? `Astrix stopped automatically because no audio was received for **${s.silenceMinutes} minute(s)**.` : 'The recording session has ended.';
  return ui.embed('⏹️ Recording Stopped',
    `**Recording ID:** \`${s.id}\`\n**Duration:** ${ui.formatDuration(Date.now() - s.startedAt)}\n` +
    `**Captured speakers:** ${s.users.size}\n**Notes:** ${s.notes.length}\n\n${reasonText}\nAstrix restored its normal server nickname.`, 0xed4245);
}
async function updatePanel(s) {
  if (!s.panelMessage || !s.guild || s.stopping) return;
  await s.panelMessage.edit({ embeds: [panelEmbed(s, s.guild)], components: [controls(s)] }).catch(() => {});
}
async function setRecordingNickname(guild, s) {
  const me = guild.members.me; if (!me) return;
  s.originalNickname = me.nickname;
  const nickname = String(process.env.RECORDING_NICKNAME || '🔴 Astrix | REC').slice(0, 32);
  try { await me.setNickname(nickname, 'Astrix recording session started'); s.nicknameChanged = true; addActivity(s, `Astrix nickname changed to **${nickname}**.`); }
  catch (e) { s.nicknameChanged = false; addActivity(s, 'Could not change the Astrix nickname. Check nickname permissions and role hierarchy.'); console.error('Recording nickname:', e.message); }
}
async function restoreNickname(s) {
  if (!s.guild?.members?.me || !s.nicknameChanged) return;
  try { await s.guild.members.me.setNickname(s.originalNickname ?? null, 'Astrix recording session ended'); } catch (e) { console.error('Restore recording nickname:', e.message); }
}
async function playAnnouncement(connection) {
  if (!fs.existsSync(announcementFile)) return false;
  const previousPlayer = connection.state?.subscription?.player || null;
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  connection.subscribe(player); player.play(createAudioResource(announcementFile));
  try { await entersState(player, AudioPlayerStatus.Playing, 5000); await entersState(player, AudioPlayerStatus.Idle, 10000); }
  catch (e) { console.error('Recording announcement:', e.message); }
  finally { try { player.stop(true); } catch {} if (previousPlayer) try { connection.subscribe(previousPlayer); } catch {} }
  return true;
}
function subscribe(s, userId) {
  if (!s || s.stopping || s.receiverStreams?.has(userId)) return;
  s.receiverStreams ||= new Map();

  const raw = path.join(dir, `${s.id}-${userId}.pcm`);
  const fileStream = fs.createWriteStream(raw, { flags: 'a' });
  const opus = s.connection.receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.Manual }
  });
  const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  const capture = { raw, stream: fileStream, segments: 0, opus, decoder, captured: false };
  s.receiverStreams.set(userId, capture);

  const markAudio = () => {
    s.receivedAudio = true;
    s.lastAudioAt = Date.now();
    capture.segments += 1;
    if (!capture.captured) {
      capture.captured = true;
      s.users.set(userId, capture);
      addActivity(s, `<@${userId}> started speaking and is being captured.`);
      updatePanel(s).catch(() => {});
    }
  };

  opus.on('data', markAudio);
  opus.on('error', () => {});
  decoder.on('error', () => {});
  opus.pipe(decoder).pipe(fileStream, { end: false });
}
function subscribeCurrentMembers(s) {
  for (const member of channelMembers(s, s.guild)) subscribe(s, member.id);
}
async function buildExports(s) {
  for (const u of s.receiverStreams?.values?.() || []) { try { u.opus?.destroy(); } catch {} try { u.decoder?.destroy(); } catch {} try { u.stream.end(); } catch {} }
  for (const u of s.users.values()) try { u.stream.end(); } catch {}
  await new Promise(r => setTimeout(r, 500));
  const out = []; const maxBytes = Math.max(1, Number(process.env.MAX_RECORDING_ATTACHMENT_MB || 8)) * 1024 * 1024;
  for (const [userId, u] of s.users) {
    try {
      const pcm = fs.readFileSync(u.raw); const wav = Buffer.concat([wavHeader(pcm.length), pcm]); const file = u.raw.replace('.pcm', '.wav');
      fs.writeFileSync(file, wav); fs.unlinkSync(u.raw);
      out.push({ path: file, name: `recording-${s.id}-${userId}.wav`, size: wav.length, uploadable: wav.length <= maxBytes });
    } catch (e) { console.error('Build recording file:', e.message); }
  }
  return out;
}
function attachments(exports) { return exports.filter(x => x.uploadable).slice(0, 10).map(x => new AttachmentBuilder(x.path, { name: x.name })); }
async function ensureStorageChannel(s) {
  const c = cfg(s.guild.id);
  if (c.storageChannelId) {
    const existing = s.guild.channels.cache.get(c.storageChannelId) || await s.guild.channels.fetch(c.storageChannelId).catch(() => null);
    if (existing?.isTextBased()) return existing;
    delete c.storageChannelId;
    store.save();
  }

  const me = s.guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageChannels)) return null;

  const channel = await s.guild.channels.create({
    name: 'astrix-recordings',
    type: ChannelType.GuildText,
    reason: 'Private storage for Astrix recording links',
    permissionOverwrites: [
      { id: s.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
    ]
  }).catch(error => {
    console.error('Create recording storage channel:', error.message);
    return null;
  });

  if (channel) {
    c.storageChannelId = channel.id;
    store.save();
  }
  return channel;
}
async function uploadRecordings(s, exports, reason) {
  if (!exports.length) return null;

  const c = cfg(s.guild.id);
  let ch = c.logChannelId ? s.guild.channels.cache.get(c.logChannelId) : null;
  if (!ch?.isTextBased()) ch = await ensureStorageChannel(s);
  if (!ch?.isTextBased()) return null;

  const uploadable = attachments(exports);
  if (!uploadable.length) return null;

  const message = await ch.send({
    embeds: [ui.premiumEmbed('🎙️ Astrix Recording Storage', `Recording \`${s.id}\` ended.\nStarter: <@${s.owner}>\nVoice channel: <#${s.channelId}>\nDuration: **${ui.formatDuration(Date.now()-s.startedAt)}**\nCaptured speakers: **${s.users.size}**\nReason: **${reason === 'silence' ? 'No audio / silence timeout' : 'Stopped'}**`)],
    files: uploadable,
    allowedMentions: { parse: [] }
  }).catch(error => {
    console.error('Upload recording:', error.message);
    return null;
  });
  if (message?.attachments?.size) {
    const links=[...message.attachments.values()].map((attachment,index)=>`[Download recording ${index+1}](${attachment.url})`).join('\n');
    await message.edit({
      embeds: [ui.premiumEmbed('🎙️ Astrix Recording Storage', `Recording \`${s.id}\` ended.\nStarter: <@${s.owner}>\nVoice channel: <#${s.channelId}>\nDuration: **${ui.formatDuration(Date.now()-s.startedAt)}**\nCaptured speakers: **${s.users.size}**\nReason: **${reason === 'silence' ? 'No audio / silence timeout' : 'Stopped'}**\n\n🔗 **Download links**\n${links}`)]
    }).catch(error => console.error('Update recording links:', error.message));
  }
  return message;
}
async function sendOwnerDM(s, exports, reason, storageMessage) {
  const user = await s.guild.client.users.fetch(s.owner).catch(() => null);
  if (!user) return null;

  const recordingUrls = storageMessage
    ? [...storageMessage.attachments.values()].map(attachment => attachment.url)
    : [];

  let linkText;
  if (recordingUrls.length) {
    linkText = recordingUrls.length === 1
      ? `[Open Recording](${recordingUrls[0]})`
      : recordingUrls.map((url, index) => `[Open Recording ${index + 1}](${url})`).join('\n');
  } else if (!exports.length) {
    linkText = '**No audio was captured in this session, so there is no recording file to link.**';
  } else if (exports.some(item => item.uploadable)) {
    const files=attachments(exports);
    const direct=await user.send({
      content: `🎙️ Downloadable files for recording \`${s.id}\``,
      files,
      allowedMentions: { parse: [] }
    }).catch(error => {
      console.error('Recording owner DM upload:', error.message);
      return null;
    });
    if (direct?.attachments?.size) {
      const urls=[...direct.attachments.values()].map(attachment=>attachment.url);
      linkText=urls.map((url,index)=>`[Download recording ${index+1}](${url})`).join('\n');
    } else {
      linkText = '**Astrix captured audio but could not upload it. Give Astrix Attach Files permission, or configure a recording log channel.**';
    }
  } else {
    linkText = '**Astrix captured no uploadable audio in this session.**';
  }

  return user.send({
    embeds: [ui.premiumEmbed(
      '🎙️ Your Astrix Recording',
      `Recording \`${s.id}\` finished.\nServer: **${s.guild.name}**\nDuration: **${ui.formatDuration(Date.now()-s.startedAt)}**\nCaptured speakers: **${s.users.size}**${reason === 'silence' ? `\n\n⚠️ I did not receive audio for ${s.silenceMinutes} minute(s), so I stopped automatically.` : ''}\n\n🔗 **Recording Link${recordingUrls.length === 1 ? '' : 's'}**\n${linkText}`
    )]
  }).catch(() => null);
}

function deleteLocalExports(exports) {
  for (const item of exports) {
    try {
      if (item?.path && fs.existsSync(item.path)) fs.unlinkSync(item.path);
    } catch (error) {
      console.error('Delete local recording:', error.message);
    }
  }
}
async function cleanupSession(s) {
  if (s.panelTimer) clearInterval(s.panelTimer);
  if (s.silenceTimer) clearInterval(s.silenceTimer);
  if (s.speakingHandler) try { s.connection.receiver.speaking.off('start', s.speakingHandler); } catch {}
  await restoreNickname(s);
  if (s.createdConnection) try { s.connection.destroy(); } catch {}
}
async function finalize(s, reason = 'manual') {
  if (!s || s.stopping) return null;
  s.stopping = true; sessions.delete(s.guild.id);
  const exports = await buildExports(s);
  await cleanupSession(s);
  if (s.panelMessage) await s.panelMessage.edit({ embeds: [stoppedEmbed(s, reason)], components: [] }).catch(() => {});
  const storageMessage = await uploadRecordings(s, exports, reason);
  const dm = await sendOwnerDM(s, exports, reason, storageMessage);
  deleteLocalExports(exports);
  return { exports: [], logMessage: storageMessage, dm };
}
async function silenceCheck(s) {
  if (!s || s.stopping) return;
  const limit = s.silenceMinutes * 60000;
  if (Date.now() - s.lastAudioAt < limit) return;
  const channel = s.guild.channels.cache.get(s.textChannelId);
  if (channel?.isTextBased()) await channel.send({ content: `<@${s.owner}> Recording stopped: no voice activity was detected for **${s.silenceMinutes} minutes**. Astrix is leaving the voice channel and will send the downloadable recording link shortly.`, allowedMentions: { users: [...new Set([s.owner].filter(Boolean))] } }).catch(() => {});
  await finalize(s, 'silence');
}
async function start(i) {
  if (sessions.has(i.guildId)) throw new Error('A recording session is already active in this server.');
  const vc = i.member?.voice?.channel; if (!vc) throw new Error('Join the voice channel you want to record first.');
  const me = i.guild.members.me; const perms = vc.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.Connect)) throw new Error('Astrix needs View Channel and Connect permissions in this voice channel.');
  if (!perms.has(PermissionFlagsBits.Speak)) throw new Error('Astrix needs Speak permission so it can announce “Now recording”.');
  await i.deferReply(); let s = null;
  try {
    const existing = getVoiceConnection(i.guildId);
    if (existing?.joinConfig?.channelId && existing.joinConfig.channelId !== vc.id) throw new Error('Astrix is already connected to another voice channel. Disconnect it there first.');
    let connection = existing;
    if (!connection) connection = joinVoiceChannel({ channelId: vc.id, guildId: i.guildId, adapterCreator: i.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    const rcfg = cfg(i.guildId);
    s = { id:id(), guild:i.guild, connection, createdConnection:!existing, startedAt:Date.now(), channelId:vc.id, textChannelId:i.channelId,
      users:new Map(), receiverStreams:new Map(), owner:i.user.id, activity:[], notes:[], stopping:false, panelMessage:null, panelTimer:null, silenceTimer:null,
      nicknameChanged:false, originalNickname:null, silenceMinutes:Math.max(1,Number(rcfg.silenceMinutes||3)), receivedAudio:false, lastAudioAt:Date.now() };
    sessions.set(i.guildId, s); addActivity(s, `<@${i.user.id}> started the recording.`);
    s.speakingHandler = uid => subscribe(s, uid); connection.receiver.speaking.on('start', s.speakingHandler);
    subscribeCurrentMembers(s);
    await setRecordingNickname(i.guild, s);
    const announced = await playAnnouncement(connection); addActivity(s, announced ? 'Astrix announced **“Now recording”** in the voice channel.' : 'Voice announcement audio was unavailable.');
    s.panelMessage = await i.editReply({ embeds: [panelEmbed(s, i.guild)], components: [controls(s)] });
    s.panelTimer = setInterval(() => updatePanel(s).catch(() => {}), 10000); s.panelTimer.unref?.();
    s.silenceTimer = setInterval(() => silenceCheck(s).catch(e => console.error('Recording silence check:', e.message)), 30000); s.silenceTimer.unref?.();
    return s.panelMessage;
  } catch (e) {
    if (s) { sessions.delete(i.guildId); await cleanupSession(s).catch(() => {}); }
    if (i.deferred) return i.editReply(ui.errorPayload('Recording Error', e.message || 'Could not start recording.'));
    throw e;
  }
}
async function stop(i) {
  const s = sessions.get(i.guildId); if (!s) throw new Error('No recording session is active.');
  if (!canControl(i, s)) throw new Error('Only the recording starter or a server manager can stop it.');
  await i.deferReply({ ephemeral: true });
  const result = await finalize(s, 'manual');
  return i.editReply({ embeds: [ui.success('Recording Finished', result?.dm ? `Recording \`${s.id}\` was sent privately to <@${s.owner}>.${result.logMessage ? '\nA recording log was also posted in the configured log channel.' : ''}` : `Recording \`${s.id}\` ended, but I could not DM <@${s.owner}>. Check their DM privacy settings${result?.logMessage ? ' or the configured recording log channel' : ''}.`)] });
}
async function status(i) {
  const s = sessions.get(i.guildId);
  if (!s) return i.reply({ embeds: [ui.embed('🎙️ Astrix Recorder', 'No active recording session. Start one with **`/record start`**.')], ephemeral: true });
  return i.reply({ embeds: [panelEmbed(s, i.guild)], components: [controls(s)], ephemeral: true });
}
async function config(i) {
  if (!isManager(i)) throw new Error('Manage Server permission is required to configure recording.');
  const c = cfg(i.guildId); const ch = i.options.getChannel('log_channel');
  if (ch && !ch.isTextBased()) throw new Error('Recording log channel must be a text-based channel.'); const clear = i.options.getBoolean('clear_log_channel'); const mins = i.options.getInteger('silence_minutes');
  if (clear) delete c.logChannelId; else if (ch) c.logChannelId = ch.id;
  if (mins) c.silenceMinutes = mins;
  store.save();
  return i.reply({ embeds: [ui.success('Recording Configuration', `Log channel: ${c.logChannelId ? `<#${c.logChannelId}>` : '**Not set**'}\nNo-audio timeout: **${c.silenceMinutes || 3} minutes**\n\nRecording starts only with **/record start**. Astrix leaves after the configured period without voice activity and sends explicit downloadable links. A configured log channel is optional; otherwise Astrix creates a private #astrix-recordings storage channel when it has Manage Channels permission.`)], ephemeral: true });
}
async function action(i) {
  let sub = null;
  try { sub = i.options.getSubcommand(false); } catch {}
  if (!sub) { try { sub = i.options.getString('action'); } catch {} }
  sub ||= 'status';
  if (sub === 'start') return start(i); if (sub === 'stop') return stop(i); if (sub === 'config') return config(i); return status(i);
}

async function button(i, customId) {
  const [, act, sessionId] = String(customId || i.customId || '').split(':'); const s = sessions.get(i.guildId);
  if (!s || (sessionId && s.id !== sessionId)) return i.reply({ content: 'This recording panel is no longer active.', ephemeral: true });
  if (act === 'stop') return stop(i);
  if (act === 'refresh') return i.update({ embeds: [panelEmbed(s, i.guild)], components: [controls(s)] });
  if (act === 'privacy') return i.reply({ content: '🔐 Discord manages voice-call encryption. Astrix does not provide a switch to enable or disable Discord encryption; this button only explains the recording privacy state.', ephemeral: true });
  if (!canControl(i, s)) return i.reply({ content: 'Only the recording starter or a server manager can use this control.', ephemeral: true });
  if (act === 'note') {
    const modal = new ModalBuilder().setCustomId(`recordnote:${i.guildId}:${s.id}`).setTitle('Add Recording Note');
    const input = new TextInputBuilder().setCustomId('note').setLabel('Note').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500).setPlaceholder('Add a note about this recording...');
    modal.addComponents(new ActionRowBuilder().addComponents(input)); return i.showModal(modal);
  }
}
async function modal(i) {
  const parts = i.customId.split(':'); if (parts[0] !== 'recordnote') return;
  const s = sessions.get(i.guildId); if (!s || s.id !== parts[2]) return i.reply({ content: 'This recording session is no longer active.', ephemeral: true });
  if (!canControl(i, s)) return i.reply({ content: 'Only the recording starter or a server manager can add notes.', ephemeral: true });
  const note = i.fields.getTextInputValue('note').trim(); s.notes.push({ authorId:i.user.id, text:note, at:Date.now() }); s.notes=s.notes.slice(-25); addActivity(s, `<@${i.user.id}> added a recording note.`); await updatePanel(s);
  return i.reply({ content: 'Recording note saved.', ephemeral: true });
}
async function voiceStateUpdate(oldState, newState) {
  const guildId = newState.guild?.id || oldState.guild?.id; const s = sessions.get(guildId); if (!s || s.stopping) return;
  const uid = newState.id || oldState.id; const user = newState.member?.user || oldState.member?.user; if (user?.bot) return;
  if (oldState.channelId !== s.channelId && newState.channelId === s.channelId) { subscribe(s, uid); addActivity(s, `<@${uid}> joined the recording.`); await updatePanel(s); }
  else if (oldState.channelId === s.channelId && newState.channelId !== s.channelId) { addActivity(s, `<@${uid}> left the recording.`); await updatePanel(s); }
}
module.exports = { action, button, modal, voiceStateUpdate, sessions, finalize };
