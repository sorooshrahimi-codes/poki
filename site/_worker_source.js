// Serves the three games from the public GitHub repo (pinned to one commit), with the right content types.
const BASE2 = "https://cdn.jsdelivr.net/gh/sorooshrahimi-codes/poki@665d85ba06fbc4e78f5a8f0ba7797555187422cc/site";
const BASE = "https://raw.githubusercontent.com/sorooshrahimi-codes/poki/665d85ba06fbc4e78f5a8f0ba7797555187422cc/site";
const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", woff: "font/woff", woff2: "font/woff2", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", ico: "image/x-icon", txt: "text/plain; charset=utf-8" };
// a tiny shared leaderboard for Glowmites: the best score of each player (top 100 kept in one KV key)
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json" };
async function board(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  let top = []; try { top = JSON.parse((await env.LB.get("top")) || "[]"); } catch { top = []; }
  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return new Response("{}", { status: 400, headers: CORS }); }
    const id = String(b.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 24), name = String(b.name || "").replace(/[<>&"'\\]/g, "").slice(0, 16).trim() || "Glowmite";
    const s = Math.floor(Number(b.score)), l = Math.max(1, Math.min(99, Math.floor(Number(b.land) || 1)));
    if (!id || !(s > 0) || s > 50000000) return new Response("{}", { status: 400, headers: CORS });
    const me = top.find((e) => e.id === id);
    if (me) { if (s > me.s) { me.s = s; me.l = l; } me.n = name; } else top.push({ id, n: name, s, l });
    top.sort((a, c) => c.s - a.s); top = top.slice(0, 100);
    await env.LB.put("top", JSON.stringify(top));
  }
  return new Response(JSON.stringify(top.slice(0, 50).map((e) => ({ id: e.id.slice(0, 6), n: e.n, s: e.s, l: e.l }))), { headers: CORS });
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/lb") return board(req, env);
    let p = decodeURIComponent(url.pathname);
    if (p.includes("..")) return new Response("Not found", { status: 404 });
    if (!/\.[a-z0-9]+$/i.test(p) && !p.endsWith("/")) return Response.redirect(url.origin + p + "/" + url.search, 301);
    if (p.endsWith("/")) p += "index.html";
    let r = await fetch(BASE + p, { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (!r.ok) r = await fetch(BASE2 + p, { cf: { cacheTtl: 86400, cacheEverything: true } }); // a second source if the first one hiccups
    if (!r.ok) return new Response("Not found", { status: 404 });
    const ext = (p.split(".").pop() || "").toLowerCase();
    const h = new Headers();
    h.set("content-type", TYPES[ext] || "application/octet-stream");
    h.set("cache-control", ext === "html" ? "public, max-age=300" : "public, max-age=86400");
    h.set("access-control-allow-origin", "*");
    return new Response(r.body, { status: 200, headers: h });
  },
};
