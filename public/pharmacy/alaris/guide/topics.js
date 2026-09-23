// Historical summaries are a separate preview tier, never applicable/reviewed instructions.
export const GUIDE_VERSION = '0.3.0-reference-preview';
export const MANUAL_URL = 'https://www.bd.com/content/dam/bd-assets/na/medication-management-solutions/documents/user-guide/Alaris_System_User_Manual_Approved.pdf';
const brief = (sourceId, printedPages, pdfPages, summary, related, note = 'Meaning only; this page does not provide a device-response or restart procedure.') => Object.freeze({ kind: 'reference-summary', sourceId, printedPages, pdfPages, summary, related, note, steps: [] });
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
  'occluded-patient': brief('historical-manual', '336', [350], 'Back-pressure alarm; affected infusion stops.', ['occluded-fluid', 'air-in-line', 'load-set']),
  'occluded-fluid': brief('historical-manual', '336', [350], 'Upstream obstruction or empty container; affected infusion stops.', ['occluded-patient', 'check-set', 'load-set']),
  'check-set': brief('historical-manual', '332', [346], 'Incorrect set installation; affected infusion stops.', ['load-set', 'air-in-line', 'occluded-fluid'], 'Do not use this historical table as a reloading procedure. The corrected set-loading source remains pending.'),
  'low-battery': brief('historical-manual', '335', [349], 'Limited charge remaining—not a guaranteed countdown.', ['battery', 'battery-discharged', 'replace-battery']),
  'battery-discharged': brief('historical-manual', '332', [346], 'All channels stopped to conserve power.', ['battery-shutdown', 'low-battery', 'battery']),
  'battery-shutdown': brief('historical-manual', '332', [346], 'Battery exhausted; system shutting down.', ['battery-discharged', 'replace-battery']),
  'channel-disconnected': brief('historical-manual', '332', [346], 'Module disconnected during operation or unrecoverable error.', ['channel-error', 'iui-inspection', 'channel-controls']),
  'channel-error': brief('historical-manual', '332', [346], 'Module malfunction detected.', ['channel-disconnected', 'iui-inspection', 'damaged-device']),
  'near-end': brief('historical-manual', '336', [350], 'Syringe/PCA nearing empty; delivery continues.', ['infusion-complete', 'alarm-silence'], 'This table entry is for syringe/PCA modules, not the large-volume pump module. Do not transfer its behavior to another component.'),
  'network-error': brief('historical-manual', '336', [350], 'Wireless lost; control unit continues operating.', ['software-versions', 'channel-error'], 'This does not establish whether any particular EHR programming request was received. Interoperability troubleshooting is outside this preview.'),
  'replace-battery': brief('historical-manual', '338', [352], 'Battery runtime capacity reduced.', ['low-battery', 'battery', 'maintenance-reminder'], 'No battery replacement or service procedure is supplied here.'),
  'maintenance-reminder': brief('historical-manual', '335', [349], 'Preventive maintenance is due.', ['damaged-device', 'dropped-device', 'software-versions'], 'A reminder is not a maintenance record or clearance to use the device.'),
  'infusion-complete': brief('release-highlights', '1', [1], 'BD’s v12.1.2 release note changed Infusion Complete and Infusion Complete–KVO alarms from medium to high priority.', ['near-end', 'alarm-silence', 'software-versions'], 'Version-sensitive: do not carry the older v12.1 alarm priority forward to your pump. This note is not a verified match to your installed build or a KVO programming guide.'),
  'basic-mode': brief('release-highlights', '2', [2], 'Basic infusion is identified as having no Guardrails protection. The release also describes an optional, profile-specific advisory.', ['limit-alerts', 'care-profile', 'primary-infusion'], 'This explains the label, not when to choose Basic mode. It is not a workaround for a missing drug or a limit alert.'),
  'limit-alerts': brief('release-highlights', '3', [3], 'The updated limit notification displays both the programmed value and the corresponding library limit for comparison.', ['custom-concentration', 'basic-mode', 'care-profile'], 'Compare the two fields as a study exercise. No override recommendation or institution-specific limit is provided.'),
  'custom-concentration': brief('release-highlights', '1–2', [1, 2], 'The release describes overdose/underdose prompts and additional information before the soft-limit continuation or hard-limit reprogramming decision.', ['limit-alerts', 'basic-mode'], 'An alert alone is not proof of a correct concentration. This page supplies neither concentration values nor an override workflow.'),
  'delay-options': brief('release-highlights', '3', [3], 'The v12.1.2 note removes “Delay Until” while retaining “Delay For.” Menu behavior is version-dependent.', ['software-versions', 'infusion-complete'], 'No scheduling or delayed-start procedure is supplied. Use this difference to understand why the source edition matters.'),
  'secondary-clamp': brief('release-highlights', '3', [3], 'A secondary-clamp reminder was added before secondary infusion starts.', ['secondary-infusion', 'load-set'], 'A reminder is not confirmation of physical setup. This is not a secondary-infusion or clamp-handling procedure.'),
  'channel-controls': brief('pump-overview', '', [], 'BD describes up to four independently infusing modules on one control unit, with a channel-status display and primary/secondary support.', ['channel-disconnected', 'channel-error', 'software-versions'], 'An overview is not a connection procedure. The AinaDara simulator’s controls and supported workflows are not evidence of exact device equivalence.'),
  'iui-inspection': brief('iui-tip-sheet', '1–2', [1, 2], 'The IUI is the connection between units. BD’s inspection sheet calls for checking both connector sides before use, including cracks, deposits, discoloration and bent pins.', ['damaged-device', 'channel-disconnected', 'dropped-device'], 'The same sheet warns against inserting fingers or objects into a connector while a module is attached. This is a recognition summary, not a disassembly or repair guide.'),
  'damaged-device': brief('iui-tip-sheet', '2', [2], 'BD warns against returning devices with damaged or contaminated IUI connectors to patient use and directs them to Biomedical Engineering. Preventive maintenance belongs to biomedical personnel.', ['iui-inspection', 'dropped-device', 'maintenance-reminder'], 'Do not attempt a connector repair from this guide. This dated tip sheet does not replace the institution’s current inspection process.'),
  'dropped-device': brief('inspection-notice', '', [], 'The FDA’s 2025 correction record says a dropped or severely jarred device should be removed from use and inspected by Biomedical Engineering, even without visible damage. Internal damage may affect delivery.', ['damaged-device', 'iui-inspection', 'maintenance-reminder'], 'This is a source-notice summary, not a determination that a specific device is affected, remediated or cleared for reuse. No inspection, calibration or return-to-service checklist is provided.'),
});
export const CATEGORY_LABELS = { all: 'All topics', messages: 'Messages & alarms', tasks: 'Everyday tasks', controls: 'Controls & concepts', care: 'Equipment care', saved: 'Saved topics' };
export const MODULE_LABELS = { all: 'All components', control: 'Control unit', pump: 'Pump module', other: 'Other / unconfirmed module', shared: 'System-wide care · source scope' };
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
  ['occluded-patient', 'Occluded · patient side', 'messages', 'pump', ['occluded patient side', 'occlusion', 'downstream', 'back pressure'], 'Message meaning'],
  ['occluded-fluid', 'Occluded · fluid side / empty container', 'messages', 'pump', ['occluded fluid side empty container', 'occlusion', 'upstream', 'empty bag'], 'Message meaning'],
  ['check-set', 'Check IV set', 'messages', 'pump', ['check iv set', 'tubing not loaded', 'installation'], 'Message meaning'],
  ['low-battery', 'Low battery', 'messages', 'control', ['low battery 30 min plug in now', 'power', 'battery'], 'Message meaning'],
  ['battery-discharged', 'Battery discharged', 'messages', 'control', ['battery discharged', 'power'], 'Message meaning'],
  ['battery-shutdown', 'Battery discharged · powering down', 'messages', 'control', ['battery discharged powering down', 'shutting down', 'power'], 'Message meaning'],
  ['channel-disconnected', 'Channel disconnected', 'messages', 'pump', ['channel disconnected', 'module disconnected'], 'Pump-module context; other components need their own reference'],
  ['channel-error', 'Channel error', 'messages', 'pump', ['channel error', 'module malfunction'], 'Pump-module context; other components need their own reference'],
  ['near-end', 'Near end of infusion · syringe/PCA', 'messages', 'other', ['near end of infusion', 'neoi', 'almost empty'], 'Component-specific meaning'],
  ['network-error', 'Network communication error', 'messages', 'control', ['network communication error', 'wireless', 'wifi'], 'Message meaning'],
  ['replace-battery', 'Replace battery', 'messages', 'control', ['replace battery', 'battery capacity'], 'Message meaning'],
  ['maintenance-reminder', 'Maintenance reminder', 'messages', 'control', ['maintenance reminder', 'preventive maintenance', 'service due'], 'Message meaning'],
  ['basic-mode', 'Basic infusion & library protection', 'controls', 'control', ['no guardrails basic infusion', 'basic mode', 'no protection'], 'Release-note concept'],
  ['limit-alerts', 'Reading a limit alert', 'controls', 'control', ['guardrails limit', 'soft limit', 'hard limit', 'exceeds limit'], 'Release-note concept'],
  ['custom-concentration', 'Custom-concentration alerts', 'controls', 'control', ['possible overdose', 'possible underdose', 'concentration alert'], 'Release-note concept'],
  ['delay-options', 'Delay options changed', 'controls', 'pump', ['delay until', 'delay for', 'schedule', 'delayed infusion'], 'Release-note difference'],
  ['secondary-clamp', 'Secondary-clamp reminder', 'controls', 'pump', ['open secondary clamp', 'secondary reminder', 'piggyback'], 'Release-note concept'],
  ['iui-inspection', 'Recognizing connector damage', 'care', 'shared', ['iui', 'connector', 'bent pin', 'crack', 'deposit'], 'Inspection-source orientation'],
  ['damaged-device', 'Damaged device & service boundary', 'care', 'shared', ['damage', 'repair', 'biomedical', 'contaminated'], 'Inspection-source orientation'],
  ['dropped-device', 'Dropped or severely jarred device', 'care', 'shared', ['dropped', 'fell', 'jarred', 'inspection', 'damage'], 'Safety-notice summary'],
].map(([id, title, category, module, aliases, description]) => Object.freeze({ id, title, category, module, discoveryModules: Object.freeze(module === 'shared' ? ['control', 'pump', 'other'] : [module]), aliases: Object.freeze(aliases), description, status: HISTORICAL_EXAMPLES[id] ? 'historical-preview' : 'content-pending', sourceIds: HISTORICAL_EXAMPLES[id] ? [HISTORICAL_EXAMPLES[id].sourceId || 'historical-manual'] : [], operatingContent: null }));

