import type { BiomeId, MutationId, Rarity } from "../core/types.ts";
import { getLang, type Lang } from "../i18n.ts";

// The critter index. `resist` is how hard it fights the vacuum (1 = flies straight in);
// `income` is what one earns per second on its park pedestal.
export interface CritterDef {
  id: string;
  name: string;
  /** the name in other languages (English is `name`) */
  names?: Partial<Record<Lang, string>>;
  biome: BiomeId;
  rarity: Rarity;
  /** sprite name in public/art */
  art: string;
  size: number;
  /** hop height and how often it hops */
  hop: number;
  resist: number;
  income: number;
  /** fallback colour if the sprite is missing */
  color: string;
  /** how it behaves in the field: each asks for a different move from the player */
  behave: Behave;
}
/** hop: wanders · fly: floats up high, aim up · burrow: pops in and out of the ground · shy: dashes away from the cone ·
 *  split: becomes two when first hit · shell: hides in a shell when hit, wait for it to peek */
export type Behave = "hop" | "fly" | "burrow" | "shy" | "split" | "shell";

let curBiome: BiomeId = "meadow";
const c = (id: string, name: string, rarity: Rarity, size: number, hop: number, resist: number, income: number, color: string, behave: Behave = "hop", names?: Partial<Record<Lang, string>>): CritterDef =>
  ({ id, name, names, biome: curBiome, rarity, art: id, size, hop, resist, income, color, behave });
const biome = (b: BiomeId) => { curBiome = b; return [] as CritterDef[]; };

