import { describe, expect, it } from "vitest";
import { shuffleMultipleChoiceOptions } from "../../src/ui/components/questionView.js";

describe("shuffleMultipleChoiceOptions", () => {
  it("moves options without changing their original indexes", () => {
    const question = { options: ["correct", "wrong one", "wrong two"], answer: 0 };
    const displayed = shuffleMultipleChoiceOptions(question, () => 0);

    expect(displayed.map(({ text }) => text)).toEqual(["wrong one", "wrong two", "correct"]);
    expect(displayed.map(({ originalIndex }) => originalIndex)).toEqual([1, 2, 0]);
  });
});