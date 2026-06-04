# Managing AinaDara.com — the hub guide

This is the operator's manual for **ainadara.com**: how it's built, how to add content,
and — the main event — how to wire a new project in as either a **side tab** or a
**subdomain**. Written for the long-term goal: *every project with a page becomes
reachable through ainadara.com.*

---

## 1. Mental model

AinaDara.com is a **hub**. A project plugs in one of two ways:

| Pattern | Looks like | Use when | Where the code lives |
|---|---|---|---|
| **Side tab** | `ainadara.com/vanco/` | A page, tool, or small app that's happy living *inside* the hub | inside the `ainadara-site` repo |
| **Subdomain** | `vanco.ainadara.com` | A standalone app/site with its own build, repo, or framework | its own repo + its own Cloudflare Pages project |

Rule of thumb: **static HTML / a single Astro page → side tab. Its own app → subdomain.**
You can start something as a tab and promote it to a subdomain later.

### The moving parts

- **DNS + TLS + email:** Cloudflare (zone `ainadara.com`). Full (strict) SSL, min TLS 1.2.
- **Hosting:** Cloudflare Pages, project `ainadara-site`, auto-deployed from this repo by GitHub Actions.
- **Repos** (GitHub `refinalophaina-jpg`, all private): `ainadara-site` (this hub), `ainadara-infra`
  (DNS docs + uptime monitor), `ainadara-automation` (provisioning toolkit), plus per-project repos
  (`clintheory-llm`, `pharmacy-ainadara`, …).
- **Provisioning toolkit:** `ainadara-automation` (lives locally at `AinaDara.com/automation/`).
  Idempotent. Reads `../.env`. This is what creates DNS records, binds Pages domains, sets secrets, etc.

> **Important about today's state:** all seven seed subdomains (finance, home, learn, pharmacy,
> agents, llm, automations) currently **CNAME to the hub** and are bound to the `ainadara-site`
> Pages project — so they all serve this same hub page for now. Promoting one to its own app is
> exactly the "subdomain" workflow in §4.

---

## 2. Everyday tasks

### Run it locally
```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs ./dist
npm run check      # type-check (CI runs this — keep it green)
```

### Edit content
All copy + the hub cards live in **`src/data/site.ts`**:
- `SITE` — name, eyebrow line, OG image, Plausible domain, contact email.
- `SUBDOMAINS` — the cards. Each: `{ key, label, host, glyph, live, blurb }`.
  - `live: false` → greyed "Soon" card (not a link). `live: true` → real link to `https://<host>`.
  - `glyph` → one of `spiral · book · rays · nodes · waves · chart · hearth` (see `src/components/Glyph.astro`).

### Deploy
Just push to `main`. GitHub Actions (`/.github/workflows/deploy.yml`) builds and deploys to
Cloudflare Pages. **PRs get a preview deploy** with the URL commented on the PR. You can also
trigger a deploy manually: Actions tab → "Build & Deploy" → Run workflow.

---

## 3. Add a **side tab** (page inside the hub)

Two sub-options.

### 3a. A new Astro page
1. Create `src/pages/<name>.astro` (it becomes `/<name>/`). Use the shared shell:
   ```astro
   ---
   import Base from "../layouts/Base.astro";
   ---
   <Base title="Vanco TDM" path="/vanco/">
     <!-- your content; brand CSS + dark mode come for free -->
   </Base>
   ```
2. Link to it from the hub — add a card in `site.ts` with `host` pointing at the path,
   or add a header nav link in `src/pages/index.astro`.

### 3b. Drop in an existing standalone HTML tool
1. Put it at `public/<name>/index.html` (plus its assets in the same folder). Files in
   `public/` are served as-is at `/<name>/` — no build step touches them.
2. Link to it the same way.

> Want a persistent **left sidebar of tabs** instead of cards? That's a layout addition to
> `Base.astro` (a `<nav class="sidebar">` fed by a `TABS` array in `site.ts`). Ask and it can be
> scaffolded; the current design is intentionally card-based and logo-forward.

---

## 4. Add a **subdomain** (standalone project)

The one-command path uses the helper in `ainadara-automation`.

### 4a. Serve a subdomain from the hub (quickest — placeholder until the app exists)
```bash
cd ../automation        # i.e. AinaDara.com/automation
node add-project.js labs --label="Labs" --glyph=nodes --dry-run   # preview
node add-project.js labs --label="Labs" --glyph=nodes             # apply
```
This creates `labs.ainadara.com` → CNAME to the hub, binds it as a Pages custom domain, and
prints a card snippet. Paste the snippet into `site.ts`, commit, done.

### 4b. Serve a subdomain from its OWN Pages project (a real standalone app)
1. Make sure the project has a repo (e.g. `pharmacy-ainadara`) with its own build + a
   `deploy.yml` that runs `wrangler pages deploy` to a project of the **same name**.
