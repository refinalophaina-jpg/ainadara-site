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

You can edit this content two ways:

- **At your desk:** `npm run studio` from the `automation/` folder in the
  control-plane project. Runs locally on your Mac, no setup needed.
- **From your phone, anywhere:** `ainadara.com/admin`. This needs the
  one-time setup below before it will work.

## Setting up `/admin`

`/admin` lets you sign in with GitHub and edit the site from your phone —
no laptop needed. It's a small program (a "Cloudflare Pages Function")
that lives in this repo, at `functions/admin/`. Before it will work on the
live site, you need to do two things, once: create a GitHub "OAuth app" (a
way for this site to ask GitHub "is this really you?"), and tell
Cloudflare its two secret codes.

**Why this matters:** `/admin` is a sign-in page on your live, public
website. Until you've done this setup, it will refuse every sign-in
attempt safely (it just won't work) — but you should still treat the two
values below as passwords, not something to paste into an email or a
group chat.

### Step 1 — Create the GitHub OAuth app

1. Go to <https://github.com/settings/developers>, click **"OAuth Apps"**,
   then **"New OAuth App"**.
2. Fill in:
   - **Application name:** `ainadara.com admin` (or anything you'll recognise)
   - **Homepage URL:** `https://ainadara.com`
   - **Authorization callback URL:** `https://ainadara.com/admin/callback`
     — this one has to be exact, including `https://` and no trailing slash.
3. Click **"Register application"**.
4. You'll land on the app's settings page. You'll see a **Client ID**
   right away — copy it somewhere temporary.
5. Click **"Generate a new client secret"**. GitHub shows it to you
   **once** — copy it immediately. If you navigate away before copying it,
   you'll need to generate a new one (the old one still works until you
   revoke it, but you won't be able to see it again).

Only your own GitHub account (`refinalophaina-jpg`) will ever be allowed
to sign in through `/admin`, no matter who else discovers the sign-in
page or has a GitHub account of their own — that's enforced in the code,
not just by keeping the OAuth app private.

### Step 2 — Add the two values to Cloudflare

1. In the Cloudflare dashboard, go to **Workers & Pages** → the
   `ainadara-site` project → **Settings** → **Environment variables**.
2. Add two variables, both under **Production** (and **Preview** too, if
   you want `/admin` to also work on PR preview deploys):
   - `GITHUB_CLIENT_ID` — paste the Client ID from step 1. This one is
     fine as plain text ("Value" type).
   - `GITHUB_CLIENT_SECRET` — paste the Client secret from step 1. Use the
     **"Encrypt"** option Cloudflare offers for this field — it keeps the
     value out of the dashboard's plain-text view after you save it.
3. Save. Cloudflare Pages picks up environment variables on the next
   deploy, so you may need to trigger one (a new push, or "Retry
   deployment" on the latest one) before `/admin` starts working.

### That's it

Once both are set and the site has redeployed, visiting
`https://ainadara.com/admin` on your phone will show a "Sign in with
GitHub" button. Signing in as anyone other than `refinalophaina-jpg` will
be refused. A save takes a minute or two to reach the live site — same as
any other push to this repo, since `/admin` writes through an ordinary
git commit and the existing deploy workflow ships it.

If you ever want to revoke access, you can either delete the OAuth app on
GitHub (step 1's page) or remove the two Cloudflare environment variables
— either one disables `/admin` immediately, without touching any content.
