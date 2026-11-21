// Material colours, shared by the city (voxels) and the swarm (flying chips)
export const MATS: [number, number, number][] = [
  [0, 0, 0],
  [0.93, 0.87, 0.74], // 1 plaster
  [0.42, 0.27, 0.16], // 2 timber
  [0.74, 0.28, 0.18], // 3 roof tile
  [0.35, 0.62, 0.92], // 4 glass
  [0.52, 0.32, 0.18], // 5 door wood
  [0.60, 0.58, 0.54], // 6 stone
  [0.40, 0.27, 0.17], // 7 bark
  [0.27, 0.62, 0.22], // 8 leaf
  [0.48, 0.78, 0.30], // 9 light leaf
  [1.00, 0.62, 0.80], // 10 blossom
  [0.90, 0.76, 0.36], // 11 hay
  [0.66, 0.30, 0.22], // 12 brick
  [1.00, 0.82, 0.35], // 13 gold window
  [0.24, 0.40, 0.82], // 14 blue roof
  [0.74, 0.20, 0.14], // 15 red plank
  [0.95, 0.95, 0.90], // 16 white trim
  [0.50, 0.50, 0.47], // 17 granite
  [1.00, 0.60, 0.15], // 18 giant's eyes
  [0.30, 0.48, 0.22], // 19 moss
  [0.86, 0.16, 0.14], // 20 mushroom cap
  [0.98, 0.95, 0.88], // 21 mushroom spots
  [0.92, 0.86, 0.72], // 22 mushroom stem
  [0.95, 0.97, 1.00], // 23 snow
  [0.12, 0.38, 0.22], // 24 pine
  [0.70, 0.45, 1.00], // 25 crystal
  [0.16, 0.13, 0.18], // 26 obsidian
  [0.36, 0.42, 0.52], // 27 slate roof
];
export const MAT_GLSL = `const vec3 MAT[${MATS.length}] = vec3[${MATS.length}](${MATS.map((m) => `vec3(${m.map((v) => v.toFixed(3)).join(",")})`).join(",")});`;
