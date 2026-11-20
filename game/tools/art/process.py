"""Cut the generated sheets into sprites, trim, downscale and export WebP into game/public/art.
Usage: python3 -I process.py RAW_DIR"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "art")

# 2x2 sheets: names in order top-left, top-right, bottom-left, bottom-right
SHEETS = {
    "fish_lake1": ["minnow", "perch", "trout", "koi_queen"],
    "fish_lake2": ["bluegill", "catfish", "pike", "glow_eel"],
    "fish_lake3": ["moon_pike", "old_boot", "rubber_duck", "soda_can"],
    "fish_ocean1": ["sardine", "clownfish", "mackerel", "puffer"],
    "fish_ocean2": ["jelly", "tuna", "swordfish", "angler"],
    "props_lake": ["p_reeds", "p_boulder", "p_post", "p_grass"],
    "props_ocean": ["p_kelp", "p_coral", "p_anemone", "p_glow"],
    "icons": ["i_coin", "i_line", "i_hooks", "i_luck"],
}
SINGLES = {"fish_whiskers": "old_whiskers", "fish_marlin": "grand_marlin", "fish_whale": "star_whale", "boat": "boat",
           "lake_floor": "floor_lake", "ocean_floor": "floor_ocean"}
BACKGROUNDS = {"lake_surface": "bg_lake", "ocean_surface": "bg_ocean"}
MAX = {"i_": 128, "p_": 360, "floor_": 1024, "boat": 420, "old_whiskers": 420, "grand_marlin": 420, "star_whale": 480}

def max_for(name):
    for k, v in MAX.items():
        if name.startswith(k): return v
    return 300

def trim(im):
    """keep only the largest opaque blob (drops slivers of neighbouring sprites), then crop to it"""
    a = im.getchannel("A")
    small = a.resize((a.width // 4, a.height // 4)).point(lambda v: 1 if v > 40 else 0)
    w, h = small.size; px = small.load(); seen = [[False] * w for _ in range(h)]
    best = None
    for y0 in range(h):
        for x0 in range(w):
            if not px[x0, y0] or seen[y0][x0]: continue
            stack = [(x0, y0)]; seen[y0][x0] = True; n = 0; bx = [x0, y0, x0, y0]
            while stack:
                x, y = stack.pop(); n += 1
                bx[0] = min(bx[0], x); bx[1] = min(bx[1], y); bx[2] = max(bx[2], x); bx[3] = max(bx[3], y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny][nx]:
                        seen[ny][nx] = True; stack.append((nx, ny))
            if not best or n > best[0]: best = (n, bx)
    if not best: return im
    x0, y0, x1, y1 = best[1]
    box = (max(0, x0 * 4 - 6), max(0, y0 * 4 - 6), min(im.width, x1 * 4 + 10), min(im.height, y1 * 4 + 10))
    im = im.crop(box)
    bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    return im.crop(bb) if bb else im

def save(im, name):
    m = max_for(name)
    im.thumbnail((m, m), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=86, method=6)
    print(f"{name:14s} {im.size}")

def main(raw):
    os.makedirs(OUT, exist_ok=True)
    for sheet, names in SHEETS.items():
        p = os.path.join(raw, sheet + ".png")
        if not os.path.exists(p): print("missing", sheet); continue
        im = Image.open(p).convert("RGBA"); w, h = im.size
        for i, n in enumerate(names):
            x, y = (i % 2) * w // 2, (i // 2) * h // 2
            save(trim(im.crop((x, y, x + w // 2, y + h // 2))), n)
    for src, n in SINGLES.items():
        p = os.path.join(raw, src + ".png")
        if os.path.exists(p): save(trim(Image.open(p).convert("RGBA")), n)
        else: print("missing", src)
    for src, n in BACKGROUNDS.items():
        p = os.path.join(raw, src + ".png")
        if not os.path.exists(p): print("missing", src); continue
        im = Image.open(p).convert("RGB"); im.thumbnail((720, 1080), Image.LANCZOS)
        im.save(os.path.join(OUT, n + ".webp"), "WEBP", quality=80, method=6); print(f"{n:14s} {im.size}")
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"total {total / 1024:.0f} KB in {len(os.listdir(OUT))} files")

if __name__ == "__main__":
    main(sys.argv[1])
