import { csvRecords } from './csv.js?v=0.7';
import { UNITS, number, validateLibrary } from './engine.js?v=0.7';

const canonical=s=>({'unit':'units','milliunit':'milliunits','g':'gram'}[s]||s);
const MASS={gram:1e9,mg:1e6,mcg:1e3,nanogram:1};
const ACTIVITY={units:1,milliunits:0.001};
export function unitFactor(from,to){
  from=canonical(from);to=canonical(to);
  if(from===to)return 1;
  for(const table of [MASS,ACTIVITY])if(table[from]&&table[to])return table[from]/table[to];
  throw new Error(`No defined conversion from ${from} to ${to}`);
}
const doseUnit=s=>s.replace(/^(unit|milliunit|g)(?=\/)/,canonical);
const clean=s=>s.replace(/\s+/g,' ').trim();
const count=(rows,key)=>Object.fromEntries([...rows.reduce((m,r)=>m.set(r[key]||'(blank)',(m.get(r[key]||'(blank)')||0)+1),new Map())]);
export const isWorkplaceCSV=text=>/^\uFEFF?ListSchema=/.test(text)||/^\uFEFF?"Drug Name","ID"/.test(text);

// An institution export is a catalog first, and a programmable subset second.
// No clinical values or institutional names are hardcoded in this adapter.
export function interpretWorkplaceCSV(text,{fileName='Drug Library.csv',sha256=''}={}) {
  const {headers,records}=csvRecords(text);
  for(const key of ['ID','Drug Name','Profile','Drug Type','Dosing Units','Module Availability','Drug Amount','Drug Amount Units','Diluent Volume','Diluent Volume Units','Final Concentration','Final Concentration Units','Dose Limits Soft Min','Dose Limits Soft Max','Dose Limits Hard Max','Rate Units','Rate Limits (mL/h)    Soft Min','Rate Limits (mL/h) Soft Max','Rate Limits (mL/h) Hard Max','Conc. Limit Units','Conc. Limits Hard Min','Conc. Limits Soft Min','Conc. Limits Soft Max'])if(!headers.includes(key))throw new Error(`Workplace export is missing column: ${key}`);
  if(records.length<1||records.length>10000)throw new Error('Expected 1–10,000 source records.');
  const ids=new Set(),entries=[],catalog=[];
  for(const [i,raw] of records.entries()) {
    const r=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,clean(v)]));
    if(!r.ID||ids.has(r.ID))throw new Error(`Missing or duplicate source ID at data record ${i+1}.`);
    ids.add(r.ID);
    const reasons=[],notes=[],id=`workplace-${r.ID}`,fluid=r['Drug Type']==='Fluids';
    const item={id,name:r['Drug Name'],area:r.Profile,therapy:r.Therapy||'',drugType:r['Drug Type'],module:r['Module Availability'],sourceId:r.ID,record:i+1,raw,reasons,notes};
    if(!item.name||!item.area)reasons.push('Missing drug name or profile');
    if(/no drugs exist/i.test(item.name))reasons.push('Placeholder section row, not a medication');
    if(!['Fluids','Continuous/Bolus Non-Anesthesia Drugs'].includes(item.drugType))reasons.push(item.drugType==='Intermittent Drugs'?'Intermittent dose/duration workflow not implemented':item.drugType==='PCA Drugs'?'PCA workflow not implemented':'Anesthesia workflow not implemented');
    if(!['Pump','Pump and Syringe'].includes(item.module))reasons.push(item.module==='Syringe'?'Syringe-only entry':'Pump availability not established');
    if(r['Available As']==='Secondary Only')reasons.push('Secondary-only entry');
    const unit=fluid?r['Rate Units']:doseUnit(r['Dosing Units']);
    if(!UNITS[unit])reasons.push(`Unsupported programming unit: ${unit||'not supplied'}`);
    const limit=(column)=>{const v=r[column];if(!v)return null;const n=number(v);if(!Number.isFinite(n)||n<0){reasons.push(`Invalid or ambiguous ${column}: ${v}`);return null;}return n;};
    const softMin=limit(fluid?'Rate Limits (mL/h)    Soft Min':'Dose Limits Soft Min');
    const softMax=limit(fluid?'Rate Limits (mL/h) Soft Max':'Dose Limits Soft Max');
    const hardMax=limit(fluid?'Rate Limits (mL/h) Hard Max':'Dose Limits Hard Max');
    const present=[softMin,softMax,hardMax].filter(n=>n!==null);
    if(!present.length)reasons.push('No usable programming limits supplied');
    if(present.some((n,j)=>j&&n<present[j-1])||hardMax===0)reasons.push('Inconsistent limit ordering');
    let concentration=fluid?1:null,amountUnit=UNITS[unit]?.amount||'',preparation='',concentrationLabel='',conversion=null;
    if(!fluid){
      const amount=number(r['Drug Amount']),volume=number(r['Diluent Volume']),final=number(r['Final Concentration']);
      const fixed=amount>0&&volume>0;
      if(!fixed)reasons.push('Variable or incomplete concentration requires unsupported setup');
      if(r['Diluent Volume Units']!=='mL')reasons.push('Unsupported diluent volume unit');
      const concMatch=/^([^/]+)\/mL$/.exec(r['Final Concentration Units']);
      if(!concMatch)reasons.push('Missing or unsupported concentration unit');
      if(fixed&&concMatch&&UNITS[unit])try{
        const derived=amount/volume*unitFactor(r['Drug Amount Units'],concMatch[1]);
        if(r['Final Concentration']&&!(final>0))throw new Error('Invalid final concentration');
        const original=r['Final Concentration']?final:derived;
        if(r['Final Concentration']&&Math.abs(final-derived)>Math.max(1e-9,Math.abs(derived)*1e-8))throw new Error('Final concentration disagrees with drug amount / diluent volume');
        const factor=unitFactor(concMatch[1],amountUnit);
        concentration=original*factor;
        preparation=`${r['Drug Amount']} ${r['Drug Amount Units']} / ${r['Diluent Volume']} mL`;
        concentrationLabel=`${original} ${r['Final Concentration Units']}`;
        conversion={fromUnit:concMatch[1],toUnit:amountUnit,factor,sourceConcentration:original,normalizedConcentration:concentration,derived:!r['Final Concentration']};
        if(factor!==1)notes.push(`Explicit concentration conversion: ×${factor} ${concMatch[1]} → ${amountUnit}`);
        if(!r['Final Concentration'])notes.push('Concentration derived from exported amount and volume');
      }catch(error){reasons.push(error.message);}
      if(['Conc. Limits Hard Min','Conc. Limits Soft Min','Conc. Limits Soft Max'].some(k=>r[k]))reasons.push('Concentration-limit workflow not implemented');
    }
    const source={fileName,sha256,id:r.ID,record:i+1,modified:r.Modified||null,created:r.Created||null,conversion};
    const entry={id,area:item.area,name:item.name,therapy:item.therapy,drugType:item.drugType,module:item.module,concentration,amountUnit,doseUnit:unit,hardMin:null,softMin,softMax,hardMax,preparation,concentrationLabel,advisory:r['Clinical Advisory']||'',source,limitNotice:'Only supplied limits are checked. Blank source limits are unknown, not zero or confirmed disabled. Training only.'};
    if(!reasons.length){entries.push(entry);item.entry=entry;}
    item.supported=!reasons.length;
    catalog.push(item);
  }
  const modified=records.map(r=>r.Modified).filter(v=>/^\d{4}-\d{2}-\d{2}T/.test(v||'')).sort();
  const analysis={total:catalog.length,programmable:entries.length,browseOnly:catalog.length-entries.length,profiles:count(catalog,'area'),types:count(catalog,'drugType'),byProfile:Object.fromEntries([...new Set(catalog.map(r=>r.area))].map(area=>[area,{total:catalog.filter(r=>r.area===area).length,programmable:entries.filter(e=>e.area===area).length}])),reasonCounts:count(catalog.flatMap(r=>r.reasons.map(reason=>({reason}))),'reason'),blankSoftMax:entries.filter(e=>e.softMax===null).length,blankHardMax:entries.filter(e=>e.hardMax===null).length,conversions:entries.filter(e=>e.source.conversion?.factor!==1&&e.source.conversion).length,sourceModifiedRange:modified.length?[modified[0],modified.at(-1)]:null};
  const library={schemaVersion:2,name:'Workplace library · training snapshot',version:sha256?`snapshot-${sha256.slice(0,12)}`:'local-snapshot',effectiveDate:null,source:{fileName,sha256,format:'SharePoint CSV export',rowCount:records.length,columnCount:headers.length,lastRecordModified:modified.at(-1)||null,approval:'Not established by export'},entries,catalog,analysis};
  if(!entries.length)throw new Error(`All ${catalog.length} entries require unsupported workflows or data review. Nothing can be programmed.`);
  const checked=validateLibrary(library);
  if(checked.errors.length)throw new Error(checked.errors.join('\n'));
  return checked.library;
}
