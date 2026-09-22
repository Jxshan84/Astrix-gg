# Astrix v6.3 — Direct Slash Commands

Total global direct commands: **100**

> Discord allows 100 application commands per global or guild scope. Astrix
> groups larger systems into subcommands and preserves commands already present
> in Discord during registration. `/ticket` contains 25 real slash subcommands,
> so the full ticket toolkit stays inside one global command slot.

1. `/help` — Open the interactive Astrix help center.
2. `/ping` — Show a live Astrix performance card and latency graph.
3. `/balance` — View wallet, bank and net worth.
4. `/profile` — View an Astrix profile card.
5. `/daily` — Claim your daily economy reward.
6. `/weekly` — Claim your weekly economy reward.
7. `/deposit` — Deposit wallet coins into your bank.
8. `/withdraw` — Withdraw bank coins into your wallet.
9. `/pay` — Send wallet coins to another user.
10. `/leaderboard` — View the server economy leaderboard.
11. `/inventory` — View your inventory.
12. `/use` — Use an inventory item.
13. `/sell` — Sell an owned inventory item through the unified Astrix Market.
14. `/work` — Open the interactive career and shift dashboard.
15. `/jobs` — View unlocked and locked career jobs.
16. `/applyjob` — Apply for a career job.
17. `/shift` — Start, end or view your current work shift.
18. `/career` — View career progress and job unlocks.
19. `/loan` — Open the virtual bank loan center or request a quote.
20. `/credit` — View your virtual economy credit report.
21. `/repay` — Repay your active virtual loan.
22. `/shop` — Open the unified level-scaled Astrix Market; Premium discounts apply automatically.
23. `/buy` — Buy an unlocked item from the unified market stock with autocomplete.
24. `/premium` — Open your Astrix Premium status and benefits dashboard.
25. `/ai set channel:#channel` — Admin: make Astrix AI reply only in one channel.
    `/ai view` shows the current channel and `/ai off` allows AI in every channel again.
26. `/ask` — Ask Astrix AI a question.
27. `/translate` — Translate text with Astrix AI.
28. `/imagine` — Generate an AI image within your daily quota.
29. `/rewrite` — Rewrite text with Astrix AI.
30. `/summarize` — Summarize text with Astrix AI.
31. `/generate` — Generate useful text with Astrix AI.
32. `/aiusage` — View AI daily limits and cooldowns. When an AI channel is set, use this there.
33. `/play` — Play a song from SoundCloud search or a supported direct link.
34. `/pause` — Pause music playback.
35. `/resume` — Resume music playback.
36. `/skip` — Skip the current track.
37. `/queue` — View the current music queue.
38. `/nowplaying` — Show the current track with player controls.
39. `/loop` — Set music loop mode.
40. `/volume` — Set music volume.
41. `/stop` — Stop music and clear the queue.
42. `/disconnect` — Disconnect Astrix from the voice channel.
43. `/record` — Open recording controls or perform an action.
44. `/ban` — Ban a member.
45. `/unban` — Unban a user by ID.
46. `/kick` — Kick a member.
47. `/timeout` — Timeout a member.
48. `/untimeout` — Remove a member timeout.
49. `/warn` — Warn a member.
50. `/warnings` — View a member warning history.
51. `/clearwarns` — Clear a member warning history.
52. `/purge` — Delete recent messages.
53. `/lock` — Lock the current channel.
54. `/unlock` — Unlock the current channel.
55. `/slowmode` — Set channel slowmode seconds.
56. `/nickname` — Change or reset a member nickname.
57. `/role` — Add or remove a role from a member.
58. `/reactionrole` — Create a reaction-role mapping.
59. `/buttonrole` — Create a button-role panel.
60. `/rolemenu` — Create a self-role select menu with up to five roles.
61. `/autorole` — Configure automatic join roles.
62. `/verify` — Create the verification panel.
63. `/welcome` — Configure welcome messages.
64. `/goodbye` — Configure goodbye messages.
65. `/logs` — Set the Astrix log channel.
    `/settings log-channel channel:#channel` does the same; `/settings log-channel-view`
    shows the current channel and `/settings log-channel-reset` uses the automatic fallback.
    The selected channel contains one continuously updated embed with Messages, VC Time and Moderation sections.
