"""Find the eyes in every character sprite so the game can make them blink.
An eye = a roundish patch of near-white (the sclera) with a dark pupil inside it.
Writes src/data/eyes.ts: per sprite, up to 2 ellipses (centre and radii as fractions of the sprite) and the eyelid colour.
Usage: python3 -I eyes.py"""
import os, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "..", "public", "art")
OUT = os.path.join(HERE, "..", "..", "src", "data", "eyes.ts")
SKIP = ("bg_", "floor_", "p_", "i_", "b_", "g_", "s_bottle", "s_chest", "hat_", "boat")
JUNK = {"s_gull", "old_boot", "soda_can", "rubber_duck", "lost_mitten", "flip_flop", "hot_bottle"}


def components(mask):
    """4-connected components of a boolean mask: list of (ys, xs) arrays"""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    ys0, xs0 = np.nonzero(mask)
    for y0, x0 in zip(ys0, xs0):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]; seen[y0, x0] = True; py, px = [], []
        while stack:
            y, x = stack.pop(); py.append(y); px.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; stack.append((ny, nx))
        out.append((np.array(py), np.array(px)))
    return out


FRONT = {"jelly", "lava_jelly", "frost_jelly", "octopus", "puffer", "obsidian_puffer", "magma_crab", "snow_crab", "baby_penguin", "seahorse"}


def region_ok(name, cx, cy):
    """where eyes can be: in the head, not on a sleeve, belly or tail"""
    if name.startswith("kid_"):
        return 0.25 < cx < 0.75 and 0.19 < cy < 0.45
    if name.startswith(("npc_", "pet_")):
        return 0.2 < cx < 0.8 and 0.2 < cy < 0.5
    if name in FRONT or name.startswith("s_"):
        return cy < 0.7
    return cx > 0.5 and cy < 0.65  # side-view fish face right


