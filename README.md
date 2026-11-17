# Thebes

A contest network for small businesses: branded word games in a vertical feed, with leaderboards, winners, social, and
contacts for the business. One Cloudflare Worker serves everything. Games are made with godtongue, in the creator's
browser; nothing is built on a server.

## What is in the MVP

- **Feed** (`/`): swipe through games; the visible one is live in a frame. Like, comments, leaderboard, players, share,
  follow. Closed contests show "Closed" with their winners.
- **Play**: every guess is scored by the Worker; the word never reaches the browser. One play per person per contest;
  progress resumes. Guests can play; signing in carries their plays over.
- **Leaderboards and winners**: contests and dailies get a leaderboard automatically (fewest tries, then fastest).
  When one closes (its end time, or an admin ends it) the winners are written once, as many as its prize says.
  Challenges have no leaderboard.
- **Create** (`/#create`): game → look → brand (logo, colours picked from it) → brief (type, word, tries, time, prize,
  winners, end, contact fields) → design (AI fills the template's slots, checked; preview is playable) → publish.
- **Profile** (`/#profile`): player stats and games; for each business: views, plays, solves, contacts, contests,
  contacts export (CSV).
- **Admin** (`/#admin`, admins only): overview; pin, end, remove, restore contests; user roles; suspend businesses and
  change plans; reports.
- **Contacts**: after a game, players can leave details; each entry stores the exact consent text they agreed to.

## Run it locally

```
npm install
npm run db:local        # create the local database and seed it
npm run dev             # builds the browser runtime, starts the Worker on http://localhost:8787
npm test                # in another terminal: 47 end-to-end checks against the running Worker
```

Locally, sign-in links are shown on screen instead of emailed, and `admin@thebes.local` is an admin.

## Deploy to Cloudflare

```
npx wrangler login
npx wrangler d1 create thebes                 # copy the database_id into wrangler.jsonc
npx wrangler r2 bucket create thebes-files
npx wrangler secret put RESEND_API_KEY        # sign-in emails (resend.com); sign-in does not work without it
```

In `wrangler.jsonc`, set `APP_URL` (your workers.dev URL or domain), `EMAIL_FROM` (a sender Resend has verified) and
`ADMIN_EMAILS` (your email). Then:

```
npm run deploy                                 # builds, applies migrations to the remote database, deploys
npx wrangler d1 execute thebes --remote --file db/seed/0001_plans_games.sql   # once: tiers, game, templates
```

Sign in with an email from `ADMIN_EMAILS` and you are an admin. The cron (every 5 minutes) opens scheduled contests and
closes ended ones; the feed also closes due contests when it loads.

## Layout

| Path | What |
| --- | --- |
| `src/worker.js` | the API, game pages (`/play/:id`), files, sign-in, cron |
| `public/` | the app (`index.html`, `app.js`, `app.css`), templates, images, `runtime/` (built) |
| `src/browser/compiler-worker.js`, `scripts/build-runtime.mjs` | godtongue in the browser |
| `vendor/godtongue` | the godtongue compiler and game engine (from studio-morgana, branch thebes-wordle) |
| `db/` | D1 migrations, seed, `check.py` |
| `docs/wizard.md` | how the design step works |
| `test/smoke.mjs` | end-to-end checks |

## Not in the MVP

Payments, push notifications, more games, the landing page, rate limiting beyond Cloudflare's defaults, image
moderation, and reporting from the app (the API and admin queue exist; the app has no Report button yet).
