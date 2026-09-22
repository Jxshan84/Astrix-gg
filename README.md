## Prefix and no-prefix economy commands

The economy protection commands work with both the configured prefix and approved no-prefix access:

- `a!rob @user` (or `rob @user`)
- `a!use` lists only items you own
- `a!use lock` manually activates a Lock
- `a!use mine @user` manually plants a Mine

The old combined `mine_lock` inventory entry is migrated to the separate `lock` item when used.

## Owo-style no-prefix economy

The optional Owo-style message layer handles these commands without `/` or a
server prefix for eligible Premium members. Existing slash and prefixed
commands are preserved.

```text
daily                         weekly                         work
balance                       profile                        lb
cf heads                      cf tails                       cf
gamble                        gamble bet limit               mine 100
slots                         roulette red                    dice
hunt                          autohunt on                    autohunt off
fish                          dig                            beg
search                        collection                      zoo
inventory                     use crate                      rob @user
give @user 100                choose tea, coffee              rate me
ship @user                    pray                            curse @user
crime                         battle @user                    8ball
```

`cf [heads|tails]` shows the configured animated coin-flip emoji
(`a:Cf:1544893738315157555`), waits for the flip, and attaches a generated
static Heads/Tails coin image. All betting games deduct coins. `mine <amount>`
accepts a number from 10 coins to 250,000 coins; `mine all` also uses that cap,
so an account with 1,000,000 coins can never lose more than 250,000 in one
Mines round. Other games have no 250,000 cap: `cf all`, `slots all`,
`roulette all red`, and `dice all` use the full available balance. Set
`OWO_STYLE_COMMANDS=false` to disable the no-prefix layer, or change
`AUTOHUNT_INTERVAL_MS` to tune it.

## Imported Astrix command catalog

The supplied OwO source catalog is recorded in `data/astrix-owo-catalog.json`
with 351 command modules and 512 unique command entries. Astrix provides the
safe supported economy, gambling, collection, shop, adventure, and social
behavior through its own services without requiring the original OwO MariaDB,
Redis, Eris, Patreon, or sharding runtime. Destructive code-execution and
data-reset operations remain blocked from text dispatch. Use `astrix help` or
`help` for the Astrix command surface.

The imported catalog is derived from the supplied **Discord OwO Bot** source,
licensed under **CC-BY-NC-SA-4.0**. This project preserves that attribution and
license constraint: derivative distribution must retain attribution and
share-alike terms, and commercial use is not permitted under that license.

# Astrix level-up crates

Every user starts with one Only Crate. Each time a user reaches a new level,
exactly one crate is added. Crates can be opened with `/use item:only_crate`
(aliases `crate` and `crates` also work), and their balance is shown by
`/inventory`.

💎 Astrix Gems are a Premium currency. Crates only award gems through the
Legendary reward, and only an active Premium, Premium+, or Elite user can
receive that reward. Free users instead receive the other Legendary rewards.

Crate odds and rewards:

- ⚪ Common — 60%: Coin Cache, XP Spark, or Lucky Charm
- 🔵 Rare — 25%: Royal Coin Cache, Royal Lucky Ticket, or XP Core
- 🟣 Mythic — 10%: Mythic Coin Vault, Astral Relic, or Mythic Lucky Core
- 🟡 Legendary — 5%: Legendary Treasure, Legendary Astrix Gem, or Crown of Astrix

The shop now includes crate-reward items alongside premium collector pieces such as Astrix Phoenix, Void
Dragon Egg, and Crown of Time. Free users can buy the Grand Bank Limit
Voucher, which permanently adds 50,000 coins to their bank capacity.

## Rob and Mine Lock

Use `/rob user:@member` to attempt a robbery. A successful robbery transfers
coins from the target's wallet; a failed attempt takes a funny penalty from
the robber's wallet first and bank second, then transfers that penalty to the
target. Rob has a 15-minute cooldown.

