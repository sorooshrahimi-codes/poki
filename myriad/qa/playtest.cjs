// Glowmites QA pipeline: a bot plays full two-minute arena rounds in a headless browser and reports each round:
// the place, the sizes of all seven swarms, how often the bot ate and was eaten, and any error.
// usage: npm run build:qa && node qa/playtest.cjs [minutes=40] [startLevel]
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, "..", "dist-qa"), MIN = Number(process.argv[2] || 40), ROUNDS = Number(process.argv[3] || 2), LVL = undefined;
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
    if (t.includes("ROUND end")) { steps.push(t.split("ROUND end ")[1]); if (steps.length >= ROUNDS) done = true; else p.evaluate(() => (window).__my.newRound()).catch(() => {}); }
  });
  // a fresh player: no save, no leaderboard posts (blocked)
  await p.route("**/api/lb", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await p.goto(`http://localhost:${port}/?bot=1&dtmax=0.1&hud=0&tier=4&draw=600`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  const end = Date.now() + MIN * 60000;
  while (!done && Date.now() < end && errs.length === 0) await p.waitForTimeout(3000);
  await b.close(); srv.close();
  console.log("\n==== playtest report ====");
  steps.forEach((s, i) => console.log(`round ${i + 1}: ${s}`));
  console.log(`rounds finished: ${steps.length}/${ROUNDS}`); console.log(`errors: ${errs.length ? errs.join(" | ") : "none"}`);
  process.exit(done && !errs.length ? 0 : 1);
});
