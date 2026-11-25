// Serves the three games from the public GitHub repo (pinned to one commit), with the right content types.
const BASE2 = "https://cdn.jsdelivr.net/gh/sorooshrahimi-codes/poki@bdcfdbfccce9017ec0e91ab07c0948543d876dd9/site";
const BASE = "https://raw.githubusercontent.com/sorooshrahimi-codes/poki/bdcfdbfccce9017ec0e91ab07c0948543d876dd9/site";
const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", woff: "font/woff", woff2: "font/woff2", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", ico: "image/x-icon", txt: "text/plain; charset=utf-8" };
export default {
  async fetch(req) {
    const url = new URL(req.url);
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
