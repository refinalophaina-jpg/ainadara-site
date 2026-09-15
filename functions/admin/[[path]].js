// The `/admin` Pages Function (hub editing slice, piece 7, spec §8). A
// catch-all route (`[[path]].js`) handling GitHub OAuth sign-in and a small
// content-editing API against `src/content/` and `public/`.
//
// Security model — see lib.js for the pieces this file composes, and
// WIKI.md for the full write-up:
//   - The client secret (GITHUB_CLIENT_SECRET) is read from `env` and used
//     only inside this file's server-side fetch calls. It is never placed
//     in a response body, a header, a log line, or the client-side bundle.
//   - Authentication (a valid GitHub sign-in) is not authorisation — every
//     handler that reads a session re-checks `isAuthorizedLogin` before
//     doing anything, not just once at /admin/callback.
//   - Every write resolves through `resolveContentPath`, confining it to
//     `src/content/` or `public/`.
//   - Session state lives only in an encrypted, HttpOnly, Secure cookie —
//     see lib.js for why the OAuth `state` cookie can't use the same
//     SameSite setting.

import {
  ALLOWED_LOGIN, isAuthorizedLogin, resolveContentPath, classifyContentPath,
  validateThread, validateSite, sanitizeFilename, validateUpload, ALLOWED_GLYPHS,
  createSessionPayload, decryptSession, encryptSession, SESSION_COOKIE, STATE_COOKIE,
} from "./lib.js";
import { exchangeCodeForToken, fetchUser, getFile, listDir, putFile } from "./github.js";
import { renderSignIn, renderEditor } from "./ui.js";

const MAX_JSON_BYTES = 256 * 1024; // headroom over a thread/site JSON file
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // headroom over lib.js's 5MB check

// Common headers on every response this Function returns: never let a
// crawler or cache treat the admin as ordinary content (spec §8 security
// point 8).
const NOINDEX_HEADERS = { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" };

/**
 * Build a Headers object from a plain header map plus an optional list of
 * `Set-Cookie` values. `Set-Cookie` is special-cased because HTTP requires
 * one header line per cookie — joining two with a comma (as a naive object
 * spread would) corrupts both, since cookie attributes like `Expires` also
 * contain commas.
 *
 * @param {Record<string,string>} base
 * @param {string[]} [cookies]
 */
function buildHeaders(base, cookies = []) {
  const headers = new Headers(base);
  for (const c of cookies) headers.append("set-cookie", c);
  return headers;
}

function html(body, status = 200, { headers = {}, cookies = [] } = {}) {
  return new Response(body, {
    status,
    headers: buildHeaders({ "content-type": "text/html; charset=utf-8", ...NOINDEX_HEADERS, ...headers }, cookies),
  });
}

function json(body, status = 200, { headers = {}, cookies = [] } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders({ "content-type": "application/json", ...NOINDEX_HEADERS, ...headers }, cookies),
  });
}

