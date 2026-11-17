# The contest wizard

The wizard makes a contest from a **template**. The design itself is fixed: a template is a finished godtongue skin with
`$slots` in it. The AI does not draw. It fills slots (short text, colours), and assets are placed into the slots made for
them. Then godtongue compiles and builds the page. That keeps every contest on-brand, fast to make, and impossible to break.

## Steps (`design_sessions.step`)

| Step | The user | Stored |
| --- | --- | --- |
| `game` | picks a game tile (Daily Word) | `game_type_id` |
| `template` | picks a look (Pop Player, Analog Player); tiers above theirs show locked | `template_id`, `template_version` |
| `assets` | picks or uploads a logo and photos (saved to the company) | `asset_ids` (rows in `assets`) |
| `brief` | writes a line or two, and sets type, dates, word, tries, time, prize, contact fields | `brief`, `settings` |
| `design` | waits a few seconds | `slot_values`, a `contest_builds` row, a `design_turns` row |
| `tweak` | asks for changes in words ("warmer colours", "shorter prize line") | more `design_turns` and builds |
| `publish` | presses Publish | `contests.status`, `current_build_id`, `published_at` |

## The final stage: design

```
inputs ──► 1 fill from data ──► 2 AI fills the rest ──► 3 check ──► 4 place assets ──► 5 compile + build ──► preview
                                       ▲                    │                                  │
                                       └──── repair (≤2) ◄──┴──────────── diagnostics ◄─────────┘
```

1. **Fill from data.** Every slot with `from` is filled straight from the database: `secret.word`, `settings.tries`,
   `settings.time`, `series.slug`, `contest.slug`, `company.name`, `contest.title`, `contest.win_message`. No AI.
2. **AI fills the rest.** Only slots marked `ai` go to the model, with the brief, the company's brand kit
   (`companies.brand`), the dominant colours of the chosen assets (`assets.colors`) and the slot manifest. `ai` says
   what it may do: `write` (new text), `shorten` (make the `from` value fit `max`), `pick` (a colour for a `role`).
   The model answers with JSON only: `{ "slots": { "subtitle": "…", "field": "#1f8bff", … } }`.
3. **Check.** Every value against its slot: type, `max` length, `case`, colour format, and every `rules` contrast
   (WCAG ratio). A failing value gets one repair turn with the reason ("ink on band is 2.1:1, needs 4.5"); after two,
   the template's own default is used. The user never sees a broken design.
4. **Place assets.** Each `asset` slot takes the best matching asset by `kinds` (a logo before a logo mark, a
   transparent PNG before a JPEG) and is passed to godtongue as `$logo` (a file next to the source), placed by the template
   in its `place` with `fit`.
5. **Compile and build.** Template source + slot values → godtongue (`$slot` variables, the same as `gt batch`) → the
   `game` engine → page and poster to R2 → a `contest_builds` row. Compiler diagnostics go back to step 2 as a repair.

A **tweak** is the same loop with the user's request and the current values: the model returns only the slots it
changes (`design_turns.patch`), so a tweak never redesigns what the user liked.

The word is a secret: it is filled in on the server only, never sent to the model, never in `slot_values`. In contest mode
the leaderboard service scores guesses, so the word never reaches the browser either.

## A template's slot manifest (`template_versions.slots`)

```json
{
  "slots": {
    "brand":   { "type": "text", "max": 16, "case": "upper", "from": "company.name", "ai": "shorten" },
    "field":   { "type": "color", "role": "background", "ai": "pick" },
    "sponsor": { "type": "color", "role": "brand", "ai": "pick", "prefer": "company.brand.colors.primary" },
    "logo":    { "type": "asset", "kinds": ["logo", "logo-mark"], "optional": true, "place": "sponsor-panel", "fit": "contain", "box": [760, 120] },
    "word":    { "type": "word", "from": "secret.word" }
  },
  "rules": [ { "contrast": ["ink", "band"], "min": 4.5 } ]
}
```

| Slot type | Value | Notes |
| --- | --- | --- |
| `text` | string | `max`, `case` (`upper`, `title`, `as-is`) |
| `color` | `#rrggbb` | `role` tells the model what it is for; `prefer` seeds it from the brand kit |
| `asset` | an `assets.id` | `kinds`, `place` (a drawn thing in the template), `fit`, `box` |
| `word` | a-z, length from the game | secret |
| `integer`, `seconds`, `slug` | | from settings |

## Tiers

`plans.limits` decides: how many contests can be live, AI designs a month (`design_turns` counted), plays a month,
contact export, prizes, analytics days, removing the Thebes mark. `game_types.min_plan_id` and `templates.min_plan_id`
lock games and looks by tier (the Analog Player starts at Pro in the seed).

## What still has to be made

- `templates/pop-player/v1.gt`: `godtongue/examples/games/pop-player.gt` with its values turned into `$slots`, plus a
  logo placement in the sponsor panel (the analog template already exists as `deck/template.gt`).
- The model prompt and the checker (step 2 and 3), in the API Worker.
