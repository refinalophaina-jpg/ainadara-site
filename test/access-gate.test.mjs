// Security tests for the institutional-payload gate.
//
// These use REAL RSA keys and REAL signatures via WebCrypto, so a broken verification cannot pass
// by accident. Every test that asserts a refusal is asserting that the payload would NOT be
// served. A gate that fails open is worse than no gate, because it produces false confidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, certsUrl, readToken, Refused } from '../functions/pharmacy/alaris/access-jwt.mjs';

const AUD = 'a'.repeat(64);
const OTHER_AUD = 'b'.repeat(64);
const TEAM = 'exampleteam';
const ISS = `https://${TEAM}.cloudflareaccess.com`;
const NOW = 1_800_000_000_000; // fixed clock; Date.now() is never used in these tests
const now = () => NOW;
const secs = Math.floor(NOW / 1000);

const b64url = bytes => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = obj => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function makeKeypair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { pair, jwk };
}

const KEY = await makeKeypair();
const OTHER_KEY = await makeKeypair();
const KID = 'kid-1';
const certs = { keys: [{ ...KEY.jwk, kid: KID, kty: 'RSA' }] };
const fetchCerts = async () => certs;

async function sign({ header = {}, claims = {}, key = KEY.pair.privateKey } = {}) {
  const h = enc({ alg: 'RS256', kid: KID, typ: 'JWT', ...header });
  const p = enc({ iss: ISS, aud: AUD, exp: secs + 3600, iat: secs - 10, email: 'nurse@example.org', ...claims });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

const refusal = async (token, opts = {}) => {
  try {
    await verifyAccessJwt(token, { teamDomain: TEAM, audience: AUD, fetchCerts, now, ...opts });
    return null; // no refusal — the gate would have OPENED
  } catch (e) {
    assert.ok(e instanceof Refused, `expected a Refused, got ${e}`);
    return e.reason;
  }
};

test('a correctly signed token for this application is accepted', async () => {
  const claims = await verifyAccessJwt(await sign(), { teamDomain: TEAM, audience: AUD, fetchCerts, now });
  assert.equal(claims.email, 'nurse@example.org');
  assert.equal(claims.iss, ISS);
});

test('an unsigned token is refused (alg: none)', async () => {
  const h = enc({ alg: 'none', kid: KID });
  const p = enc({ iss: ISS, aud: AUD, exp: secs + 3600 });
  assert.equal(await refusal(`${h}.${p}.`), 'unsupported-alg');
  assert.equal(await refusal(`${h}.${p}.AAAA`), 'unsupported-alg');
});

test('algorithm confusion is refused (HS256 over the RSA modulus)', async () => {
  const h = enc({ alg: 'HS256', kid: KID });
  const p = enc({ iss: ISS, aud: AUD, exp: secs + 3600 });
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY.jwk.n), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${h}.${p}`));
  assert.equal(await refusal(`${h}.${p}.${b64url(new Uint8Array(sig))}`), 'unsupported-alg');
});

test('a token signed by a different key is refused', async () => {
  assert.equal(await refusal(await sign({ key: OTHER_KEY.pair.privateKey })), 'bad-signature');
});

test('a tampered payload is refused even with a valid original signature', async () => {
  const token = await sign({ claims: { email: 'nurse@example.org' } });
  const [h, , s] = token.split('.');
  const forged = enc({ iss: ISS, aud: AUD, exp: secs + 3600, email: 'attacker@example.org' });
  assert.equal(await refusal(`${h}.${forged}.${s}`), 'bad-signature');
});

test('a valid token for ANOTHER application in the same team is refused', async () => {
  // Same signing key, same issuer, genuinely authenticated user — only `aud` separates them.
  // Without this check every app on the Access team would open this payload.
  assert.equal(await refusal(await sign({ claims: { aud: OTHER_AUD } })), 'audience-mismatch');
  assert.equal(await refusal(await sign({ claims: { aud: [OTHER_AUD, 'c'.repeat(64)] } })), 'audience-mismatch');
  // An array containing the right audience is fine.
  const ok = await verifyAccessJwt(await sign({ claims: { aud: [OTHER_AUD, AUD] } }), { teamDomain: TEAM, audience: AUD, fetchCerts, now });
  assert.equal(ok.iss, ISS);
});

test('a token from a different Access team is refused', async () => {
  assert.equal(await refusal(await sign({ claims: { iss: 'https://evilteam.cloudflareaccess.com' } })), 'issuer-mismatch');
});

test('expired and not-yet-valid tokens are refused, with bounded clock skew', async () => {
  assert.equal(await refusal(await sign({ claims: { exp: secs - 3600 } })), 'expired');
  assert.equal(await refusal(await sign({ claims: { exp: undefined } })), 'missing-exp');
  assert.equal(await refusal(await sign({ claims: { nbf: secs + 3600 } })), 'not-yet-valid');
  // Just-expired inside the skew window is still accepted; well outside is not.
  const inSkew = await verifyAccessJwt(await sign({ claims: { exp: secs - 30 } }), { teamDomain: TEAM, audience: AUD, fetchCerts, now });
  assert.ok(inSkew);
  assert.equal(await refusal(await sign({ claims: { exp: secs - 120 } })), 'expired');
});

test('an unknown or missing key id is refused', async () => {
  assert.equal(await refusal(await sign({ header: { kid: 'other-kid' } })), 'unknown-kid');
  assert.equal(await refusal(await sign({ header: { kid: undefined } })), 'missing-kid');
});

test('malformed tokens and empty certs are refused', async () => {
  assert.equal(await refusal(''), 'missing-token');
  assert.equal(await refusal(null), 'missing-token');
  assert.equal(await refusal('not-a-jwt'), 'malformed-token');
  assert.equal(await refusal('a.b'), 'malformed-token');
  assert.equal(await refusal('!!!.!!!.!!!'), 'malformed-base64url');
  assert.equal(await refusal(await sign(), { fetchCerts: async () => ({ keys: [] }) }), 'no-signing-keys');
  assert.equal(await refusal(await sign(), { fetchCerts: async () => ({}) }), 'no-signing-keys');
});

test('a certs fetch failure refuses rather than opening the gate', async () => {
  await assert.rejects(
    verifyAccessJwt(await sign(), { teamDomain: TEAM, audience: AUD, now, fetchCerts: async () => { throw new Error('network down'); } }),
    e => e.message === 'network down',
    'a certs failure must propagate as an error, never resolve',
  );
});

test('misconfiguration refuses rather than opening the gate', async () => {
  assert.equal(await refusal(await sign(), { audience: '' }), 'invalid-audience-config');
  assert.equal(await refusal(await sign(), { audience: 'short' }), 'invalid-audience-config');
  assert.equal(await refusal(await sign(), { teamDomain: '' }), 'invalid-team-domain');
  assert.equal(await refusal(await sign(), { teamDomain: undefined }), 'missing-team-domain');
});

test('the certs URL is constructed, never taken from input', () => {
  // An attacker-influenced team value must not redirect key fetching elsewhere.
  for (const bad of ['https://evil.com', 'team/../../evil', 'team.evil.com', 'TEAM!', '../x', 'a'.repeat(200)]) {
    assert.throws(() => certsUrl(bad), e => e instanceof Refused, `must reject team domain: ${bad}`);
  }
  assert.equal(certsUrl('myteam').url, 'https://myteam.cloudflareaccess.com/cdn-cgi/access/certs');
  // The full hostname form is accepted and normalised to the same URL.
  assert.equal(certsUrl('myteam.cloudflareaccess.com').url, 'https://myteam.cloudflareaccess.com/cdn-cgi/access/certs');
});

test('the token is read from the Access header or cookie', () => {
  const req = h => ({ headers: { get: k => h[k] ?? null } });
  assert.equal(readToken(req({ 'Cf-Access-Jwt-Assertion': ' tok ' })), 'tok');
  assert.equal(readToken(req({ Cookie: 'a=1; CF_Authorization=tok2; b=2' })), 'tok2');
  // The header wins when both are present.
  assert.equal(readToken(req({ 'Cf-Access-Jwt-Assertion': 'hdr', Cookie: 'CF_Authorization=cookie' })), 'hdr');
  assert.equal(readToken(req({})), null);
  assert.equal(readToken(req({ Cookie: 'unrelated=1' })), null);
});
