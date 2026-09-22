# XP + Music configuration

## XP level-up channel
Set `XP_LEVELUP_CHANNEL_ID` to the Discord text-channel ID where Astrix should post level-up cards.
If it is blank or the channel cannot be accessed, Astrix falls back to the channel where the XP-triggering message was sent.

## Music
Astrix now prioritizes SoundCloud by default:
`MUSIC_PRIMARY_SOURCE=soundcloud`

YouTube remains enabled as a fallback when no playable SoundCloud result is found:
`ALLOW_YOUTUBE=true`
