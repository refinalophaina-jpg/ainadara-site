// Synthesized training tones.
//
// HONESTY BOUNDARY: these are original tones generated in the browser with WebAudio. They are
// NOT the manufacturer's alarm signals, not a reproduction of any device's audio, and not an
// IEC 60601-1-8 alarm melody. Pitch, rhythm and loudness carry no clinical meaning. Never teach
// alarm recognition from this simulator's sound; teach it on the real equipment.
//
// No audio files are shipped, so the package stays text-only and CSP-safe.

const PREF_KEY = 'alaris-audio';
const VOICES = {
  // name: [frequency Hz, seconds, gain, waveform, repeats, gap seconds]
  key:      [1200, 0.025, 0.05, 'square',   1, 0],
  accept:   [1760, 0.07,  0.07, 'sine',     1, 0],
  reject:   [220,  0.18,  0.09, 'square',   1, 0],
  soft:     [880,  0.12,  0.08, 'triangle', 2, 0.10],
  blocked:  [440,  0.16,  0.10, 'sawtooth', 3, 0.09],
  alarm:    [988,  0.14,  0.11, 'square',   5, 0.11],
  complete: [1318, 0.10,  0.08, 'sine',     2, 0.13],
  start:    [660,  0.09,  0.07, 'sine',     1, 0],
};

export function createAudio() {
  let context = null, enabled = read(), timers = [];

  function read() {
    try { return localStorage.getItem(PREF_KEY) === 'on'; } catch { return false; }
  }
  function persist(value) {
    try { localStorage.setItem(PREF_KEY, value ? 'on' : 'off'); } catch { /* storage may be blocked */ }
  }
  // Created lazily: browsers only allow an AudioContext to start from a user gesture.
  function ready() {
    if (!enabled) return null;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    if (!context) { try { context = new Ctor(); } catch { return null; } }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(frequency, seconds, gain, waveform, at) {
    const ctx = context;
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = waveform; osc.frequency.setValueAtTime(frequency, at);
    // Short ramps avoid the click an abrupt gate produces.
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain, at + 0.008);
    amp.gain.setValueAtTime(gain, at + seconds - 0.008);
    amp.gain.linearRampToValueAtTime(0, at + seconds);
    osc.connect(amp).connect(ctx.destination);
    osc.start(at); osc.stop(at + seconds + 0.01);
  }

  function play(name) {
    const voice = VOICES[name];
    if (!voice) return false;
    const ctx = ready();
    if (!ctx) return false;
    const [frequency, seconds, gain, waveform, repeats, gap] = voice;
    const base = ctx.currentTime + 0.01;
    for (let i = 0; i < repeats; i++) tone(frequency, seconds, gain, waveform, base + i * (seconds + gap));
    return true;
  }

  return {
    get enabled() { return enabled; },
    supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext),
    set(value) {
      enabled = !!value; persist(enabled);
      if (!enabled) { for (const t of timers) clearInterval(t); timers = []; if (context) context.suspend?.().catch(() => {}); }
      else play('accept');
      return enabled;
    },
    toggle() { return this.set(!enabled); },
    play,
    // A repeating alert, stopped explicitly. Used only while an alarm state is displayed.
    loop(name, everyMs) {
      this.stopLoops();
      if (!enabled) return;
      play(name);
      timers.push(setInterval(() => play(name), everyMs));
    },
    stopLoops() { for (const t of timers) clearInterval(t); timers = []; },
    voices: Object.keys(VOICES),
  };
}
