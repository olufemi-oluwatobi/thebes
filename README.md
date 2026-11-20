# Gorilla Squad

Put your product in your customers' hands. Sellers list a product with a link, a short pitch and a flyer, and choose a
reward (per click, per sign-up or per snippet). Marketers see campaigns in their city or country, copy the snippet, get a
unique link and QR code, and are paid from the seller's budget on checked results. One Cloudflare Worker serves
everything: the site (`/`), the app (`/app/`), tracked links (`/s/<code>`) and the API.

The games engine (godtongue, the Thebes contests and `/play/:id`) is still in this repo and still works. The Gorilla
Squad home page and app do not link to it.

## Gorilla Squad API (offer model)

Sellers list **products** (optionally under a **company**) and post **offers** of an **offer type**
(commission, sponsored post, introduction, or a type a user proposed and an admin approved). Marketers add their
**socials** and show **interest** in an offer; the seller accepts or denies it. Accepting starts a **relationship**
with the terms frozen. The marketer reports **deliveries** (of a **delivery type**), the seller or an admin verifies
them, and both sides **message** each other on the relationship. Users, companies, sellers, marketers, socials,
products, offers and deliveries carry `is_verified`, `is_deleted` and `is_blocked`.

Schema: `db/migrations/0011_squad_offers.sql`. Routes: `src/squad-routes.js`. Tests: `node test/squad.mjs` (141 checks).

- Me: `GET/PATCH/DELETE /api/squad/me` (first and last name optional)
- Companies: `POST /api/squad/companies`, `GET/PATCH /api/squad/companies/:id`
- Sides: `POST /api/squad/sellers`, `POST /api/squad/marketers`, `GET /api/squad/marketers/:id`
- Socials: `GET/POST /api/squad/socials`, `PATCH/DELETE /api/squad/socials/:id` (edits undo verification)
- Products: `GET/POST /api/squad/products`, `GET/PATCH/DELETE /api/squad/products/:id`
- Types: `GET/POST /api/squad/offer-types`, `GET/POST /api/squad/delivery-types`
- Offers: `GET /api/squad/offers?type=&country=&q=&eligible=1`, `POST /api/squad/offers`, `GET /api/squad/seller/offers`,
  `GET/PATCH/DELETE /api/squad/offers/:id`, `POST /api/squad/offers/:id/status` (open, paused, closed)
- Interests: `POST/GET /api/squad/offers/:id/interests`, `GET /api/squad/interests`,
  `POST /api/squad/interests/:id/accept|deny|withdraw`
- Relationships: `GET /api/squad/relationships?as=seller|marketer`, `GET /api/squad/relationships/:id`,
  `POST /api/squad/relationships/:id/status` (paused, active, ended)
- Deliveries: `GET/POST /api/squad/relationships/:id/deliveries`, `POST /api/squad/deliveries/:id/verify|reject`, `DELETE /api/squad/deliveries/:id`
- Messages: `GET/POST /api/squad/relationships/:id/messages?after=`, `POST /api/squad/relationships/:id/read`, `DELETE /api/squad/messages/:id`
- Admin: `GET /api/admin/squad/queue`, `GET /api/admin/squad/:kind?flag=`, `POST /api/admin/squad/:kind/:id`
  (`verify`, `unverify`, `block`, `unblock`, `delete`, `restore`, `flag`, `unflag`, `approve`, `unapprove`, `reject`)

Errors are `{ error, code }` with codes such as `no_seller`, `no_marketer`, `blocked`, `not_eligible` (with `reasons`),
`duplicate`, `full`, `decided`, `has_relationships`, `bad_transition`, `invalid_terms`.

## Run it locally

```
npm install
npm run db:local        # create the local database and seed it
npm run dev             # builds the browser runtime, starts the Worker on http://localhost:8787
npm test                # the games engine: 91 end-to-end checks
node test/squad.mjs     # Gorilla Squad: 74 end-to-end checks, against the same running Worker
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
