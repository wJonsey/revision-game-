import { h, screenLayout, percentText } from "../dom.js";
import { getClass } from "../../game/classes.js";
import { getMap, getSection } from "../../content/specIndex.js";

export function matchSummaryScreen(app) {
  return (root, { navigate, params }) => {
    const summary = params.summary ?? app.save.matches[app.save.matches.length - 1];
    const { element, body } = screenLayout("Operation Report", { navigate });
    root.append(element);
    if (!summary) {
      body.append(h("p", {}, "No operations played yet."));
      return;
    }
    const reason = { complete: "Operation complete", time: "Time limit reached", quit: "Operation abandoned" }[summary.reason];
    const since = summary.at - summary.durationMs;
    const missed = [...new Set(app.save.attempts.filter((a) => a.at >= since && a.at <= summary.at && a.mode.startsWith("match") && !a.correct).map((a) => a.specRef))];
    const minutes = Math.floor(summary.durationMs / 60000);
    const seconds = Math.round((summary.durationMs % 60000) / 1000);

    body.append(
      h("div", { class: "question-card results" },
        h("h2", {}, `${reason}: ${getMap(summary.map).name} – ${getMap(summary.map).title}`),
        h("p", { class: "muted" }, `${getClass(summary.classId).name} · ${minutes}m ${seconds}s · ${summary.crashes} system crash${summary.crashes === 1 ? "" : "es"}`),
        h("div", { class: "stat-tiles" },
          h("div", { class: "tile" }, h("span", { class: "tile-value" }, `${summary.correctAnswers}/${summary.questionsAnswered}`), h("span", { class: "tile-label" }, "Correct")),
          h("div", { class: "tile" }, h("span", { class: "tile-value" }, percentText(summary.accuracy)), h("span", { class: "tile-label" }, "Accuracy")),
          h("div", { class: "tile" }, h("span", { class: "tile-value" }, `+${summary.xp}`), h("span", { class: "tile-label" }, "XP"))),
        h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, h("th", {}, "Round"), h("th", {}, "Correct"), h("th", {}, "XP"), h("th", {}, "Bonus"))),
          h("tbody", {}, summary.rounds.map((round) => h("tr", {}, h("td", {}, round.name), h("td", {}, `${round.correct}/${round.answered}`), h("td", {}, String(round.xp)), h("td", {}, String(round.bonus))))))),
        missed.length ? h("div", { class: "panel panel-warning" }, h("h3", {}, "Topics to revise"),
          h("ul", { class: "section-list" }, missed.map((ref) => h("li", {}, h("span", {}, `${ref} ${getSection(ref)?.title ?? ""}`),
            h("button", { class: "btn btn-small", on: { click: () => navigate("practice", { map: getSection(ref)?.map, areaId: getSection(ref)?.areaId, sectionId: ref }) } }, "Practise"))))) : null,
        h("div", { class: "actions" },
          h("button", { class: "btn btn-primary", on: { click: () => navigate("play") } }, "Play again"),
          h("button", { class: "btn", on: { click: () => navigate("menu") } }, "Main menu"))));
    body.querySelector(".btn-primary").focus();
  };
}
