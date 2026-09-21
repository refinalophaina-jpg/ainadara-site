import { UNITS, evaluate, validateLibrary, parseCSV, initialState, transition, limitText, softRange, entryLabel, DEVICE_CAPABILITY_MODEL } from './engine.js';
import { mountDevice } from './device.js';
import { interpretWorkplaceCSV, isWorkplaceCSV } from './workplace-library.js';
import { initialSetup, setupTransition, setupReady, SETUP_STEPS } from './setup-engine.js';
import { mountSetup } from './setup.js';

const $ = id => document.getElementById(id);
const scenarios = {
  primary: { title:'A primary infusion', description:'Use the order below to choose a profile and program a single primary infusion.', entry:'fluid-adult', dose:125, vtbi:100, weight:'', number:'01' },
  weight: { title:'From dose to flow rate', description:'Program the prescribed weight-based dose. Compare the calculated flow rate with your own calculation before starting.', entry:'pressor-icu', dose:0.08, vtbi:50, weight:70, number:'02' },
  limits: { title:'Catch a programming error', description:'The rate field contains a deliberate error. Review it, interpret the alert, then correct it to match this order. Try 220 mL/h to explore a soft alert.', entry:'fluid-adult', dose:125, vtbi:100, weight:'', number:'03' },
  alarm: { title:'The infusion has stopped', description:'Start the ordered infusion, trigger a simulated occlusion, then work through the line check and resume delivery.', entry:'fluid-adult', dose:125, vtbi:100, weight:'', number:'04' },
};
const CHANNEL_IDS=['A','B','C','D'];
const blankChannel=()=>({state:initialState(),area:'',medication:'',program:{dose:'',vtbi:'',weight:''},lineChecked:false});
let activeChannel='A',moduleCount=3,channelSessions=Object.fromEntries(CHANNEL_IDS.map(id=>[id,blankChannel()]));
let demo, library, imported = false, mode = 'free', state = channelSessions.A.state, candidate = null, validationRevision = 0, renderedEvents = -1;
let device = null;
let setupScene=null, setupState=initialSetup(), setupEnabled=false;
let libraryPage=0;
const labels = { editing:'Editing', ready:'Ready to start', soft:'Soft-limit alert', blocked:'Program blocked', running:'Infusing', paused:'Paused', alarm:'Occlusion', complete:'Complete' };
const editable = () => ['editing','ready','soft','blocked'].includes(state.status);
// CF-05: guided exercises are scored assessment and enforce the pre-start check and a
// deliberate profile confirmation. Free practice is exploration and is explicitly unscored.
const assessmentMode = () => (mode === 'guided' && !imported ? 'assessment' : 'exploration');
const entry = () => library.entries.find(e => e.id === $('medication').value);
const program = () => ({ dose:$('dose').value, vtbi:$('vtbi').value, weight:$('weight').value });
const scenario = () => scenarios[$('scenario').value];
const fmt = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(n) : '—';
const time = seconds => {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0,Math.ceil(seconds));
  return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
