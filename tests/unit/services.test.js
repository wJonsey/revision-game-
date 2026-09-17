import { describe, expect, it } from "vitest";
import { QuestionBank } from "../../src/content/questionBank.js";
import { buildExam, analyseExam } from "../../src/revision/examService.js";
import { buildDailyDeployment, currentIncident } from "../../src/revision/challenges.js";
import { computeStats } from "../../src/revision/stats.js";
import { runCommand } from "../../src/revision/devConsole.js";
import { createDefaultSave } from "../../src/persistence/saveStore.js";
import { createRng } from "../../src/core/rng.js";
import { dayKey, daysBetween, isoWeekKey } from "../../src/core/dates.js";
import { getSection } from "../../src/content/specIndex.js";
import core1 from "../../content/questions/core1.json";
import core2 from "../../content/questions/core2.json";
import incidents from "../../content/incidents/incidents.json";

const bank = new QuestionBank();
bank.addPack(core1);
bank.addPack(core2);
const now = Date.UTC(2026, 8, 17, 12);

describe("QuestionBank", () => {
  it("rejects an invalid pack without loading any of it", () => {
    const local = new QuestionBank();
    expect(local.addPack({ packId: "bad", title: "Bad", questions: [{ id: "x" }] })).toBe(false);
    expect(local.questions).toHaveLength(0);
    expect(local.problems[0].packId).toBe("bad");
  });

  it("filters by area and type", () => {
    const written = bank.filter({ map: "core2", areaIds: ["CA8"], types: ["open_response"] });
    expect(written.length).toBeGreaterThan(0);
    expect(written.every((q) => q.specRef.startsWith("8.") && q.type === "open_response")).toBe(true);
  });

  it("forces the user origin on imported packs", () => {
    const local = new QuestionBank();
    local.addPack({ packId: "mine", title: "Mine", questions: [core1.questions[0]] }, { forceOrigin: "user" });
    expect(local.questions[0].source.origin).toBe("user");
  });
});

describe("exam simulation", () => {
  it("builds a paper near the target marks covering every content area", () => {
    const exam = buildExam({ questions: bank.questions, mapId: "core1", targetMarks: 30, rng: createRng(5) });
    expect(exam.totalMarks).toBeGreaterThanOrEqual(30);
    const areas = new Set(exam.questions.map((q) => getSection(q.specRef).areaId));
    expect([...areas].sort()).toEqual(["CA1", "CA2", "CA3", "CA4"]);
  });

  it("analyses marks by content area and recommends the weakest areas first", () => {
    const exam = buildExam({ questions: bank.questions, mapId: "core2", targetMarks: 20, rng: createRng(9) });
    const responses = {};
    for (const q of exam.questions) {
      const area = getSection(q.specRef).areaId;
      if (area === "CA8") responses[q.id] = q.type === "open_response" ? { ticked: q.markPoints.map((_, i) => i) } : q.type === "multiple_choice" ? { choice: q.answer } : {};
    }
    const analysis = analyseExam(exam.questions, responses);
    expect(analysis.byArea.map((a) => a.areaId).sort()).toEqual(["CA5", "CA6", "CA7", "CA8"]);
    expect(analysis.recommendations[0]).toMatch(/Revise CA[5-7]/);
    expect(analysis.recommendations.join(" ")).not.toMatch(/pass|grade/i);
  });
});

describe("daily deployment and weekly incident", () => {
  it("gives the same 10 questions all day", () => {
    const save = createDefaultSave(1);
    const morning = buildDailyDeployment({ questions: bank.questions, save, now: Date.UTC(2026, 8, 17, 8) });
    const evening = buildDailyDeployment({ questions: bank.questions, save, now: Date.UTC(2026, 8, 17, 18) });
    expect(morning.questions).toHaveLength(10);
    expect(morning.questions.map((q) => q.id)).toEqual(evening.questions.map((q) => q.id));
  });

  it("rotates incidents by ISO week", () => {
    const a = currentIncident(incidents, Date.UTC(2026, 8, 14, 12));
    const b = currentIncident(incidents, Date.UTC(2026, 8, 21, 12));
    expect(a.week).not.toBe(b.week);
    expect(a.incident.id).not.toBe(b.incident.id);
  });
});

describe("dates", () => {
  it("handles month and year boundaries", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(isoWeekKey(Date.UTC(2027, 0, 1, 12))).toBe("2026-W53");
    expect(dayKey(new Date(2026, 8, 7, 12))).toBe("2026-09-07");
  });
});

describe("statistics and console", () => {
  const save = createDefaultSave(1);
  const q = bank.filter({ sectionIds: ["6.7"] })[0];
  for (let i = 0; i < 4; i++) {
    save.attempts.push({ questionId: q.id, specRef: "6.7", type: q.type, difficulty: q.difficulty, correct: false, score: 0, responseMs: 8000, at: now - i * 1000 });
  }
  save.cards[q.id] = { attempts: 4, box: 1, nextReviewAt: now - 1, incorrectCount: 4 };
  const stats = computeStats(save, bank, now);

  it("finds weak sections and due questions", () => {
    expect(stats.overall).toMatchObject({ attempts: 4, correct: 0, accuracy: 0 });
    expect(stats.weakSections[0].specRef).toBe("6.7");
    expect(stats.dueCount).toBe(1);
    expect(stats.daily).toHaveLength(14);
    expect(stats.consistency).toHaveLength(56);
  });

  it("runs console commands", () => {
    expect(runCommand("scan topic data", { stats, xp: 0 }).lines.join("\n")).toMatch(/Weak area: 6.7/);
    expect(runCommand("scan section 6.7", { stats, xp: 0 }).lines[0]).toMatch(/SECTION 6.7/);
    expect(runCommand("scan section 99.9", { stats, xp: 0 }).lines[0]).toMatch(/ERROR/);
    expect(runCommand("weak", { stats, xp: 0 }).lines[1]).toMatch(/6.7/);
    expect(runCommand("dance", { stats, xp: 0 }).lines[0]).toMatch(/unknown command/);
    expect(runCommand("clear", { stats, xp: 0 }).clear).toBe(true);
  });
});
