"""Generate Deep Luck art through the Base44 art studio function (owner's credits).
Usage: ART_KEY=... python3 -I gen.py OUT_DIR [job ...]    (no jobs = all missing ones)
The key is never stored in the repo."""
import json, os, sys, urllib.request

URL = "https://rush-worlds-art-studio-da66fc50.base44.app/functions/art"
MODEL = "gpt_image_2_6_flare"
STYLE_REF = "https://media.base44.com/images/public/6aea41c732ebf572da66fc50/5e0251931_generated_b052a616.png"
STYLE = ("Style: glossy cartoon mobile game art matching the reference image exactly: bright saturated colors, thick dark navy outlines, "
         "soft cel shading with a crisp glossy highlight, big friendly expressive eyes, rounded chunky appealing shapes, premium polished "
         "casual game look, readable at small size. Original designs.")
SHEET = ("Four separate game sprites on a fully transparent background in a 2x2 grid, each one fully inside its own quarter with generous "
         "empty space around it, nothing touching or overlapping, no text, no labels, no ground, no cast shadow. ")
SIDE = "Each creature is seen from the side, facing right. "

JOBS = {
  # fish sheets: order = top-left, top-right, bottom-left, bottom-right
  "fish_lake2": (SHEET + SIDE + "Top-left: a round bluegill sunfish, blue-green back, orange-yellow belly, dark ear spot. Top-right: a chubby brown-grey catfish with long whiskers, cheeky smile. "
     "Bottom-left: a long sleek green pike with pale spots and a toothy grin. Bottom-right: a long glowing cyan eel with bioluminescent light spots, wavy body. " + STYLE, "1:1", True),
  "fish_lake3": (SHEET + "Top-left: a mystical silvery-lavender pike made of moonlight with violet fins, star sparkles and a crescent moon mark, facing right. Top-right: an old worn brown leather boot with laces. "
     "Bottom-left: a classic yellow rubber duck toy with orange beak, facing right. Bottom-right: a crushed red soda can with a white stripe, no logo, no text. " + STYLE, "1:1", True),
  "fish_ocean1": (SHEET + SIDE + "Top-left: a small shiny blue-silver sardine. Top-right: an orange clownfish with three white bands outlined in black. "
     "Bottom-left: a sleek mackerel with blue-green wavy stripes on the back and silver belly. Bottom-right: a cute round yellow pufferfish puffed up with little spikes. " + STYLE, "1:1", True),
  "fish_ocean2": (SHEET + "Top-left: a pink-lavender translucent moon jellyfish, dome on top with flowing tentacles below. Top-right: a powerful bluefin tuna, dark navy back, silver belly, yellow finlets, facing right. "
     "Bottom-left: a swordfish with a long pointed sword bill, blue-grey, facing right. Bottom-right: a goofy deep-sea anglerfish, dark purple, big toothy grin, glowing yellow lure on a stalk, facing right. " + STYLE, "1:1", True),
  "fish_marlin": ("A single legendary boss fish game sprite on a fully transparent background, side view facing right, no text: 'Grand Marlin', a magnificent electric-blue marlin with a tall sail fin, "
     "glowing cyan stripes, long spear bill, confident heroic expression, a tiny golden crown. " + STYLE, "1:1", True),
  "fish_whale": ("A single secret mythical creature game sprite on a fully transparent background, side view facing right, no text: 'Star Whale', a gentle deep-indigo whale whose body is filled with "
     "a starry galaxy and constellations, glowing golden star freckles, soft periwinkle belly, kind smiling eye, magical and awe-inspiring. " + STYLE, "3:2", True),
  "boat": ("A single game sprite on a fully transparent background, side view: a small cute wooden fishing rowboat painted white with a red stripe, floating level, and a cheerful kid fisher "
     "sitting in it wearing a red cap and blue life vest, holding a fishing rod that points up and to the right over the water, the rod tip clearly visible at the upper right. "
     "No water, no reflection, no text. " + STYLE, "3:2", True),
  "ocean_surface": ("Vertical game background for a fishing game, portrait composition: top 30% a bright tropical sky with puffy clouds and a small distant island with palm trees, a calm turquoise ocean surface line, "
     "below it the underwater ocean gradually getting deeper and darker blue towards the bottom, gentle light rays, soft bubbles, faint coral and rocks only at the far left and right edges, "
     "the center left open and uncluttered for gameplay, no fish, no boat, no characters, no text. " + STYLE, "2:3", False),
  "lake_floor": ("A wide horizontal game sprite strip on a fully transparent background: the bottom of a freshwater lake seen from the side, a band of sandy mud with smooth rounded rocks, pebbles, "
     "a sunken mossy log, freshwater plants and reeds rising from it, a few shells; the top edge irregular, everything above it transparent. No fish, no text. " + STYLE, "3:2", True),
  "ocean_floor": ("A wide horizontal game sprite strip on a fully transparent background: the deep ocean abyss floor seen from the side, dark rocks, glowing bioluminescent coral and sea plants in cyan and magenta, "
     "a half-buried treasure chest, a few shells and starfish; the top edge irregular, everything above it transparent. No fish, no text. " + STYLE, "3:2", True),
  "props_lake": (SHEET + "Underwater freshwater lake decorations, each tall and vertical: top-left a tall cluster of green swaying lake reeds and waterweed, top-right a big mossy grey boulder with small plants, "
     "bottom-left a sunken old wooden post with rope and algae, bottom-right a tall cluster of green kelp-like lake grass with tiny bubbles. " + STYLE, "1:1", True),
  "props_ocean": (SHEET + "Underwater ocean decorations, each tall and vertical: top-left a tall swaying golden-green kelp stalk, top-right a colorful pink and orange coral cluster, "
     "bottom-left a dark rock with purple anemones and a starfish, bottom-right a tall glowing deep-sea plant with cyan bioluminescent bulbs. " + STYLE, "1:1", True),
  "icons": (SHEET + "Game UI icons: top-left a shiny gold coin with a fish emblem embossed, top-right a wooden spool wound with blue fishing line, "
     "bottom-left a pair of shiny silver fishing hooks, bottom-right a lucky green four-leaf clover with a sparkle. " + STYLE, "1:1", True),
}

