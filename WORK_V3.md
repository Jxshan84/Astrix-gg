# Astrix Work V3

- `/work panel` - overview
- `/work list [page]` - 120 careers
- `/work apply <job>` - autocomplete application
- `/work shift` - interactive mini-job
- `/work stats [user]` - work statistics
- `/work career` - progression/unlocks
- `/work leaderboard` - server work rankings
- `/work history [page]` - recent results
- `/work resign confirm:true` - resign
- `/work notify <enabled>` - shift-ready DM alerts

Every completed shift has a fixed 15-minute cooldown. The persistent JSON store records a notification flag; a background scheduler DMs the user when the cooldown expires. `data/work-mini-jobs.json` contains 1,200 distinct mini-job challenge variants and `data/jobs.json` contains 120 careers.
