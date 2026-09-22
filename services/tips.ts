const WORK_TIPS = [
  'Tip: `/work list` shows the next jobs you can unlock as you level up.',
  'Tip: Use `/work apply` to switch to any career you have unlocked.',
  'Tip: `/work stats` shows your success rate, earnings, reputation and best streak.',
  'Tip: `/work history` keeps your latest shift results so you can track your progress.',
  'Tip: Resigning does not delete your completed shifts, XP, earnings or work history.',
  'Tip: Faster correct answers give your shift a better grade and a bigger payout.',
  'Tip: Chat activity also gives automatic XP, so keep the server conversations going.',
  'Tip: Use `/balance` after a shift to see your wallet, bank and net worth together.',
];

const SHOP_TIPS = [
  'Tip: Premium discounts are applied automatically; there is no separate Premium shop.',
  'Tip: Buy an XP pack when you want to push toward the next level faster.',
  'Tip: Use the Selling tab to turn duplicate collectibles back into coins.',
  'Tip: Market stock refreshes automatically, so check back later for new items.',
];

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

module.exports = {
  work: () => pick(WORK_TIPS),
  workAll: () => [...WORK_TIPS],
  shop: () => pick(SHOP_TIPS),
};