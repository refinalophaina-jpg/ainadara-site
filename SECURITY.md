# Security — AinaDara.com

Last sweep: **2026-06-03**. Scope: Cloudflare zone, Pages site, GitHub repos + secrets,
DNS/email, dependencies. This file records the posture, what was hardened, and how to re-sweep.

## Summary

| Area | Status | Notes |
|---|---|---|
| TLS mode | ✅ Full (strict) | end-to-end encryption |
| Min TLS version | ✅ **Hardened → 1.2** | was 1.0 (TLS 1.0/1.1 are deprecated) |
| Always HTTPS + TLS 1.3 | ✅ on | + automatic HTTPS rewrites |
| Security headers | ✅ **Added** | HSTS, CSP, X-Frame-Options, etc. via `public/_headers` |
| DNSSEC | 🟡 **Pending** | enabled in Cloudflare; **DS record must be added at your registrar** (see below) |
| Email auth | ✅ SPF + DKIM + DMARC | Cloudflare-managed MX/SPF/DKIM; DMARC `p=none` (see action items) |
| Repo visibility | ✅ all private | site, infra, automation, clintheory-llm, pharmacy-ainadara |
| Secret storage | ✅ encrypted | only in `.env` (gitignored) + GitHub encrypted secrets; masked in logs |
| Secret leakage | ✅ none found | no `.env`/keys in any repo tree or source file |
| Dependencies | 🟡 advisories | dev/build-chain only; static output limits runtime impact (see below) |

## What was hardened in this sweep
1. **Min TLS 1.0 → 1.2** (Cloudflare zone setting; also enforced by the toolkit's SSL step on every run).
2. **Security headers** via `public/_headers`:
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Content-Security-Policy` (locks sources to self + Google Fonts + Plausible)
   - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
     `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny sensors),
     `Cross-Origin-Opener-Policy: same-origin`.
3. **DNSSEC enabled** in Cloudflare (status pending until the DS record is published at the registrar).

## Action items (need you)
- [ ] **DNSSEC DS record** — add this at your domain registrar to complete DNSSEC
  (skip if the domain is on **Cloudflare Registrar** — it's automatic there):
  ```
  ainadara.com. 3600 IN DS 2371 13 2 0673C5C0FFC201416DAA44DAEDA65E87B9BE1CB175F09688E79C0C85EDF2D561
  ```
- [ ] **DMARC enforcement** — currently `p=none` (monitor mode). After watching reports for a few
  weeks, tighten to `p=quarantine` then `p=reject` by editing `email.dmarcPolicy` in
  `automation/config.json` and running `node run.js --only=dns`.
- [ ] **Dependency advisories** — `npm audit` flags build-chain packages (e.g. an Astro/Cloudflare
  adapter advisory). This site ships **static HTML** (no SSR, no `/_image` endpoint), so runtime
  exposure is minimal. Still, keep current: `npm update astro && npm audit fix`, then redeploy.
- [ ] *(optional)* **HSTS preload** — add `; preload` to the HSTS header in `public/_headers` and
  submit at hstspreload.org. This is a strong, hard-to-reverse commitment (all subdomains HTTPS
  forever) — only do it once every subdomain is permanently HTTPS.
- [ ] *(optional)* Rotate the Cloudflare/GitHub tokens periodically; re-run `node run.js` to push
  the new Cloudflare token into the repo secrets.

## Tighten the CSP later (optional)
The CSP allows `'unsafe-inline'` for scripts/styles because the theme-init runs inline (to prevent
a dark-mode flash). To remove `'unsafe-inline'`, move the inline scripts to external files or add
per-build SHA-256 hashes/nonces. Low priority — there is no user-generated content on this static site.

## Re-sweep runbook
```bash
cd AinaDara.com
T=$(grep '^CLOUDFLARE_API_TOKEN=' .env | cut -d= -f2); Z=$(grep '^CLOUDFLARE_ZONE_ID=' .env | cut -d= -f2)

# Live security headers
IP=$(node -e 'fetch("https://dns.google/resolve?name=ainadara.com&type=A").then(r=>r.json()).then(j=>console.log(j.Answer.find(a=>a.type===1).data))')
curl -sSI --resolve ainadara.com:443:$IP https://ainadara.com | grep -iE 'strict-transport|content-security|x-frame|x-content|referrer|permissions-policy'

# Cloudflare settings
for s in ssl min_tls_version always_use_https tls_1_3; do
  curl -sS -H "Authorization: Bearer $T" "https://api.cloudflare.com/client/v4/zones/$Z/settings/$s" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["value"])'
done
curl -sS -H "Authorization: Bearer $T" "https://api.cloudflare.com/client/v4/zones/$Z/dnssec" | python3 -c 'import sys,json;print("dnssec:",json.load(sys.stdin)["result"]["status"])'

# Dependency audit
( cd repos/ainadara-site && npm audit )

# Secret-leak check (should print nothing)
gh api "repos/refinalophaina-jpg/ainadara-site/git/trees/main?recursive=1" --jq '.tree[].path' | grep -iE '\.env|secret|\.pem|\.key'

# External graders (open in browser)
#   https://securityheaders.com/?q=ainadara.com
#   https://www.ssllabs.com/ssltest/analyze.html?d=ainadara.com
#   https://internet.nl/site/ainadara.com/
```
