import { TOPICS, CATEGORY_LABELS, MODULE_LABELS, SOURCES, GUIDE_VERSION, HISTORICAL_EXAMPLES, MANUAL_URL } from './topics.js';
import { searchTopics, safeSaved, FINDER, finderStep } from './model.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let saved = [];
try { saved = safeSaved(JSON.parse(localStorage.getItem('ainadara-guide-saved') || '[]')); } catch { /* Memory-only fallback. */ }
let state = { query: '', category: 'all', module: 'all', finder: [], config: {} };
let historyKey = 0, nextHistoryKey = 1, historyPosition = 0;
let historyTrail = [0], currentHash = location.hash;
const memoryHistory = new Map();
history.replaceState({ guideKey: historyKey }, '', location.pathname + location.hash);
history.scrollRestoration = 'manual';

function snapshot(focusTopic) {
  const active = document.activeElement;
  const topicId = focusTopic || (active?.matches('.topic-link') ? active.hash.slice(7) : null);
  memoryHistory.set(historyKey, { state: structuredClone(state), scroll: window.scrollY, focusTopic: topicId, focus: active?.id === 'search' ? 'search' : 'reader' });
}

function isDetail(hash) { return ['#sources', '#finder', '#about'].includes(hash) || hash.startsWith('#topic/'); }

function navigate(hash, patch = {}, { searching = false } = {}) {
  const openingTopic = hash.startsWith('#topic/') && !isDetail(currentHash);
  snapshot(openingTopic ? hash.slice(7) : null);
  const originEntry = !isDetail(currentHash) ? historyKey : state.originEntry;
  state = { ...state, ...patch, originEntry: isDetail(hash) ? originEntry : null };
  for (const discarded of historyTrail.slice(historyPosition + 1)) memoryHistory.delete(discarded);
  historyTrail = historyTrail.slice(0, historyPosition + 1);
  historyKey = nextHistoryKey++;
  historyTrail.push(historyKey); historyPosition = historyTrail.length - 1;
  history.pushState({ guideKey: historyKey }, '', hash);
  currentHash = hash;
  renderResults();
  renderReader(!searching);
  if (searching) $('#search').focus({ preventScroll: true });
}

window.addEventListener('popstate', () => {
  // Save outgoing state before restoring the traversed entry, including searches
  // made without a navigation. Entry IDs never double as a history cursor.
  snapshot();
  historyKey = history.state?.guideKey ?? nextHistoryKey++;
  historyPosition = historyTrail.indexOf(historyKey);
  if (historyPosition < 0) { historyTrail.push(historyKey); historyPosition = historyTrail.length - 1; }
  const previous = memoryHistory.get(historyKey);
  if (previous) state = structuredClone(previous.state);
  currentHash = location.hash;
  renderResults(); renderReader(false);
  if (previous) {
    const focus = previous.focusTopic ? document.querySelector(`.topic-link[href="#topic/${previous.focusTopic}"]`) : $('#' + previous.focus);
    focus?.focus({ preventScroll: true });
    window.scrollTo(0, previous.scroll);
  }
});

function returnToResults() {
  const originPosition = historyTrail.indexOf(state.originEntry);
  if (originPosition >= 0 && originPosition < historyPosition) history.go(originPosition - historyPosition);
  else navigate('#topics');
}