function redirect(location, { headers = {}, cookies = [] } = {}) {
  return new Response(null, {
    status: 302,
    headers: buildHeaders({ location, ...NOINDEX_HEADERS, ...headers }, cookies),
  });
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

/** Session cookie: 8h Max-Age, Strict — same-site only, never sent cross-site. */
function sessionCookie(value, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

/**
 * State cookie: short-lived, holds the OAuth `state` value between
 * /admin/login and /admin/callback. This one MUST be SameSite=Lax, not
 * Strict — the browser reaches /admin/callback via a top-level navigation
 * initiated by github.com (a cross-site redirect), and a Strict cookie is
 * dropped on exactly that kind of request, so the flow would never see its
 * own state value and every sign-in would fail the mismatch check below.
 * This is a real constraint of how browsers apply SameSite, not a relaxation
 * of the spec's session-cookie requirement — the long-lived session cookie
 * stays Strict.
 */
function stateCookie(value, maxAgeSeconds) {
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearCookie(name) {
  return `${name}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/**
 * Resolve the current request's session: `null` if there is no cookie, the
 * cookie fails to decrypt, its embedded expiry has passed, or its login
 * isn't the allowed one. Every handler below that touches content calls
 * this and bails on `null` — authentication and authorisation, checked
 * together, every time.
 */
async function requireSession(request, env) {
  const cookies = parseCookies(request);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  const payload = await decryptSession(raw, env.GITHUB_CLIENT_SECRET);
  if (!payload) return null;
  if (!isAuthorizedLogin(payload.login)) return null;
  return payload;
}

function originOk(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // not all browsers send Origin on same-site POSTs
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJsonBody(request) {
  const len = Number(request.headers.get("content-length") || "0");
  if (len && len > MAX_JSON_BYTES) {
    const e = new Error("Request body too large.");
    e.statusCode = 413;
    throw e;
  }
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) {
    const e = new Error("Request body too large.");
    e.statusCode = 413;
    throw e;
  }
  return text ? JSON.parse(text) : {};
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return html(renderSignIn({ error: "Admin is not configured yet (missing OAuth environment variables)." }), 503);
  }

  try {
    // -------------------------------------------------------------- /admin
    if (method === "GET" && url.pathname === "/admin") {
      const session = await requireSession(request, env);
      if (!session) return html(renderSignIn(), 200);
      return html(renderEditor(), 200);
    }

    // -------------------------------------------------------- /admin/login
    if (method === "GET" && url.pathname === "/admin/login") {
      const state = crypto.randomUUID();
      const redirectUri = `${url.origin}/admin/callback`;
      const authorize = new URL("https://github.com/login/oauth/authorize");
      authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("scope", "public_repo");
      authorize.searchParams.set("state", state);
      return redirect(authorize.toString(), { cookies: [stateCookie(state, 600)] });
    }

    // ----------------------------------------------------- /admin/callback
    if (method === "GET" && url.pathname === "/admin/callback") {
      const err = url.searchParams.get("error");
      if (err) return html(renderSignIn({ error: `GitHub sign-in was cancelled or failed (${err}).` }), 200);

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const cookies = parseCookies(request);
      const expectedState = cookies[STATE_COOKIE];
      if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
        return html(renderSignIn({ error: "Sign-in could not be verified. Try again." }), 400, {
          cookies: [clearCookie(STATE_COOKIE)],
        });
      }

      const redirectUri = `${url.origin}/admin/callback`;
      const token = await exchangeCodeForToken({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        code,
        redirectUri,
      });
      const user = await fetchUser(token);
      if (!isAuthorizedLogin(user.login)) {
        return html(
          renderSignIn({ error: `This admin is restricted to ${ALLOWED_LOGIN}. Signed in as ${user.login}.` }),
          403,
          { cookies: [clearCookie(STATE_COOKIE)] },
        );
      }

      const payload = createSessionPayload({ token, login: user.login });
      const cookieValue = await encryptSession(payload, env.GITHUB_CLIENT_SECRET);
      return redirect("/admin", {
        cookies: [sessionCookie(cookieValue, 8 * 60 * 60), clearCookie(STATE_COOKIE)],
      });
    }

    // ------------------------------------------------------------- logout
    if (method === "POST" && url.pathname === "/admin/logout") {
      return json({ ok: true }, 200, { cookies: [clearCookie(SESSION_COOKIE)] });
    }

    // Everything past here reads or writes content — session required.
    const session = await requireSession(request, env);
    if (!session) return json({ error: "Not signed in, or session expired." }, 401);
    if (method !== "GET" && !originOk(request)) {
      return json({ error: "Refused: request origin does not match this site." }, 403);
    }

    // ------------------------------------------------------ api/content
    if (method === "GET" && url.pathname === "/admin/api/content") {
      const siteFile = await getFile(session.token, "src/content/site/site.json");
      const site = siteFile ? JSON.parse(siteFile.content) : null;
      const names = await listDir(session.token, "src/content/threads");
      const threads = [];
      for (const name of names.filter((n) => n.endsWith(".json"))) {
        const f = await getFile(session.token, `src/content/threads/${name}`);
        if (!f) continue;
        try {
          threads.push({ ...JSON.parse(f.content), sha: f.sha });
        } catch {
          // A malformed thread file in the repo is a build-time concern
          // (the hub's own build already fails on it); skip it here rather
          // than crash the editor.
        }
      }
      threads.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return json({ login: session.login, site, siteSha: siteFile?.sha, threads, glyphs: ALLOWED_GLYPHS });
    }

    // --------------------------------------------------------- api/save
    if (method === "POST" && url.pathname === "/admin/api/save") {
      const body = await readJsonBody(request);
      const resolved = resolveContentPath(body.path);
      if (!resolved.ok || !resolved.path.startsWith("src/content/")) {
        return json({ error: `Refused: ${resolved.ok ? "save is limited to src/content/." : resolved.reason}` }, 400);
      }
      const kind = classifyContentPath(resolved.path);
      if (!kind) return json({ error: "Unrecognised content path." }, 400);

      if (kind.kind === "site") {
        const { ok, errors } = validateSite(body.data);
        if (!ok) return json({ error: "Invalid site.", errors }, 400);
      } else {
        const { ok, errors } = validateThread(body.data, { key: kind.key });
        if (!ok) return json({ error: `Invalid thread "${kind.key}".`, errors }, 400);
      }

      const content = JSON.stringify(body.data, null, 2) + "\n";
      const message = kind.kind === "site"
        ? "Update site content via /admin"
        : `Update "${kind.key}" thread via /admin`;
      await putFile(session.token, resolved.path, content, message, body.sha);
      return json({ ok: true });
    }

    // ------------------------------------------------------- api/upload
    if (method === "POST" && url.pathname === "/admin/api/upload") {
      const len = Number(request.headers.get("content-length") || "0");
      if (len && len > MAX_UPLOAD_BYTES) return json({ error: "Upload too large." }, 413);
      const bytes = new Uint8Array(await request.arrayBuffer());
      const contentType = request.headers.get("content-type") || "";
      const { ok, reason } = validateUpload(contentType, bytes.length);
      if (!ok) return json({ error: reason }, 400);

      let safe = sanitizeFilename(request.headers.get("x-filename") || "upload");
      let targetPath = `public/${safe}`;
      const resolved = resolveContentPath(targetPath);
      if (!resolved.ok) return json({ error: resolved.reason }, 400);

      const existing = await getFile(session.token, resolved.path).catch(() => null);
      if (existing) {
        safe = `${Date.now()}-${safe}`;
        targetPath = `public/${safe}`;
      }
      await putFile(session.token, targetPath, bytes, `Add ${safe} via /admin`, undefined);
      return json({ ok: true, path: `/${safe}` });
    }

    return json({ error: "Not found." }, 404);
  } catch (e) {
    const status = e.statusCode || 500;
    // Never let an exception's message leak a secret — none of the errors
    // thrown above carry env values, only paths and GitHub API status text.
    return json({ error: e.message || "Internal error." }, status);
  }
}
