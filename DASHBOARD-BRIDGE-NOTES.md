# Astrix v8.2 Dashboard Bridge

This build preserves the existing v8.2 bot and adds a MongoDB bridge for the dashboard.

- Welcome Studio is used for real `guildMemberAdd` events after the dashboard Welcome module has been saved at least once.
- Leave Studio is used for real `guildMemberRemove` events after the dashboard Leave module has been saved at least once.
- Legacy `/welcome` and `/goodbye` remain fallbacks until their dashboard module is explicitly managed.
- AutoMod settings are synchronized both ways between the dashboard and the current slash-command configuration.
- Security settings are synchronized both ways while runtime lockdown state remains local to the running bot.
- Active local Astrix Premium grants are mirrored into the `premiums` MongoDB collection at startup, and future owner grants/revokes are mirrored automatically.
- The existing AutoMod punishment DM behavior and hour-based timeout configuration are preserved.
- Premium Welcome Studio motion selections use a real hosted GIF in Discord. Set `WELCOME_HOSTED_GIF_URL` to replace the default hosted animation.
