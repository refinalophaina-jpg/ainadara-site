// Original, synthesized training soundscape.
//
// HONESTY BOUNDARY: these are not manufacturer signals and are not an IEC 60601-1-8
// alarm melody. Pitch, rhythm, stereo position and loudness carry no clinical meaning.
// They provide interface feedback and atmosphere only; teach alarm recognition on the
// institution's real equipment.

const PREF_KEY = 'alaris-audio';
const LEVEL_KEY = 'alaris-audio-level';
// Fallback placement when a caller does not provide the assembly-aware pan. The device view
// supplies exact left/right positions for each 1/2/3/4-module layout.
const CHANNEL_PAN = { A:-0.68, B:-0.24, C:0.26, D:0.68 };
const SOUNDS = {
  // Each step may contain harmonically related layers. Conservative gain keeps repeated
  // controls comfortable while a compressor catches coincident multi-channel events.
  key:      [{at:0,layers:[[1180,.026,.018,'square'],[590,.036,.010,'triangle']]}],
  switch:   [{at:0,layers:[[720,.035,.021,'triangle'],[1080,.025,.011,'sine']]}],
  accept:   [{at:0,layers:[[880,.065,.035,'sine'],[1320,.075,.018,'triangle']]},{at:.075,layers:[[1320,.08,.032,'sine'],[1760,.06,.014,'sine']]}],
  reject:   [{at:0,layers:[[235,.12,.042,'square'],[117.5,.15,.022,'triangle']]},{at:.15,layers:[[235,.12,.038,'square'],[117.5,.15,.020,'triangle']]}],
  soft:     [{at:0,layers:[[740,.11,.036,'triangle'],[1110,.12,.017,'sine']]},{at:.21,layers:[[880,.12,.038,'triangle'],[1320,.1,.016,'sine']]}],
  blocked:  [{at:0,layers:[[390,.13,.047,'sawtooth'],[195,.16,.025,'triangle']]},{at:.22,layers:[[330,.13,.043,'sawtooth']]},{at:.44,layers:[[277,.16,.04,'sawtooth']]}],
  // Two original, harmonically layered pulses followed by a pause. The cadence is informed by
  // the public v12.1 manual's high-priority infusion pattern; the timbre is intentionally ours.
  alarm:    [{at:0,layers:[[784,.11,.050,'square'],[392,.14,.020,'triangle']]},{at:.19,layers:[[932,.11,.048,'square'],[466,.14,.019,'triangle']]}],
  complete: [{at:0,layers:[[659,.085,.03,'sine']]},{at:.11,layers:[[988,.09,.034,'sine']]},{at:.23,layers:[[1318,.13,.037,'sine'],[659,.15,.014,'triangle']]}],
  power:    [{at:0,layers:[[220,.13,.024,'triangle']]},{at:.10,layers:[[440,.11,.028,'sine']]},{at:.19,layers:[[660,.12,.026,'sine']]}],
  start:    [{at:0,layers:[[165,.08,.026,'triangle'],[330,.06,.014,'square']]},{at:.12,layers:[[247,.10,.027,'triangle'],[494,.07,.012,'sine']]}],
  flow:     [{at:0,layers:[[186,.038,.010,'triangle'],[372,.024,.006,'sine']]}],
  door:     [{at:0,layers:[[144,.045,.030,'triangle'],[72,.065,.018,'square']]},{at:.075,layers:[[238,.035,.018,'triangle']]}],
  clamp:    [{at:0,layers:[[980,.022,.021,'square'],[490,.035,.012,'triangle']]}],
  prime:    [{at:0,layers:[[430,.055,.017,'sine']]},{at:.08,layers:[[520,.045,.014,'sine']]}],
};

const LEVEL_GAIN = [0,.36,.48,.62,.78,.94];

