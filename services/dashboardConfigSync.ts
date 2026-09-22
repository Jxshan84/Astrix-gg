// @ts-nocheck
const GuildConfig = require('../models/GuildConfig.ts');
const PremiumModel = require('../models/Premium.ts');
const guildConfigService = require('./guildConfigService.ts');
const store = require('./store.ts');

const appliedSignatures = new Map();

function planFromTier(tier) {
  if (tier === 'elite') return 'founder';
  if (tier === 'plus') return 'premium_plus';
  return 'premium';
}

function mergeAutoMod(localValue, dashboardValue) {
  if (!dashboardValue || typeof dashboardValue !== 'object') return localValue || {};
  const output = { ...(localValue || {}), ...dashboardValue };
  output.settings = { ...(localValue?.settings || {}), ...(dashboardValue.settings || {}) };
  for (const key of ['spam', 'duplicate', 'links', 'invites', 'phishing', 'mentions', 'caps', 'emoji', 'badwords', 'nsfw']) {
    if (dashboardValue[key]) output[key] = { ...(localValue?.[key] || {}), ...dashboardValue[key] };
  }
  return output;
}

function mergeSecurity(localValue, dashboardValue) {
  if (!dashboardValue || typeof dashboardValue !== 'object') return localValue || {};
  return {
    ...(localValue || {}),
    ...dashboardValue,
    antinuke: { ...(localValue?.antinuke || {}), ...(dashboardValue.antinuke || {}) },
    antiraid: { ...(localValue?.antiraid || {}), ...(dashboardValue.antiraid || {}) },
    antibot: { ...(localValue?.antibot || {}), ...(dashboardValue.antibot || {}) },
    // Runtime lockdown state is intentionally local and must not be overwritten by the dashboard.
    lockdown: localValue?.lockdown || { active: false, states: {} },
    lastBackupAt: localValue?.lastBackupAt || 0,
  };
}

async function syncGuild(guildId) {
  const document = await guildConfigService.getGuildConfig(guildId).catch(() => null);
  if (!document) return null;

  const managed = document.dashboardManaged || {};
  const signature = `${document.updatedAt ? new Date(document.updatedAt).getTime() : 0}:${managed.automod === true ? 1 : 0}:${managed.security === true ? 1 : 0}`;
  if (appliedSignatures.get(guildId) === signature) return document;

  const guildData = store.guild(guildId);
  let changed = false;

  if (managed.automod === true && document.automod) {
    guildData.config.automod = mergeAutoMod(guildData.config.automod, document.automod);
    changed = true;
  }

  if (managed.security === true && document.security) {
    guildData.security = mergeSecurity(guildData.security, document.security);
    changed = true;
  }

  if (changed) store.save();
  appliedSignatures.set(guildId, signature);
  return document;
}

