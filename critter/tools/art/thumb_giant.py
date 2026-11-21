"""Poki thumbnails for the giant version: a small kid vacuuming a HUGE giant that stretches like taffy into the nozzle.
No words: the picture asks the question ("he's sucking up THAT?").
Usage: python3 -I thumb_giant.py RAW_DIR OUT_DIR   (RAW_DIR = the full-size studio PNGs)"""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

RAW, OUT = sys.argv[1], sys.argv[2]


def load(name):
    return Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")


def trim(im):
    return im.crop(im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox())


def quad(sheet, i):
    w, h = sheet.size
    return trim(sheet.crop(((i % 2) * w // 2, (i // 2) * h // 2, (i % 2 + 1) * w // 2, (i // 2 + 1) * h // 2)))


def height(im, h):
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def coeffs(src, dst):
    """perspective coefficients mapping output quad dst onto source quad src"""
    import numpy as np
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(m, dtype=float); b = np.array([p for uv in src for p in uv], dtype=float)
    return np.linalg.solve(a, b).tolist()


def taffy(im, pinch, stretch):
    """the giant pulled toward the left: wider, and its left side squeezed toward the middle"""
    w, h = im.size
    W = round(w * stretch)
    dst = [(0, h * (0.5 - pinch / 2)), (W, 0), (W, h), (0, h * (0.5 + pinch / 2))]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    return im.transform((W, h), Image.PERSPECTIVE, coeffs(src, dst), Image.BICUBIC)


def compose(W, H, layout):
    rnd = random.Random(7)
    bg = load("bg_meadow")
    k = W / bg.width
    band = bg.resize((W, round(bg.height * k)), Image.LANCZOS)
    y0 = min(band.height - H, max(0, round(band.height * layout["bgY"]) - H // 2))
    canvas = band.crop((0, y0, W, y0 + H)).convert("RGBA")
    canvas = ImageEnhance.Color(canvas).enhance(1.15)

    kid = height(trim(load("kid_vac_suck")), round(H * layout["kidH"]))
    kx, ky = round(W * layout["kidX"]), H - kid.height - round(H * layout["kidB"])
    nx, ny = kx + round(kid.width * 0.97), ky + round(kid.height * 0.5)

    giant = height(quad(load("crit_meadow3"), 1), round(H * layout["giantH"]))
    giant = taffy(giant, 0.3, 1.3)
    gx, gy = nx + round(W * layout["gap"]), ny - giant.height // 2 - round(H * layout["giantUp"])

    fx = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(fx)
    # the wind: smooth streaks converging into the nozzle, fading toward the giant
    for i in range(18):
        sx = gx + giant.width * (0.02 + 0.12 * rnd.random())
        sy = ny + (rnd.random() - 0.5) * giant.height * 0.55
        bend = (rnd.random() - 0.5) * 60
        pts = [(sx + (nx - sx) * (j / 20), sy + (ny - sy) * (j / 20) + math.sin(j / 20 * math.pi) * bend) for j in range(21)]
        for j in range(20):
            a = round(60 + 170 * (j / 19))
            d.line([pts[j], pts[j + 1]], fill=(235, 250, 255, a), width=round(3 + 7 * (j / 19)))
    fx = fx.filter(ImageFilter.GaussianBlur(1.2))
    # shadow under the giant
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((gx + giant.width * 0.1, gy + giant.height * 0.92, gx + giant.width * 0.95, gy + giant.height * 1.04), fill=(20, 50, 10, 90))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    canvas.alpha_composite(giant, (gx, gy))
    canvas.alpha_composite(fx)

    # little critters already flying in, and coins bursting out
    small = [quad(load("crit_meadow1"), 0), quad(load("crit_meadow1"), 3), quad(load("crit_meadow1"), 2)]
    for i, s in enumerate(small):
        s = height(s, round(H * 0.12)).rotate(rnd.randint(-40, 40), expand=True, resample=Image.BICUBIC)
        u = 0.35 + i * 0.18
        px = round(nx + (gx - nx) * u) - s.width // 2
        py = round(ny + (rnd.random() - 0.5) * H * 0.25) - s.height // 2
        canvas.alpha_composite(s, (px, py))
    coin = height(trim(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "art", "coin.webp")).convert("RGBA")), round(H * 0.075))
    # coins fountaining up out of the stream
    for i in range(7):
        c = coin.rotate(rnd.randint(-30, 30), expand=True, resample=Image.BICUBIC)
        # an arc of coins flying up from the stream, back over the kid's head
        u = i / 6
        px = round(nx + W * 0.04 - u * W * 0.34) - c.width // 2
        py = round(ny - H * 0.2 - math.sin(u * math.pi) * H * 0.22 + rnd.random() * H * 0.03)
        canvas.alpha_composite(c, (px, py))

    ksh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ksh).ellipse((kx + kid.width * 0.1, H - round(H * layout["kidB"]) - 14, kx + kid.width * 0.8, H - round(H * layout["kidB"]) + 10), fill=(20, 50, 10, 100))
    canvas.alpha_composite(ksh.filter(ImageFilter.GaussianBlur(6)))
    canvas.alpha_composite(kid, (kx, ky))

    # a soft vignette pulls the eye to the middle
    vig = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vig).ellipse((-W * 0.15, -H * 0.2, W * 1.15, H * 1.2), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(min(W, H) * 0.12))
    dark = Image.new("RGBA", (W, H), (10, 25, 40, 120))
    dark.putalpha(vig.point(lambda v: 120 - v * 120 // 255))
    canvas.alpha_composite(dark)
    return canvas.convert("RGB")


os.makedirs(OUT, exist_ok=True)
compose(1280, 720, {"bgY": 0.47, "kidH": 0.62, "kidX": 0.03, "kidB": 0.04, "giantH": 0.9, "gap": 0.035, "giantUp": 0.06}).save(os.path.join(OUT, "thumb_1280x720.jpg"), quality=90)
compose(628, 628, {"bgY": 0.55, "kidH": 0.44, "kidX": 0.0, "kidB": 0.03, "giantH": 0.52, "gap": -0.02, "giantUp": 0.1}).save(os.path.join(OUT, "thumb_628.jpg"), quality=90)
print("ok")
