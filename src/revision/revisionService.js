import { dayKey } from "../core/dates.js";
import { getSection } from "../content/specIndex.js";
import { updateCard } from "./leitner.js";
import { weaknessBySection } from "./weakness.js";
import { selectQuestions } from "./selector.js";
import { DAILY_FIRST_SESSION_BONUS, xpForAnswer } from "../progression/xp.js";
import { updateStreak } from "../progression/streaks.js";
import { rankFor } from "../progression/ranks.js";

/**
 * Application service: the single place where an answer changes the save data.
 * Every mode (practice, exam, match, daily, weekly) records attempts through here,
 * so adaptive learning sees all of the player's work.
 */
export class RevisionService {
  /**
   * @param {{ bank: import("../content/questionBank.js").QuestionBank, save: any, persist: (save: any) => void, clock?: () => number }} deps
   */
  constructor({ bank, save, persist, clock = () => Date.now() }) {
    this.bank = bank;
    this.save = save;
    this.persist = persist;
    this.clock = clock;
    this.sessionAnswered = new Set();
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #changed(event) {
    this.persist(this.save);
    for (const listener of this.listeners) listener(event);
  }

  weakness() {
    return weaknessBySection(this.save.attempts, this.clock());
  }

  /**
   * Adaptive pick of questions.
   * @param {{ questions: any[], count: number, excludeIds?: Set<string>, rng?: () => number, spreadByArea?: boolean }} options
   */
  pick({ questions, count, excludeIds, rng, spreadByArea = false }) {
    const focusAreas = new Set(this.save.loadout.focusAreas ?? []);
    return selectQuestions({
      questions,
      count,
      excludeIds,
      rng,
      cards: this.save.cards,
      weakness: this.weakness(),
      now: this.clock(),
      focusAreas,
      areaOf: (ref) => getSection(ref)?.areaId,
      spreadBy: spreadByArea ? (q) => getSection(q.specRef)?.areaId : undefined,
    });
  }

  /** Adds XP (not tied to an answer), e.g. round or challenge bonuses. */
  awardXp(amount, reason) {
    if (amount <= 0) return 0;
    const before = rankFor(this.save.player.xp);
    this.save.player.xp += amount;
    const today = dayKey(this.clock());
    this.save.player.xpByDay[today] = (this.save.player.xpByDay[today] ?? 0) + amount;
    const after = rankFor(this.save.player.xp);
    this.#changed({ type: "xp", amount, reason, rankUp: after.index > before.index ? after : null });
    return amount;
  }

  /**
   * Records one answered question.
   * @param {{ question: any, result: any, responseMs: number, confidence?: string, mode: string, xpMultiplier?: number }} input
   */
  recordAttempt({ question, result, responseMs, confidence = "unsure", mode, xpMultiplier = 1 }) {
    const now = this.clock();
    const today = dayKey(now);
    const firstRevisionToday = this.save.player.streak.lastDay !== today;
    const repeatInSession = this.sessionAnswered.has(question.id);
    this.sessionAnswered.add(question.id);

    const previousBox = this.save.cards[question.id]?.box ?? 0;
    const card = updateCard(this.save.cards[question.id], { correct: result.correct, confidence, at: now });
    this.save.cards[question.id] = card;

    const xp = mode === "exam" ? 0 : xpForAnswer({ question, result, confidence, repeatInSession, multiplier: xpMultiplier });
    this.save.attempts.push({
      questionId: question.id,
      specRef: question.specRef,
      map: question.map,
      type: question.type,
      difficulty: question.difficulty,
      correct: result.correct,
      score: result.score,
      responseMs: Math.max(0, Math.round(responseMs)),
      confidence,
      mode,
      xp,
      at: now,
    });

    this.save.player.streak = updateStreak(this.save.player.streak, today);
    const before = rankFor(this.save.player.xp);
    const bonus = firstRevisionToday ? DAILY_FIRST_SESSION_BONUS : 0;
    const gained = xp + bonus;
    this.save.player.xp += gained;
    this.save.player.xpByDay[today] = (this.save.player.xpByDay[today] ?? 0) + gained;
    const after = rankFor(this.save.player.xp);

    const outcome = {
      card,
      xp,
      dailyBonus: bonus,
      boxChange: card.box - previousBox,
      repeatInSession,
      rankUp: after.index > before.index ? after : null,
      streak: this.save.player.streak.current,
    };
    this.#changed({ type: "attempt", ...outcome });
    return outcome;
  }
}
