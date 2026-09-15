import { defineCollection, z } from "astro:content";

// The singleton: name, domain, email, eyebrow, og image, analytics. One file,
// src/content/site.json, entry id "site". Validated at build — a malformed
// edit fails the build rather than shipping (design §5).
const site = defineCollection({
  type: "data",
  schema: z.object({
    name: z.string(),
    domain: z.string(),
    url: z.string().url(),
    email: z.string().email(),
    // One terse line under the wordmark. Not a bio — just orientation.
    eyebrow: z.string(),
    // Open Graph / social card (1200×630 PNG at /public/og.png).
    ogImage: z.string(),
    // Privacy-friendly Plausible analytics — active when set.
    plausibleDomain: z.string().optional(),
    plausibleSrc: z.string().optional(),
  }),
});

// One file per thread — the edit unit. A bad edit blasts one card, not the
// whole list, and the studio/admin can touch different threads without a
// conflict (design §5).
const threads = defineCollection({
  type: "data",
  schema: z.object({
    // Slug, must match the filename.
    key: z.string(),
    label: z.string(),
    // Fully-qualified hostname.
    host: z.string(),
    // Must match a glyph Glyph.astro actually implements.
    glyph: z.enum(["spiral", "book", "rays", "nodes", "waves", "chart", "tones", "hearth"]),
    live: z.boolean(),
    // So the studio can reorder without renaming files.
    order: z.number(),
    blurb: z.string(),
    version: z.string().optional(),
  }),
});

export const collections = { site, threads };
