// Renders the admin's HTML — the sign-in prompt and the editor. Same house
// style tokens as automation/studio/ui.js (the studio is this page's
// desktop sibling) but the layout is built phone-first: single column,
// large tap targets, the thread list collapses behind a menu button rather
// than sitting in a permanent sidebar. Verify at 375px, not just wide.

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const TOKENS_LIGHT = `
    --paper:#faf5ed; --paper-deep:#f2ecdf; --paper-edge:#e8e0d0;
    --ink:#2d3428; --ink-soft:#5a6151; --ink-faint:#8a8e80;
    --terracotta:#cc785c; --purple:#4a3d7a; --moss:#4a5c28;
    --rule:rgba(45,52,40,.1); --shade:rgba(45,52,40,.04);`;

const TOKENS_DARK = `
    --paper:#1c1815; --paper-deep:#252119; --paper-edge:#322d24;
    --ink:#ece4d2; --ink-soft:#b8af9d; --ink-faint:#7d7666;
    --terracotta:#d88a6e; --purple:#8e7dc8; --moss:#9aad68;
    --rule:rgba(236,228,210,.1); --shade:rgba(236,228,210,.04);`;

const CSS = `
:root{${TOKENS_LIGHT}
  --font-display:'DM Serif Display',Georgia,serif;
  --font-body:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,monospace;}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${TOKENS_DARK}}}
:root[data-theme="dark"]{${TOKENS_DARK}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-body);
  font-weight:300;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--font-display);font-weight:400;margin:0;text-wrap:balance}
h1{font-size:1.4rem}
h2{font-size:1.1rem;margin-bottom:.6rem}
a{color:inherit}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;
  gap:.75rem;padding:.9rem 1rem;border-bottom:1px solid var(--rule);background:var(--paper)}
.eyebrow{font-size:.66rem;letter-spacing:.12em;color:var(--ink-faint);text-transform:lowercase}
.menuBtn{font-family:var(--font-body);font-size:.85rem;padding:.6rem .9rem;min-height:44px;
  border-radius:4px;border:1px solid var(--ink-faint);background:none;color:var(--ink)}
.statusline{font-size:.76rem;color:var(--ink-soft);padding:.5rem 1rem;border-bottom:1px solid var(--rule)}
.statusline .dirty{color:var(--terracotta)}
main{max-width:640px;margin:0 auto;padding:0 1rem 3rem}
.menu{border-bottom:1px solid var(--rule);padding:.5rem;background:var(--paper-deep);
  max-height:60vh;overflow-y:auto}
.menu[hidden]{display:none}
.menu .group{font-size:.66rem;letter-spacing:.12em;color:var(--ink-faint);
  text-transform:lowercase;margin:.7rem .5rem .2rem}
.menu button{display:block;width:100%;text-align:left;background:none;border:0;
  color:var(--ink);font-family:var(--font-body);font-size:.95rem;padding:.8rem .6rem;
  min-height:44px;border-radius:4px}
.menu button:active,.menu button.active{background:var(--shade);font-weight:500}
.menu button .flag{color:var(--terracotta);margin-left:.4rem;font-size:.72rem}
label{display:block;font-size:.76rem;letter-spacing:.05em;color:var(--ink-faint);
  margin:1.1rem 0 .3rem}
input[type=text],input[type=number],input[type=url],textarea,select{
  width:100%;background:var(--paper-deep);border:1px solid var(--rule);border-radius:5px;
  color:var(--ink);font-family:var(--font-body);font-size:1rem;padding:.75rem .7rem;min-height:44px}
textarea{min-height:6.5rem;resize:vertical}
.row{display:flex;align-items:center;gap:.6rem;margin:1.1rem 0 .3rem}
.row input[type=checkbox]{width:24px;height:24px}
.actions{display:flex;flex-direction:column;gap:.6rem;margin-top:1.3rem}
button.btn{font-family:var(--font-body);font-size:.92rem;padding:.8rem 1rem;min-height:48px;
  border-radius:5px;border:1px solid var(--ink-faint);background:none;color:var(--ink)}
button.btn.primary{border-color:var(--terracotta);color:var(--terracotta);font-weight:500}
button.btn.primary:active{background:color-mix(in srgb,var(--terracotta) 12%,transparent)}
button.btn.danger{border-color:var(--terracotta);color:var(--terracotta)}
button.btn:disabled{opacity:.4}
.errors{margin-top:.7rem;font-size:.85rem;color:var(--terracotta)}
.errors div{padding:.2rem 0}
.calm{color:var(--ink-soft);font-size:.9rem;padding:1.2rem 0}
.savenote{font-size:.8rem;color:var(--ink-faint);margin-top:.5rem}
.dropzone{margin-top:1.2rem;border:1px dashed var(--ink-faint);border-radius:6px;
  padding:1.2rem;text-align:center;font-size:.85rem;color:var(--ink-faint)}
.dropzone.over{background:var(--shade);color:var(--ink)}
.signin{max-width:420px;margin:15vh auto 0;text-align:center;padding:0 1.2rem}
.signin p{color:var(--ink-soft);font-size:.9rem}
.signin a.btn{display:inline-block;text-decoration:none;margin-top:1.2rem;
  font-family:var(--font-body);font-size:.95rem;font-weight:500;
  padding:.9rem 1.6rem;min-height:48px;min-width:48px;line-height:1.4;
  border-radius:5px;border:1px solid var(--terracotta)}
.signin a.btn.primary{background:var(--terracotta);color:var(--paper)}
.signin a.btn.primary:active{background:color-mix(in srgb,var(--terracotta) 85%,var(--ink) 15%)}
.signin a.btn:focus-visible{outline:2px solid var(--terracotta);outline-offset:2px}
`;

