// Single source of truth for site content. Edit here, not in templates.

export const SITE = {
  name: "Aina Dara",
  domain: "ainadara.com",
  url: "https://ainadara.com",
  tagline: "Building at the intersection of clinical science, pharmacy, and applied AI.",
  // Short bio shown on the home page.
  bio:
    "I'm Aina Dara — a builder working across clinical theory, pharmacy, finance, and " +
    "applied language models. This hub links the things I'm making and learning in the open.",
  // Open Graph / social card image (place a 1200×630 PNG at /public/og.png).
  ogImage: "/og.png",
  twitter: "", // e.g. "@ainadara" — used for twitter:site if set
  // Plausible analytics: set to your dashboard domain to activate (placeholder by default).
  plausibleDomain: "ainadara.com",
  plausibleSrc: "https://plausible.io/js/script.js",
};

// Subdomain hub links. `live` flips the card from "coming soon" to an active link.
export const SUBDOMAINS = [
  { key: "home",        label: "Home",        host: "home.ainadara.com",        blurb: "Personal landing & now-page.",            live: false },
  { key: "learn",       label: "Learn",       host: "learn.ainadara.com",       blurb: "Notes, courses, and write-ups.",          live: false },
  { key: "finance",     label: "Finance",     host: "finance.ainadara.com",     blurb: "Money models & experiments.",             live: false },
  { key: "pharmacy",    label: "Pharmacy",    host: "pharmacy.ainadara.com",    blurb: "Pharmacy practice & tools.",              live: false },
  { key: "llm",         label: "LLM",         host: "llm.ainadara.com",         blurb: "ClinTheory LLM work.",                    live: false },
  { key: "agents",      label: "Agents",      host: "agents.ainadara.com",      blurb: "Autonomous agent experiments.",           live: false },
  { key: "automations", label: "Automations", host: "automations.ainadara.com", blurb: "Workflows that run themselves.",          live: false },
];
