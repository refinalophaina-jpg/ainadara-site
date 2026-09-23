// Historical summaries are a separate preview tier, never applicable/reviewed instructions.
export const GUIDE_VERSION = '0.2.0-historical-preview';
export const MANUAL_URL = 'https://www.bd.com/content/dam/bd-assets/na/medication-management-solutions/documents/user-guide/Alaris_System_User_Manual_Approved.pdf';
export const HISTORICAL_EXAMPLES = Object.freeze({
  'software-versions': {
    kind: 'reading-walkthrough', printedPages: '40–41', pdfPages: [54, 55],
    summary: 'The older manual separates control-unit software from each attached module’s software.',
    steps: ['Open OPTIONS, then PAGE DOWN.', 'Choose Software Versions.', 'Use View beside the control unit or desired module.', 'Leave the version display with EXIT.'],
    note: 'Illustrated version numbers are examples, not your device’s values.',
  },
  battery: {
    kind: 'reading-walkthrough', printedPages: '37', pdfPages: [51],
    summary: 'Runtime is an estimate based on the current operating parameters, not a fixed duration.',
    steps: ['Open OPTIONS, then PAGE DOWN.', 'Select Battery Runtime.', 'Return using CANCEL or EXIT.'],
    note: 'This example covers the runtime display, not battery-alarm management.',
  },
  'air-in-line': {
    kind: 'message-summary', printedPages: '331', pdfPages: [345],
    summary: 'In the older Pump Module table, detected air during delivery triggers a high-priority alarm and stops the affected channel.',
    steps: [], note: 'Summary only. Air removal, tubing handling and restart instructions are not included in this preview.',
  },
  'alarm-silence': {
    kind: 'message-summary', printedPages: '327–328', pdfPages: [341, 342],
    summary: 'The manual describes temporary audio suppression; visual alarm indication remains. Some alarm types cannot be silenced.',
    steps: [], note: 'Silencing is not resolution of the underlying condition. This is not a guide to dismissing an active alarm.',
  },
});
export const CATEGORY_LABELS = { all: 'All topics', messages: 'Messages & alarms', tasks: 'Everyday tasks', controls: 'Controls & components', saved: 'Saved topics' };
export const MODULE_LABELS = { all: 'All components', control: 'Control unit', pump: 'Pump module', other: 'Other / unconfirmed module' };
export const TOPICS = [
  ['air-in-line', 'Air in line', 'messages', 'pump', ['air', 'air bubble', 'air-in-line'], 'Air-related message lookup'],
  ['occlusion-pump', 'Occlusion · pump module', 'messages', 'pump', ['occlusion', 'blocked line', 'pressure'], 'Distinguish the message and affected component'],
  ['occlusion-other', 'Occlusion · other module', 'messages', 'other', ['occlusion', 'blocked line', 'pressure', 'syringe occlusion'], 'Module identity is needed before selecting a reference'],
  ['battery', 'Battery & power messages', 'messages', 'control', ['battery', 'low battery', 'power', 'ac'], 'Power-related message lookup'],
  ['infusion-complete', 'Infusion completion', 'messages', 'pump', ['complete', 'infusion complete', 'vtbi', 'finished'], 'Completion-related message lookup'],
  ['care-profile', 'Choose a care-area profile', 'tasks', 'control', ['profile', 'care area', 'critical care'], 'Profile-selection topic outline'],
  ['primary-infusion', 'Program a primary infusion', 'tasks', 'pump', ['primary', 'program', 'rate', 'dose'], 'Primary-programming topic outline'],
  ['load-set', 'Load or reload an infusion set', 'tasks', 'pump', ['load', 'reload', 'set', 'tubing', 'clamp'], 'Corrected set-loading source is required'],
  ['pause-restart', 'Pause and restart', 'tasks', 'pump', ['pause', 'restart', 'resume'], 'Pause/restart topic outline'],
  ['secondary-infusion', 'Secondary infusions', 'tasks', 'pump', ['secondary', 'piggyback', 'ivpb'], 'Separate from the simulator’s supported primary workflow'],
  ['software-versions', 'Software versions', 'controls', 'control', ['firmware', 'version', 'software versions'], 'Keep component software fields distinct'],
  ['channel-controls', 'Channel controls', 'controls', 'pump', ['channel', 'channel select', 'buttons', 'module'], 'Control-identification topic outline'],
  ['alarm-silence', 'Alarm silence', 'controls', 'control', ['silence', 'cancel silence', 'alarm sound', 'mute'], 'Understand the distinction between audio and alarm condition'],
].map(([id, title, category, module, aliases, description]) => Object.freeze({ id, title, category, module, aliases: Object.freeze(aliases), description, status: HISTORICAL_EXAMPLES[id] ? 'historical-preview' : 'content-pending', sourceIds: HISTORICAL_EXAMPLES[id] ? ['historical-manual'] : [], operatingContent: null }));

export const SOURCES = [
  { id: 'historical-manual', title: 'Supplied user manual', status: 'Historical · applicability unverified', detail: 'Software v12.1 · January 2020 · P00000225. Four brief examples use this source at the owner’s request. Text and page locations were checked; the complete manual and current-device applicability have not been validated. The corrected source pack is still pending.', url: MANUAL_URL, link: 'Open historical manual (PDF)' },
  { id: 'label-correction', title: 'Manual labeling correction', status: 'Correction record · not a corrected manual', detail: 'FDA Z-1231-2025 identifies a correction involving manuals including v12.3.2, part P00000827. That identifier is a retrieval lead, not confirmation of the current corrected revision or its applicability.', url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=211911', link: 'Open FDA correction record' },
  { id: 'source-request', title: 'Matching corrected source pack', status: 'Requested · not yet verified', detail: 'Manufacturer confirmation, the corrected user manual, applicable addenda and current notices are still needed. Obtaining a document and reviewing its contents are separate steps.', url: 'https://bd.com/self-service', link: 'Open BD support portal' },
];