async function persistAutoMod(guildId, automod, guildName = '') {
  if (!process.env.MONGODB_URI) return false;
  const connected = await guildConfigService.init();
  if (!connected) return false;
  try {
    await GuildConfig.findOneAndUpdate(
      { guildId },
      {
        $set: {
          automod,
          ...(guildName ? { guildName } : {}),
          'dashboardManaged.automod': true,
        },
        $setOnInsert: { guildId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    guildConfigService.clearGuildCache(guildId);
    appliedSignatures.delete(guildId);
    return true;
  } catch (error) {
    console.error(`Failed to persist AutoMod dashboard config for guild ${guildId}:`, error.message);
    return false;
  }
}

async function persistSecurity(guildId, security, guildName = '') {
  if (!process.env.MONGODB_URI) return false;
  const connected = await guildConfigService.init();
  if (!connected) return false;
  try {
    const clean = {
      antinuke: security?.antinuke || {},
      antiraid: security?.antiraid || {},
      antibot: security?.antibot || {},
      trusted: Array.isArray(security?.trusted) ? security.trusted : [],
      allowedBots: Array.isArray(security?.allowedBots) ? security.allowedBots : [],
    };
    await GuildConfig.findOneAndUpdate(
      { guildId },
      {
        $set: {
          security: clean,
          ...(guildName ? { guildName } : {}),
          'dashboardManaged.security': true,
        },
        $setOnInsert: { guildId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    guildConfigService.clearGuildCache(guildId);
    appliedSignatures.delete(guildId);
    return true;
  } catch (error) {
    console.error(`Failed to persist Security dashboard config for guild ${guildId}:`, error.message);
    return false;
  }
}

async function upsertPremiumRecord({ userId, guildId = null, tier = 'premium', permanent = false, until = 0, activatedBy = null }) {
  if (!process.env.MONGODB_URI) return false;
  const connected = await guildConfigService.init();
  if (!connected) return false;
  try {
    const expiresAt = permanent || !Number(until) ? null : new Date(Number(until));
    await PremiumModel.findOneAndUpdate(
      { userId: String(userId), guildId: guildId ? String(guildId) : null },
      {
        $set: {
          plan: planFromTier(tier),
          active: permanent || Number(until) > Date.now(),
          lifetime: Boolean(permanent),
          expiresAt,
          activatedBy: activatedBy ? String(activatedBy) : null,
          source: 'astrix_bot',
        },
        $setOnInsert: { userId: String(userId), guildId: guildId ? String(guildId) : null },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return true;
  } catch (error) {
    console.error('Failed to sync Premium record to MongoDB:', error.message);
    return false;
  }
}

async function fetchPremiumRecord(userId, guildId = null) {
  if (!process.env.MONGODB_URI) return null;
  const connected = await guildConfigService.init();
  if (!connected) return null;
  try {
    const query = {
      userId: String(userId),
      active: true,
      $or: [
        { guildId: guildId ? String(guildId) : null },
        { guildId: null },
      ],
    };
    const rows = await PremiumModel.find(query).sort({ guildId: 1, createdAt: -1 }).lean();
    const now = Date.now();
    return rows.find(row => Boolean(row.lifetime) || !row.expiresAt || new Date(row.expiresAt).getTime() > now) || null;
  } catch (error) {
    console.error('Failed to fetch Premium record from MongoDB:', error.message);
    return null;
  }
}

async function deactivatePremiumRecord(userId, guildId = null) {
  if (!process.env.MONGODB_URI) return false;
  const connected = await guildConfigService.init();
  if (!connected) return false;
  try {
    await PremiumModel.updateMany(
      { userId: String(userId), guildId: guildId ? String(guildId) : null },
      { $set: { active: false, lifetime: false, expiresAt: new Date() } },
    );
    return true;
  } catch (error) {
    console.error('Failed to deactivate Premium record in MongoDB:', error.message);
    return false;
  }
}

async function migrateLocalPremiumStore() {
  if (!process.env.MONGODB_URI) return;
  const snapshot = store.snapshot();
  const tasks = [];

  for (const [guildId, users] of Object.entries(snapshot.users || {})) {
    for (const [userId, user] of Object.entries(users || {})) {
      const permanent = Boolean(user?.premiumPermanent);
      const until = Number(user?.premiumUntil || 0);
      if (!permanent && until <= Date.now()) continue;
      tasks.push(upsertPremiumRecord({
        userId,
        guildId,
        tier: user?.premiumTier || 'premium',
        permanent,
        until,
      }));
    }
  }

  for (const [guildId, guildData] of Object.entries(snapshot.guilds || {})) {
    const config = guildData?.config || {};
    const permanent = Boolean(config.serverPremiumPermanent);
    const until = Number(config.serverPremiumUntil || 0);
    const tier = config.serverPremiumTier || 'free';
    if (tier === 'free' || (!permanent && until <= Date.now())) continue;
    tasks.push(upsertPremiumRecord({
      userId: 'SERVER',
      guildId,
      tier,
      permanent,
      until,
    }));
  }

  if (tasks.length) {
    await Promise.allSettled(tasks);
    console.log(`Dashboard Premium sync checked ${tasks.length} active local Premium record(s).`);
  }
}

module.exports = {
  syncGuild,
  persistAutoMod,
  persistSecurity,
  upsertPremiumRecord,
  fetchPremiumRecord,
  deactivatePremiumRecord,
  migrateLocalPremiumStore,
};
