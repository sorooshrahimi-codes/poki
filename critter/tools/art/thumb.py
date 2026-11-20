"""Poki thumbnails for Critter Vac: 628x628 and 1280x720, from the game's own art.
The whole game in one glance: a kid vacuuming up a swirl of cute critters, one of them golden.
Usage: python3 -I thumb.py OUT_DIR"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "..", "public", "art")
FONT = os.path.join(HERE, "..", "..", "..", "game", "node_modules", "@fontsource", "fredoka", "files", "fredoka-latin-700-normal.woff")


def sprite(name, width):
    im = Image.open(os.path.join(ART, name + ".webp")).convert("RGBA")
    return im.resize((max(1, width), max(1, round(im.height * width / im.width))), Image.LANCZOS)


def gold(im):
    g = ImageOps.autocontrast(im.convert("L"), cutoff=2)
    out = ImageOps.colorize(g, black="#4a2200", mid="#ffa000", white="#fff3a0", midpoint=175).convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def title(img, text, cx, y, size):
    f = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(img)
    x = cx - d.textlength(text, font=f) / 2
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + size * 0.1), text, font=f, fill=(13, 30, 69, 255), stroke_width=int(size * 0.14), stroke_fill=(13, 30, 69, 255))
    img.alpha_composite(sh)
    d.text((x, y), text, font=f, fill=(255, 255, 255, 255), stroke_width=int(size * 0.12), stroke_fill=(22, 52, 94, 255))
    mask = Image.new("L", img.size, 0); ImageDraw.Draw(mask).text((x, y), text, font=f, fill=255)
    grad = Image.new("RGBA", img.size); gd = ImageDraw.Draw(grad)
    for yy in range(int(y), int(y + size * 1.2)):
        k = (yy - y) / (size * 1.2)
        gd.line([(0, yy), (img.width, yy)], fill=(int(140 + 100 * (1 - k)), 255, int(120 + 60 * (1 - k)), 255))
    img.paste(grad, (0, 0), mask)


def make(w, h, out):
    img = Image.new("RGBA", (w, h))
    bg = Image.open(os.path.join(ART, "bg_meadow.webp")).convert("RGBA")
    k = max(w / bg.width, h / bg.height)
    bg = bg.resize((math.ceil(bg.width * k), math.ceil(bg.height * k)), Image.LANCZOS)
    img.alpha_composite(bg, ((w - bg.width) // 2, h - bg.height))
    u = min(w, h)
    sq = w == h
    kid = sprite("kid_vac_suck", int(u * (0.44 if sq else 0.5)))
    kx, ky = int(w * 0.04), int(h * 0.98 - kid.height)
    nx, ny = kx + kid.width * 0.97, ky + kid.height * 0.5  # nozzle tip
    # the suction cone: a soft light wedge toward the upper right
    cone = Image.new("RGBA", (w, h), (0, 0, 0, 0)); cd = ImageDraw.Draw(cone)
    ang, spread, R = -0.42, 0.5, u * 0.95
    pts = [(nx, ny)] + [(nx + math.cos(ang + a) * R, ny + math.sin(ang + a) * R) for a in [spread * (i / 10 - 0.5) * 2 for i in range(11)]]
    cd.polygon(pts, fill=(210, 245, 255, 120))
    img.alpha_composite(cone.filter(ImageFilter.GaussianBlur(u * 0.02)))
    d = ImageDraw.Draw(img)
    # streaks rushing into the nozzle
    for i in range(14):
        a = ang + spread * ((i * 0.37) % 1 - 0.5) * 1.6
        r0 = u * (0.15 + (i * 0.23) % 0.6)
        x0, y0 = nx + math.cos(a) * r0, ny + math.sin(a) * r0
        d.line([(x0, y0), (x0 - math.cos(a) * u * 0.06, y0 - math.sin(a) * u * 0.06)], fill=(255, 255, 255, 230), width=max(2, u // 160))
    # critters flying in, stretched toward the nozzle, smaller the closer they are
    sc = 0.62 if sq else 1
    flying = [("puffbun", 0.55 * sc, 0.0), ("bumbo", 0.75 * sc, -0.18), ("dewdrop", 0.38 * sc, -0.02), ("mushi", 0.9 * sc, 0.12), ("sprig", 0.62 * sc, 0.22)]
    for name, dist, da in flying:
        a = ang + da
        x, y = nx + math.cos(a) * u * dist, ny + math.sin(a) * u * dist
        s = int(u * (0.1 + 0.11 * dist))
        sp = sprite(name, s).rotate(math.degrees(-a) * 0.3, expand=True, resample=Image.BICUBIC)
        sp = sp.resize((int(sp.width * 1.15), int(sp.height * 0.92)))
        img.alpha_composite(sp, (int(x - sp.width / 2), int(y - sp.height / 2)))
    # the golden star of the shot, glowing
    g = gold(sprite("prismane", int(u * 0.34)))
    gx, gy = int(w * 0.74 - g.width / 2), int(h * (0.3 if sq else 0.2))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([gx - u * 0.05, gy - u * 0.05, gx + g.width + u * 0.05, gy + g.height + u * 0.05], fill=(255, 225, 120, 200))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(u * 0.06)))
    img.alpha_composite(g, (gx, gy))
    img.alpha_composite(kid, (kx, ky))
    for sx, sy in [(0.88, 0.14), (0.6, 0.1), (0.95, 0.4), (0.66, 0.42)]:
        cx, cy, s = w * sx, h * sy, u * 0.025
        d.polygon([(cx, cy - s * 2), (cx + s * 0.5, cy - s * 0.5), (cx + s * 2, cy), (cx + s * 0.5, cy + s * 0.5), (cx, cy + s * 2), (cx - s * 0.5, cy + s * 0.5), (cx - s * 2, cy), (cx - s * 0.5, cy - s * 0.5)], fill=(255, 250, 200, 255))
    title(img, "Critter Vac", w * (0.5 if sq else 0.62), h * (0.03 if sq else 0.68), int(u * 0.15))
    img.convert("RGB").save(out, quality=92)
    print(out, img.size)


if __name__ == "__main__":
    o = sys.argv[1]; os.makedirs(o, exist_ok=True)
    make(628, 628, os.path.join(o, "thumb_628.jpg"))
    make(1280, 720, os.path.join(o, "thumb_1280x720.jpg"))
