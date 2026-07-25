// Sound effects for Catan, played from small CC0 audio files in
// sounds/catan/ (see its README for sources). Files are fetched eagerly;
// decoding waits for the AudioContext, which can only start after a user
// gesture — we lazily create it on the first pointer/key event, so early
// events are simply silent.

const MANIFEST = {
  roll:       { file: "roll.mp3",        gain: 1.0 },
  road:       { file: "road.mp3",        gain: 0.9 },
  settlement: { file: "settlement.mp3",  gain: 1.0 },
  city:       { file: "city.mp3",        gain: 1.0 },
  trade:      { file: "trade.mp3",       gain: 0.8 },
  tradeOffer: { file: "trade_offer.mp3", gain: 0.8 },
  buyDev:     { file: "buy_dev.mp3",     gain: 0.9 },
  playDev:    { file: "play_dev.mp3",    gain: 0.9 },
  knight:     { file: "knight.mp3",      gain: 0.9 },
  robber:     { file: "robber.mp3",      gain: 1.0 },
  steal:      { file: "steal.mp3",       gain: 0.9 },
  discard:    { file: "discard.mp3",     gain: 0.8 },
  gain:       { file: "gain.mp3",        gain: 0.6 },
  award:      { file: "award.mp3",       gain: 0.9 },
  winMe:      { file: "win_me.mp3",      gain: 1.0 },
  winOther:   { file: "win_other.mp3",   gain: 0.8 },
  yourTurn:   { file: "your_turn.mp3",   gain: 1.0 },
};

const MASTER_GAIN = 0.5;

let ctx = null;
let master = null;
let muted = /(?:^|; )catanMuted=1/.test(document.cookie);

const raw = {};     // name -> ArrayBuffer, until decoded
const buffers = {}; // name -> AudioBuffer

for (const name in MANIFEST) {
  fetch(new URL(`../../sounds/catan/${MANIFEST[name].file}`, import.meta.url))
    .then(r => (r.ok ? r.arrayBuffer() : null))
    .then(buf => { if (buf) { raw[name] = buf; decodeOne(name); } })
    .catch(() => { /* missing sound = silent */ });
}

function decodeOne(name) {
  if (!ctx || !raw[name] || buffers[name]) return;
  ctx.decodeAudioData(raw[name].slice(0))
    .then(b => { buffers[name] = b; })
    .catch(() => {});
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    // A batched commit can start several one-shots at the same currentTime
    // (e.g. a Knight that also takes Largest Army); a compressor keeps their
    // sum from exceeding 1.0 and hard-clipping.
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(ctx.destination);
    for (const name in raw) decodeOne(name);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

for (const ev of ["pointerdown", "keydown"]) {
  window.addEventListener(ev, () => ensureCtx(), { once: true, passive: true });
}

export function playSound(name) {
  try {
    if (!ensureCtx() || !buffers[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    const g = ctx.createGain();
    g.gain.value = (MANIFEST[name] && MANIFEST[name].gain) || 1;
    src.connect(g).connect(master);
    src.start();
  } catch { /* audio is best-effort */ }
}

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = !!m;
  document.cookie = `catanMuted=${muted ? 1 : 0};path=/;max-age=31536000;SameSite=Lax`;
  if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
}
