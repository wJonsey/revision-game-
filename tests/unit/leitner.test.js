import { describe, expect, it } from "vitest";
import { updateCard, isDue, REVIEW_INTERVALS_MS, MASTERED_BOX } from "../../src/revision/leitner.js";
import { DAY_MS } from "../../src/core/dates.js";

const at = 1_000_000;

describe("updateCard", () => {
  it("moves a new card to Familiar after a confident correct answer", () => {
    const card = updateCard(undefined, { correct: true, confidence: "sure", at });
    expect(card.box).toBe(2);
    expect(card.nextReviewAt).toBe(at + REVIEW_INTERVALS_MS[2]);
    expect(card.promotedAt).toBe(at);
  });

  it("does not promote a correct guess", () => {
    const learning = updateCard(undefined, { correct: false, at });
    const guessed = updateCard(learning, { correct: true, confidence: "guess", at: at + 1 });
    expect(guessed.box).toBe(1);
    expect(guessed.correctCount).toBe(1);
  });

  it("sends a card back to Learning after a wrong answer", () => {
    let card;
    for (let i = 0; i < 3; i++) card = updateCard(card, { correct: true, confidence: "sure", at: at + i });
    expect(card.box).toBe(MASTERED_BOX);
    card = updateCard(card, { correct: false, at: at + 10 });
    expect(card).toMatchObject({ box: 1, consecutiveCorrect: 0, incorrectCount: 1 });
  });

  it("never goes above Mastered and waits 30 days for repeat reviews", () => {
    let card;
    for (let i = 0; i < 6; i++) card = updateCard(card, { correct: true, confidence: "sure", at });
    expect(card.box).toBe(MASTERED_BOX);
    expect(card.nextReviewAt).toBe(at + 30 * DAY_MS);
  });
});

describe("isDue", () => {
  it("treats unseen cards as due and respects the review time boundary", () => {
    expect(isDue(undefined, at)).toBe(true);
    const card = { nextReviewAt: at };
    expect(isDue(card, at - 1)).toBe(false);
    expect(isDue(card, at)).toBe(true);
  });
});