const HEAD = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>`;

/** The sign-in prompt shown at GET /admin when there is no valid session. */
export function renderSignIn({ error } = {}) {
  return `${HEAD("Sign in — AinaDara admin")}
<body>
<div class="signin">
  <div class="eyebrow">ainadara.com admin</div>
  <h1>Sign in to edit</h1>
  <p>This edits the live hub. Only one GitHub account can sign in here.</p>
  ${error ? `<p style="color:var(--terracotta)">${esc(error)}</p>` : ""}
  <a class="btn primary" href="/admin/login">Sign in with GitHub</a>
</div>
</body>
</html>`;
}

/** The editor shown at GET /admin for a valid, authorised session. */
export function renderEditor() {
  return `${HEAD("Admin — AinaDara hub")}
<body>
<div class="top">
  <div>
    <div class="eyebrow">ainadara.com admin</div>
    <h1>Hub editor</h1>
  </div>
  <button class="menuBtn" id="menuBtn" aria-expanded="false">Threads</button>
</div>
<div class="statusline" id="statusline">Loading…</div>
<nav class="menu" id="menu" hidden></nav>
<main>
  <section id="editorPane"><p class="calm">Loading…</p></section>
</main>
<script>
(function () {
  var state = null;
  var selected = null; // { kind: "site" } or { kind: "thread", key }
  var dirty = false;

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, opts);
    if (res.status === 401) { window.location.href = "/admin"; throw new Error("Session expired."); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ("Request failed: " + res.status));
    return data;
  }

  async function load() {
    state = await api("/admin/api/content");
    renderStatus();
    renderMenu();
    if (!selected && state.threads.length) selected = { kind: "thread", key: state.threads[0].key };
    renderEditor();
  }

  function renderStatus() {
    document.getElementById("statusline").textContent =
      "Signed in as " + state.login + ". A save takes a minute or two to reach the live site.";
  }

  function renderMenu() {
    var el = document.getElementById("menu");
    var html = '<div class="group">site</div>';
    html += '<button data-kind="site" class="' + (selected && selected.kind === "site" ? "active" : "") + '">Site</button>';
    html += '<div class="group">threads</div>';
    state.threads.forEach(function (t) {
      var active = selected && selected.kind === "thread" && selected.key === t.key;
      html += '<button data-kind="thread" data-key="' + esc(t.key) + '" class="' + (active ? "active" : "") + '">' +
        esc(t.label || t.key) + "</button>";
    });
    el.innerHTML = html;
    el.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (dirty && !confirm("Discard unsaved changes to this entry?")) return;
        selected = btn.dataset.kind === "site" ? { kind: "site" } : { kind: "thread", key: btn.dataset.key };
        dirty = false;
        closeMenu();
        renderMenu();
        renderEditor();
      });
    });
  }

  function closeMenu() {
    document.getElementById("menu").hidden = true;
    document.getElementById("menuBtn").setAttribute("aria-expanded", "false");
  }

  document.getElementById("menuBtn").addEventListener("click", function () {
    var menu = document.getElementById("menu");
    var open = menu.hidden;
    menu.hidden = !open;
    this.setAttribute("aria-expanded", String(open));
  });

  function field(label, inputHtml) {
    return "<label>" + esc(label) + "</label>" + inputHtml;
  }

  function renderEditor() {
    var pane = document.getElementById("editorPane");
    if (!selected) { pane.innerHTML = '<p class="calm">No entries yet.</p>'; return; }
    if (selected.kind === "site") {
      var s = state.site;
      pane.innerHTML =
        "<h2>Site</h2>" +
        field("Name", '<input type="text" id="f_name" value="' + esc(s.name) + '">') +
        field("Domain", '<input type="text" id="f_domain" value="' + esc(s.domain) + '">') +
        field("URL", '<input type="url" id="f_url" value="' + esc(s.url) + '">') +
        field("Email", '<input type="text" id="f_email" value="' + esc(s.email) + '">') +
        field("Eyebrow", "<textarea id=\\"f_eyebrow\\">" + esc(s.eyebrow) + "</textarea>") +
        field("OG image path", '<input type="text" id="f_ogImage" value="' + esc(s.ogImage) + '">') +
        field("Plausible domain", '<input type="text" id="f_plausibleDomain" value="' + esc(s.plausibleDomain || "") + '">') +
        field("Plausible script src", '<input type="text" id="f_plausibleSrc" value="' + esc(s.plausibleSrc || "") + '">') +
        '<div class="errors" id="errors"></div>' +
        '<div class="actions"><button class="btn primary" id="saveBtn">Save site</button></div>' +
        '<p class="savenote">Saving commits directly; the live site updates in a minute or two.</p>' +
        dropzoneHtml();
    } else {
      var t = state.threads.find(function (x) { return x.key === selected.key; }) || {};
      var glyphOptions = state.glyphs.map(function (g) {
        return '<option value="' + esc(g) + '"' + (g === t.glyph ? " selected" : "") + ">" + esc(g) + "</option>";
      }).join("");
      pane.innerHTML =
        "<h2>" + esc(t.label || t.key) + "</h2>" +
        '<p class="savenote">key: ' + esc(t.key) + "</p>" +
        field("Label", '<input type="text" id="f_label" value="' + esc(t.label) + '">') +
        field("Host", '<input type="text" id="f_host" value="' + esc(t.host) + '">') +
        field("Glyph", '<select id="f_glyph">' + glyphOptions + "</select>") +
        field("Version", '<input type="text" id="f_version" value="' + esc(t.version || "") + '">') +
        '<div class="row"><input type="checkbox" id="f_live" ' + (t.live ? "checked" : "") + '><label style="margin:0" for="f_live">Live</label></div>' +
        field("Order", '<input type="number" id="f_order" value="' + (t.order != null ? t.order : 0) + '">') +
        field("Blurb", "<textarea id=\\"f_blurb\\">" + esc(t.blurb) + "</textarea>") +
        '<div class="errors" id="errors"></div>' +
        '<div class="actions">' +
          '<button class="btn primary" id="saveBtn">Save "' + esc(t.key) + '"</button>' +
        "</div>" +
        '<p class="savenote">Saving commits directly; the live site updates in a minute or two.</p>' +
        dropzoneHtml();
    }
    wireEditor();
  }

  function dropzoneHtml() {
    return '<div class="dropzone" id="dropzone">Tap to choose an image to add to the site.' +
      '<input type="file" id="fileInput" accept="image/*" style="display:none"></div>';
  }

  function wireEditor() {
    document.querySelectorAll("#editorPane input, #editorPane textarea, #editorPane select").forEach(function (el) {
      el.addEventListener("input", function () { dirty = true; });
    });
    var saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.addEventListener("click", save);
    var dz = document.getElementById("dropzone");
    var fileInput = document.getElementById("fileInput");
    if (dz && fileInput) {
      dz.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        if (fileInput.files && fileInput.files[0]) upload(fileInput.files[0]);
      });
    }
  }

  async function upload(file) {
    var dz = document.getElementById("dropzone");
    dz.firstChild && (dz.textContent = "Uploading " + file.name + "…");
    try {
      var buf = await file.arrayBuffer();
      var res = await fetch("/admin/api/upload", {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream", "x-filename": file.name },
        body: buf,
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      dz.textContent = "Saved as " + data.path + " — tap to add another.";
    } catch (e) {
      dz.textContent = "Upload failed: " + e.message;
    }
  }

  function collectSite() {
    return {
      name: document.getElementById("f_name").value,
      domain: document.getElementById("f_domain").value,
      url: document.getElementById("f_url").value,
      email: document.getElementById("f_email").value,
      eyebrow: document.getElementById("f_eyebrow").value,
      ogImage: document.getElementById("f_ogImage").value,
      plausibleDomain: document.getElementById("f_plausibleDomain").value || undefined,
      plausibleSrc: document.getElementById("f_plausibleSrc").value || undefined,
    };
  }

  function collectThread(key) {
    return {
      key: key,
      label: document.getElementById("f_label").value,
      host: document.getElementById("f_host").value,
      glyph: document.getElementById("f_glyph").value,
      live: document.getElementById("f_live").checked,
      order: Number(document.getElementById("f_order").value),
      blurb: document.getElementById("f_blurb").value,
      version: document.getElementById("f_version").value || undefined,
    };
  }

  async function save() {
    var errBox = document.getElementById("errors");
    errBox.innerHTML = "";
    var saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      var path, data, sha;
      if (selected.kind === "site") {
        path = "src/content/site/site.json";
        data = collectSite();
        sha = state.siteSha;
      } else {
        path = "src/content/threads/" + selected.key + ".json";
        data = collectThread(selected.key);
        sha = (state.threads.find(function (x) { return x.key === selected.key; }) || {}).sha;
      }
      await api("/admin/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: path, data: data, sha: sha }),
      });
      dirty = false;
      await load();
      document.getElementById("statusline").textContent = "Saved — the live site will update in a minute or two.";
    } catch (e) {
      showErrors(errBox, e);
    } finally {
      var btn = document.getElementById("saveBtn");
      if (btn) { btn.disabled = false; btn.textContent = btn.textContent.replace("Saving…", "Save"); }
    }
  }

  function showErrors(box, e) {
    if (e.errors && e.errors.length) {
      box.innerHTML = e.errors.map(function (er) { return "<div>" + esc(er.field) + " — " + esc(er.message) + "</div>"; }).join("");
    } else {
      box.innerHTML = "<div>" + esc(e.message) + "</div>";
    }
  }

  load().catch(function (e) {
    document.getElementById("statusline").textContent = "Failed to load: " + e.message;
  });
})();
</script>
</body>
</html>`;
}