2. Wire DNS + rebind the custom domain to that project:
   ```bash
   node add-project.js pharmacy --project=pharmacy-ainadara --label="Pharmacy" --glyph=spiral
   ```
   This points `pharmacy.ainadara.com` → `pharmacy-ainadara.pages.dev`, creates that Pages
   project if missing, **moves the custom domain off the hub** and binds it to the project.
3. Deploy the project repo (push to its `main`). SSL provisions automatically.
4. Flip the card to `live: true` in `site.ts` and commit the hub.

### What the helper does under the hood (if you ever do it by hand)
- DNS: `CNAME <sub>.ainadara.com → <project>.pages.dev` (proxied / orange cloud).
- Pages: project exists + custom domain bound to it. A custom domain can be bound to **only one**
  Pages project, so promoting a subdomain means removing it from `ainadara-site` first
  (the helper does this).
- Card: add to `SUBDOMAINS` with `live: true`.

### Removing / repointing
- Repoint a subdomain to a different project: re-run `add-project.js <sub> --project=<other>`.
- Fully remove: delete the DNS record and the Pages custom-domain binding in the Cloudflare
  dashboard, and remove the card from `site.ts`.

---

## 5. Design system (so new pages match)

Tokens (CSS variables, defined in `Base.astro`, auto-flipping in dark mode):

| Token | Light | Meaning |
|---|---|---|
| `--paper` / `--paper-deep` | `#faf5ed` / `#f2ecdf` | bg / surfaces |
| `--ink` / `--ink-soft` | `#2d3428` / `#5a6151` | text |
| `--terracotta` | `#cc785c` | primary accent |
| `--purple` / `--moss` | `#4a3d7a` / `#4a5c28` | secondary accents |

Type: **DM Serif Display** (headings), **Outfit** (body). Texture: SVG paper-grain overlay +
radial washes. Logo + card glyphs are inline SVG using the brand hex, recolored in dark mode by
the `[data-theme="dark"] svg [stroke="…"]` rules. Full reference: the `AinaDara` repo's
`CLAUDE.md`. **Keep it logo-forward; no filler "about me" copy.**

---

## 6. Infra, secrets & the toolkit

The `automation/` toolkit provisions/repairs the whole estate. Idempotent — safe to re-run.
```bash
cd automation
node run.js --dry-run                          # plan everything, change nothing
node run.js                                     # apply
node run.js --only=dns,pages,verify            # a subset
node run.js --only=email                        # (re)create email forward rule
```
- Secrets live **only** in `../.env` (gitignored) → pushed into GitHub Actions secrets +
  Cloudflare. Never committed; masked in all logs. To add a new subdomain to the *managed set*,
  add it to `config.json` `subdomains` and run `--only=dns,pages`.
- Outputs: `automation/out/result.json` (machine-readable) and `out/run.log`.

### Email
`hello@ainadara.com` forwards via Cloudflare Email Routing (free). MX/SPF/DKIM are
Cloudflare-managed; DMARC is set. New address? Add a local-part to `config.json`
`email.forwardLocalParts` and run `node run.js --only=email`.

### Monitoring
`ainadara-infra/.github/workflows/uptime.yml` pings the root + `llm.` every 5 min and posts to
`ALERT_WEBHOOK_URL` (set that secret in `ainadara-infra` to get alerts).

---

## 7. Security

Posture and the hardening applied are documented in **`SECURITY.md`** (this repo). Headers are
enforced by **`public/_headers`** (HSTS, CSP, X-Frame-Options, etc.). Re-run a security sweep any
time with the commands in that file.

---

## 8. Troubleshooting

- **"Server Not Found" on your Mac but fine on phone** → local DNS cache (Pi-hole/VPN) holding a
  stale negative answer. `pihole restartdns`, then
  `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`, toggle VPN. The site itself
  is fine — confirm with `dig @1.1.1.1 ainadara.com +short` or open `https://ainadara-site.pages.dev`.
- **Deploy failed on "Type-check"** → run `npm run check` locally; fix TS errors before pushing.
- **Deploy succeeded but page is blank/404** → the build likely ran on an incomplete commit. Push
  again from a complete tree, or re-run the Actions job on the latest `main` commit.
- **New subdomain shows the hub, not the app** → its custom domain is still bound to `ainadara-site`.
  Re-run `add-project.js <sub> --project=<its-project>` to rebind.
- **Cert error on a fresh subdomain** → Cloudflare is still provisioning the edge cert; wait a few
  minutes.

---

## 9. Cheat sheet

```bash
# content / cards
edit src/data/site.ts ; git commit -am "..." ; git push     # deploys

# new side tab
add src/pages/<name>.astro   (or public/<name>/index.html)

# new subdomain on the hub
cd automation && node add-project.js <sub> --label="…" --glyph=…

# new subdomain on its own app
cd automation && node add-project.js <sub> --project=<repo> --label="…"

# fix / re-provision everything (safe, idempotent)
cd automation && node run.js --dry-run && node run.js

# security re-sweep
see SECURITY.md
```
