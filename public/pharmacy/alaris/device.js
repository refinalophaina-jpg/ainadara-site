import { UNITS, evaluate, softRange, limitText } from './engine.js';
import { displayRate, displayModuleRate, capabilityRows, DEVICE_CAPABILITY_MODEL } from './device-profile.js';
import { createAudio } from './audio.js';

// The device is another view of the SAME engine, library and attempt as the worksheet.
// Reference: BD 8015 v12.1 manual, pp. 23–24, 40, 47, 53, 57, 91–96, 325.
// Generic training UI, not manufacturer firmware. See sources/alaris-8015-research.md.
export function mountDevice(host, api) {
  host.innerHTML = `
    <div class="device-stage">
      <div class="device-assembly" tabindex="0" aria-label="Pump controls. Use the side buttons and numeric keypad.">
        <section class="channel-module" aria-label="Channel A pump module">
          <div class="module-lamp" id="module-lamp"><span>INFUSING</span><span>ALARM</span></div>
          <div class="module-title">Infusion module <small>SIMULATION</small></div>
          <div class="module-readout"><output id="module-rate">—</output><span>RATE (mL/h)</span><strong id="module-status">STANDBY</strong></div>
          <span class="channel-letter">A</span>
          <button id="channel-select" class="hardware-key channel-select">Channel<br>Select</button>
          <button id="module-pause" class="hardware-key">Pause</button>
          <button class="hardware-key" disabled title="Channel power-off is not simulated">Channel<br>Off</button>
          <button id="module-restart" class="hardware-key">Restart</button>
          <div class="module-latch" aria-hidden="true"></div>
          <small class="module-foot">Channel A<br>Primary infusion</small>
        </section>
        <section class="pcu" aria-label="Patient care unit simulator">
          <div class="pcu-brand"><span>INFUSION <strong>SYSTEM</strong></span><small>SIMULATION</small></div>
          <div class="pcu-display">
            <div class="softkeys left-keys" aria-label="Left screen keys"></div>
            <div class="lcd" aria-label="Pump LCD">
              <div class="lcd-header"><span id="lcd-library"></span><strong id="lcd-title" aria-live="polite">Channel overview</strong></div>
              <div id="lcd-rows" class="lcd-rows"></div>
              <div id="lcd-footer" class="lcd-footer"></div>
              <div id="lcd-bottom-labels" class="lcd-bottom-labels"></div>
            </div>
            <div class="softkeys right-keys" aria-label="Right screen keys"></div>
          </div>
          <div class="bottom-keys" aria-label="Bottom screen keys"></div>
          <div class="pcu-lower">
            <div class="pcu-utilities"><button id="pcu-silence" class="hardware-key silence" title="Acknowledge the visual alert and stop the repeating training tone.">Silence</button><button id="pcu-options" class="hardware-key">Options</button><div class="power-light" aria-hidden="true"></div><span class="ac-label">AC power<br>Simulated</span></div>
            <div class="keypad" aria-label="Numeric keypad"></div>
            <div class="pcu-utilities"><span class="ac-label">System<br>on</span><button id="pcu-power" class="hardware-key power-key" aria-label="System on">⏻</button><span class="ac-label">EDUCATION<br>ONLY</span></div>
          </div>
        </section>
      </div>
      <div class="device-simulation-tools"><span id="device-clock">Simulated time 00:00:00</span><button id="device-startup" class="secondary">Rehearse startup</button><button id="device-advance" class="secondary">Advance 1 minute</button><button id="device-alarm" class="secondary">Introduce occlusion</button><button id="device-audio" class="secondary" aria-pressed="false">Sound off</button></div>
      <p class="device-caption">Original generic fascia, proportioned after the user-identified reference pair: a control unit with a 5.7-inch colour display and a large-volume pump module mounted left as channel A. Press the physical keys beside or below the screen. Channel A only · synthesized training tones, not manufacturer alarm signals · no clinical use. Reference workflow: v12.1; your pump’s firmware and configuration are not verified. Startup rehearsal is optional.</p>
    </div>
    <dialog id="device-override-dialog" aria-labelledby="device-override-title"><form method="dialog" class="dialog-top"><p class="eyebrow">Training annotation</p><button class="quiet" aria-label="Close override reason">✕</button></form><h2 id="device-override-title">Record your override reason</h2><p>This debrief annotation is part of the trainer, not a reproduced pump screen.</p><label for="device-override-reason">Why proceed in this exercise?</label><textarea id="device-override-reason" rows="3" maxlength="500"></textarea><button id="device-override-submit" class="primary" disabled>Confirm training override</button></dialog>`;
  const $ = id => host.querySelector(`#${id}`);
  const node = (tag,text,cls) => {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const put = (id,text) => {const e=$(id);if(e.textContent !== String(text))e.textContent=text;};
  let view='overview', page=0, field='dose', buffer='', previous='program', silenced=false, lastAlarm=-1;
  let pendingArea='', libraryKind='drugs', alphabet='', profileReturn='overview';
  const audio=createAudio(); let lastStatus=null, lastEventCount=0;
  const left=[], right=[], bottomKeys=[];
  for (let i=0;i<5;i++) {
    for (const [side,list,symbol] of [['left',left,'▶'],['right',right,'◀']]) {
      const button=node('button',symbol,'hardware-key softkey'); button.id=`pcu-${side}-${i+1}`;button.type='button';button.setAttribute('aria-label',`${side} screen key ${i+1}`);
      host.querySelector(`.${side}-keys`).append(button);list.push(button);
    }
  }
  for(let i=0;i<4;i++){
    const button=node('button','▲','hardware-key bottom-key');button.id=`pcu-bottom-${i+1}`;button.type='button';
    host.querySelector('.bottom-keys').append(button);bottomKeys.push(button);
  }
  // Four columns, as shown on the manufacturer's front-panel product photograph.
  const keys=['1','2','3','↑','4','5','6','↓','7','8','9','Enter','Clear','0','.','Cancel'];
  const numericButtons=[];
  for(const key of keys){const button=node('button',key,`hardware-key number-key ${['Enter','Cancel','Clear','↑','↓'].includes(key)?'function-key':''}`);button.type='button';button.dataset.key=key;button.setAttribute('aria-label',key==='.'?'Decimal point':key==='↑'?'Increase value':key==='↓'?'Decrease value':key);button.addEventListener('click',()=>{audio.play(key==='Enter'?'accept':'key');key==='Cancel'?back():press(key);});host.querySelector('.keypad').append(button);numericButtons.push(button);}
  function go(next){view=next;page=0;render();}
  function editValue(key){field=key;buffer=String(api.context().program[key]||'');previous='program';go('number');host.querySelector('.device-assembly').focus({preventScroll:true});}
  function press(key){
    if(view!=='number'||!api.context().editable)return;
    if(key==='Enter'){
      if(buffer==='.'||buffer==='')return;
      if(buffer.endsWith('.'))buffer=buffer.slice(0,-1);
      api.setField(field,buffer);go(previous);return;
    }
    if(key==='Clear')buffer='0';
    else if(key==='⌫')buffer=buffer.slice(0,-1);
    else if(key==='↑'||key==='↓'){
      // Trainer increment: one unit at the displayed decimal precision, not a device resolution table.
      const places=Math.min(6,buffer.split('.')[1]?.length||0),step=10**-places;
      buffer=Math.max(0,Number(buffer||0)+(key==='↑'?step:-step)).toFixed(places);
    }
    else if(key==='.'&&!buffer.includes('.'))buffer=buffer?buffer+'.':'0.';
    else if(/^\d$/.test(key)&&buffer.length<12)buffer=buffer==='0'?key:buffer+key;
    render();
  }
  function back(){
    if(view==='number')go('program');
    else if(view==='medications')go('infusionmenu');
    else if(view==='concentration')go('medications');
    else if(view==='advisory')go('concentration');
    else if(view==='profiles')go(profileReturn);
    else if(['options','volume','infusionmenu','dataset','software','capability','audio','profileconfirm','newpatient'].includes(view))go('overview');
    else if(view==='standby')return;
    else if(api.context().editable){api.dispatch({type:'edit'});go('program');}
    else go('overview');
  }
  function review(){api.review();go('review');}
  function setup(){const c=api.context();go(c.editable?(c.state.status==='ready'?'review':'infusionmenu'):'status');}
  $('channel-select').addEventListener('click',setup);
  $('module-pause').addEventListener('click',()=>{api.dispatch({type:'pause'});go('status');});
  $('module-restart').addEventListener('click',()=>{api.dispatch({type:'resume'});go('status');});
  $('pcu-power').addEventListener('click',()=>{if(view==='standby')go('newpatient');});
  $('device-startup').addEventListener('click',()=>{if(api.context().editable){api.dispatch({type:'edit'});go('standby');}});
  $('pcu-options').addEventListener('click',()=>go('options'));
  $('pcu-silence').addEventListener('click',()=>{silenced=true;audio.stopLoops();render();});
  $('device-advance').addEventListener('click',api.advance);
  $('device-alarm').addEventListener('click',()=>{api.alarm();go('status');});
  $('device-audio').addEventListener('click',()=>{const on=audio.toggle();$('device-audio').textContent=on?'Sound on':'Sound off';$('device-audio').setAttribute('aria-pressed',String(on));if(!on)audio.stopLoops();});
  $('device-override-reason').addEventListener('input',()=>{$('device-override-submit').disabled=$('device-override-reason').value.trim().length<10;});
  $('device-override-submit').addEventListener('click',()=>{
    api.dispatch({type:'override',reason:$('device-override-reason').value});
    if(api.context().state.status==='ready'){$('device-override-dialog').close();go('review');}
  });
  host.querySelector('.device-assembly').addEventListener('keydown',event=>{
    if(view!=='number'||event.altKey||event.ctrlKey||event.metaKey)return;
    // Enter on a focused physical button must activate that button normally.
    if(event.key==='Enter'&&event.target.tagName==='BUTTON')return;
    if(/^\d$/.test(event.key)||event.key==='.'||event.key==='Backspace'||event.key==='Enter'||event.key==='Delete'){
      event.preventDefault();press(event.key==='Backspace'?'⌫':event.key==='Delete'?'Clear':event.key);
    }else if(event.key==='Escape'){event.preventDefault();back();}
  });
  function render(){
    const c=api.context(), {state:s,entry:e,program:p}=c;
    const result=s.result||evaluate(e,p), active=['running','paused','alarm','complete'].includes(s.status);
    if(active&&['standby','newpatient','profileconfirm','profiles','infusionmenu','medications','concentration','advisory','number','program','review'].includes(view))view='status';
    const alarmEvent=s.events.filter(x=>x.type==='Occlusion').at(-1)?.sequence??-1;
    if(alarmEvent!==lastAlarm){lastAlarm=alarmEvent;silenced=false;}
    const rows=[],bottom=[];
    const row=(label,value='',l=null,r=null,rlabel='')=>rows.push({label,value,l,r,rlabel});
    const action=(slot,label,run)=>{bottom[slot-1]={label,run};};
    const chooseKind=kind=>{libraryKind=kind;alphabet='';go('medications');};
    let title='',footer='';
    const remaining=s.program?Math.max(0,Number(s.program.vtbi)-s.delivered):0;
    if(view==='standby'){
      title='STANDBY';footer='>Press SYSTEM ON to rehearse startup';
      row('Simulation standby','No delivery is taking place');
    }else if(view==='newpatient'){
      title='NEW PATIENT?';
      row('New simulated patient?');
      row('Yes','Clear this practice attempt',()=>{api.newPatient();go('profileconfirm');});
      row('No','Keep current practice values',()=>go('profileconfirm'));
      footer='>Select Yes or No';
    }else if(view==='profileconfirm'){
      title='CONFIRM PROFILE';row(`${e.area}?`);
      row('Yes','Use this profile',()=>{api.dispatch({type:'confirmProfile',area:e.area});go('overview');});
      row('No','Choose another profile',()=>{pendingArea=e.area;profileReturn='profileconfirm';go('profiles');});
      footer='>Select Yes or No';
    }else if(s.status==='alarm'){
      title='A   DOWNSTREAM OCCLUSION';
      row('Infusion stopped','Check downstream line');
      row('Line check',c.lineChecked?'ACKNOWLEDGED':'Select after simulated check',()=>api.checkLine());
      row('Alarm',silenced?'VISUAL ALERT ACKNOWLEDGED':'Press Silence to acknowledge');
      row('Clear simulated obstruction','',null,c.lineChecked?()=>{api.dispatch({type:'resolve'});go('status');}:null,'CLEAR');
      row('Delivery',`${api.format(s.delivered)} mL infused`);
      footer='Training alarm. Clearing leaves channel paused; press Restart to resume.';
    }else if(s.status==='blocked'||s.status==='soft'){
      title=s.status==='soft'?'A   SOFT LIMIT ALERT':'A   PROGRAM BLOCKED';
      row(e.name,`${p.dose||'—'} ${e.doseUnit}`);
      row('Soft range',`${softRange(e)} ${e.doseUnit}`);
      row('Hard limits',`${limitText(e.hardMin)}–${limitText(e.hardMax)} ${e.doseUnit}`);
      row('Reprogram','',()=>{api.dispatch({type:'edit'});go('program');});
      if(s.status==='soft')row('Review override','',null,()=>{$('device-override-reason').value='';$('device-override-submit').disabled=true;$('device-override-dialog').showModal();},'OVERRIDE');
      else row('Cannot start','Correct the program');
      footer=s.result.message;
    }else if(view==='profiles'){
      title='PROFILES';
      const areas=[...new Set(c.library.entries.map(x=>x.area))];
      areas.slice(page*5,page*5+5).forEach(area=>{row(area,'',()=>{pendingArea=area;render();});rows.at(-1).selected=area===pendingArea;});
      action(1,'CONFIRM',pendingArea?()=>{api.selectArea(pendingArea);api.dispatch({type:'confirmProfile',area:pendingArea});go('overview');}:null);
      action(2,'CANCEL',back);
      action(3,'PAGE UP',page?()=>{page--;render();}:null);
      action(4,'PAGE DOWN',(page+1)*5<areas.length?()=>{page++;render();}:null);
      footer=`>Select profile, then CONFIRM · ${page+1} / ${Math.ceil(areas.length/5)}`;
    }else if(view==='infusionmenu'){
      title='A   INFUSION MENU';
      row('Library Drugs','',()=>chooseKind('drugs'));
      row('Library IV Fluids','',()=>chooseKind('fluids'));
      row('Basic Infusion','Not simulated');rows.at(-1).inactive=true;
      action(1,'EXIT',()=>go('overview'));
      footer='>Select an infusion type';
    }else if(view==='medications'){
      title=libraryKind==='drugs'?'A   LIBRARY DRUGS':'A   LIBRARY IV FLUIDS';
      const groups=['A-E','F-J','K-O','P-T','U-Z'];
      const initial=x=>x.name.replace(/^[^a-z]+/i,'')[0]?.toUpperCase()||'';
      const entries=c.library.entries.filter(x=>x.area===e.area&&(libraryKind==='fluids')===(x.doseUnit==='mL/h')&&(!alphabet||(initial(x)>=alphabet[0]&&initial(x)<=alphabet[2]))).sort((a,b)=>a.name.localeCompare(b.name));
      entries.slice(page*5,page*5+5).forEach(item=>row(item.name,[item.therapy,item.preparation||(item.doseUnit==='mL/h'?'':`${item.concentration} ${item.amountUnit}/mL`),item.doseUnit].filter(Boolean).join(' · '),()=>{api.selectEntry(item.id);go('concentration');}));
      if(!entries.length)row('No entries in this selection');
      while(rows.length<5)row('');
      groups.forEach((group,i)=>{rows[i].r=()=>{alphabet=alphabet===group?'':group;page=0;render();};rows[i].rlabel=group;});
      action(1,'EXIT',()=>go('infusionmenu'));action(2,'ALL',()=>{alphabet='';page=0;render();});
      action(3,'PAGE UP',page?()=>{page--;render();}:null);action(4,'PAGE DOWN',(page+1)*5<entries.length?()=>{page++;render();}:null);
      footer=`>Select entry · ${alphabet||'All letters'} · ${page+1} / ${Math.max(1,Math.ceil(entries.length/5))}`;
    }else if(view==='concentration'){
      title='A   CONFIRM LIBRARY ENTRY';
      row(e.name,e.therapy||e.area);
      row('Concentration',e.doseUnit==='mL/h'?'Volumetric fluid':`${e.preparation?e.preparation+' · ':''}${e.concentrationLabel||`${e.concentration} ${e.amountUnit}/mL`}`);
      row('Dose / rate unit',e.doseUnit);
      row('Soft range',softRange(e));
      row('Yes','Continue with this entry',()=>go(e.advisory?'advisory':'program'),()=>go('medications'),'NO');
      action(1,'EXIT',()=>go('infusionmenu'));
      footer='>Is this the correct library entry?';
    }else if(view==='advisory'){
      title='A   EXPORTED ADVISORY';row(e.name,e.therapy||'');row(e.advisory);row('Source text / code','Full policy is not included');row('Source record',e.source?.id||'');
      action(1,'BACK',()=>go('concentration'));action(4,'CONFIRM',()=>go('program'));footer='>Read exported advisory before continuing';
    }else if(view==='program'||view==='number'){
      title='A   PRIMARY INFUSION';
      const value=key=>view==='number'&&field===key?`${buffer||'0'}_`:p[key]||'____';
      row(e.doseUnit==='mL/h'?'RATE':'DOSE',`${value('dose')} ${e.doseUnit}`,()=>editValue('dose'));rows.at(-1).selected=view==='number'&&field==='dose';
      row('VTBI',`${value('vtbi')} mL`,()=>editValue('vtbi'));rows.at(-1).selected=view==='number'&&field==='vtbi';
      if(UNITS[e.doseUnit].weight){row('PATIENT WEIGHT',`${value('weight')} kg`,()=>editValue('weight'));rows.at(-1).selected=view==='number'&&field==='weight';}
      else row('Library concentration',e.doseUnit==='mL/h'?'Volumetric':`${e.concentration} ${e.amountUnit}/mL`);
      row('Calculated rate',`${displayRate(result.rate)} mL/h`);
      row(e.name,e.therapy||'');
      action(1,'LIBRARY',()=>go('medications'));
      action(4,view==='number'?'ENTER':'REVIEW',view==='number'?()=>press('Enter'):review);
      footer=view==='number'?'>Enter value · ENTER accepts · CANCEL discards':'>Select a parameter · REVIEW is a trainer checkpoint';
    }else if(view==='review'&&s.status==='ready'){
      title='A   CONFIRM PROGRAM';
      row(e.name,`${p.dose} ${e.doseUnit}`);
      row('Flow rate',`${displayRate(s.result.rate)} mL/h`);
      row('VTBI',`${p.vtbi} mL`);
      row('Check against order','Learner acknowledgment',()=>api.checkOrder());
      action(1,'EDIT',()=>{api.dispatch({type:'edit'});go('program');});
      action(4,'START',c.setupComplete?()=>{api.dispatch({type:'start',mode:c.mode});api.context().state.status==='running'?go('status'):render();}:null);
      const refused=s.events.at(-1)?.type==='Start blocked'?s.events.at(-1).detail:'';
      footer=!c.setupComplete?'Complete the setup scene before START':refused?`>${refused}`:s.reason?'Soft-limit override recorded. Confirm the program before starting.':'Compare every parameter with the exercise order, then press Start.';
    }else if(view==='options'){
      title=`SYSTEM OPTIONS ${page+1} OF 2`;
      if(page===0){
        row('Volume Infused','',()=>go('volume'));
        row('Profile selection',c.editable?'Trainer shortcut':'Locked during an attempt',c.editable?()=>{api.dispatch({type:'edit'});pendingArea=e.area;profileReturn='options';go('profiles');}:null);
        row('Audio','Optional synthesized training tones',()=>go('audio'));
      }else{
        row('Software Versions','',()=>go('software'));
        row('Data Set Status','',()=>go('dataset'));
        row('Device Limits','Capability model',()=>go('capability'));
      }
      action(1,'EXIT',()=>go('overview'));action(4,page?'PAGE UP':'PAGE DOWN',()=>{page=page?0:1;render();});
      footer='>Select an option · shortened training menu';
    }else if(view==='dataset'){
      title='DATA SET STATUS';row('Active training data set',c.library.name);row('Version',c.library.version);row('Effective date',c.library.effectiveDate||'Not supplied');row('Profile',e.area);row('Source',c.imported?'Local import · unvalidated':'Fictional demo library');
      action(1,'EXIT',()=>go('overview'));footer='>Library identity is separate from device firmware';
    }else if(view==='capability'){
      // Reference defaults are shown WITH their provenance so a learner cannot mistake them
      // for this institution's configured settings (CF-01/CF-04).
      title='DEVICE LIMITS';
      for(const [name,value,provenance] of capabilityRows())row(name,`${value} · ${provenance}`);
      action(1,'EXIT',()=>go('options'));
      footer=`>${DEVICE_CAPABILITY_MODEL.institutionVerified?'Institution verified':'No — reference defaults, not this institution\u2019s configuration'} · model ${DEVICE_CAPABILITY_MODEL.modelVersion} · separate from the drug library`;
    }else if(view==='software'){
      title='SOFTWARE VERSIONS';row('Simulator','AinaDara prototype 0.4');row('Reference workflow','8015 user manual · v12.1');row('Your pump firmware','Not verified');row('No device connection','No firmware is installed here');
      action(1,'EXIT',()=>go('overview'));footer='>Training implementation · not manufacturer software';
    }else if(view==='audio'){
      title='AUDIO';
      row(audio.enabled?'Training tones on':'Training tones off',audio.supported?'Toggle':'Not available in this browser',audio.supported?()=>{audio.toggle();$('device-audio').textContent=audio.enabled?'Sound on':'Sound off';$('device-audio').setAttribute('aria-pressed',String(audio.enabled));render();}:null);
      row('Synthesized only','Original tones, not manufacturer alarm signals');
      row('No clinical meaning','Pitch and rhythm do not encode priority');
      row('Silence control','Stops the repeating tone; visual alarm remains acknowledged');
      action(1,'EXIT',()=>go('overview'));footer='>Audio and silence timing are not simulated';
    }else if(view==='volume'){
      title='VOLUME INFUSED';
      row('Channel A',`${api.format(s.delivered)} mL`);
      row('Remaining',active?`${api.format(remaining)} mL`:'Not started');
      row('Simulated time',api.time(s.elapsed));
      row('Delivery',s.status.toUpperCase());
      action(1,'EXIT',()=>go('overview'));
      footer='Volume is cumulative within this practice attempt. Reset starts a new attempt.';
    }else if(view==='status'&&active){
      title=`A   ${s.status==='running'?'INFUSING':s.status.toUpperCase()}`;
      row(e.name,`${s.program.dose} ${e.doseUnit}`);
      row('Rate',`${displayRate(s.result.rate)} mL/h`);
      row('VTBI remaining',`${api.format(remaining)} mL`);
      row('Volume infused',`${api.format(s.delivered)} mL`);
      action(1,'EXIT',()=>go('overview'));action(4,s.status==='running'?'PAUSE':'RESTART',s.status==='running'?()=>api.dispatch({type:'pause'}):s.status==='paused'?()=>api.dispatch({type:'resume'}):null);
      footer=s.status==='complete'?'VTBI complete. Delivery stopped; KVO is not simulated.':`${s.status==='running'?'Infusing':'Paused'} · time remaining ${api.time(remaining/s.result.rate*3600)}`;
    }else{
      title=e.area;
      row('A',active?`${e.name} · ${s.status.toUpperCase()}`:s.status==='ready'?`${e.name} · READY`:'Select channel to program',setup);rows[0].channel=true;
      row(active?`${s.program.dose} ${e.doseUnit}`:'Primary infusion',active?`${displayRate(s.result.rate)} mL/h`:'Library-based programming');
      row('B','Not connected');rows[2].inactive=true;
      row('C','Not connected');rows[3].inactive=true;
      action(1,'VOLUME INFUSED',()=>go('volume'));action(3,'AUDIO ADJUST',()=>go('audio'));
      footer='>Select channel · AC power (simulated)';
    }
    put('lcd-title',title);put('lcd-library',view==='overview'?c.library.name:`${c.library.version} · ${e.area}`);put('lcd-footer',footer);
    host.querySelector('.lcd').dataset.tone=s.status==='alarm'?'alarm':['soft','blocked'].includes(s.status)?'warning':'normal';
    host.querySelector('.lcd').dataset.view=view;
    $('lcd-bottom-labels').replaceChildren(...Array.from({length:4},(_,i)=>{
      const item=bottom[i],label=node('span',item?.label||'');
      label.className=item?.run?'available':'';bottomKeys[i].disabled=!item?.run;bottomKeys[i].onclick=item?.run||null;
      bottomKeys[i].setAttribute('aria-label',item?.label||`Unused bottom key ${i+1}`);return label;
    }));
    const displayRows=rows.slice(0,5);
    while(displayRows.length<5)displayRows.push({label:'',value:''});
    $('lcd-rows').replaceChildren(...displayRows.map((item,i)=>{
      const el=node('div',undefined,`lcd-row${item.selected?' selected-row':''}${item.inactive?' inactive-row':''}${item.channel?' channel-row':''}`);
      el.append(node('strong',item.label),node('span',item.value));
      if(item.r)el.append(node('b',item.rlabel,'lcd-right-label'));
      left[i].disabled=!item.l;left[i].onclick=item.l||null;left[i].setAttribute('aria-label',item.l?item.label:`Unused left key ${i+1}`);
      right[i].disabled=!item.r;right[i].onclick=item.r||null;right[i].setAttribute('aria-label',item.r?item.rlabel:`Unused right key ${i+1}`);
      return el;
    }));
    const rate=s.result?.rate;
    // The module LED is intentionally less precise than the PC-unit display. This is display
    // rounding only; the engine integrates the more precise delivered rate shown on the PC unit.
    put('module-rate',active?displayModuleRate(rate):'—');
    put('module-status',s.status==='running'?'INFUSING':s.status==='alarm'?'OCCLUSION':s.status==='paused'?'PAUSED':s.status==='complete'?'COMPLETE':'STANDBY');
    $('module-lamp').dataset.state=s.status;
    // Tones follow engine state changes only, so sound can never disagree with the display.
    if(s.status!==lastStatus){
      if(s.status==='alarm')audio.loop('alarm',1800);
      else audio.stopLoops();
      if(s.status==='running'&&['ready','soft','paused'].includes(lastStatus))audio.play('start');
      else if(s.status==='soft')audio.play('soft');
      else if(s.status==='blocked')audio.play('blocked');
      else if(s.status==='complete')audio.play('complete');
      lastStatus=s.status;
    }
    // A refused start is audibly distinct from a successful one.
    if(s.events.length!==lastEventCount){
      if(s.events.at(-1)?.type==='Start blocked')audio.play('reject');
      lastEventCount=s.events.length;
    }
    $('module-lamp').classList.toggle('acknowledged',silenced);
    $('module-pause').disabled=s.status!=='running';$('module-restart').disabled=s.status!=='paused';
    $('pcu-silence').disabled=s.status!=='alarm';
    $('device-advance').disabled=s.status!=='running';$('device-alarm').disabled=s.status!=='running';
    $('device-startup').disabled=!c.editable;
    $('channel-select').disabled=['standby','newpatient','profileconfirm','profiles'].includes(view);
    $('pcu-options').disabled=['standby','newpatient','profileconfirm','profiles'].includes(view);
    $('pcu-power').disabled=view!=='standby';
    numericButtons.forEach(button=>button.disabled=button.dataset.key==='Cancel'?['standby','overview'].includes(view):view!=='number'||!c.editable);
    put('device-clock',`Simulated time ${api.time(s.elapsed)}`);
  }
  return {render,reset(){view='overview';page=0;buffer='';pendingArea='';alphabet='';silenced=false;lastAlarm=-1;$('device-override-dialog').close();}};
}
