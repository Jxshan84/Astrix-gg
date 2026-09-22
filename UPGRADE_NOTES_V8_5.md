# Astrix v8.5.0 upgrade

## Economy and shop

- The old `astrix_crate` shop ID is migrated to `only_crate` (`Only Crate`).
- Existing users keep their crate balances and old item IDs remain accepted as
  compatibility aliases.
- Collectible rewards from crates are now added to both `inventory` and the
  crate-loot collection.
- Crate collectible definitions live in `data/crate-items.json`, so they are
  searchable, visible in inventory, and sellable in the unified shop.
- Coin, XP, and Premium Gem rewards remain currencies and are not duplicated as
  inventory items.

## Music

The supplied `Discord-MusicBot-5` archive is a legacy Discord.js 13 / Node 16
Lavalink bot. It is not merged into Astrix because doing so would replace the
working Discord.js 14 / Node 22 voice implementation and create two competing
clients. Astrix v8.5 keeps its current SoundCloud/direct-audio pipeline,
FFmpeg Ogg Opus transcoding, stream retries, fallbacks, and Premium 24/7
reconnect behavior.

The newer `Music-Disc-main` source is compatible with Astrix's runtime. Its
LavaShark integration is available through `services/music-lavalink.ts` and
activates when `LAVALINK_HOST` is configured. See `LAVALINK_SETUP.md` for the
Lavalink, Java, Discord permission, and optional Spotify requirements. Premium
24/7 remains on the fallback player until its reconnect state is migrated.

Run `npm run check` after deployment. The bot requires Node 22 or newer.