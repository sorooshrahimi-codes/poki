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
  "crit_forest1": (SHEET + CRIT + "Top-left: 'Spora', a purple puffball mushroom critter releasing tiny glowing spores. Top-right: 'Acornel', a round acorn critter with a little cap. "
     "Bottom-left: 'Mossling', a fuzzy green moss ball with a tiny flower. Bottom-right: 'Glowbug', a round firefly critter with a glowing yellow tail. " + STYLE, "1:1", True),
  "crit_forest2": (SHEET + CRIT + "Top-left: 'Toadstoo', a chubby toad critter wearing a red mushroom cap hat. Top-right: 'Fernfox', a tiny fox ball with fern-leaf tail. "
     "Bottom-left: 'Barkbear', a little bear cub ball with tree-bark fur. Bottom-right: 'Pinecub', a round pinecone hedgehog critter. " + STYLE, "1:1", True),
  "crit_forest3": (SHEET + CRIT + "Top-left: 'Lumoth', a soft glowing blue moth puff, rare. Top-right: 'Crystalcap', a mushroom critter with a translucent crystal cap, epic. "
     "Bottom-left: 'Elderoak', a wise little tree spirit ball with a leafy crown and tiny beard, legendary. Bottom-right: 'Moonfawn', a legendary white fawn-ball with glowing crescent-moon antlers. " + STYLE, "1:1", True),
  "bg_forest": ("Vertical game background, portrait composition, side view: a magical glowing mushroom forest clearing at soft twilight. Top 45% giant friendly mushrooms and tall trees with fireflies and a soft purple-blue sky, "
     "middle a wide open mossy clearing with small glowing mushrooms that stays uncluttered for gameplay, bottom 20% a flat mossy ground band with a dirt path, ferns only at the far left and right edges. "
     "No characters, no creatures, no text. " + STYLE, "2:3", False),
  "crit_frost1": (SHEET + CRIT + "Top-left: 'Snowpuff', a round white snowball critter with rosy cheeks. Top-right: 'Pengo', a chubby baby penguin ball. "
     "Bottom-left: 'Icicub', a light-blue ice cube critter with a frosty top. Bottom-right: 'Mittens', a fluffy white arctic fox kit ball. " + STYLE, "1:1", True),
  "crit_frost2": (SHEET + CRIT + "Top-left: 'Frostbite', a small blue yeti ball with tiny horns. Top-right: 'Sealio', a round grey baby seal. "
     "Bottom-left: 'Glacier', a sturdy turquoise crystal-rock critter. Bottom-right: 'Flurry', a little snowflake fairy critter with icy wings. " + STYLE, "1:1", True),
  "crit_frost3": (SHEET + CRIT + "Top-left: 'Auroray', a rare glowing aurora jellyfish-ball floating in green and pink light. Top-right: 'Crystowl', an epic snowy owl with crystal feathers. "
     "Bottom-left: 'Frostking', a legendary majestic snow lion cub with an ice crown and flowing frosty mane. Bottom-right: 'Wyrmling', a legendary baby ice dragon with sparkling scales. " + STYLE, "1:1", True),
  "bg_frost": ("Vertical game background, portrait composition, side view: cute snowy mountain peaks under a soft pastel sky with a faint aurora. Top 45% snowy mountains and pine trees, "
     "middle a wide open snowy field with small ice crystals that stays uncluttered for gameplay, bottom 20% a flat snowy ground band with a frozen path, snowy pines only at the far left and right edges. "
     "No characters, no creatures, no text. " + STYLE, "2:3", False),
  "eggs": (SHEET + "Four magical critter eggs standing upright, each a different rarity: top-left a speckled cream egg, top-right a sky-blue egg with white swirls, "
     "bottom-left a purple egg with glowing star patterns, bottom-right a golden egg with gems and a soft glow. " + STYLE, "1:1", True),
  "kid_cheer": ("A single game sprite on a fully transparent background: the same cheerful kid explorer (red cap, blue overalls, sneakers, glossy vacuum backpack with a bubble-glass dome) "
     "jumping for joy, both arms up holding the vacuum nozzle high, eyes closed with a huge grin, side view facing right. Full body, no ground, no text. " + STYLE, "1:1", True, [dl.STYLE_REF, "https://media.base44.com/images/public/6aea41c732ebf572da66fc50/6ed63788d_generated_38770da9.png"]),
}

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or [n for n in JOBS if not os.path.exists(os.path.join(out, n + ".png"))]
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        for n in names: ex.submit(gen, out, n, *JOBS[n])
