import { shuffle } from "../core/rng.js";
import { areasForMap, getArea, getSection } from "../content/specIndex.js";
import { checkAnswer } from "./answerChecker.js";

/**
 * Exam Simulation: builds a timed paper with marks spread across content areas,
 * then produces a factual topic-by-topic analysis. It never predicts a grade.
 */

export const EXAM_PRESETS = {
  short: { label: "Short paper", durationMinutes: 30, targetMarks: 30 },
  long: { label: "Long paper", durationMinutes: 60, targetMarks: 60 },
};

export function marksFor(question) {
  return question.type === "open_response" ? question.marks : 1;
}

/**
 * @param {{ questions: any[], mapId: string, targetMarks: number, rng?: () => number }} options
 */
export function buildExam({ questions, mapId, targetMarks, rng = Math.random }) {
  const areas = areasForMap(mapId).map((area) => area.id);
  const poolByArea = new Map(
    areas.map((areaId) => [
      areaId,
      shuffle(questions.filter((q) => q.map === mapId && getSection(q.specRef)?.areaId === areaId), rng),
    ]),
  );
  // Written answers first within each area, as in the real exam (open response items).
  for (const [areaId, pool] of poolByArea) {
    poolByArea.set(areaId, [...pool.filter((q) => q.type === "open_response"), ...pool.filter((q) => q.type !== "open_response")]);
  }

  const paper = [];
  let marks = 0;
  let areaIndex = 0;
  let emptyRounds = 0;
  while (marks < targetMarks && emptyRounds < areas.length) {
    const pool = poolByArea.get(areas[areaIndex % areas.length]);
    areaIndex++;
    // Alternate: take a written question, then a short one, to mix item lengths.
    const pickIndex = paper.length % 2 === 0 ? 0 : pool.findIndex((q) => q.type !== "open_response");
    const index = pickIndex === -1 ? 0 : pickIndex;
    if (pool.length === 0) {
      emptyRounds++;
      continue;
    }
    emptyRounds = 0;
    const [question] = pool.splice(index, 1);
    paper.push(question);
    marks += marksFor(question);
  }
  return { questions: paper, totalMarks: marks };
}

/**
 * @param {any[]} questions
 * @param {Record<string, any>} responses by question id (open responses include `ticked`)
 */
export function analyseExam(questions, responses) {
  const perQuestion = questions.map((question) => {
    const outcome = checkAnswer(question, responses[question.id] ?? {});
    return { question, ...outcome, marksAvailable: marksFor(question), marksAwarded: question.type === "open_response" ? outcome.marksAwarded : outcome.correct ? 1 : 0 };
  });

  const areaTotals = new Map();
  for (const item of perQuestion) {
    const areaId = getSection(item.question.specRef).areaId;
    const total = areaTotals.get(areaId) ?? { areaId, title: getArea(areaId).title, awarded: 0, available: 0, questions: 0 };
    total.awarded += item.marksAwarded;
    total.available += item.marksAvailable;
    total.questions += 1;
    areaTotals.set(areaId, total);
  }
  const byArea = [...areaTotals.values()].map((area) => ({
    ...area,
    percent: Math.round((area.awarded / area.available) * 100),
  }));

  const awarded = perQuestion.reduce((sum, item) => sum + item.marksAwarded, 0);
  const available = perQuestion.reduce((sum, item) => sum + item.marksAvailable, 0);

  const recommendations = [...byArea]
    .filter((area) => area.percent < 70)
    .sort((a, b) => a.percent - b.percent)
    .map((area) => `Revise ${area.areaId} ${area.title}: ${area.awarded}/${area.available} marks (${area.percent}%) in this paper.`);
  if (recommendations.length === 0 && byArea.length > 0) {
    recommendations.push("Every content area in this paper scored 70% or more. Try a longer paper or harder questions to find remaining gaps.");
  }

  const missedSections = [...new Set(perQuestion.filter((item) => !item.correct).map((item) => item.question.specRef))];

  return {
    perQuestion,
    byArea,
    awarded,
    available,
    percent: available ? Math.round((awarded / available) * 100) : 0,
    recommendations,
    missedSections,
  };
}
