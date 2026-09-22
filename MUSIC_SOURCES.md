## Playback fallback chain

Without Lavalink, Astrix uses SoundCloud search with three metadata retries,
keeps multiple SoundCloud results as playback fallbacks, and retries stream
downloads and fragments before moving to the next result. Direct non-YouTube
audio URLs remain supported and are transcoded through FFmpeg.

When a search returns multiple results, every result is retained as a
playback fallback. If the first stream expires, is blocked, or FFmpeg cannot
decode it, Astrix automatically tries the next result and then the next
extractor client. Stream downloads also use fragment retries and socket
timeouts, so one temporary CDN failure does not end playback immediately.

# Astrix Music Sources (v8.5)

Astrix searches multiple candidates and automatically moves to another candidate/source when a stream fails.

Fallback mode sources:
- SoundCloud search/playback through the bundled `yt-dlp` extractor
- Direct HTTP audio/radio URLs

Lavalink mode sources:
- YouTube and YouTube Music
- SoundCloud
- Spotify
- Deezer
- Apple Music links

`MUSIC_SEARCH_CANDIDATES` controls how many fallback results are retained (2-10).
`MUSIC_STREAM_RETRIES` controls transient stream retries (0-3), and `MUSIC_STREAM_RETRY_DELAY_MS` controls the increasing delay between attempts.

Important: set `LAVALINK_HOST` to enable all-source mode. Without it,
YouTube playback through yt-dlp remains disabled because datacenter bot checks
can be unreliable.

SoundCloud and direct audio are transcoded through the bundled
`ffmpeg-static` binary into Ogg Opus in fallback mode. Lavalink mode delegates
source decoding and voice playback to Lavalink. The legacy
Discord-MusicBot-5 archive is not merged: it requires Discord.js 13 and Node
16, while Astrix v8.5 runs on Discord.js 14 and Node 22.
