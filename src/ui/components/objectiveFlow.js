import { h, clear } from "../dom.js";
import { askQuestion, showFeedback } from "./questionView.js";
import { toast } from "../notify.js";

export const OBJECTIVE_LABELS = {
  door: "Locked door",
  terminal: "Terminal",
  defuse: "Defuse objective",
  core: "Boss core",
};

export function describeEffects(effects) {
  const lines = [];
  if (effects.override) lines.push("Override: door forced open after repeated attempts");
  else if (effects.unlock) lines.push("Door unlocked");
  if (effects.shieldChange > 0) lines.push(`+${effects.shieldChange} shield`);
  if (effects.shieldChange < 0) lines.push(`${effects.shieldChange} shield`);
  if (effects.refillAmmo) lines.push("Ammo refilled");
  if (effects.revealEnemies) lines.push(`Drones revealed for ${effects.revealEnemies}s`);
  if (effects.clearedAlarm) lines.push("Alarm cleared");
  if (effects.alarm) lines.push("Alarm! An extra drone is deployed");
  return lines;
}

/**
 * Handles one objective interaction: ask a question from the zone's topics, apply match effects,
 * offer the Test Suite retry, then show feedback.
 * @returns {Promise<any|null>} match effects, or null if the screen was closed
 */
export async function runObjective({ app, session, container, objective, isCancelled, timeLimitSeconds = null }) {
  const aids = session.takeAids();
  const zone = objective.zone ?? { areaIds: [], sectionIds: [], name: "" };
  const question = session.nextQuestion({ areaIds: zone.areaIds, sectionIds: zone.sectionIds });
  const title = `${session.round.name} round · ${OBJECTIVE_LABELS[objective.kind]} · ${zone.name}`;
  const limit = timeLimitSeconds === null ? null : timeLimitSeconds + (aids.has("extraTime") ? 60 : 0);
  if (aids.size) toast(`${session.playerClass.ultimate.name} active for this question.`, "info");

  let answer = await askQuestion(container, question, { app, aids, timeLimitSeconds: limit, title });
  if (isCancelled()) return null;
  const effects = session.submitAnswer({
    objective: objective.kind, objectiveId: objective.id, question, result: answer.result,
    responseMs: answer.responseMs, confidence: answer.confidence, aids,
  });

  if (!answer.result.correct && aids.has("retry")) {
    await new Promise((resolve) => {
      const button = h("button", { class: "btn btn-primary", on: { click: resolve } }, "Try again");
      clear(container, h("div", { class: "question-card" },
        h("h2", {}, "Test Suite: not quite"),
        h("p", {}, "You have one more attempt. Your first answer still counts as wrong in your revision memory, and a second attempt earns no XP."),
        h("div", { class: "actions" }, button)));
      button.focus();
    });
    if (isCancelled()) return null;
    const second = await askQuestion(container, question, { app, timeLimitSeconds: limit, title: `${title} · second attempt` });
    if (isCancelled()) return null;
    if (second.result.correct) Object.assign(effects, session.retrySucceeded(objective.kind), { secondAttempt: true });
    answer = second;
  }

  if (effects.rankUp) {
    app.sound.play("levelUp");
    toast(`Rank up! You are now: ${effects.rankUp.name}`, "success", 5000);
  }
  await showFeedback(container, question, answer, { app, outcome: effects.outcome, effects: describeEffects(effects), continueLabel: "Back to the operation" });
  return isCancelled() ? null : effects;
}

/** Round summary panel. Resolves when the player continues. */
export function showRoundSummary(container, session, summary, app) {
  return new Promise((resolve) => {
    const nextRound = session.isLastRound ? null : session.mode.rounds[session.roundIndex + 1];
    const button = h("button", { class: "btn btn-primary", on: { click: resolve } }, nextRound ? `Start ${nextRound.name} round` : "Finish operation");
    app.sound.play("objective");
    clear(container, h("div", { class: "question-card results" },
      h("h2", {}, `${summary.name} round complete`),
      h("div", { class: "stat-tiles" },
        h("div", { class: "tile" }, h("span", { class: "tile-value" }, `${summary.correct}/${summary.answered}`), h("span", { class: "tile-label" }, "Correct")),
        h("div", { class: "tile" }, h("span", { class: "tile-value" }, `+${summary.xp}`), h("span", { class: "tile-label" }, "Question XP")),
        h("div", { class: "tile" }, h("span", { class: "tile-value" }, `+${summary.bonus}`), h("span", { class: "tile-label" }, "Accuracy bonus"))),
      h("p", { class: "muted" }, "Accuracy bonus: 25 XP per question at 70%+, 50 XP per question at 90%+."),
      nextRound?.boss ? h("p", { class: "panel panel-warning" }, "⚠ Boss round next. Reach the core and restore it by answering a mixed set of questions under time pressure.") : null,
      h("div", { class: "actions" }, button)));
    button.focus();
  });
}