function renderResults() {
  $('#search').value = state.query;
  $('#module-filter').value = state.module;
  $('#clear-search').hidden = !state.query;
  $('#category-filter').value = state.category;
  $('#saved-count').textContent = `Saved topics (${saved.length})`;
  const results = searchTopics(state.query, { ...state, saved });
  $('#results-heading').textContent = state.category === 'all' ? 'Guide topics' : CATEGORY_LABELS[state.category];
  $('#result-count').textContent = `${results.length} ${results.length === 1 ? 'topic' : 'topics'}`;
  $('#result-context').textContent = state.query && results.length > 1 ? 'Choose the topic and component. No match is selected automatically.' : '4 older-manual examples · 9 pending outlines.';
  $('#results').innerHTML = results.map(({ topic, match }) => `<li><a class="topic-link" href="#topic/${topic.id}"${location.hash === '#topic/' + topic.id ? ' aria-current="page"' : ''}><strong>${escape(topic.title)}</strong><small>${escape(MODULE_LABELS[topic.module])} · ${HISTORICAL_EXAMPLES[topic.id] ? 'v12.1 example' : 'Content pending'}</small>${match ? `<small>${escape(match)}</small>` : ''}</a></li>`).join('');
  $('#no-results').hidden = Boolean(results.length);
  $('#no-results h3').textContent = state.category === 'saved' && !saved.length ? 'No saved topics yet' : 'No matching topic';
  $('#no-results p').textContent = state.category === 'saved' && !saved.length ? 'Open a topic and choose Save topic. Only topic IDs are saved on this device—not searches or clinical information.' : 'Try fewer words, choose another component, or browse all topics. No alternative procedure has been selected.';
}

function backRow(extra = '') { return `<div class="detail-top"><a href="#topics">Back to results</a>${extra}</div>`; }
function welcome() {
  return `<div class="welcome"><h2>Try an older-manual example</h2><p class="intro-copy">Explore a short answer, follow a reading walkthrough, or open the exact source page. These examples are not verified for your pump.</p><div class="example-links"><a href="#topic/software-versions">Find software versions <span>Reading walkthrough</span></a><a href="#topic/battery">View battery runtime <span>Reading walkthrough</span></a><a href="#topic/air-in-line">Understand an air-in-line message <span>Summary only</span></a><a href="#topic/alarm-silence">Understand alarm silence <span>Summary only</span></a></div><a class="secondary" href="#finder">Help me find a topic</a>
  <div class="source-summary"><h3>Current-device guidance is still pending</h3><p>We will update the examples after the corrected source pack arrives and its applicability is checked. Set-loading and infusion-programming procedures remain unavailable.</p><a href="#sources">View source status</a></div></div>`;
}

function topicView(topic) {
  const isSaved = saved.includes(topic.id);
  const example = HISTORICAL_EXAMPLES[topic.id];
  if (example) return historicalView(topic, example, isSaved);
  return `${backRow(`<button id="save-topic" data-topic="${topic.id}" aria-pressed="${isSaved}">${isSaved ? 'Remove saved topic' : 'Save topic'}</button>`)}
  <span class="reading-label">Content pending</span><h2 id="detail-title">${escape(topic.title)}</h2><p class="detail-meta">${escape(MODULE_LABELS[topic.module])} · Preview topic outline</p>
  <div class="pending"><h3>Instructions not yet available</h3><p>We are waiting for the corrected manual and confirmation that it applies to this configuration. The supplied v12.1 manual has not been verified for it.</p><p>This preview demonstrates how to find a topic; it does not provide operating steps.</p><div class="actions"><a class="primary" href="#sources">View source status</a><a href="#topics">Back to topics</a></div></div>
  <h3>What this answer will include</h3><p class="detail-meta">Applicable components and software, essential precautions, a concise complete procedure, expected outcomes and page-level source references. These sections are intentionally unpopulated until the content is reviewed.</p>
  <div class="source-summary"><h3>No reviewed instructions for this configuration</h3><p>Choosing a version, saving a topic or using the simulator does not confirm applicability. Guided device troubleshooting is not available in this preview.</p></div>`;
}

