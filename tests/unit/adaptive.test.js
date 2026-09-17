import { describe, expect, it } from "vitest";
import { weaknessScore, statsBySection, weaknessBySection, UNSEEN_WEAKNESS } from "../../src/revision/weakness.js";
import { selectQuestions, questionWeight } from "../../src/revision/selector.js";
import { createRng } from "../../src/core/rng.js";
import { DAY_MS } from "../../src/core/dates.js";

const now = 100 * DAY_MS;
const attempt = (specRef, correct, offsetDays = 0, responseMs = 5000) => ({ specRef, correct, responseMs, at: now - offsetDays * DAY_MS });

describe("weaknessScore", () => {
  it("scores unseen sections as medium", () => {
    expect(weaknessScore(undefined, now)).toBe(UNSEEN_WEAKNESS);
  });

  it("scores repeated mistakes as weaker than repeated success", () => {
    const attempts = [
      ...Array.from({ length: 6 }, () => attempt("6.7", false)),
      ...Array.from({ length: 6 }, () => attempt("2.2", true)),
    ];
    const scores = weaknessBySection(attempts, now);
    expect(scores.get("6.7")).toBeGreaterThan(0.8);
    expect(scores.get("2.2")).toBeLessThan(0.1);
  });

  it("increases weakness as time passes since the last correct answer", () => {
    const recent = statsBySection([attempt("2.4", true, 0)]).get("2.4");
    const old = statsBySection([attempt("2.4", true, 20)]).get("2.4");
    expect(weaknessScore(old, now)).toBeGreaterThan(weaknessScore(recent, now));
  });

  it("counts slow answers", () => {
    const fast = statsBySection([attempt("2.6", true, 0, 5000)]).get("2.6");
    const slow = statsBySection([attempt("2.6", true, 0, 90000)]).get("2.6");
    expect(weaknessScore(slow, now)).toBeGreaterThan(weaknessScore(fast, now));
  });
});

describe("selectQuestions", () => {
  const questions = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `weak-${i}`, specRef: "6.7", difficulty: "easy" })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `strong-${i}`, specRef: "2.2", difficulty: "easy" })),
  ];

  it("picks weak-section questions more often (1,000 seeded selections)", () => {
    const weakness = new Map([["6.7", 0.9], ["2.2", 0.05]]);
    const rng = createRng(42);
    let weakPicks = 0;
    for (let i = 0; i < 1000; i++) {
      const [q] = selectQuestions({ questions, cards: {}, weakness, now, count: 1, rng });
      if (q.specRef === "6.7") weakPicks++;
    }
    expect(weakPicks).toBeGreaterThan(650);
  });

  it("never repeats a question within one selection and respects exclusions", () => {
    const picked = selectQuestions({ questions, cards: {}, weakness: new Map(), now, count: 20, rng: createRng(1), excludeIds: new Set(["weak-0"]) });
    expect(picked).toHaveLength(19);
    expect(new Set(picked.map((q) => q.id)).size).toBe(19);
    expect(picked.map((q) => q.id)).not.toContain("weak-0");
  });

  it("rarely repeats mastered questions that are not due", () => {
    const q = questions[0];
    const context = { weakness: new Map(), now };
    const mastered = questionWeight(q, { ...context, cards: { [q.id]: { attempts: 5, box: 4, nextReviewAt: now + DAY_MS } } });
    const due = questionWeight(q, { ...context, cards: { [q.id]: { attempts: 5, box: 1, nextReviewAt: now - 1 } } });
    expect(due).toBeGreaterThan(mastered * 5);
  });

  it("prefers harder questions in strong sections", () => {
    const easy = { id: "e", specRef: "2.2", difficulty: "easy" };
    const hard = { id: "h", specRef: "2.2", difficulty: "hard" };
    const context = { cards: {}, weakness: new Map([["2.2", 0.1]]), now };
    expect(questionWeight(hard, context)).toBeGreaterThan(questionWeight(easy, context));
  });

  it("spreads picks across groups when asked (boss rounds)", () => {
    const picked = selectQuestions({ questions, cards: {}, weakness: new Map(), now, count: 4, rng: createRng(3), spreadBy: (q) => q.specRef });
    expect(picked.filter((q) => q.specRef === "6.7")).toHaveLength(2);
  });
});
