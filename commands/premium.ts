import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getAstrixPremiumMessagePayload } from '../services/premiumMessage';
import { getTierConfig } from '../services/premiumTiers';

export const data = new SlashCommandBuilder()
  .setName('premium')
  .setDescription('Manage Astrix Premium subscriptions and view tiers.')
  .addSubcommand(sub =>
    sub
      .setName('info')
      .setDescription('View Astrix Prestige, Sovereign, Imperial, and Royale tiers and pricing.')
  )
  .addSubcommand(sub =>
    sub
      .setName('slots')
      .setDescription('Check available no-prefix or custom slots for your tier.')
  )
  .addSubcommand(sub =>
    sub
      .setName('adduser')
      .setDescription('Grant premium or no-prefix access to a user.')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption(opt => opt.setName('tier').setDescription('Tier name or key').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('removeuser')
      .setDescription('Revoke premium or no-prefix access from a user.')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'info') {
    const payload = getAstrixPremiumMessagePayload();
    return await interaction.reply({ ...payload, ephemeral: false });
  }

  if (subcommand === 'slots') {
    // Placeholder for checking database/cache slot status
    return await interaction.reply({
      content: `📊 **Astrix Premium Slots:** Your current server/user tier status is active. Use management commands to assign allowed slots.`,
      ephemeral: true
    });
  }

  // Authorization check for adding/removing premium users
  if (subcommand === 'adduser' || subcommand === 'removeuser') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: `❌ You need Administrator permissions to manage premium users.`,
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user', true);
    
    if (subcommand === 'adduser') {
      const tierInput = interaction.options.getString('tier', true);
      const tier = getTierConfig(tierInput);

      if (!tier) {
        return await interaction.reply({
          content: `❌ Invalid tier specified. Please use **Astrix Prestige**, **Astrix Sovereign**, **Astrix Imperial**, or **Astrix Royale**.`,
          ephemeral: true
        });
      }

      // TODO: Save user/guild subscription to your existing database layer here
      return await interaction.reply({
        content: `✅ Successfully granted **${tier.name}** (${tier.tierKey}) to <@${targetUser.id}>!`,
        ephemeral: true
      });
    }

    if (subcommand === 'removeuser') {
      // TODO: Remove user/guild subscription from your existing database layer here
      return await interaction.reply({
        content: `✅ Successfully revoked premium access from <@${targetUser.id}>.`,
        ephemeral: true
      });
    }
  }
}
