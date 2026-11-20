import type { Lang, ZoneId } from "../core/types.ts";

// Fishing spots: every place on the world map has three. Each spot draws certain creatures, so filling
// the logbook means exploring. A spot opens when you have caught `need` different kinds in its place.

export interface SpotDef {
  id: string;
  zone: ZoneId;
  names: Record<Lang, string>;
  need: number;
  /** these fish turn up 3x as often here */
  attracts: string[];
  /** extra odds for the big ones at the far spots */
  rare?: number;
  /** position on the world map (world units, map is 1600 x 1100) */
  at: [number, number];
}

const n = (en: string, es: string, pt: string, hi: string, ja: string): Record<Lang, string> => ({ en, es, pt, hi, ja });

export const SPOTS: SpotDef[] = [
  { id: "lily_pond", zone: "lake", need: 0, at: [270, 860], attracts: ["minnow", "bluegill", "rubber_duck"],
    names: n("Lily Pond", "Estanque de nenúfares", "Lagoa dos Lírios", "कमल तालाब", "スイレン池") },
  { id: "old_mill", zone: "lake", need: 3, at: [400, 800], attracts: ["perch", "catfish", "old_boot", "old_whiskers"],
    names: n("Old Mill", "Viejo molino", "Moinho Velho", "पुरानी चक्की", "古い水車") },
  { id: "misty_falls", zone: "lake", need: 6, at: [310, 720], attracts: ["trout", "pike", "koi_queen", "glow_eel"], rare: 1.3,
    names: n("Misty Falls", "Cascada brumosa", "Cachoeira Nebulosa", "धुंधला झरना", "霧の滝") },

  { id: "sunny_bay", zone: "ocean", need: 0, at: [660, 780], attracts: ["sardine", "clownfish", "puffer"],
    names: n("Sunny Bay", "Bahía soleada", "Baía Ensolarada", "धूप वाली खाड़ी", "ひだまり湾") },
  { id: "shipwreck", zone: "ocean", need: 3, at: [820, 640], attracts: ["mackerel", "soda_can", "jelly", "angler"],
    names: n("Shipwreck", "Barco hundido", "Naufrágio", "डूबा जहाज़", "沈没船") },
  { id: "blue_deep", zone: "ocean", need: 6, at: [760, 470], attracts: ["tuna", "swordfish", "grand_marlin"], rare: 1.3,
    names: n("The Blue Deep", "El Azul Profundo", "O Azul Profundo", "गहरा नीला", "ブルーディープ") },

  { id: "igloo_cove", zone: "ice", need: 0, at: [440, 340], attracts: ["ice_cod", "snow_crab", "baby_penguin"],
    names: n("Igloo Cove", "Cala del iglú", "Enseada do Iglu", "इग्लू खाड़ी", "イグルー入り江") },
  { id: "glacier_gate", zone: "ice", need: 3, at: [280, 250], attracts: ["arctic_char", "frost_jelly", "lost_mitten"],
    names: n("Glacier Gate", "Puerta del glaciar", "Portão da Geleira", "हिमनद द्वार", "氷河の門") },
  { id: "aurora_rift", zone: "ice", need: 6, at: [140, 130], attracts: ["crystal_trout", "beluga", "narwhal_king"], rare: 1.3,
    names: n("Aurora Rift", "Grieta de la aurora", "Fenda da Aurora", "ध्रुवज्योति दरार", "オーロラの裂け目") },

  { id: "turtle_lagoon", zone: "reef", need: 0, at: [1235, 790], attracts: ["blue_tang", "sea_turtle", "seahorse"],
    names: n("Turtle Lagoon", "Laguna de tortugas", "Lagoa das Tartarugas", "कछुआ लैगून", "カメのラグーン") },
  { id: "coral_garden", zone: "reef", need: 3, at: [1340, 865], attracts: ["parrotfish", "lionfish", "flip_flop"],
    names: n("Coral Garden", "Jardín de coral", "Jardim de Coral", "मूंगा बगीचा", "サンゴの庭") },
  { id: "manta_wall", zone: "reef", need: 6, at: [1525, 700], attracts: ["octopus", "manta", "coral_dragon"], rare: 1.3,
    names: n("Manta Wall", "Muro de mantas", "Parede das Mantas", "मंटा दीवार", "マンタの壁") },

  { id: "ash_beach", zone: "volcano", need: 0, at: [1050, 330], attracts: ["ember_fish", "hot_bottle", "magma_crab"],
    names: n("Ash Beach", "Playa de ceniza", "Praia de Cinzas", "राख तट", "灰の浜") },
  { id: "obsidian_cove", zone: "volcano", need: 3, at: [1360, 440], attracts: ["obsidian_puffer", "salamander", "lava_jelly"],
    names: n("Obsidian Cove", "Cala de obsidiana", "Enseada de Obsidiana", "ओब्सीडियन खाड़ी", "黒曜石の入り江") },
  { id: "fire_heart", zone: "volcano", need: 6, at: [1250, 235], attracts: ["fire_koi", "basalt_grouper", "phoenix_fish"], rare: 1.3,
    names: n("Fire Heart", "Corazón de fuego", "Coração de Fogo", "अग्नि हृदय", "炎の心臓") },
];

export const SPOT_BY_ID: Record<string, SpotDef> = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
export const spotsOf = (z: ZoneId) => SPOTS.filter((s) => s.zone === z);
/** different kinds caught in a place (junk counts: it is in the logbook too) */
export const kindsCaught = (album: Record<string, unknown>, z: ZoneId, fishZone: (id: string) => ZoneId | undefined) =>
  Object.keys(album).filter((id) => fishZone(id) === z).length;
