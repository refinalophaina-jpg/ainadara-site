import {SETUP_STEPS,setupReady} from './setup-engine.js?v=0.7';

// Staged, photo-forward primary-bag rehearsal. The cutouts are original generic training
// assets; interaction order remains deterministic and intentionally simpler than a device IFU.
export function mountSetup(host,api){
  host.innerHTML=`<section class="setup-lab" aria-label="Hands-on primary infusion setup">
    <header class="setup-heading"><div><p class="eyebrow">01 · bedside rehearsal</p><h2>From bag to pump.</h2></div><div class="setup-heading-meta"><span class="scene-label-ui">Clinical skills bay</span><span id="setup-count" class="badge"></span></div></header>
    <div class="setup-scene" id="setup-scene" data-phase="prepare">
      <div class="scene-room" aria-hidden="true"><span class="scene-room-line"></span><span class="scene-floor-shadow"></span></div>
      <div class="scene-phase-rail" aria-hidden="true"><span data-phase-label="prepare">Prepare</span><span data-phase-label="connect">Connect</span><span data-phase-label="prime">Prime</span><span data-phase-label="load">Load</span><span data-phase-label="verify">Verify</span></div>
      <div id="scene-pole" class="scene-pole" aria-hidden="true"><span class="pole-hook"></span><span class="pole-stem"></span><span class="pole-base"></span></div>
      <figure class="scene-supply-card" aria-hidden="true"><figcaption>Supply tray · visual reference</figcaption><img id="scene-supply-kit" src="./infusion-supply-kit.webp?v=0.7" alt=""></figure>
      <figure class="scene-line-rig" aria-hidden="true"><img id="scene-primary-line" src="./setup-primary-line.webp?v=0.7" alt=""><span id="scene-prime-drop" class="scene-prime-drop"></span><span class="scene-prime-track"></span></figure>
      <figure id="scene-pump" class="scene-pump-photo" aria-hidden="true"><img src="./setup-pump-three-channel.webp?v=0.7" alt=""><figcaption>3 channels · A/B left · C right</figcaption></figure>
      <figure id="scene-open-module" class="scene-module-closeup" aria-hidden="true"><img src="./setup-open-module.webp?v=0.7" alt=""><figcaption>Channel A · door open</figcaption><span class="load-zone zone-upper">Upper fitment</span><span class="load-zone zone-safety">Safety clamp</span><span class="load-zone zone-sensor">Air detector</span></figure>
      <div class="scene-readout" aria-hidden="true"><span id="scene-stage-kicker">Prepare</span><strong id="scene-stage-caption">Choose the prepared bag</strong><small id="scene-flow-state">Line not connected</small><span class="scene-progress"><i id="scene-progress-fill"></i></span></div>
      <button class="scene-hit hit-hook" data-target="hang">Hang on pole</button>
      <button class="scene-hit hit-bag" data-target="inspect">Inspect bag</button>
      <button class="scene-hit hit-port" data-target="spike">Connect set</button>
      <button class="scene-hit hit-chamber" data-target="chamber">Drip chamber</button>
      <button class="scene-hit hit-clamp" data-target="clamp">Roller clamp</button>
      <button class="scene-hit hit-line" data-target="inspect-line">Inspect distal line</button>
      <button class="scene-hit hit-door" data-target="door">Module door</button>
      <button class="scene-hit hit-upper" data-target="upper">Upper fitment</button>
      <button class="scene-hit hit-safety" data-target="safety">Safety clamp</button>
      <button class="scene-hit hit-sensor" data-target="sensor">Air detector</button>
      <button class="scene-hit hit-zoom" id="scene-zoom">Zoom to controls ↗</button>
      <button class="scene-hit hit-bag-choice" data-target="bag">Choose prepared bag</button>
      <button class="scene-hit hit-set-choice" data-target="set">Choose primary set</button>
    </div>
    <div class="setup-instruction"><span id="setup-phase" class="eyebrow"></span><h3 id="setup-step-title"></h3><p id="setup-help"></p><p id="setup-feedback" role="status" aria-live="polite"></p><button id="setup-action" class="primary"></button><button id="setup-zoom" class="secondary" hidden>Zoom into pump controls →</button></div>
    <details class="setup-boundaries"><summary>What this scene does—and does not—teach</summary><p>Prepared primary bag only. The scene uses staged photo cutouts and a moving flow indicator to make the sequence legible; neither is a physical model or timing specification. Use the highlighted object or the action button. Set fitments, height, asepsis, product compatibility and free-flow assessment are not physically validated. There is no patient connection or real fluid delivery.</p><p>The vial on the supply tray is visual context only. Real equipment requires its current manufacturer instructions and institutional training. Bottles, medication-vial preparation, syringe modules, secondary lines and drug-specific containers need separate workflows and are not simulated here.</p></details>
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
  const phaseFor=(s,ready)=>ready?'ready':s.step<3?'prepare':s.step<6?'connect':s.step<10?'prime':s.step<15?'load':'verify';
  const phaseNames={prepare:'Prepare',connect:'Connect',prime:'Prime',load:'Load',verify:'Verify',ready:'Ready'};
  function render(){
    const s=api.state(),ready=setupReady(s),step=SETUP_STEPS[s.step],active=api.running(),phase=phaseFor(s,ready);
    write('setup-count',`${Math.min(s.step,SETUP_STEPS.length)} / ${SETUP_STEPS.length}`);
    write('setup-phase',ready?'02 · pump navigation':s.step<6?'Prepare & hang':s.step<10?'Prime & inspect':'Load & verify');
    write('setup-step-title',ready?'The set is ready for programming.':step[1]);
    write('setup-help',ready?'Move to the functional control screen. Choose the profile, select the matching library entry, then enter and check the program. Patient connection is outside this prototype.':step[2]);
    write('setup-feedback',s.feedback);
    write('setup-action',s.busy?`Priming demonstration · ${Math.round(s.priming*100)}%`:ready?'Setup complete':step[1]);
    write('scene-stage-kicker',phaseNames[phase]);
    write('scene-stage-caption',ready?'Move to the functional controls':step[1]);
    write('scene-flow-state',active?'Channel A running · simulated':s.busy?`Visual prime · ${Math.round(s.priming*100)}%`:s.step<5?'Line not connected':s.step<8?'Set connected · distal end capped':s.step<15?'Primed line · clamped':'Loaded · verify no free flow');
    $('setup-action').hidden=ready;$('setup-action').disabled=s.busy;
    $('setup-zoom').hidden=!ready;$('scene-zoom').disabled=!ready;
    const scene=$('setup-scene');scene.dataset.step=String(s.step);scene.dataset.phase=phase;
    scene.classList.toggle('is-priming',s.busy);scene.classList.toggle('is-running',active);scene.classList.toggle('is-hung',s.step>5);scene.classList.toggle('has-set',s.step>2);
    $('scene-progress-fill').style.width=`${Math.max(s.step/SETUP_STEPS.length*100,s.priming*100)}%`;
    $('scene-prime-drop').style.offsetDistance=`${Math.max(2,s.priming*100)}%`;
    for(const [selector,done] of [['.zone-upper',12],['.zone-safety',13],['.zone-sensor',14]])host.querySelector(selector).classList.toggle('is-done',s.step>=done);
    for(const label of host.querySelectorAll('[data-phase-label]'))label.classList.toggle('is-current',label.dataset.phaseLabel===phase||(phase==='ready'&&label.dataset.phaseLabel==='verify'));
    for(const button of host.querySelectorAll('[data-target]')){button.classList.remove('is-next');button.disabled=ready||s.busy;}
    if(step){const target=step[0]==='prime'?'clamp':step[0]==='no-flow'?'chamber':step[0];hit(target)?.classList.add('is-next');}
    for(const target of ['upper','safety','sensor'])hit(target).hidden=!(s.step>=11&&s.step<15);
    hit('door').hidden=s.step>=11&&s.step<14;hit('bag').hidden=s.step>0;hit('set').hidden=s.step>2;
  }
  return {render};
}
