// Pure logic for the `/admin` Pages Function (hub editing slice, piece 7,
// spec §8): write-path confinement, the owner-login allowlist, content
// validation, filename sanitisation, and session-cookie encryption.
//
// Deliberately dependency-free and framework-free — everything here runs
// identically on Cloudflare's Workers runtime and under plain Node, via
// WebCrypto (`crypto.subtle`, `crypto.getRandomValues`) and `btoa`/`atob`,
// all globals on both. That's what lets the control plane's test suite
// (`automation/test/admin.test.js`) import this file directly rather than
// trying to boot a Worker — see WIKI.md's admin section.
//
// Nothing here talks to the network or the GitHub API; that lives in
// `github.js`, which this module has no knowledge of.

// ---------------------------------------------------------------------------
// Authorisation — the single most important line in this file.
//
// A successful GitHub OAuth sign-in proves someone has a GitHub account. It
// proves nothing about who they are. Every write path in [[path]].js must
// check the signed-in login against this constant, on every request, not
// just once at login time — a session is authenticated the moment the
// cookie decrypts; it is authorised only when its login is this string.
// ---------------------------------------------------------------------------
export const ALLOWED_LOGIN = "refinalophaina-jpg";

/** @param {string} login */
export function isAuthorizedLogin(login) {
  return typeof login === "string" && login === ALLOWED_LOGIN;
}

// The repo this admin edits. Same account as ALLOWED_LOGIN — not a secret,
// just where commits land.
export const REPO_OWNER = "refinalophaina-jpg";
export const REPO_NAME = "ainadara-site";
export const REPO_BRANCH = "main";

// ---------------------------------------------------------------------------
// Write-path confinement (spec §8 security point 5). A compromised session
// must not be able to reach `.github/`, `functions/`, `astro.config.mjs`,
// `package.json`, or anything outside `src/content/` and `public/` — any of
// those would turn a content compromise into full repo control.
// ---------------------------------------------------------------------------
const ALLOWED_ROOTS = ["src/content/", "public/"];

/**
 * Resolve and validate a repo-relative path a write is targeting.
 *
 * @param {string} rawPath
 * @returns {{ok: true, path: string} | {ok: false, reason: string}}
 */
export function resolveContentPath(rawPath) {
  if (typeof rawPath !== "string" || rawPath.length === 0) {
    return { ok: false, reason: "Path must be a non-empty string." };
  }
  if (rawPath.includes("\0")) {
    return { ok: false, reason: "Path contains a null byte." };
  }
  // Absolute paths: POSIX (`/etc/passwd`) and Windows (`C:\`, `C:/`).
  if (rawPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawPath)) {
    return { ok: false, reason: "Absolute paths are not allowed." };
  }
  const normalized = rawPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((s) => s === "..")) {
    return { ok: false, reason: 'Path traversal ("..") is not allowed.' };
  }
  if (segments.some((s) => s === "")) {
    return { ok: false, reason: "Malformed path." };
  }
  const clean = segments.join("/");
  const insideAllowedRoot = ALLOWED_ROOTS.some((root) => clean.startsWith(root));
  if (!insideAllowedRoot) {
    return { ok: false, reason: "Path must be inside src/content/ or public/." };
  }
  return { ok: true, path: clean };
}

// ---------------------------------------------------------------------------
// Content validation — mirrors the studio's rules (automation/studio/content.js)
// and the zod schema in src/content/config.ts. Server-side here is the
// control, not a convenience: the client's form never gets to skip it.
// ---------------------------------------------------------------------------

// The marks Glyph.astro implements. The studio derives this from the file at
// runtime (it runs on this Mac, against the checked-out clone); the admin
// runs on Cloudflare with no filesystem access to that file, so this list is
// hand-kept in sync with the same enum in src/content/config.ts — which is
// itself a hand-kept copy of what Glyph.astro implements. Update all three
// together when a glyph is added.
export const ALLOWED_GLYPHS = ["spiral", "book", "rays", "nodes", "waves", "chart", "tones", "hearth"];

const isString = (v) => typeof v === "string";
const isNonEmptyString = (v) => isString(v) && v.trim().length > 0;

const HOSTNAME_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

/**
 * @param {object} data
 * @param {{key: string}} ctx - `key` is the filename (without `.json`).
 */
export function validateThread(data, { key }) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  if (data == null || typeof data !== "object") {
    return { ok: false, errors: [{ field: "*", message: "Thread must be an object." }] };
  }
  if (!isNonEmptyString(data.key) || data.key !== key) {
    add("key", `"key" must match the filename "${key}".`);
  }
  if (!isNonEmptyString(data.label)) add("label", '"label" must be a non-empty string.');
  if (!isNonEmptyString(data.host) || !HOSTNAME_RE.test(data.host)) {
    add("host", '"host" must look like a fully-qualified hostname (e.g. pharmacy.ainadara.com).');
  }
  if (!isNonEmptyString(data.glyph) || !ALLOWED_GLYPHS.includes(data.glyph)) {
    add("glyph", `"glyph" must be one of: ${ALLOWED_GLYPHS.join(", ")}.`);
  }
  if (typeof data.live !== "boolean") add("live", '"live" must be true or false.');
  if (typeof data.order !== "number" || !Number.isFinite(data.order)) {
    add("order", '"order" must be a number.');
  }
  if (!isString(data.blurb)) add("blurb", '"blurb" must be a string.');
  if (data.version !== undefined && !isString(data.version)) {
    add("version", '"version" must be a string when present.');
  }
  return { ok: errors.length === 0, errors };
}