def gen(out, name, prompt, aspect, transparent, refs=None):
    body = {"prompt": prompt, "model": MODEL, "aspect_ratio": aspect, "resolution": "1K", "refs": refs or [STYLE_REF]}
    if transparent: body["extra"] = {"background": "transparent", "output_format": "png"}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"content-type": "application/json", "x-art-key": os.environ["ART_KEY"]})
    r = json.load(urllib.request.urlopen(req, timeout=400))
    if not r.get("url"):
        print(name, "FAILED", r, flush=True); return
    urllib.request.urlretrieve(r["url"], os.path.join(out, name + ".png"))
    print(name, "ok", r.get("credits"), r["url"], flush=True)


BOAT_REF = "https://media.base44.com/images/public/6aea41c732ebf572da66fc50/de88de4d4_generated_487ed234.png"
POSE = ("Exactly the same character, same small white-and-red wooden rowboat, same art style, same size and same side-view framing as the reference image, "
        "on a fully transparent background, no water, no text. ")
JOBS.update({
  "boat_cast": (POSE + "Pose: the kid swings the fishing rod back over the shoulder to cast, leaning back, excited open-mouth smile, rod pointing up and back to the upper LEFT. " + STYLE, "3:2", True, [BOAT_REF]),
  "boat_reel": (POSE + "Pose: the kid cranks the reel hard with determined face, tongue out, the rod bent in a strong curve with its tip pointing to the right and slightly down. " + STYLE, "3:2", True, [BOAT_REF]),
  "boat_cheer": (POSE + "Pose: the kid celebrates, standing up in the boat with both arms raised high, rod held up in one hand, huge happy smile, eyes closed with joy, little sparkles. " + STYLE, "3:2", True, [BOAT_REF]),
  "surprises": (SHEET + "Top-left: a cute goofy grey shark with a big toothy grin and mischievous eyes, side view facing right. Top-right: a glass message bottle with a cork and a rolled old paper map inside, slightly glowing. "
     "Bottom-left: an open wooden treasure chest overflowing with gold coins and gems. Bottom-right: a cheeky white seagull flying, wings spread, facing right. " + STYLE, "1:1", True),
  "ice_surface": ("Vertical game background for a fishing game, portrait composition: top 30% a pastel arctic sky with soft aurora ribbons, snowy mountains and an ice shelf with a cute igloo far away, "
     "a calm icy-blue sea surface with small floating ice chunks, below it the cold underwater gradually getting deeper and darker teal-blue, icicle-like ice formations only at the far left and right edges, "
     "the center open and uncluttered, no fish, no boat, no characters, no text. " + STYLE, "2:3", False),
  "ice_floor": ("A wide horizontal game sprite strip on a fully transparent background: the icy arctic seabed seen from the side, blue-white ice rocks, frozen crystals, pale sea plants, a frozen old anchor; "
     "the top edge irregular, everything above it transparent. No fish, no text. " + STYLE, "3:2", True),
  "props_ice": (SHEET + "Underwater arctic decorations, each tall and vertical: top-left a cluster of glowing blue ice crystals, top-right a big frosty ice boulder with snow on top, "
     "bottom-left tall pale-green arctic kelp, bottom-right a hanging ice formation with icicles. " + STYLE, "1:1", True),
  "fish_ice1": (SHEET + SIDE + "Top-left: a round chubby pale-blue ice cod with frosty speckles. Top-right: an arctic char, olive back with pink-red belly and pale spots. "
     "Bottom-left: a cute snow crab, pale orange with white snowy shell, side-ish view. Bottom-right: a lost red knitted mitten with a white snowflake pattern (an object, not a creature). " + STYLE, "1:1", True),
  "fish_ice2": (SHEET + "Top-left: an adorable baby penguin swimming underwater, side view facing right. Top-right: a frost jellyfish, icy cyan translucent dome with snowflake patterns and crystal tentacles. "
     "Bottom-left: a crystal trout whose body looks like clear blue glass with facets, side view facing right. Bottom-right: a cute smiling white beluga whale, side view facing right. " + STYLE, "1:1", True),
  "fish_narwhal": ("A single legendary boss creature game sprite on a fully transparent background, side view facing right, no text: 'Narwhal King', a majestic but cute narwhal with a long spiral glowing tusk, "
     "icy blue-white spotted body, a tiny ice crown, proud expression. " + STYLE, "3:2", True),
  "fish_aurora": ("A single secret mythical creature game sprite on a fully transparent background, side view facing right, no text: 'Aurora Ray', a graceful manta ray whose wings shimmer with green, teal and violet "
     "aurora light ribbons, starry speckles, kind eyes, magical. " + STYLE, "3:2", True),
})

