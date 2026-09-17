/**
 * Match modes and round structures. Question counts are configurable per mode.
 * Difficulty ranges are indexes into DIFFICULTIES (0 beginner … 5 boss).
 */
export const MATCH_MODES = {
  quick: {
    id: "quick",
    name: "Quick Revision",
    description: "About 10 minutes. Three short rounds ending in a mini boss.",
    timeLimitSeconds: 600,
    rounds: [
      { name: "Warm-up", questions: 4, difficulty: [0, 2] },
      { name: "Standard", questions: 5, difficulty: [1, 3] },
      { name: "Boss", questions: 6, difficulty: [1, 5], boss: true },
    ],
  },
  standard: {
    id: "standard",
    name: "Standard Match",
    description: "20–30 minutes. Five rounds from warm-up to the boss.",
    timeLimitSeconds: null,
    rounds: [
      { name: "Warm-up", questions: 5, difficulty: [0, 1] },
      { name: "Standard", questions: 7, difficulty: [1, 2] },
      { name: "Mixed", questions: 10, difficulty: [0, 4] },
      { name: "Hard", questions: 8, difficulty: [3, 4] },
      { name: "Boss", questions: 15, difficulty: [1, 5], boss: true },
    ],
  },
};

export const BOSSES = {
  core1: { name: "System Failure", briefing: "The entire Foundation Facility is failing. Restore programming, algorithms, testing and compliance systems before the core shuts down." },
  core2: { name: "Enterprise Outage", briefing: "The Enterprise Complex is offline. Diagnose business, data, network and security failures to bring services back." },
  esp: { name: "Client Demonstration", briefing: "The client demo starts now. Handle planning questions, live bugs, design decisions and evaluation under pressure." },
};

/**
 * Builds a custom match mode.
 * @param {{ rounds: number, questionsPerRound: number, difficulty: [number, number], timeLimitMinutes: number|null, includeBoss: boolean }} options
 */
export function customMode({ rounds, questionsPerRound, difficulty, timeLimitMinutes, includeBoss }) {
  const safeRounds = Math.max(1, Math.min(8, Math.round(rounds)));
  const safeQuestions = Math.max(1, Math.min(20, Math.round(questionsPerRound)));
  const list = [];
  for (let i = 0; i < safeRounds; i++) {
    const isBoss = includeBoss && i === safeRounds - 1;
    list.push({ name: isBoss ? "Boss" : `Round ${i + 1}`, questions: safeQuestions, difficulty, boss: isBoss });
  }
  return {
    id: "custom",
    name: "Custom Match",
    description: "Your own settings.",
    timeLimitSeconds: timeLimitMinutes ? timeLimitMinutes * 60 : null,
    rounds: list,
  };
}
