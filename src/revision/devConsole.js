import { allAreas, getSection } from "../content/specIndex.js";
import { BOX_NAMES } from "./leitner.js";
import { rankFor } from "../progression/ranks.js";

/**
 * In-game developer console. Pure: takes a command and data, returns output lines.
 */

const percent = (value) => (value === null ? "no data" : `${Math.round(value * 100)}%`);

const HELP = [
  "COMMANDS",
  "  help                     show this list",
  "  scan topic <name|CA#>    accuracy and weakest section for a content area",
  "  scan section <ref>       details for one spec section, e.g. scan section 2.8",
  "  weak                     your five weakest sections",
  "  due                      sections with questions due for review",
  "  memory                   questions in each Leitner box",
  "  rank                     current rank and XP",
  "  clear                    clear the console",
];

function findArea(query) {
  const lower = query.toLowerCase();
  return allAreas().find((area) => area.id.toLowerCase() === lower) ??
    allAreas().find((area) => area.title.toLowerCase().includes(lower));
}

function recommendedDifficulty(weakness) {
  if (weakness === undefined) return "Easy (no attempts yet)";
  if (weakness > 0.6) return "Easy";
  if (weakness > 0.35) return "Medium";
  return "Hard";
}

/**
 * @param {string} input
 * @param {{ stats: ReturnType<import("./stats.js").computeStats>, xp: number }} context
 * @returns {{ lines: string[], clear?: boolean }}
 */
export function runCommand(input, { stats, xp }) {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const command = words[0]?.toLowerCase();

  if (!command) return { lines: [] };
  if (command === "help") return { lines: HELP };
  if (command === "clear") return { lines: [], clear: true };

  if (command === "rank") {
    const rank = rankFor(xp);
    return {
      lines: [
        `RANK: ${rank.name}`,
        `XP: ${xp}`,
        rank.next ? `Next rank: ${rank.next.name} at ${rank.next.minXp} XP` : "Highest rank reached.",
        "(Ranks are game progression only, not real qualifications.)",
      ],
    };
  }

  if (command === "weak") {
    if (stats.weakSections.length === 0) return { lines: ["RESULT: no weak sections detected yet (need at least 2 attempts per section)."] };
    return {
      lines: ["WEAKEST SECTIONS", ...stats.weakSections.slice(0, 5).map((s) =>
        `  ${s.specRef.padEnd(6)} ${s.title} — accuracy ${percent(s.accuracy)} over ${s.attempts} attempts`)],
    };
  }

  if (command === "due") {
    if (stats.dueBySection.length === 0) return { lines: ["RESULT: nothing is due for review right now."] };
    return {
      lines: [`DUE FOR REVIEW: ${stats.dueCount} questions`, ...stats.dueBySection.map((s) => `  ${s.specRef.padEnd(6)} ${s.title}: ${s.count}`)],
    };
  }

  if (command === "memory") {
    return { lines: ["REVISION MEMORY", ...stats.boxCounts.map((box) => `  ${box.name.padEnd(9)} ${box.count}`)] };
  }

  if (command === "scan" && words[1]?.toLowerCase() === "section") {
    const ref = words[2];
    const section = ref ? getSection(ref) : null;
    if (!section) return { lines: [`ERROR: unknown section "${ref ?? ""}". Example: scan section 2.8`] };
    const stat = stats.sections.find((s) => s.specRef === section.id);
    return {
      lines: [
        `SECTION ${section.id}: ${section.title}`,
        `Content area: ${section.areaId} ${section.areaTitle}`,
        stat ? `Accuracy: ${percent(stat.accuracy)} over ${stat.attempts} attempts` : "Accuracy: no attempts yet",
        `Recommended difficulty: ${recommendedDifficulty(stat?.weakness)}`,
      ],
    };
  }

  if (command === "scan" && words[1]?.toLowerCase() === "topic") {
    const query = words.slice(2).join(" ");
    const area = query ? findArea(query) : null;
    if (!area) return { lines: [`ERROR: no content area matches "${query}". Example: scan topic data`] };
    const areaStat = stats.byArea.find((a) => a.id === area.id);
    const sections = stats.sections.filter((s) => s.areaId === area.id).sort((a, b) => b.weakness - a.weakness);
    const weakest = sections[0];
    return {
      lines: [
        `SCAN: ${area.id} ${area.title}`,
        "RESULT:",
        `  Accuracy: ${percent(areaStat?.accuracy ?? null)}`,
        weakest ? `  Weak area: ${weakest.specRef} ${weakest.title}` : "  Weak area: no attempts yet",
        `  Recommended difficulty: ${recommendedDifficulty(weakest?.weakness)}`,
      ],
    };
  }

  return { lines: [`ERROR: unknown command "${input.trim()}". Type help.`] };
}

export { BOX_NAMES };
