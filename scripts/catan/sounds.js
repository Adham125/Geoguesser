// Synthesized sound effects for Catan (Web Audio, no asset files).
// The AudioContext can only start after a user gesture — we lazily create
// it on the first pointer/key event, so early events are simply silent.

let ctx = null;
let master = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

for (const ev of ["pointerdown", "keydown"]) {
  window.addEventListener(ev, () => ensureCtx(), { once: true, passive: true });
}

function tone({ freq, end = freq, dur = 0.15, type = "sine", gain = 0.18, at = 0 }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.06, gain = 0.15, at = 0, filterFreq = 2500 }) {
  if (!ensureCtx()) return;
  const t0 = ctx.currentTime + at;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

const effects = {
  // Dice rattle: a few quick clicks then a landing tap.
  roll() {
    noise({ dur: 0.04, at: 0, filterFreq: 3200, gain: 0.2 });
    noise({ dur: 0.04, at: 0.07, filterFreq: 2600, gain: 0.16 });
    noise({ dur: 0.04, at: 0.13, filterFreq: 3600, gain: 0.18 });
    tone({ freq: 220, end: 160, dur: 0.08, type: "triangle", gain: 0.12, at: 0.2 });
  },
  // Hammer thunk for any build/placement.
  build() {
    tone({ freq: 170, end: 60, dur: 0.16, type: "triangle", gain: 0.25 });
    noise({ dur: 0.05, filterFreq: 1800, gain: 0.12 });
  },
  // Coin chime for bank trades.
  trade() {
    tone({ freq: 880, dur: 0.1, type: "sine", gain: 0.14 });
    tone({ freq: 1318, dur: 0.18, type: "sine", gain: 0.12, at: 0.09 });
  },
  // Low ominous slide when the robber moves.
  robber() {
    tone({ freq: 130, end: 55, dur: 0.45, type: "sawtooth", gain: 0.12 });
  },
  // Soft puff for discards.
  discard() {
    noise({ dur: 0.12, filterFreq: 900, gain: 0.14 });
  },
  // Little fanfare on game over.
  win() {
    tone({ freq: 523, dur: 0.16, type: "triangle", gain: 0.16, at: 0 });
    tone({ freq: 659, dur: 0.16, type: "triangle", gain: 0.16, at: 0.14 });
    tone({ freq: 784, dur: 0.16, type: "triangle", gain: 0.16, at: 0.28 });
    tone({ freq: 1046, dur: 0.4, type: "triangle", gain: 0.18, at: 0.42 });
  },
};

export function playSound(name) {
  const fx = effects[name];
  if (fx) { try { fx(); } catch { /* audio is best-effort */ } }
}
