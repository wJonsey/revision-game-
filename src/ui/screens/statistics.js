import { h, screenLayout, percentText } from "../dom.js";
import { computeStats } from "../../revision/stats.js";
import { lineChart, columnChart, barList, calendarHeatmap } from "../components/charts.js";
import { displayedStreak } from "../../progression/streaks.js";
import { dayKey } from "../../core/dates.js";
import { GAME_MAPS } from "../../content/specIndex.js";

export function statisticsScreen(app) {
  return (root, { navigate }) => {
    const { element, body } = screenLayout("Statistics", { navigate, subtitle: "Factual performance information. It does not predict grades." });
    root.append(element);
    const now = Date.now();
    const stats = computeStats(app.save, app.bank, now);
    const player = app.save.player;
    const tile = (value, label) => h("div", { class: "tile" }, h("span", { class: "tile-value" }, value), h("span", { class: "tile-label" }, label));

    if (stats.overall.attempts === 0) {
      body.append(h("div", { class: "panel" }, h("h2", {}, "No data yet"), h("p", {}, "Answer some questions in the Practice Range, Daily Deployment or a match, then come back."),
        h("button", { class: "btn btn-primary", on: { click: () => navigate("practice") } }, "Go to Practice Range")));
      return;
    }

    body.append(
      h("div", { class: "stat-tiles" },
        tile(percentText(stats.overall.accuracy), "Overall accuracy"),
        tile(String(stats.overall.attempts), "Questions completed"),
        tile(String(stats.overall.correct), "Questions correct"),
        tile(stats.overall.avgResponseMs === null ? "–" : `${(stats.overall.avgResponseMs / 1000).toFixed(1)}s`, "Average response time"),
        tile(`${displayedStreak(player.streak, dayKey(now))}`, "Current streak (days)"),
        tile(`${player.streak.longest}`, "Longest streak (days)"),
        tile(String(stats.masteredSections.length), "Mastered sections"),
        tile(String(stats.weakSections.length), "Weak sections")),
      h("div", { class: "grid-2" },
        h("section", { class: "panel" }, lineChart({
          title: "Accuracy over the last 14 days",
          points: stats.daily.map((d) => ({ key: d.day, value: d.accuracy })),
          max: 1, ticks: [0, 0.5, 1], format: (v) => `${Math.round(v * 100)}%`,
        })),
        h("section", { class: "panel" }, columnChart({
          title: "XP earned per day (last 14 days)",
          points: stats.daily.map((d) => ({ key: d.day, value: d.xp })),
          format: (v) => Math.round(v).toLocaleString("en-GB"),
        }))),
      h("section", { class: "panel" }, calendarHeatmap({ title: "Revision consistency (last 8 weeks)", days: stats.consistency })),
      h("div", { class: "grid-2" },
        GAME_MAPS.map((map) => h("section", { class: "panel" }, barList({
          title: `Topic accuracy – ${map.name}`,
          rows: stats.byArea.filter((a) => a.map === map.id).map((area) => ({
            label: `${area.id} ${area.title}`,
            value: area.accuracy,
            detail: area.attempts ? `${percentText(area.accuracy)} of ${area.attempts}` : "not started",
          })),
        }))),
        h("section", { class: "panel" }, barList({
          title: "Accuracy by difficulty",
          rows: stats.byDifficulty.map((d) => ({ label: d.difficulty, value: d.accuracy, detail: d.attempts ? `${percentText(d.accuracy)} of ${d.attempts}` : "none yet" })),
        }))),
      h("div", { class: "grid-2" },
        h("section", { class: "panel" }, h("h2", {}, "Weakest sections"),
          stats.weakSections.length ? h("ol", {}, stats.weakSections.slice(0, 6).map((s) => h("li", {}, `${s.specRef} ${s.title} – ${percentText(s.accuracy)} over ${s.attempts} attempts`))) : h("p", { class: "muted" }, "None detected.")),
        h("section", { class: "panel" }, h("h2", {}, "Mastered sections"),
          stats.masteredSections.length ? h("ul", {}, stats.masteredSections.map((s) => h("li", {}, `${s.specRef} ${s.title}`))) : h("p", { class: "muted" }, "None yet. Every question in a section must reach the Mastered box."))),
      app.save.exams.length ? h("section", { class: "panel" }, h("h2", {}, "Exam simulations"),
        h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Date", "Paper", "Marks", "Percent"].map((c) => h("th", {}, c)))),
          h("tbody", {}, app.save.exams.slice(-10).reverse().map((exam) => h("tr", {}, h("td", {}, dayKey(exam.at)), h("td", {}, exam.paper), h("td", {}, `${exam.awarded}/${exam.available}`), h("td", {}, `${exam.percent}%`))))))) : "");
  };
}
