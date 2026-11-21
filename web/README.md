# Gorilla Squad web (React + Tailwind)

- `npm run dev` / `npm run build` (output `dist/`), `npm run build:single` (one HTML file for previews).
- `src/ui/index.jsx`: the design system. Fixed-size Button/IconButton (h-9/11/12), Input/Select (h-12), Textarea, Card (borderless, shadow), Rows, StatGroup, Chip (category), Status (dot + label), Avatar, Tabs, Sheet, Toast, Page (top bar + body + action bar), PageTitle, Empty. Use these, never raw buttons/inputs.
- Type scale in `tailwind.config.js`: display, title, heading, subhead, body, small, caption (min 12px). Fonts are bundled via @fontsource.
- Feed actions: colour-coded stack bottom right — Apply green, Visit blue, Details gold, Share white (Manage on your own offers).
- `src/lib/store.jsx`: mock store. Replace each action body with an `/api/squad/*` call to go live; screens only use the store.
- Tabs: Feed, Create, Chats, Profile. Offer and product are pushed pages. Chats is a three-pane view on desktop.
