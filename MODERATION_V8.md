# Astrix Advanced Moderation v8

`/mod` contains 55 practical moderation actions grouped under `member`, `message`, `voice`, `cases`, and `server`. Existing direct moderation commands remain supported where registered. Advanced moderation adds persistent cases, notes, reports, staff statistics, temporary-ban expiry, filtered purge tools, voice actions and server-wide controls.

## AutoMod & Server Protection Update

Astrix AutoMod now supports configurable modules and punishments through `/automod`:

- Spam flood protection
- Duplicate-message protection
- Link blocking
- Discord invite blocking
- Phishing / fake-gift link detection
- Mass mention and `@everyone` / `@here` protection
- Excessive caps protection
- Emoji-spam protection
- Custom bad-word filtering
- NSFW / unsafe-content filtering

Punishment values can be configured per module: `delete`, `warn`, `timeout`, `kick`, or `ban`. Timeout length, module thresholds, detection windows, and optional escalation can also be configured.

Direct `/antilink`, `/antiinvite`, and `/antispam` commands now accept punishment settings instead of always using delete-only behavior.

### Anti-Nuke

`/antinuke` now supports a configurable threshold, detection window, containment action, and emergency-lockdown toggle. Astrix monitors destructive channel/role changes, bans, kicks, dangerous role grants, webhook changes, and repeated server-setting changes through Discord audit logs.

Astrix intentionally does not include a destructive server-wide wipe. `/nuke` is restricted to the current channel: it creates a structure/config snapshot first, then deletes and recreates that channel in the same category and position. The recreated channel posts a moderator-attributed nuclear blast log. Use `/backup`, `/lockdown`, `/unlockdown`, and `/recover` for safe emergency protection and recovery.

## AutoMod punishment DMs
AutoMod, Anti-Link, Anti-Invite, Anti-Spam and Anti-NSFW support `dm_user`. It defaults to enabled. Warn, Timeout, Kick and Ban send a DM before the action when possible. Delete-only does not send a punishment DM. Closed DMs never block moderation.
