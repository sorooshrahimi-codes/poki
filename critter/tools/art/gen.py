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
  "hyb1": (SHEET + CRIT + "Each one is a cute HYBRID of two critters. Top-left: 'Buzzbun', a fluffy pink bunny ball with yellow-black bee stripes and tiny bee wings. "
     "Top-right: 'Shroomslime', a translucent blue slime with a red white-spotted mushroom cap. Bottom-left: 'Leafowl', a round brown owl with a green sprout and two leaves on its head. "
     "Bottom-right: 'Luckshell', a snail with a four-leaf-clover shell, glowing green. " + STYLE, "1:1", True),
  "hyb2": (SHEET + CRIT + "Each one is a cute HYBRID of two critters. Top-left: 'Glowflake', a white snowball critter with a glowing firefly tail and tiny antennae. "
     "Top-right: 'Fernfrost', a fox kit ball with a frosty white coat and a fern-leaf tail. Bottom-left: 'Pineseal', a baby seal with a pinecone-scale back. "
     "Bottom-right: 'Aurospore', a purple mushroom puff glowing with green and pink aurora light. " + STYLE, "1:1", True),
  "lab_egg": ("A single game sprite on a fully transparent background: a magical lab egg, glass-like and glowing with bubbling green and purple potion swirls inside, with a little brass cap. No text. " + STYLE, "1:1", True),
}

# --- the road to the Moon: three more places, each with its giant (the 4th critter of its third sheet)
def _bg(desc):
    return ("Vertical game background, portrait composition, side view: " + desc + " Top 45% sky and distant scenery, middle a wide open area that stays uncluttered for gameplay, "
            "bottom 20% a flat ground band with a path, decorations only at the far left and right edges. No characters, no creatures, no text. " + STYLE, "2:3", False)
JOBS.update({
  "crit_candy1": (SHEET + CRIT + "Top-left: 'Gumdrop', a glossy green gumdrop critter with sugar crystals. Top-right: 'Lollipup', a pink puppy ball with a swirly lollipop tail. "
     "Bottom-left: 'Marshmeow', a soft white marshmallow kitten. Bottom-right: 'Truffle', a round chocolate truffle critter with a cocoa-dust top. " + STYLE, "1:1", True),
  "crit_candy2": (SHEET + CRIT + "Top-left: 'Sprinkle', a donut critter with pink icing and rainbow sprinkles. Top-right: 'Cottonfluff', a pastel cotton-candy cloud critter. "
     "Bottom-left: 'Jellybean', a shiny purple jellybean critter. Bottom-right: 'Pudding', a wobbly caramel pudding critter with a cherry on top. " + STYLE, "1:1", True),
  "crit_candy3": (SHEET + CRIT + "Top-left: 'Cupcakey', a rare cupcake critter with a swirl of frosting. Top-right: 'Swirlicorn', an epic ice-cream-cone unicorn critter. "
     "Bottom-left: 'Candyking', a legendary critter wearing a candy-cane crown. Bottom-right: 'Cakeroar', a HUGE chubby three-layer strawberry cake monster with frosting drips, a big happy mouth and tiny arms, the giant boss. " + STYLE, "1:1", True),
  "bg_candy": _bg("a sweet candy land with chocolate rivers, lollipop trees, gumdrop hills and pink cotton-candy clouds."),
  "crit_volcano1": (SHEET + CRIT + "Top-left: 'Emberpup', a red puppy ball with a tiny flame on its head. Top-right: 'Magmite', a small glowing magma rock critter. "
     "Bottom-left: 'Ashbat', a fluffy grey bat ball. Bottom-right: 'Cinderchick', an orange chick with smoldering feathers. " + STYLE, "1:1", True),
  "crit_volcano2": (SHEET + CRIT + "Top-left: 'Lavaslug', a glowing orange lava slug. Top-right: 'Rockhorn', a stony rhino calf ball. "
     "Bottom-left: 'Sizzle', a bouncy fire spirit with a happy face. Bottom-right: 'Obby', a shiny black obsidian crystal critter. " + STYLE, "1:1", True),
  "crit_volcano3": (SHEET + CRIT + "Top-left: 'Flarefox', a rare fox kit with a fiery tail. Top-right: 'Phoenixie', an epic baby phoenix ball with golden flames. "
     "Bottom-left: 'Pyrodrake', a legendary baby fire dragon. Bottom-right: 'Magmaw', a HUGE chubby lava golem blob with glowing cracks, a wide grin and stubby legs, the giant boss. " + STYLE, "1:1", True),
  "bg_volcano": _bg("a cute volcano land at dusk, a friendly smoking volcano in the distance, warm orange sky, dark rocks with glowing lava cracks."),
  "crit_moon1": (SHEET + CRIT + "Top-left: 'Moonbun', a pale lilac bunny ball with a crescent mark. Top-right: 'Starling', a glowing yellow star-shaped critter. "
     "Bottom-left: 'Cometto', a blue comet critter with a sparkly tail. Bottom-right: 'Cratero', a grey moon-rock critter with little craters. " + STYLE, "1:1", True),
  "crit_moon2": (SHEET + CRIT + "Top-left: 'Astrocat', a kitten floating in a tiny round space helmet. Top-right: 'Nebulee', a swirly pink-and-purple nebula cloud critter. "
     "Bottom-left: 'Saturnie', a round planet critter with a ring. Bottom-right: 'Ufolo', a tiny flying-saucer critter with a happy face. " + STYLE, "1:1", True),
  "crit_moon3": (SHEET + CRIT + "Top-left: 'Lunaria', a rare moth with glowing moon wings. Top-right: 'Galaxeel', an epic starry space eel. "
     "Bottom-left: 'Celestail', a legendary cosmic fox with a galaxy tail. Bottom-right: 'Big Moon', the MOON ITSELF as a HUGE round cute creature with craters, sleepy eyes, rosy cheeks and tiny legs, the final giant boss. " + STYLE, "1:1", True),
  "bg_moon": _bg("the surface of the moon under a starry purple space sky, the Earth small in the distance, soft grey craters and glowing crystals."),
})

