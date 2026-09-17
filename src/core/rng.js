/**
 * Seeded random numbers so question selection, daily challenges and tests are repeatable.
 */

/** Mulberry32 pseudo-random generator. Returns a function giving numbers in [0, 1). */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash: turns a string such as "2026-09-17" into a numeric seed. */
export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Returns a shuffled copy (Fisher-Yates). The original array is not changed. */
export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks one item with probability proportional to its weight.
 * Returns undefined for an empty list. Items with weight <= 0 are never picked
 * unless every weight is <= 0, in which case the pick is uniform.
 */
export function weightedPick(items, weightOf, rng = Math.random) {
  if (items.length === 0) return undefined;
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return items[Math.floor(rng() * items.length)];
  let target = rng() * total;
  for (let i = 0; i < items.length; i++) {
    target -= weights[i];
    if (target < 0) return items[i];
  }
  return items[items.length - 1];
}
