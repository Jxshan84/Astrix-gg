# Astrix v6.7 Music Upgrade

- Source fallback messages are silent in Discord and logged to console.
- Default playback volume is 100% to reduce clipping/distortion.
- Existing multi-source candidate fallback is preserved.
- Premium Autoplay state is supported by the music service.
- Autoplay attempts another playable result when the normal queue ends.
- Premium 24/7 remains separate from Premium Autoplay.
- Recommended UI: add an `Autoplay` toggle beside Loop/Shuffle and gate enabling it with the project's existing premium entitlement check.
- While a track is playing, Astrix updates the Discord Voice Channel Status to
  `🎵 <song title>` and updates it again on the next/autoplay track. The status
  is cleared when playback stops; the 24/7 voice connection is not affected.
- Astrix native music commands are now the only registered music interface:
  `/play`, `/pause`, `/resume`, `/skip`, `/queue`, `/nowplaying`, `/loop`,
  `/volume`, `/stop`, `/disconnect`, and `/music247`.
- Lavalink is optional. If its node is offline or authentication fails,
  `/play` automatically uses Astrix's native SoundCloud/direct-audio fallback
  instead of returning a Lavalink-only error.