export function createAudio() {
  let context = null, enabled = read(), level = readLevel(), output = null, master = null, resumePromise = null, pendingCue = null;
  const loops = new Map();
  const subscribers = new Set();

  function read() {
    try { return localStorage.getItem(PREF_KEY) === 'on'; } catch { return false; }
  }
  function persist(value) {
    try { localStorage.setItem(PREF_KEY, value ? 'on' : 'off'); } catch { /* storage may be blocked */ }
  }
  function readLevel() {
    try { const value=Number(localStorage.getItem(LEVEL_KEY));return value>=1&&value<=5?Math.round(value):3; } catch { return 3; }
  }
  function persistLevel(value) {
    try { localStorage.setItem(LEVEL_KEY,String(value)); } catch { /* storage may be blocked */ }
  }
  function emit() {
    const state={enabled,level,supported:!!(globalThis.AudioContext||globalThis.webkitAudioContext),active:context?.state==='running'};
    subscribers.forEach(listener=>listener(state));
  }
  function ensureContext() {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    if (!context) {
      try {
        context = new Ctor({latencyHint:'interactive'});
        const compressor=context.createDynamicsCompressor();master=context.createGain();
        compressor.threshold.value=-24;compressor.knee.value=18;compressor.ratio.value=5;
        compressor.attack.value=.004;compressor.release.value=.18;master.gain.value=LEVEL_GAIN[level];
        compressor.connect(master).connect(context.destination);output=compressor;
        context.addEventListener?.('statechange',emit);
      } catch { context=null;output=null;master=null;return null; }
    }
    return context;
  }
  function unlock() {
    if(!enabled)return Promise.resolve(false);
    const ctx=ensureContext();if(!ctx)return Promise.resolve(false);
    if(ctx.state==='running'){emit();return Promise.resolve(true);}
    if(!resumePromise)resumePromise=ctx.resume().then(()=>ctx.state==='running').catch(()=>false).finally(()=>{resumePromise=null;emit();});
    return resumePromise;
  }
  function tone([frequency,seconds,gain,waveform],at,pan=0,index=0) {
    const osc=context.createOscillator(),amp=context.createGain();
    osc.type=waveform;osc.frequency.setValueAtTime(frequency,at);osc.detune.value=index%2?3:-2;
    amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),at+.007);
    amp.gain.setValueAtTime(Math.max(.0002,gain),Math.max(at+.008,at+seconds-.012));
    amp.gain.exponentialRampToValueAtTime(.0001,at+seconds);
    let tail=amp;
    if(context.createStereoPanner){const panner=context.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));amp.connect(panner);tail=panner;}
    tail.connect(output);osc.connect(amp);osc.start(at);osc.stop(at+seconds+.015);
  }
  function schedule(name,options={}) {
    const pattern=SOUNDS[name],ctx=context;
    if(!pattern||!ctx||!output||ctx.state!=='running')return false;
    const pan=Number.isFinite(options.pan)?options.pan:(CHANNEL_PAN[options.channel]??0),base=ctx.currentTime+.012;
    pattern.forEach(step=>step.layers.forEach((layer,index)=>tone(layer,base+step.at,pan,index)));
    return true;
  }
  function play(name,options={}) {
    if(!enabled||!SOUNDS[name])return false;
    const ctx=ensureContext();if(!ctx)return false;
    if(ctx.state!=='running'){
      pendingCue={name,options};
      unlock().then(active=>{if(!active||!pendingCue)return;const cue=pendingCue;pendingCue=null;schedule(cue.name,cue.options);});
      return false;
    }
    return schedule(name,options);
  }
  function stopLoop(key){const active=loops.get(key);if(active){clearInterval(active.timer);loops.delete(key);}}

  // Browsers may suspend WebAudio on load, after tab changes, or after an OS interruption.
  // Capturing the next genuine user gesture restores the shared context before click handlers fire.
  const gesture=()=>{if(enabled)unlock();};
  globalThis.document?.addEventListener('pointerdown',gesture,{capture:true,passive:true});
  globalThis.document?.addEventListener('keydown',gesture,{capture:true,passive:true});

  return {
    get enabled(){return enabled;},
    get level(){return level;},
    get active(){return context?.state==='running';},
    supported:!!(globalThis.AudioContext||globalThis.webkitAudioContext),
    set(value){
      enabled=!!value;persist(enabled);
      if(!enabled){pendingCue=null;for(const key of [...loops.keys()])stopLoop(key);context?.suspend?.().catch(()=>{});emit();}
      else unlock().then(active=>{if(active)schedule('accept');emit();});
      return enabled;
    },
    toggle(){return this.set(!enabled);},
    setLevel(value){
      level=Math.max(1,Math.min(5,Math.round(Number(value)||3)));persistLevel(level);
      if(master&&context)master.gain.setTargetAtTime(LEVEL_GAIN[level],context.currentTime,.025);
      emit();return level;
    },
    louder(){return this.setLevel(level+1);},
    softer(){return this.setLevel(level-1);},
    unlock,
    play,
    // Named loops can coexist: a soft flow tick may continue on one channel while another
    // displays an alert. Repeating the same request is idempotent across renders.
    loop(name,everyMs,options={},key=name){
      const signature=`${name}:${everyMs}:${options.channel||''}:${options.pan??''}`;
      if(loops.get(key)?.signature===signature)return;
      stopLoop(key);if(!enabled)return;
      play(name,options);loops.set(key,{signature,timer:setInterval(()=>play(name,options),everyMs)});
    },
    stopLoop,
    stopLoops(){for(const key of [...loops.keys()])stopLoop(key);},
    subscribe(listener){subscribers.add(listener);listener({enabled,level,supported:this.supported,active:this.active});return()=>subscribers.delete(listener);},
    voices:Object.keys(SOUNDS),
  };
}
