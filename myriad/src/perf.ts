// Smoothness is a feature. The governor watches frame times and steps quality down (render scale first,
// then bloom, then mite detail) before the player could ever feel a hitch; it steps back up slowly (hysteresis).
// The HUD draws the frame-time graph so smoothness can be proven, not just claimed.

export interface Tier { scale: number; bloom: number }
export const TIERS: Tier[] = [
  { scale: 1.0, bloom: 5 },
  { scale: 0.85, bloom: 5 },
  { scale: 0.72, bloom: 4 },
  { scale: 0.62, bloom: 3 },
  { scale: 0.52, bloom: 3 },
];

export class Governor {
  tier = 1;
  budget = 1000 / 60;
  private hist = new Float32Array(240);
  private sorted = new Float32Array(60);
  private i = 0;
  private calm = 0; // seconds in a row with plenty of headroom
  private cool = 0; // seconds before the next change is allowed
  private drift = 0; // slow average, to notice thermal throttling
  frames = 0;
  setRefresh(hz: number) { this.budget = 1000 / Math.min(120, Math.max(60, hz)); }
  push(ms: number) {
    this.hist[this.i] = ms; this.i = (this.i + 1) % this.hist.length; this.frames++;
  }
  /** the 90th percentile of the last 60 frames */
  p90() {
    // no allocation: always the last 60 frames, sorted in a fixed array
    for (let k = 0; k < 60; k++) this.sorted[k] = this.hist[(this.i - 1 - k + this.hist.length) % this.hist.length];
    this.sorted.sort();
    return this.sorted[54];
  }
  update(dt: number) {
    if (this.frames < 30) return;
    this.cool -= dt;
    const p = this.p90();
    this.drift += (p - this.drift) * Math.min(1, dt * 0.2);
    if (this.cool > 0) return;
    if (p > this.budget * 1.08 && this.tier < TIERS.length - 1) { this.tier++; this.cool = 0.6; this.calm = 0; return; }
    if (p < this.budget * 0.62) this.calm += dt; else this.calm = 0;
    // step up only after a long calm, and never back into a tier the device recently could not hold
    if (this.calm > 4 && this.tier > 0 && this.drift < this.budget * 0.7) { this.tier--; this.cool = 2; this.calm = 0; }
  }
  graph(ctx: CanvasRenderingContext2D, info: string) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
    const top = 34, gh = H - top - 6, scale = gh / (this.budget * 2);
    // the budget line
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.moveTo(0, top + gh - this.budget * scale); ctx.lineTo(W, top + gh - this.budget * scale); ctx.stroke();
    const n = this.hist.length;
    for (let k = 0; k < n; k++) {
      const ms = this.hist[(this.i + k) % n];
      const h = Math.min(gh, ms * scale);
      ctx.fillStyle = ms > this.budget * 1.5 ? "#ff5a5a" : ms > this.budget * 1.05 ? "#ffd35a" : "#5affb0";
      ctx.fillRect((k * W) / n, top + gh - h, Math.ceil(W / n), h);
    }
    ctx.fillStyle = "#fff"; ctx.font = "12px monospace";
    ctx.fillText(info, 6, 14);
    ctx.fillText(`p90 ${this.p90().toFixed(1)} ms  budget ${this.budget.toFixed(1)}  tier ${this.tier}`, 6, 28);
  }
}
