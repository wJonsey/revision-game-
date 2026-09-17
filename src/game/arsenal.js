import { RANKS } from "../progression/ranks.js";

/**
 * Fictional, arcade-style tools. They fire "patches" that decompile bug drones.
 * Stats are deliberately close so weapons never matter more than answering questions.
 */
export const WEAPONS = [
  { id: "syntax-blaster", slot: "primary", name: "Syntax Blaster", description: "Balanced automatic patch beam.", damage: 1, fireInterval: 0.18, magazine: 30, reloadTime: 1.4, spread: 0.012, colour: "#3ddbd9" },
  { id: "debugger-rifle", slot: "primary", name: "Debugger Rifle", description: "Slow, precise, removes a bug in two hits.", damage: 2, fireInterval: 0.55, magazine: 10, reloadTime: 1.8, spread: 0.002, colour: "#be95ff" },
  { id: "algorithm-smg", slot: "primary", name: "Algorithm SMG", description: "Very fast, less accurate.", damage: 1, fireInterval: 0.09, magazine: 45, reloadTime: 1.6, spread: 0.03, colour: "#6fdc8c" },
  { id: "compiler-pistol", slot: "secondary", name: "Compiler Pistol", description: "Reliable backup. Never needs reloading.", damage: 1, fireInterval: 0.3, magazine: Infinity, reloadTime: 0, spread: 0.008, colour: "#d8e1ea" },
  { id: "query-cannon", slot: "secondary", name: "Query Cannon", description: "Heavy single shot.", damage: 3, fireInterval: 1.1, magazine: 4, reloadTime: 2.2, spread: 0.004, colour: "#ffb784" },
];

/** Cosmetic colour skins unlocked by rank. No gameplay effect, no purchases. */
export const SKINS = [
  { id: "default", name: "Standard Issue", colour: null, unlockRank: 0 },
  { id: "terminal-green", name: "Terminal Green", colour: "#42be65", unlockRank: 1 },
  { id: "compile-gold", name: "Compile Gold", colour: "#f1c21b", unlockRank: 2 },
  { id: "kernel-violet", name: "Kernel Violet", colour: "#a56eff", unlockRank: 3 },
  { id: "null-white", name: "Null Pointer White", colour: "#f4f4f4", unlockRank: 5 },
  { id: "master-magenta", name: "Master Build", colour: "#ff7eb6", unlockRank: 7 },
].map((skin) => ({ ...skin, unlockRankName: RANKS[skin.unlockRank].name }));

export function getWeapon(id) {
  return WEAPONS.find((weapon) => weapon.id === id);
}
