// @ts-nocheck
const store = require('./store.ts');
const economy = require('./economy.ts');

const BANK_INTEREST_RATE = 0.25;
const VIRTUAL_MONTH_MS = Math.max(30_000, Number(process.env.ASTRIX_VIRTUAL_MONTH_MS || 3_600_000));

const BANK_TIERS = {
  basic: { label: 'Basic', cost: 0, bonus: 0, interest: 0.25 },
  silver: { label: 'Silver', cost: 250000, bonus: 50000, interest: 0.35 },
  gold: { label: 'Gold', cost: 1000000, bonus: 250000, interest: 0.5 },
  diamond: { label: 'Diamond', cost: 5000000, bonus: 1000000, interest: 0.75 }
};

const LOAN_TYPES = {
  personal: { label: 'Personal', apr: 14, maxMultiplier: 1.0, minScore: 550 },
  business: { label: 'Business', apr: 11, maxMultiplier: 1.35, minScore: 620 },
  emergency: { label: 'Emergency', apr: 22, maxMultiplier: 0.65, minScore: 500 }
};

function bankTierInfo(tier) { return BANK_TIERS[String(tier || 'basic').toLowerCase()] || BANK_TIERS.basic; }

function bankTierUpgrade(u, tier) {
  const key = String(tier || '').toLowerCase();
  const info = BANK_TIERS[key];
  if (!info) throw new Error('Choose a valid bank tier: silver, gold or diamond.');
  const order = ['basic','silver','gold','diamond'];
  const current = order.indexOf(String(u.bankTier || 'basic'));
  const next = order.indexOf(key);
  if (next <= current) throw new Error('You can only upgrade to a higher bank tier.');
  const cost = info.cost;
  const available = Number(u.wallet || 0) + Number(u.bank || 0);
  if (available < cost) throw new Error(`You need ${cost.toLocaleString()} coins for this bank upgrade.`);
  let rem = cost; const w = Math.min(Number(u.wallet || 0), rem); u.wallet -= w; rem -= w; const b = Math.min(Number(u.bank || 0), rem); u.bank -= b;
  u.bankTier = key; u.bankLimit = Math.max(Number(u.bankLimit || 0), Number(u.bank || 0) + info.bonus);
  store.save(); return { tier: key, cost, walletSpent: w, bankSpent: b, bonus: info.bonus, interest: info.interest };
}

function loanTypeInfo(type) {
  return LOAN_TYPES[String(type || 'personal').toLowerCase()] || LOAN_TYPES.personal;
}

function virtualMonthMs() { return VIRTUAL_MONTH_MS; }

