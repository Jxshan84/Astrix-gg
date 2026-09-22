# v8.6.0 — Lootboxes, Weapon Crates and AI Channel Control

- `/ai set channel:#channel`, `/ai view`, and `/ai off` replace the old
  dashboard-only `/ai` action. AI replies stay in the selected channel and
  explain where to go when used elsewhere; with no setting, AI works anywhere.
- Added `/lootbox` and `/weaponcrate` open, view, catalog, and grant flows.
- Level-ups, hunts, and daily rewards can award Lootboxes; selected level-ups
  and random rewards can also award Weapon Crates.
- Weapon Crate rewards stay in inventory and improve hunt rarity/reward results.
- Added prefix crate aliases including `open lootbox`, `open weaponcrate`, and
  the Manage Server `alb <amount|all> [@user]` grant command.
- Added short invite report channel commands:
  `/invites channel-set`, `/invites channel-view`, and `/invites channel-off`.

# Astrix News

Automatic feature/news announcements are disabled. Astrix no longer posts
release messages when it starts or joins a server.

The older news-channel settings and `data/news.json` are retained only for
backward-compatible data migration; they do not trigger automatic messages.