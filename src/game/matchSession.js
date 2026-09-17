import { DIFFICULTIES } from "../content/questionSchema.js";
import { roundBonus } from "../progression/xp.js";
import { getClass } from "./classes.js";
import { getSection } from "../content/specIndex.js";

/**
 * Rules of a match, independent of 3D rendering. Both the 3D shooter and the
 * text-only Terminal Ops mode drive this class, and it is fully unit tested.
 *
 * Objective kinds:
 *   door     — correct: opens. Wrong: stays locked; override opens it after 2 failed attempts.
 *   terminal — correct: +25 shield, ammo refill, reveal drones. Wrong: -10 shield, alarm (+1 drone).
 *   defuse   — correct: +10 shield, clears one alarm. Wrong: -10 shield, alarm.
 *   core     — boss questions. Correct: core integrity restored one step. Wrong: -10 shield.
 */

export const MAX_SHIELD = 100;
export const DOOR_OVERRIDE_ATTEMPTS = 2;

export class MatchSession {
  /**
   * @param {{ mode: any, mapId: string, classId: string, revision: import("../revision/revisionService.js").RevisionService,
   *           questionPool: any[], rng?: () => number, clock?: () => number }} options
   */
  constructor({ mode, mapId, classId, revision, questionPool, rng = Math.random, clock = () => Date.now() }) {
    this.mode = mode;
    this.mapId = mapId;
    this.playerClass = getClass(classId);
    this.revision = revision;
    this.questionPool = questionPool;
    this.rng = rng;
    this.clock = clock;
    this.startedAt = clock();
    this.roundIndex = -1;
    this.shield = MAX_SHIELD;
    this.alarms = 0;
    this.crashes = 0;
    this.askedIds = new Set();
    this.doorAttempts = new Map();
    this.correctStreak = 0;
    this.ultimateCharge = 0;
    this.pendingAids = new Set();
    this.rounds = [];
    this.finished = false;
    this.startNextRound();
  }

  get round() {
    return this.mode.rounds[this.roundIndex];
  }

  get roundState() {
    return this.rounds[this.roundIndex];
  }

  get isRoundComplete() {
    return this.roundState.answered >= this.round.questions;
  }

  get isLastRound() {
    return this.roundIndex === this.mode.rounds.length - 1;
  }

  get ultimateReady() {
    return this.ultimateCharge >= this.playerClass.ultimate.charge;
  }

  timeRemainingSeconds() {
    if (!this.mode.timeLimitSeconds) return null;
    return Math.max(0, this.mode.timeLimitSeconds - (this.clock() - this.startedAt) / 1000);
  }

  startNextRound() {
    this.roundIndex += 1;
    this.rounds.push({ name: this.round.name, answered: 0, correct: 0, xp: 0, bonus: 0, boss: Boolean(this.round.boss) });
    this.alarms = 0;
    return this.round;
  }

  /**
   * Picks the next question for an objective, respecting the round's difficulty band and the zone's topics.
   * A zone matches questions whose content area is in `areaIds` or whose section is in `sectionIds`.
   */
  nextQuestion({ areaIds = [], sectionIds = [] } = {}) {
    const [min, max] = this.round.difficulty;
    const inBand = (q) => {
      const level = DIFFICULTIES.indexOf(q.difficulty);
      return level >= min && level <= max;
    };
    const zoned = areaIds.length > 0 || sectionIds.length > 0;
    const inZone = (q) => !zoned || areaIds.includes(getSection(q.specRef)?.areaId) || sectionIds.includes(q.specRef);
    const candidates = [(q) => inBand(q) && inZone(q), (q) => inBand(q), () => true];
    for (const accept of candidates) {
      const pool = this.questionPool.filter(accept);
      const [question] = this.revision.pick({
        questions: pool, count: 1, excludeIds: this.askedIds, rng: this.rng, spreadByArea: Boolean(this.round.boss),
      });
      if (question) {
        this.askedIds.add(question.id);
        return question;
      }
    }
    // Every question has been asked: allow repeats rather than stalling the match.
    this.askedIds.clear();
    const [question] = this.revision.pick({ questions: this.questionPool, count: 1, rng: this.rng });
    this.askedIds.add(question.id);
    return question;
  }

  /** Consumes the ultimate ability and returns the aids for the next question. */
  activateUltimate() {
    if (!this.ultimateReady) return null;
    this.ultimateCharge = 0;
    for (const aid of this.playerClass.ultimate.aids) this.pendingAids.add(aid);
    return [...this.pendingAids];
  }

  takeAids() {
    const aids = new Set(this.pendingAids);
    this.pendingAids.clear();
    return aids;
  }

