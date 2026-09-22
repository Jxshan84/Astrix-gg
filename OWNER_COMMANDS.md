# Astrix Owner Control Center

Set `OWNER_IDS` in `.env` to one or more comma-separated Discord user IDs. Only those IDs can run `/owner`.

## 35 owner-only actions
Premium (7): usergrant, userrevoke, userstatus, server, servergrant, serverrevoke, serverstatus.
Currency (6): gemsgrant, gemsremove, gemsset, coinsgrant, coinsremove, coinsset.
Economy (7): itemgrant, itemremove, walletlimit, banklimit, creditset, loanwipe, loanstatus.
Access (6): earlygrant, earlyrevoke, blacklistuser, unblacklistuser, blacklistserver, unblacklistserver.
Broadcast (3): announce, globalannounce, globalgiveaway.
System (5): stats, guilds, users, reloadshop, backup.

Global broadcasts require `confirm:true`. Global messages use a configured global announcement channel when available, then the server system channel, then a sendable text channel fallback.

### Grant Premium to a server

Use the short owner subcommand:

```text
/owner premium server guild_id:<SERVER_ID> tier:<premium|plus|elite> days:<optional>
```

Omit `days` for permanent Premium. `servergrant` remains available as the explicit
compatibility alias.

## Security and recovery
- `/backup action:create label:<name>` creates a named structure/config snapshot.
- `/backup action:list` lists snapshots.
- `/backup action:restore backup_id:<id>` opens a confirmation panel and restores missing structure without deleting existing channels.
- `/nuke` deletes and recreates the current channel in the same category and position after creating a `before-nuke` snapshot. The new channel posts a nuclear blast log with the moderator name/tag and backup ID. Channel settings, permission overwrites, and category placement are copied; messages are not restored. Customize the GIF with `NUKE_GIF_URL`.

## Bot Profile
- `/owner bot animatedavatar avatar:<GIF>` — set the Astrix animated bot avatar. Owner-only, GIF-only, maximum 10 MB.
- `/owner bot banner banner:<IMAGE>` — set the Astrix bot banner. Supports PNG, JPG, WebP, and GIF up to 10 MB.
