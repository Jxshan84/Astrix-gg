const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
let state;

function defaultWalletLimit() {
  return Math.max(1000, Number(process.env.DEFAULT_WALLET_LIMIT || 10000));
}

function defaultBankLimit() {
  return Math.max(1000, Number(process.env.DEFAULT_BANK_LIMIT || 10000));
}


function levelScaledLimit(level, multiplier = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  const growth = 10000 * Math.pow(10, (safeLevel - 1) / 15);
  return Math.min(8_000_000_000_000_000, Math.max(10000, Math.floor(growth * multiplier)));
}

function levelWalletLimit(level) {
  return levelScaledLimit(level, 1);
}

function levelBankLimit(level) {
  return levelScaledLimit(level, 4);
}

function syncCapacity(u) {
  const walletFloor = Math.max(defaultWalletLimit(), levelWalletLimit(u.level));
  const bankFloor = Math.max(defaultBankLimit(), levelBankLimit(u.level));
  u.walletLimit = Math.max(walletFloor, Number(u.walletLimit || 0), Number(u.wallet || 0));
  u.bankLimit = Math.max(bankFloor, Number(u.bankLimit || 0), Number(u.bank || 0));
  return u;
}

function load(): any {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    state = { users: {}, guilds: {}, meta: { version: 6, premiumUsers: {} } };
  }
  state.users ||= {};
  state.guilds ||= {};
  state.meta ||= { version: 6 };
  state.meta.version = Math.max(Number(state.meta.version || 0), 6);
  state.meta.premiumUsers ||= {};
  return state;
}