/** @param {object} data */
export function validateSite(data) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  if (data == null || typeof data !== "object") {
    return { ok: false, errors: [{ field: "*", message: "Site must be an object." }] };
  }
  if (!isNonEmptyString(data.name)) add("name", '"name" must be a non-empty string.');
  if (!isNonEmptyString(data.domain)) add("domain", '"domain" must be a non-empty string.');
  if (!isNonEmptyString(data.url) || !/^https?:\/\//.test(data.url)) {
    add("url", '"url" must be a full URL (e.g. https://ainadara.com).');
  }
  if (!isNonEmptyString(data.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    add("email", '"email" must look like an email address.');
  }
  if (!isNonEmptyString(data.eyebrow)) add("eyebrow", '"eyebrow" must be a non-empty string.');
  if (!isNonEmptyString(data.ogImage)) add("ogImage", '"ogImage" must be a non-empty string.');
  if (data.plausibleDomain !== undefined && !isString(data.plausibleDomain)) {
    add("plausibleDomain", '"plausibleDomain" must be a string when present.');
  }
  if (data.plausibleSrc !== undefined && !isString(data.plausibleSrc)) {
    add("plausibleSrc", '"plausibleSrc" must be a string when present.');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Decide which validator a content path takes, and extract the `key` a
 * thread must match. Returns `null` for a path inside the allowed roots
 * that isn't a recognised content file (e.g. an arbitrary `public/` asset,
 * which /api/save never writes — that's /api/upload's job).
 *
 * @param {string} path - already passed through resolveContentPath.
 */
export function classifyContentPath(path) {
  if (path === "src/content/site/site.json") return { kind: "site" };
  const m = /^src\/content\/threads\/([a-z][a-z0-9-]*)\.json$/.exec(path);
  if (m) return { kind: "thread", key: m[1] };
  return null;
}

// ---------------------------------------------------------------------------
// Upload validation (spec §8 security point 7): image content types only,
// 5 MB cap, sanitised filename.
// ---------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Strip a filename down to something safe to write into `public/`: no
 * directory components, no leading dots, only unambiguous characters.
 */
export function sanitizeFilename(name) {
  let base = String(name ?? "").split(/[\\/]/).pop() || "";
  base = base.replace(/^\.+/, "");
  base = base.replace(/[^A-Za-z0-9._-]/g, "-");
  base = base.replace(/-{2,}/g, "-");
  if (!base) base = `upload-${Date.now()}`;
  return base;
}

/** @param {string} contentType @param {number} byteLength */
export function validateUpload(contentType, byteLength) {
  if (!contentType || !contentType.startsWith("image/")) {
    return { ok: false, reason: `Refusing upload: content type "${contentType}" is not an image.` };
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    return { ok: false, reason: "Refusing upload: empty payload." };
  }
  if (byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `Refusing upload: ${byteLength} bytes exceeds the 5 MB limit.` };
  }
  return { ok: true };
}

export { MAX_UPLOAD_BYTES };

// ---------------------------------------------------------------------------
// Session cookie (spec §8 security point 3). Pages Functions are stateless,
// so the session is self-contained: the GitHub access token is encrypted
// with AES-GCM via WebCrypto, using a key derived from GITHUB_CLIENT_SECRET
// with HKDF — no third variable to set up. The payload carries its own
// expiry and decryptSession() enforces it; the cookie's own Max-Age is only
// a client-side hint and is never trusted on its own.
// ---------------------------------------------------------------------------

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, matches the cookie's Max-Age

/**
 * @param {{token: string, login: string}} identity
 * @returns {{token: string, login: string, iat: number, exp: number}}
 */
export function createSessionPayload({ token, login }) {
  const now = Date.now();
  return { token, login, iat: now, exp: now + SESSION_TTL_MS };
}

/** @param {any} payload */
export function isSessionExpired(payload) {
  return !payload || typeof payload.exp !== "number" || Date.now() >= payload.exp;
}

const HKDF_SALT = "ainadara-admin-session-v1";
const HKDF_INFO = "admin-session-cookie";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(secret) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode(HKDF_SALT), info: encoder.encode(HKDF_INFO) },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a session payload into an opaque, cookie-safe string.
 *
 * @param {object} payload
 * @param {string} secret - GITHUB_CLIENT_SECRET.
 */
export async function encryptSession(payload, secret) {
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return base64UrlEncode(combined);
}

/**
 * Decrypt a session cookie value. Returns `null` on any failure — a bad
 * signature, a corrupt value, or (load-bearing) an expired payload. Never
 * throws, so callers can treat "no valid session" uniformly.
 *
 * @param {string} cookieValue
 * @param {string} secret - GITHUB_CLIENT_SECRET.
 */
export async function decryptSession(cookieValue, secret) {
  try {
    const combined = base64UrlDecode(cookieValue);
    if (combined.length < 13) return null;
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await deriveAesKey(secret);
    const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const payload = JSON.parse(decoder.decode(plaintextBuf));
    if (isSessionExpired(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Cookie name for the session and for the short-lived OAuth `state`. */
export const SESSION_COOKIE = "admin_session";
export const STATE_COOKIE = "admin_oauth_state";
