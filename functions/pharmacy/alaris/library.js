// Cloudflare Pages Function: the gated institutional teaching payload.
// Canonical route: /pharmacy/alaris/library
//
// FAIL CLOSED. Missing configuration, a missing binding, a failed token check, a storage error —
// every one of these refuses. There is no branch in this file that serves content on an error, and
// the kill switch is checked before anything else.
//
// The payload it serves is the normalized teaching subset only: no raw export columns, no source
// record identifiers, no filename, no file digest, no timestamps. Those are stripped when the
// payload is built (scripts/build-alaris-payload.mjs), not here — this function never has them.
//
// Required configuration (Pages project → Settings → Environment variables / bindings):
//   ACCESS_TEAM_DOMAIN  your Access team, e.g. "myteam"
//   ACCESS_AUD          the Application Audience tag of the Access application (64 hex chars)
//   ALARIS_LIBRARY      KV namespace binding holding the payload under key "payload"
// Optional:
//   LIBRARY_DISABLED    set to "true" to hard-disable the endpoint without a deploy
import { verifyAccessJwt, readToken, Refused } from './access-jwt.mjs';

// Never leak the internal reason to the client; it is logged for the operator instead.
const deny = (status, message) => new Response(JSON.stringify({ error: message }), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  },
});

async function fetchCerts(url) {
  // Cached at the edge so a burst of learners does not hammer the certs endpoint, but short
  // enough that key rotation takes effect quickly.
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`certs fetch failed: ${res.status}`);
  return res.json();
}

// A SINGLE handler, deliberately. Pages supports both a catch-all `onRequest` and method-specific
// `onRequestGet`, but the precedence when a file exports both is not something this code should
// depend on — if `onRequest` won and returned undefined for GET, the behaviour would be a platform
// detail rather than a decision made here. One handler that checks the method itself is correct
// under either rule.
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return deny(405, 'Method not allowed.');
  // 1. Kill switch first, so it works even if everything else is misconfigured.
  if (String(env.LIBRARY_DISABLED).toLowerCase() === 'true') {
    return deny(503, 'The institutional library is currently disabled.');
  }

  // 2. Configuration. Absent configuration must never mean "open".
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ALARIS_LIBRARY) {
    console.log('alaris-library refused: not-configured');
    return deny(503, 'The institutional library is not configured on this deployment.');
  }

  // 3. Authentication.
  let claims;
  try {
    const token = readToken(request);
    if (!token) {
      console.log('alaris-library refused: no-token');
      return deny(401, 'Sign in through the access gateway to load this library.');
    }
    claims = await verifyAccessJwt(token, {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      fetchCerts,
    });
  } catch (error) {
    // A Refused is an expected rejection; anything else is a fault. Both refuse.
    console.log(`alaris-library refused: ${error instanceof Refused ? error.reason : `error:${error?.message}`}`);
    return deny(error instanceof Refused ? 403 : 503, 'Access to this library could not be verified.');
  }

  // A top-level browser visit is the sign-in entry point. Cloudflare Access authenticates first;
  // after a valid token reaches us, send the learner back to the simulator so its same-origin
  // fetch can obtain JSON. API/fetch requests (Accept: JSON or */*) continue below.
  if (request.method === 'GET' && /\btext\/html\b/i.test(request.headers.get('Accept') || '')) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL('./?library=institutional', request.url).href,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  }

  // 4. Payload.
  let payload;
  try {
    payload = await env.ALARIS_LIBRARY.get('payload');
  } catch (error) {
    console.log(`alaris-library refused: storage-error:${error?.message}`);
    return deny(503, 'The institutional library could not be read.');
  }
  if (!payload) {
    console.log('alaris-library refused: payload-absent');
    return deny(503, 'No institutional library has been published to this deployment.');
  }

  // Access records its own per-request logs; this line ties a retrieval to an identity without
  // storing anything itself.
  console.log(`alaris-library served to ${claims.email || claims.sub || 'unknown-subject'}`);

  return new Response(request.method === 'HEAD' ? null : payload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Never cached anywhere: not the browser, not a shared proxy, not the edge.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
