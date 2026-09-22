const mongoose = require('mongoose');
const GuildConfig = require('../models/GuildConfig.ts');

const DEFAULT_COMMAND = Object.freeze({
  enabled: true,
  cooldown: 3,
  channelAccess: 'all',
  channelIds: [],
  roleIds: []
});

const cache = new Map();
const cooldowns = new Map();
const CACHE_MS = Math.max(1000, Number(process.env.DASHBOARD_CONFIG_CACHE_MS || 10000));
let connectPromise = null;

async function init() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('Dashboard config sync disabled: MONGODB_URI is not configured.');
    return false;
  }
  if (mongoose.connection.readyState === 1) return true;
  if (!connectPromise) {
    connectPromise = mongoose.connect(uri, { bufferCommands: false })
      .then(() => {
        console.log('Dashboard config MongoDB connected.');
        return true;
      })
      .catch(error => {
        connectPromise = null;
        console.error('Dashboard config MongoDB connection failed:', error.message);
        return false;
      });
  }
  return connectPromise;
}

function normalizeCommand(raw) {
  if (!raw) return { ...DEFAULT_COMMAND, channelIds: [], roleIds: [] };
  return {
    enabled: raw.enabled !== false,
    cooldown: Math.max(0, Math.min(3600, Number(raw.cooldown ?? 3) || 0)),
    channelAccess: ['all', 'allowed', 'blocked'].includes(raw.channelAccess) ? raw.channelAccess : 'all',
    channelIds: Array.isArray(raw.channelIds) ? raw.channelIds.map(String) : [],
    roleIds: Array.isArray(raw.roleIds) ? raw.roleIds.map(String) : []
  };
}

async function getGuildConfig(guildId) {
  if (!process.env.MONGODB_URI) return null;
  const now = Date.now();
  const hit = cache.get(guildId);
  if (hit && hit.expiresAt > now) return hit.value;
  const connected = await init();
  if (!connected) return null;
  try {
    const value = await GuildConfig.findOne({ guildId }).lean();
    cache.set(guildId, { value, expiresAt: now + CACHE_MS });
    return value;
  } catch (error) {
    console.error(`Failed to read dashboard config for guild ${guildId}:`, error.message);
    return null;
  }
}

async function getModerationContext(guildId, commandName) {
  const guildConfig = await getGuildConfig(guildId);
  const moderation = guildConfig?.moderation || null;
  const command = normalizeCommand(moderation?.commands?.[commandName]);
  if (moderation?.enabled === false) command.enabled = false;
  return { guildConfig, moderation, command };
}

function isChannelAllowed(channelId, command) {
  if (command.channelAccess === 'allowed') return command.channelIds.includes(channelId);
  if (command.channelAccess === 'blocked') return !command.channelIds.includes(channelId);
  return true;
}

function memberRoleIds(interaction) {
  const cacheRoles = interaction.member?.roles?.cache;
  if (cacheRoles?.keys) return [...cacheRoles.keys()];
  const raw = interaction.member?.roles;
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function hasConfiguredRole(interaction, moderation, command) {
  const required = [
    ...(Array.isArray(moderation?.moderatorRoleIds) ? moderation.moderatorRoleIds : []),
    ...(Array.isArray(command?.roleIds) ? command.roleIds : [])
  ].map(String);
  if (!required.length) return true;
  const roles = memberRoleIds(interaction);
  return required.some(id => roles.includes(id));
}

function checkCooldown(interaction, commandName, seconds) {
  const duration = Math.max(0, Number(seconds || 0)) * 1000;
  if (!duration) return 0;
  const key = `${interaction.guildId}:${commandName}:${interaction.user.id}`;
  const now = Date.now();
  const until = cooldowns.get(key) || 0;
  if (until > now) return until - now;
  cooldowns.set(key, now + duration);
  return 0;
}

function clearGuildCache(guildId) {
  cache.delete(guildId);
}

module.exports = {
  init,
  getGuildConfig,
  getModerationContext,
  isChannelAllowed,
  hasConfiguredRole,
  checkCooldown,
  clearGuildCache
};
