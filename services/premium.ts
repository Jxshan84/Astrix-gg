import mongoose, { Schema, Document } from 'mongoose';
import { ASTRIX_PREMIUM_TIERS, getTierConfig, PremiumTierConfig } from './premiumTiers';

// Database Schemas for persistent storage
interface IUserSubscriptionDocument extends Document {
  userId: string;
  tierId: string;
  expiresAt: number;
  assignedBy: string;
}

interface IGuildSubscriptionDocument extends Document {
  guildId: string;
  tierId: string;
  noPrefixUsers: string[];
  expiresAt: number;
}

const UserSubscriptionSchema = new Schema<IUserSubscriptionDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  tierId: { type: String, required: true },
  expiresAt: { type: Number, required: true },
  assignedBy: { type: String, required: true }
});

const GuildSubscriptionSchema = new Schema<IGuildSubscriptionDocument>({
  guildId: { type: String, required: true, unique: true, index: true },
  tierId: { type: String, required: true },
  noPrefixUsers: { type: [String], default: [] },
  expiresAt: { type: Number, required: true }
});

// Prevent model recompilation errors in hot-reload or multi-file setups
export const UserSubModel = mongoose.models.AstrixUserSubscription || mongoose.model<IUserSubscriptionDocument>('AstrixUserSubscription', UserSubscriptionSchema);
export const GuildSubModel = mongoose.models.AstrixGuildSubscription || mongoose.model<IGuildSubscriptionDocument>('AstrixGuildSubscription', GuildSubscriptionSchema);

export class PremiumService {
  /**
   * Check if a user has an active premium subscription from the database
   */
  public static async getUserTier(userId: string): Promise<PremiumTierConfig | null> {
    const sub = await UserSubModel.findOne({ userId });
    if (!sub) return null;

    if (Date.now() > sub.expiresAt) {
      await UserSubModel.deleteOne({ userId });
      return null;
    }

    return getTierConfig(sub.tierId);
  }

  /**
   * Check if a guild has an active premium subscription from the database
   */
  public static async getGuildTier(guildId: string): Promise<PremiumTierConfig | null> {
    const sub = await GuildSubModel.findOne({ guildId });
    if (!sub) return null;

    if (Date.now() > sub.expiresAt) {
      await GuildSubModel.deleteOne({ guildId });
      return null;
    }

    return getTierConfig(sub.tierId);
  }

  /**
   * Grant subscription to a user and save it to the database
   */
  public static async setUserTier(userId: string, tierKeyOrId: string, durationDays: number = 30, adminId: string): Promise<boolean> {
    const tier = getTierConfig(tierKeyOrId);
    if (!tier) return false;

    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

    await UserSubModel.findOneAndUpdate(
      { userId },
      { userId, tierId: tier.id, expiresAt, assignedBy: adminId },
      { upsert: true, new: true }
    );

    return true;
  }

  /**
   * Revoke subscription from a user in the database
   */
  public static async removeUserTier(userId: string): Promise<boolean> {
    const result = await UserSubModel.deleteOne({ userId });
    return result.deletedCount > 0;
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
      const guildSub = await GuildSubModel.findOne({ guildId });
      if (guildSub && guildSub.noPrefixUsers.includes(userId)) {
        const guildTier = await this.getGuildTier(guildId);
        if (guildTier) return true;
      }
    }

    return false;
  }

  /**
   * Add a member to guild's allowed no-prefix slots
   */
  public static async addGuildNoPrefixSlot(guildId: string, targetUserId: string): Promise<{ success: boolean; message: string }> {
    const guildTier = await this.getGuildTier(guildId);
    if (!guildTier) {
      return { success: false, message: 'This guild does not have an active Astrix Premium subscription.' };
    }

    let sub = await GuildSubModel.findOne({ guildId });
    if (!sub) {
      sub = new GuildSubModel({
        guildId,
        tierId: guildTier.id,
        noPrefixUsers: [],
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
      });
    }

    if (sub.noPrefixUsers.includes(targetUserId)) {
      return { success: false, message: 'This user is already added to the no-prefix slots.' };
    }

    if (sub.noPrefixUsers.length >= guildTier.limits.maxNoPrefixSlots) {
      return { success: false, message: `Your current tier (${guildTier.name}) allows a maximum of ${guildTier.limits.maxNoPrefixSlots} no-prefix slot(s).` };
    }

    sub.noPrefixUsers.push(targetUserId);
    await sub.save();

    return { success: true, message: `Successfully added <@${targetUserId}> to the guild no-prefix slots.` };
  }

  /**
   * Remove a member from guild's no-prefix slots
   */
  public static async removeGuildNoPrefixSlot(guildId: string, targetUserId: string): Promise<boolean> {
    const sub = await GuildSubModel.findOne({ guildId });
    if (!sub) return false;

    const index = sub.noPrefixUsers.indexOf(targetUserId);
    if (index > -1) {
      sub.noPrefixUsers.splice(index, 1);
      await sub.save();
      return true;
    }
    return false;
  }
}
