import { describe, expect, it } from "vitest";
import { xpForAnswer, roundBonus, BASE_XP } from "../../src/progression/xp.js";
import { rankFor, levelFor, RANKS } from "../../src/progression/ranks.js";
import { updateStreak, displayedStreak } from "../../src/progression/streaks.js";

const medium = { difficulty: "medium", type: "multiple_choice" };

describe("xpForAnswer", () => {
  it("gives no XP for wrong answers", () => {
    expect(xpForAnswer({ question: medium, result: { correct: false, score: 0 } })).toBe(0);
  });
  it("halves XP for correct guesses and quarters repeats", () => {
    const result = { correct: true, score: 1 };
    expect(xpForAnswer({ question: medium, result })).toBe(BASE_XP.medium);
    expect(xpForAnswer({ question: medium, result, confidence: "guess" })).toBe(BASE_XP.medium / 2);
    expect(xpForAnswer({ question: medium, result, repeatInSession: true })).toBe(BASE_XP.medium / 4);
  });
  it("gives partial XP for partly correct written answers", () => {
    const written = { difficulty: "hard", type: "open_response" };
    expect(xpForAnswer({ question: written, result: { correct: false, score: 0.25 } })).toBe(25);
  });
});

describe("roundBonus", () => {
  it("uses 70% and 90% accuracy boundaries", () => {
    expect(roundBonus(6, 10)).toBe(0);
    expect(roundBonus(7, 10)).toBe(250);
    expect(roundBonus(9, 10)).toBe(500);
    expect(roundBonus(0, 0)).toBe(0);
  });
});

describe("ranks and levels", () => {
  it("finds the rank at exact boundaries", () => {
    expect(rankFor(0).name).toBe("Trainee");
    expect(rankFor(RANKS[1].minXp - 1).name).toBe("Trainee");
    expect(rankFor(RANKS[1].minXp).name).toBe("Junior Developer");
    expect(rankFor(10_000_000)).toMatchObject({ name: "Master Developer", next: null, progress: 1 });
  });
  it("calculates levels", () => {
    expect(levelFor(499).level).toBe(1);
    expect(levelFor(500).level).toBe(2);
    expect(levelFor(1100).level).toBe(3);
  });
});

describe("streaks", () => {
  const start = { current: 0, longest: 0, lastDay: null };
  it("increments on consecutive days and resets after a gap", () => {
    let streak = updateStreak(start, "2026-09-15");
    streak = updateStreak(streak, "2026-09-16");
    streak = updateStreak(streak, "2026-09-16");
    expect(streak).toMatchObject({ current: 2, longest: 2 });
    streak = updateStreak(streak, "2026-09-19");
    expect(streak).toMatchObject({ current: 1, longest: 2 });
  });
  it("shows a broken streak as 0", () => {
    expect(displayedStreak({ current: 5, longest: 5, lastDay: "2026-09-10" }, "2026-09-17")).toBe(0);
    expect(displayedStreak({ current: 5, longest: 5, lastDay: "2026-09-16" }, "2026-09-17")).toBe(5);
  });
});
