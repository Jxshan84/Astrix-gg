import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ASTRIX_PREMIUM_TIERS } from './premiumTiers';

export function getAstrixPremiumMessagePayload() {
  const tiers = Object.values(ASTRIX_PREMIUM_TIERS);
  
  const content = [
    `👑 **ASTRIX™ — PREMIUM TIERS** 👑\n`,
    ...tiers.map(tier => [
      `⭐ | **${tier.name}** ${tier.badge}`,
      `[ \`${tier.tierKey}\` ]`,
      `**Perks & Limits:**`,
      ...tier.perks.map(perk => `➔ ${perk}`),
      `↳ **Price:** ₹${tier.priceINR} or $${tier.priceUSD} ltc per month!\n`,
      `----------------------------------------`
    ].join('\n')),
    `_ASTRIX™ Premium by Astrix Network_`
  ].join('\n');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('🌐 | Click here to buy')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.com/channels/1523540390580453376/1523541875053695067')
  );

  return { content, components: [row] };
}
