# SaturdaySlate — College Football Pick 'Em Pool

A small self-hosted app for a group pool where everyone picks the winner of
each FBS matchup every week. Replaces the manual "Google Doc + text thread"
workflow with accounts, a live pick grid, and automatic weekly/season
standings.

- **Backend:** Node.js + Express + SQLite (via `better-sqlite3`) — a single
  file database, no separate DB server to run or maintain.
- **Frontend:** Server-rendered pages (EJS) + a little vanilla JS. No build
  step, no framework — just copy the folder onto a server and run it.
- **Matchups & scores:** pulled from ESPN's public college football
  scoreboard endpoint (FBS games only). This is an unofficial endpoint, not a
  documented ESPN API — it could change or go away without notice.

## How it works

1. Everyone creates an account (name + username + password).
2. An admin loads each week's matchups from ESPN (one click).
3. Each player picks a winner for every game before it kicks off. Once a
   game starts, that pick locks — no more editing.
4. **Seeing everyone else's picks:** to keep things fair, you only see the
   full pick grid for a week once you've submitted your own picks for every
   game, *or* once the first game of the week has kicked off — whichever
   happens first. That way nobody can just copy others' picks, but the group
   still isn't stuck waiting on stragglers once games are underway.
5. After games finish, the admin hits "Refresh scores" (same button as
   loading the week — it's safe to re-run) and the app grades everyone
   automatically: most correct picks in a week wins that week. Ties share
   the win.
6. The season standings page ranks everyone by **how many weeks they've
   won** (with total correct picks as a tiebreaker) — matching how your
   group already decided to crown a season winner.

## Local setup

Requires Node.js 18+ (built-in `fetch` is used for the ESPN calls).

```bash
npm install
cp .env.example .env
```

Edit `.env`:
- Set `SESSION_SECRET` to a long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Optionally set `ADMIN_NAME` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` so the
  first admin account gets created automatically in the next step. (You can
  also just register a normal account through the site and promote it to
  admin later — see "Promoting an admin" below.)

Create the database:

```bash
npm run init-db
```

Run it:

```bash
npm start
```

Visit `http://localhost:3000`.

### Promoting an admin later

If you didn't set the `ADMIN_*` env vars up front, register a normal account
through the site, then run:

```bash
sqlite3 data/picks.db "UPDATE users SET is_admin = 1 WHERE username = 'yourusername';"
```

(or re-run `npm run init-db` after setting the `ADMIN_*` vars for that
username — it'll promote an existing account instead of creating a
duplicate).

## Weekly workflow (for the admin)

1. Go to **Admin**.
2. Enter the season year and week number (matches ESPN's own week
   numbering — Week 1, Week 2, etc. through the regular season; use
   "Postseason / Bowls" for bowl season).
3. Click **Pull from ESPN**. This loads every FBS matchup for that week.
4. After games finish (e.g. the following morning), come back and click
   **Refresh scores** next to that week — this re-pulls the same games and
   fills in final scores/winners, which triggers grading everywhere else in
   the app.

## Deploying on your own server

This is a plain Node.js app, so it runs anywhere Node runs. A common setup:

1. Copy this folder to your server (e.g. via `git` or `scp`).
2. `npm install --production`
3. Set up `.env` on the server (same as local setup, but set
   `NODE_ENV=production` once you have HTTPS in front of the app — this
   makes session cookies `secure`, i.e. HTTPS-only).
4. Run the app with a process manager so it restarts on crashes/reboots.
   [pm2](https://pm2.keymetrics.io/) is a simple option:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name cfb-picks
   pm2 save
   pm2 startup   # follow the printed instructions to run on boot
   ```
5. Put a reverse proxy in front of it for your domain + HTTPS (nginx +
   [certbot](https://certbot.eff.org/) for a free Let's Encrypt cert is the
   standard route). Example nginx server block:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Then run `certbot --nginx -d yourdomain.com` to add HTTPS, and set
   `NODE_ENV=production` in your `.env` afterward.
6. Point your domain's DNS A record at your server's IP if you haven't
   already.

### Backups

Everything lives in `data/picks.db` (plus a `data/sessions.db` for login
sessions). Back up `data/picks.db` periodically — it's a single file, so a
simple cron job copying it somewhere safe is enough for a group this size:
```bash
0 3 * * * cp /path/to/cfb-picks/data/picks.db /path/to/backups/picks-$(date +\%F).db
```

## Automating the weekly ESPN sync (optional)

Instead of manually clicking "Pull from ESPN" / "Refresh scores" each week,
you can hit those same admin routes from a cron job with `curl`, using a
logged-in session cookie. This is optional polish — manual clicks work fine
for a small group — so it isn't wired up out of the box. Ask if you'd like
this scripted out.

## Project structure

```
src/
  server.js        Express app setup, sessions, routes
  auth.js           Password hashing, login/session helpers
  espn.js           ESPN scoreboard fetch + parsing
  services.js       Core logic: weeks, games, picks, grading, standings
  db/
    schema.sql      SQLite schema
    index.js        DB connection (applies schema on boot)
    init.js         One-time setup script (creates admin user)
  routes/
    auth.js         /register, /login, /logout
    picks.js        Week view + pick submission
    standings.js     Weekly results + season standings
    admin.js         ESPN sync controls (admin-only)
views/            EJS templates
public/           CSS + client-side JS
```

## Notes & known limitations

- The ESPN endpoint used here is unofficial; if ESPN changes it, the sync
  will start failing (you'll see an error on the Admin page). Matchups
  already loaded aren't affected, only new pulls.
- Any account can be promoted to admin via the database, but there's no
  in-app UI for managing admins yet — that's a natural place to extend this
  if you want to hand admin duties to more than one person.
- Postseason/bowl weeks use ESPN's week numbering for the postseason, which
  doesn't always map cleanly to "Week 1, Week 2" — you may want to just use
  a custom label for those.
