# Thebes

A contest network for small businesses: branded games in a vertical feed, built on Cloudflare and godtongue.

## Database (Cloudflare D1)

`db/migrations` run in order with `wrangler d1 migrations apply`; `db/seed` holds the tiers, the first game type and the
first two templates. Check them locally (no Cloudflare needed): `python3 db/check.py`.

| Area | Tables |
| --- | --- |
| People | `users`, `auth_identities`, `login_tokens`, `sessions` |
| Companies | `companies` (with the brand kit), `company_members` (owner, admin, editor, analyst), `company_invites`, `assets` |
| Tiers | `plans` (free, pro, business; limits as JSON), `subscriptions` |
| Games | `game_types` (settings schema, secret fields, scoring, tier), `templates`, `template_versions` (source + slot manifest) |
| Contests | `series`, `contests` (type: challenge, contest, daily, tournament), `contest_secrets`, `contest_prizes`, `contest_assets`, `contest_builds` |
| Wizard | `design_sessions`, `design_turns` |
| Play | `players`, `plays`, `play_moves`, `series_stats`, `entries` (contacts with consent) |
| Social | `likes`, `comments`, `follows`, `contest_counters`, `company_counters` |
| Moderation | `reports` |

Live ranks and scoring run in the leaderboard service (a Durable Object per contest); raw activity goes to Analytics
Engine. These tables are what those write down.

The wizard: `docs/wizard.md`.
