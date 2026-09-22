// Pure training rules. No device connection or clinical recommendations.
import { csvRecords } from './csv.js?v=0.8';
import { checkDeviceProgram, displayRate, DEVICE_CAPABILITY_MODEL } from './device-profile.js?v=0.8';
export { DEVICE_CAPABILITY_MODEL, displayRate };
export const UNITS = {
  'mL/h': { amount: 'mL', weight: false, factor: 1 },
  'mg/h': { amount: 'mg', weight: false, factor: 1 },
  'mcg/h': { amount: 'mcg', weight: false, factor: 1 },
  'mcg/min': { amount: 'mcg', weight: false, factor: 60 },
  'mcg/kg/min': { amount: 'mcg', weight: true, factor: 60 },
  'units/h': { amount: 'units', weight: false, factor: 1 },
  'units/kg/h': { amount: 'units', weight: true, factor: 1 },
  'mg/kg/h': { amount: 'mg', weight: true, factor: 1 },
  'mg/kg/min': { amount: 'mg', weight: true, factor: 60 },
  'mg/min': { amount: 'mg', weight: false, factor: 60 },
  'mcg/kg/h': { amount: 'mcg', weight: true, factor: 1 },
  'gram/h': { amount: 'gram', weight: false, factor: 1 },
  'units/min': { amount: 'units', weight: false, factor: 60 },
  'units/kg/min': { amount: 'units', weight: true, factor: 60 },
  'milliunits/min': { amount: 'milliunits', weight: false, factor: 60 },
  'nanogram/kg/min': { amount: 'nanogram', weight: true, factor: 60 },
  'mEq/kg/h': { amount: 'mEq', weight: true, factor: 1 },
};
export const COLUMNS = ['id','area','name','concentration','amountUnit','doseUnit','hardMin','softMin','softMax','hardMax'];
export function number(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.trim())) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
export function validateLibrary(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { errors: ['Expected a library object.'] };
  const v2=input.schemaVersion===2;
  for (const key of ['name','version',...(!v2?['effectiveDate']:[])]) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 120) errors.push(`Library ${key} is required (maximum 120 characters).`);
  }
  if(v2&&input.effectiveDate!==null&&typeof input.effectiveDate!=='string')errors.push('Effective date must be a date or explicitly unknown (null).');
  if (typeof input.effectiveDate === 'string' && (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) || !Number.isFinite(Date.parse(input.effectiveDate)) || new Date(input.effectiveDate).toISOString().slice(0,10) !== input.effectiveDate)) errors.push('Effective date must be a real date in YYYY-MM-DD format.');
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 5000) return { errors: [...errors, 'Provide between 1 and 5,000 library entries.'] };
  const ids = new Set();
  const entries = input.entries.map((raw, index) => {
    const row = index + 1;
    const e = raw && typeof raw === 'object' ? { ...raw } : {};
    for (const key of ['id','area','name','amountUnit','doseUnit']) {
      if (typeof e[key] !== 'string' || !e[key].trim() || e[key].length > 120) errors.push(`Row ${row}: ${key} is required (maximum 120 characters).`);
      else e[key] = e[key].trim();
    }
    if (ids.has(e.id)) errors.push(`Row ${row}: duplicate id.`);
    ids.add(e.id);
    for (const key of ['concentration','hardMin','softMin','softMax','hardMax']) {
      if(v2&&key!=='concentration'&&e[key]===null)continue;
      e[key] = number(e[key]);
      if (!Number.isFinite(e[key])) errors.push(`Row ${row}: ${key} must be a finite, non-negative decimal.`);
    }
    const unit = UNITS[e.doseUnit];
    if (!unit) errors.push(`Row ${row}: unsupported dose unit.`);
    else if (unit.amount !== e.amountUnit) errors.push(`Row ${row}: concentration unit and dose unit do not match. Convert units explicitly before import.`);
    if (!(e.concentration > 0)) errors.push(`Row ${row}: concentration must be greater than zero.`);
    if (e.doseUnit === 'mL/h' && e.concentration !== 1) errors.push(`Row ${row}: volumetric entries must use concentration 1 mL/mL.`);
    const bounds=['hardMin','softMin','softMax','hardMax'].map(k=>e[k]).filter(n=>n!==null);
    if (!bounds.length||bounds.some((n,i)=>!Number.isFinite(n)||n<0||(i&&n<bounds[i-1]))||(e.hardMax!==null&&e.hardMax<=0)) errors.push(`Row ${row}: require 0 ≤ hard min ≤ soft min ≤ soft max ≤ hard max for provided limits; null means not provided only in schema v2.`);
    const out=Object.fromEntries(COLUMNS.map(key => [key, e[key]]));
    if(v2){for(const key of ['therapy','advisory','preparation','concentrationLabel','drugType','module','limitNotice'])if(typeof e[key]==='string')out[key]=e[key].slice(0,1000);if(e.source&&typeof e.source==='object')out.source=e.source;}
    return out;
  });
  let catalog,analysis;
  if(v2&&input.catalog!==undefined){
    if(!Array.isArray(input.catalog)||input.catalog.length<1||input.catalog.length>10000)errors.push('Catalog must contain 1–10,000 records.');
    else {
      const byId=new Map(entries.map(e=>[e.id,e])),catalogIds=new Set();
      catalog=input.catalog.map((item,i)=>{
        const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
        const strings=v=>Array.isArray(v)&&v.length<=100&&v.every(s=>typeof s==='string'&&s.length<=2000);
        if(!plain(item)||!['id','name','area','sourceId'].every(k=>typeof item[k]==='string'&&item[k].length<=120)||typeof item.supported!=='boolean'||!strings(item.reasons)||!strings(item.notes)||!plain(item.raw)||Object.keys(item.raw).length>150||!Object.entries(item.raw).every(([k,v])=>k.length<=300&&typeof v==='string'&&v.length<=200000)){
          errors.push(`Catalog record ${i+1}: malformed source data.`);return null;
        }
        if(catalogIds.has(item.id))errors.push(`Catalog record ${i+1}: duplicate id.`);
        catalogIds.add(item.id);
        const entry=byId.get(item.id);
        if(item.supported!==!!entry||(!item.supported&&!item.reasons.length)||(entry&&(entry.name!==item.name||entry.area!==item.area)))errors.push(`Catalog record ${i+1}: support or entry identity mismatch.`);
        // Never trust a second copy of the programmable entry from imported JSON.
        return {...item,entry};
      });
      if(entries.some(e=>!catalogIds.has(e.id)))errors.push('Every programmable entry must have a catalog record.');
      if(!errors.length){
        const counts=key=>Object.fromEntries([...catalog.reduce((m,r)=>m.set(r[key]||'(blank)',(m.get(r[key]||'(blank)')||0)+1),new Map())]);
        analysis={...(input.analysis&&typeof input.analysis==='object'&&!Array.isArray(input.analysis)?input.analysis:{}),total:catalog.length,programmable:entries.length,browseOnly:catalog.length-entries.length,profiles:counts('area')};
      }
    }
  }else if(v2&&input.analysis!==undefined)errors.push('Catalog analysis requires source records.');
  return errors.length ? { errors } : { errors: [], library: { name: input.name.trim(), version: input.version.trim(), effectiveDate: input.effectiveDate, entries, ...(v2?{schemaVersion:2,source:input.source,catalog,analysis}: {}) } };
}
export function parseCSV(text) {
  const {headers,records}=csvRecords(text);
  if (!headers || headers.length !== COLUMNS.length || new Set(headers).size !== COLUMNS.length || COLUMNS.some(c => !headers.includes(c))) throw new Error(`Use exactly these CSV headers: ${COLUMNS.join(', ')}.`);
  return records;
}
export const limitText = n => Number.isFinite(n) ? String(n) : 'not provided';
export const softRange = e => `${limitText(e.softMin)}–${limitText(e.softMax)}`;
export const entryLabel = e => [e.name,e.therapy,e.preparation||e.concentrationLabel||(e.doseUnit==='mL/h'?'Volumetric':`${e.concentration} ${e.amountUnit}/mL`),e.doseUnit].filter(Boolean).join(' · ');
export function evaluate(entry, program) {
  const dose = number(program.dose), vtbi = number(program.vtbi), weight = number(program.weight);
  const unit = UNITS[entry.doseUnit];
  if (!unit || !(dose > 0) || !(vtbi > 0) || (unit.weight && !(weight > 0))) return { kind: 'invalid', message: 'Enter positive numeric values for dose/rate, VTBI, and weight when required.' };
  const calculatedRate = dose * unit.factor * (unit.weight ? weight : 1) / entry.concentration;
  if (!Number.isFinite(calculatedRate) || calculatedRate <= 0) return { kind: 'invalid', message: 'These values cannot produce a finite infusion. Check your entries.' };
  if(!['hardMin','softMin','softMax','hardMax'].some(k=>Number.isFinite(entry[k])))return {kind:'invalid',message:'No usable limits were supplied for this entry. Browse only.'};
  // Drug-library guardrails first: a hard-limit alert is the clinically important message.
  const low = Number.isFinite(entry.hardMin)&&dose < entry.hardMin, high = Number.isFinite(entry.hardMax)&&dose > entry.hardMax;
  if (low || high) return { kind: 'hard', rate: calculatedRate, calculatedRate, duration: vtbi / calculatedRate * 3600, message: `${dose} ${entry.doseUnit} is ${low ? 'below' : 'above'} the hard limit (${low ? entry.hardMin : entry.hardMax} ${entry.doseUnit}). Reprogram to continue.` };
  // Device capability is checked before any overridable soft alert: a soft-limit override must
  // never be able to authorise a program the pump physically cannot deliver.
  const device = checkDeviceProgram({ rate: calculatedRate, vtbi, weight, weightRequired: !!unit.weight, directRateEntry: entry.doseUnit === 'mL/h' });
  if (!device.ok) return { kind: 'device', rate: calculatedRate, calculatedRate, duration: vtbi / calculatedRate * 3600, deviceProblems: device.problems, message: `${device.problems.join(' ')} This is a device limit, not a drug-library limit, and cannot be overridden.` };
  const rate = device.deliveredRate;
  const duration = vtbi / rate * 3600;
  if (!Number.isFinite(duration) || duration <= 0) return { kind: 'invalid', message: 'These values cannot produce a finite infusion. Check your entries.' };
  const notice = device.notices.length ? ` ${device.notices.join(' ')}` : '';
  if ((Number.isFinite(entry.softMin)&&dose < entry.softMin) || (Number.isFinite(entry.softMax)&&dose > entry.softMax)) return { kind: 'soft', rate, calculatedRate, duration, deviceNotices: device.notices, message: `${dose} ${entry.doseUnit} is outside the soft range of ${softRange(entry)} ${entry.doseUnit}. Reprogram or record a reason to override in this exercise.${notice}` };
  return { kind: 'ok', rate, calculatedRate, duration, deviceNotices: device.notices, message: `Within the supplied training limits. ${entry.limitNotice||'Check against the scenario order before starting.'}${notice}` };
}
export function initialState() { return { status:'editing', result:null, program:null, entry:null, delivered:0, elapsed:0, events:[], reason:'', profileConfirmed:null, acknowledged:false }; }
function event(state, type, detail) { return { ...state, events:[...state.events, { sequence:state.events.length+1, at:new Date().toISOString(), simulatedSeconds:state.elapsed, type, detail }] }; }
export function transition(state, action) {
  if (action.type === 'review' && ['editing','ready','soft','blocked'].includes(state.status)) {
    const result = evaluate(action.entry, action.program);
    return event({ ...state, result, entry:{...action.entry}, program:{...action.program}, reason:'', status: result.kind === 'ok' ? 'ready' : result.kind === 'soft' ? 'soft' : 'blocked' }, 'Review', result.message);
  }
  if (action.type === 'edit' && ['editing','ready','soft','blocked'].includes(state.status)) return { ...state, status:'editing', result:null, reason:'', entry:null, program:null, acknowledged:false };
  if (action.type === 'override' && state.status === 'soft' && action.reason?.trim().length >= 10) return event({ ...state, status:'ready', reason:action.reason.trim() }, 'Soft-limit override', action.reason.trim());
  // CF-05: a deliberate profile confirmation is recorded separately from whatever profile
  // happened to be displayed by default. A default is never treated as a confirmation.
  if (action.type === 'confirmProfile' && typeof action.area === 'string' && action.area.trim() && ['editing','ready','soft','blocked'].includes(state.status)) {
    return event({ ...state, profileConfirmed:action.area.trim() }, 'Profile confirmed', `Care profile ${action.area.trim()} was deliberately confirmed.`);
  }
  // CF-05: the pre-start order check is an explicit, recorded acknowledgement, not a rendered box.
  if (action.type === 'acknowledgeOrder' && ['editing','ready','soft','blocked'].includes(state.status)) {
    const acknowledged = action.acknowledged !== false;
    return acknowledged === state.acknowledged ? { ...state, acknowledged } : event({ ...state, acknowledged }, acknowledged ? 'Order check acknowledged' : 'Order check withdrawn', acknowledged ? 'Learner recorded a pre-start dose/rate/volume check. Self-reported; not an independent double check.' : 'Programming changed after the order check; the acknowledgement was cleared.');
  }
  if (action.type === 'start' && state.status === 'ready') {
    if (action.mode === 'assessment' && !state.acknowledged) return event(state, 'Start blocked', 'The pre-start order check was not acknowledged. Verify dose, rate and volume against the order, then start.');
    if (action.mode === 'assessment' && state.profileConfirmed !== state.entry?.area) return event(state, 'Start blocked', `The care profile was not deliberately confirmed for ${state.entry?.area ?? 'this entry'}. Confirm the profile before starting.`);
    return event({ ...state, status:'running' }, 'Started', `${state.entry.name}: ${state.program.dose} ${state.entry.doseUnit}; ${displayRate(state.result.rate)} mL/h; VTBI ${state.program.vtbi} mL.`);
  }
  if (action.type === 'pause' && state.status === 'running') return event({ ...state, status:'paused' }, 'Paused', 'Simulated delivery stopped.');
  if (action.type === 'resume' && state.status === 'paused') return event({ ...state, status:'running' }, 'Resumed', 'Continuing the confirmed program.');
  if (action.type === 'alarm' && state.status === 'running') return event({ ...state, status:'alarm' }, 'Occlusion', 'Simulated downstream occlusion. Delivery stopped.');
  if (action.type === 'resolve' && state.status === 'alarm') return event({ ...state, status:'paused' }, 'Alarm resolved', 'Simulated obstruction cleared; explicit resume required.');
  if (action.type === 'tick' && state.status === 'running' && Number.isFinite(action.seconds) && action.seconds > 0) {
    const remaining = Number(state.program.vtbi) - state.delivered;
    const seconds = Math.min(action.seconds, remaining / state.result.rate * 3600);
    const delivered = Math.min(Number(state.program.vtbi), state.delivered + state.result.rate * seconds / 3600);
    const next = { ...state, delivered, elapsed:state.elapsed+seconds };
    if (Number(state.program.vtbi) - delivered < 1e-9) return event({ ...next, status:'complete', delivered:Number(state.program.vtbi) }, 'Completed', 'VTBI reached. This prototype stops delivery; KVO is not simulated.');
    return next;
  }
  return state;
}
