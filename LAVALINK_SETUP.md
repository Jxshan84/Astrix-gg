# All-source music setup

Astrix uses the supplied Music Disc/LavaShark approach when `LAVALINK_HOST`
is configured. The supported sources are YouTube, YouTube Music, SoundCloud,
Spotify, Deezer, Apple Music links, and direct playlists supported by the
Lavalink plugins.

## Required runtime

- Node.js `22.23.2` or newer
- Java 17 or newer for Lavalink
- Lavalink v4.0.8 or newer
- One reachable Lavalink node
- Astrix's Discord voice permissions: View Channel, Connect, Speak
- Astrix's text permissions: Send Messages, Embed Links, Use Voice Activity

## Astrix environment

Set these variables in Replit Secrets or the deployment environment. Never
commit the password to the repository.

```env
LAVALINK_HOST=lava-v4.millhost.my.id
LAVALINK_PORT=443
LAVALINK_PASSWORD=your-lavalink-password
LAVALINK_SECURE=true
LAVALINK_IDENTIFIER=Astrix-Millhost-V4
```

The selected node uses the secure WebSocket/REST endpoint on port `443`.
`LAVALINK_HOST` is the feature switch. If it is empty, Astrix keeps its
SoundCloud/direct-audio fallback instead of failing startup.

## Optional Spotify support

Create an application in the Spotify Developer Dashboard and set:

```env
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
```

YouTube, YouTube Music, SoundCloud and Deezer do not require Spotify
credentials. Source availability can still depend on the Lavalink source
plugins and their current provider restrictions.

## Lavalink node

The node must allow the Astrix host to reach its WebSocket and REST ports.
Use the same password in Lavalink's `server.password` and
`LAVALINK_PASSWORD`. A hosted node or a separate Java service is recommended;
running Lavalink in the same process as Astrix is not supported.

After setting the environment, run:

```bash
npm install
npm run check
npm run start
```

Then test `/play query`, `/queue`, `/nowplaying`, `/pause`, `/skip`,
`/volume`, and `/loop`.

Premium `/music247` is intentionally kept off in all-source Lavalink mode
until its reconnect state is migrated to the Lavalink player. The normal
fallback mode continues to support Astrix Premium 24/7 music.