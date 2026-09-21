# SaturdaySlate — College Football Pick 'Em Pool

A self-hosted app for a group pool where everyone picks the winner of every
FBS matchup each week. Replaces the manual "Google Doc + text thread"
workflow with accounts, live picks, a full picks board, and automatic
weekly/season standings — pulling matchups, records, spreads, and rankings
straight from ESPN.

- **Backend:** Node.js + Express + SQLite (via `better-sqlite3`) — a single
  file database, no separate DB server to run or maintain.
- **Frontend:** Server-rendered pages (EJS) + a little vanilla JS. No build
  step, no framework.
- **Deployment:** runs in a Docker container (`docker compose`), so it
  restarts automatically on crashes, server reboots, and power outages —
  no process manager needed.
- **Traffic:** reaches the outside world through a Cloudflare Tunnel, so no
  ports need to be forwarded on your router at all.
- **Matchups, scores, records, spreads & rankings:** pulled from ESPN's
  public college football scoreboard endpoint. This is an unofficial
  endpoint, not a documented ESPN API — it could change or go away without
  notice.

## Features

- **Accounts:** name + username + password, with an optional shared invite
  code (`REGISTRATION_CODE`) so strangers who find the URL can't just sign
  themselves up. Registration and login are both rate-limited against
  automated abuse.
- **Weekly picks:** pick a winner for every game before it kicks off; a
  pick locks the moment that game starts.
- **Organized by conference:** matchups are grouped into sections (ACC,
  American Athletic, Big 12, Big Ten, Conference USA, FBS Independents,
  Mid-American, Mountain West, Pac-12, SEC, Sun Belt, alphabetically), with
  crossover games (e.g. an ACC team hosting a Big Ten team) filed under the
  **home team's** conference — no duplicates.
- **Team info at a glance:** logos, AP-style rankings (`#3`), overall and
  conference win-loss records, the betting spread, and the game's location
  (with a "Neutral site" tag when it's not being played at either team's
  home stadium) — all shown right on the matchup.
- **See who picked what, right on the matchup:** once you've made all your
  own picks for the week (or the week's first game has kicked off,
  whichever comes first), small chips appear under each team showing
  exactly who picked that side.
- **Picks board:** a dedicated page (`/board`, also in the top nav) laid
  out like a spreadsheet — one row per matchup, one column per player, each
  cell showing the little logo of who they picked, colored green/red once
  games are final. Built to stay usable on a phone: the matchup column
  pins in place while you scroll sideways through players.
- **Standings:** weekly results (most correct picks wins that week, ties
  share it) and season standings, ranked by **weeks won** with total
  correct picks as the tiebreaker.
- **Auto-refresh:** scores for the currently-loaded week refresh
  automatically from ESPN every 15 minutes, every day — no need to
  remember to click "Refresh scores."
- **Admin tools:** load a week's matchups from ESPN, refresh scores, and a
  "Manage players" section to delete accounts or reset anyone's password
  directly from the browser — no server access needed for either.

## How it works (for players)

1. Register an account (with the invite code, if your group set one).
2. Pick a winner for every game before it kicks off.
3. Once you've picked everything for the week (or the week's underway),
   you can see everyone else's picks — both inline on each matchup and on
   the full **Board** page.
4. After games finish, check **Standings** to see who won the week, and
   the season leaderboard.

## Local setup (without Docker)

Useful for testing on your own machine. Requires Node.js 18+ (built-in
`fetch` is used for the ESPN calls).

```bash
npm install
cp .env.example .env
```