function text(id,value) { if ($(id).textContent !== String(value)) $(id).textContent = value; }
function storeActiveChannel(){
  const session=channelSessions[activeChannel];
  session.state=state;
  if(!$('area'))return;
  session.area=$('area').value;session.medication=$('medication').value;session.program=program();session.lineChecked=$('line-checked').checked;
}
function channelContexts(){
  storeActiveChannel();
  return CHANNEL_IDS.slice(0,moduleCount).map(id=>{
    const session=channelSessions[id],selected=library?.entries.find(e=>e.id===session.medication);
    const infused=session.state.entry||selected;
    const configured=!!session.state.entry||!!session.program.dose||!!session.program.vtbi;
    return {id,status:session.state.status,entryName:configured&&infused?infused.name:'',doseUnit:configured&&infused?infused.doseUnit:'',program:session.state.program||session.program,result:session.state.result,delivered:session.state.delivered,elapsed:session.state.elapsed,events:session.state.events};
  });
}
function selectChannel(id){
  if(!CHANNEL_IDS.slice(0,moduleCount).includes(id)||id===activeChannel)return;
  storeActiveChannel();activeChannel=id;
  const session=channelSessions[id];state=session.state;renderedEvents=-1;
  const fallback=library.entries.some(e=>e.area==='Critical Care')?'Critical Care':library.entries[0].area;
  populateAreas(session.area||fallback);
  if(session.medication&&library.entries.some(e=>e.id===session.medication&&e.area===$('area').value))populateEntries(session.medication);
  $('dose').value=session.program.dose;$('vtbi').value=session.program.vtbi;$('weight').value=session.program.weight;
  $('line-checked').checked=session.lineChecked;$('order-checked').checked=state.acknowledged;
  renderCase();render();
}
function setModuleCount(value){
  const next=Number(value);
  if(![2,3,4].includes(next)||next===moduleCount)return true;
  storeActiveChannel();
  const removed=CHANNEL_IDS.slice(next,moduleCount);
  const inUse=removed.some(id=>{const session=channelSessions[id];return session.state.events.length||session.state.status!=='editing'||session.program.dose||session.program.vtbi||session.program.weight;});
  if(inUse)return false;
  moduleCount=next;
  if(!CHANNEL_IDS.slice(0,moduleCount).includes(activeChannel)){activeChannel='A';state=channelSessions.A.state;}
  renderedEvents=-1;render();return true;
}
function dispatch(action) {
  if (['start','resume'].includes(action.type)&&setupEnabled&&!setupReady(setupState)) { text('setup-summary','Complete the physical setup before starting delivery.'); return; }
  state = transition(state,action);channelSessions[activeChannel].state=state;render();
}
function mayReset() { storeActiveChannel();return !(CHANNEL_IDS.some(id=>channelSessions[id].state.events.length) || setupState.events.length || $('reflection').value) || confirm('Reset all three channels? Their action histories and this reflection will be cleared. Download the debrief first if you want to keep it.'); }
function clearAttempt(preserveSetup=false) {
  channelSessions=Object.fromEntries(CHANNEL_IDS.map(id=>[id,blankChannel()]));activeChannel='A';state=channelSessions.A.state;renderedEvents=-1;
  if(!preserveSetup){setupState=initialSetup();if(setupEnabled)setPresentation('setup');}
  device?.reset();
  $('order-checked').checked = false; $('line-checked').checked = false; $('override-reason').value = ''; $('reflection').value = '';
}
function clearActiveChannel(){
  const area=$('area').value,medication=$('medication').value;
  channelSessions[activeChannel]={...blankChannel(),area,medication};state=channelSessions[activeChannel].state;renderedEvents=-1;
  for(const id of ['dose','vtbi','weight'])$(id).value='';
  $('order-checked').checked=false;$('line-checked').checked=false;render();
}
function populateAreas(preferred) {
  $('area').replaceChildren(...[...new Set(library.entries.map(e => e.area))].map(area => new Option(area,area)));
  if (preferred) $('area').value = preferred;
  populateEntries();
}
function populateEntries(preferred) {
  const entries = library.entries.filter(e => e.area === $('area').value);
  $('medication').replaceChildren(...entries.map(e => new Option(entryLabel(e),e.id)));
  if (preferred) $('medication').value = preferred;
  updateEntry();
}
function updateEntry() {
  const e = entry();
  text('concentration',e.doseUnit === 'mL/h' ? 'Volumetric fluid · mL/h' : `${e.preparation?e.preparation+' · ':''}${e.concentrationLabel||`${e.concentration} ${e.amountUnit}/mL`}`);
  $('dose-label').firstChild.textContent = e.doseUnit === 'mL/h' ? 'Rate ' : 'Dose rate ';
  text('dose-unit',e.doseUnit); $('dose').placeholder = e.doseUnit === 'mL/h' ? 'Enter rate' : 'Enter dose';
  $('weight-field').hidden = !UNITS[e.doseUnit].weight;
  text('limits-summary',`Soft ${softRange(e)} · hard ${limitText(e.hardMin)}–${limitText(e.hardMax)} ${e.doseUnit}`);
  $('entry-source-note').hidden=!e.source;
  text('entry-source-note',e.source?`Source ID ${e.source.id} · ${e.therapy||'No therapy label'} · ${e.advisory?'Exported advisory: '+e.advisory+'. ':''}${e.limitNotice} Advisory text may be a code; consult the full institutional policy separately.`:'');
}
function configureExercise() {
  clearAttempt();
  const s = scenario();
  if (mode === 'guided') {
    const e = library.entries.find(e => e.id === s.entry);
    populateAreas(e.area); populateEntries(e.id);
  } else populateAreas(library.entries.some(e=>e.area==='Critical Care')?'Critical Care':undefined);
  $('dose').value = mode === 'guided' && $('scenario').value === 'limits' ? '650' : '';
  $('vtbi').value = mode === 'guided' && $('scenario').value === 'limits' ? '100' : '';
  $('weight').value = '';
  storeActiveChannel();renderCase(); render();
}
function renderCase() {
  const s = scenario();
  text('case-eyebrow',mode === 'guided' ? `Exercise ${s.number} · guided practice` : 'Explore · free practice');
  text('case-title',mode === 'guided' ? s.title : 'Your own practice session');
  text('case-description',mode === 'guided' ? s.description : 'Explore the active library, compare its profiles, and practice responding to alerts. No prescribed order is scored in this mode.');
  $('case-order').replaceChildren();
  if (mode === 'guided') {
    const e = library.entries.find(e => e.id === s.entry);
    const rows = [['Profile',e.area],['Entry',e.name],['Concentration',e.doseUnit === 'mL/h' ? 'Volumetric fluid' : `${e.concentration} ${e.amountUnit}/mL`],['Order',`${s.dose} ${e.doseUnit}`],['VTBI',`${s.vtbi} mL`]];
    if (s.weight) rows.push(['Weight',`${s.weight} kg`]);
    for (const [key,value] of rows) { const row = node('div'); row.append(node('dt',key),node('dd',value)); $('case-order').append(row); }
  }
  text('case-note',imported ? 'Imported library · training session only. Not clinically validated by this tool.' : 'All orders and library limits here are invented for training.');
  $('scenario').disabled = mode !== 'guided';
  $('guided').disabled = imported;
  $('guided').title = imported ? 'Restore the demo library to use guided exercises.' : '';
  $('guided').setAttribute('aria-pressed',String(mode === 'guided')); $('free').setAttribute('aria-pressed',String(mode === 'free'));
}
function checkpoints() {
  const started = state.events.some(e => e.type === 'Started');
  const s = scenario(), p = state.program || program();
  const selected = state.entry || entry();
  const matched = selected.id === s.entry && Number(p.dose) === s.dose && Number(p.vtbi) === s.vtbi && (!s.weight || Number(p.weight) === s.weight);
  const result = [
    { title:'Confirm the care-area profile', done:state.profileConfirmed === selected.area && (mode === 'free' || selected.id === s.entry), detail:state.profileConfirmed === selected.area ? `${selected.area} was deliberately confirmed.` : 'A displayed default is not a confirmation. Confirm the profile explicitly.' },
    { title:'Review the infusion program', done:!!state.result && ['ok','soft'].includes(state.result.kind), detail:'Resolve any blocking limit or invalid entry.' },
    { title:mode === 'guided' ? 'Match and check the order' : 'Complete your program check', done:state.acknowledged && (mode === 'free' || matched), detail:mode === 'guided' ? 'Profile, concentration, dose/rate, volume and weight. Self-reported; not an independent double check.' : 'Self-reported review; no exercise order is scored.' },
    { title:'Start the simulated infusion', done:started, detail:started ? 'A confirmed program was started.' : 'Review first, then press Start infusion.' },
  ];
  if(setupEnabled)result.unshift({title:'Prepare, prime and load the set',done:setupReady(setupState),detail:`${setupState.step}/${SETUP_STEPS.length} simulated setup steps. Not an assessment of aseptic or physical technique.`});
  if (mode === 'guided' && $('scenario').value === 'limits') result.push({ title:'Identify the programmed limit', done:state.events.some(e => e.type === 'Review' && /hard limit|soft range/.test(e.detail)), detail:'Trigger and interpret an alert before correcting the order.' });
  if (mode === 'guided' && $('scenario').value === 'alarm') result.push({ title:'Resolve the alarm and resume', done:state.events.some(e => e.type === 'Alarm resolved') && state.events.some(e => e.type === 'Resumed'), detail:'Clear the simulated occlusion, then explicitly resume.' });
  return result;
}
function renderChecks(target, checks) {
  $(target).replaceChildren(...checks.map((c,i) => { const li = node('li',undefined,`checkpoint ${c.done ? 'done' : ''}`); const icon = node('span',c.done ? '✓' : String(i+1),'step-icon'); icon.setAttribute('aria-hidden','true'); const content = node('span',`${c.done ? 'Completed: ' : ''}${c.title}`); content.append(node('small',c.detail)); li.append(icon,content); return li; }));
}
function render() {
  channelSessions[activeChannel].state=state;
  const active = ['running','paused','alarm','complete'].includes(state.status);
  text('worksheet-channel',`Channel ${activeChannel} · primary infusion`);
  $('program-fields').disabled = active;
  $('review').disabled = active;
  $('locked-note').hidden = !active;
  text('state-badge',labels[state.status]); text('monitor-status',labels[state.status].toUpperCase());
  const preview = state.result || evaluate(entry(),program());
  text('monitor-medication',entry().name);
  text('display-rate',fmt(preview.rate));
  const total = state.program ? Number(state.program.vtbi) : Number($('vtbi').value);
  text('remaining',total > 0 ? (Math.max(0,total-state.delivered)).toFixed(2) : '—');
  text('delivered',state.delivered.toFixed(2));
  text('time-left',preview.rate ? time((total-state.delivered)/preview.rate*3600) : '—'); text('elapsed',time(state.elapsed));
  $('delivery-progress').value = total > 0 ? state.delivered/total*100 : 0;
  $('start').disabled = !['ready','running','paused'].includes(state.status)||(setupEnabled&&!setupReady(setupState));
  text('start',state.status === 'running' ? 'Pause infusion' : state.status === 'paused' ? 'Resume infusion' : state.status === 'complete' ? 'Infusion complete' : 'Start infusion');
  $('advance').disabled = state.status !== 'running'; $('inject-alarm').disabled = state.status !== 'running';
  const messages = {
    editing:'Choose a profile, enter the program, then review before starting.',
    running:`Simulated delivery is running${state.reason ? ' with a recorded soft-limit override' : ''}. Programming is locked for this attempt.`,
    paused:'Delivery is paused. Resume continues the same confirmed program.',
    alarm:'Downstream occlusion — simulated delivery stopped. Complete the line check below.',
    complete:'VTBI reached. Simulated delivery has stopped. Open the debrief to review this attempt.',
  };
  const latestStartBlock = state.events.at(-1)?.type === 'Start blocked' ? state.events.at(-1).detail : '';
  text('program-feedback',latestStartBlock || messages[state.status] || (state.reason ? `Soft limit overridden for this exercise: ${state.reason}. Review your program, then start.` : state.result?.message));
  $('program-feedback').className = `feedback ${state.status}`;
  $('soft-actions').hidden = state.status !== 'soft'; $('alarm-actions').hidden = state.status !== 'alarm';
  // Keep the visible box and the engine's recorded acknowledgement in step; an 'edit' clears it.
  if ($('order-checked').checked !== state.acknowledged) $('order-checked').checked = state.acknowledged;
  $('confirm-profile').disabled = !editable() || state.profileConfirmed === $('area').value;
  text('profile-confirm-state',state.profileConfirmed === $('area').value ? `Confirmed: ${state.profileConfirmed}.` : 'Not confirmed. A displayed default is not a selection.');
  $('override').disabled = $('override-reason').value.trim().length < 10;
  $('resolve').disabled = !$('line-checked').checked;
  const checks = checkpoints(); renderChecks('checkpoints',checks); renderChecks('debrief-checks',checks);
  text('debrief-summary',`Channel ${activeChannel} · ${checks.filter(c => c.done).length} of ${checks.length} checkpoints complete · ${labels[state.status]} · ${library.name} (${library.version})`);
  $('download-attempt').disabled = !CHANNEL_IDS.some(id=>channelSessions[id].state.events.length) && !setupState.events.length && !$('reflection').value;
  const eventRevision=`${CHANNEL_IDS.map(id=>channelSessions[id].state.events.length).join(':')}:${setupState.events.length}:${activeChannel}`;
  if (renderedEvents !== eventRevision) {
    renderedEvents = eventRevision;
    const events=[...setupState.events.map(e=>({...e,type:e.accepted?'Setup':'Setup · try again',simulatedSeconds:null})),...CHANNEL_IDS.flatMap(id=>channelSessions[id].state.events.map(e=>({...e,type:`Channel ${id} · ${e.type}` })))].sort((a,b)=>a.at.localeCompare(b.at));
    $('event-empty').hidden = events.length > 0;
    $('event-list').replaceChildren(...events.map(e => { const li = node('li',undefined,'event'); li.append(node('strong',e.type),node('time',time(e.simulatedSeconds)),node('p',e.detail)); return li; }));
  }
  $('setup-statusbar').hidden=!setupEnabled;
  text('setup-summary',setupReady(setupState)?'Full setup mode · set prepared. Continue programming or revisit the scene.':`Full setup mode · ${setupState.step}/${SETUP_STEPS.length} steps. Delivery is locked until setup is complete.`);
  setupScene?.render();
  device?.render();
}
function setPresentation(next){
  for(const name of ['device','form','setup']){
    $(name==='form'?'worksheet':`${name}-host`).hidden=name!==next;
    $(`${name}-mode`).setAttribute('aria-pressed',String(name===next));
  }
  device?.render();setupScene?.render();
}
function renderLibrary() {
  $('active-library-warning').hidden=!library.analysis;
  text('active-library-warning',library.analysis?`Workplace snapshot · ${library.analysis.programmable}/${library.analysis.total} entries programmable. Only supplied limits are checked; blank limits are unknown. Not approved for clinical use. The full catalog and exclusions are in Drug library.`:'');
  text('data-origin',imported ? 'Imported training library.' : 'Fictional training values.');
  text('library-indicator',imported ? `Imported · ${library.version} · this tab only` : 'Fictional library · demo-0.1');
  text('library-meta',`${library.name} · ${library.version} · ${library.effectiveDate?'effective '+library.effectiveDate:'effective date not supplied'} · ${library.entries.length} programmable entries`);
  text('library-notice',library.analysis?`${library.analysis.total} source entries across ${Object.keys(library.analysis.profiles).length} profiles: ${library.analysis.programmable} programmable, ${library.analysis.browseOnly} browse-only. Only populated source limits are enforced; blanks remain unknown. Export approval and effective date are not established. Local training only.`:imported ? 'Imported for this training session. Format validated; clinical content has not been validated by this tool. No file was uploaded to a server.' : 'Fictional teaching entries and limits. These are not institutional settings or dosing recommendations.');
  $('restore-demo').hidden = !imported;
  const catalog=library.catalog||library.entries.map(e=>({...e,supported:true,entry:e}));
  const profiles=[...new Set(catalog.map(e=>e.area))];
  const oldProfile=$('library-profile').value;
  if($('library-profile').dataset.version!==library.version){$('library-profile').replaceChildren(new Option('All profiles',''),...profiles.map(p=>new Option(p,p)));$('library-profile').dataset.version=library.version;if(profiles.includes(oldProfile))$('library-profile').value=oldProfile;}
  const q = $('library-search').value.toLowerCase(),area=$('library-profile').value,support=$('library-support').value;
  const rows = catalog.filter(e => `${e.name} ${e.area} ${e.therapy||''} ${e.sourceId||''}`.toLowerCase().includes(q)&&(!area||e.area===area)&&(!support||(support==='supported')===e.supported));
  libraryPage=Math.min(libraryPage,Math.max(0,Math.ceil(rows.length/100)-1));
  text('library-page',rows.length?`${libraryPage*100+1}–${Math.min((libraryPage+1)*100,rows.length)} of ${rows.length}`:'0 entries');
  $('library-prev').disabled=libraryPage===0;$('library-next').disabled=(libraryPage+1)*100>=rows.length;
  $('library-empty').hidden = rows.length > 0;
  $('library-rows').replaceChildren(...rows.slice(libraryPage*100,(libraryPage+1)*100).map(item => {
    const e=item.entry,raw=item.raw||{},tr = node('tr'), first = node('td');first.append(node('strong',item.name),node('small',[item.area,item.therapy,item.sourceId?`Source ${item.sourceId}`:''].filter(Boolean).join(' · ')));tr.append(first);
    const values=e?[e.doseUnit==='mL/h'?'Volumetric':e.preparation||`${e.concentration} ${e.amountUnit}/mL`,e.doseUnit,limitText(e.hardMin),softRange(e),limitText(e.hardMax)]:[raw['Final Concentration']?`${raw['Final Concentration']} ${raw['Final Concentration Units']}`:'See source',raw['Dosing Units']||raw['Rate Units']||'—','—','See source','—'];
    for (const value of values) tr.append(node('td',value));
    const actions=node('td');actions.append(node('small',item.supported?'Programmable · primary only':'Browse only'));
    if(e){const use=node('button','Practice','text-button');use.addEventListener('click',()=>{if(!mayReset())return;mode='free';configureExercise();$('area').value=e.area;populateEntries(e.id);updateEntry();showView('practice');render();});actions.append(use);}
    if(item.raw){const details=node('button','Source details','text-button');details.addEventListener('click',()=>showSource(item));actions.append(details);}
    tr.append(actions);
    return tr;
  }));
}
function showSource(item){
  text('source-title',`${item.name} · ID ${item.sourceId}`);
  text('source-summary',item.supported?`Programmable primary infusion. ${item.entry.limitNotice}`:`Browse only: ${item.reasons.join('; ')}.`);
  text('source-conversion',item.notes?.join(' · ')||'Original source fields below. Blank is not interpreted as zero or disabled.');
  $('source-fields').replaceChildren(...Object.entries(item.raw).map(([key,value])=>{const tr=node('tr');tr.append(node('th',key),node('td',value||'(blank in export)'));return tr;}));
  $('source-dialog').showModal();
}
function applyLibrary(next){library=next;imported=true;mode='free';libraryPage=0;$('library-search').value='';$('library-profile').value='';$('library-profile').dataset.version='';$('library-support').value='';configureExercise();renderLibrary();showView('practice');}
async function decodeImport(content,fileName,bytes){
  if(/\.csv$/i.test(fileName)&&isWorkplaceCSV(content)){
    const hash=await crypto.subtle.digest('SHA-256',bytes||new TextEncoder().encode(content));
    return {errors:[],library:interpretWorkplaceCSV(content,{fileName,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')})};
  }
  const input=/\.json$/i.test(fileName)?JSON.parse(content):{name:$('import-name').value,version:$('import-version').value,effectiveDate:$('import-date').value,entries:parseCSV(content)};
  return validateLibrary(input);
}
function showView(view) {
  for (const name of ['practice','library','debrief']) $(`${name}-view`).hidden = name !== view;
  document.querySelectorAll('.tab').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('active',active); if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); });
  if (view === 'library') renderLibrary();
  if (view === 'debrief') render();
}
function invalidateImport() { validationRevision++; candidate = null; $('import-result').replaceChildren(); $('apply-import').disabled = true; $('import-confirm').checked = false; }
function wireEvents() {
  for (const next of ['device','form']) $(`${next}-mode`).addEventListener('click',() => setPresentation(next));
  $('setup-mode').addEventListener('click',()=>{
    if(!setupEnabled){if(!mayReset())return;setupEnabled=true;configureExercise();}
    setPresentation('setup');render();
  });
  $('return-setup').addEventListener('click',()=>setPresentation('setup'));
  $('exit-setup').addEventListener('click',()=>{if(!mayReset())return;setupEnabled=false;configureExercise();setPresentation('device');});
  $('coaching-toggle').addEventListener('click',() => {
    const hidden = !document.querySelector('.learning-column').hidden;
    document.querySelector('.learning-column').hidden = hidden;
    document.querySelector('.practice-grid').classList.toggle('device-focused',hidden);
    $('coaching-toggle').setAttribute('aria-pressed',String(!hidden));
    text('coaching-toggle',hidden ? 'Show coaching' : 'Hide coaching');
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => showView(button.dataset.view)));
  $('theme').setAttribute('aria-pressed',String(document.documentElement.dataset.theme === 'dark'));
  $('theme').addEventListener('click',() => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('theme').setAttribute('aria-pressed',String(dark)); try { localStorage.setItem('ainadara-theme',dark ? 'dark' : 'light'); } catch {} });
  for (const id of ['dose','vtbi','weight']) $(id).addEventListener('input',() => { if (!editable()) return; $('order-checked').checked = false; dispatch({type:'edit'}); });
  $('area').addEventListener('change',() => { $('dose').value = ''; $('weight').value = ''; $('order-checked').checked = false; populateEntries(); dispatch({type:'edit'}); });
  $('medication').addEventListener('change',() => { $('dose').value = ''; $('weight').value = ''; $('order-checked').checked = false; updateEntry(); dispatch({type:'edit'}); });
  $('program-form').addEventListener('submit',e => { e.preventDefault(); dispatch({type:'review',entry:entry(),program:program()}); });
  $('start').addEventListener('click',() => dispatch({type:state.status === 'running' ? 'pause' : state.status === 'paused' ? 'resume' : 'start',mode:assessmentMode()}));
  $('advance').addEventListener('click',() => { if (state.status !== 'running') return; dispatch({type:'tick',seconds:60}); });
  $('inject-alarm').addEventListener('click',() => { $('line-checked').checked = false; dispatch({type:'alarm'}); });
  $('line-checked').addEventListener('change',render);
  $('resolve').addEventListener('click',() => { if ($('line-checked').checked) dispatch({type:'resolve'}); });
  $('override-reason').addEventListener('input',() => { $('override').disabled = $('override-reason').value.trim().length < 10; });
  $('override').addEventListener('click',() => dispatch({type:'override',reason:$('override-reason').value}));
  $('reprogram').addEventListener('click',() => { dispatch({type:'edit'}); $('dose').focus(); });
  $('order-checked').addEventListener('change',() => dispatch({type:'acknowledgeOrder',acknowledged:$('order-checked').checked}));
  $('confirm-profile').addEventListener('click',() => { if (editable()) dispatch({type:'confirmProfile',area:$('area').value}); });
  let lastScenario = $('scenario').value;
  $('scenario').addEventListener('change',() => { if (!mayReset()) { $('scenario').value = lastScenario; return; } lastScenario = $('scenario').value; configureExercise(); });
  $('reset').addEventListener('click',() => { if (mayReset()) configureExercise(); });
  for (const next of ['guided','free']) $(next).addEventListener('click',() => { if (mode === next || (next === 'guided' && imported) || !mayReset()) return; mode = next; configureExercise(); });
  $('reflection').addEventListener('input',() => { $('download-attempt').disabled = !CHANNEL_IDS.some(id=>channelSessions[id].state.events.length) && !setupState.events.length && !$('reflection').value; });
  $('download-attempt').addEventListener('click',() => {
    storeActiveChannel();
    const channels=CHANNEL_IDS.slice(0,moduleCount).map(id=>{const session=channelSessions[id],s=session.state;return {channel:id,status:s.status,program:s.program||session.program,entry:s.entry,profileConfirmed:s.profileConfirmed,orderCheckAcknowledged:s.acknowledged,deliveredMl:s.delivered,simulatedSeconds:s.elapsed,events:s.events};});
    const report = { application:'AinaDara infusion practice', prototypeVersion:'0.5', trainingOnly:true, exportedAt:new Date().toISOString(), mode, scenario:mode === 'guided' ? $('scenario').value : null, moduleCount, activeChannel, channels, setup:{enabled:setupEnabled,complete:setupReady(setupState),stepsComplete:setupState.step,events:setupState.events,container:'generic prepared primary bag',physicalTechniqueAssessed:false}, library:{name:library.name,version:library.version,effectiveDate:library.effectiveDate,source:imported ? 'local import' : 'fictional demo',provenance:library.source||null}, status:state.status, program:state.program, entry:state.entry, deviceCapabilityModel:{id:DEVICE_CAPABILITY_MODEL.id,version:DEVICE_CAPABILITY_MODEL.modelVersion,institutionVerified:DEVICE_CAPABILITY_MODEL.institutionVerified}, assessmentMode:assessmentMode(), profileConfirmed:state.profileConfirmed, orderCheckAcknowledged:state.acknowledged, deliveredMl:state.delivered, simulatedSeconds:state.elapsed, checkpoints:checkpoints(), events:state.events, reflection:$('reflection').value };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})); const a = node('a'); a.href = url; a.download = 'ainadara-infusion-attempt.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  for(const id of ['library-search','library-profile','library-support'])$(id).addEventListener('input',()=>{libraryPage=0;renderLibrary();});
  $('library-prev').addEventListener('click',()=>{libraryPage--;renderLibrary();});
  $('library-next').addEventListener('click',()=>{libraryPage++;renderLibrary();});
  $('open-import').addEventListener('click',() => $('import-dialog').showModal());
  for (const id of ['library-file','import-name','import-version','import-date']) $(id).addEventListener('input',invalidateImport);
  $('import-confirm').addEventListener('change',() => { $('apply-import').disabled = !candidate || !$('import-confirm').checked; });
  $('validate-import').addEventListener('click',async () => {
    invalidateImport(); const revision = validationRevision;
    try {
      const file = $('library-file').files[0];
      if (!file) throw new Error('Choose a CSV or JSON file first.');
      if (file.size > 16*1024*1024) throw new Error('File is larger than 16 MB.');
      if (!/\.(csv|json)$/i.test(file.name)) throw new Error('Use CSV or JSON. IQY queries are not executed.');
      const bytes=await file.arrayBuffer(),content = new TextDecoder().decode(bytes);
      if (revision !== validationRevision) return;
      const result = await decodeImport(content,file.name,bytes);
      if(revision!==validationRevision)return;
      if (result.errors.length) {
        $('import-result').append(node('p',`Import rejected: ${result.errors.length} issue(s). Nothing has been applied.`,'danger'));
        const list = node('ul'); result.errors.slice(0,30).forEach(error => list.append(node('li',error))); $('import-result').append(list);
      } else {
        candidate = result.library;
        $('import-result').append(node('p',`${candidate.name} · ${candidate.version} · ${candidate.effectiveDate||'effective date not supplied'}`),node('p',candidate.analysis?`${candidate.analysis.total} source entries; ${candidate.analysis.programmable} programmable and ${candidate.analysis.browseOnly} browse-only. Blank limits remain unknown. Review source details before teaching.`:`${candidate.entries.length} entries across ${new Set(candidate.entries.map(e => e.area)).size} care areas. Format and limit ordering passed.`),node('p',`Preview: ${candidate.entries.slice(0,3).map(e => `${e.name} (${e.area})`).join('; ')}.`));
      }
    } catch (error) { if (revision === validationRevision) $('import-result').replaceChildren(node('p',error.message,'danger')); }
  });
  $('apply-import').addEventListener('click',() => {
    if (!candidate || !$('import-confirm').checked || !mayReset()) return;
    applyLibrary(candidate); $('import-dialog').close();
  });
  $('restore-demo').addEventListener('click',() => { if (!mayReset()) return; library = demo; imported = false; mode = 'guided';libraryPage=0; $('library-search').value = '';$('library-profile').value='';$('library-support').value=''; configureExercise(); renderLibrary(); });
  // Discrete simulation clock: every connected channel runs independently, while hidden
  // tabs accrue nothing. The active worksheet remains a view onto the selected channel.
  setInterval(() => {
    if(document.hidden)return;
    storeActiveChannel();let changed=false;
    for(const id of CHANNEL_IDS){const session=channelSessions[id];if(session.state.status==='running'){session.state=transition(session.state,{type:'tick',seconds:1});changed=true;}}
    state=channelSessions[activeChannel].state;if(changed)render();
  },1000);
  setInterval(()=>{if(!document.hidden&&setupState.busy){setupState=setupTransition(setupState,{type:'tick',seconds:.25});render();}},250);
}