function historicalView(topic, example, isSaved) {
  return `${backRow(`<button id="save-topic" data-topic="${topic.id}" aria-pressed="${isSaved}">${isSaved ? 'Remove saved topic' : 'Save topic'}</button>`)}
  <span class="reading-label">Older-manual example · not device-verified</span><h2 id="detail-title">${escape(topic.title)}</h2><p class="detail-meta">${escape(MODULE_LABELS[topic.module])} · v12.1 / January 2020 / P00000225</p>
  <div class="historical-boundary"><strong>Study preview, not bedside guidance.</strong><p>This is a short adaptation of an older source, not the complete procedure or a match to your pump. For actual device use, follow your current manufacturer documentation and local policy.</p></div>
  <h3>At a glance</h3><p>${escape(example.summary)}</p>
  ${example.steps.length ? `<section class="walkthrough" aria-labelledby="walkthrough-title"><h3 id="walkthrough-title">Reading walkthrough</h3><p class="quiet-text">All steps stay visible. Highlighting a step only moves through this page; it does not operate or verify a device.</p><ol class="manual-steps">${example.steps.map((step, i) => `<li data-reading-step="${i}"><p>${escape(step)}</p></li>`).join('')}</ol><div class="actions"><button id="reading-start">Walk through this example</button><button id="reading-prev" hidden>Previous step</button><button id="reading-next" hidden>Next step</button><button id="reading-reset" hidden>Show all equally</button></div><p class="quiet-text reading-progress" role="status" aria-live="polite"></p></section>` : ''}
  <p class="example-note">${escape(example.note)}</p><div class="source-summary"><h3>Check the source</h3><p>Historical manual · printed p. ${escape(example.printedPages)} · PDF viewer ${example.pdfPages.length > 1 ? 'pages' : 'page'} ${example.pdfPages.join('–')}. Text/page-reference check only; no current-device validation.</p><div class="actions">${example.pdfPages.map(page => `<a href="${MANUAL_URL}#page=${page}" target="_blank" rel="noopener noreferrer">Open PDF page ${page}<span class="sr-only"> (new tab)</span></a>`).join('')}<a href="#sources">Version &amp; correction status</a></div></div>`;
}

function readingStep(index) {
  const rows = [...document.querySelectorAll('[data-reading-step]')];
  const active = index >= 0 ? Math.min(index, rows.length - 1) : -1;
  rows.forEach((row, i) => { if (i === active) row.setAttribute('aria-current', 'step'); else row.removeAttribute('aria-current'); });
  $('#reading-start').hidden = active >= 0;
  for (const id of ['reading-prev', 'reading-next', 'reading-reset']) $('#' + id).hidden = active < 0;
  $('#reading-prev').disabled = active === 0;
  $('#reading-next').disabled = active === rows.length - 1;
  $('.reading-progress').textContent = active < 0 ? 'All reading steps shown.' : `Reading step ${active + 1} of ${rows.length}: ${rows[active].textContent.trim()}${active === rows.length - 1 ? ' End of example, not a device-completion check.' : ''}`;
}

function configView() {
  const fields = [['pcu', 'PCU software'], ['model', 'Module model'], ['processor', 'Module main processor'], ['boot', 'Module boot software']];
  return `<details class="config"><summary>Reported device · optional</summary><p class="quiet-text">Record component fields separately. This stays in this page’s memory, clears on reload and does not unlock instructions. Leave anything unknown blank.</p><form id="config-form" autocomplete="off"><div class="config-grid">${fields.map(([id, label]) => `<div><label for="config-${id}">${label}</label><input id="config-${id}" name="${id}" maxlength="40" value="${escape(state.config[id] || '')}" placeholder="Not recorded" autocomplete="off"></div>`).join('')}</div><button class="secondary" type="submit">Record for this session</button><p class="config-status" role="status">No reviewed instructions for this configuration.</p></form></details>`;
}

function sourceView() {
  return `${backRow()}<h2 id="detail-title">Sources, without shortcuts.</h2><p class="intro-copy">A document being available does not make it the right operating reference. This is a source-discovery register, not a complete notice review or a determination that any particular device is affected.</p>
  ${SOURCES.map(source => `<article class="source-record"><h3>${escape(source.title)}</h3><p class="source-status">${escape(source.status)}</p><p>${escape(source.detail)}</p><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escape(source.link)} <span class="sr-only">(opens a new tab)</span></a></article>`).join('')}
  <p class="quiet-text">Research snapshot: September 22, 2026. No full current source-pack audit is complete. Corrections and component applicability must be reconciled before publishing current-device instructions.</p>${configView()}`;
}

