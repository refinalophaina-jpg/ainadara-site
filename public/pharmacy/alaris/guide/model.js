import { TOPICS } from './topics.js';

export function normalize(value = '') {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function searchTopics(query, { category = 'all', module = 'all', saved = [] } = {}) {
  const q = normalize(query);
  return TOPICS.filter(t => (category === 'all' || (category === 'saved' ? saved.includes(t.id) : category === t.category)) && (module === 'all' || module === t.module)).map(topic => {
    const title = normalize(topic.title), aliases = topic.aliases.map(normalize);
    const words = normalize([topic.title, ...topic.aliases].join(' '));
    let score = !q ? 1 : title === q ? 100 : aliases.includes(q) ? 90 : title.startsWith(q) ? 70 : q.split(' ').every(w => words.includes(w)) ? 40 : 0;
    return { topic, score, match: !q ? '' : score === 100 ? 'Topic title match' : score === 90 ? 'Search alias match' : 'Related wording' };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic));
}

export function safeSaved(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => TOPICS.some(t => t.id === id)))];
}

// Pure preflight for FUTURE authored content. The preview renderer never renders
// operational content, even if a future record passes these checks. This is not
// a clinical review and cannot create or substitute for reviewer evidence.
export function publicationIssues(record, sources = []) {
  const issues = [];
  if (record?.status !== 'reviewed') issues.push('Topic is not reviewed');
  const references = record?.sourceBindings;
  if (!Array.isArray(references) || !references.length) issues.push('No source bindings');
  else for (const binding of references) {
    const source = sources.find(s => s.id === binding.id);
    if (!source || source.status !== 'current-corrected' || !source.revision || source.revision !== binding.revision || !source.sha256 || source.sha256 !== binding.sha256) issues.push('Source missing, changed or superseded');
  }
  if (record?.applicability?.status !== 'confirmed' || !record?.applicability?.evidence || !record?.applicability?.configurations?.length) issues.push('Applicability not confirmed');
  if (!record?.review?.reviewer || !record?.review?.date || !record?.review?.evidence || record.review.contentRevision !== record?.contentRevision || !record?.contentRevision) issues.push('Content review absent or stale');
  for (const section of ['prerequisites', 'warnings', 'steps', 'outcomes', 'escalation']) {
    if (!Array.isArray(record?.[section]) || !record[section].length || record[section].some(item => !item.text || !item.sourceId || !item.passage || !references?.some(b => b.id === item.sourceId))) issues.push(`Unmapped ${section}`);
  }
  return [...new Set(issues)];
}

export const FINDER = Object.freeze({
  start: { question: 'What are you looking for?', choices: [{ label: 'A message on the screen', next: 'message' }, { label: 'A task I want to find', category: 'tasks' }, { label: 'A control or component', category: 'controls' }, { label: 'Not sure', next: 'unsure' }] },
  message: { question: 'Which component is the topic about?', choices: [{ label: 'Control unit', category: 'messages', module: 'control' }, { label: 'Pump module', category: 'messages', module: 'pump' }, { label: 'Other module', category: 'messages', module: 'other' }, { label: 'Not sure', category: 'messages', module: 'all' }] },
  unsure: { question: 'You can browse without choosing a component.', choices: [{ label: 'Browse all topics', category: 'all' }, { label: 'View source status', source: true }] },
});

export function finderStep(path = []) {
  let node = 'start';
  for (const index of path) {
    const choice = FINDER[node]?.choices[index];
    if (!choice?.next) return { node, choice, terminal: Boolean(choice) };
    node = choice.next;
  }
  return { node, terminal: false };
}