export const CRITTERS: CritterDef[] = [
  ...biome("meadow"),
  c("puffbun", "Puffbun", "common", 56, 26, 1, 1, "#ffd6e6", "shy", { fr: "Lapinou", de: "Puschelhas", es: "Conejito Puf", it: "Coniglietto", pt: "Coelhofo", tr: "Pofuduk", hi: "पफ़ी", ja: "ふわうさ" }),
  c("sprig", "Sprig", "common", 48, 18, 1, 1, "#8fe07a", "hop", { fr: "Brindille", de: "Zweiglein", es: "Ramito", it: "Rametto", pt: "Raminho", tr: "Filiz", hi: "अंकुर", ja: "めばえ" }),
  c("mushi", "Mushi", "common", 53, 10, 1, 1.5, "#ff6b6b", "burrow", { fr: "Champi", de: "Pilzi", es: "Setita", it: "Funghetto", pt: "Cogumi", tr: "Mantarcık", hi: "मशी", ja: "きのこっち" }),
  c("bumbo", "Bumbo", "common", 48, 34, 1, 1.5, "#ffd23f", "fly", { fr: "Bourdi", de: "Brummi", es: "Abejorro", it: "Bombo", pt: "Zumbo", tr: "Vızvız", hi: "भौंरू", ja: "ぶんぶん" }),
  c("pebblo", "Pebblo", "common", 53, 6, 1.4, 2, "#9aa5b1", "hop", { fr: "Caillou", de: "Kieseli", es: "Piedrín", it: "Sassolino", pt: "Pedrinho", tr: "Çakıl", hi: "कंकड़ू", ja: "ころいし" }),
  c("dewdrop", "Dewdrop", "rare", 50, 22, 1.6, 5, "#7fd3ff", "split", { fr: "Goutte", de: "Tautropf", es: "Gotita", it: "Gocciolina", pt: "Gotinha", tr: "Damlacık", hi: "ओसबूँद", ja: "しずくん" }),
  c("snailo", "Snailo", "rare", 53, 4, 2, 6, "#c9a7ff", "shell", { fr: "Escargo", de: "Schnecki", es: "Caracolín", it: "Lumachino", pt: "Caracolzinho", tr: "Salyo", hi: "घोंघू", ja: "でんでん" }),
  c("hootle", "Hootle", "rare", 59, 14, 2, 7, "#b07a4a", "fly", { fr: "Hibouli", de: "Huhu", es: "Buhíto", it: "Gufetto", pt: "Corujinha", tr: "Baykuşçuk", hi: "उल्लू", ja: "ほーほー" }),
  c("clovy", "Clovy", "epic", 56, 20, 3.2, 20, "#3ccf6a", "hop", { fr: "Trèflou", de: "Kleeli", es: "Trebolín", it: "Trifoglino", pt: "Trevinho", tr: "Yonca", hi: "तिपतिया", ja: "クローバ" }),
  c("honeyblob", "Honeyblob", "epic", 62, 12, 3.6, 24, "#ffb13a", "hop", { fr: "Miellou", de: "Honigklecks", es: "Mielito", it: "Mielino", pt: "Melzinho", tr: "Ballı", hi: "शहदू", ja: "はちみつぷる" }),
  c("sunpup", "Sunpup", "legendary", 70, 24, 5.5, 80, "#ff9a3a", "shy", { fr: "Toutou Soleil", de: "Sonnenwelpe", es: "Perrito Sol", it: "Cucciolo Sole", pt: "Cãozinho Sol", tr: "Güneş Kuçu", hi: "सूरज पिल्ला", ja: "おひさまワン" }),
  c("prismane", "Prismane", "legendary", 73, 20, 6.5, 120, "#e6b3ff", "fly", { fr: "Prismane", de: "Prismane", es: "Prismane", it: "Prismane", pt: "Prismane", tr: "Prizma", hi: "प्रिज़्मेन", ja: "プリズメーン" }),
  ...biome("forest"),
  c("spora", "Spora", "common", 56, 16, 1, 6, "#b48cff", "split", { fr: "Spora", de: "Spori", es: "Espora", it: "Spora", pt: "Esporinha", tr: "Sporcuk", hi: "स्पोरा", ja: "ほうしっこ" }),
  c("acornel", "Acornel", "common", 50, 20, 1, 6, "#b06a3a", "burrow", { fr: "Glandou", de: "Eichelchen", es: "Bellotín", it: "Ghiandina", pt: "Bolotinha", tr: "Palamut", hi: "बलूतू", ja: "どんぐりん" }),
  c("mossling", "Mossling", "common", 54, 12, 1.2, 8, "#7bc94a", "hop", { fr: "Moussou", de: "Moosling", es: "Musguito", it: "Muschietto", pt: "Musguinho", tr: "Yosuncuk", hi: "काईदार", ja: "こけまる" }),
  c("glowbug", "Glowbug", "common", 50, 36, 1.2, 8, "#ffe066", "fly", { fr: "Luciole", de: "Glühwürmli", es: "Luciérnaga", it: "Lucciola", pt: "Vagalume", tr: "Işıkböcek", hi: "जुगनू", ja: "ほたるん" }),
  c("toadstoo", "Toadstoo", "common", 58, 30, 1.4, 10, "#ff5a5a", "hop", { fr: "Crapaudin", de: "Krötenpilz", es: "Sapito", it: "Rospetto", pt: "Sapinho", tr: "Kurbi", hi: "मेंढू", ja: "けろたけ" }),
  c("fernfox", "Fernfox", "rare", 56, 26, 1.8, 30, "#ff8a3a", "shy", { fr: "Renard Fougère", de: "Farnfuchs", es: "Zorrito Helecho", it: "Volpe Felce", pt: "Raposinha", tr: "Tilkicik", hi: "फर्न लोमड़ी", ja: "シダぎつね" }),
  c("barkbear", "Barkbear", "rare", 62, 8, 2.2, 36, "#8a5a32", "hop", { fr: "Ourson Écorce", de: "Rindenbär", es: "Osito Corteza", it: "Orsetto Legno", pt: "Ursinho Casca", tr: "Kabuk Ayı", hi: "छाल भालू", ja: "きのくま" }),
  c("pinecub", "Pinecub", "rare", 54, 14, 2, 34, "#c98a52", "shell", { fr: "Pinourson", de: "Zapfenbär", es: "Piñita", it: "Pignetto", pt: "Pinhinho", tr: "Kozalak", hi: "चीड़ू", ja: "まつぼっくま" }),
  c("lumoth", "Lumoth", "epic", 56, 30, 3.4, 110, "#8fd3ff", "fly", { fr: "Lumite", de: "Leuchtmotte", es: "Polillaluz", it: "Falenaluce", pt: "Mariposa Luz", tr: "Işık Güvesi", hi: "चमकी पतंगा", ja: "ひかりガ" }),
  c("crystalcap", "Crystalcap", "epic", 60, 10, 3.8, 130, "#c9b8ff", "burrow", { fr: "Cristachamp", de: "Kristallpilz", es: "Setacristal", it: "Fungo Cristallo", pt: "Cogucristal", tr: "Kristal Mantar", hi: "क्रिस्टल छतरी", ja: "すいしょうだけ" }),
  c("elderoak", "Elderoak", "legendary", 70, 10, 6, 420, "#5f9b4a", "hop", { fr: "Vieux Chêne", de: "Uralteiche", es: "Roble Abuelo", it: "Quercia Antica", pt: "Carvalho Ancião", tr: "Ulu Meşe", hi: "बूढ़ा बलूत", ja: "じいさまオーク" }),
  c("moonfawn", "Moonfawn", "legendary", 70, 28, 7, 600, "#fff4d6", "shy", { fr: "Faon de Lune", de: "Mondkitz", es: "Cervatillo Luna", it: "Cerbiatto Luna", pt: "Cervinho Lua", tr: "Ay Ceylanı", hi: "चाँद हिरन", ja: "つきじか" }),
  ...biome("frost"),
  c("snowpuff", "Snowpuff", "common", 56, 22, 1, 36, "#ffffff", "hop", { fr: "Floconnet", de: "Schneeflausch", es: "Copito", it: "Fiocchetto", pt: "Floquinho", tr: "Kartopu", hi: "बर्फ़ू", ja: "ゆきふわ" }),
  c("pengo", "Pengo", "common", 56, 14, 1.2, 40, "#22304a", "shy", { fr: "Pingou", de: "Pingi", es: "Pingüi", it: "Pinguì", pt: "Pinguinho", tr: "Pengu", hi: "पेंगू", ja: "ペンゴ" }),
  c("icicub", "Icicub", "common", 52, 8, 1.4, 44, "#9fe0ff", "burrow", { fr: "Glaçon", de: "Eisbärli", es: "Hielín", it: "Ghiacciolino", pt: "Gelinho", tr: "Buzcuk", hi: "हिमू", ja: "こおりぐま" }),
  c("mittens", "Mittens", "common", 54, 26, 1.2, 46, "#f4f8ff", "shy", { fr: "Moufles", de: "Fäustling", es: "Manoplas", it: "Manopola", pt: "Luvinha", tr: "Eldiven", hi: "दस्ताना", ja: "てぶくろ" }),
  c("frostbite", "Frostbite", "common", 58, 18, 1.4, 52, "#7fb8ff", "hop", { fr: "Givrou", de: "Frosti", es: "Escarchín", it: "Brinetto", pt: "Geadinha", tr: "Ayaz", hi: "ठंडू", ja: "しもっち" }),
  c("sealio", "Sealio", "rare", 60, 10, 2, 160, "#a8b4c4", "shell", { fr: "Phoquito", de: "Robbi", es: "Foquita", it: "Fochetta", pt: "Foquinha", tr: "Fokçuk", hi: "सीलू", ja: "あざらっこ" }),
  c("glacier", "Glacier", "rare", 60, 6, 2.6, 190, "#3fd0d0", "split", { fr: "Glacier", de: "Gletschi", es: "Glaciar", it: "Ghiacciaio", pt: "Geleira", tr: "Buzul", hi: "हिमनद", ja: "ひょうが" }),
  c("flurry", "Flurry", "rare", 52, 30, 1.8, 170, "#dff4ff", "fly", { fr: "Bourrasque", de: "Gestöber", es: "Ventisca", it: "Nevischio", pt: "Nevasca", tr: "Tipi", hi: "झोंका", ja: "ふぶきん" }),
  c("auroray", "Auroray", "epic", 58, 30, 3.6, 640, "#a0ffd0", "fly", { fr: "Aurorai", de: "Aurori", es: "Aurorita", it: "Aurorina", pt: "Aurorinha", tr: "Kutup Işığı", hi: "ऑरोरे", ja: "オーロレイ" }),
  c("crystowl", "Crystowl", "epic", 60, 20, 4, 720, "#cfe8ff", "fly", { fr: "Hibou Cristal", de: "Kristalleule", es: "Búho Cristal", it: "Gufo Cristallo", pt: "Coruja Cristal", tr: "Kristal Baykuş", hi: "क्रिस्टल उल्लू", ja: "こおりふくろう" }),
  c("frostking", "Frostking", "legendary", 72, 22, 6.5, 2600, "#e0f4ff", "shy", { fr: "Roi du Givre", de: "Frostkönig", es: "Rey Escarcha", it: "Re del Gelo", pt: "Rei do Gelo", tr: "Ayaz Kral", hi: "हिमराजा", ja: "ふゆのおうさま" }),
  c("wyrmling", "Wyrmling", "legendary", 72, 20, 7.5, 3600, "#8fd3ff", "fly", { fr: "Dragonnet", de: "Drachling", es: "Dragoncito", it: "Draghetto", pt: "Dragãozinho", tr: "Ejderçik", hi: "नन्हा ड्रैगन", ja: "こドラゴン" }),
  ...biome("lab"),
  // hybrids: never in the wild, only made in the lab from two parents
  c("buzzbun", "Buzzbun", "epic", 60, 20, 3, 70, "#ffd6e6", "fly"),
  c("shroomslime", "Shroomslime", "epic", 58, 16, 3, 80, "#7fd3ff", "split"),
  c("leafowl", "Leafowl", "epic", 60, 14, 3, 90, "#b07a4a", "fly"),
  c("luckshell", "Luckshell", "epic", 58, 6, 3, 110, "#3ccf6a", "shell"),
  c("glowflake", "Glowflake", "epic", 58, 24, 3.4, 420, "#fffbe0", "fly"),
  c("fernfrost", "Fernfrost", "epic", 58, 26, 3.4, 480, "#e8f4ff", "shy"),
  c("pineseal", "Pineseal", "epic", 60, 10, 3.6, 520, "#a8b4c4", "shell"),
  c("aurospore", "Aurospore", "epic", 58, 18, 3.8, 900, "#c9a7ff", "split"),
];
export interface BiomeDef { id: BiomeId; name: string; names?: Partial<Record<Lang, string>>; icon: string; bg: string; price: number }
export const BIOMES: BiomeDef[] = [
  { id: "meadow", name: "Sunny Meadow", names: { fr: "Pré Ensoleillé", de: "Sonnenwiese", es: "Prado Soleado", it: "Prato Soleggiato", pt: "Prado Ensolarado", tr: "Güneşli Çayır", hi: "धूप वाला मैदान", ja: "ひだまり草原" }, icon: "🌼", bg: "bg_meadow", price: 0 },
  { id: "forest", name: "Mushroom Forest", names: { fr: "Forêt des Champis", de: "Pilzwald", es: "Bosque de Setas", it: "Bosco dei Funghi", pt: "Mata dos Cogumelos", tr: "Mantar Ormanı", hi: "कुकुरमुत्ता वन", ja: "キノコの森" }, icon: "🍄", bg: "bg_forest", price: 9000 },
  { id: "frost", name: "Frosty Peaks", names: { fr: "Pics Givrés", de: "Frostgipfel", es: "Picos Helados", it: "Picchi Gelati", pt: "Picos Gelados", tr: "Buzlu Zirveler", hi: "बर्फ़ीली चोटियाँ", ja: "こおりの山" }, icon: "❄️", bg: "bg_frost", price: 260000 },
];
/** the name to show, in the player's language */
export const critterName = (d: CritterDef) => d.names?.[getLang()] ?? d.name;
export const biomeName = (b: BiomeDef) => b.names?.[getLang()] ?? b.name;
/** the lab's recipes: two parents (3 copies each needed, 2 each used) make one hybrid */
export const RECIPES: { hybrid: string; a: string; b: string }[] = [
  { hybrid: "buzzbun", a: "puffbun", b: "bumbo" },
  { hybrid: "shroomslime", a: "mushi", b: "dewdrop" },
  { hybrid: "leafowl", a: "sprig", b: "hootle" },
  { hybrid: "luckshell", a: "snailo", b: "clovy" },
  { hybrid: "glowflake", a: "glowbug", b: "snowpuff" },
  { hybrid: "fernfrost", a: "fernfox", b: "mittens" },
  { hybrid: "pineseal", a: "pinecub", b: "sealio" },
  { hybrid: "aurospore", a: "spora", b: "auroray" },
];
export const critterOf = (b: BiomeId) => CRITTERS.filter((d) => d.biome === b);
export const CRITTER_BY_ID: Record<string, CritterDef> = Object.fromEntries(CRITTERS.map((d) => [d.id, d]));

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 18, epic: 6, legendary: 1.5, secret: 0 };
export const RARITY_COLOR: Record<Rarity, string> = { common: "#cfd8dc", rare: "#4fc3f7", epic: "#c77dff", legendary: "#ffc93c", secret: "#ff4d8d" };
export const MUTATIONS: { id: MutationId; chance: number; mult: number; resist: number }[] = [
  { id: "gold", chance: 0.06, mult: 3, resist: 1.6 },
  { id: "rainbow", chance: 0.012, mult: 6, resist: 2.2 },
  { id: "giant", chance: 0.04, mult: 2, resist: 1.8 },
];
/** a pedestal earns more with every copy you bring: 1, 3, 9 copies = ★1, ★2, ★3 */
export const starOf = (count: number) => (count >= 20 ? 3 : count >= 5 ? 2 : count >= 1 ? 1 : 0);
export const STAR_MULT = [0, 1, 2, 4];
/** coins for catching one (park income does the rest) */
export const catchCoinsOf = (d: CritterDef, mult: number) => Math.max(1, Math.round(d.income * 2 * mult));
