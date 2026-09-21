// Behaviour tests for the gated endpoint. Every assertion here is "the payload was NOT served".
// The single positive case proves the gate can open for a genuinely authorised request, so the
// refusals are meaningful rather than the endpoint being broken outright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/pharmacy/alaris/library.js';
// One exported handler; the method check lives inside it.
const onRequestGet = onRequest;

const AUD = 'a'.repeat(64);
const TEAM = 'exampleteam';
const ISS = `https://${TEAM}.cloudflareaccess.com`;
const PAYLOAD = JSON.stringify({ name: 'Teaching payload', entries: [{ id: 'e0001' }] });

const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));

const pair = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);
const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
const CERTS = { keys: [{ ...jwk, kid: 'kid-1', kty: 'RSA' }] };

async function token(claims = {}) {
  const h = enc({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' });
  const p = enc({ iss: ISS, aud: AUD, exp: Math.floor(Date.now() / 1000) + 3600, email: 'nurse@example.org', ...claims });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}

const realFetch = globalThis.fetch;
globalThis.fetch = async url =>
  String(url).endsWith('/cdn-cgi/access/certs')
    ? new Response(JSON.stringify(CERTS), { status: 200, headers: { 'Content-Type': 'application/json' } })
    : realFetch(url);

const kv = (value = PAYLOAD) => ({ get: async () => value });
const baseEnv = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALARIS_LIBRARY: kv() };
const req = (headers = {}) => new Request('https://pharmacy.example.com/alaris/library', { headers });
const authed = async () => req({ 'Cf-Access-Jwt-Assertion': await token() });

const bodyOf = async res => res.text();

test('an authorised request receives the payload with no-store and noindex', async () => {
  const res = await onRequestGet({ request: await authed(), env: baseEnv });
  assert.equal(res.status, 200);
  assert.equal(await bodyOf(res), PAYLOAD);
  assert.match(res.headers.get('Cache-Control'), /no-store/);
  assert.match(res.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(res.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.match(res.headers.get('Content-Security-Policy'), /default-src 'none'/);
});

test('an authorised top-level browser visit returns to the simulator after Access sign-in', async () => {
  const request = req({ 'Cf-Access-Jwt-Assertion': await token(), Accept:'text/html,application/xhtml+xml' });
  const res = await onRequestGet({ request, env: baseEnv });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), 'https://pharmacy.example.com/alaris/?library=institutional');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.notEqual(await bodyOf(res), PAYLOAD);
});

test('the kill switch fails CLOSED for anything an operator might plausibly type', async () => {
  // The original form matched exactly 'true', so an operator disabling under pressure with '1',
  // 'yes', 'on', or a pasted 'true ' left the endpoint serving while the dashboard looked off.
  // Every value below must stop distribution.
  const mustDisable = ['true', 'TRUE', 'True', true, ' true ', 'true ', '1', 1, 'yes', 'on',
                       'disabled', 'TRUE!', 'stop', 'y', 'enabled'];
  for (const value of mustDisable) {
    const res = await onRequestGet({ request: await authed(), env: { ...baseEnv, LIBRARY_DISABLED: value } });
    assert.equal(res.status, 503, `LIBRARY_DISABLED=${JSON.stringify(value)} must refuse`);
    assert.notEqual(await bodyOf(res), PAYLOAD, `LIBRARY_DISABLED=${JSON.stringify(value)} must not serve the payload`);
  }
});

test('only unset, empty and explicit off-values leave the library serving', async () => {
  // `undefined` is the important regression guard: without the `?? ''` in the handler an unset
  // variable stringifies to 'undefined' and would disable the endpoint permanently.
  // 'false' is the value the live deployment actually carries, so it must keep serving.
  for (const value of [undefined, '', '   ', 'false', 'FALSE', '0', 'no', 'off', 'Off']) {
    const env = { ...baseEnv };
    if (value === undefined) delete env.LIBRARY_DISABLED; else env.LIBRARY_DISABLED = value;
    const res = await onRequestGet({ request: await authed(), env });
    assert.equal(res.status, 200, `LIBRARY_DISABLED=${JSON.stringify(value)} must still serve`);
    assert.equal(await bodyOf(res), PAYLOAD);
  }
});

test('missing configuration refuses instead of serving', async () => {
  for (const missing of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'ALARIS_LIBRARY']) {
    const env = { ...baseEnv, [missing]: undefined };
    const res = await onRequestGet({ request: await authed(), env });
    assert.equal(res.status, 503, `missing ${missing} must refuse`);
    assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
    assert.notEqual(await bodyOf(res), PAYLOAD);
  }
  // An entirely unconfigured deployment — the state this ships in — serves nothing.
  const bare = await onRequestGet({ request: await authed(), env: {} });
  assert.equal(bare.status, 503);
  assert.notEqual(await bodyOf(bare), PAYLOAD);
});

