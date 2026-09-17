import { weightedPick } from "../core/rng.js";
import { DIFFICULTIES } from "../content/questionSchema.js";
import { isDue, MASTERED_BOX } from "./leitner.js";
import { UNSEEN_WEAKNESS } from "./weakness.js";

/**
 * Adaptive question selection.
 * Weak sections, due cards and unseen questions are more likely; mastered cards that are
 * not due are rarely repeated. Strong sections shift towards harder questions,
 * weak sections towards easier ones.
 */

export function difficultyIndex(difficulty) {
  return DIFFICULTIES.indexOf(difficulty);
}

/**
 * @param {any} question
 * @param {{ cards: Record<string, any>, weakness: Map<string, number>, now: number, focusAreas?: Set<string>, areaOf?: (ref: string) => string }} context
 */
export function questionWeight(question, { cards, weakness, now, focusAreas, areaOf }) {
  const card = cards[question.id];
  const sectionWeakness = weakness.has(question.specRef) ? weakness.get(question.specRef) : UNSEEN_WEAKNESS;
  const seen = Boolean(card && card.attempts > 0);
  const due = seen && isDue(card, now);

  let weight = 1 + 3 * sectionWeakness;
  if (due) weight += 2;
  if (!seen) weight += 1;
  if (seen && !due && card.box === MASTERED_BOX) weight *= 0.15;
  else if (seen && !due && card.box === MASTERED_BOX - 1) weight *= 0.5;

  const level = difficultyIndex(question.difficulty);
  if (sectionWeakness < 0.25) weight *= level >= 3 ? 1.6 : 0.6;
  else if (sectionWeakness > 0.6) weight *= level <= 2 ? 1.6 : 0.6;

  if (focusAreas?.size && areaOf && focusAreas.has(areaOf(question.specRef))) weight *= 1.5;
  return weight;
}

/**
 * Picks up to `count` different questions.
 * @param {{
 *   questions: any[], cards: Record<string, any>, weakness: Map<string, number>, now: number,
 *   count: number, rng?: () => number, excludeIds?: Set<string>, focusAreas?: Set<string>,
 *   areaOf?: (ref: string) => string, spreadBy?: (question: any) => string
 * }} options  `spreadBy` rotates picks across groups (e.g. content areas for boss rounds)
 */
export function selectQuestions(options) {
  const { questions, count, rng = Math.random, excludeIds = new Set(), spreadBy } = options;
  let pool = questions.filter((question) => !excludeIds.has(question.id));
  const picked = [];
  const weightOf = (question) => questionWeight(question, options);

  if (spreadBy) {
    const groups = [...new Set(pool.map(spreadBy))];
    let groupIndex = 0;
    while (picked.length < count && pool.length > 0) {
      const group = groups[groupIndex % groups.length];
      const candidates = pool.filter((question) => spreadBy(question) === group);
      groupIndex++;
      if (candidates.length === 0) {
        if (groups.every((g) => !pool.some((q) => spreadBy(q) === g))) break;
        continue;
      }
      const choice = weightedPick(candidates, weightOf, rng);
      picked.push(choice);
      pool = pool.filter((question) => question !== choice);
    }
    return picked;
  }

  while (picked.length < count && pool.length > 0) {
    const choice = weightedPick(pool, weightOf, rng);
    picked.push(choice);
    pool = pool.filter((question) => question !== choice);
  }
  return picked;
}
