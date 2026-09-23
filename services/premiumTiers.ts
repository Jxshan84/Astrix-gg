export interface PremiumTierConfig {
  id: string;
  name: string;
  badge: string;
  tierKey: string;
  limits: {
    reactionRoles: number;
    maxNoPrefixSlots: number;
    aiDailyLimit: number;
    backupIntervalHours: number;
    customEmbedPanels: number;
    tempVoiceChannels: number;
  };
  perks: string[];
  priceINR: number;
  priceUSD: number;
  priceLTC: number;
  customProfileAllowed: boolean;
  prioritySupport: boolean;
  instantCustomCommand: boolean;
}

export const FREE_TIER_LIMITS = {
  reactionRoles: 2,
  maxNoPrefixSlots: 0,
  aiDailyLimit: 25,
  backupIntervalHours: 24,
  customEmbedPanels: 1,
  tempVoiceChannels: 1
};

export const ASTRIX_PREMIUM_TIERS: Record<string, PremiumTierConfig> = {
  tier1: {
    id: 'tier1',
    name: 'Astrix Prestige',
    badge: '⭐',
    tierKey: 'User-Prime',
    limits: {
      reactionRoles: 5,
      maxNoPrefixSlots: 1,
      aiDailyLimit: 100,
      backupIntervalHours: 12,
      customEmbedPanels: 3,
      tempVoiceChannels: 3
    },
    perks: [
      'No-Prefix command execution access (1 slot)',
      'Reaction roles limit increased to 5 panels',
      'AI prompt daily quota increased to 100 requests',
      'Reduced global command cooldowns & higher economy limits',
      'Prior support by Astrix team & owner'
    ],
    priceINR: 49,
    priceUSD: 0.5,
    priceLTC: 0.5,
    customProfileAllowed: false,
    prioritySupport: true,
    instantCustomCommand: false
  },
  tier2: {
    id: 'tier2',
    name: 'Astrix Sovereign',
    badge: '💎',
    tierKey: 'Guild-Prime',
    limits: {
      reactionRoles: 15,
      maxNoPrefixSlots: 2,
      aiDailyLimit: 300,
      backupIntervalHours: 6,
      customEmbedPanels: 10,
      tempVoiceChannels: 10
    },
    perks: [
      'Everything included in Astrix Prestige',
      'Custom bot profile for your guild (custom name, avatar, banner & bio)',
      'No-Prefix Access granted to any 2 members of your guild',
      'Reaction roles limit expanded to 15 active setups',
      'Advanced moderation subcommands and multi-level escalation automod',
      'Automated server backups every 6 hours'
    ],
    priceINR: 149,
    priceUSD: 1.5,
    priceLTC: 1.5,
    customProfileAllowed: true,
    prioritySupport: true,
    instantCustomCommand: false
  },
  tier3: {
    id: 'tier3',
    name: 'Astrix Imperial',
    badge: '🛡️',
    tierKey: 'Max-Prime',
    limits: {
      reactionRoles: 50,
      maxNoPrefixSlots: 5,
      aiDailyLimit: 1000,
      backupIntervalHours: 2,
      customEmbedPanels: 30,
      tempVoiceChannels: 25
    },
    perks: [
      'Everything included in Prestige & Sovereign',
      'Unlimited / Massive reaction roles setup (up to 50 active panels)',
      'Advanced mass moderation, bulk role templates, and deep audit logging',
      'High-speed automated server backups every 2 hours with instant restore',
      'Custom Embed Builder with persistent buttons & dropdown menus (30 panels)',
      'Advanced dynamic Temp-Voice channel generators (up to 25 hubs)',
      'Direct prior support by Astrix owner & priority queue processing'
    ],
    priceINR: 399,
    priceUSD: 4.0,
    priceLTC: 4.0,
    customProfileAllowed: true,
    prioritySupport: true,
    instantCustomCommand: false
  },
  tier4: {
    id: 'tier4',
    name: 'Astrix Royale',
    badge: '👑',
    tierKey: 'Ultimate-Prime',
    limits: {
      reactionRoles: 999, // Unlimited
      maxNoPrefixSlots: 10,
      aiDailyLimit: 9999, // Unlimited / VIP
      backupIntervalHours: 1,
      customEmbedPanels: 999, // Unlimited
      tempVoiceChannels: 999 // Unlimited
    },
    perks: [
      'All features from lower tiers unlocked permanently with absolute zero restrictions',
      'Unlimited Reaction Roles panels and Custom Embed Builders',
      'Unlimited dynamic Temp-Voice channels with customized master controls',
      'Hourly automated secure server state snapshots and instant disaster recovery',
      'Highest rate limits, dedicated processing threads, and priority queue handling',
      'Instant custom command creation requests without queuing or extra approval delay',
      'Ultimate custom branding configuration and VIP concierge support'
    ],
    priceINR: 699,
    priceUSD: 7.0,
    priceLTC: 7.0,
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
