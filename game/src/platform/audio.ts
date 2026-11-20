import type { Rarity, ZoneId } from "../core/types.ts";

// A tiny synth: cute marimba/bell/bubble voices and a gentle procedural music loop.
// Zero audio files. Everything goes through one master gain, muted while ads play.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let ducked = false;

export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    startMusic();
  } catch {
    ctx = null;
  }
}

function apply() {
  if (master && ctx) master.gain.setTargetAtTime(muted || ducked ? 0 : 0.6, ctx.currentTime, 0.05);
}
export function setMuted(m: boolean) { muted = m; apply(); }
export function setDucked(d: boolean) { ducked = d; apply(); }

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** marimba-ish: sine + a quiet 4th harmonic, very fast decay */
function mallet(freq: number, t: number, vol: number, bus: GainNode, dur = 0.5) {
  const c = ctx!;
  for (const [mult, v, d] of [[1, 1, dur], [4, 0.18, dur * 0.25], [10, 0.05, 0.05]] as const) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
  }
}

/** glassy bell for sparkles and reveals */
function bell(freq: number, t: number, vol: number, dur = 0.9) {
  const c = ctx!;
  for (const [mult, v] of [[1, 1], [2.76, 0.35], [5.4, 0.12]] as const) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mult);
    o.connect(g).connect(sfxBus!); o.start(t); o.stop(t + dur + 0.05);
  }
}

/** rising pitch sweep: the classic cute bubble "bloop" */
function bloop(from: number, to: number, t: number, vol: number, dur = 0.12) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus!); o.start(t); o.stop(t + dur + 0.02);
}

function noise(t: number, dur: number, vol: number, freq: number, q = 1, sweepTo?: number) {
  const c = ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = "bandpass"; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus!); s.start(t, Math.random() * 0.5); s.stop(t + dur);
}

const now = () => ctx!.currentTime;
const ok = () => !!ctx && !!sfxBus;
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, secret: 4 };
// C major pentatonic: nothing can sound wrong
const PENTA = [0, 2, 4, 7, 9];

export const sfx = {
  cast() {
    if (!ok()) return; const t = now();
    noise(t, 0.25, 0.25, 1800, 0.7, 5000); // whoosh
    bloop(900, 300, t + 0.18, 0.25, 0.2);
  },
  splash() {
    if (!ok()) return; const t = now();
    noise(t, 0.35, 0.35, 900, 0.8, 300);
    bloop(300, 700, t + 0.05, 0.18, 0.1); bloop(400, 900, t + 0.12, 0.12, 0.08);
  },
  hook(r: Rarity) {
    if (!ok()) return; const t = now();
    bloop(500 + RANK[r] * 120, 1200 + RANK[r] * 300, t, 0.3, 0.09);
    if (RANK[r] >= 1) bell(midi(84 + PENTA[RANK[r]]), t + 0.05, 0.12);
  },
  turn() { if (!ok()) return; const t = now(); bloop(400, 800, t, 0.15, 0.15); },
  reel() { if (!ok()) return; noise(now(), 0.03, 0.12, 3500, 6); },
  coin(i = 0) { if (!ok()) return; const t = now(); bell(midi(88 + PENTA[i % 5]), t, 0.13, 0.4); },
  reveal(r: Rarity) {
    if (!ok()) return; const t = now(), k = RANK[r];
    const notes = [[0], [0, 4], [0, 4, 7], [0, 4, 7, 12, 16], [0, 7, 12, 16, 19, 24]][k];
    notes.forEach((n, i) => mallet(midi(72 + n), t + i * 0.08, 0.3, sfxBus!, 0.6));
    if (k >= 2) for (let i = 0; i < 6 + k * 3; i++) bell(midi(96 + PENTA[i % 5] + 12 * Math.floor(i / 5)) / 2, t + 0.3 + i * 0.04, 0.05, 0.5);
  },
  snap() {
    if (!ok()) return; const t = now();
    bloop(1200, 120, t, 0.3, 0.35); noise(t, 0.2, 0.2, 2500, 2);
    mallet(midi(60), t + 0.25, 0.25, sfxBus!); mallet(midi(55), t + 0.4, 0.25, sfxBus!);
  },
  fightTick(inZone: boolean) { if (!ok()) return; noise(now(), 0.025, inZone ? 0.09 : 0.05, inZone ? 4200 : 1500, 5); },
  buy() { if (!ok()) return; const t = now(); [0, 4, 7, 12].forEach((n, i) => mallet(midi(76 + n), t + i * 0.06, 0.25, sfxBus!, 0.4)); },
  event() { if (!ok()) return; const t = now(); [0, 4, 7, 11, 14, 19].forEach((n, i) => bell(midi(76 + n), t + i * 0.1, 0.12, 1.2)); },
  tap() { if (!ok()) return; bloop(700, 1100, now(), 0.12, 0.06); },
  newFish() { if (!ok()) return; const t = now(); [0, 7, 12].forEach((n, i) => bell(midi(88 + n), t + i * 0.07, 0.12, 0.8)); },
};

// ----------------------------------------------------------------- music
// A 16-step loop at a relaxed tempo: soft bass, marimba melody from the pentatonic scale, a
// shaker. The mood follows the zone and depth: deeper = lower, sparser and darker.
let musicTimer = 0;
let step = 0;
let nextT = 0;
let mood: { zone: ZoneId; depth: number; event: boolean } = { zone: "lake", depth: 0, event: false };
let melody: number[] = [];

export function setMusicMood(zone: ZoneId, depth: number, event: boolean) { mood = { zone, depth, event }; }

function newPhrase() {
  // a gentle random walk on the pentatonic scale, with rests
  let i = 2; melody = [];
  for (let s = 0; s < 16; s++) {
    if (Math.random() < 0.35) { melody.push(-1); continue; }
    i = Math.max(0, Math.min(9, i + Math.floor(Math.random() * 5) - 2));
    melody.push(PENTA[i % 5] + 12 * Math.floor(i / 5));
  }
}

const CHORDS = [[48, 55], [45, 52], [41, 48], [43, 50]]; // C, Am, F, G roots + fifths

function tick() {
  if (!ctx || !musicBus) return;
  const spb = 60 / 96 / 2; // eighth notes at 96 bpm
  while (nextT < ctx.currentTime + 0.25) {
    const deep = Math.min(1, mood.depth / 2500);
    const base = (mood.zone === "ocean" ? 2 : 0) - Math.round(deep * 5);
    const s = step % 16, bar = Math.floor(step / 16) % 4;
    if (s === 0 && bar === 0) newPhrase();
    const chord = CHORDS[bar];
    if (s % 8 === 0) for (const n of chord) mallet(midi(n + base), nextT, 0.22, musicBus, 1.2);
    const m = melody[s];
    if (m >= 0 && Math.random() > deep * 0.5) mallet(midi(72 + base + m + (mood.event ? 12 : 0)), nextT, 0.13, musicBus, 0.45);
    if (s % 2 === 1 && deep < 0.7) {
      const sh = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      sh.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = 7000;
      g.gain.setValueAtTime(0.025, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.05);
      sh.connect(f).connect(g).connect(musicBus); sh.start(nextT, Math.random()); sh.stop(nextT + 0.06);
    }
    nextT += spb; step++;
  }
}

function startMusic() {
  if (!ctx || musicTimer) return;
  nextT = ctx.currentTime + 0.1;
  musicTimer = window.setInterval(tick, 90);
}