function finderView() {
  const { node } = finderStep(state.finder);
  const current = FINDER[node];
  let cursor = 'start';
  const trail = state.finder.map((index, depth) => {
    const choice = FINDER[cursor].choices[index];
    cursor = choice.next;
    return `<li>${escape(choice.label)}<button data-change="${depth}">Change answer<span class="sr-only"> ${depth + 1}</span></button></li>`;
  }).join('');
  return `${backRow()}<span class="reading-label">Navigation helper · not troubleshooting</span><h2 id="detail-title">Find your topic</h2><p class="intro-copy">These questions only filter the topic index. They do not assess an infusion or tell you what to do with a device.</p>${trail ? `<ol class="finder-history">${trail}</ol>` : ''}<h3>${current.question}</h3><div class="finder-choices">${current.choices.map((choice, i) => `<button data-choice="${i}">${choice.label}</button>`).join('')}</div><div class="actions">${state.finder.length ? '<button id="finder-back">Back</button>' : ''}<button id="finder-reset">Start over</button><a href="#topics">Show all topics</a></div>`;
}

function aboutView() {
  return `${backRow()}<h2 id="detail-title">About this preview</h2><p class="intro-copy">A historical-source preview, not a current-device reference.</p><ul class="about-list"><li>Four brief examples use the older v12.1 manual. Other topics remain outlines.</li><li>Topic names and aliases are navigation labels—not a verified catalog for your installed software.</li><li>Reading walkthroughs are not competency checks. No dosing, infusion-programming or set-loading procedures are supplied.</li><li>There are no generated answers or device connections.</li><li>Searches and reported configuration stay in memory. Only theme preference and saved public topic IDs use this browser’s storage.</li><li>There is no institutional library, telemetry or offline instruction cache. Fonts may load from Google Fonts; search text is never sent there.</li></ul><div class="actions"><a href="#sources" class="primary">View source status</a><button id="clear-saved">Clear saved topics</button></div>`;
}

function renderReader(focus = false) {
  const hash = location.hash;
  let html;
  if (hash.startsWith('#topic/')) {
    const topic = TOPICS.find(t => '#topic/' + t.id === hash);
    html = topic ? topicView(topic) : `${backRow()}<h2 id="detail-title">Topic not found</h2><p>This link does not identify a topic in this preview. No alternative answer has been selected.</p><div class="actions"><a href="#topics" class="secondary">Browse all topics</a></div>`;
  } else if (hash === '#sources') html = sourceView();
  else if (hash === '#finder') html = finderView();
  else if (hash === '#about') html = aboutView();
  else html = welcome();
  $('#reader').innerHTML = html;
  const detail = ['#sources', '#finder', '#about'].includes(hash) || hash.startsWith('#topic/');
  $('#workspace').dataset.detail = String(detail);
  const title = $('#detail-title')?.textContent;
  document.title = `${title ? title + ' · ' : ''}Device Guide · Preview — AinaDara`;
  if (focus && detail) {
    $('#reader').focus({ preventScroll: true });
    if (matchMedia('(max-width: 680px)').matches) $('#reader').scrollIntoView({ block: 'start' });
  } else if (focus && matchMedia('(max-width: 680px)').matches) {
    $('#results-heading').scrollIntoView({ block: 'start' });
    $('#search').focus({ preventScroll: true });
  }
}

function browse(category = 'all', module = 'all') {
  navigate('#topics', { category: CATEGORY_LABELS[category] ? category : 'all', module, query: '' });
}