try {
  const response = await fetch(new URL('./demo-library.json',import.meta.url));
  if (!response.ok) throw new Error('Training library could not be loaded.');
  const result = validateLibrary(await response.json());
  if (result.errors.length) throw new Error(result.errors.join(' '));
  demo = result.library; library = demo;
  wireEvents(); configureExercise(); renderLibrary();
  device = mountDevice($('device-host'),{
    context:() => ({state, entry:entry(), program:program(), library, imported, editable:editable(), setupComplete:!setupEnabled||setupReady(setupState), lineChecked:$('line-checked').checked, mode:assessmentMode(),activeChannel,moduleCount,channels:channelContexts()}),
    selectChannel,
    setModuleCount,
    newPatient:() => { if (editable()) clearActiveChannel(); },
    dispatch,
    selectArea:area => { if (!editable()) return; $('area').value = area; $('area').dispatchEvent(new Event('change')); },
    selectEntry:id => { if (!editable()) return; $('medication').value = id; $('medication').dispatchEvent(new Event('change')); },
    setField:(field,value) => { if (!editable()) return; $(field).value = value; $(field).dispatchEvent(new Event('input')); },
    review:() => dispatch({type:'review',entry:entry(),program:program()}),
    checkLine:() => { $('line-checked').checked = true; render(); },
    checkOrder:() => { $('order-checked').checked = true; dispatch({type:'acknowledgeOrder',acknowledged:true}); },
    advance:() => dispatch({type:'tick',seconds:60}),
    alarm:() => { $('line-checked').checked = false; dispatch({type:'alarm'}); },
    format:fmt, time,
  });
  setupScene=mountSetup($('setup-host'),{
    state:()=>setupState,running:()=>channelContexts().some(channel=>channel.status==='running'),
    act:target=>{if(setupReady(setupState))return;setupState=setupTransition(setupState,{type:'act',target});render();},
    zoom:()=>{if(!setupReady(setupState))return;setPresentation('device');if(!state.events.length)$('device-startup').click();$('device-host').scrollIntoView({block:'start'});$('pcu-power').focus({preventScroll:true});},
  });
  setupScene.render();
  device.render();
  // Two distinct institutional paths, deliberately not merged:
  //   ?library=workplace     the loopback-only developer preview, reading a local file
  //   ?library=institutional the deployed, access-gated endpoint
  // Keeping them separate means the gated path can never silently fall back to a local file,
  // and the loopback preview can never be mistaken for an authenticated session.
  const requested=new URL(location.href).searchParams.get('library');
  if(requested==='workplace'||requested==='institutional'){
    const gated=requested==='institutional';
    $('institutional-signin-wrap').hidden=true;
    try{
      const response=await fetch(new URL(gated?'./library':'./local-library.json',import.meta.url),gated?{credentials:'include',cache:'no-store'}:undefined);
      if(gated&&!response.ok){
        // The gate refuses rather than explaining; translate its status into something actionable.
        throw new Error(response.status===401?'Sign in through the access gateway, then reload this page.'
          :response.status===403?'Your account is not permitted to load this library.'
          :'The institutional library is not available on this deployment.');
      }
      // A static host that answers unknown paths with its HTML shell returns 200, so `ok`
      // alone is not enough: without the content-type check this surfaces a JSON parser
      // error instead of the actionable message below.
      if(!response.ok||!/\bjson\b/i.test(response.headers.get('content-type')||''))throw new Error(gated?'The institutional library is not available on this deployment.':'Start the private workplace preview or import the CSV manually.');
      const checked=validateLibrary(await response.json());
      if(checked.errors.length)throw new Error(checked.errors.join(' '));
      applyLibrary(checked.library);
      if(gated)text('data-origin','Institutional library · simulation and teaching only · not an approved drug library.');
    }catch(error){$('active-library-warning').hidden=false;text('active-library-warning',`${gated?'Institutional':'Workplace'} library not loaded: ${error.message} Demo library remains active.`);if(gated)$('institutional-signin-wrap').hidden=false;}
  }
  if(new URL(location.href).searchParams.get('setup')==='full')$('setup-mode').click();
} catch (error) {
  $('fatal').hidden = false; text('fatal',`The simulator could not start: ${error.message} Reload to retry.`);
  document.querySelectorAll('main button, main input, main select').forEach(el => el.disabled = true);
}
