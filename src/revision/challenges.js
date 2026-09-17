import { createRng, hashString } from "../core/rng.js";
import { dayKey, isoWeekKey } from "../core/dates.js";
import { selectQuestions } from "./selector.js";
import { weaknessBySection } from "./weakness.js";
import { isDue } from "./leitner.js";

export const DAILY_QUESTION_COUNT = 10;

/**
 * Daily Deployment: the same 10 questions all day (seeded by date and player),
 * mixing weak topics with questions due for review.
 */
export function buildDailyDeployment({ questions, save, now }) {
  const today = dayKey(now);
  const rng = createRng(hashString(`${today}|${save.player.createdAt}`));
  const weakness = weaknessBySection(save.attempts, now);

  const due = questions.filter((q) => save.cards[q.id]?.attempts > 0 && isDue(save.cards[q.id], now));
  const reviewPicks = selectQuestions({ questions: due, cards: save.cards, weakness, now, count: 4, rng });
  const excludeIds = new Set(reviewPicks.map((q) => q.id));
  const weakPicks = selectQuestions({
    questions, cards: save.cards, weakness, now, rng, excludeIds,
    count: DAILY_QUESTION_COUNT - reviewPicks.length,
  });
  return { day: today, questions: [...weakPicks, ...reviewPicks] };
}

/** Weekly Incident rotates through the incident list by ISO week. */
export function currentIncident(incidents, now) {
  const week = isoWeekKey(now);
  const weekNumber = Number(week.split("-W")[1]);
  return { week, incident: incidents[weekNumber % incidents.length] };
}
