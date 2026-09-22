# Astrix v8.6.0 — KataBump Setup

## Runtime

- Node.js: 22 or newer
- Startup file: `index.js` (recommended) or `index.ts`
- Startup command: `node /home/container/index.js`

The launcher registers `tsx/cjs` and runs the TypeScript source directly. There is no required `dist` folder.

## Install

KataBump normally installs dependencies from `package.json`. If the panel
starts the file before dependencies are installed, the included bootstrap
automatically runs:

```bash
npm install --registry=https://registry.npmjs.org
```

You can also run that command manually before starting the bot.

## Important

- Keep `models/GuildConfig.ts` as a file, not a folder.
- Keep package imports such as `discord.js` unchanged.
- Set the same `MONGODB_URI` as the Astrix Dashboard if dashboard moderation sync is required.
- Keep all secrets in environment variables only.