JOBS.update({
  "baits1": (SHEET + "Fishing bait items, each a single cute object: top-left a wiggly pink earthworm with a happy face, top-right a plump pink shrimp, "
     "bottom-left a glowing firefly-light lure shaped like a little bug with a warm yellow glowing belly, bottom-right a shiny golden fishing lure shaped like a small fish with sparkles. " + STYLE, "1:1", True),
  "baits2": (SHEET + "Magical fishing bait items, each a single cute object: top-left a silver crescent-moon shaped glowing lure with tiny stars, top-right an icy blue crystal bait shaped like a snowflake drop, "
     "bottom-left a rainbow-striped jelly bait drop that shimmers, bottom-right a red-and-white classic fishing bobber with a tiny star on it. " + STYLE, "1:1", True),
  "gear": (SHEET + "Fishing gear icons, each a single object: top-left a cozy brass ship lantern glowing warm yellow, top-right a round green sonar screen device with a radar sweep and blips, "
     "bottom-left an open wooden tackle box full of colorful lures (a shop icon), bottom-right an old rolled treasure map with a red X. " + STYLE, "1:1", True),
})

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or [n for n in JOBS if not os.path.exists(os.path.join(out, n + ".png"))]
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        for n in names: ex.submit(gen, out, n, *JOBS[n])
