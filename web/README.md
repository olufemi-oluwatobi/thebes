# Gorilla Squad web (React + Tailwind)

- `npm run dev` / `npm run build` (output `dist/`), `npm run build:single` (one HTML file for previews).
- `src/ui/index.jsx`: fixed-size primitives (Button h-12, IconButton round, Input h-12, Textarea, Card, Tabs, Sheet). Use these, never raw buttons/inputs.
- `src/lib/store.jsx`: mock store. Replace each action body with an `/api/squad/*` call to go live; screens only use the store.
- Tabs: Feed, Create, Chats, Profile. Offer and product are pushed pages. Chats is a three-pane view on desktop.
