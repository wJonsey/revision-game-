import { describe, expect, it } from "vitest";
import { wrongQuestions, modeLabel } from "../../src/revision/mistakes.js";

const questions = { a: { id: "a" }, b: { id: "b" }, c: { id: "c" } };
const lookup = (id) => questions[id];
const attempt = (questionId, correct, at, mode = "practice") => ({ questionId, correct, at, mode });

describe("wrongQuestions", () => {
  it("lists questions whose latest attempt was wrong, newest mistake first", () => {
    const attempts = [attempt("a", false, 1), attempt("b", false, 2), attempt("c", true, 3), attempt("a", false, 4, "match:quick")];
    const list = wrongQuestions(attempts, lookup);
    expect(list.map((e) => e.question.id)).toEqual(["a", "b"]);
    expect(list[0]).toMatchObject({ timesWrong: 2, lastMode: "match:quick", fixed: false });
  });

  it("drops a question from 'still wrong' once it is answered correctly, but keeps it in 'all'", () => {
    const attempts = [attempt("a", false, 1), attempt("a", true, 2)];
    expect(wrongQuestions(attempts, lookup)).toEqual([]);
    const all = wrongQuestions(attempts, lookup, { include: "all" });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ fixed: true, timesWrong: 1, timesRight: 1 });
  });

  it("puts a question back on the list if it is got wrong again later", () => {
    const attempts = [attempt("a", false, 1), attempt("a", true, 2), attempt("a", false, 3)];
    expect(wrongQuestions(attempts, lookup)[0]).toMatchObject({ timesWrong: 2, fixed: false });
  });

  it("skips questions that no longer exist (e.g. a removed question pack)", () => {
    expect(wrongQuestions([attempt("gone", false, 1)], lookup)).toEqual([]);
  });

  it("names the mode a mistake came from", () => {
    expect(modeLabel("match:standard")).toBe("Match");
    expect(modeLabel("daily")).toBe("Daily Deployment");
    expect(modeLabel("something-new")).toBe("Revision");
  });
});