66. `/automod` — Configure an AutoMod module.
67. `/antilink` — Toggle link protection.
68. `/antiinvite` — Toggle Discord invite protection.
69. `/antispam` — Configure anti-spam.
70. `/badwords` — Manage the custom blocked-word list.
71. `/security` — Open the owner-only Astrix Security Center.
72. `/antinuke` — Configure anti-nuke protection.
73. `/recover` — Recover missing server structure from the latest Astrix backup.
74. `/backup` — Create a server structure and Astrix configuration backup.
75. `/xp` — View an image-based XP progress card.
76. `/antibot` — Configure unauthorized bot protection.
77. `/trust` — Trust a user for Astrix security bypass.
78. `/untrust` — Remove a user from the Astrix security trusted list.
79. `/antiraid` — Configure join-raid protection.
80. `/lockdown` — Enable emergency server lockdown.
81. `/unlockdown` — Restore channels from Astrix emergency lockdown.
82. `/antinsfw` — Configure NSFW-content safety filtering.
83. `/securitystatus` — View security protection status and recent incidents.
83. `/givecoins` — Owner: give virtual coins to a user.
84. `/setbalance` — Owner: set a user wallet and bank balance.
85. `/giveitem` — Owner: give an inventory item.
86. `/givepremium` — Owner: grant Astrix Premium.
87. `/removepremium` — Owner: remove manually granted Astrix Premium.
88. `/shoprefresh` — Owner: immediately rotate shop stock.
89. `/setcredit` — Owner: set a virtual economy credit score.
90. `/announce` — Owner: send a branded announcement.
91. `/serverinfo` — View server information.
92. `/userinfo` — View member information.
93. `/avatar` — View a user avatar.
94. `/roleinfo` — View role information.
95. `/botinfo` — View Astrix bot information.
96. `/uptime` — View Astrix uptime.
97. `/membercount` — View server member counts.
98. `/rps` — Play rock paper scissors.
99. `/trivia` — Start a quick trivia question.
100. `/ticket` — Complete support-ticket system with 25 subcommands.

## `/ticket` subcommands

`/ticket home` • `/ticket create` • `/ticket status` • `/ticket list` • `/ticket claim` • `/ticket unclaim` • `/ticket close` • `/ticket reopen` • `/ticket add` • `/ticket remove` • `/ticket rename` • `/ticket transfer` • `/ticket priority` • `/ticket move` • `/ticket lock` • `/ticket unlock` • `/ticket transcript` • `/ticket delete` • `/ticket setup` • `/ticket panel` • `/ticket config` • `/ticket maxopen` • `/ticket stats` • `/ticket note` • `/ticket pingstaff`

## v6.3 Extended Guild Slash Commands

These commands are registered per server and do not replace the 100 core global slash commands.

- `/giveaway start|end|reroll|list` — free-entry giveaways only.
- `/prefix show|set|reset` — configure the server prefix.
- `/noprefix grant|revoke|list|status` — let server administrators manage member-scoped no-prefix text command access.
- `/premiumcurrency balance|grant|remove|set` — Astrix Gems; management actions are bot-owner only.
- `/earlyaccess status|grant|remove` — Early Access management; grant/remove are bot-owner only.
- `/premiumtiers` — show Premium, Premium+, Elite and their Astrix Gems grant bundles.
- `/autorespond add|remove|list|toggle` — server automatic responses.

## Recording

- `/record start`
- `/record stop`
- `/record status`
- `/record config log_channel:#channel silence_minutes:5`

## AutoMod / Security controls
- `/automod` — configure Spam, Duplicate, Links, Invites, Phishing, Mentions, Caps, Emoji, Bad Words and NSFW modules with punishment variables and escalation.
- `/antilink` — link protection with configurable punishment and timeout.
- `/antiinvite` — Discord invite protection with configurable punishment and timeout.
- `/antispam` — spam threshold/window plus configurable punishment.
- `/antinsfw` — unsafe-content filtering and punishment.
- `/antinuke` — owner-only Anti-Nuke threshold, window, containment and lockdown settings.
- `/backup`, `/recover`, `/lockdown`, `/unlockdown` — safe emergency protection and recovery tools.

## AutoMod punishment DMs
AutoMod, Anti-Link, Anti-Invite, Anti-Spam and Anti-NSFW support `dm_user`. It defaults to enabled. Warn, Timeout, Kick and Ban send a DM before the action when possible. Delete-only does not send a punishment DM. Closed DMs never block moderation.
