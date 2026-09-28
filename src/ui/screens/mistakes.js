import { h, clear, screenLayout } from "../dom.js";
import { GAME_MAPS, getSection } from "../../content/specIndex.js";
import { runQuiz, resultsSummary } from "../components/quizRunner.js";
import { wrongQuestions, modeLabel } from "../../revision/mistakes.js";
import { shuffle } from "../../core/rng.js";

/** Finds a question in the bank or in the weekly incidents (their questions are not in the bank). */
export function questionLookup(app) {
  const incidentQuestions = new Map(app.incidents.flatMap((incident) => incident.steps.map((step) => [step.question.id, step.question])));
  return (id) => app.bank.get(id) ?? incidentQuestions.get(id);
}

/** Number of questions whose latest answer was wrong, for the main menu badge. */
export function stillWrongCount(app) {
  return wrongQuestions(app.save.attempts, questionLookup(app)).length;
}

function ago(at, now) {
  const days = Math.floor((now - at) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function mistakesScreen(app) {
  return (root, { navigate }) => {
    let cancelled = false;
    const { element, body } = screenLayout("Questions Wrong", {
      navigate, subtitle: "Every question you get wrong, in any mode, lands here. Answer it correctly to clear it.",
    });
    root.append(element);
    const state = { include: "still-wrong", map: "", count: "10", order: "newest" };

    const entries = () => wrongQuestions(app.save.attempts, questionLookup(app), { include: state.include })
      .filter((entry) => !state.map || entry.question.map === state.map);

    function select(label, key, options) {
      const id = `mistakes-${key}`;
      return h("div", { class: "field" }, h("label", { for: id }, label),
        h("select", { id, on: { change: (event) => { state[key] = event.target.value; render(); } } },
          options.map(([value, text]) => h("option", { value, selected: state[key] === value }, text))));
    }

    function render() {
      const list = entries();
      const stillWrong = wrongQuestions(app.save.attempts, questionLookup(app)).length;
      const everWrong = wrongQuestions(app.save.attempts, questionLookup(app), { include: "all" }).length;
      const now = Date.now();
      clear(body,
        h("div", { class: "stat-tiles" },
          h("div", { class: "tile" }, h("span", { class: "tile-value" }, String(stillWrong)), h("span", { class: "tile-label" }, "Still wrong")),
          h("div", { class: "tile" }, h("span", { class: "tile-value" }, String(everWrong - stillWrong)), h("span", { class: "tile-label" }, "Fixed")),
          h("div", { class: "tile" }, h("span", { class: "tile-value" }, String(everWrong)), h("span", { class: "tile-label" }, "Ever got wrong"))),
        everWrong === 0
          ? h("div", { class: "panel panel-success" }, h("h2", {}, "Nothing here yet"),
            h("p", {}, "When you answer a question wrongly – in a match, practice, an exam or a challenge – it is saved here so you can quiz yourself on it later."),
            h("div", { class: "actions" }, h("button", { class: "btn btn-primary", on: { click: () => navigate("practice") } }, "Go to Practice Range")))
          : [
            h("div", { class: "panel" },
              h("div", { class: "form-grid" },
                select("Show", "include", [["still-wrong", "Still wrong"], ["all", "Everything I've ever got wrong"]]),
                select("Operation", "map", [["", "All operations"], ...GAME_MAPS.map((m) => [m.id, `${m.name} – ${m.title}`])]),
                select("Quiz length", "count", [["5", "5"], ["10", "10"], ["20", "20"], ["all", "All of them"]]),
                select("Order", "order", [["newest", "Most recent mistakes first"], ["most", "Most often wrong first"], ["shuffle", "Shuffled"]])),
              h("div", { class: "actions" },
                h("button", { class: "btn btn-primary", disabled: list.length === 0, on: { click: () => start(list) } },
                  list.length === 0 ? "Nothing to quiz – all fixed!" : `Start quiz (${state.count === "all" ? list.length : Math.min(Number(state.count), list.length)} questions)`))),
            list.length === 0
              ? h("p", { class: "panel panel-success" }, "You've fixed every question you got wrong here. Nice work – switch Show to “Everything I've ever got wrong” to go over them again.")
              : h("ul", { class: "mistake-list" }, list.map((entry) => h("li", { class: `mistake ${entry.fixed ? "mistake-fixed" : ""}` },
                h("div", { class: "mistake-main" },
                  h("span", { class: "chip chip-accent" }, `Spec ${entry.question.specRef} · ${getSection(entry.question.specRef)?.title ?? ""}`),
                  h("span", { class: "mistake-prompt" }, entry.question.prompt.length > 140 ? `${entry.question.prompt.slice(0, 140)}…` : entry.question.prompt)),
                h("div", { class: "mistake-meta muted" },
                  entry.fixed ? h("span", { class: "pass" }, "✓ Fixed") : h("span", { class: "fail" }, `✗ Wrong ×${entry.timesWrong}`),
                  h("span", {}, `Last wrong ${ago(entry.lastWrongAt, now)} in ${modeLabel(entry.lastMode)}`))))),
          ]);
      body.querySelector(".btn-primary")?.focus();
    }

    async function start(list) {
      let ordered = list;
      if (state.order === "most") ordered = [...list].sort((a, b) => b.timesWrong - a.timesWrong);
      if (state.order === "shuffle") ordered = shuffle(list);
      const questions = ordered.map((entry) => entry.question);
      const total = state.count === "all" ? questions.length : Math.min(Number(state.count), questions.length);
      const stage = h("div");
      clear(body, stage);
      const results = await runQuiz({
        app, container: stage, next: (i) => questions[i], total, mode: "mistakes", isCancelled: () => cancelled,
        contextFor: (question) => `Wrong ×${list.find((e) => e.question.id === question.id).timesWrong} before`,
      });
      if (!results) return;
      const fixed = results.filter((r) => r.result.correct).length;
      clear(body,
        h("p", { class: `panel ${fixed ? "panel-success" : "panel-warning"}` },
          fixed ? `You fixed ${fixed} question${fixed === 1 ? "" : "s"}. ${results.length - fixed ? `${results.length - fixed} still to go.` : "All cleared!"}` : "None fixed this time – read the explanations and try again."),
        resultsSummary(results, {
          title: "Questions Wrong quiz complete",
          actions: [
            h("button", { class: "btn btn-primary", on: { click: render } }, "Back to Questions Wrong"),
            h("button", { class: "btn", on: { click: () => navigate("menu") } }, "Main menu"),
          ],
        }));
      body.querySelector(".btn-primary")?.focus();
    }

    render();
    return () => { cancelled = true; };
  };
}
