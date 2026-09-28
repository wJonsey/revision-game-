/**
 * The "Questions Wrong" log, built from the attempt history every mode already records,
 * so nothing extra has to be saved and old saves work too.
 *
 * A question stays "still wrong" until the player's latest attempt at it is correct.
 * The "all" view keeps every question ever answered wrongly.
 */

/**
 * @param {Array<{ questionId: string, correct: boolean, at: number, mode: string }>} attempts
 * @param {(id: string) => any} lookup finds a question by id (returns undefined for removed questions)
 * @param {{ include?: "still-wrong" | "all" }} [options]
 * @returns {Array<{ question: any, timesWrong: number, timesRight: number, lastWrongAt: number, lastMode: string, fixed: boolean }>}
 *          newest mistake first
 */
export function wrongQuestions(attempts, lookup, { include = "still-wrong" } = {}) {
  const byId = new Map();
  for (const attempt of attempts) {
    let entry = byId.get(attempt.questionId);
    if (!entry) {
      entry = { timesWrong: 0, timesRight: 0, lastWrongAt: 0, lastMode: "", latestCorrect: false, latestAt: -Infinity };
      byId.set(attempt.questionId, entry);
    }
    if (attempt.correct) entry.timesRight += 1;
    else {
      entry.timesWrong += 1;
      if (attempt.at >= entry.lastWrongAt) {
        entry.lastWrongAt = attempt.at;
        entry.lastMode = attempt.mode;
      }
    }
    if (attempt.at >= entry.latestAt) {
      entry.latestAt = attempt.at;
      entry.latestCorrect = attempt.correct;
    }
  }
  const list = [];
  for (const [id, entry] of byId) {
    if (entry.timesWrong === 0) continue;
    const fixed = entry.latestCorrect;
    if (include === "still-wrong" && fixed) continue;
    const question = lookup(id);
    if (!question) continue;
    list.push({ question, timesWrong: entry.timesWrong, timesRight: entry.timesRight, lastWrongAt: entry.lastWrongAt, lastMode: entry.lastMode, fixed });
  }
  return list.sort((a, b) => b.lastWrongAt - a.lastWrongAt);
}

/** Human-readable name of the mode an attempt came from, e.g. "match:quick" → "Match". */
export function modeLabel(mode = "") {
  const [kind] = mode.split(":");
  return { match: "Match", practice: "Practice", exam: "Exam", daily: "Daily Deployment", weekly: "Weekly Incident", mistakes: "Questions Wrong" }[kind] ?? "Revision";
}
