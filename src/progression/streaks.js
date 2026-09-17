import { daysBetween } from "../core/dates.js";

/**
 * Daily revision streak. Revising on consecutive days increases the streak;
 * missing a day resets it to 1 on the next revision day.
 * @param {{ current: number, longest: number, lastDay: string|null }} streak
 * @param {string} today day key
 */
export function updateStreak(streak, today) {
  if (streak.lastDay === today) return { ...streak };
  const gap = streak.lastDay ? daysBetween(streak.lastDay, today) : null;
  const current = gap === 1 ? streak.current + 1 : 1;
  return { current, longest: Math.max(streak.longest, current), lastDay: today };
}

/** Streak as the player sees it: a streak broken by a missed day shows as 0. */
export function displayedStreak(streak, today) {
  if (!streak.lastDay) return 0;
  return daysBetween(streak.lastDay, today) <= 1 ? streak.current : 0;
}
