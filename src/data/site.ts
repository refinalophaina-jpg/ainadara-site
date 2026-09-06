// Single source of truth for site content. Edit here, not in templates.

export const SITE = {
  name: "AinaDara",
  domain: "ainadara.com",
  url: "https://ainadara.com",
  email: "hello@ainadara.com",
  // One terse line under the wordmark. Not a bio — just orientation.
  eyebrow: "A clinical pharmacy workshop — tools, learning, and applied AI.",
  // Open Graph / social card (1200×630 PNG at /public/og.png).
  ogImage: "/og.png",
  // Privacy-friendly Plausible analytics — active when set.
  plausibleDomain: "ainadara.com",
  plausibleSrc: "https://plausible.io/js/script.js",
};

// Hub cards. `glyph` maps to Glyph.astro. `live:false` shows a "Soon" badge.
// `version` is optional — when present it names what is actually shipping there.
export const SUBDOMAINS = [
  { key: "pharmacy",    label: "Pharmacy",    host: "pharmacy.ainadara.com",    glyph: "spiral", live: true,  version: "Vancomycin TDM v2.0 · Aminoglycosides v2.0", blurb: "Therapeutic drug monitoring at the bedside — AUC-guided vancomycin and aminoglycoside dosing, Bayesian precision fitting, and the pharmacokinetics behind them." },
  { key: "learn",       label: "Learn",       host: "learn.ainadara.com",       glyph: "book",   live: false, blurb: "BCPS prep, reasoning drills, and high-yield patterns." },
  { key: "llm",         label: "LLM",         host: "llm.ainadara.com",         glyph: "rays",   live: false, blurb: "ClinTheory — LLM-assisted clinical reasoning." },
  { key: "agents",      label: "Agents",      host: "agents.ainadara.com",      glyph: "nodes",  live: false, blurb: "Autonomous agents for research and workflow." },
  { key: "automations", label: "Automations", host: "automations.ainadara.com", glyph: "waves",  live: false, blurb: "Workflows that run themselves." },
  { key: "finance",     label: "Finance",     host: "finance.ainadara.com",     glyph: "chart",  live: false, blurb: "Money models and quiet experiments." },
  { key: "home",        label: "Home",        host: "home.ainadara.com",        glyph: "hearth", live: false, blurb: "Personal landing and a now-page." },
  { key: "viet",        label: "Việt Hub",    host: "viet.ainadara.com",        glyph: "tones",  live: true,  blurb: "Southern Vietnamese learning — spaced repetition, tone drills, and diaspora vocabulary." },
];
