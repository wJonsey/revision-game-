import { DAY_MS } from "../core/dates.js";

/**
 * Weakness score per spec section (0 = strong, 1 = very weak).
 *
 *   weakness = 0.45 × inaccuracy          (overall and last-10 accuracy blended)
 *            + 0.25 × recent mistake rate (last 5 attempts)
 *            + 0.10 × slow answer rate    (answers slower than SLOW_ANSWER_MS)
 *            + 0.20 × staleness           (days since last correct answer, capped at 14)
 */

export const SLOW_ANSWER_MS = 45 * 1000;
export const UNSEEN_WEAKNESS = 0.5;
const STALE_AFTER_DAYS = 14;

/**
 * Groups attempts by spec section.
 * @param {Array<{ specRef: string, correct: boolean, responseMs: number, at: number, type?: string }>} attempts
 */
export function statsBySection(attempts) {
  const bySection = new Map();
  for (const attempt of attempts) {
    if (!bySection.has(attempt.specRef)) bySection.set(attempt.specRef, []);
    bySection.get(attempt.specRef).push(attempt);
  }
  const stats = new Map();
  for (const [specRef, list] of bySection) {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    const correct = sorted.filter((a) => a.correct).length;
    const correctTimes = sorted.filter((a) => a.correct).map((a) => a.at);
    stats.set(specRef, {
      specRef,
      attempts: sorted.length,
      correct,
      accuracy: correct / sorted.length,
      recent: sorted.slice(-10),
      lastAttemptAt: sorted[sorted.length - 1].at,
      lastCorrectAt: correctTimes.length ? correctTimes[correctTimes.length - 1] : null,
      avgResponseMs: sorted.reduce((sum, a) => sum + (a.responseMs ?? 0), 0) / sorted.length,
    });
  }
  return stats;
}

export function weaknessScore(stat, now) {
  if (!stat || stat.attempts === 0) return UNSEEN_WEAKNESS;
  const recentAccuracy = stat.recent.filter((a) => a.correct).length / stat.recent.length;
  const inaccuracy = 1 - (0.5 * stat.accuracy + 0.5 * recentAccuracy);

  const lastFive = stat.recent.slice(-5);
  const recentMistakeRate = lastFive.filter((a) => !a.correct).length / lastFive.length;

  const timed = stat.recent.filter((a) => a.type !== "open_response");
  const slowRate = timed.length ? timed.filter((a) => a.responseMs > SLOW_ANSWER_MS).length / timed.length : 0;

  const staleness = stat.lastCorrectAt === null
    ? 1
    : Math.min(1, (now - stat.lastCorrectAt) / DAY_MS / STALE_AFTER_DAYS);

  const score = 0.45 * inaccuracy + 0.25 * recentMistakeRate + 0.1 * slowRate + 0.2 * staleness;
  return Math.max(0, Math.min(1, score));
}

/** Map of specRef → weakness score for every section that has attempts. */
export function weaknessBySection(attempts, now) {
  const result = new Map();
  for (const [specRef, stat] of statsBySection(attempts)) {
    result.set(specRef, weaknessScore(stat, now));
  }
  return result;
}
