import type { EventId, Lang, Rarity, UpgradeId, ZoneId } from "./core/types.ts";
import type { FishDef } from "./core/types.ts";

// The whole game has very little text: icons, numbers and colours carry the rest.
// Missing strings fall back to English. Fish names live with the fish (data/fish.ts).

export const LANGS: Lang[] = ["en", "es", "pt", "hi", "ja"];
export const LANG_LABEL: Record<Lang, string> = { en: "EN", es: "ES", pt: "PT", hi: "हि", ja: "日本" };

type Key =
  | "rarity.common" | "rarity.rare" | "rarity.epic" | "rarity.legendary" | "rarity.secret"
  | "up.line" | "up.capacity" | "up.luck" | "max"
  | "zone.lake" | "zone.ocean"
  | "ev.blood_moon" | "ev.meteor" | "ev.rainbow_sky" | "ev.golden_hour" | "ev.next"
  | "sur.golden_school" | "sur.shark" | "sur.bottle" | "sur.whirlpool" | "sur.chest" | "sur.shadow" | "stolen" | "escaped" | "map"
  | "new" | "collect" | "double" | "snapped" | "retry" | "letgo" | "reel" | "album" | "paused" | "resume";

const T: Record<Lang, Partial<Record<Key, string>>> = {
  en: {
    "sur.golden_school": "Golden school!", "sur.shark": "Shark! Dodge it!", "sur.bottle": "A bottle drifts by...", "sur.whirlpool": "Whirlpool! Going deeper!", "sur.chest": "Treasure chest!", "sur.shadow": "Something HUGE is down there...", stolen: "The shark stole a fish!", escaped: "You escaped the shark!", map: "Map piece",
    "rarity.common": "Common", "rarity.rare": "Rare", "rarity.epic": "Epic", "rarity.legendary": "Legendary", "rarity.secret": "SECRET",
    "up.line": "Line", "up.capacity": "Hooks", "up.luck": "Luck", max: "MAX",
    "zone.lake": "Lake", "zone.ocean": "Ocean",
    "ev.blood_moon": "Blood Moon", "ev.meteor": "Meteor Shower", "ev.rainbow_sky": "Rainbow Sky", "ev.golden_hour": "Golden Hour", "ev.next": "Next",
    new: "NEW!", collect: "Collect", double: "x2", snapped: "Line snapped!", retry: "Try again", letgo: "Let it go",
    reel: "HOLD!", album: "Album", paused: "Paused", resume: "Play",
  },
  es: {
    "sur.golden_school": "¡Banco dorado!", "sur.shark": "¡Tiburón! ¡Esquívalo!", "sur.bottle": "Una botella flota...", "sur.whirlpool": "¡Remolino! ¡Más hondo!", "sur.chest": "¡Cofre del tesoro!", "sur.shadow": "Algo ENORME hay ahí abajo...", stolen: "¡El tiburón robó un pez!", escaped: "¡Escapaste del tiburón!", map: "Trozo de mapa",
    "rarity.common": "Común", "rarity.rare": "Raro", "rarity.epic": "Épico", "rarity.legendary": "Legendario", "rarity.secret": "SECRETO",
    "up.line": "Sedal", "up.capacity": "Anzuelos", "up.luck": "Suerte", max: "MÁX",
    "zone.lake": "Lago", "zone.ocean": "Océano",
    "ev.blood_moon": "Luna de Sangre", "ev.meteor": "Lluvia de Meteoros", "ev.rainbow_sky": "Cielo Arcoíris", "ev.golden_hour": "Hora Dorada", "ev.next": "Siguiente",
    new: "¡NUEVO!", collect: "Cobrar", double: "x2", snapped: "¡Se rompió el sedal!", retry: "Otra vez", letgo: "Soltarlo",
    reel: "¡MANTÉN!", album: "Álbum", paused: "Pausa", resume: "Jugar",
  },
  pt: {
    "sur.golden_school": "Cardume dourado!", "sur.shark": "Tubarão! Desvie!", "sur.bottle": "Uma garrafa passa...", "sur.whirlpool": "Redemoinho! Mais fundo!", "sur.chest": "Baú do tesouro!", "sur.shadow": "Tem algo ENORME lá embaixo...", stolen: "O tubarão roubou um peixe!", escaped: "Você escapou do tubarão!", map: "Pedaço do mapa",
    "rarity.common": "Comum", "rarity.rare": "Raro", "rarity.epic": "Épico", "rarity.legendary": "Lendário", "rarity.secret": "SECRETO",
    "up.line": "Linha", "up.capacity": "Anzóis", "up.luck": "Sorte", max: "MÁX",
    "zone.lake": "Lago", "zone.ocean": "Oceano",
    "ev.blood_moon": "Lua de Sangue", "ev.meteor": "Chuva de Meteoros", "ev.rainbow_sky": "Céu Arco-íris", "ev.golden_hour": "Hora Dourada", "ev.next": "Próximo",
    new: "NOVO!", collect: "Pegar", double: "x2", snapped: "A linha arrebentou!", retry: "De novo", letgo: "Deixar ir",
    reel: "SEGURE!", album: "Álbum", paused: "Pausado", resume: "Jogar",
  },
  hi: {
    "sur.golden_school": "सुनहरा झुंड!", "sur.shark": "शार्क! बचो!", "sur.bottle": "एक बोतल तैर रही है...", "sur.whirlpool": "भँवर! और गहराई में!", "sur.chest": "खज़ाने का संदूक!", "sur.shadow": "नीचे कुछ विशाल है...", stolen: "शार्क ने मछली चुरा ली!", escaped: "तुम शार्क से बच गए!", map: "नक्शे का टुकड़ा",
    "rarity.common": "साधारण", "rarity.rare": "दुर्लभ", "rarity.epic": "महाकाव्य", "rarity.legendary": "पौराणिक", "rarity.secret": "रहस्य",
    "up.line": "डोरी", "up.capacity": "काँटे", "up.luck": "किस्मत", max: "अधिकतम",
    "zone.lake": "झील", "zone.ocean": "समुद्र",
    "ev.blood_moon": "रक्त चंद्र", "ev.meteor": "उल्का वर्षा", "ev.rainbow_sky": "इंद्रधनुषी आकाश", "ev.golden_hour": "सुनहरा समय", "ev.next": "अगला",
    new: "नया!", collect: "लें", double: "x2", snapped: "डोरी टूट गई!", retry: "फिर से", letgo: "जाने दो",
    reel: "दबाए रखें!", album: "एल्बम", paused: "रुका हुआ", resume: "खेलें",
  },
  ja: {
    "sur.golden_school": "金色の群れ!", "sur.shark": "サメだ! よけて!", "sur.bottle": "ボトルが流れてきた...", "sur.whirlpool": "渦潮! もっと深く!", "sur.chest": "宝箱!", "sur.shadow": "下に何か巨大なものが...", stolen: "サメに魚を取られた!", escaped: "サメから逃げた!", map: "地図のかけら",
    "rarity.common": "コモン", "rarity.rare": "レア", "rarity.epic": "エピック", "rarity.legendary": "レジェンド", "rarity.secret": "シークレット",
    "up.line": "糸", "up.capacity": "針", "up.luck": "運", max: "MAX",
    "zone.lake": "湖", "zone.ocean": "海",
    "ev.blood_moon": "ブラッドムーン", "ev.meteor": "流星群", "ev.rainbow_sky": "虹の空", "ev.golden_hour": "ゴールデンアワー", "ev.next": "次",
    new: "NEW!", collect: "受け取る", double: "x2", snapped: "糸が切れた!", retry: "もう一回", letgo: "逃がす",
    reel: "長押し!", album: "図鑑", paused: "一時停止", resume: "プレイ",
  },
};

let lang: Lang = "en";
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
}

/** first browser language we support; Hindi only when the browser itself asks for Hindi */
export function detectLang(): Lang {
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase().slice(0, 2) as Lang;
    if (LANGS.includes(code)) return code;
  }
  return "en";
}

export const t = (k: Key) => T[lang][k] ?? T.en[k] ?? k;
export const tRarity = (r: Rarity) => t(`rarity.${r}` as Key);
export const tUpgrade = (u: UpgradeId) => t(`up.${u}` as Key);
export const tZone = (z: ZoneId) => t(`zone.${z}` as Key);
export const tEvent = (e: EventId) => t(`ev.${e}` as Key);
export const fishName = (f: FishDef) => f.names?.[lang] ?? f.name;
