const MAX_DISCORD_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function parseDuration(input, options: any = {}) {
  const raw = String(input || '').trim().toLowerCase();
  const match = raw.match(/^(\d+)(m|h|d|w)$/);
  if (!match) throw new Error('Use a duration like `30m`, `2h`, `3d`, or `1w`.');

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Duration must be at least 1 minute.');

  const multipliers = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const ms = value * multipliers[unit];
  const minMs = Number(options.minMs || 60000);
  const maxMs = Number(options.maxMs || MAX_DISCORD_TIMEOUT_MS);
  if (ms < minMs || ms > maxMs) {
    throw new Error(`Duration must be between ${formatDuration(minMs)} and ${formatDuration(maxMs)}.`);
  }
  return ms;
}

function formatDuration(ms) {
  const value = Math.max(0, Math.floor(Number(ms) || 0));
  if (value % 604800000 === 0) return `${value / 604800000}w`;
  if (value % 86400000 === 0) return `${value / 86400000}d`;
  if (value % 3600000 === 0) return `${value / 3600000}h`;
  return `${Math.max(1, Math.round(value / 60000))}m`;
}

module.exports = { parseDuration, formatDuration, MAX_DISCORD_TIMEOUT_MS };
