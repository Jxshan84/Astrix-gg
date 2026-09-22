# Astrix deployment

## First start

1. Upload/extract this folder on the server.
2. Copy `.env.example` to `.env`.
3. Set `DISCORD_TOKEN`, `CLIENT_ID`, and `OWNER_IDS` in `.env`.
4. Install dependencies:

   ```bash
   npm install --registry=https://registry.npmjs.org
   ```

5. Start Astrix:

   ```bash
   npm start
   ```

If the hosting panel starts `index.ts` directly, that is also supported:

```bash
node index.ts
```

The project includes a small `.env` fallback loader, so a panel that starts the
file before `dotenv` is available will no longer crash with `Cannot find module
'dotenv'`. Dependencies are still required for the complete bot to run, so the
install command must be completed before starting the server. If the panel
starts `index.ts` without installing packages, Astrix now attempts the same
public-registry install automatically.

## Owner server Premium

The bot owner can grant Premium to any server Astrix is currently in:

```text
/owner premium server guild_id:<SERVER_ID> tier:<premium|plus|elite> days:<optional>
```

Leave `days` empty for permanent Premium. The existing
`/owner premium servergrant` name and the prefix compatibility command
`a!premiumserver [premium|plus|elite]` remain available.