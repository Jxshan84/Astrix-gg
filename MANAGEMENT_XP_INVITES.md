# Management XP + Invite update

- XP level-up channel is **per server** and stored in the server database.
- Any member with Discord **Manage Server / Manage Guild** permission can set it.
- Commands:
  - `/settings xp-channel channel:#channel`
  - `/settings xp-channel-view`
  - `/settings xp-channel-off`
- XP level-up cards post to the configured channel; if no channel is set, they fall back to the channel where XP was earned.
- Invite tracker stores the member who invited each joined member, invite code and join timestamp.
- `/invites view [user]` now shows **Invited by**.
- `/invites leaderboard` remains available.
- Command registration was kept within the existing global command budget by removing a low-priority extended command.
