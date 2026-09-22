# Astrix v5.9 Ticket Commands

## User
- `/ticket home` — Open Ticket Center.
- `/ticket create` — Create a private ticket.
- `/ticket status` — View your open tickets/history.
- `/ticket close` — Ticket owner or staff can close the current ticket.
- `/ticket rename name:<name>` — Owner or staff can rename the current ticket.
- `/ticket transcript` — Owner or staff can export the transcript.
- `/ticket pingstaff` — Request the configured support role; non-staff users have a 10-minute ping cooldown.

## Ticket Staff
- `/ticket list state:<open|closed|all>`
- `/ticket claim`
- `/ticket unclaim`
- `/ticket reopen`
- `/ticket add user:<member>`
- `/ticket remove user:<member>`
- `/ticket transfer user:<member>`
- `/ticket priority level:<low|normal|high|urgent>`
- `/ticket move category:<category>`
- `/ticket lock`
- `/ticket unlock`
- `/ticket note text:<note>`
- `/ticket delete` — Confirmation required.
- `/ticket stats`

## Server Managers / Owner
- `/ticket setup category:<category> support_role:<role> log_channel:<channel> panel_channel:<channel>`
- `/ticket panel channel:<channel>`
- `/ticket config`
- `/ticket maxopen amount:<1-5>`

Buttons inside ticket channels remain available for Create, Claim, Close, Add User, Remove User, Rename, Reopen, Transcript and Delete.
