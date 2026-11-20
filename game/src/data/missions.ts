import { maxDepth } from "../core/economy.ts";
import type { SaveData } from "../core/save.ts";
import { FISH_BY_ID } from "./fish.ts";

// Starter missions: tiny goals for the first minutes, one at a time, each with a little reward.
// They fill the gap between the first upgrade and the first big moments.

export interface Mission {
  id: string;
  /** current progress and target, read from the save */
  progress: (s: SaveData) => [number, number];
  reward: number;
  text: Record<"en" | "es" | "pt" | "hi" | "ja", string>;
}

const rareCaught = (s: SaveData) => Object.keys(s.album).some((id) => FISH_BY_ID[id] && FISH_BY_ID[id].rarity !== "common" && !FISH_BY_ID[id].junk);
const upgrades = (s: SaveData) => s.upgrades.line + s.upgrades.capacity + s.upgrades.luck;

export const MISSIONS: Mission[] = [
  { id: "catch5", reward: 40, progress: (s) => [Math.min(5, s.stats.catches), 5],
    text: { en: "Catch 5 fish", es: "Atrapa 5 peces", pt: "Pegue 5 peixes", hi: "5 मछलियाँ पकड़ो", ja: "魚を5匹釣ろう" } },
  { id: "upgrade", reward: 60, progress: (s) => [Math.min(1, upgrades(s)), 1],
    text: { en: "Buy an upgrade", es: "Compra una mejora", pt: "Compre uma melhoria", hi: "एक अपग्रेड खरीदो", ja: "アップグレードを買おう" } },
  { id: "rare", reward: 120, progress: (s) => [rareCaught(s) ? 1 : 0, 1],
    text: { en: "Catch a rare fish", es: "Atrapa un pez raro", pt: "Pegue um peixe raro", hi: "एक दुर्लभ मछली पकड़ो", ja: "レアな魚を釣ろう" } },
  { id: "depth60", reward: 150, progress: (s) => [Math.min(60, maxDepth(s.upgrades) / 10), 60],
    text: { en: "Reach 60 m", es: "Llega a 60 m", pt: "Chegue a 60 m", hi: "60 मीटर तक पहुँचो", ja: "60mに到達しよう" } },
  { id: "fight", reward: 250, progress: (s) => [Math.min(1, s.stats.fightsWon), 1],
    text: { en: "Land a big fish", es: "Saca un pez grande", pt: "Fisgue um peixe grande", hi: "एक बड़ी मछली पकड़ो", ja: "大物を釣り上げよう" } },
  { id: "catch50", reward: 300, progress: (s) => [Math.min(50, s.stats.catches), 50],
    text: { en: "Catch 50 fish", es: "Atrapa 50 peces", pt: "Pegue 50 peixes", hi: "50 मछलियाँ पकड़ो", ja: "魚を50匹釣ろう" } },
  { id: "ocean", reward: 500, progress: (s) => [s.zones.includes("ocean") ? 1 : 0, 1],
    text: { en: "Unlock the Ocean", es: "Desbloquea el Océano", pt: "Desbloqueie o Oceano", hi: "समुद्र अनलॉक करो", ja: "海を解放しよう" } },
];