`Mine Lock` is a shop protection item. It activates automatically, blocks one
rob attempt, and is consumed when it works. Each user can own a maximum of
three. `/use` now shows an autocomplete list containing only items currently
owned by the user instead of asking them to remember item IDs.

Coins are credited through the normal wallet/bank capacity rules. XP rewards
can cause another level-up and award another crate, and collection rewards are
tracked in the user's crate-loot collection.

# Astrix v8.6.0

Astrix is an all-in-one Discord bot for moderation, security, economy, careers, AI, music, recording, tickets, roles, giveaways, fun and dashboard-synced server configuration.

## Major v8 systems

- **Work V3:** 120 careers, 1,200 distinct mini-job challenge variants, `/work` subcommands, career progression, statistics/history, 15-minute cooldowns and persistent shift-ready DM notifications.
- **Advanced Moderation:** `/mod` provides 55 practical actions across member, message, voice, case and server moderation. Existing direct moderation commands are preserved where registered.
- **Modern Balance:** wallet, bank usage/progress, net worth, Astrix Gems, credit score and current career in one polished response.
- **Modern Astrix AI:** conversational questions, planning, explanations, writing/coding assistance, follow-up context, internal classifier-leak protection, image understanding, image generation and automatic multi-provider fallback.
- **Unified Astrix Market:** one `/shop` for Free and Premium users, automatic Premium discounts, level-based item unlocks, 146 catalog items, high-value collectibles and instant ultra-expensive XP packs.
- **Level-scaled economy capacity:** wallet and bank capacity grow automatically with user level so late-game million/billion/trillion items are actually reachable while manual capacity upgrades remain useful.
- **Recording Links:** recording delivery remains link-first rather than sending raw WAV files in requester DMs.
- **Dashboard Sync:** moderation configuration can be read from the shared MongoDB `guildconfigs` collection when `MONGODB_URI` is configured.

## Work commands

`/work panel`, `/work list`, `/work apply`, `/work shift`, `/work stats`, `/work career`, `/work history`, `/work resign`, `/work notify`.

## Moderation

Use `/mod` to access 55 grouped moderation actions. Direct commands such as `/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/lock`, `/unlock` and others remain available according to the global command registry.

## Live activity dashboard

Use `/settings log-channel channel:#channel` to choose the server's live activity channel. If no
channel is selected, Astrix creates a private `#astrix-logs` fallback when activity is first tracked.
The channel keeps one updated embed with three sections: per-user message totals, per-user voice
time, and recent moderation activity. Use `/settings log-channel-view` to inspect the current
setting or `/settings log-channel-reset` to return to the automatic fallback.

## KataBump

Recommended startup:

```text
node /home/container/index.js
```

The root `index.js` loads the `tsx` runtime and then runs `index.ts`. Do not rename `discord.js` imports and do not create a `GuildConfig.ts` folder; `models/GuildConfig.ts` must be a file.

## Environment

Copy `.env.example` to your host environment and configure the required secrets. Never commit real bot tokens or API keys.

## No-prefix access

Server administrators can grant no-prefix access to individual members:

```text
/noprefix grant user:@member
/noprefix revoke user:@member
/noprefix list
```

Only explicitly granted members with active Premium access can run the supported
Astrix text commands without the configured server prefix. No-prefix dispatch
uses the documented command names, while `astrix <command>` remains available
as an explicit command form. Ordinary messages are ignored, and the setting is
stored separately for each server.

Common moderation commands also support the configured prefix:

```text
a!warn @member reason
a!timeout @member 30m reason
a!kick @member reason
a!ban @member reason
a!purge 10
```

The same commands are available without a prefix only to members granted
through `/noprefix` while Premium is active. Discord's `Manage Messages`,
`Moderate Members`, `Kick Members`, and `Ban Members` permissions are still
checked.

## Owner security tools

The owner-only `/backup` command supports named snapshots:

