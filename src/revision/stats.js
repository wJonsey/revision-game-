import { dayKey, recentDayKeys, DAY_MS } from "../core/dates.js";
import { allAreas, getSection } from "../content/specIndex.js";
import { BOX_NAMES, isDue } from "./leitner.js";
import { statsBySection, weaknessScore } from "./weakness.js";
import { DIFFICULTIES } from "../content/questionSchema.js";

const MIN_ATTEMPTS_FOR_JUDGEMENT = 2;

function accuracyOf(list) {
  return list.length ? list.filter((a) => a.correct).length / list.length : null;
}

/**
 * Everything the Statistics and Revision Memory screens show.
 * @param {any} save
 * @param {{ questions: any[] }} bank
 * @param {number} now
 */
export function computeStats(save, bank, now) {
  const attempts = save.attempts;
  const sectionStats = statsBySection(attempts);

  const byArea = allAreas().map((area) => {
    const list = attempts.filter((a) => getSection(a.specRef)?.areaId === area.id);
    return { ...area, attempts: list.length, accuracy: accuracyOf(list) };
  });

  const byDifficulty = DIFFICULTIES.map((difficulty) => {
    const list = attempts.filter((a) => a.difficulty === difficulty);
    return { difficulty, attempts: list.length, accuracy: accuracyOf(list) };
  });

  const sections = [...sectionStats.values()].map((stat) => {
    const section = getSection(stat.specRef);
    return { ...stat, title: section?.title ?? stat.specRef, areaId: section?.areaId, weakness: weaknessScore(stat, now) };
  });
  const judged = sections.filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_JUDGEMENT);
  const weakSections = judged.filter((s) => s.weakness >= 0.4).sort((a, b) => b.weakness - a.weakness);
  const strongSections = judged.filter((s) => s.weakness < 0.25).sort((a, b) => a.weakness - b.weakness);

  const questionsBySection = new Map();
  for (const question of bank.questions) {
    if (!questionsBySection.has(question.specRef)) questionsBySection.set(question.specRef, []);
    questionsBySection.get(question.specRef).push(question);
  }
  const masteredSections = [...questionsBySection.entries()]
    .filter(([, list]) => list.every((q) => save.cards[q.id]?.box === 4))
    .map(([specRef]) => ({ specRef, title: getSection(specRef)?.title ?? specRef }));

  const boxCounts = BOX_NAMES.map((name, box) => ({
    name,
    count: bank.questions.filter((q) => (save.cards[q.id]?.box ?? 0) === box).length,
  }));

  const dueQuestions = bank.questions.filter((q) => {
    const card = save.cards[q.id];
    return card && card.attempts > 0 && isDue(card, now);
  });
  const dueBySection = new Map();
  for (const question of dueQuestions) {
    dueBySection.set(question.specRef, (dueBySection.get(question.specRef) ?? 0) + 1);
  }

  const recentlyLearned = bank.questions
    .filter((q) => {
      const card = save.cards[q.id];
      return card?.promotedAt && card.box >= 2 && now - card.promotedAt <= 7 * DAY_MS;
    })
    .map((q) => ({ id: q.id, specRef: q.specRef, prompt: q.prompt, box: save.cards[q.id].box }));

  const days = recentDayKeys(now, 14);
  const byDay = new Map(days.map((key) => [key, []]));
  for (const attempt of attempts) {
    const key = dayKey(attempt.at);
    if (byDay.has(key)) byDay.get(key).push(attempt);
  }
  const daily = days.map((key) => ({
    day: key,
    attempts: byDay.get(key).length,
    accuracy: accuracyOf(byDay.get(key)),
    xp: save.player.xpByDay[key] ?? 0,
  }));

  const consistencyDays = recentDayKeys(now, 56);
  const attemptsPerDay = new Map();
  for (const attempt of attempts) {
    const key = dayKey(attempt.at);
    attemptsPerDay.set(key, (attemptsPerDay.get(key) ?? 0) + 1);
  }
  const consistency = consistencyDays.map((key) => ({ day: key, attempts: attemptsPerDay.get(key) ?? 0 }));

  const timed = attempts.filter((a) => a.type !== "open_response");
  return {
    overall: {
      attempts: attempts.length,
      correct: attempts.filter((a) => a.correct).length,
      accuracy: accuracyOf(attempts),
      avgResponseMs: timed.length ? timed.reduce((sum, a) => sum + a.responseMs, 0) / timed.length : null,
    },
    byArea,
    byDifficulty,
    sections,
    weakSections,
    strongSections,
    masteredSections,
    boxCounts,
    dueCount: dueQuestions.length,
    dueBySection: [...dueBySection.entries()]
      .map(([specRef, count]) => ({ specRef, title: getSection(specRef)?.title ?? specRef, count }))
      .sort((a, b) => b.count - a.count),
    recentlyLearned,
    daily,
    consistency,
  };
}
