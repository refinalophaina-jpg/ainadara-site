# ainadara-site
Personal brand hub — static Astro site for ainadara.com

## Content

The hub's words and threads live in `src/content/`, not TypeScript:

- `src/content/site/site.json` — the singleton: name, domain, email, eyebrow,
  the OG image, and Plausible analytics.
- `src/content/threads/*.json` — one file per thread card on the workshop
  grid (`pharmacy.json`, `learn.json`, …), each carrying its own `label`,
  `host`, `glyph`, `live` flag, `order`, `blurb` and optional `version`.

Both collections are schema-validated at build time
(`src/content/config.ts`, zod, ships with Astro — no added dependency): a
malformed edit fails `astro build` rather than shipping. `src/pages/index.astro`
reads the threads via `getCollection("threads")`, sorted by `order`.
