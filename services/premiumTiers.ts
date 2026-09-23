export interface PremiumTierConfig {
  id: string;
  name: string;
  badge: string;
  tierKey: string;
  perks: string[];
  priceINR: number;
  priceUSD: number;
  priceLTC: number;
  maxNoPrefixSlots: number;
  customProfileAllowed: boolean;
  prioritySupport: boolean;
  instantCustomCommand: boolean;
}

export const ASTRIX_PREMIUM_TIERS: Record<string, PremiumTierConfig> = {
  tier1: {
    id: 'tier1',
    name: 'Astrix Prestige',
    badge: '⭐',
    tierKey: 'User-Prime',
    perks: [
      'No-Prefix command execution access',
      'Reduced global command cooldowns',
      'Higher economy daily limits and bonus rewards',
      'Prior support by Astrix team & owner'
    ],
    priceINR: 49,
    priceUSD: 0.5,
    priceLTC: 0.5,
    maxNoPrefixSlots: 1,
    customProfileAllowed: false,
    prioritySupport: true,
    instantCustomCommand: false
  },
  tier2: {
    id: 'tier2',
    name: 'Astrix Sovereign',
    badge: '💎',
    tierKey: 'Guild-Prime',
    perks: [
      'Everything included in Astrix Prestige',
      'Custom bot profile for your guild (custom name, avatar, banner & bio)',
      'No-Prefix Access granted to any 2 members of your guild',
      'Advanced moderation subcommands and multi-level escalation automod',
      'Bot setup assistance by Astrix team'
    ],
    priceINR: 149,
    priceUSD: 1.5,
    priceLTC: 1.5,
    maxNoPrefixSlots: 2,
    customProfileAllowed: true,
    prioritySupport: true,
    instantCustomCommand: false
  },
  tier3: {
    id: 'tier3',
    name: 'Astrix Imperial',
    badge: '🛡️',
    tierKey: 'Max-Prime',
    perks: [
      'Everything included in Prestige & Sovereign',
      'Advanced mass moderation and bulk role templates',
      'Direct prior support by Astrix owner',
      'Priority queue processing and highest rate limits'
    ],
    priceINR: 399,
    priceUSD: 4.0,
    priceLTC: 4.0,
    maxNoPrefixSlots: 5,
    customProfileAllowed: true,
    prioritySupport: true,
    instantCustomCommand: false
  },
  tier4: {
    id: 'tier4',
    name: 'Astrix Royale',
    badge: '👑',
    tierKey: 'Ultimate-Prime',
    perks: [
      'All features from lower tiers unlocked permanently',
      'Highest rate limits and priority queue processing',
      'Instant custom command creation requests without queuing',
      'Ultimate custom branding configuration where Discord permits'
    ],
    priceINR: 699,
    priceUSD: 7.0,
    priceLTC: 7.0,
    maxNoPrefixSlots: 10,
    customProfileAllowed: true,
    prioritySupport: true,
    instantCustomCommand: true
  }
};

export function getTierConfig(tierIdOrKey: string): PremiumTierConfig | null {
  const query = tierIdOrKey.toLowerCase().trim();
  for (const key of Object.keys(ASTRIX_PREMIUM_TIERS)) {
    const tier = ASTRIX_PREMIUM_TIERS[key];
    if (
      tier.id.toLowerCase() === query ||
      tier.name.toLowerCase() === query ||
      tier.tierKey.toLowerCase() === query
    ) {
      return tier;
    }
  }
  return null;
}
