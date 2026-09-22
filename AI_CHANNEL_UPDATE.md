# Astrix AI Channel Update

## What changed

`/ai` is no longer a dashboard-only command. It now manages where Astrix AI is
allowed to reply:

- `/ai set channel:#channel` — requires **Manage Server** and restricts AI replies
  to the selected text or announcement channel.
- `/ai view` — shows the current setting. If no channel is configured, AI is
  available throughout the server.
- `/ai off` — requires **Manage Server** and removes the restriction.

## Behavior

- `/ask`, `/translate`, `/rewrite`, `/summarize`, `/generate`, `/imagine`,
  `/aiusage`, and AI mention replies respect the selected channel.
- A mention such as `@Astrix hello` in the correct channel receives the normal
  AI answer in that same channel.
- A mention or AI slash command in another channel receives a short message
  pointing to the configured channel, for example:
  `✨ Astrix AI is set to #ai. Please use AI there.`
- With no channel selected, Astrix AI continues to work in any server channel.
- The setting is stored per server and survives restarts.

## Permissions

Only members with **Manage Server** can run `/ai set` or `/ai off`. Everyone can
run `/ai view`.

## Existing AI commands

`/ask`, `/translate`, `/imagine`, `/rewrite`, `/summarize`, `/generate`,
`/aiusage`, and mentioning Astrix remain available. The AI provider fallback,
image analysis, image generation, custom emoji markers, and sticker markers are
unchanged.