document.addEventListener('click', event => {
  const reading = event.target.closest('#reading-start, #reading-prev, #reading-next, #reading-reset');
  if (reading) {
    const current = Number(document.querySelector('[data-reading-step][aria-current]')?.dataset.readingStep ?? -1);
    readingStep(reading.id === 'reading-reset' ? -1 : reading.id === 'reading-start' ? 0 : current + (reading.id === 'reading-prev' ? -1 : 1));
    if (reading.id === 'reading-start') $('#reading-next').focus({ preventScroll: true });
    if (reading.id === 'reading-reset') $('#reading-start').focus({ preventScroll: true });
    if (reading.disabled) $(reading.id === 'reading-next' ? '#reading-prev' : '#reading-next').focus({ preventScroll: true });
    return;
  }
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor && anchor.hash !== '#search' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    if (anchor.hash === '#topics') returnToResults();
    else if (anchor.hash.startsWith('#browse/')) browse(anchor.hash.slice(8));
    else navigate(anchor.hash, anchor.hash === '#finder' ? { finder: [] } : {});
    return;
  }
  const save = event.target.closest('#save-topic');
  if (save) {
    saved = saved.includes(save.dataset.topic) ? saved.filter(id => id !== save.dataset.topic) : [...saved, save.dataset.topic];
    persistSaved(); renderResults();
    save.setAttribute('aria-pressed', String(saved.includes(save.dataset.topic)));
    save.textContent = saved.includes(save.dataset.topic) ? 'Remove saved topic' : 'Save topic';
  }
  if (event.target.closest('#clear-saved')) { saved = []; persistSaved(); renderResults(); }
  const choiceButton = event.target.closest('[data-choice]');
  if (choiceButton) {
    const { node } = finderStep(state.finder);
    const index = Number(choiceButton.dataset.choice), choice = FINDER[node].choices[index];
    if (choice.next) { state.finder.push(index); renderReader(true); }
    else if (choice.source) navigate('#sources');
    else browse(choice.category, choice.module || 'all');
  }
  const change = event.target.closest('[data-change]');
  if (change) { state.finder = state.finder.slice(0, Number(change.dataset.change)); renderReader(true); }
  if (event.target.closest('#finder-back')) { state.finder.pop(); renderReader(true); }
  if (event.target.closest('#finder-reset')) { state.finder = []; renderReader(true); }
});

function persistSaved() {
  let note = saved.length ? 'Saved topics updated.' : 'Saved topics cleared.';
  try { localStorage.setItem('ainadara-guide-saved', JSON.stringify(saved)); } catch { note += ' Storage unavailable; changes last for this tab only.'; }
  $('#announcement').textContent = note;
}

$('#search').addEventListener('input', event => {
  if (isDetail(currentHash)) navigate('#topics', { query: event.target.value }, { searching: true });
  else { state.query = event.target.value; renderResults(); }
});
$('#search-form').addEventListener('submit', event => { event.preventDefault(); if (isDetail(currentHash)) navigate('#topics', {}, { searching: true }); });
$('#clear-search').addEventListener('click', () => { state.query = ''; renderResults(); $('#search').focus(); });
$('#module-filter').addEventListener('change', event => navigate('#topics', { module: event.target.value }));
$('#category-filter').addEventListener('change', event => navigate('#topics', { category: event.target.value }));
$('#reset-filters').addEventListener('click', () => browse());
document.addEventListener('submit', event => {
  if (event.target.id !== 'config-form') return;
  event.preventDefault();
  state.config = Object.fromEntries(new FormData(event.target));
  $('.config-status').textContent = 'Recorded for this tab only. No reviewed instructions for this configuration.';
});

const theme = $('#theme');
function reflectTheme() { const dark = document.documentElement.dataset.theme === 'dark'; theme.setAttribute('aria-pressed', String(dark)); theme.textContent = dark ? 'Light theme' : 'Dark theme'; }
theme.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ainadara-theme', next); } catch { /* Theme still works in memory. */ }
  reflectTheme();
});
$('#guide-version').textContent = GUIDE_VERSION;
reflectTheme(); renderResults(); renderReader();
