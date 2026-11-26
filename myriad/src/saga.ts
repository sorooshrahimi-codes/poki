// The journey: five lands side by side, joined by gates. Each land is a short chain of clear tasks, one at a time,
// always with one arrow to where to go. The last task in each land is its stone giant; then the north gate opens
// and the swarm walks straight on into the next land (no menus, no map screen).
export type Goal = "wreck" | "gold" | "castle" | "rival" | "giant" | "gate";
export type Level = { land: number; goal: Goal; n: number; seed: number };

export const LAND_ICON = ["🌼", "🍄", "🏰", "❄️", "🌋"];
export const LEVELS: Level[] = [];
for (let d = 1; d <= 5; d++) {
  const seed = 1000 + d * 37;
  LEVELS.push({ land: d, goal: "wreck", n: d === 1 ? 4 : 6 + d * 2, seed });
  LEVELS.push({ land: d, goal: "gold", n: d === 1 ? 2 : d < 4 ? 3 : 4, seed });
  if (d >= 2) LEVELS.push({ land: d, goal: "rival", n: [0, 0, 0.5, 0.7, 1.3, 1.6][d], seed });
  LEVELS.push({ land: d, goal: "castle", n: 2 + d * 0.9, seed });
  LEVELS.push({ land: d, goal: "giant", n: 1, seed });
  LEVELS.push({ land: d, goal: "gate", n: 1, seed });
}
/** the steps of a land, for the little dots under its icon */
export const stepsOf = (land: number) => LEVELS.filter((L) => L.land === land);
export const firstOf = (land: number) => LEVELS.findIndex((L) => L.land === land);

export const GOAL_ICON: Record<Goal, string> = { wreck: "🏚️", gold: "🌟", castle: "🏰", rival: "🔵", giant: "🗿", gate: "🚪" };
/** the task in a few plain words */
export function goalSentence(L: Level) {
  switch (L.goal) {
    case "wreck": return `Destroy ${L.n} houses`;
    case "gold": return `Grab the golden star${L.n > 1 ? "s" : ""}`;
    case "castle": return `Break the big tower`;
    case "rival": return L.n > 1 ? `Grow bigger, then eat the blue swarm` : `Eat the blue swarm`;
    case "giant": return `The giant wakes! Bring it down`;
    case "gate": return `The gate is open: on to the next land!`;
  }
}
