import { UNITS, evaluate, softRange, limitText } from './engine.js';
import { displayRate, displayModuleRate, capabilityRows, DEVICE_CAPABILITY_MODEL } from './device-profile.js';
import { createAudio } from './audio.js';

// The device is another view of the SAME engine, library and attempt as the worksheet.
// Reference: BD 8015 v12.1 manual, pp. 23–24, 40, 47, 53, 57, 91–96, 325.
// Generic training UI, not manufacturer firmware. See sources/alaris-8015-research.md.
export function mountDevice(host, api) {
  const moduleMarkup=channel=>{
    const legacy=channel==='A',id=name=>legacy?name:`${name}-${channel}`;
    return `<section class="channel-module" data-module-channel="${channel}" aria-label="Channel ${channel} pump module">
      <div class="module-lamp" id="${id('module-lamp')}"><span>INFUSING</span><span>ALARM</span></div>
      <div class="module-title">Pump module <small>SIMULATION</small></div>
      <div class="module-readout"><output id="${id('module-rate')}">—</output><span>RATE (mL/h)</span><strong id="${id('module-status')}">STANDBY</strong></div>
      <span class="channel-letter">${channel}</span>
      <button id="${id('channel-select')}" data-channel-select="${channel}" class="hardware-key channel-select">Channel<br>Select</button>
      <button id="${id('module-pause')}" data-channel-pause="${channel}" class="hardware-key">Pause</button>
      <button class="hardware-key" disabled title="Channel power-off is not simulated">Channel<br>Off</button>
      <button id="${id('module-restart')}" data-channel-restart="${channel}" class="hardware-key">Restart</button>
      <div class="module-latch" aria-hidden="true"><span></span></div>
      <small class="module-foot">Channel ${channel}<br>Primary infusion</small>
    </section>`;
  };
  host.innerHTML = `
    <div class="device-stage">
      <div class="device-brand-rail"><span class="device-brand-lockup"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#ede8dd" stroke="#2d3428" stroke-width="1.5"/><g stroke="#cc785c" fill="none" stroke-width="1.2" stroke-linecap="round"><circle cx="22" cy="26" r="7"/><circle cx="22" cy="26" r="4"/><circle cx="22" cy="26" r="1.5"/></g><g stroke="#4a3d7a" stroke-width="1.2" stroke-linecap="round"><line x1="44" y1="24" x2="49" y2="18"/><line x1="44" y1="24" x2="51" y2="24"/><line x1="44" y1="24" x2="49" y2="30"/><line x1="44" y1="24" x2="42" y2="32"/></g><path d="M18 42Q32 52 46 42" stroke="#4a5c28" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg><span><strong>Aina<em>Dara</em></strong><small>Simulation lab</small></span></span><span id="device-view-label" class="device-view-label">Interactive pump trainer · channel A</span></div>
      <div class="device-assembly" tabindex="0" aria-label="Pump controls. Use the side buttons and numeric keypad.">
        <div id="module-bank-left" class="module-bank module-bank-left" aria-label="Left pump modules">${['A','B'].map(moduleMarkup).join('')}</div>
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
        <div id="module-bank-right" class="module-bank module-bank-right" aria-label="Right pump modules">${['C','D'].map(moduleMarkup).join('')}</div>
      </div>
      <div class="device-simulation-tools"><span id="device-clock">Channel A · simulated time 00:00:00</span><span id="device-response" class="device-response" aria-live="polite"></span><label class="module-config">Attached modules <select id="device-module-count" aria-label="Attached pump modules"><option value="2">2 · one each side</option><option value="3" selected>3 · two left, one right</option><option value="4">4 · two each side</option></select></label><button id="device-startup" class="secondary">Rehearse startup</button><button id="device-advance" class="secondary">Advance 1 minute</button><button id="device-alarm" class="secondary">Introduce occlusion</button><button id="device-audio" class="secondary" aria-pressed="false">Sound off</button></div>
      <p class="device-caption">Original generic modular fascia for simulation. Choose two modules (one per side), three (two left and one right), or four (two per side). Every attached channel retains an independent program, delivery clock and alert. Brief screen, relay and restart response times are intentionally simulated. Sounds are original spatialized training cues—not manufacturer alarm signals—and carry no clinical meaning. No clinical use. Reference workflow: v12.1; your pump’s firmware and configuration are not verified.</p>
    </div>
    <dialog id="device-override-dialog" aria-labelledby="device-override-title"><form method="dialog" class="dialog-top"><p class="eyebrow">Training annotation</p><button class="quiet" aria-label="Close override reason">✕</button></form><h2 id="device-override-title">Record your override reason</h2><p>This debrief annotation is part of the trainer, not a reproduced pump screen.</p><label for="device-override-reason">Why proceed in this exercise?</label><textarea id="device-override-reason" rows="3" maxlength="500"></textarea><button id="device-override-submit" class="primary" disabled>Confirm training override</button></dialog>`;
  const $ = id => host.querySelector(`#${id}`);
  const node = (tag,text,cls) => {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const put = (id,text) => {const e=$(id);if(e.textContent !== String(text))e.textContent=text;};
  let view='overview', page=0, field='dose', buffer='', previous='program';
  const silenced=new Set(),lastStatus=new Map(),lastEventCount=new Map();
  let responseTimer=0,responseBusy=false;
  let pendingArea='', libraryKind='drugs', alphabet='', profileReturn='overview';
  const audio=createAudio();
  const moduleId=(name,channel)=>channel==='A'?name:`${name}-${channel}`;
  const channelNode=(name,channel)=>$(moduleId(name,channel));
  const modules=Object.fromEntries(['A','B','C','D'].map(channel=>[channel,host.querySelector(`[data-module-channel="${channel}"]`)]));
  function layoutModules(count){
    const assembly=host.querySelector('.device-assembly');
    if(Number(assembly.dataset.moduleCount)===count)return;
    const layouts={2:{left:['A'],right:['B']},3:{left:['A','B'],right:['C']},4:{left:['A','B'],right:['C','D']}},layout=layouts[count]||layouts[3];
    const visible=new Set([...layout.left,...layout.right]);
    for(const [channel,module] of Object.entries(modules))module.hidden=!visible.has(channel);
    const inactive=Object.keys(modules).filter(channel=>!visible.has(channel));
    $('module-bank-left').replaceChildren(...layout.left.map(channel=>modules[channel]));
    $('module-bank-right').replaceChildren(...layout.right.map(channel=>modules[channel]),...inactive.map(channel=>modules[channel]));
    for(const [side,ids] of Object.entries(layout)){
      const bank=$(`module-bank-${side}`);bank.dataset.moduleCount=String(ids.length);bank.style.setProperty('--module-count',String(ids.length));
      bank.setAttribute('aria-label',`${side[0].toUpperCase()+side.slice(1)} pump modules: ${ids.join(', ')}`);
    }
    assembly.style.setProperty('--left-count',String(layout.left.length));assembly.style.setProperty('--right-count',String(layout.right.length));assembly.dataset.moduleCount=String(count);
  }
  const channelPan=(channel,count=api.context().moduleCount||3)=>({
    2:{A:-.58,B:.58},
    3:{A:-.68,B:-.24,C:.58},
    4:{A:-.72,B:-.26,C:.26,D:.72},
  }[count]?.[channel]??0);
  const soundFor=(channel,count)=>({channel,pan:channelPan(channel,count)});
  function response(label,milliseconds,run){
    if(responseBusy)return;
    responseBusy=true;put('device-response',label);host.querySelector('.device-assembly').setAttribute('aria-busy','true');host.querySelector('.lcd').classList.add('is-refreshing');
    clearTimeout(responseTimer);responseTimer=setTimeout(()=>{
      run();responseBusy=false;put('device-response','');host.querySelector('.device-assembly').setAttribute('aria-busy','false');host.querySelector('.lcd').classList.remove('is-refreshing');
    },milliseconds);
  }
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
  for(const key of keys){const button=node('button',key,`hardware-key number-key ${['Enter','Cancel','Clear','↑','↓'].includes(key)?'function-key':''}`);button.type='button';button.dataset.key=key;button.setAttribute('aria-label',key==='.'?'Decimal point':key==='↑'?'Increase value':key==='↓'?'Decrease value':key);button.addEventListener('click',()=>{const c=api.context();audio.play(key==='Enter'?'accept':'key',soundFor(c.activeChannel,c.moduleCount));key==='Cancel'?back():press(key);});host.querySelector('.keypad').append(button);numericButtons.push(button);}
  function go(next){view=next;page=0;host.querySelector('.lcd').classList.add('is-refreshing');requestAnimationFrame(()=>requestAnimationFrame(()=>host.querySelector('.lcd').classList.remove('is-refreshing')));render();}
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
  host.querySelectorAll('[data-channel-select]').forEach(button=>button.addEventListener('click',()=>{
    const channel=button.dataset.channelSelect,c=api.context();audio.play('switch',soundFor(channel,c.moduleCount));
    response(`Linking channel ${channel}…`,140,()=>{if(api.context().activeChannel!==channel)api.selectChannel(channel);setup();});
  }));
  host.querySelectorAll('[data-channel-pause]').forEach(button=>button.addEventListener('click',()=>{
    const channel=button.dataset.channelPause;
    response(`Pausing channel ${channel}…`,180,()=>{if(api.context().activeChannel!==channel)api.selectChannel(channel);api.dispatch({type:'pause'});go('status');});
  }));
  host.querySelectorAll('[data-channel-restart]').forEach(button=>button.addEventListener('click',()=>{
    const channel=button.dataset.channelRestart;
    response(`Restarting channel ${channel}…`,480,()=>{if(api.context().activeChannel!==channel)api.selectChannel(channel);api.dispatch({type:'resume'});go('status');});
  }));
  $('pcu-power').addEventListener('click',()=>{if(view==='standby'){const c=api.context();audio.play('power',soundFor(c.activeChannel,c.moduleCount));response('Starting control unit…',420,()=>go('newpatient'));}});
  $('device-startup').addEventListener('click',()=>{if(api.context().editable){api.dispatch({type:'edit'});go('standby');}});
  $('pcu-options').addEventListener('click',()=>go('options'));
  $('pcu-silence').addEventListener('click',()=>{silenced.add(api.context().activeChannel);audio.stopLoop('alarm');render();});
  $('device-advance').addEventListener('click',api.advance);
  $('device-alarm').addEventListener('click',()=>{api.alarm();go('status');});
  $('device-audio').addEventListener('click',()=>{const on=audio.toggle();$('device-audio').textContent=on?'Sound on':'Sound off';$('device-audio').setAttribute('aria-pressed',String(on));if(!on)audio.stopLoops();render();});
  $('device-module-count').addEventListener('change',()=>{
    const next=Number($('device-module-count').value);
    if(!api.setModuleCount(next)){
      $('device-module-count').value=String(api.context().moduleCount);
      response('Pause or reset channels before detaching an active module.',1200,render);
    }else{audio.play('switch');layoutModules(next);go('overview');}
  });
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
    const channel=c.activeChannel||'A';
    layoutModules(c.moduleCount||3);$('device-module-count').value=String(c.moduleCount||3);
    const result=s.result||evaluate(e,p), active=['running','paused','alarm','complete'].includes(s.status);
    if(active&&['standby','newpatient','profileconfirm','profiles','infusionmenu','medications','concentration','advisory','number','program','review'].includes(view))view='status';
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
      title=`${channel}   DOWNSTREAM OCCLUSION`;
      row('Infusion stopped','Check downstream line');
      row('Line check',c.lineChecked?'ACKNOWLEDGED':'Select after simulated check',()=>api.checkLine());
      row('Alarm',silenced.has(channel)?'VISUAL ALERT ACKNOWLEDGED':'Press Silence to acknowledge');
      row('Clear simulated obstruction','',null,c.lineChecked?()=>{api.dispatch({type:'resolve'});go('status');}:null,'CLEAR');
      row('Delivery',`${api.format(s.delivered)} mL infused`);
      footer='Training alarm. Clearing leaves channel paused; press Restart to resume.';
    }else if(s.status==='blocked'||s.status==='soft'){
      title=s.status==='soft'?`${channel}   SOFT LIMIT ALERT`:`${channel}   PROGRAM BLOCKED`;
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
      title=`${channel}   INFUSION MENU`;
      row('Library Drugs','',()=>chooseKind('drugs'));
      row('Library IV Fluids','',()=>chooseKind('fluids'));
      row('Basic Infusion','Not simulated');rows.at(-1).inactive=true;
      action(1,'EXIT',()=>go('overview'));
      footer='>Select an infusion type';
    }else if(view==='medications'){
      title=libraryKind==='drugs'?`${channel}   LIBRARY DRUGS`:`${channel}   LIBRARY IV FLUIDS`;
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
      title=`${channel}   CONFIRM LIBRARY ENTRY`;
      row(e.name,e.therapy||e.area);
      row('Concentration',e.doseUnit==='mL/h'?'Volumetric fluid':`${e.preparation?e.preparation+' · ':''}${e.concentrationLabel||`${e.concentration} ${e.amountUnit}/mL`}`);
      row('Dose / rate unit',e.doseUnit);
      row('Soft range',softRange(e));
      row('Yes','Continue with this entry',()=>go(e.advisory?'advisory':'program'),()=>go('medications'),'NO');
      action(1,'EXIT',()=>go('infusionmenu'));
      footer='>Is this the correct library entry?';
    }else if(view==='advisory'){
      title=`${channel}   EXPORTED ADVISORY`;row(e.name,e.therapy||'');row(e.advisory);row('Source text / code','Full policy is not included');row('Source record',e.source?.id||'');
      action(1,'BACK',()=>go('concentration'));action(4,'CONFIRM',()=>go('program'));footer='>Read exported advisory before continuing';
    }else if(view==='program'||view==='number'){
      title=`${channel}   PRIMARY INFUSION`;
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
      title=`${channel}   CONFIRM PROGRAM`;
      row(e.name,`${p.dose} ${e.doseUnit}`);
      row('Flow rate',`${displayRate(s.result.rate)} mL/h`);
      row('VTBI',`${p.vtbi} mL`);
      row('Check against order','Learner acknowledgment',()=>api.checkOrder());
      action(1,'EDIT',()=>{api.dispatch({type:'edit'});go('program');});
      action(4,'START',c.setupComplete?()=>response(`Channel ${channel} checking program…`,620,()=>{api.dispatch({type:'start',mode:c.mode});api.context().state.status==='running'?go('status'):render();}):null);
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
      title='SOFTWARE VERSIONS';row('Simulator','AinaDara prototype 0.5');row('Reference workflow','8015 user manual · v12.1');row('Your pump firmware','Not verified');row('No device connection','No firmware is installed here');
      action(1,'EXIT',()=>go('overview'));footer='>Training implementation · not manufacturer software';
    }else if(view==='audio'){
      title='AUDIO';
      row(audio.enabled?'Training tones on':'Training tones off',audio.supported?'Toggle':'Not available in this browser',audio.supported?()=>{audio.toggle();$('device-audio').textContent=audio.enabled?'Sound on':'Sound off';$('device-audio').setAttribute('aria-pressed',String(audio.enabled));render();}:null);
      row('Layered WebAudio','Original tones, not manufacturer alarm signals');
      row('Channel position','Stereo placement follows the attached module side');
      row('No clinical meaning','Pitch, rhythm and position do not encode priority');
      row('Silence control','Stops this channel alert; visual state remains');
      action(1,'EXIT',()=>go('overview'));footer='>Training soundscape only · volume follows your device';
    }else if(view==='volume'){
      title='VOLUME INFUSED';
      c.channels.forEach(item=>row(`Channel ${item.id}`,`${api.format(item.delivered)} mL · ${item.status.toUpperCase()}`));
      row(`${channel} remaining`,active?`${api.format(remaining)} mL`:'Not started');
      row(`${channel} simulated time`,api.time(s.elapsed));
      action(1,'EXIT',()=>go('overview'));
      footer='Volume is cumulative within this practice attempt. Reset starts a new attempt.';
    }else if(view==='status'&&active){
      title=`${channel}   ${s.status==='running'?'INFUSING':s.status.toUpperCase()}`;
      row(e.name,`${s.program.dose} ${e.doseUnit}`);
      row('Rate',`${displayRate(s.result.rate)} mL/h`);
      row('VTBI remaining',`${api.format(remaining)} mL`);
      row('Volume infused',`${api.format(s.delivered)} mL`);
      action(1,'EXIT',()=>go('overview'));action(4,s.status==='running'?'PAUSE':'RESTART',s.status==='running'?()=>api.dispatch({type:'pause'}):s.status==='paused'?()=>api.dispatch({type:'resume'}):null);
      footer=s.status==='complete'?'VTBI complete. Delivery stopped; KVO is not simulated.':`${s.status==='running'?'Infusing':'Paused'} · time remaining ${api.time(remaining/s.result.rate*3600)}`;
    }else{
      title=e.area;
      c.channels.forEach(item=>{
        const status=item.status==='editing'?'AVAILABLE':item.status.toUpperCase(),value=item.entryName?`${item.entryName} · ${status}`:`Select channel to program · ${status}`;
        row(item.id,value,()=>{audio.play('switch',soundFor(item.id,c.moduleCount));response(`Linking channel ${item.id}…`,140,()=>{if(api.context().activeChannel!==item.id)api.selectChannel(item.id);setup();});});
        rows.at(-1).channel=true;rows.at(-1).selected=item.id===channel;
      });
      row(`${channel} primary infusion`,active?`${s.program.dose} ${e.doseUnit} · ${displayRate(s.result.rate)} mL/h`:'Library-based programming');
      row('Connected modules','A · B · C');
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
    const moduleStatus=status=>status==='running'?'INFUSING':status==='alarm'?'OCCLUSION':status==='paused'?'PAUSED':status==='complete'?'COMPLETE':status==='ready'?'READY':status==='blocked'?'BLOCKED':status==='soft'?'LIMIT':'STANDBY';
    // Each module reflects its own engine state. Its small LED display is intentionally less
    // precise than the central screen; delivery still integrates the central display rate.
    for(const item of c.channels){
      const shown=!!item.result&&['ready','running','paused','alarm','complete'].includes(item.status);
      channelNode('module-rate',item.id).textContent=shown?displayModuleRate(item.result.rate):'—';
      channelNode('module-status',item.id).textContent=moduleStatus(item.status);
      const lamp=channelNode('module-lamp',item.id),module=host.querySelector(`[data-module-channel="${item.id}"]`);
      lamp.dataset.state=item.status;lamp.classList.toggle('acknowledged',silenced.has(item.id));
      module.classList.toggle('is-active',item.id===channel);module.dataset.state=item.status;
      channelNode('module-pause',item.id).disabled=item.status!=='running';
      channelNode('module-restart',item.id).disabled=item.status!=='paused';
      const previousStatus=lastStatus.get(item.id);
      if(item.status!==previousStatus){
        if(item.status==='alarm')silenced.delete(item.id);
        if(item.status==='running'&&['ready','soft','paused'].includes(previousStatus))audio.play('start',soundFor(item.id,c.moduleCount));
        else if(item.status==='soft')audio.play('soft',soundFor(item.id,c.moduleCount));
        else if(item.status==='blocked')audio.play('blocked',soundFor(item.id,c.moduleCount));
        else if(item.status==='complete')audio.play('complete',soundFor(item.id,c.moduleCount));
        lastStatus.set(item.id,item.status);
      }
      if(item.events.length!==lastEventCount.get(item.id)){
        if(item.events.at(-1)?.type==='Start blocked')audio.play('reject',soundFor(item.id,c.moduleCount));
        lastEventCount.set(item.id,item.events.length);
      }
    }
    const soundingAlarm=c.channels.find(item=>item.status==='alarm'&&!silenced.has(item.id));
    if(soundingAlarm)audio.loop('alarm',1900,soundFor(soundingAlarm.id,c.moduleCount),'alarm');else audio.stopLoop('alarm');
    const flowing=c.channels.find(item=>item.status==='running');
    if(flowing)audio.loop('flow',2850,soundFor(flowing.id,c.moduleCount),'flow');else audio.stopLoop('flow');
    $('pcu-silence').disabled=s.status!=='alarm';
    $('device-advance').disabled=s.status!=='running';$('device-alarm').disabled=s.status!=='running';
    $('device-startup').disabled=!c.editable;
    host.querySelectorAll('[data-channel-select]').forEach(button=>button.disabled=['standby','newpatient','profileconfirm','profiles'].includes(view));
    $('pcu-options').disabled=['standby','newpatient','profileconfirm','profiles'].includes(view);
    $('pcu-power').disabled=view!=='standby';
    numericButtons.forEach(button=>button.disabled=button.dataset.key==='Cancel'?['standby','overview'].includes(view):view!=='number'||!c.editable);
    put('device-clock',`Channel ${channel} · simulated time ${api.time(s.elapsed)}`);
    put('device-view-label',`Interactive pump trainer · channel ${channel}`);
    host.querySelector('.device-assembly').dataset.activeChannel=channel;
  }
  return {render,reset(){view='overview';page=0;buffer='';pendingArea='';alphabet='';silenced.clear();lastStatus.clear();lastEventCount.clear();responseBusy=false;clearTimeout(responseTimer);audio.stopLoops();put('device-response','');host.querySelector('.device-assembly').setAttribute('aria-busy','false');$('device-override-dialog').close();}};
}
