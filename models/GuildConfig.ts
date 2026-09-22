const mongoose = require('mongoose');
const { Schema } = mongoose;

const commandSchema = new Schema({
  enabled: { type: Boolean, default: true },
  cooldown: { type: Number, default: 3, min: 0, max: 3600 },
  channelAccess: { type: String, enum: ['all', 'allowed', 'blocked'], default: 'all' },
  channelIds: { type: [String], default: [] },
  roleIds: { type: [String], default: [] }
}, { _id: false });

const moderationSchema = new Schema({
  enabled: { type: Boolean, default: true },
  moderatorRoleIds: { type: [String], default: [] },
  logChannelId: { type: String, default: null },
  requireReason: { type: Boolean, default: true },
  dmModeratedUser: { type: Boolean, default: true },
  caseNumbers: { type: Boolean, default: true },
  moderatorAudit: { type: Boolean, default: true },
  commands: {
    ban: { type: commandSchema, default: () => ({}) },
    unban: { type: commandSchema, default: () => ({}) },
    kick: { type: commandSchema, default: () => ({}) },
    timeout: { type: commandSchema, default: () => ({}) },
    untimeout: { type: commandSchema, default: () => ({}) },
    warn: { type: commandSchema, default: () => ({}) },
    warnings: { type: commandSchema, default: () => ({}) },
    clearwarns: { type: commandSchema, default: () => ({}) },
    purge: { type: commandSchema, default: () => ({}) },
    lock: { type: commandSchema, default: () => ({}) },
    unlock: { type: commandSchema, default: () => ({}) },
    slowmode: { type: commandSchema, default: () => ({}) },
    nickname: { type: commandSchema, default: () => ({}) },
    role: { type: commandSchema, default: () => ({}) }
  }
}, { _id: false });

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  // Dashboard-created documents may exist before the bot has cached the guild name.
  guildName: { type: String, default: '' },
  dashboardManaged: { type: Schema.Types.Mixed, default: undefined },
  moderation: { type: moderationSchema, default: () => ({}) },
  // The dashboard owns these detailed schemas. Mixed prevents the bot model from
  // stripping fields when the dashboard adds new controls later.
  welcome: { type: Schema.Types.Mixed, default: undefined },
  leave: { type: Schema.Types.Mixed, default: undefined },
  automod: { type: Schema.Types.Mixed, default: undefined },
  security: { type: Schema.Types.Mixed, default: undefined }
  ,music247: { type: Schema.Types.Mixed, default: () => ({ enabled: false, is247: false, channelId: null, textChannelId: null, autoplay: false, lastTrack: null, enabledBy: null }) }
}, {
  timestamps: true,
  minimize: false,
  collection: 'guildconfigs'
});

module.exports = mongoose.models.GuildConfig || mongoose.model('GuildConfig', guildConfigSchema);
