# Astrix v8.2.0

## Fixed
- Fixed the startup crash caused by `moderation` being referenced without importing `services/moderation.ts`.
- Removed the broken `shopEmbed` path and rebuilt the shop renderer around the unified market panel.
- Restored missing virtual-loan helper functions used by the router.
- Fixed AI moderation/classifier flow so internal `ALLOW`/`BLOCK` or `User Safety: safe` style output is not used as the normal user response.
- Added provider timeouts so one stalled AI service does not block the complete fallback chain.

## Unified Market
- One `/shop` for all users; no separate Premium shop command or Premium-only shop mode.
- Automatic Premium / Premium+ / Elite discounts in the same catalog.
- 146 unified catalog items from Free, high-tier and XP catalogs.
- Level-based item unlocks and automatic wallet/bank capacity growth for late-game economy progression.
- XP packs range into million/billion/trillion coin pricing and apply XP instantly.
- Buying, Selling, Fairness, Inventory and first/previous/refresh/next/last interactive controls.
- `/buy` and `/sell` item autocomplete.

## AI v8.2
- Text fallback chain across configured OpenRouter, Cloudflare, Pollinations, Gemini and OpenAI providers.
- Image understanding fallback across configured vision-capable providers.
- Image generation fallback across Cloudflare, OpenRouter, Gemini, OpenAI and Pollinations.
- Gemini image generation updated to the current Interactions API and `gemini-3.1-flash-image` default.
- Image/GIF safety scanning now uses the configured multi-provider vision fallback instead of depending on one provider.

## Validation
- All TypeScript source files pass transpile/syntax diagnostics.
- All JSON files parse successfully.
- Registered global slash command set validates at exactly 100 unique commands with correct required-option ordering.
- AI text/vision/image fallback behavior passed mocked provider-failure tests.
- Unified shop, Premium discount, level-scaled capacity and instant XP purchase behavior passed local mock tests.

---

# Astrix v8.0.0

## Added
- Work V3 grouped slash command with 9 subcommands.
- 120 careers and 1,200 distinct mini-job challenge variants.
- Fixed 15-minute post-shift cooldown with persistent DM-ready notifications.
- Work stats, history, reputation, streaks, daily shift tracking and autocomplete career applications.
- `/mod` advanced moderation center with 55 practical actions.
- Persistent moderation cases, staff notes, reports, moderator stats and temporary-ban expiry checks.
- Modern balance embed with wallet, bank progress, net worth, Gems, credit score and career.

## Preserved
- Astrix advanced conversational AI, recording links, privacy consent, economy/shop/loan, music, tickets, security, roles, giveaways, premium and owner controls.

### v8.2 AutoMod / Anti-Nuke hardening
- Fixed Anti-Link and Anti-Invite runtime enforcement.
- Added configurable punishments and timeout durations to Anti-Link, Anti-Invite and Anti-Spam.
- Added AutoMod duplicate-message, phishing, emoji-spam, mass-mention/everyone, caps and escalation controls.
- AutoMod moderator bypass is now configurable and defaults to off for stronger enforcement.
- Expanded Anti-Nuke monitoring to channel/role updates, kicks, dangerous role grants, webhooks and server-setting changes.
- Anti-Nuke now monitors bot actors too unless explicitly trusted; Astrix itself and trusted IDs are exempt.
- Added configurable Anti-Nuke containment: contain, kick, ban or lockdown-only.
- Added safer Anti-NSFW fallback handling so provider failures do not break the message event pipeline.

## AutoMod punishment duration correction
- AutoMod, Anti-Link, Anti-Invite, Anti-Spam and Anti-NSFW timeout inputs now use `timeout_hours` (1–672 hours).
- Internal storage remains minute-based for backward compatibility with existing server configs.

## AutoMod punishment DMs
AutoMod, Anti-Link, Anti-Invite, Anti-Spam and Anti-NSFW support `dm_user`. It defaults to enabled. Warn, Timeout, Kick and Ban send a DM before the action when possible. Delete-only does not send a punishment DM. Closed DMs never block moderation.


## XP / Invite / Marriage 2.0 update
- Automatic message XP with cooldown and escalating level requirements.
- Automatic level-up image/card announcements.
- Persistent invite tracker with joins, leaves, active invites and leaderboard.
- Marriage profiles now show spouse, ring rarity/value and anniversary information.
- Marriage gifts, achievements, couple bonus, anniversary tracking and married-couple leaderboard.
- Divorce fee protection.
- Kept marriage, XP and invite data independent.
