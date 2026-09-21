import {SETUP_STEPS,setupReady} from './setup-engine.js';

// Original schematic with native HTML hit targets: mouse, touch and keyboard share actions.
export function mountSetup(host,api){
  host.innerHTML=`<section class="setup-lab" aria-label="Hands-on primary infusion setup">
    <header class="setup-heading"><div><p class="eyebrow">01 · bedside rehearsal</p><h2>From bag to pump.</h2></div><div class="setup-heading-meta"><span class="scene-label-ui">Clinical skills bay</span><span id="setup-count" class="badge"></span></div></header>
    <div class="setup-scene" id="setup-scene">
      <svg viewBox="0 0 720 600" aria-hidden="true" class="setup-drawing">
        <defs>
          <linearGradient id="pole-metal"><stop stop-color="#777d76"/><stop offset=".22" stop-color="#f8faf6"/><stop offset=".5" stop-color="#aeb5ad"/><stop offset=".74" stop-color="#eef0ea"/><stop offset="1" stop-color="#71786f"/></linearGradient>
          <linearGradient id="bag-shell" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".88"/><stop offset=".45" stop-color="#dce8e2" stop-opacity=".62"/><stop offset="1" stop-color="#9eb2a6" stop-opacity=".82"/></linearGradient>
          <linearGradient id="fluid-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c4e8f2" stop-opacity=".72"/><stop offset="1" stop-color="#559bb5" stop-opacity=".9"/></linearGradient>
          <linearGradient id="pump-shell" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5f6ef"/><stop offset=".5" stop-color="#cfd6ca"/><stop offset="1" stop-color="#939e96"/></linearGradient>
          <linearGradient id="module-shell" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f8f2"/><stop offset=".42" stop-color="#ced6d0"/><stop offset="1" stop-color="#879690"/></linearGradient>
          <linearGradient id="screen-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#eaf8ff"/><stop offset=".18" stop-color="#b8dbf1"/><stop offset="1" stop-color="#6c9fc3"/></linearGradient>
          <radialGradient id="wheel-hub" cx="35%" cy="28%"><stop stop-color="#aab3ac"/><stop offset=".45" stop-color="#626b65"/><stop offset="1" stop-color="#2f3732"/></radialGradient>
          <filter id="scene-depth" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#1f2b25" flood-opacity=".3"/></filter>
        </defs>
        <ellipse cx="448" cy="567" rx="198" ry="15" class="scene-shadow"/>
        <g id="scene-pole">
          <path d="M448 548V43q0-18-19-18h-88q-19 0-19 19v11" fill="none" stroke="url(#pole-metal)" stroke-width="12" stroke-linecap="round"/>
          <path d="M445 539V48q0-13-14-13h-88" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
          <rect x="436" y="317" width="24" height="18" rx="8" class="pole-collar"/><rect x="439" y="510" width="18" height="28" rx="8" class="pole-collar"/>
          <path d="M448 528L340 564M448 528l99 37m-99-37 23 43" fill="none" stroke="url(#pole-metal)" stroke-width="13" stroke-linecap="round"/>
          <path d="M448 528L345 562m106-31 92 33m-92-33 20 36" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="2" stroke-linecap="round"/>
          <g class="scene-caster" transform="translate(339 568)"><path d="M-9-4h18v8H-9z"/><circle cy="7" r="10" fill="url(#wheel-hub)"/><circle cy="7" r="3" fill="#b9c0ba"/></g>
          <g class="scene-caster" transform="translate(547 569)"><path d="M-9-4h18v8H-9z"/><circle cy="7" r="10" fill="url(#wheel-hub)"/><circle cy="7" r="3" fill="#b9c0ba"/></g>
          <g class="scene-caster" transform="translate(472 575)"><path d="M-9-4h18v8H-9z"/><circle cy="7" r="10" fill="url(#wheel-hub)"/><circle cy="7" r="3" fill="#b9c0ba"/></g>
        </g>
        <rect x="19" y="373" width="270" height="170" rx="9" class="scene-tray"/><text x="34" y="395" class="scene-label">SUPPLY TRAY · VISUAL REFERENCE</text>
        <image id="scene-supply-kit" href="./infusion-supply-kit.webp" x="25" y="386" width="258" height="158" preserveAspectRatio="xMidYMid meet"/>
        <g id="scene-bag">
          <path d="M282 75q4-9 14-10h52q10 1 14 10l14 29-2 97q0 20-19 23h-67q-19-3-19-23l-2-97z" class="scene-container"/>
          <path d="M286 78q18-6 72 0m-78 28q42 7 88 0M281 201q39 10 86 0" class="bag-seam"/>
          <path d="M294 75q27-10 55 0l-6 16h-43z" class="bag-hanger"/><rect x="306" y="76" width="28" height="8" rx="4" class="bag-hole"/>
          <path id="scene-bag-fluid" d="M277 132q43-5 94 0v67q0 16-17 18h-65q-16-2-16-18z" class="scene-fluid bag-fluid"/>
          <path id="scene-meniscus" d="M278 132q45 7 93 0" class="bag-meniscus"/>
          <path d="M288 97l-7 24m78-24 8 24m-77 92 11-8m54 8-10-8" class="bag-crinkle"/>
          <rect x="286" y="112" width="72" height="55" rx="3" class="bag-label-panel"/><text x="322" y="132" text-anchor="middle" class="bag-label">PREPARED BAG</text><text x="322" y="148" text-anchor="middle" class="bag-label">SIMULATION ONLY</text><path d="M296 157h52" class="bag-label-line"/>
          <g class="bag-ports"><path d="M303 221v14" /><rect x="296" y="231" width="15" height="13" rx="4"/><path d="M338 221v11"/><rect x="331" y="229" width="15" height="10" rx="4"/></g>
        </g>
        <g id="scene-set">
          <path d="M304 244v13m5 48v45q0 13 16 13h68q14 0 14 20v92q0 31 33 31h69q37 0 37-36v-22" class="scene-tube"/>
          <path id="scene-fluid-path" d="M304 244v13m5 48v45q0 13 16 13h68q14 0 14 20v92q0 31 33 31h69q37 0 37-36v-22" pathLength="100" class="scene-fluid-line"/>
          <path d="M298 248l6-13 6 13v10h-12z" class="scene-spike"/><rect x="300" y="255" width="18" height="51" rx="8" class="scene-chamber-shell"/><path d="M303 274h12v28h-12z" id="scene-chamber-fluid" class="scene-fluid"/><path d="M302 264q7-5 14 0" class="chamber-ridge"/><circle id="scene-drop" cx="309" cy="269" r="3" class="scene-fluid"/>
          <g class="roller-clamp"><rect x="297" y="324" width="24" height="33" rx="5" class="scene-clamp"/><path d="M302 328l14 25" class="clamp-slot"/><circle id="scene-clamp-wheel" cx="309" cy="333" r="7" class="clamp-wheel"/><path d="M304 332h10m-9 3h8" class="wheel-ridges"/></g>
          <g class="scene-y-site" transform="translate(439 502)"><path d="M0 0l17-17" class="scene-tube"/><rect x="12" y="-23" width="18" height="12" rx="5"/></g>
          <g class="scene-end-cap" transform="translate(545 448)"><path d="M-5 0h17"/><rect x="10" y="-6" width="17" height="12" rx="4"/><path d="M15-4v8m5-8v8"/></g><text x="512" y="432" class="scene-label">CAPPED · UNCONNECTED</text>
        </g>
        <g id="scene-pump">
          <path d="M584 421h17q11 0 11-11v-66" fill="none" stroke="url(#pole-metal)" stroke-width="8"/><rect x="602" y="333" width="21" height="17" rx="5" class="pole-collar"/>
          <rect x="345" y="360" width="244" height="143" rx="16" class="scene-pump-body"/><path d="M359 365h208q13 0 16 13" fill="none" stroke="#fff" stroke-opacity=".68" stroke-width="3"/>
          <rect x="428" y="373" width="99" height="117" rx="11" class="scene-pcu-panel"/><rect x="437" y="386" width="80" height="60" rx="4" class="scene-screen-glass"/><path d="M441 390h72" stroke="#fff" stroke-opacity=".65" stroke-width="2"/><text x="444" y="401" class="scene-screen-label">SIMULATION</text><path d="M445 416h62m-62 10h48m-48 10h56" class="scene-screen-line"/>
          <g class="scene-side-keys"><rect x="430" y="393" width="5" height="11" rx="2"/><rect x="430" y="413" width="5" height="11" rx="2"/><rect x="430" y="433" width="5" height="11" rx="2"/><rect x="519" y="393" width="5" height="11" rx="2"/><rect x="519" y="413" width="5" height="11" rx="2"/><rect x="519" y="433" width="5" height="11" rx="2"/></g>
          <g class="scene-control-keys"><rect x="442" y="455" width="15" height="9" rx="2"/><rect x="462" y="455" width="15" height="9" rx="2"/><rect x="482" y="455" width="15" height="9" rx="2"/><rect x="502" y="455" width="15" height="9" rx="2"/><circle cx="509" cy="478" r="7"/></g>
          <rect x="364" y="371" width="66" height="120" rx="12" fill="url(#module-shell)" stroke="#64736e" stroke-width="2"/><rect x="371" y="378" width="52" height="101" rx="7" fill="#42514c"/><path d="M397 384v88" class="scene-tube"/><rect id="scene-upper" x="388" y="382" width="18" height="13" rx="3" fill="#dce5d7"/><rect id="scene-safety" x="388" y="427" width="18" height="16" rx="3" fill="#dce5d7"/><rect id="scene-sensor" x="387" y="456" width="20" height="14" rx="3" fill="#dce5d7"/>
          <g id="scene-door"><rect x="360" y="368" width="70" height="124" rx="12" fill="url(#module-shell)" stroke="#64736e" stroke-width="2"/><rect x="367" y="375" width="56" height="16" rx="6" class="scene-lamp"/><rect x="369" y="398" width="52" height="31" rx="4" fill="#17231f" stroke="#52615c" stroke-width="2"/><text id="scene-status" x="395" y="419" text-anchor="middle" fill="#bdf28f" class="scene-module-rate">A</text><rect x="375" y="437" width="40" height="20" rx="4" class="scene-select-key"/><text x="395" y="450" text-anchor="middle" class="bag-label">SELECT</text><g class="scene-module-keys"><rect x="371" y="465" width="20" height="8" rx="3"/><rect x="395" y="465" width="20" height="8" rx="3"/></g><path d="M423 444v34" stroke="#4b5b55" stroke-width="6" stroke-linecap="round"/></g>
          <g class="scene-idle-module" transform="translate(531 372)"><rect width="24" height="116" rx="7"/><rect x="4" y="7" width="16" height="13" rx="3" class="scene-lamp"/><rect x="4" y="27" width="16" height="28" rx="3" class="idle-screen"/><text x="12" y="46" text-anchor="middle">B</text><rect x="5" y="63" width="14" height="11" rx="3" class="scene-select-key"/><path d="M7 84h10m-10 8h10m-10 8h10"/></g>
          <g class="scene-idle-module" transform="translate(559 372)"><rect width="24" height="116" rx="7"/><rect x="4" y="7" width="16" height="13" rx="3" class="scene-lamp"/><rect x="4" y="27" width="16" height="28" rx="3" class="idle-screen"/><text x="12" y="46" text-anchor="middle">C</text><rect x="5" y="63" width="14" height="11" rx="3" class="scene-select-key"/><path d="M7 84h10m-10 8h10m-10 8h10"/></g>
        </g>
        <text x="45" y="38" class="scene-label">PRIMARY INFUSION · SETUP</text>
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
    <details class="setup-boundaries"><summary>What this scene does—and does not—teach</summary><p>Prepared primary bag only. Use the highlighted object or the action button; both perform the same simulated step. Line priming is visual and compressed. Set fitments, height, asepsis, product compatibility and free-flow assessment are not physically validated. There is no patient connection or real fluid delivery.</p><p>The large vial and idle B/C module faces are visual orientation props only; no medication transfer or additional-line setup is implied. Real equipment requires its current manufacturer instructions and institutional training. Bottles, medication-vial preparation, syringe modules, secondary lines and drug-specific containers need separate workflows and are not simulated here. A programmable library entry does not establish which physical container or set it uses.</p></details>
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
    $('setup-scene').classList.toggle('is-hung',s.step>5);
    $('setup-scene').classList.toggle('has-set',s.step>2);
    $('scene-supply-kit').style.opacity=s.step===0?'1':s.step<3?'.24':'0';
    $('scene-bag').setAttribute('transform',s.step>5?'':'translate(-187 345) scale(.83)');
    $('scene-bag').style.opacity=s.step?'1':'0';
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
