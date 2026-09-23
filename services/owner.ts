import { Client } from 'discord.js';
import { BlacklistService } from './blacklistService';

// Supreme owner ID configuration
const SUPREME_OWNER_ID = '1467892528077602908';

export class OwnerService {
  /**
   * Check if a user is the supreme owner of the bot
   */
  public static isSupremeOwner(userId: string): boolean {
    return userId === SUPREME_OWNER_ID;
  }

  /**
   * Handle global blacklist addition or removal via owner/admin controls and notify user via DM
   */
  public static async handleBlacklistAction(
    client: Client,
    targetId: string, 
    type: 'user' | 'guild', 
    action: 'add' | 'remove', 
    reason: string = 'No reason provided', 
    adminId: string
  ): Promise<string> {
    if (!this.isSupremeOwner(adminId)) {
      return '❌ You are not authorized to perform supreme owner actions.';
    }

    if (action === 'add') {
      const success = await BlacklistService.addBlacklist(targetId, type, reason, adminId);
      if (!success) {
        return `❌ Failed to add target \`${targetId}\` to the global blacklist.`;
      }

      // If a user was blacklisted, attempt to send them a DM notification
      if (type === 'user') {
        try {
          const user = await client.users.fetch(targetId);
          if (user) {
            await user.send(
              `⚠️ **ASTRIX™ SECURITY NOTICE** ⚠️\nYou have been globally restricted from using all Astrix commands.\n**Reason:** ${reason}`
            );
          }
        } catch (dmError) {
          console.error(`Could not send blacklist DM to user ${targetId}:`, dmError);
        }
      }

      return `✅ Successfully blacklisted ${type} \`${targetId}\`.\n**Reason:** ${reason}`;
    } else if (action === 'remove') {
      const success = await BlacklistService.removeBlacklist(targetId);
      return success 
        ? `✅ Successfully unbanned/removed target \`${targetId}\` from the global blacklist.`
        : `❌ Target \`${targetId}\` was not found in the blacklist database.`;
    }

    return '❌ Invalid action specified.';
  }

  /**
   * Check blacklist status for incoming executions
   */
  public static async verifyExecutionSecurity(userId: string, guildId?: string): Promise<{ blocked: boolean; message?: string }> {
    if (this.isSupremeOwner(userId)) {
      return { blocked: false }; // Supreme owner can never be blocked
    }

    if (userId && (await BlacklistService.isBlacklisted(userId))) {
      return { blocked: true, message: '❌ You are globally restricted from using all Astrix commands.' };
    }

    if (guildId && (await BlacklistService.isBlacklisted(guildId))) {
      return { blocked: true, message: '❌ This server is globally restricted from using Astrix.' };
    }

    return { blocked: false };
  }
}
