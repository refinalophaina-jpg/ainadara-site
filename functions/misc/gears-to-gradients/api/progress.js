// /misc/gears-to-gradients/api/progress — cross-device progress for the course.
//
// The page keeps its state (chapters read, check results, missed practice
// questions, four-bucket notes) in localStorage. When the reader connects a
// sync phrase, the page GETs the stored document on load, merges it with the
// local copy, and PUTs the result; later changes PUT again (debounced).
//
// Identity is the phrase itself: the KV key is "g2g:" + SHA-256(phrase). No
// account, no session. The stored data is reading progress and personal
// study notes — nothing sensitive — so a shared secret is the right weight of
// protection. Rate limiting is deliberately not implemented (no Durable
// Objects on this plan), the same accepted gap as /admin.
//
// Requires a KV namespace bound to the Pages project as PROGRESS. Without it
// the endpoint answers 503 and the page shows "sync is not set up".

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

async function keyFor(phrase) {
  const bytes = new TextEncoder().encode(phrase.normalize("NFKC"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "g2g:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest({ request, env }) {
  const kv = env.PROGRESS;
  if (!kv) return json({ error: "sync is not set up on the server yet" }, 503);

  const phrase = (request.headers.get("x-sync-code") || "").trim();
  if (phrase.length < 8 || phrase.length > 128) return json({ error: "sync phrase must be 8–128 characters" }, 400);
  const key = await keyFor(phrase);

  if (request.method === "GET") {
    const stored = await kv.get(key);
    return new Response(stored || "null", { headers: JSON_HEADERS });
  }

  if (request.method === "PUT") {
    const text = await request.text();
    if (text.length > 65536) return json({ error: "document too large" }, 413);
    let doc;
    try { doc = JSON.parse(text); } catch { return json({ error: "body is not JSON" }, 400); }
    if (!doc || typeof doc !== "object" || doc.v !== 1) return json({ error: "unrecognised document" }, 400);
    const clean = { v: 1, updated: Date.now() };
    for (const k of ["seen", "quiz", "missed", "notes"]) clean[k] = (doc[k] && typeof doc[k] === "object") ? doc[k] : {};
    // A year's TTL, refreshed on every write. Anyone can PUT under any phrase
    // and there is no rate limiting, so without an expiry abandoned and
    // junk-written keys would accumulate in the namespace forever. Someone
    // actually using the course rewrites their key long before it lapses.
    await kv.put(key, JSON.stringify(clean), { expirationTtl: 31536000 });
    return json({ ok: true, updated: clean.updated });
  }

  return json({ error: "method not allowed" }, 405);
}