function virtualDueText(ts) {
  const remaining = Math.max(0, Number(ts || 0) - Date.now());
  if (!remaining) return 'due now';
  const seconds = Math.ceil(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

function normalizeLoan(u) {
  if (!u.loan) return null;
  u.loan.type ||= 'personal';
  u.loan.autopay = Boolean(u.loan.autopay);
  u.loan.nextDue = Number(u.loan.nextDue || (Date.now() + VIRTUAL_MONTH_MS));
  u.loan.payments = Number(u.loan.payments || 0);
  return u.loan;
}

function applyLoanPayment(u, amount) {
  let remaining = Math.max(0, Math.floor(Number(amount || 0)));
  const available = Number(u.wallet || 0) + Number(u.bank || 0);
  if (available < remaining) return { ok: false, walletSpent: 0, bankSpent: 0, shortfall: remaining - available };

  const walletSpent = Math.min(Number(u.wallet || 0), remaining);
  u.wallet -= walletSpent;
  remaining -= walletSpent;

  const bankSpent = Math.min(Number(u.bank || 0), remaining);
  u.bank -= bankSpent;
  remaining -= bankSpent;

  return { ok: true, walletSpent, bankSpent, shortfall: 0 };
}

function enableAutopay(u) {
  if (!u.loan) throw new Error('You do not have an active virtual loan.');
  u.loan.autopay = true;
  return u.loan;
}

function disableAutopay(u) {
  if (!u.loan) throw new Error('You do not have an active virtual loan.');
  u.loan.autopay = false;
  return u.loan;
}

function bankSummary(u) {
  return {
    wallet: Number(u.wallet || 0),
    bank: Number(u.bank || 0),
    walletLimit: Number(u.walletLimit || 0),
    bankLimit: Number(u.bankLimit || 0),
    netWorth: Number(u.wallet || 0) + Number(u.bank || 0),
    loan: normalizeLoan(u)
  };
}


function processBankInterest(u) {
  if (!u.bankInterestEnabled) {
    u.bankNextInterestAt = Date.now() + VIRTUAL_MONTH_MS;
    return null;
  }
  if (!u.bankNextInterestAt) u.bankNextInterestAt = Date.now() + VIRTUAL_MONTH_MS;
  if (Date.now() < u.bankNextInterestAt) return null;
  const base = Math.max(0, Math.floor(Number(u.bank || 0)));
  const rate = Number(bankTierInfo(u.bankTier).interest || BANK_INTEREST_RATE);
  const interest = Math.min(economy.bankSpace(u), Math.max(0, Math.floor(base * (rate / 100))));
  if (interest > 0) u.bank += interest;
  u.bankNextInterestAt = Date.now() + VIRTUAL_MONTH_MS;
  return interest > 0 ? interest : null;
}

function processDueLoan(u) {
  const loan = normalizeLoan(u);
  if (!loan || !loan.autopay || Date.now() < loan.nextDue) return null;

  const payment = applyLoanPayment(u, Math.min(Number(loan.emi || 0), Number(loan.remaining || 0)));
  if (!payment.ok) {
    loan.autopayMisses = Number(loan.autopayMisses || 0) + 1;
    loan.nextDue = Date.now() + VIRTUAL_MONTH_MS;
    return { status: 'missed', amount: 0, shortfall: payment.shortfall, misses: loan.autopayMisses };
  }

  const paid = Math.min(Number(loan.emi || 0), Number(loan.remaining || 0));
  loan.remaining = Math.max(0, Number(loan.remaining || 0) - paid);
  loan.payments = Number(loan.payments || 0) + 1;
  loan.nextDue = Date.now() + VIRTUAL_MONTH_MS;
  loan.autopayMisses = 0;

  if (loan.remaining <= 0) {
    u.loan = null;
    u.creditScore = Math.min(850, Number(u.creditScore || 650) + 12);
    return { status: 'paid', amount: paid, walletSpent: payment.walletSpent, bankSpent: payment.bankSpent };
  }

  u.creditScore = Math.min(850, Number(u.creditScore || 650) + 2);
  return { status: 'paid', amount: paid, walletSpent: payment.walletSpent, bankSpent: payment.bankSpent };
}

function tick(client) {
  let changed = false;
  for (const guild of client.guilds.cache.values()) {
    const users = store.allUsers(guild.id);
    for (const u of Object.values(users)) {
      const interest = processBankInterest(u);
      const result = processDueLoan(u);
      if (interest === null && !result) continue;
      changed = true;
      // Keep automation quiet in public channels; send a DM only when possible.
      const userId = Object.entries(users).find(([, value]) => value === u)?.[0];
      if (userId && result) {
        guild.members.fetch(userId).then(member => {
          const text = result.status === 'paid'
            ? `🏦 Astrix AutoPay processed **${economy.fmt(result.amount)}** toward your ${u.loan ? 'loan' : 'final loan payment'}.`
            : `⚠️ Astrix AutoPay could not process your loan EMI. Shortfall: **${economy.fmt(result.shortfall)}**. The next virtual cycle will retry.`;
          member.send(text).catch(() => {});
        }).catch(() => {});
      }
    }
  }
  if (changed) store.save();
}

module.exports = {
  LOAN_TYPES,
  BANK_TIERS,
  bankTierInfo,
  bankTierUpgrade,
  VIRTUAL_MONTH_MS,
  loanTypeInfo,
  virtualMonthMs,
  virtualDueText,
  normalizeLoan,
  enableAutopay,
  disableAutopay,
  applyLoanPayment,
  bankSummary,
  BANK_INTEREST_RATE,
  tick
};
