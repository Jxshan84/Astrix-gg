# Moderation command audit

The current project was checked before adding the moderation commands in this
release.

## Existing moderation commands kept unchanged

Existing direct command names include:

`/ban`, `/unban`, `/kick`, `/mute`, `/unmute`, `/warn`, `/warnings`,
`/clearwarns`, `/timeout`, `/untimeout`, `/purge`, `/lock`, `/unlock`,
`/slowmode`, `/nickname`, and `/role`.

The existing grouped moderation center also contains these working paths:

- `/mod member`: `ban`, `tempban`, `softban`, `unban`, `kick`, `timeout`,
  `untimeout`, `warn`, `warnings`, `clearwarnings`, `removewarn`, `nickname`,
  `resetnick`, `roleadd`, `roleremove`, `note`, `notes`, `removenote`, `report`,
  and `reports`.
- `/mod message`: `purge`, `purgeuser`, `purgebots`, `purgelinks`,
  `purgeimages`, `purgeembeds`, `purgeinvites`, `slowmode`, `lock`, `unlock`,
  `channelban`, and `channelunban`.
- `/mod voice`: `voicekick`, `voicemute`, `voiceunmute`, `voicedeafen`,
  `voiceundeafen`, `move`, and `moveall`.
- `/mod cases`: `case`, `cases`, `caseedit`, `casereason`, `caseclose`,
  `history`, `modlogs`, `staffstats`, `modstats`, and `evidence`.
- `/mod server`: `lockdown`, `unlockdown`, `massrole`, `massnick`, `freeze`,
  and `unfreeze`.

The existing `/clear` prefix command was also left alone, so no duplicate
`/clear` slash command was added.

## New unique moderation commands

Only names not already registered as direct or grouped slash commands were
added:

`/nick`, `/hide`, `/unhide`, `/clonechannel`, `/deletechannel`, `/voiceban`,
`/voiceunban`, `/massban`, and `/masskick`.

All nine commands are guild-scoped so the global 100-command scope is not
changed. They use the existing Dashboard moderation guard and cooldown system,
check both member and bot permissions, check role hierarchy where members are
targeted, validate destructive confirmations, handle partial mass-action
failures, and write moderation activity to the existing configured log
channel. No database schema or existing handler was changed for these actions.