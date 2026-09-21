// Cloudflare Access JWT verification.
//
// This is the whole security boundary for the institutional teaching payload, so it verifies
// rather than trusts. Every rejection path returns a reason for logging but the caller must NOT
// return that reason to the client verbatim — it is for the operator, not the visitor.
//
// DESIGN RULE: fail closed. Any missing configuration, any unparseable token, any unexpected
// algorithm, any audience or issuer mismatch, any expiry problem, and any error at all during
// verification results in a refusal. There is no path through this module that serves content on
// an error.
//
// Threats deliberately handled:
//  - unsigned tokens and algorithm confusion ('none', HS256 against an RSA key)
//  - a valid Access token minted for a DIFFERENT application in the same team (the `aud` check;
//    without it any authenticated user of any app on the team would pass)
//  - a token from a different Access team (the `iss` check)
//  - expired or not-yet-valid tokens
//  - key confusion via an attacker-influenced JWKS location (the team domain is validated and the
//    certs URL is constructed, never taken from the token)

const B64URL = /^[A-Za-z0-9_-]+$/;
const TEAM = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
const CLOCK_SKEW_SECONDS = 60;

class Refused extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

function b64urlToBytes(part) {
  if (typeof part !== 'string' || !part.length || !B64URL.test(part)) throw new Refused('malformed-base64url');
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlToJSON(part) {
  const text = new TextDecoder().decode(b64urlToBytes(part));
  let value;
  try { value = JSON.parse(text); } catch { throw new Refused('malformed-json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Refused('malformed-claims');
  return value;
}

export function certsUrl(teamDomain) {
  if (typeof teamDomain !== 'string') throw new Refused('missing-team-domain');
  // Accept either "myteam" or "myteam.cloudflareaccess.com"; never accept a full URL or a path.
  const team = teamDomain.trim().toLowerCase().replace(/\.cloudflareaccess\.com$/, '');
  if (!TEAM.test(team)) throw new Refused('invalid-team-domain');
  return {
    team,
    issuer: `https://${team}.cloudflareaccess.com`,
    url: `https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`,
  };
}

/** Pull the Access token from the header Cloudflare sets, or the cookie it sets on browsers. */
export function readToken(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header.trim();
  const cookie = request.headers.get('Cookie') || '';
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]).trim() : null;
}

async function importKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Verify an Access JWT. Resolves to the claims on success; throws Refused otherwise.
 *
 * `fetchCerts` is injected so this can be tested without network access.
 * `now` is injected so expiry behaviour is testable.
 */
export async function verifyAccessJwt(token, { teamDomain, audience, fetchCerts, now = () => Date.now() } = {}) {
  if (typeof audience !== 'string' || !/^[0-9a-f]{64}$/.test(audience.trim())) throw new Refused('invalid-audience-config');
  const { issuer, url } = certsUrl(teamDomain);
  if (typeof token !== 'string' || !token) throw new Refused('missing-token');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Refused('malformed-token');
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = b64urlToJSON(rawHeader);
  // Reject anything but RS256 outright. 'none' and HMAC algorithms are the classic bypasses.
  if (header.alg !== 'RS256') throw new Refused('unsupported-alg');
  if (typeof header.kid !== 'string' || !header.kid) throw new Refused('missing-kid');

  const certs = await fetchCerts(url);
  const keys = certs && Array.isArray(certs.keys) ? certs.keys : null;
  if (!keys || !keys.length) throw new Refused('no-signing-keys');
  const jwk = keys.find(k => k && k.kid === header.kid && k.kty === 'RSA' && k.n && k.e);
  if (!jwk) throw new Refused('unknown-kid');

  const signature = b64urlToBytes(rawSignature);
  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
  let ok = false;
  try {
    ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await importKey(jwk), signature, signed);
  } catch {
    throw new Refused('signature-verification-error');
  }
  if (!ok) throw new Refused('bad-signature');

  // Claims are only trusted AFTER the signature check.
  const claims = b64urlToJSON(rawPayload);

  if (claims.iss !== issuer) throw new Refused('issuer-mismatch');

  // A token minted for another Access application in the same team is signed by the same key and
  // has the same issuer. The audience check is what stops it.
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some(a => typeof a === 'string' && a === audience.trim())) throw new Refused('audience-mismatch');

  const seconds = Math.floor(now() / 1000);
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) throw new Refused('missing-exp');
  if (seconds > claims.exp + CLOCK_SKEW_SECONDS) throw new Refused('expired');
  if (typeof claims.nbf === 'number' && Number.isFinite(claims.nbf) && seconds + CLOCK_SKEW_SECONDS < claims.nbf) throw new Refused('not-yet-valid');

  return claims;
}

export { Refused };
