import mongoose, { Schema, Document } from 'mongoose';

interface IBlacklistDocument extends Document {
  targetId: string; // User ID or Guild ID
  type: 'user' | 'guild';
  reason: string;
  addedBy: string;
  createdAt: number;
}

const BlacklistSchema = new Schema<IBlacklistDocument>({
  targetId: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['user', 'guild'], required: true },
  reason: { type: String, default: 'No reason provided' },
  addedBy: { type: String, required: true },
  createdAt: { type: Number, default: Date.now }
});

export const BlacklistModel = mongoose.models.AstrixBlacklist || mongoose.model<IBlacklistDocument>('AstrixBlacklist', BlacklistSchema);

export class BlacklistService {
  /**
   * Check if a user or guild is globally blacklisted
   */
  public static async isBlacklisted(targetId: string): Promise<boolean> {
    const entry = await BlacklistModel.findOne({ targetId });
    return !!entry;
  }

  /**
   * Get blacklist details for a user or guild
   */
  public static async getBlacklistInfo(targetId: string): Promise<IBlacklistDocument | null> {
    return await BlacklistModel.findOne({ targetId });
  }

  /**
   * Add a user or guild to the global blacklist
   */
  public static async addBlacklist(targetId: string, type: 'user' | 'guild', reason: string, adminId: string): Promise<boolean> {
    try {
      await BlacklistModel.findOneAndUpdate(
        { targetId },
        { targetId, type, reason, addedBy: adminId, createdAt: Date.now() },
        { upsert: true, new: true }
      );
      return true;
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      return false;
    }
  }

  /**
   * Remove a user or guild from the global blacklist
   */
  public static async removeBlacklist(targetId: string): Promise<boolean> {
    const result = await BlacklistModel.deleteOne({ targetId });
    return result.deletedCount > 0;
  }
}
