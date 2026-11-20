"""Critter Vac art, made with the same studio function and style as Deep Luck.
Usage: ART_KEY=... python3 -I gen.py OUT_DIR [job ...]   (no jobs = all missing ones). The key is never stored in the repo."""
import importlib.util, os, sys

# reuse the Deep Luck pipeline (same studio, model, style reference and STYLE text)
_spec = importlib.util.spec_from_file_location("dl_gen", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "game", "tools", "art", "gen.py"))
dl = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(dl)
STYLE, SHEET, gen = dl.STYLE, dl.SHEET, dl.gen

CRIT = "Each one is a small chubby round fantasy critter, original design, facing the viewer in a three-quarter view, big shiny expressive eyes, tiny feet, full body visible. "
JOBS = {
  "crit_meadow1": (SHEET + CRIT + "Top-left: 'Puffbun', a fluffy white-and-pink bunny ball with long floppy ears. Top-right: 'Sprig', a green sprout critter with two leaves on its head. "
     "Bottom-left: 'Mushi', a red-capped mushroom critter with white spots. Bottom-right: 'Bumbo', a fuzzy yellow-and-black bee ball with tiny wings. " + STYLE, "1:1", True),
  "crit_meadow2": (SHEET + CRIT + "Top-left: 'Pebblo', a grey pebble critter with moss on top. Top-right: 'Dewdrop', a translucent blue water-drop slime. "
     "Bottom-left: 'Snailo', a pastel snail critter with a swirly lilac shell. Bottom-right: 'Hootle', a round brown owl puff with big eyes. " + STYLE, "1:1", True),
  "crit_meadow3": (SHEET + CRIT + "Top-left: 'Clovy', a lucky four-leaf-clover critter, bright green, rare. Top-right: 'Honeyblob', a golden honey slime with a dripping crown of honey. "
     "Bottom-left: 'Sunpup', a fluffy orange puppy-ball with a glowing sun mane, epic. Bottom-right: 'Prismane', a legendary rainbow unicorn-ball with a crystal horn and sparkles. " + STYLE, "1:1", True),
  "kid_vac": ("A single game sprite on a fully transparent background: a cheerful kid explorer (red cap, blue overalls, sneakers) standing in side view facing right, wearing a glossy toy-like vacuum tank backpack "
     "with a bubble-glass dome, holding a chunky vacuum hose nozzle pointing forward to the right. Full body, no ground, no text. " + STYLE, "1:1", True),
  "kid_vac_suck": ("A single game sprite on a fully transparent background: the same cheerful kid explorer (red cap, blue overalls, sneakers, glossy vacuum backpack with a bubble-glass dome) in side view facing right, "
     "leaning back with effort and a big excited grin, both hands gripping the vacuum nozzle pointing forward to the right, little swirl lines at the nozzle. Full body, no ground, no text. " + STYLE, "1:1", True),
  "bg_meadow": ("Vertical game background, portrait composition, side view: a bright magical meadow. Top 45% a sunny sky with puffy clouds and distant rolling hills with tiny trees, "
     "middle a wide open grassy field with scattered flowers that stays uncluttered for gameplay, bottom 20% a flat grassy ground band with a dirt path, a few bushes only at the far left and right edges. "
     "No characters, no creatures, no text. " + STYLE, "2:3", False),
  "bg_park": ("Vertical game background, portrait composition: a cozy cute critter park seen from the front, a soft green lawn with curved stone paths, little fences, flower beds and lanterns at the edges, "
     "a cheerful wooden welcome arch at the top with no letters, the middle area open and flat for placing pedestals. No characters, no creatures, no text. " + STYLE, "2:3", False),
  "ui_props": (SHEET + "Top-left: a round stone pedestal with a grassy top and a little golden trim, front view. Top-right: a big glass collection jar with a metal lid and a glowing swirl inside. "
     "Bottom-left: a shiny gold coin with a paw print. Bottom-right: a magic vacuum nozzle icon with a swirl of wind. " + STYLE, "1:1", True),
}

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or [n for n in JOBS if not os.path.exists(os.path.join(out, n + ".png"))]
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        for n in names: ex.submit(gen, out, n, *JOBS[n])
