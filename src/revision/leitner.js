import { DAY_MS, MINUTE_MS } from "../core/dates.js";

/**
 * Leitner-box spaced repetition.
 * Box 0 = New (never answered). A confident correct answer moves a card up a box;
 * any wrong answer sends it back to Learning. Higher boxes wait longer before review.
 */

export const BOX_NAMES = ["New", "Learning", "Familiar", "Strong", "Mastered"];
export const MASTERED_BOX = 4;

/** Wait before the card is due again, by the box it has just moved into. */
export const REVIEW_INTERVALS_MS = [0, 10 * MINUTE_MS, DAY_MS, 4 * DAY_MS, 14 * DAY_MS];
const MASTERED_REPEAT_INTERVAL_MS = 30 * DAY_MS;

export function createCard() {
  return {
    box: 0,
    attempts: 0,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveCorrect: 0,
    lastAttemptAt: null,
    lastCorrectAt: null,
    nextReviewAt: 0,
    promotedAt: null,
  };
}

/**
 * Returns an updated copy of a card after an attempt.
 * A correct answer marked as a guess counts as correct but does not promote the card,
 * so guessing cannot fake mastery.
 * @param {ReturnType<typeof createCard>|undefined} card
 * @param {{ correct: boolean, confidence?: "sure"|"unsure"|"guess", at: number }} attempt
 */
export function updateCard(card, { correct, confidence = "unsure", at }) {
  const previous = card ?? createCard();
  const next = { ...previous, attempts: previous.attempts + 1, lastAttemptAt: at };

  if (correct) {
    next.correctCount += 1;
    next.consecutiveCorrect += 1;
    next.lastCorrectAt = at;
    if (confidence === "guess") {
      next.box = Math.max(previous.box, 1);
    } else {
      next.box = Math.min(MASTERED_BOX, Math.max(previous.box, 1) + 1);
    }
  } else {
    next.incorrectCount += 1;
    next.consecutiveCorrect = 0;
    next.box = 1;
  }

  if (next.box > previous.box) next.promotedAt = at;
  const interval = correct && previous.box === MASTERED_BOX && next.box === MASTERED_BOX
    ? MASTERED_REPEAT_INTERVAL_MS
    : REVIEW_INTERVALS_MS[next.box];
  next.nextReviewAt = at + interval;
  return next;
}

export function isDue(card, now) {
  return !card || card.nextReviewAt <= now;
}
