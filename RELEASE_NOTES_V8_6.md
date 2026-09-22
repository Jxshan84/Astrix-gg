# Astrix v8.6.0 — Lootboxes, Weapon Crates and AI Channel Control

This release keeps the existing Astrix commands and adds the following systems.

## New crate commands

### Slash commands

- `/lootbox open amount` — open 1–25 Astrix Lootboxes.
- `/lootbox view` — view the Lootbox balance and rewards.
- `/lootbox catalog` — view Lootbox odds and rewards.
- `/weaponcrate open amount` — open 1–25 Weapon Crates.
- `/weaponcrate view` — view Weapon Crate balance and owned hunting weapons.
- `/weaponcrate catalog` — view the weapon reward catalog.
- `/weaponcrate grant user amount` — Manage Server: grant a numeric amount or
  `all` (100 crates). Numeric grants are capped at 1,000.

### Prefix commands

The configured prefix (normally `a!`) supports:

- `a!lootbox open [amount|all]`
- `a!lootbox view`
- `a!lootbox catalog`
- `a!weaponcrate open [amount|all]`
- `a!weaponcrate view`
- `a!weaponcrate catalog`
- `a!open lootbox [amount|all]`
- `a!open weaponcrate [amount|all]`
- `a!alb <amount|all> [@user]` — Manage Server: grants Lootboxes; `all` grants
  100 and numeric amounts are capped at 1,000.

Every level grants one Lootbox. Levels 3, 6, 9 and so on also grant one Weapon
Crate. Hunts and daily rewards can find either crate. Opened weapon rewards stay
in inventory and passively improve hunting; they are not consumed.

## AI commands and policy

- `/ai set channel:#channel` — Manage Server: restrict AI replies to one channel.
- `/ai view` — show the configured AI channel, or confirm that AI is available
  everywhere.
- `/ai off` — Manage Server: remove the restriction.
- `/ask`, `/translate`, `/rewrite`, `/summarize`, `/generate`, `/imagine`, and
  `/aiusage` remain available and respect the AI channel setting.
- Mentioning Astrix also respects the setting. In another channel, Astrix points
  to the configured channel instead of answering there.

If no AI channel is set, AI can be used anywhere.

## Invite channel commands

Existing settings remain supported:

- `/settings inviter-channel channel:#channel`
- `/settings inviter-channel-view`
- `/settings inviter-channel-off`

Short invite aliases are also available:

- `/invites channel-set channel:#channel`
- `/invites channel-view`
- `/invites channel-off`

The set/off variants require Manage Server. Invite tracking data is preserved
when reporting is turned off.

## Existing commands retained

The release does not remove the established economy, shop, inventory, daily,
weekly, adventure, moderation, security, music, ticket, role, giveaway,
premium, owner, no-prefix, autorespond, and help command families. See
`COMMANDS.md` for the direct slash command catalog and `README.md` for setup and
environment notes.