```text
/backup action:create label:before-maintenance
/backup action:list
/backup action:restore backup_id:<id>
```

Restore is confirmed with a button and only recreates missing structure; it does not delete existing channels. `/nuke` directly deletes and recreates only the current channel in the same category and position after creating a snapshot. The new channel receives a nuclear blast log with the moderator name/tag and backup ID. Set `NUKE_GIF_URL` to customize the GIF. It does not affect other channels, roles, members, or server data.

XP is earned automatically from normal server messages with a cooldown. Use `/xp` for an image progress card; every level-up posts an image card and grants a random coin reward that is added to the wallet or bank capacity.

The bot presence rotates automatically every 30 seconds by default through
**Playing**, **Watching**, **Listening**, **Competing**, and **Streaming**
activities. Its Discord presence bubble also rotates through **Online**, **Idle**,
**Do Not Disturb**, and **Invisible**. Music playback temporarily takes priority
and shows the current track as a Streaming activity. Set
`STATUS_ROTATION_SECONDS` to change the interval; values below 15 seconds are
clamped to Discord-friendly timing. Set
`ASTRIX_PRESENCE_STATUSES=online,idle,dnd,invisible` to choose which presence
bubbles rotate.

The rotation also includes the configurable bot feature activity
`🤖 Bot Feature 📱`. Set `ASTRIX_BOT_FEATURE_STATUS` and
`ASTRIX_STATUS_DEVICE_ICON` to change its text and phone-style emoji. Discord's
real green mobile-device badge is controlled by Discord's client connection and
cannot be forced through the bot API; the phone emoji is the supported visual
equivalent.

`good morning` and `good night` receive a small Astrix greeting and reaction.
Configured-prefix forms such as `a!morning`, `a!night`, `a!ping`, and
`a!uptime` are also supported.

## Music reliability

Music search queries SoundCloud and YouTube in parallel, keeps the configured primary source first, removes duplicate results, retries transient stream failures, refreshes SoundCloud credentials when needed, and automatically moves to the next provider or result when playback fails. Configure `MUSIC_STREAM_RETRIES` and `MUSIC_STREAM_RETRY_DELAY_MS` in `.env`.

## Release documentation

See `CHANGELOG_V8.md`, `WORK_V3.md`, `MODERATION_V8.md`, `ASTRIX_MASTER_PROMPT.md`, and `KATABUMP_SETUP.md`.


## Astrix AI provider fallback

Astrix can use multiple providers instead of failing when one provider is out of credits or temporarily unavailable. The current fallback chain supports OpenRouter, Cloudflare Workers AI, Pollinations, Gemini and OpenAI depending on which environment variables are configured. Provider calls have a timeout so a stalled provider can fall through to the next one.

Image generation uses image-capable providers only. At least one valid provider key/account with usable quota is required; no bot can generate provider-hosted images when every configured provider is unavailable. Gemini image generation uses the current `v1beta/interactions` image API with `gemini-3.1-flash-image` by default.

Cloudflare's default vision model is `@cf/meta/llama-3.2-11b-vision-instruct`; Cloudflare may require one-time acceptance of the Meta model license before that vision fallback works.

## Astrix AI channel control

The old `/ai` dashboard action is now a useful server setting:

```text
/ai set channel:#ai
/ai view
/ai off
```

Members with **Manage Server** can choose one text channel for Astrix AI. Mentions
such as `@Astrix explain this` and AI slash commands reply in the configured
channel. If somebody uses AI in another channel, Astrix replies with a clickable
channel mention instead of silently answering there. If no channel is configured,
AI can be used anywhere in the server.

## Unified market

`/shop` is the only shop surface. Premium status is detected automatically and the discount is applied in the same market. `/buy` and `/sell` remain direct command shortcuts with autocomplete. The market UI includes Buying/Selling modes, Fairness details, inventory access, listing action buttons and first/previous/refresh/next/last navigation. XP packs are applied instantly and cannot be resold.
