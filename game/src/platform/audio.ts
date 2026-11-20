import type { Rarity } from "../core/types.ts";

// Every sound is synthesised: zero bytes of audio files. Muted while ads play.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let ducked = false;

export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    apply();
  } catch {
    ctx = null;
  }
}

function apply() {
  if (master) master.gain.value = muted || ducked ? 0 : 0.5;
}
export function setMuted(m: boolean) { muted = m; apply(); }
export function setDucked(d: boolean) { ducked = d; apply(); }

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const RARITY_STEP: Record<Rarity, number> = { common: 0, rare: 3, epic: 5, legendary: 7, secret: 9 };

export const sfx = {
  cast: () => { tone(500, 0.25, "sine", 0.2, -350); },
  splash: () => { tone(220, 0.18, "triangle", 0.15, -120); },
  hook: (r: Rarity) => { tone(440 * Math.pow(2, RARITY_STEP[r] / 12), 0.12, "triangle", 0.25); },
  turn: () => { tone(300, 0.15, "sine", 0.15, 200); },
  coin: (i = 0) => { tone(880 + i * 60, 0.08, "square", 0.06, 0, 0); },
  reveal: (r: Rarity) => {
    const base = 392 * Math.pow(2, RARITY_STEP[r] / 12);
    const notes = r === "common" ? [0] : r === "rare" ? [0, 4] : [0, 4, 7, 12];
    notes.forEach((n, i) => tone(base * Math.pow(2, n / 12), 0.22, "triangle", 0.22, 0, i * 0.08));
  },
  snap: () => { tone(900, 0.3, "sawtooth", 0.15, -800); },
  fightTick: (inZone: boolean) => { tone(inZone ? 660 : 200, 0.04, "square", 0.04); },
  buy: () => { tone(523, 0.1, "triangle", 0.2); tone(784, 0.15, "triangle", 0.2, 0, 0.08); },
  event: () => { [0, 3, 7, 10].forEach((n, i) => tone(330 * Math.pow(2, n / 12), 0.3, "sine", 0.2, 0, i * 0.12)); },
};
