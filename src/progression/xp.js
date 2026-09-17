/**
 * XP rules. Designed so that accuracy and learning pay more than volume:
 * - wrong answers give no XP
 * - a correct answer the player marked as a guess gives half XP
 * - repeating a question already answered in the same session gives a quarter
 * - round bonuses only start at 70% accuracy
 */

export const BASE_XP = { beginner: 50, easy: 75, medium: 100, hard: 200, expert: 300, boss: 500 };
export const DAILY_FIRST_SESSION_BONUS = 300;
export const DAILY_DEPLOYMENT_BONUS = 400;
export const WEEKLY_INCIDENT_BONUS = 1000;

/**
 * @param {{ question: any, result: { correct: boolean, score: number },
 *           confidence?: string, repeatInSession?: boolean, multiplier?: number }} input
 */
export function xpForAnswer({ question, result, confidence = "unsure", repeatInSession = false, multiplier = 1 }) {
  const base = BASE_XP[question.difficulty] ?? BASE_XP.medium;
  let xp;
  if (result.correct) {
    xp = base * result.score;
  } else if (question.type === "open_response" && result.score > 0) {
    xp = base * result.score * 0.5; // partial credit for written answers
  } else {
    return 0;
  }
  if (confidence === "guess") xp *= 0.5;
  if (repeatInSession) xp *= 0.25;
  return Math.round(xp * multiplier);
}

/** Round bonus: 50 XP per question at ≥90% accuracy, 25 at ≥70%, otherwise none. */
export function roundBonus(correct, answered) {
  if (answered === 0) return 0;
  const accuracy = correct / answered;
  if (accuracy >= 0.9) return 50 * answered;
  if (accuracy >= 0.7) return 25 * answered;
  return 0;
}
