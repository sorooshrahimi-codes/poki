"""Poki thumbnails from the game's own art: 628x628 (square) and 1280x720 (wide).
The story in one glance: a happy kid, a huge golden catch bursting out of the water, the title.
Usage: python3 -I thumb.py OUT_DIR"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "..", "public", "art")
FONT = os.path.join(HERE, "..", "..", "node_modules", "@fontsource", "fredoka", "files", "fredoka-latin-700-normal.woff")


def sprite(name, width):
    im = Image.open(os.path.join(ART, name + ".webp")).convert("RGBA")
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def tint_gold(im):
    """recolour a sprite gold, keeping its shading (the game's 'gold' mutation look)"""
    g = ImageOps.autocontrast(im.convert("L"), cutoff=2)
    gold = ImageOps.colorize(g, black="#4a2200", mid="#ffa000", white="#fff3a0", midpoint=175)
    out = gold.convert("RGBA"); out.putalpha(im.getchannel("A"))
    return out


def glow(size, center, radius, color):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = radius * 0.55
    d.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=color)
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.35))


def title(img, text, cx, y, size):
    f = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(img)
    w = d.textlength(text, font=f)
    x = cx - w / 2
    # thick navy outline, a drop shadow, then a gold-to-orange fill
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + size * 0.1), text, font=f, fill=(13, 30, 69, 255), stroke_width=int(size * 0.14), stroke_fill=(13, 30, 69, 255))
    img.alpha_composite(sh)
    d.text((x, y), text, font=f, fill=(255, 255, 255, 255), stroke_width=int(size * 0.12), stroke_fill=(22, 52, 94, 255))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).text((x, y), text, font=f, fill=255)
    grad = Image.new("RGBA", img.size)
    gd = ImageDraw.Draw(grad)
    for yy in range(int(y), int(y + size * 1.2)):
        k = (yy - y) / (size * 1.2)
        gd.line([(0, yy), (img.width, yy)], fill=(255, int(236 - 90 * k), int(110 - 90 * k), 255))
    img.paste(grad, (0, 0), mask)


def make(w, h, out):
    img = Image.new("RGBA", (w, h))
    bg = Image.open(os.path.join(ART, "bg_lake.webp")).convert("RGBA")
    water_y = int(h * (0.58 if w == h else 0.6))
    # big enough to cover the width, and tall enough that the painted sky reaches the top
    k = max(w / bg.width, h / bg.height, water_y / (0.245 * bg.height))
    bg = bg.resize((math.ceil(bg.width * k), math.ceil(bg.height * k)), Image.LANCZOS)
    wl = 0.245 * bg.height  # waterline in the painting
    water_y = int(h * (0.58 if w == h else 0.6))
    img.alpha_composite(bg, (int((w - bg.width) / 2), int(water_y - wl)))
    # deepen the bottom
    shade = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for yy in range(water_y, h):
        a = int(150 * (yy - water_y) / (h - water_y))
        sd.line([(0, yy), (w, yy)], fill=(6, 30, 70, a))
    img.alpha_composite(shade)
    u = min(w, h)
    # the kid cheering in the boat
    kid = sprite("kid_cap_cheer", int(u * (0.62 if w == h else 0.5)))
    kx = int(w * (0.3 if w == h else 0.3) - kid.width / 2)
    ky = water_y - int(kid.height * 0.8)
    # the huge golden catch leaping out of the water, with a glow and a splash
    fish = tint_gold(sprite("koi_queen", int(u * (0.62 if w == h else 0.55)))).rotate(28, expand=True, resample=Image.BICUBIC)
    fx, fy = int(w * (0.72 if w == h else 0.7) - fish.width / 2), water_y - int(fish.height * 0.78)
    img.alpha_composite(glow((w, h), (fx + fish.width // 2, fy + fish.height // 2), u * 0.42, (255, 225, 120, 255)))
    d = ImageDraw.Draw(img)
    for i in range(16):
        a = math.pi * (0.9 + 1.2 * i / 15)
        r = u * (0.08 + 0.05 * (i % 3))
        cx, cy = fx + fish.width * 0.42 + math.cos(a) * r * 1.6, water_y + math.sin(a) * r * 0.6
        s = u * (0.012 + 0.008 * (i % 3))
        d.ellipse([cx - s, cy - s, cx + s, cy + s], fill=(235, 250, 255, 230), outline=(22, 52, 94, 255), width=2)
    img.alpha_composite(fish, (fx, fy))
    img.alpha_composite(kid, (kx, ky))
    # sparkles
    for i, (sx, sy) in enumerate([(0.86, 0.18), (0.6, 0.12), (0.93, 0.46), (0.52, 0.36)]):
        cx, cy, s = w * sx, h * sy, u * (0.025 + 0.01 * (i % 2))
        d.polygon([(cx, cy - s * 2), (cx + s * 0.5, cy - s * 0.5), (cx + s * 2, cy), (cx + s * 0.5, cy + s * 0.5), (cx, cy + s * 2), (cx - s * 0.5, cy + s * 0.5), (cx - s * 2, cy), (cx - s * 0.5, cy - s * 0.5)], fill=(255, 250, 200, 255))
    title(img, "Deep Luck", w / 2, h * (0.73 if w == h else 0.72), int(u * (0.16 if w == h else 0.17)))
    img.convert("RGB").save(out, quality=92)
    print(out, img.size)


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    make(628, 628, os.path.join(out, "thumb_628.jpg"))
    make(1280, 720, os.path.join(out, "thumb_1280x720.jpg"))
