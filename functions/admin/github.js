// Thin GitHub REST client for the `/admin` Pages Function. Everything here
// is network I/O against the live GitHub API — deliberately kept out of
// lib.js so lib.js stays pure and testable under plain Node (see lib.js's
// header comment). Nothing here is unit tested; it's exercised by hand
// against the real API once the owner's OAuth app exists (see README).

import { REPO_OWNER, REPO_NAME, REPO_BRANCH } from "./lib.js";

const API = "https://api.github.com";
const UA = "ainadara-admin";

/**
 * Exchange an OAuth `code` for an access token. The client secret is used
 * here only — server-side — and never returned to the caller.
 */
export async function exchangeCodeForToken({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": UA },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`GitHub token exchange failed: ${data.error_description || data.error || res.status}`);
  }
  return data.access_token;
}

/** Fetch the signed-in GitHub user for a token — used to check the login allowlist. */
export async function fetchUser(token) {
  const res = await fetch(`${API}/user`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": UA },
  });
  if (!res.ok) throw new Error(`GitHub user lookup failed: ${res.status}`);
  return res.json();
}

function contentsUrl(path) {
  return `${API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Read one file's content and sha, or `null` if it doesn't exist yet — a
 * new thread being created has no prior sha to send back on save.
 */
export async function getFile(token, path) {
  const res = await fetch(`${contentsUrl(path)}?ref=${REPO_BRANCH}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": UA },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read of ${path} failed: ${res.status}`);
  const data = await res.json();
  const decoded = data.content ? atob(data.content.replace(/\n/g, "")) : "";
  return { sha: data.sha, content: decoded };
}

/** List filenames in a directory, or `[]` if it doesn't exist. */
export async function listDir(token, path) {
  const res = await fetch(`${contentsUrl(path)}?ref=${REPO_BRANCH}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": UA },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub listing of ${path} failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.filter((e) => e.type === "file").map((e) => e.name) : [];
}

/**
 * Create or update one file as a commit authored by the signed-in user's
 * token. `sha` is required when updating an existing file, omitted when
 * creating a new one.
 *
 * @param {string} token
 * @param {string} path - repo-relative, already confined by resolveContentPath.
 * @param {string|ArrayBuffer|Uint8Array} content - text or raw bytes.
 * @param {string} message - commit message.
 * @param {string|undefined} sha
 */
export async function putFile(token, path, content, message, sha) {
  let base64;
  if (typeof content === "string") {
    base64 = btoa(unescape(encodeURIComponent(content)));
  } else {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    base64 = btoa(binary);
  }
  const res = await fetch(contentsUrl(path), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify({ message, content: base64, branch: REPO_BRANCH, sha }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub write of ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}