export const CONTENT_COUNTS = Object.freeze({ available: Object.keys(HISTORICAL_EXAMPLES).length, pending: TOPICS.length - Object.keys(HISTORICAL_EXAMPLES).length, total: TOPICS.length });
export const RELATED_TOPICS = Object.freeze({
  'air-in-line': ['occluded-patient', 'occluded-fluid', 'check-set'], battery: ['low-battery', 'battery-discharged', 'replace-battery'],
  'software-versions': ['infusion-complete', 'delay-options', 'channel-controls'], 'alarm-silence': ['air-in-line', 'infusion-complete', 'near-end'],
  'occlusion-pump': ['occluded-patient', 'occluded-fluid'], 'occlusion-other': ['near-end', 'channel-error'],
  'care-profile': ['basic-mode', 'limit-alerts'], 'primary-infusion': ['basic-mode', 'custom-concentration'],
  'load-set': ['check-set', 'iui-inspection'], 'pause-restart': ['alarm-silence', 'infusion-complete'], 'secondary-infusion': ['secondary-clamp', 'load-set'],
});

export const SOURCES = [
  { id: 'historical-manual', title: 'Supplied user manual', edition: 'v12.1 / January 2020 / P00000225', pageCount: 376, shortLabel: 'v12.1 manual', status: 'Historical · applicability unverified', detail: 'Brief examples and message meanings use this source. Text and page locations were checked; the complete manual and current-device applicability have not been validated. The corrected source pack is still pending.', url: MANUAL_URL, link: 'Open historical manual (PDF)' },
  { id: 'release-highlights', title: 'System v12.1.2 release highlights', edition: 'v12.1.2 / July 21, 2021 / BD-39824', pageCount: 5, shortLabel: 'v12.1.2 release note', status: 'Historical release note · not an operating manual', detail: 'Used for version-sensitive differences and programming-label concepts. It does not establish compatibility with the reported device. In particular, this later note changes the completion-alarm priority described in the older manual.', url: 'https://www.bd.com/content/dam/bd-assets/bd-com/en-us/document/support/alaris-customer-highlights-v12-1-2.pdf', link: 'Open release highlights (PDF)' },
  { id: 'pump-overview', title: 'Manufacturer Pump Module overview', edition: 'Public product page / checked September 2026', shortLabel: 'Product overview', status: 'Overview · not operating instructions', detail: 'Used only for the modular-system overview. Product-page availability does not establish local configuration or feature availability.', url: 'https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-alaris-pump-module', link: 'Open manufacturer overview' },
  { id: 'iui-tip-sheet', title: 'Inter-unit connector inspection sheet', edition: 'July 2020 / 4870 / DME 10000370018', pageCount: 2, shortLabel: '2020 inspection sheet', status: 'Dated tip sheet · current applicability unverified', detail: 'Recognition summaries include both the illustrated inspection page and its warning page. This is not a repair guide or a complete current inspection pack.', url: 'https://www.bd.com/content/dam/bd-assets/na/medication-management-solutions/documents/tip-sheet/MMS_IF_1910004870-Alaris-System-IUI-20Inspection_TS_EN.pdf', link: 'Open inspection sheet (PDF)' },
  { id: 'inspection-notice', title: 'Dropped-device inspection correction', edition: 'FDA Z-0430-2026 / posted November 20, 2025', shortLabel: 'FDA correction record', status: 'Notice summary · not individual-device clearance', detail: 'The record points to updated inspection and cleaning documentation. This preview does not determine whether any device is affected or remediated. Refer to the live record and the current institutional process.', url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=216289', link: 'Open FDA inspection correction' },
  { id: 'label-correction', title: 'Manual labeling correction', status: 'Correction record · not a corrected manual', detail: 'FDA Z-1231-2025 identifies a correction involving manuals including v12.3.2, part P00000827. That identifier is a retrieval lead, not confirmation of the current corrected revision or its applicability.', url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=211911', link: 'Open FDA correction record' },
  { id: 'source-request', title: 'Matching corrected source pack', status: 'Requested · not yet verified', detail: 'Manufacturer confirmation, the corrected user manual, applicable addenda and current notices are still needed. Obtaining a document and reviewing its contents are separate steps.', url: 'https://bd.com/self-service', link: 'Open BD support portal' },
];