function save() {
  load();
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

function guild(guildId): any {
  const s = load();
  s.guilds[guildId] ||= {
    config: {},
    warnings: {},
    reactionRoles: [],
    roleMenus: [],
    security: {},
    shop: {},
    music247: {
      enabled: false,
      is247: false,
      channelId: null,
      textChannelId: null,
      autoplay: false,
      lastTrack: null,
      enabledBy: null,
      lastResetDay: ''
    },
    liveLogs: {
      dashboardMessageId: null,
      dashboardChannelId: null,
       categoryMessageIds: {
         messages: null,
         voice: null,
         moderation: null,
         invites: null
       },
      messageTotal: 0,
      messageCounts: {},
      voiceTotals: {},
      voiceSessions: {},
       moderation: [],
       inviteTotal: 0,
       inviteCounts: {}
    },
    incidents: []
  };
  const g = s.guilds[guildId];
  g.music247 ||= {};
  g.music247.is247 = Boolean(g.music247.is247 ?? g.music247.enabled);
  if (g.music247.enabled === undefined) g.music247.enabled = false;
  if (g.music247.channelId === undefined) g.music247.channelId = null;
  if (g.music247.textChannelId === undefined) g.music247.textChannelId = null;
  g.music247.autoplay = Boolean(g.music247.autoplay);
  if (g.music247.lastTrack && typeof g.music247.lastTrack !== 'object') g.music247.lastTrack = null;
  if (g.music247.enabledBy === undefined) g.music247.enabledBy = null;
  g.music247.lastResetDay ||= '';
  g.liveLogs ||= {};
  if (g.liveLogs.dashboardMessageId === undefined) g.liveLogs.dashboardMessageId = null;
  if (g.liveLogs.dashboardChannelId === undefined) g.liveLogs.dashboardChannelId = null;
   g.liveLogs.categoryMessageIds ||= {
     messages: g.liveLogs.dashboardMessageId || null,
     voice: null,
     moderation: null,
     invites: null
   };
   for (const category of ['messages', 'voice', 'moderation', 'invites']) {
     if (g.liveLogs.categoryMessageIds[category] === undefined) {
       g.liveLogs.categoryMessageIds[category] = category === 'messages'
         ? (g.liveLogs.dashboardMessageId || null)
         : null;
     }
   }
  g.liveLogs.messageTotal = Math.max(0, Number(g.liveLogs.messageTotal || 0));
  g.liveLogs.messageCounts ||= {};
  g.liveLogs.voiceTotals ||= {};
  g.liveLogs.voiceSessions ||= {};
  if (!Array.isArray(g.liveLogs.moderation)) g.liveLogs.moderation = [];
   g.liveLogs.inviteTotal = Math.max(0, Number(g.liveLogs.inviteTotal || 0));
   g.liveLogs.inviteCounts ||= {};
  return g;
}

function user(guildId, userId): any {
  const s = load();
  s.users[guildId] ||= {};
  s.users[guildId][userId] ||= {
    wallet: 10000,
    bank: 10000,
    walletLimit: defaultWalletLimit(),
    bankLimit: defaultBankLimit(),
    xp: 0,
    level: 1,
    inventory: {},
    crates: 1,
    weaponCrates: 0,
    crateLoot: {},
    weaponLoot: {},
    badges: [],
    job: null,
    shifts: 0,
    successfulShifts: 0,
    failedShifts: 0,
    totalWorkMinutes: 0,
    totalWorkEarnings: 0,
    workXp: 0,
    workReputation: 0,
    workStreak: 0,
    bestWorkStreak: 0,
    workHistory: [],
    workDmEnabled: true,
    workNotifyPending: false,
    workNotifyAt: 0,
    workDay: '',
    shiftsToday: 0,
    shift: null,
    shiftCooldownUntil: 0,
    creditScore: 650,
    bankInterestEnabled: true,
    bankNextInterestAt: 0,
    bankTier: 'basic',
    bankLedger: [],
    loan: null,
    marriage: null,
    invites: { regular: 0, joins: 0, leaves: 0, fake: 0, lastJoinAt: 0 },
    invitedBy: null,
     inviterTag: null,
    inviteCode: null,
    invitedAt: 0,
    xpCooldownUntil: 0,
    robCooldownUntil: 0,
    robLockCharges: 0,
    robMine: null,
    premiumUntil: 0,
    premiumPermanent: false,
    premiumTier: 'free',
    premiumGems: 0,
    earlyAccess: false,
    privacyAcceptedVersion: '',
    privacyAcceptedAt: 0,
     owoDaily: { streak: 0, lastClaimAt: 0 },
     autoHunt: { enabled: false, channelId: null, nextAt: 0 },
    cooldowns: {},
    boosts: {},
    ai: { day: '', usage: {}, cooldowns: {} }
  };

  const u = s.users[guildId][userId];
  u.wallet = Math.max(0, Math.floor(Number(u.wallet || 0)));
  u.bank = Math.max(0, Math.floor(Number(u.bank || 0)));
  // Existing balances are preserved, while capacity also grows automatically with level.
  syncCapacity(u);
  u.inventory ||= {};
  // The crate was renamed in v8.5. Existing inventories remain usable.
  if (Number(u.inventory.astrix_crate || 0) > 0) {
    u.inventory.only_crate = Number(u.inventory.only_crate || 0) + Number(u.inventory.astrix_crate);
    delete u.inventory.astrix_crate;
  }
  // Preserve zero crates after the user opens their last one. Previously this
  // migration reset zero back to one on every read.
  const crateCount = Number(u.crates);
  u.crates = Number.isFinite(crateCount)
    ? Math.max(0, Math.floor(crateCount))
    : Math.max(1, Math.floor(Number(u.level || 1)));
  u.crateLoot ||= {};
  u.weaponCrates = Math.max(0, Math.floor(Number(u.weaponCrates || 0)));
  u.weaponLoot ||= {};
  if (u.marriage !== null && typeof u.marriage !== 'object') u.marriage = null;
  if (u.marriage?.partnerId) {
    u.marriage.stats ||= { giftsSent: 0, giftsReceived: 0, giftCoins: 0 };
    u.marriage.achievements ||= [];
  }
  u.invites ||= { regular: 0, joins: 0, leaves: 0, fake: 0, lastJoinAt: 0 };
  u.invitedBy = u.invitedBy || null;
   u.inviterTag = u.inviterTag || null;
  u.inviteCode = u.inviteCode || null;
  u.invitedAt = Number(u.invitedAt || 0);
  u.xpCooldownUntil = Number(u.xpCooldownUntil || 0);
  u.badges ||= [];
  u.cooldowns ||= {};
  u.owoDaily ||= { streak: 0, lastClaimAt: 0 };
  u.owoDaily.streak = Math.max(0, Number(u.owoDaily.streak || 0));
  u.owoDaily.lastClaimAt = Number(u.owoDaily.lastClaimAt || 0);
  u.autoHunt ||= { enabled: false, channelId: null, nextAt: 0 };
  u.autoHunt.enabled = Boolean(u.autoHunt.enabled);
  u.autoHunt.channelId = u.autoHunt.channelId ? String(u.autoHunt.channelId) : null;
  u.autoHunt.nextAt = Number(u.autoHunt.nextAt || 0);
  u.boosts ||= {};
  u.workHistory ||= [];
  u.successfulShifts = Math.max(0, Number(u.successfulShifts || 0));
  u.failedShifts = Math.max(0, Number(u.failedShifts || 0));
  u.totalWorkEarnings = Math.max(0, Number(u.totalWorkEarnings || 0));
  u.workXp = Math.max(0, Number(u.workXp || 0));
  u.workReputation = Number(u.workReputation || 0);
  u.workStreak = Math.max(0, Number(u.workStreak || 0));
  u.bestWorkStreak = Math.max(0, Number(u.bestWorkStreak || 0));
  if (u.workDmEnabled === undefined) u.workDmEnabled = true;
  u.workNotifyPending = Boolean(u.workNotifyPending);
  u.workNotifyAt = Number(u.workNotifyAt || 0);
  u.workDay ||= '';
  u.shiftsToday = Math.max(0, Number(u.shiftsToday || 0));
  u.ai ||= { day: '', usage: {}, cooldowns: {} };
  u.bankInterestEnabled = u.bankInterestEnabled !== false;
  u.bankTier ||= 'basic';
  u.bankLedger ||= [];
  u.bankNextInterestAt = Number(u.bankNextInterestAt || 0);
  u.premiumTier ||= (u.premiumPermanent || Number(u.premiumUntil || 0) > Date.now()) ? 'premium' : 'free';
  u.premiumGems = Math.max(0, Math.floor(Number(u.premiumGems || 0)));
  u.earlyAccess = Boolean(u.earlyAccess);
  return u;
}

function allUsers(guildId): any {
  load();
  return state.users[guildId] || {};
}

function snapshot(): any {
  return JSON.parse(JSON.stringify(load()));
}

module.exports = {
  load,
  save,
  guild,
  user,
  allUsers,
  snapshot,
  DB_PATH,
  defaultWalletLimit,
  defaultBankLimit,
  levelWalletLimit,
  levelBankLimit,
  syncCapacity
};
