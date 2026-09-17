import { describe, expect, it } from "vitest";
import { checkAnswer, normaliseOutput, normaliseShortAnswer, describeCorrectAnswer } from "../../src/revision/answerChecker.js";

describe("checkAnswer", () => {
  it("marks multiple choice", () => {
    const q = { type: "multiple_choice", options: ["a", "b"], answer: 1 };
    expect(checkAnswer(q, { choice: 1 }).correct).toBe(true);
    expect(checkAnswer(q, { choice: 0 }).correct).toBe(false);
    expect(checkAnswer(q, {}).correct).toBe(false);
  });

  it("marks true/false strictly (erroneous non-boolean response is wrong)", () => {
    const q = { type: "true_false", answer: false };
    expect(checkAnswer(q, { value: false }).correct).toBe(true);
    expect(checkAnswer(q, { value: "false" }).correct).toBe(false);
  });

  it("marks predicted output ignoring trailing whitespace and Windows line endings", () => {
    const q = { type: "predict_output", answer: ["2\n5\n8"] };
    expect(checkAnswer(q, { text: "2  \r\n5\r\n8\n\n" }).correct).toBe(true);
    expect(checkAnswer(q, { text: "2 5 8" }).correct).toBe(false);
  });

  it("keeps output case-sensitive", () => {
    expect(checkAnswer({ type: "predict_output", answer: ["True"] }, { text: "true" }).correct).toBe(false);
  });

  it("marks fill in the blank case-insensitively and accepts alternatives", () => {
    const q = { type: "fill_blank", answer: ["effects", "effect"] };
    expect(checkAnswer(q, { text: "  Effect " }).correct).toBe(true);
    expect(checkAnswer(q, { text: "affects" }).correct).toBe(false);
  });

  it("gives partial score for ordering but only counts fully correct as correct", () => {
    const q = { type: "ordering", items: ["a", "b", "c", "d"] };
    expect(checkAnswer(q, { order: ["a", "b", "c", "d"] })).toMatchObject({ correct: true, score: 1 });
    const partial = checkAnswer(q, { order: ["a", "b", "d", "c"] });
    expect(partial.correct).toBe(false);
    expect(partial.score).toBe(0.5);
  });

  it("marks matching pairs", () => {
    const q = { type: "match", pairs: [["x", "1"], ["y", "2"], ["z", "3"]] };
    expect(checkAnswer(q, { pairs: { x: "1", y: "2", z: "3" } }).correct).toBe(true);
    expect(checkAnswer(q, { pairs: { x: "2", y: "1", z: "3" } }).score).toBeCloseTo(1 / 3);
  });

  it("marks open responses from ticked mark points, capped at the marks available", () => {
    const q = { type: "open_response", marks: 2, markPoints: ["a", "b", "c", "d"] };
    expect(checkAnswer(q, { ticked: [0, 1, 2] })).toMatchObject({ correct: true, marksAwarded: 2, marksAvailable: 2 });
    expect(checkAnswer(q, { ticked: [3] })).toMatchObject({ correct: true, marksAwarded: 1 });
    expect(checkAnswer(q, { ticked: [] })).toMatchObject({ correct: false, marksAwarded: 0 });
  });

  it("ignores duplicate and out-of-range ticks (erroneous data)", () => {
    const q = { type: "open_response", marks: 3, markPoints: ["a", "b", "c"] };
    expect(checkAnswer(q, { ticked: [0, 0, 7, -1, "1"] }).marksAwarded).toBe(1);
  });

  it("rejects unknown question types", () => {
    expect(() => checkAnswer({ type: "essay" }, {})).toThrow(/Unknown question type/);
  });
});

describe("normalisers and descriptions", () => {
  it("normalises output", () => {
    expect(normaliseOutput("\n\nhello  \n")).toBe("hello");
  });
  it("normalises short answers", () => {
    expect(normaliseShortAnswer(' "Input" ')).toBe("input");
  });
  it("describes the correct answer", () => {
    expect(describeCorrectAnswer({ type: "true_false", answer: true })).toBe("True");
    expect(describeCorrectAnswer({ type: "ordering", items: ["a", "b"] })).toBe("1. a\n2. b");
  });
});
