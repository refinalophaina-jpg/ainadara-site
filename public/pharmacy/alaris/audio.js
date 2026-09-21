// Original, synthesized training soundscape.
//
// HONESTY BOUNDARY: these are not manufacturer signals and are not an IEC 60601-1-8
// alarm melody. Pitch, rhythm, stereo position and loudness carry no clinical meaning.
// They provide interface feedback and atmosphere only; teach alarm recognition on the
// institution's real equipment.

const PREF_KEY = 'alaris-audio';
// Fallback placement when a caller does not provide the assembly-aware pan. The device view
// supplies exact left/right positions for each 2/3/4-module layout.
const CHANNEL_PAN = { A:-0.68, B:-0.24, C:0.26, D:0.68 };
const SOUNDS = {
  // Each step may contain harmonically related layers. Conservative gain keeps repeated
  // controls comfortable while a compressor catches coincident multi-channel events.
  key:      [{at:0,layers:[[1180,.026,.022,'square'],[590,.036,.014,'triangle']]}],
  switch:   [{at:0,layers:[[720,.035,.022,'triangle'],[1080,.025,.012,'sine']]}],
  accept:   [{at:0,layers:[[880,.065,.035,'sine'],[1320,.075,.018,'triangle']]},{at:.075,layers:[[1320,.08,.032,'sine'],[1760,.06,.014,'sine']]}],
  reject:   [{at:0,layers:[[235,.16,.045,'square'],[117.5,.19,.026,'triangle']]},{at:.11,layers:[[196,.18,.034,'sawtooth']]}],
  soft:     [{at:0,layers:[[740,.11,.036,'triangle'],[1110,.12,.017,'sine']]},{at:.21,layers:[[880,.12,.038,'triangle'],[1320,.1,.016,'sine']]}],
  blocked:  [{at:0,layers:[[390,.13,.047,'sawtooth'],[195,.16,.025,'triangle']]},{at:.22,layers:[[330,.13,.043,'sawtooth']]},{at:.44,layers:[[277,.16,.04,'sawtooth']]}],
  alarm:    [{at:0,layers:[[784,.12,.052,'square'],[392,.14,.021,'triangle']]},{at:.19,layers:[[932,.12,.05,'square'],[466,.14,.02,'triangle']]},{at:.38,layers:[[784,.12,.052,'square'],[392,.14,.021,'triangle']]}],
  complete: [{at:0,layers:[[659,.085,.03,'sine']]},{at:.11,layers:[[988,.09,.034,'sine']]},{at:.23,layers:[[1318,.13,.037,'sine'],[659,.15,.014,'triangle']]}],
  power:    [{at:0,layers:[[220,.13,.024,'triangle']]},{at:.10,layers:[[440,.11,.028,'sine']]},{at:.19,layers:[[660,.12,.026,'sine']]}],
  start:    [{at:0,layers:[[165,.08,.026,'triangle'],[330,.06,.014,'square']]},{at:.12,layers:[[247,.10,.027,'triangle'],[494,.07,.012,'sine']]}],
  flow:     [{at:0,layers:[[186,.038,.010,'triangle'],[372,.024,.006,'sine']]}],
};

export function createAudio() {
  let context = null, enabled = read(), output = null;
  const loops = new Map();

  function read() {
    try { return localStorage.getItem(PREF_KEY) === 'on'; } catch { return false; }
  }
  function persist(value) {
    try { localStorage.setItem(PREF_KEY, value ? 'on' : 'off'); } catch { /* storage may be blocked */ }
  }
  function ready() {
    if (!enabled) return null;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    if (!context) {
      try {
        context = new Ctor();
        const compressor=context.createDynamicsCompressor(),master=context.createGain();
        compressor.threshold.value=-24;compressor.knee.value=18;compressor.ratio.value=5;
        compressor.attack.value=.004;compressor.release.value=.18;master.gain.value=.72;
        compressor.connect(master).connect(context.destination);output=compressor;
      } catch { context=null;output=null;return null; }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
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
  function play(name,options={}) {
    const pattern=SOUNDS[name],ctx=ready();
    if(!pattern||!ctx||!output)return false;
    const pan=Number.isFinite(options.pan)?options.pan:(CHANNEL_PAN[options.channel]??0),base=ctx.currentTime+.012;
    pattern.forEach(step=>step.layers.forEach((layer,index)=>tone(layer,base+step.at,pan,index)));
    return true;
  }
  function stopLoop(key){const active=loops.get(key);if(active){clearInterval(active.timer);loops.delete(key);}}

  return {
    get enabled(){return enabled;},
    supported:!!(globalThis.AudioContext||globalThis.webkitAudioContext),
    set(value){
      enabled=!!value;persist(enabled);
      if(!enabled){for(const key of [...loops.keys()])stopLoop(key);context?.suspend?.().catch(()=>{});}
      else play('accept');
      return enabled;
    },
    toggle(){return this.set(!enabled);},
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
    voices:Object.keys(SOUNDS),
  };
}
