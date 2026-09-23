import { ASTRIX_PREMIUM_TIERS, getTierConfig, PremiumTierConfig } from './premiumTiers';

export interface UserSubscription {
  userId: string;
  tierId: string;
  expiresAt: number;
  assignedBy: string;
}

export interface GuildSubscription {
  guildId: string;
  tierId: string;
  noPrefixUsers: string[];
  expiresAt: number;
}

// In-memory cache layer backed by your database persistence handler
const userSubscriptions = new Map<string, UserSubscription>();
const guildSubscriptions = new Map<string, GuildSubscription>();

export class PremiumService {
  /**
   * Check if a user has an active premium subscription
   */
  public static async getUserTier(userId: string): Promise<PremiumTierConfig | null> {
    const sub = userSubscriptions.get(userId);
    if (!sub) return null;

    if (Date.now() > sub.expiresAt) {
      userSubscriptions.delete(userId);
      return null;
    }

    return getTierConfig(sub.tierId);
  }

  /**
   * Check if a guild has an active premium subscription
   */
  public static async getGuildTier(guildId: string): Promise<PremiumTierConfig | null> {
    const sub = guildSubscriptions.get(guildId);
    if (!sub) return null;

    if (Date.now() > sub.expiresAt) {
      guildSubscriptions.delete(guildId);
      return null;
    }

    return getTierConfig(sub.tierId);
  }

  /**
   * Grant subscription to a user
   */
  public static async setUserTier(userId: string, tierKeyOrId: string, durationDays: number = 30, adminId: string): Promise<boolean> {
    const tier = getTierConfig(tierKeyOrId);
    if (!tier) return false;

    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
    userSubscriptions.set(userId, {
      userId,
      tierId: tier.id,
      expiresAt,
      assignedBy: adminId
    });

    // TODO: Add database persistence call here (e.g., MongoDB/Prisma upsert)
    return true;
  }

  /**
   * Revoke subscription from a user
   */
  public static async removeUserTier(userId: string): Promise<boolean> {
    const exists = userSubscriptions.has(userId);
    userSubscriptions.delete(userId);
    // TODO: Add database removal call here
    return exists;
  }

  /**
   * Check if a user is authorized for no-prefix command execution
   */
  public static async hasNoPrefixAccess(userId: string, guildId?: string): Promise<boolean> {
    // Check direct user premium status
    const userTier = await this.getUserTier(userId);
    if (userTier && userTier.limits.maxNoPrefixSlots > 0) {
      return true;
    }

    // Check guild-level assigned no-prefix slots if guildId is provided
    if (guildId) {
      const guildSub = guildSubscriptions.get(guildId);
      if (guildSub && guildSub.noPrefixUsers.includes(userId)) {
        const guildTier = await this.getGuildTier(guildId);
        if (guildTier) return true;
      }
    }

    return false;
  }

  /**
   * Add a member to guild's allowed no-prefix slots (Sovereign, Imperial, Royale)
   */
  public static async addGuildNoPrefixSlot(guildId: string, targetUserId: string): Promise<{ success: boolean; message: string }> {
    const guildTier = await this.getGuildTier(guildId);
    if (!guildTier) {
      return { success: false, message: 'This guild does not have an active Astrix Premium subscription.' };
    }

    let sub = guildSubscriptions.get(guildId);
    if (!sub) {
      sub = { guildId, tierId: guildTier.id, noPrefixUsers: [], expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
      guildSubscriptions.set(guildId, sub);
    }

    if (sub.noPrefixUsers.includes(targetUserId)) {
      return { success: false, message: 'This user is already added to the no-prefix slots.' };
    }

    if (sub.noPrefixUsers.length >= guildTier.limits.maxNoPrefixSlots) {
      return { success: false, message: `Your current tier (${guildTier.name}) allows a maximum of ${guildTier.limits.maxNoPrefixSlots} no-prefix slot(s).` };
    }

    sub.noPrefixUsers.push(targetUserId);
    return { success: true, message: `Successfully added <@${targetUserId}> to the guild no-prefix slots.` };
  }

  /**
   * Remove a member from guild's no-prefix slots
   */
  public static async removeGuildNoPrefixSlot(guildId: string, targetUserId: string): Promise<boolean> {
    const sub = guildSubscriptions.get(guildId);
    if (!sub) return false;

    const index = sub.noPrefixUsers.indexOf(targetUserId);
    if (index > -1) {
      sub.noPrefixUsers.splice(index, 1);
      return true;
    }
    return false;
  }
}
