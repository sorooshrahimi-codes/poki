"""Cut the Critter Vac sheets into sprites and export WebP into critter/public/art (reuses Deep Luck's trimming).
Usage: python3 -I process.py RAW_DIR"""
import importlib.util, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("dl_proc", os.path.join(HERE, "..", "..", "..", "game", "tools", "art", "process.py"))
dl = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(dl)
OUT = os.path.join(HERE, "..", "..", "public", "art")

SHEETS = {
    "crit_meadow1": ["puffbun", "sprig", "mushi", "bumbo"],
    "crit_meadow2": ["pebblo", "dewdrop", "snailo", "hootle"],
    "crit_meadow3": ["clovy", "honeyblob", "sunpup", "prismane"],
    "ui_props": ["pedestal", "jar", "coin", "nozzle"],
    "crit_forest1": ["spora", "acornel", "mossling", "glowbug"],
    "crit_forest2": ["toadstoo", "fernfox", "barkbear", "pinecub"],
    "crit_forest3": ["lumoth", "crystalcap", "elderoak", "moonfawn"],
    "crit_frost1": ["snowpuff", "pengo", "icicub", "mittens"],
    "crit_frost2": ["frostbite", "sealio", "glacier", "flurry"],
    "crit_frost3": ["auroray", "crystowl", "frostking", "wyrmling"],
    "eggs": ["egg_speckled", "egg_sky", "egg_star", "egg_golden"],
    "hyb1": ["buzzbun", "shroomslime", "leafowl", "luckshell"],
    "hyb2": ["glowflake", "fernfrost", "pineseal", "aurospore"],
    "crit_candy1": ["gumdrop", "lollipup", "marshmeow", "truffle"],
    "crit_candy2": ["sprinkle", "cottonfluff", "jellybean", "pudding"],
    "crit_candy3": ["cupcakey", "swirlicorn", "candyking", "cakeroar"],
    "crit_volcano1": ["emberpup", "magmite", "ashbat", "cinderchick"],
    "crit_volcano2": ["lavaslug", "rockhorn", "sizzle", "obby"],
    "crit_volcano3": ["flarefox", "phoenixie", "pyrodrake", "magmaw"],
    "crit_moon1": ["moonbun", "starling", "cometto", "cratero"],
    "crit_moon2": ["astrocat", "nebulee", "saturnie", "ufolo"],
    "crit_moon3": ["lunaria", "galaxeel", "celestail", "bigmoon"],
}
SINGLES = {"kid_vac": "kid_vac", "kid_vac_suck": "kid_vac_suck", "kid_cheer": "kid_cheer", "kid_rival": "kid_rival", "kid_vac2": "kid_vac2", "kid_vac3": "kid_vac3", "kid_vac4": "kid_vac4", "lab_egg": "lab_egg"}
BGS = {"bg_meadow": "bg_meadow", "bg_park": "bg_park", "bg_forest": "bg_forest", "bg_frost": "bg_frost", "bg_candy": "bg_candy", "bg_volcano": "bg_volcano", "bg_moon": "bg_moon"}
MAX = {"egg_": 120, "lab_egg": 120, "kid_": 360, "pedestal": 220, "jar": 200, "coin": 96, "nozzle": 128}

def save(im, name):
    m = next((v for k, v in MAX.items() if name.startswith(k)), 240)
    im.thumbnail((m, m), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=86, method=6)
    print(f"{name:14s} {im.size}")

def main(raw):
    os.makedirs(OUT, exist_ok=True)
    for sheet, names in SHEETS.items():
        im = Image.open(os.path.join(raw, sheet + ".png")).convert("RGBA"); w, h = im.size
        for i, n in enumerate(names):
            x, y = (i % 2) * w // 2, (i // 2) * h // 2
            save(dl.trim(im.crop((x, y, x + w // 2, y + h // 2))), n)
    for src, n in SINGLES.items():
        save(dl.trim(Image.open(os.path.join(raw, src + ".png")).convert("RGBA")), n)
    for src, n in BGS.items():
        im = Image.open(os.path.join(raw, src + ".png")).convert("RGB"); im.thumbnail((720, 1080), Image.LANCZOS)
        im.save(os.path.join(OUT, n + ".webp"), "WEBP", quality=80, method=6); print(n, im.size)
    print("total KB", sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024)

if __name__ == "__main__":
    main(sys.argv[1])
