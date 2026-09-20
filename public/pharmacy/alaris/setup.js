import {SETUP_STEPS,setupReady} from './setup-engine.js';

// Original schematic with native HTML hit targets: mouse, touch and keyboard share actions.
export function mountSetup(host,api){
  host.innerHTML=`<section class="setup-lab" aria-label="Hands-on primary infusion setup">
    <header class="setup-heading"><div><p class="eyebrow">01 · bedside rehearsal</p><h2>From bag to pump.</h2></div><span id="setup-count" class="badge"></span></header>
    <div class="setup-scene" id="setup-scene">
      <svg viewBox="0 0 720 600" aria-hidden="true" class="setup-drawing">
        <defs><linearGradient id="pole-metal"><stop stop-color="#888d84"/><stop offset=".5" stop-color="#ebece6"/><stop offset="1" stop-color="#858b80"/></linearGradient></defs>
        <ellipse cx="448" cy="567" rx="198" ry="15" class="scene-shadow"/>
        <path d="M448 563V42q0-17-18-17h-90q-18 0-18 18v9" fill="none" stroke="url(#pole-metal)" stroke-width="10"/>
        <path d="M448 536l-108 35m108-35 98 35m-98-35 21 43" stroke="url(#pole-metal)" stroke-width="10"/><g fill="#596054"><circle cx="340" cy="573" r="9"/><circle cx="546" cy="574" r="9"/><circle cx="470" cy="580" r="9"/></g>
        <rect x="39" y="422" width="190" height="100" rx="6" class="scene-tray"/><text x="58" y="450" class="scene-label">SUPPLY TRAY</text>
        <g id="scene-bag"><path d="M287 72h70l18 30v101q0 18-18 18h-70q-18 0-18-18V102z" class="scene-container"/><rect x="278" y="130" width="88" height="81" rx="12" class="scene-fluid"/><rect x="280" y="118" width="84" height="62" rx="2" fill="#fffcf7"/><text x="322" y="138" text-anchor="middle" class="bag-label">PREPARED BAG</text><text x="322" y="155" text-anchor="middle" class="bag-label">TRAINING ONLY</text><path d="M309 221v17m25-17v11" stroke="#7b8d81" stroke-width="9"/></g>
        <g id="scene-set"><path d="M309 238v18m0 48v47q0 12 16 12h68q14 0 14 20v92q0 31 33 31h69q37 0 37-36v-22" class="scene-tube"/><path id="scene-fluid-path" d="M309 238v18m0 48v47q0 12 16 12h68q14 0 14 20v92q0 31 33 31h69q37 0 37-36v-22" pathLength="100" class="scene-fluid-line"/>
        <rect x="298" y="256" width="22" height="49" rx="8" class="scene-container"/><rect id="scene-chamber-fluid" x="302" y="276" width="14" height="25" rx="4" class="scene-fluid"/><circle id="scene-drop" cx="309" cy="269" r="3" class="scene-fluid"/>
        <rect x="298" y="324" width="22" height="31" rx="4" class="scene-clamp"/><circle id="scene-clamp-wheel" cx="309" cy="333" r="7" fill="#eee8d7"/>
        <path d="M540 448h12" stroke="#879184" stroke-width="5"/><text x="513" y="432" class="scene-label">UNCONNECTED END</text></g>
        <g id="scene-pump"><rect x="366" y="370" width="158" height="127" rx="10" class="scene-pump-body"/><rect x="442" y="396" width="65" height="56" rx="2" fill="#c8def1"/><text x="449" y="414" class="bag-label">SIMULATION</text><path d="M451 428h46m-46 11h33" stroke="#5b7b9b" stroke-width="3"/><g fill="#4e5b64"><rect x="450" y="464" width="12" height="8" rx="2"/><rect x="468" y="464" width="12" height="8" rx="2"/><rect x="486" y="464" width="12" height="8" rx="2"/></g>
        <rect x="374" y="383" width="58" height="101" rx="3" fill="#535e59"/><path d="M402 390v84" class="scene-tube"/><rect id="scene-upper" x="394" y="387" width="16" height="12" rx="2" fill="#dce5d7"/><rect id="scene-safety" x="394" y="429" width="16" height="15" rx="2" fill="#dce5d7"/><rect id="scene-sensor" x="393" y="457" width="18" height="13" rx="2" fill="#dce5d7"/>
        <g id="scene-door"><rect x="372" y="381" width="63" height="105" rx="5" fill="#c6cdc0" stroke="#808b7d"/><rect x="381" y="393" width="43" height="30" rx="3" fill="#253b2d"/><text id="scene-status" x="402" y="412" text-anchor="middle" fill="#bbef91" class="bag-label">A</text><rect x="387" y="436" width="29" height="17" rx="2" fill="#f5f1e7"/><text x="402" y="447" text-anchor="middle" class="bag-label">SELECT</text><path d="M425 444v30" stroke="#566459" stroke-width="5"/></g></g>
        <text x="45" y="38" class="scene-label">PRIMARY INFUSION · SCHEMATIC</text>
      </svg>
      <button class="scene-hit hit-hook" data-target="hang">Pole hook</button>
      <button class="scene-hit hit-bag" data-target="inspect">Inspect bag</button>
      <button class="scene-hit hit-port" data-target="spike">Connect set</button>
      <button class="scene-hit hit-chamber" data-target="chamber">Drip chamber</button>
      <button class="scene-hit hit-clamp" data-target="clamp">Roller clamp</button>
      <button class="scene-hit hit-line" data-target="inspect-line">Inspect line</button>
      <button class="scene-hit hit-door" data-target="door">Module door</button>
      <button class="scene-hit hit-upper" data-target="upper">Upper fitment</button>
      <button class="scene-hit hit-safety" data-target="safety">Safety clamp</button>
      <button class="scene-hit hit-sensor" data-target="sensor">Air detector</button>
      <button class="scene-hit hit-zoom" id="scene-zoom">Zoom to controls ↗</button>
      <button class="scene-hit hit-bag-choice" data-target="bag">Prepared bag</button>
      <button class="scene-hit hit-set-choice" data-target="set">Primary pump set</button>
    </div>
    <div class="setup-instruction"><span id="setup-phase" class="eyebrow"></span><h3 id="setup-step-title"></h3><p id="setup-help"></p><p id="setup-feedback" role="status" aria-live="polite"></p><button id="setup-action" class="primary"></button><button id="setup-zoom" class="secondary" hidden>Zoom into pump controls →</button></div>
    <details class="setup-boundaries"><summary>What this scene does—and does not—teach</summary><p>Prepared primary bag only. Use the highlighted object or the action button; both perform the same simulated step. Line priming is visual and compressed. Set fitments, height, asepsis, product compatibility and free-flow assessment are not physically validated. There is no patient connection or real fluid delivery.</p><p>Real equipment requires its current manufacturer instructions and institutional training. Bottles, medication-vial preparation, syringe modules, secondary lines and drug-specific containers need separate workflows and are not simulated here. A programmable library entry does not establish which physical container or set it uses.</p></details>
  </section>`;
  const $=id=>host.querySelector(`#${id}`);
  const write=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
  const hit=target=>host.querySelector(`[data-target="${target}"]`);
  host.querySelectorAll('[data-target]').forEach(button=>button.addEventListener('click',()=>{
    let target=button.dataset.target;
    const s=api.state();
    if(target==='clamp'&&s.step===7)target='prime';
    if(target==='chamber'&&s.step===16)target='no-flow';
    api.act(target);
  }));
  $('setup-action').addEventListener('click',()=>{const step=SETUP_STEPS[api.state().step];if(step)api.act(step[0]);});
  for(const id of ['scene-zoom','setup-zoom'])$(id).addEventListener('click',api.zoom);
  function render(){
    const s=api.state(),ready=setupReady(s),step=SETUP_STEPS[s.step],active=api.running();
    write('setup-count',`${Math.min(s.step,SETUP_STEPS.length)} / ${SETUP_STEPS.length}`);
    write('setup-phase',ready?'02 · pump navigation':s.step<6?'Prepare & hang':s.step<10?'Prime & inspect':'Load & verify');
    write('setup-step-title',ready?'The set is ready for programming.':step[1]);
    write('setup-help',ready?'Move closer to the screen. Choose the profile, select the matching library entry, then enter and check your program. Patient connection is outside this prototype.':step[2]);
    write('setup-feedback',s.feedback);
    write('setup-action',s.busy?`Priming demonstration · ${Math.round(s.priming*100)}%`:ready?'Setup complete':step[1]);
    $('setup-action').hidden=ready;$('setup-action').disabled=s.busy;
    $('setup-zoom').hidden=!ready;$('scene-zoom').disabled=!ready;
    $('setup-scene').dataset.step=String(s.step);
    $('setup-scene').classList.toggle('is-priming',s.busy);
    $('setup-scene').classList.toggle('is-running',active);
    $('scene-bag').setAttribute('transform',s.step>5?'':'translate(-187 345) scale(.83)');
    $('scene-bag').style.opacity=s.step?'1':'.4';
    $('scene-set').style.opacity=s.step>4?'1':'.13';
    $('scene-set').setAttribute('transform',s.step>5?'':'translate(-187 345) scale(.83)');
    $('scene-chamber-fluid').style.opacity=s.step>6?'1':'0';
    $('scene-drop').style.opacity=s.busy||active?'1':'0';
    $('scene-fluid-path').style.strokeDasharray=`${s.priming*100} 100`;
    $('scene-clamp-wheel').setAttribute('cy',s.busy||s.step>=16?'346':'333');
    $('scene-door').setAttribute('transform',s.step>=11&&s.step<15?'translate(-63 0)':'');
    for(const [id,done] of [['upper',12],['safety',13],['sensor',14]])$(`scene-${id}`).setAttribute('fill',s.step>=done?'#86b76b':'#dce5d7');
    write('scene-status',active?'RUN':'A');
    for(const button of host.querySelectorAll('[data-target]')){button.classList.remove('is-next');button.disabled=ready||s.busy;}
    if(step){const target=step[0]==='prime'?'clamp':step[0]==='no-flow'?'chamber':step[0];hit(target)?.classList.add('is-next');}
    for(const target of ['upper','safety','sensor'])hit(target).hidden=!(s.step>=11&&s.step<15);
    hit('door').hidden=s.step>=11&&s.step<14;
    hit('bag').hidden=s.step>0;hit('set').hidden=s.step>2;
    // Mounted native buttons remain in place so keyboard focus survives each state update.
  }
  return {render};
}
