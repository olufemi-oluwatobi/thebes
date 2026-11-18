# Gorilla Squad

Put your product in your customers' hands. Sellers list a product with a link, a short pitch and a flyer, and choose a
reward (per click, per sign-up or per snippet). Marketers see campaigns in their city or country, copy the snippet, get a
unique link and QR code, and are paid from the seller's budget on checked results. One Cloudflare Worker serves
everything: the site (`/`), the app (`/app/`), tracked links (`/s/<code>`) and the API.

The games engine (godtongue, the Thebes contests and `/play/:id`) is still in this repo and still works. The Gorilla
Squad home page and app do not link to it.

## Gorilla Squad MVP

- **Home** (`/`): split screen, sell on one side, become a marketer on the other.
- **Sign-in** (`/app/#signin`): email link, no password. Marketers add city, country and phone (`/app/#me`).
- **Sell** (`/app/#sell`): a business, then a campaign: product link, pitch, flyer, reward rule and reward, where it can
  be shared (`Lagos, NG`, `NG`, or `*`). Fund it, send it for review, and see live stats. Sign-up campaigns get a
  postback URL for the seller's thank-you page.
- **Board** (`/app/#board`): full-screen cards, local or global, with the exact reward and budget left. One tap copies
  the snippet and the marketer's link together. The details page has the QR code.
- **Links** (`/app/#links`): live counters per link (today, verified, not counted, earned), refreshed every 15 seconds.
- **Clicks** (`/s/<code>`): each visit is logged and the shopper goes on to the product with `gs_ref`. A click pays only
  if it comes from a real browser (not a bot or a datacenter) and the same device has not clicked the same link in the
  last 24 hours. Budgets are never overspent.
- **Wallet** (`/app/#wallet`): available vs pending (earnings are pending for 7 days), the ledger, and payout requests
  (bank, PayPal or USDT; minimum $10; above $50 an ID check is flagged).
- **Admin** (`/app/#admin`, admins only): review and approve campaigns, add funds after a confirmed transfer, approve
  posts for per-snippet rewards, mark payouts paid or reject them, and see fraud flags.

**Not built yet:** card and local-payment funding (Stripe, Paystack, Flutterwave), instant WhatsApp, SMS or push alerts,
automated phone verification, automated ID checks, and automated payouts. Funding and payouts are done by hand from the
admin page for now.

## Run it locally

```
npm install
npm run db:local        # create the local database and seed it
npm run dev             # builds the browser runtime, starts the Worker on http://localhost:8787
npm test                # the games engine: 91 end-to-end checks
node test/squad.mjs     # Gorilla Squad: 65 end-to-end checks, against the same running Worker
```

Locally, sign-in links are shown on screen instead of emailed, and `admin@thebes.local` is an admin.

## Thebes games (kept in the repo)


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

Sign in with an email from `ADMIN_EMAILS` and you are an admin. Scheduled contests open, and ended ones close (with
their winners picked), whenever the feed loads or someone plays. On Workers Paid you can add a cron for this too (see
the note in `wrangler.jsonc`).
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
