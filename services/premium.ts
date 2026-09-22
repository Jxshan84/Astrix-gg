const store = require('./store.ts');
const dashboardConfigSync = require('./dashboardConfigSync.ts');

const TIERS = {
  free: { rank: 0, name: 'Free', gems: 0, multiplier: 1 },
  premium: { rank: 1, name: 'Premium', gems: 500, multiplier: 1.25 },
  plus: { rank: 2, name: 'Premium+', gems: 1500, multiplier: 1.4 },
  elite: { rank: 3, name: 'Elite', gems: 3000, multiplier: 1.6 }
};

function ownerIds() {
  return new Set([process.env.OWNER_ID || '', ...(process.env.OWNER_IDS || '').split(',')].map(x => x.trim()).filter(Boolean));
}
function isOwner(userId) { return ownerIds().has(userId); }
function normalizeTier(value) { return TIERS[value] ? value : 'premium'; }
function tierName(value) { return TIERS[value]?.name || TIERS.premium.name; }
function activePremium(record) {
  return Boolean(record?.permanent) || Number(record?.until || 0) > Date.now();
}
function globalPremium(userId) {
  return store.snapshot().meta?.premiumUsers?.[String(userId)] || null;
}
function applyPremiumRecord(user, record) {
  if (!record) return user;
  user.premiumTier = normalizeTier(record.tier || 'premium');
  user.premiumPermanent = Boolean(record.permanent);
  user.premiumUntil = user.premiumPermanent ? 0 : Number(record.until || 0);
  user.earlyAccess = Boolean(user.earlyAccess || record.earlyAccess);
  if (record.gems !== undefined) user.premiumGems = Math.max(Number(user.premiumGems || 0), Number(record.gems || 0));
  return user;
}
const syncCache = new Map();
async function syncUserFromDashboard(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const cached = syncCache.get(key);
  if (cached && cached.until > Date.now()) return store.user(guildId, userId);

  const local = globalPremium(userId);
  if (activePremium(local)) applyPremiumRecord(store.user(guildId, userId), local);

  const remote = await dashboardConfigSync.fetchPremiumRecord(userId, guildId);
  if (remote) {
    const tier = remoteTier(remote);
    applyPremiumRecord(store.user(guildId, userId), {
      tier,
      permanent: Boolean(remote.lifetime),
      until: remote.expiresAt ? new Date(remote.expiresAt).getTime() : 0,
    });
    store.save();
  }
  syncCache.set(key, { until: Date.now() + 30000 });
  return store.user(guildId, userId);
}
function tierFor(guildId, targetId, guild = null) {
  if (isOwner(targetId)) return 'elite';
  const global = globalPremium(targetId);
  if (activePremium(global)) return normalizeTier(global.tier || 'premium');
  const g = store.guild(guildId);
  const serverTier = normalizeTier(g.config?.serverPremiumTier || 'free');
  const serverPremiumActive = Boolean(g.config?.serverPremiumPermanent) || Number(g.config?.serverPremiumUntil || 0) > Date.now();
  if (serverPremiumActive && serverTier !== 'free') return serverTier;
  const u = store.user(guildId, targetId);
  const manualActive = u.premiumPermanent || Number(u.premiumUntil || 0) > Date.now();
  if (manualActive) return normalizeTier(u.premiumTier || 'premium');
  const roleId = process.env.PREMIUM_ROLE_ID;
  if (roleId && guild) {
    const member = guild.members.cache.get(targetId);
    if (member?.roles?.cache?.has(roleId)) return normalizeTier(u.premiumTier || 'premium');
  }
  return 'free';
}
function isPremium(interaction, targetId = interaction.user.id) { return tierFor(interaction.guildId, targetId, interaction.guild) !== 'free'; }
function remoteTier(record) {
  if (record?.plan === 'founder') return 'elite';
  if (record?.plan === 'premium_plus') return 'plus';
  return 'premium';
}
async function syncServerFromDashboard(guildId) {
  const guild = store.guild(guildId);
  const localTier = tierFor(guildId, 'SERVER');
  if (localTier !== 'free') return localTier;

  const remote = await dashboardConfigSync.fetchPremiumRecord('SERVER', guildId);
  if (!remote) return 'free';

  const tier = remoteTier(remote);
  guild.config.serverPremiumTier = tier;
  guild.config.serverPremiumPermanent = Boolean(remote.lifetime);
  guild.config.serverPremiumUntil = remote.expiresAt ? new Date(remote.expiresAt).getTime() : 0;
  store.save();
  return tier;
}
function multiplier(interaction) {
  const tier = tierFor(interaction.guildId, interaction.user.id, interaction.guild);
  const fallback = Number(process.env.PREMIUM_ECONOMY_MULTIPLIER || 1.25);
  return tier === 'premium' ? fallback : TIERS[tier]?.multiplier || 1;
}
function requireOwner(interaction) { if (!isOwner(interaction.user.id)) throw new Error('This command is restricted to the configured Astrix owner.'); }
function grantGlobalMembership(userId, { tier = 'premium', days = null, earlyAccess = false, gems = null, activatedBy = null } = {}) {
  tier = normalizeTier(tier);
  const s = store.load();
  const previous = s.meta.premiumUsers[String(userId)] || {};
  const permanent = !days;
  const until = permanent ? 0 : Math.max(Date.now(), Number(previous.until || 0)) + Number(days) * 86400000;
  const award = gems === null || gems === undefined ? TIERS[tier].gems : Math.max(0, Number(gems));
  s.meta.premiumUsers[String(userId)] = {
    tier,
    permanent,
    until,
    earlyAccess: Boolean(earlyAccess || previous.earlyAccess),
    gems: Math.max(Number(previous.gems || 0), Number(award || 0)),
    activatedBy: activatedBy ? String(activatedBy) : null,
  };
  for (const guildId of Object.keys(s.users || {})) {
    if (s.users[guildId]?.[String(userId)]) applyPremiumRecord(store.user(guildId, userId), s.meta.premiumUsers[String(userId)]);
  }
  store.save();
  void dashboardConfigSync.upsertPremiumRecord({ userId, guildId: null, tier, permanent, until, activatedBy }).catch(() => {});
  return { tier, award, record: s.meta.premiumUsers[String(userId)] };
}
function removeGlobalMembership(userId) {
  const s = store.load();
  delete s.meta.premiumUsers[String(userId)];
  for (const guildId of Object.keys(s.users || {})) {
    const u = s.users[guildId]?.[String(userId)];
    if (u) {
      u.premiumPermanent = false;
      u.premiumUntil = 0;
      u.premiumTier = 'free';
      u.earlyAccess = false;
    }
  }
  store.save();
  syncCache.forEach((_value, key) => { if (key.endsWith(`:${userId}`)) syncCache.delete(key); });
  void dashboardConfigSync.deactivatePremiumRecord(userId, null).catch(() => {});
}
function grantMembership(guildId, userId, { tier = 'premium', days = null, earlyAccess = false, gems = null } = {}) {
  const u = store.user(guildId, userId);
  tier = normalizeTier(tier);
  u.premiumTier = tier;
  if (days) {
    const base = Math.max(Date.now(), Number(u.premiumUntil || 0));
    u.premiumUntil = base + Number(days) * 86400000;
    u.premiumPermanent = false;
  } else {
    u.premiumPermanent = true;
    u.premiumUntil = 0;
  }
  if (earlyAccess) u.earlyAccess = true;
  const award = gems === null || gems === undefined ? TIERS[tier].gems : Math.max(0, Number(gems));
  u.premiumGems = Math.max(0, Math.floor(Number(u.premiumGems || 0) + award));
  store.save();
  void dashboardConfigSync.upsertPremiumRecord({
    userId, guildId, tier, permanent: Boolean(u.premiumPermanent), until: Number(u.premiumUntil || 0),
  }).catch(() => {});
  return { user: u, tier, award };
}
function removeMembership(guildId, userId) {
  const u = store.user(guildId, userId);
  u.premiumPermanent = false;
  u.premiumUntil = 0;
  u.premiumTier = 'free';
  store.save();
  void dashboardConfigSync.deactivatePremiumRecord(userId, guildId).catch(() => {});
  return u;
}

module.exports = {
  TIERS, ownerIds, isOwner, isPremium, multiplier, requireOwner, tierFor, tierName,
  normalizeTier, grantMembership, removeMembership, grantGlobalMembership,
  removeGlobalMembership, syncUserFromDashboard, syncServerFromDashboard, globalPremium
};
