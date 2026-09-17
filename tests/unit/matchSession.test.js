import { describe, expect, it } from "vitest";
import { QuestionBank } from "../../src/content/questionBank.js";
import { RevisionService } from "../../src/revision/revisionService.js";
import { MatchSession, MAX_SHIELD, DOOR_OVERRIDE_ATTEMPTS } from "../../src/game/matchSession.js";
import { MATCH_MODES, customMode } from "../../src/game/matchConfig.js";
import { createDefaultSave } from "../../src/persistence/saveStore.js";
import { createRng } from "../../src/core/rng.js";
import core1 from "../../content/questions/core1.json";

const right = { correct: true, score: 1, marksAwarded: 1, marksAvailable: 1 };
const wrong = { correct: false, score: 0, marksAwarded: 0, marksAvailable: 1 };

function setup({ classId = "developer", mode = MATCH_MODES.quick } = {}) {
  let time = Date.UTC(2026, 8, 17, 10);
  const clock = () => time;
  const bank = new QuestionBank();
  bank.addPack(core1);
  const save = createDefaultSave(time);
  const revision = new RevisionService({ bank, save, persist: () => {}, clock });
  const session = new MatchSession({
    mode, mapId: "core1", classId, revision, questionPool: bank.filter({ map: "core1" }), rng: createRng(7), clock,
  });
  return { session, revision, save, advance: (ms) => { time += ms; } };
}

describe("RevisionService.recordAttempt", () => {
  it("stores the attempt, updates the card, XP, streak and daily bonus", () => {
    const { revision, save } = setup();
    const question = revision.bank.questions[0];
    const outcome = revision.recordAttempt({ question, result: right, responseMs: 4000, confidence: "sure", mode: "practice" });
    expect(save.attempts).toHaveLength(1);
    expect(save.cards[question.id].box).toBe(2);
    expect(outcome.dailyBonus).toBe(300);
    expect(save.player.xp).toBe(outcome.xp + 300);
    expect(save.player.streak.current).toBe(1);

    const second = revision.recordAttempt({ question, result: right, responseMs: 4000, confidence: "sure", mode: "practice" });
    expect(second.dailyBonus).toBe(0);
    expect(second.repeatInSession).toBe(true);
  });

  it("gives no XP in exam mode but still records the attempt", () => {
    const { revision, save } = setup();
    const outcome = revision.recordAttempt({ question: revision.bank.questions[1], result: right, responseMs: 1, mode: "exam" });
    expect(outcome.xp).toBe(0);
    expect(save.attempts[0].mode).toBe("exam");
  });
});

describe("MatchSession", () => {
  it("never asks the same question twice in a match", () => {
    const { session } = setup();
    const ids = Array.from({ length: 30 }, () => session.nextQuestion().id);
    expect(new Set(ids).size).toBe(30);
  });

  it("keeps questions within the round difficulty band", () => {
    const { session } = setup();
    const question = session.nextQuestion();
    expect(["beginner", "easy", "medium"]).toContain(question.difficulty);
  });

  it("prefers the zone's content area", () => {
    const { session, revision } = setup();
    const question = session.nextQuestion({ areaIds: ["CA4"] });
    expect(question.specRef.startsWith("4.")).toBe(true);
    expect(revision.bank.get(question.id)).toBeDefined();
  });

  it("opens a door on a correct answer and overrides after repeated failures", () => {
    const { session } = setup();
    const q = session.nextQuestion();
    expect(session.submitAnswer({ objective: "door", objectiveId: "d1", question: q, result: right, responseMs: 1000 }).unlock).toBe(true);
    let effects;
    for (let i = 0; i < DOOR_OVERRIDE_ATTEMPTS; i++) {
      effects = session.submitAnswer({ objective: "door", objectiveId: "d2", question: session.nextQuestion(), result: wrong, responseMs: 1000 });
    }
    expect(effects).toMatchObject({ unlock: true, override: true });
  });

  it("terminal answers restore shield or raise an alarm, but never crash the player", () => {
    const { session } = setup();
    session.shield = 50;
    const good = session.submitAnswer({ objective: "terminal", question: session.nextQuestion(), result: right, responseMs: 1 });
    expect(good).toMatchObject({ shieldChange: 25, refillAmmo: true });
    session.shield = 5;
    const bad = session.submitAnswer({ objective: "terminal", question: session.nextQuestion(), result: wrong, responseMs: 1 });
    expect(bad.alarm).toBe(true);
    expect(session.shield).toBe(1);
  });

  it("does not exceed maximum shield", () => {
    const { session } = setup();
    session.submitAnswer({ objective: "terminal", question: session.nextQuestion(), result: right, responseMs: 1 });
    expect(session.shield).toBe(MAX_SHIELD);
  });

  it("crashes and respawns when combat damage empties the shield", () => {
    const { session } = setup();
    expect(session.takeDamage(40)).toBe(false);
    expect(session.takeDamage(100)).toBe(true);
    expect(session).toMatchObject({ shield: 60, crashes: 1 });
  });

  it("charges the ultimate with correct answers and hands out its aids once", () => {
    const { session } = setup({ classId: "analyst" });
    expect(session.activateUltimate()).toBeNull();
    for (let i = 0; i < session.playerClass.ultimate.charge; i++) {
      session.submitAnswer({ objective: "terminal", question: session.nextQuestion(), result: right, responseMs: 1 });
    }
    expect(session.ultimateReady).toBe(true);
    expect(session.activateUltimate()).toEqual(["hint"]);
    expect([...session.takeAids()]).toEqual(["hint"]);
    expect(session.takeAids().size).toBe(0);
  });

  it("applies the Analyst passive on every third correct answer in a row", () => {
    const { session } = setup({ classId: "analyst" });
    session.shield = 10;
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(session.submitAnswer({ objective: "defuse", question: session.nextQuestion(), result: right, responseMs: 1 }).shieldChange);
    }
    expect(results).toEqual([10, 10, 25]);
  });

  it("completes rounds, awards accuracy bonuses and records the match", () => {
    const { session, save } = setup();
    for (let r = 0; r < MATCH_MODES.quick.rounds.length; r++) {
      while (!session.isRoundComplete) {
        session.submitAnswer({ objective: "terminal", question: session.nextQuestion(), result: right, responseMs: 1 });
      }
      const summary = session.completeRound();
      expect(summary.bonus).toBeGreaterThan(0);
      if (!session.isLastRound) session.startNextRound();
    }
    expect(session.finished).toBe(true);
    expect(save.matches).toHaveLength(1);
    expect(save.matches[0]).toMatchObject({ questionsAnswered: 15, correctAnswers: 15, accuracy: 1 });
  });

  it("reports remaining time for timed modes", () => {
    const { session, advance } = setup();
    advance(60_000);
    expect(session.timeRemainingSeconds()).toBe(540);
  });
});

describe("customMode", () => {
  it("clamps erroneous settings into safe ranges", () => {
    const mode = customMode({ rounds: 99, questionsPerRound: 0, difficulty: [0, 5], timeLimitMinutes: null, includeBoss: true });
    expect(mode.rounds).toHaveLength(8);
    expect(mode.rounds[0].questions).toBe(1);
    expect(mode.rounds[7].boss).toBe(true);
  });
});
