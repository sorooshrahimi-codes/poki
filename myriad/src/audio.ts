// All sound is synthesized: no files, no download. Started on the first touch (browser rule).
//  - the swarm: filtered noise through two resonant bands; louder, brighter and wider as the swarm grows and speeds up
//  - eating: tiny crunchy clicks, as many as the swarm is biting
//  - falling: a low thump with a crumble tail
//  - growth: a soft chime when the swarm passes milestones

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode; hum!: GainNode; bandA!: BiquadFilterNode; bandB!: BiquadFilterNode; noise!: AudioBuffer;
  muted = false;
  private crunchDebt = 0;
  start() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    comp.connect(this.master);
    // one second of noise, reused by everything
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    this.bandA = ctx.createBiquadFilter(); this.bandA.type = "bandpass"; this.bandA.frequency.value = 320; this.bandA.Q.value = 2.2;
    this.bandB = ctx.createBiquadFilter(); this.bandB.type = "bandpass"; this.bandB.frequency.value = 1900; this.bandB.Q.value = 5;
    this.hum = ctx.createGain(); this.hum.gain.value = 0;
    src.connect(this.bandA); src.connect(this.bandB);
    this.bandA.connect(this.hum); this.bandB.connect(this.hum);
    this.hum.connect(comp);
    src.start();
    this.out = comp;
  }
  out!: AudioNode;
  setMuted(m: boolean) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }
  /** every frame: the swarm's size (count) and speed shape its sound */
  swarm(count: number, speed: number) {
    const c = this.ctx; if (!c) return;
    const k = Math.min(1, Math.log10(Math.max(10, count)) / 5.3); // 200k ~ 1
    const now = c.currentTime;
    this.hum.gain.setTargetAtTime(0.05 + 0.32 * k * (0.7 + Math.min(speed, 25) / 60), now, 0.2);
    this.bandA.frequency.setTargetAtTime(180 + 260 * k + speed * 6, now, 0.3);
    this.bandB.frequency.setTargetAtTime(1500 + 900 * k + speed * 25, now, 0.3);
  }
  /** called with how much was eaten since the last call: crunches, spread over the next moments */
  eat(amount: number) {
    const c = this.ctx; if (!c) return;
    this.crunchDebt += Math.min(amount, 40) * 0.6;
    const n = Math.min(8, Math.floor(this.crunchDebt));
    this.crunchDebt -= n;
    for (let i = 0; i < n; i++) this.click(c.currentTime + Math.random() * 0.15, 0.04 + Math.random() * 0.05);
  }
  private click(t: number, vol: number) {
    const c = this.ctx!;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2200 + Math.random() * 3000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.035);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.9, 0.05);
  }
  /** something big came down */
  thump(size: number) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * size, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 1);
    // the crumble tail
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
    const g2 = c.createGain(); g2.gain.setValueAtTime(0.25 * size, t); g2.gain.exponentialRampToValueAtTime(0.0005, t + 1.3);
    s.connect(f); f.connect(g2); g2.connect(this.out); s.start(t, 0, 1.3);
  }
  /** a soft chime (pentatonic), higher for bigger milestones */
  chime(step: number) {
    const c = this.ctx; if (!c) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const t = c.currentTime;
    [0, 4, 7].forEach((iv, i) => {
      const o = c.createOscillator(); o.type = "triangle";
      o.frequency.value = 440 * Math.pow(2, (scale[step % scale.length] + iv - 9) / 12);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.06); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.06 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.06 + 1.2);
      o.connect(g); g.connect(this.out); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 1.3);
    });
  }
}