test('an unauthenticated request is refused with 401', async () => {
  const res = await onRequestGet({ request: req(), env: baseEnv });
  assert.equal(res.status, 401);
  assert.notEqual(await bodyOf(res), PAYLOAD);
});

test('an invalid or foreign token is refused with 403 and leaks no reason', async () => {
  const cases = [
    { 'Cf-Access-Jwt-Assertion': 'garbage' },
    { 'Cf-Access-Jwt-Assertion': await token({ aud: 'b'.repeat(64) }) },      // another Access app
    { 'Cf-Access-Jwt-Assertion': await token({ iss: 'https://evil.cloudflareaccess.com' }) },
    { 'Cf-Access-Jwt-Assertion': await token({ exp: Math.floor(Date.now() / 1000) - 7200 }) },
  ];
  for (const headers of cases) {
    const res = await onRequestGet({ request: req(headers), env: baseEnv });
    assert.equal(res.status, 403);
    const body = await bodyOf(res);
    assert.notEqual(body, PAYLOAD);
    // The operator's diagnostic vocabulary must not reach the client.
    assert.doesNotMatch(body, /audience-mismatch|issuer-mismatch|bad-signature|expired|kid/);
  }
});

test('a storage failure or absent payload refuses rather than serving something else', async () => {
  const thrown = await onRequestGet({ request: await authed(), env: { ...baseEnv, ALARIS_LIBRARY: { get: async () => { throw new Error('kv down'); } } } });
  assert.equal(thrown.status, 503);
  const absent = await onRequestGet({ request: await authed(), env: { ...baseEnv, ALARIS_LIBRARY: kv(null) } });
  assert.equal(absent.status, 503);
  assert.notEqual(await bodyOf(absent), PAYLOAD);
});

test('a certs endpoint failure refuses rather than opening the gate', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  try {
    const res = await onRequestGet({ request: await authed(), env: baseEnv });
    assert.equal(res.status, 503);
    assert.notEqual(await bodyOf(res), PAYLOAD);
  } finally { globalThis.fetch = saved; }
});

test('non-GET methods are refused before any other work', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    // env is deliberately fully valid: the method must be refused on its own merits.
    const res = await onRequest({ request: new Request('https://x/alaris/library', { method }), env: baseEnv });
    assert.equal(res.status, 405, `${method} must be refused`);
    assert.notEqual(await res.text(), PAYLOAD);
  }
});

test('HEAD is authorised like GET but carries no body', async () => {
  const req2 = new Request('https://x/alaris/library', { method: 'HEAD', headers: { 'Cf-Access-Jwt-Assertion': await token() } });
  const res = await onRequest({ request: req2, env: baseEnv });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
  // An unauthenticated HEAD must not confirm anything either.
  const bare = await onRequest({ request: new Request('https://x/alaris/library', { method: 'HEAD' }), env: baseEnv });
  assert.equal(bare.status, 401);
});

test('the cookie form of the Access token also works', async () => {
  const res = await onRequestGet({ request: req({ Cookie: `CF_Authorization=${await token()}` }), env: baseEnv });
  assert.equal(res.status, 200);
  assert.equal(await bodyOf(res), PAYLOAD);
});