def find_eyes(path, name):
    im = Image.open(path).convert("RGBA")
    W0, H0 = im.size
    k = (320 if name.startswith(("kid_", "npc_", "pet_")) else 200) / max(W0, H0)
    im = im.resize((max(1, round(W0 * k)), max(1, round(H0 * k))), Image.LANCZOS)
    a = np.asarray(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    sat = a[..., :3].max(-1) - a[..., :3].min(-1)
    white = (lum > 205) & (sat < 45) & (al > 200)
    # characters have coloured irises (brown, green, blue): count those as the pupil too
    head = name.startswith(("kid_", "npc_", "pet_"))
    dark = (lum < (128 if head else 95)) & (al > 200) & ((sat > 40) | (lum < 95))
    H, W = lum.shape
    area_all = (al > 200).sum()
    cands = []
    for ys, xs in components(white):
        n = len(ys)
        if n < 6 or n > area_all * 0.06:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if bw / bh > 2.6 or bh / bw > 2.6:
            continue
        # the pupil: dark pixels inside the white patch's box (grown a little)
        gy0, gy1, gx0, gx1 = max(0, y0 - 1), min(H, y1 + 2), max(0, x0 - 1), min(W, x1 + 2)
        box = dark[gy0:gy1, gx0:gx1]
        dk = box.sum()
        if dk < max(2, n * 0.15):
            continue
        # sclera + pupil should fill most of the box (an eye is round, not a stripe of shine)
        fill = (white[gy0:gy1, gx0:gx1] | box).sum() / ((gy1 - gy0) * (gx1 - gx0))
        if fill < 0.6 or dk < box.size * 0.15:
            continue
        # the pupil sits in the middle of the white
        dy_, dx_ = np.nonzero(box)
        mx, my = dx_.mean() / max(1, box.shape[1] - 1), dy_.mean() / max(1, box.shape[0] - 1)
        if not (0.15 < mx < 0.85 and 0.15 < my < 0.85):
            continue
        if not region_ok(name, (gx0 + gx1) / 2 / W, (gy0 + gy1) / 2 / H):
            continue
        # an eye is small next to the whole creature (bigger white patches are mouths, bellies, teeth)
        if (gx1 - gx0) / W > 0.13 or (gy1 - gy0) / H > 0.2:
            continue
        score = dk + n
        cands.append((score, gx0, gy0, gx1, gy1))
    cands.sort(reverse=True)
    eyes = []
    side = not (name in FRONT or name.startswith(("kid_", "npc_", "pet_")))
    for c in cands:
        if len(eyes) == (1 if side else 2):
            break
        # a second eye must be about the same size as the first
        if eyes:
            e0 = eyes[0]
            s0 = (e0[3] - e0[1]) * (e0[4] - e0[2]); s1 = (c[3] - c[1]) * (c[4] - c[2])
            h0 = e0[4] - e0[2]
            same_row = abs((c[2] + c[4]) / 2 - (e0[2] + e0[4]) / 2) < h0 * 0.8
            apart = c[1] > e0[3] or c[3] < e0[1]
            if not (s1 > s0 * 0.4 and same_row and apart):
                continue
        eyes.append(c)
    if head and len(eyes) == 1:
        # the far eye in a 3/4 view is smaller and its white is a thin crescent: find its iris instead,
        # on the same row, a little to either side of the first eye
        _, ax0, ay0, ax1, ay1 = eyes[0]
        ew, eh, ecx, ecy = ax1 - ax0, ay1 - ay0, (ax0 + ax1) / 2, (ay0 + ay1) / 2
        best = None
        for ys, xs in components(dark):
            cx_, cy_ = xs.mean(), ys.mean()
            bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
            if abs(cy_ - ecy) > eh * 0.6 or not (ew * 0.9 < abs(cx_ - ecx) < ew * 3.2):
                continue
            if not (eh * 0.3 < bh < eh * 1.2 and ew * 0.2 < bw < ew * 1.2):
                continue
            d = abs(cx_ - ecx)
            if best is None or d < best[0]:
                best = (d, xs.min(), ys.min(), xs.max(), ys.max())
        if best:
            _, bx0, by0, bx1, by1 = best
            gx, gy = max(1, (bx1 - bx0) * 0.35), max(1, (by1 - by0) * 0.25)
            eyes.append((0, int(bx0 - gx), int(by0 - gy), int(bx1 + gx + 1), int(by1 + gy + 1)))
    res = []
    for _, x0, y0, x1, y1 in eyes:
        cx, cy, rx, ry = (x0 + x1) / 2 / W, (y0 + y1) / 2 / H, (x1 - x0) / 2 / W, (y1 - y0) / 2 / H
        # eyelid colour: the skin just above the eye
        # eyelid colour: the skin just under the eye (above it there is often hair or a brow)
        ly1 = min(H, y1 + 4)
        patch = a[y1 + 1:ly1, x0:x1].reshape(-1, 4)
        if len(patch) == 0:
            patch = a[max(0, y0 - 3):y0, x0:x1].reshape(-1, 4)
        patch = patch[(patch[:, 3] > 200)]
        lumP = 0.3 * patch[:, 0] + 0.59 * patch[:, 1] + 0.11 * patch[:, 2]
        satP = patch[:, :3].max(1) - patch[:, :3].min(1)
        patch = patch[(lumP > 70) & ~((lumP > 215) & (satP < 30))]  # no outline, no eye white
        col = np.median(patch[:, :3], axis=0).astype(int) if len(patch) else np.array([120, 120, 120])
        res.append([round(cx, 4), round(cy, 4), round(rx, 4), round(ry, 4), "#%02x%02x%02x" % tuple(col)])
    return res


def main():
    out = {}
    for f in sorted(os.listdir(ART)):
        name = f[:-5]
        if not f.endswith(".webp") or name.startswith(SKIP) or name in JUNK or name.endswith("_cheer"):
            continue
        e = find_eyes(os.path.join(ART, f), name)
        if e:
            out[name] = e
        print(f"{name:20s} {len(e)}")
    with open(OUT, "w") as fh:
        fh.write("// Generated by tools/art/eyes.py: eyes found in each sprite, for blinking.\n")
        fh.write("// [centre x, centre y, radius x, radius y] as fractions of the sprite, then the eyelid colour.\n")
        fh.write("export type Eye = [number, number, number, number, string];\n")
        fh.write("export const EYES: Record<string, Eye[]> = " + json.dumps(out, separators=(",", ":")) + ";\n")
    print("sprites with eyes:", len(out))


if __name__ == "__main__":
    main()
