
const store = require('./store.ts');

function get(guildId) {
  const g = store.guild(guildId);
  g.settings ||= {};
  if (g.settings.xpLevelupChannelId === undefined) g.settings.xpLevelupChannelId = null;
  if (g.settings.newsChannelId === undefined) g.settings.newsChannelId = null;
  if (g.settings.inviteLogChannelId === undefined) g.settings.inviteLogChannelId = null;
  if (g.settings.aiChannelId === undefined) g.settings.aiChannelId = null;
  if (g.settings.statusChannelId === undefined) g.settings.statusChannelId = null;
  if (g.settings.statusMessageId === undefined) g.settings.statusMessageId = null;
  return g.settings;
}

function setXpChannel(guildId, channelId) {
  const s = get(guildId);
  s.xpLevelupChannelId = channelId;
  store.save();
  return s;
}

function clearXpChannel(guildId) {
  const s = get(guildId);
  s.xpLevelupChannelId = null;
  store.save();
  return s;
}

function setNewsChannel(guildId, channelId) {
  const s = get(guildId);
  s.newsChannelId = channelId;
  store.save();
  return s;
}

function clearNewsChannel(guildId) {
  const s = get(guildId);
  s.newsChannelId = null;
  store.save();
  return s;
}

function setInviteLogChannel(guildId, channelId) {
  const s = get(guildId);
  s.inviteLogChannelId = channelId;
  store.save();
  return s;
}

function clearInviteLogChannel(guildId) {
  const s = get(guildId);
  s.inviteLogChannelId = null;
  store.save();
  return s;
}

function setAiChannel(guildId, channelId) {
  const s = get(guildId);
  s.aiChannelId = channelId;
  store.save();
  return s;
}

function clearAiChannel(guildId) {
  const s = get(guildId);
  s.aiChannelId = null;
  store.save();
  return s;
}

function setStatusChannel(guildId, channelId) {
  const s = get(guildId);
  s.statusChannelId = channelId;
  s.statusMessageId = null;
  store.save();
  return s;
}

function clearStatusChannel(guildId) {
  const s = get(guildId);
  s.statusChannelId = null;
  s.statusMessageId = null;
  store.save();
  return s;
}

function setStatusMessage(guildId, messageId) {
  const s = get(guildId);
  s.statusMessageId = messageId;
  store.save();
  return s;
}

function setLogChannel(guildId, channelId) {
  const g = store.guild(guildId);
  g.config ||= {};
  g.config.logChannelId = channelId;
  store.save();
  return g.config;
}

function clearLogChannel(guildId) {
  const g = store.guild(guildId);
  g.config ||= {};
  delete g.config.logChannelId;
  store.save();
  return g.config;
}

module.exports = {
  get,
  setXpChannel,
  clearXpChannel,
  setNewsChannel,
  clearNewsChannel,
  setInviteLogChannel,
  clearInviteLogChannel,
  setAiChannel,
  clearAiChannel,
  setStatusChannel,
  clearStatusChannel,
  setStatusMessage,
  save: store.save,
  setLogChannel,
  clearLogChannel
};
