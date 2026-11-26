// Glowmites QA pipeline: a bot plays the whole journey (land 1 to 5 and through the last gate) in a headless
// browser and reports every task: how long it took, whether the game had to step in, and any error.
// usage: npm run build:qa && node qa/playtest.cjs [minutes=40] [startLevel]
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..", "dist-qa"), MIN = Number(process.argv[2] || 40), LVL = process.argv[3];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
}).listen(0, async () => {
  const port = srv.address().port;
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 200, height: 360 } });
  const steps = [], errs = [], autos = []; let cur = null, done = false;
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => {
    const t = m.text(); if (!t.startsWith("[gm]")) return; console.log(t);
    const g = t.match(/t=([\d.]+) size=(\d+) score=(\d+) (\w+) (.*)/); if (!g) return;
    const [, tm, size, score, kind, rest] = g;
    if (kind === "STEP") { cur = { step: rest, t0: +tm, size0: +size }; steps.push(cur); if (/lap=1/.test(rest)) done = true; }
    if (kind === "DONE" && cur) { cur.took = +rest.split("took=")[1]; cur.size1 = +size; cur.score = +score; }
    if (kind === "AUTO") autos.push(rest);
  });
  // a fresh player: no save, no leaderboard posts (blocked)
  await p.route("**/api/lb", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await p.goto(`http://localhost:${port}/?bot=1&dtmax=0.1&hud=0&tier=4${LVL ? `&lvl=${LVL}` : ""}`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  const end = Date.now() + MIN * 60000;
  while (!done && Date.now() < end && errs.length === 0) await p.waitForTimeout(3000);
  await b.close(); srv.close();
  console.log("\n==== playtest report ====");
  for (const s of steps) console.log(`${s.step.padEnd(44)} took ${s.took ?? "—"}s  size ${s.size0}→${s.size1 ?? "?"}`);
  console.log(`reached the end: ${done}`); console.log(`auto-completed (stuck): ${autos.length ? autos.join(", ") : "none"}`); console.log(`errors: ${errs.length ? errs.join(" | ") : "none"}`);
  process.exit(done && !autos.length && !errs.length ? 0 : 1);
});