Edit `.env` — see [Environment variables](#environment-variables) below
for what each one does. At minimum, set `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the database and run it:

```bash
npm run init-db
npm start
```

Visit `http://localhost:3000`.

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `PORT` | No (defaults to 3000) | Port the app listens on inside its container/host. |
| `NODE_ENV` | No | Set to `production` once HTTPS is fully working end-to-end — makes session cookies HTTPS-only. |
| `SESSION_SECRET` | Yes | Long random string signing login sessions. Generate with the command above. |
| `ADMIN_NAME` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | No | If set, `npm run init-db` creates (or promotes) this account as an admin. |
| `REGISTRATION_CODE` | No | If set, anyone registering must enter this exact code. Leave blank to allow open registration. |

### Promoting an admin later

Register a normal account through the site, then either re-run
`npm run init-db` with `ADMIN_USERNAME` set to that account (it promotes
existing accounts rather than duplicating them), or run directly against
the database:

```bash
docker exec cfb-picks node -e "
const db = require('./src/db');
db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run('theirusername');
"
```

## Deploying with Docker (the way this is actually run)

1. Clone the repo onto your server: `git clone <your-repo-url> && cd cfb-picks`
2. `cp .env.example .env` and fill it in (see the table above).
3. Build and start it:
   ```bash
   docker compose up -d --build
   ```
4. Run the one-time database setup **inside** the container:
   ```bash
   docker exec cfb-picks node src/db/init.js
   ```
5. Point something at port 3000. This project runs behind a **Cloudflare
   Tunnel** (`cloudflared`, a native systemd service on the host — not a
   container): the tunnel's `config.yml` routes a hostname straight to
   `http://localhost:3000`, and Docker Compose publishes that same port to
   the host (see `docker-compose.yml`), so nothing else needs to change on
   the Cloudflare side after the initial setup.

Because `docker-compose.yml` sets `restart: unless-stopped`, Docker brings
the container back automatically after a crash, a `docker` daemon restart,
or a full server reboot — no cron job or process manager required, as long
as Docker itself is enabled to start on boot (`systemctl is-enabled
docker`, which is the default on most installs).

### Deploying an update

```bash
git pull
docker compose up -d --build
```

If a change only touches `package.json` after a `git pull` that changes
dependencies, the same `--build` step handles installing them. If a build
ever behaves like it didn't pick up a code change (rare, but possible with
Docker's layer caching), force it with:

```bash
docker compose build --no-cache
docker compose up -d
```

CSS changes bust their own cache automatically (the stylesheet's `<link>`
tag includes a version number based on the file's last-modified time), so
a plain restart is enough — no manual Cloudflare cache purge needed.

### Backups

Everything lives in `data/picks.db` (plus `data/sessions.db` for login
sessions), mounted into the container from the host's `./data` folder —
so it survives container rebuilds. Back it up periodically:

```bash
0 3 * * * cp /path/to/cfb-picks/data/picks.db /path/to/backups/picks-$(date +\%F).db
```

## Weekly workflow (for the admin)

1. Go to **Admin**.
2. Enter the season year, week number (matches ESPN's own numbering), and
   season type, then click **Pull from ESPN** to load that week's
   matchups.
3. That's mostly it — scores refresh automatically every 15 minutes from
   then on. You can still click **Refresh scores** manually any time you
   want an immediate update.

### Managing players

Also on the **Admin** page, under "Manage players": every account is
listed with a password-reset field and a delete button, both usable
straight from the browser. Deleting someone also cleanly removes all of
their picks. You can't delete your own account while logged into it, or
delete the only remaining admin.

## Project structure

```
Dockerfile            Container image definition (Debian-based, for better-sqlite3 compatibility)
docker-compose.yml    Container config: port, restart policy, data volume, env file
.dockerignore
src/
  server.js           Express app setup, sessions, routes, cache-busting
  auth.js             Password hashing, login/session helpers, password reset
  espn.js             ESPN scoreboard fetch + parsing (logos, records, rank, spread, venue)
  conferences.js      Conference display order + ESPN conferenceId lookup table
  scheduler.js        Auto-refreshes the current week's scores every 15 minutes
  services.js         Core logic: weeks, games, picks, grading, standings, user management
  db/
    schema.sql        SQLite schema
    index.js          DB connection + lightweight migrations (adds new columns safely)
    init.js           One-time setup script (creates/promotes admin user)
  routes/
    auth.js           /register, /login, /logout (rate-limited, invite-code gated)
    picks.js          Week view, pick submission, /board redirect
    standings.js      Weekly results + season standings
    admin.js          ESPN sync controls, player management (admin-only)
views/
  week.ejs            Main picks page (matchups, records, spread, picker chips)
  board.ejs            Full picks board (players x games grid)
  standings.ejs, week-results.ejs, admin.ejs, login.ejs, register.ejs, ...
public/
  css/style.css       All styling and design tokens (colors, fonts, spacing)
  js/picks.js         AJAX pick submission
```

## Notes & known limitations

- The ESPN endpoints used here are unofficial; if ESPN changes them, syncs
  will start failing (visible as an error on the Admin page). Matchups
  already loaded aren't affected, only new pulls.
- A few conference IDs in `src/conferences.js` were confirmed against live
  data, but if a smaller conference's teams ever start showing up under
  "Other" instead of their real conference, that conference's ID needs a
  one-line correction there — it's just a lookup table, not something that
  requires re-architecting anything.
- Ranking data assumes ESPN's `curatedRank` field with `99` meaning
  "unranked," based on common convention rather than official
  documentation — flag it if a ranking ever looks wrong.
- Admin accounts can promote/delete other accounts via the UI now, but
  promoting someone *to* admin still requires direct database access (see
  "Promoting an admin later" above) — there's no in-app UI for that yet.
- Postseason/bowl weeks use ESPN's own postseason week numbering, which
  doesn't always map cleanly to "Week 1, Week 2" — a custom label works
  fine for those.