  #xpMultiplier(question) {
    const passive = this.playerClass.passive;
    if (passive.kind === "xpBonusTypes" && passive.types.includes(question.type)) return passive.multiplier;
    if (passive.kind === "xpBonusWeak") {
      const weakness = this.revision.weakness().get(question.specRef);
      if (weakness !== undefined && weakness >= passive.threshold) return passive.multiplier;
    }
    return 1;
  }

  #changeShield(amount) {
    const before = this.shield;
    let after = Math.min(MAX_SHIELD, before + amount);
    // Wrong answers reduce shield but never below 1: questions alone cannot crash the player.
    if (amount < 0) after = Math.max(Math.min(before, 1), after);
    this.shield = after;
    return after - before;
  }

  #correctEffects(objective, { wasPreviouslyWrong = false, countsForStreak = true } = {}) {
    const effects = { shieldChange: 0, unlock: false, refillAmmo: false, revealEnemies: 0, alarm: false, clearedAlarm: false };
    const passive = this.playerClass.passive;
    let shield = 0;
    if (objective === "door") {
      effects.unlock = true;
      if (passive.kind === "shieldOnDoor") shield += passive.amount;
    } else if (objective === "terminal") {
      shield += 25;
      effects.refillAmmo = true;
      effects.revealEnemies = 10;
    } else if (objective === "defuse") {
      shield += 10;
      if (this.alarms > 0) {
        this.alarms -= 1;
        effects.clearedAlarm = true;
      }
    }
    if (countsForStreak && passive.kind === "shieldOnStreak" && this.correctStreak % passive.streak === 0) shield += passive.amount;
    if (passive.kind === "shieldOnRetryCorrect" && wasPreviouslyWrong) shield += passive.amount;
    effects.shieldChange = this.#changeShield(shield);
    return effects;
  }

  /**
   * Applies an answered question to the match.
   * @param {{ objective: "door"|"terminal"|"defuse"|"core", objectiveId?: string, question: any, result: any,
   *           responseMs: number, confidence?: string, aids?: Set<string> }} input
   */
  submitAnswer({ objective, objectiveId, question, result, responseMs, confidence, aids = new Set() }) {
    const previousCard = this.revision.save.cards[question.id];
    const wasPreviouslyWrong = Boolean(previousCard && previousCard.incorrectCount > 0);
    const outcome = this.revision.recordAttempt({
      question, result, responseMs, confidence, mode: `match:${this.mode.id}`, xpMultiplier: this.#xpMultiplier(question),
    });

    const state = this.roundState;
    state.answered += 1;
    state.xp += outcome.xp + outcome.dailyBonus;

    let effects;
    if (result.correct) {
      state.correct += 1;
      this.correctStreak += 1;
      this.ultimateCharge = Math.min(this.playerClass.ultimate.charge, this.ultimateCharge + 1);
      effects = this.#correctEffects(objective, { wasPreviouslyWrong });
    } else {
      this.correctStreak = 0;
      effects = { shieldChange: 0, unlock: false, refillAmmo: false, revealEnemies: 0, alarm: false, clearedAlarm: false };
      if (objective === "door") {
        const attempts = (this.doorAttempts.get(objectiveId) ?? 0) + 1;
        this.doorAttempts.set(objectiveId, attempts);
        effects.unlock = attempts >= DOOR_OVERRIDE_ATTEMPTS;
        effects.override = effects.unlock;
      } else {
        effects.shieldChange = this.#changeShield(aids.has("noPenalty") ? 0 : -10);
        if (objective === "terminal" || objective === "defuse") {
          this.alarms += 1;
          effects.alarm = true;
        }
      }
    }
    return { ...effects, xp: outcome.xp, dailyBonus: outcome.dailyBonus, rankUp: outcome.rankUp, outcome, roundComplete: this.isRoundComplete };
  }

  /**
   * Test Suite ultimate: a second attempt that was correct unlocks the objective's effect.
   * No XP and no extra revision record – the first (wrong) attempt is what counts for learning.
   */
  retrySucceeded(objective) {
    return this.#correctEffects(objective, { countsForStreak: false });
  }

  /** Combat damage from drones. Returns true if the player's system crashed. */
  takeDamage(amount) {
    this.shield = Math.max(0, this.shield - amount);
    if (this.shield === 0) {
      this.crashes += 1;
      this.shield = 60;
      return true;
    }
    return false;
  }

  heal(amount) {
    this.shield = Math.min(MAX_SHIELD, this.shield + amount);
  }

  /** Ends the current round, awarding the accuracy bonus. */
  completeRound() {
    const state = this.roundState;
    state.bonus = this.revision.awardXp(roundBonus(state.correct, state.answered), `${state.name} round bonus`);
    if (this.isLastRound) this.finish();
    return { ...state };
  }

  finish(reason = "complete") {
    if (this.finished) return this.summary;
    this.finished = true;
    const answered = this.rounds.reduce((sum, r) => sum + r.answered, 0);
    const correct = this.rounds.reduce((sum, r) => sum + r.correct, 0);
    const xp = this.rounds.reduce((sum, r) => sum + r.xp + r.bonus, 0);
    this.summary = {
      map: this.mapId,
      mode: this.mode.id,
      classId: this.playerClass.id,
      reason,
      rounds: this.rounds.map((r) => ({ ...r })),
      questionsAnswered: answered,
      correctAnswers: correct,
      accuracy: answered ? correct / answered : null,
      xp,
      crashes: this.crashes,
      durationMs: this.clock() - this.startedAt,
      at: this.clock(),
    };
    this.revision.save.matches.push(this.summary);
    this.revision.persist(this.revision.save);
    return this.summary;
  }
}
