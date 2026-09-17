import { h, clear, percentText } from "../dom.js";
import { askQuestion, showFeedback } from "./questionView.js";
import { toast } from "../notify.js";
import { getSection } from "../../content/specIndex.js";

/**
 * Runs a sequence of questions with feedback after each one, recording every attempt.
 * @param {{ app: any, container: HTMLElement, next: (index: number) => any, total?: number|null, mode: string,
 *           contextFor?: (question: any, index: number) => string, isCancelled: () => boolean, controls?: HTMLElement }} options
 * @returns {Promise<Array|null>} results, or null if the screen was left
 */
export async function runQuiz({ app, container, next, total = null, mode, contextFor, isCancelled, stopRequested = () => false }) {
  const results = [];
  for (let index = 0; total === null || index < total; index++) {
    if (isCancelled() || stopRequested()) break;
    const question = next(index);
    if (!question) break;
    const progress = total ? `Question ${index + 1} of ${total}` : `Question ${index + 1}`;
    const answer = await askQuestion(container, question, { app, title: contextFor ? `${progress} · ${contextFor(question, index)}` : progress });
    if (isCancelled()) return null;
    const outcome = app.revision.recordAttempt({ question, result: answer.result, responseMs: answer.responseMs, confidence: answer.confidence, mode });
    if (outcome.rankUp) {
      app.sound.play("levelUp");
      toast(`Rank up! You are now: ${outcome.rankUp.name}`, "success", 5000);
    }
    const last = total !== null && index === total - 1;
    await showFeedback(container, question, answer, { app, outcome, continueLabel: last ? "See results" : "Next question" });
    if (isCancelled()) return null;
    results.push({ question, ...answer, outcome });
  }
  return results;
}

/** Results summary shared by practice, daily and weekly modes. */
export function resultsSummary(results, { title = "Session complete", extraXp = 0, actions = [] } = {}) {
  const answered = results.length;
  const correct = results.filter((r) => r.result.correct).length;
  const xp = results.reduce((sum, r) => sum + r.outcome.xp + r.outcome.dailyBonus, 0) + extraXp;
  const missedSections = [...new Set(results.filter((r) => !r.result.correct).map((r) => r.question.specRef))];
  return h("div", { class: "question-card results" },
    h("h2", {}, title),
    h("div", { class: "stat-tiles" },
      h("div", { class: "tile" }, h("span", { class: "tile-value" }, `${correct}/${answered}`), h("span", { class: "tile-label" }, "Correct")),
      h("div", { class: "tile" }, h("span", { class: "tile-value" }, percentText(answered ? correct / answered : null)), h("span", { class: "tile-label" }, "Accuracy")),
      h("div", { class: "tile" }, h("span", { class: "tile-value" }, `+${xp}`), h("span", { class: "tile-label" }, "XP"))),
    answered ? h("ul", { class: "result-list" }, results.map((r) => h("li", { class: r.result.correct ? "result-correct" : "result-wrong" },
      h("span", { class: "result-icon", "aria-hidden": "true" }, r.result.correct ? "✓" : "✗"),
      h("span", { class: "sr-only" }, r.result.correct ? "Correct: " : "Incorrect: "),
      `${r.question.specRef} – ${r.question.prompt.length > 90 ? `${r.question.prompt.slice(0, 90)}…` : r.question.prompt}`))) : h("p", {}, "No questions answered."),
    missedSections.length ? h("div", { class: "panel panel-warning" }, h("h3", {}, "Revise next"),
      h("ul", {}, missedSections.map((ref) => h("li", {}, `${ref} ${getSection(ref)?.title ?? ""}`)))) : null,
    h("div", { class: "actions" }, actions));
}

export { clear };