JOBS["kid_rival"] = ("A single game sprite on a fully transparent background: a cheeky rival kid explorer, smug confident grin, one eyebrow raised, purple cap worn backwards, green hoodie, "
    "black shorts, sneakers, wearing a sleek green-and-black vacuum tank backpack with a glowing green dome, holding a chunky vacuum nozzle pointing forward to the right, side view facing right. "
    "Full body, no ground, no text. Same art style and proportions as the reference kid. " + STYLE, "1:1", True, [dl.STYLE_REF, "https://media.base44.com/images/public/6aea41c732ebf572da66fc50/6ed63788d_generated_38770da9.png"])

_KID = "A single game sprite on a fully transparent background: the same cheerful kid explorer (red cap, blue overalls, sneakers) in side view facing right, holding a vacuum nozzle pointing forward to the right. Full body, no ground, no text. Same art style and proportions as the reference kid. "
_REF = [dl.STYLE_REF, "https://media.base44.com/images/public/6aea41c732ebf572da66fc50/6ed63788d_generated_38770da9.png"]
JOBS["kid_vac2"] = (_KID + "The vacuum is UPGRADED: a bigger turbo backpack with two glass domes swirling with blue wind, chrome pipes, and a wider double-barrel nozzle with a blue glow. " + STYLE, "1:1", True, _REF)
JOBS["kid_vac3"] = (_KID + "The vacuum is a MEGA machine: a huge golden backpack with spinning turbines and a big glass tank full of a tiny tornado, a long golden nozzle with glowing rings and sparks. " + STYLE, "1:1", True, _REF)
JOBS["kid_vac4"] = (_KID + "The vacuum is COSMIC: a backpack holding a swirling purple galaxy in a crystal sphere, floating star particles around it, a sleek crystal nozzle glowing with starlight. " + STYLE, "1:1", True, _REF)

JOBS["world_map"] = ("Vertical game world map illustration, portrait composition, seen slightly from above like a board-game map: one winding dirt road that starts at the BOTTOM at a cozy little house with a red roof, "
    "then climbs upward through clearly separated areas, from bottom to top: a sunny flower meadow, a mushroom forest, snowy ice peaks, pink candy hills with lollipops, a volcano with lava, "
    "then the road becomes a glowing rainbow bridge rising through fluffy clouds into a starry night sky, ending at a big glowing full Moon at the very TOP. Each area is a distinct band across the map, "
    "with a little round clearing on the road in each area as a stop. Bright, cheerful, readable, no characters, no creatures, no text, no labels. " + STYLE, "2:3", False)
JOBS["intro_dream"] = ("Vertical game illustration, portrait composition: a cozy kid's bedroom at night. The same cheerful kid explorer (red cap, blue overalls, red sneakers) SITS on his bed in side view, "
    "his whole body, head and eyes turned to the RIGHT toward a big round window. He wears his toy vacuum backpack on his back and holds the vacuum nozzle with both hands, pointing it UP and to the right at a HUGE glowing full Moon "
    "that fills the window. Clear simple pose: head, arms and nozzle all point the same direction (right, toward the Moon). Stars in the sky, warm lamp light, toys on a shelf on the left. Dreamy and magical. No text. " + STYLE, "2:3", False, _REF)

_ROCK = "Each panel shows the SAME cute cartoon toy rocket under construction on the same little round launch pad, front view, centered, on a plain transparent background, no characters, no text. "
JOBS["rocket1"] = (SHEET + _ROCK + "Top-left: only the round launch pad with a small scaffold and a toolbox. Top-right: the pad with the rocket's lower body, red and white, with bolts. "
    "Bottom-left: the rocket body taller with a round blue porthole window. Bottom-right: the rocket with fins added, red fins with yellow trim. " + STYLE, "1:1", True)
JOBS["rocket2"] = (SHEET + _ROCK + "Top-left: the full rocket with fins and two side boosters attached. Top-right: the complete rocket with a pointy nose cone and a little flag on top, shiny and proud. "
    "Bottom-left: the complete rocket launching, big orange-and-yellow flames and puffy smoke clouds below. Bottom-right: the complete rocket flying upward with a long sparkly flame trail. " + STYLE, "1:1", True)

_HOME = "Each panel shows the kid's HOME at a different stage of growth, same cartoon style, three-quarter view, on a small round grassy base, centered, transparent background, no characters, no text. "
JOBS["home1"] = (SHEET + _HOME + "Top-left: a tiny cozy cottage with a red roof and a mailbox. Top-right: the cottage bigger with a flower garden, a fence and a little workshop shed with tools. "
    "Bottom-left: a two-storey house with a round telescope tower on the side. Bottom-right: a big mansion with a shiny observatory dome and a satellite dish. " + STYLE, "1:1", True)
JOBS["home2"] = (SHEET + _HOME + "Top-left: a castle-like home with turrets and a tall rocket launch tower beside it. Top-right: a grand space-age home with a glass rocket hangar and glowing lights. "
    "Bottom-left: a golden palace with a big glass moon dome and fountains. Bottom-right: a magical sky castle floating on a cloud island with rainbow waterfalls. " + STYLE, "1:1", True)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or [n for n in JOBS if not os.path.exists(os.path.join(out, n + ".png"))]
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        for n in names: ex.submit(gen, out, n, *JOBS[n])
