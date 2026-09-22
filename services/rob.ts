const store = require('./store.ts');
const economy = require('./economy.ts');

const COOLDOWN_MS = Math.max(900_000, Number(process.env.ROB_COOLDOWN_MS || 900_000));

function cooldownLeft(user) {
  return Math.max(0, Number(user.robCooldownUntil || 0) - Date.now());
}

function rob(guildId, robberId, targetId) {
  if (!targetId || robberId === targetId) throw new Error('Choose another user to rob.');
  const robber = store.user(guildId, robberId);
  const target = store.user(guildId, targetId);
  if (cooldownLeft(robber) > 0) {
    throw new Error(`Rob is on cooldown. Try again <t:${Math.ceil((Date.now() + cooldownLeft(robber)) / 1000)}:R>.`);
  }
  if (Number(target.wallet || 0) + Number(target.bank || 0) < 100) {
    throw new Error('That user does not have enough coins to rob.');
  }

  robber.robCooldownUntil = Date.now() + COOLDOWN_MS;
  if (Number(target.robLockCharges || 0) > 0) {
    target.robLockCharges = Math.max(0, Number(target.robLockCharges || 0) - 1);
    store.save();
    return { success: false, protected: true, protection: 'lock', locksRemaining: target.robLockCharges, amount: 0 };
  }
  if (target.robMine) {
    target.robMine = null;
    const blast = Math.min(
      Number(robber.wallet || 0) + Number(robber.bank || 0),
      Math.floor(300 + Math.random() * 1201)
    );
    const walletPart = Math.min(Number(robber.wallet || 0), blast);
    robber.wallet -= walletPart;
    robber.bank = Math.max(0, Number(robber.bank || 0) - (blast - walletPart));
    economy.creditCoins(target, blast);
    store.save();
    return { success: false, protected: true, protection: 'mine', fine: blast, amount: 0 };
  }

  const success = Math.random() < 0.48;
  if (!success) {
    const fine = Math.min(
      Number(robber.wallet || 0) + Number(robber.bank || 0),
      Math.floor(50 + Math.random() * 451)
    );
    const walletPart = Math.min(Number(robber.wallet || 0), fine);
    robber.wallet -= walletPart;
    const bankPart = fine - walletPart;
    robber.bank = Math.max(0, Number(robber.bank || 0) - bankPart);
    economy.creditCoins(target, fine);
    store.save();
    return { success: false, fine, amount: 0, paidTo: targetId };
  }

  const available = Math.max(0, Math.floor(Number(target.wallet || 0)));
  const amount = Math.max(100, Math.min(available, Math.floor(available * (0.08 + Math.random() * 0.13))));
  target.wallet -= amount;
  economy.creditCoins(robber, amount);
  store.save();
  return { success: true, amount, targetWallet: target.wallet };
}

module.exports = { rob, COOLDOWN_MS };