import { h, clear, screenLayout } from "../dom.js";
import { GAME_MAPS, areasForMap, getArea } from "../../content/specIndex.js";
import { DIFFICULTIES, TYPE_LABELS } from "../../content/questionSchema.js";
import { runQuiz, resultsSummary } from "../components/quizRunner.js";
import { shuffle } from "../../core/rng.js";

export function practiceScreen(app) {
  return (root, { navigate, params }) => {
    let cancelled = false;
    const { element, body } = screenLayout("Practice Range", { navigate, subtitle: "Pick a topic and practise without combat. Every answer still updates your revision memory." });
    root.append(element);

    const state = {
      map: params.map ?? "",
      areaId: params.areaId ?? "",
      sectionId: params.sectionId ?? "",
      difficulty: "",
      type: "",
      count: "10",
      adaptive: true,
    };

    function select(label, key, options, onChange) {
      const id = `practice-${key}`;
      return h("div", { class: "field" }, h("label", { for: id }, label),
        h("select", { id, on: { change: (event) => { state[key] = event.target.value; onChange?.(); renderSetup(); } } },
          options.map(([value, text]) => h("option", { value, selected: state[key] === value }, text))));
    }

    function pool() {
      return app.bank.filter({
        map: state.map || undefined,
        areaIds: state.areaId ? [state.areaId] : undefined,
        sectionIds: state.sectionId ? [state.sectionId] : undefined,
        difficulties: state.difficulty ? [state.difficulty] : undefined,
        types: state.type ? [state.type] : undefined,
      });
    }

    function renderSetup() {
      const areas = state.map ? areasForMap(state.map) : [];
      const sections = state.areaId ? getArea(state.areaId).sectionIds : [];
      const available = pool().length;
      clear(body,
        h("div", { class: "form-grid" },
          select("Operation", "map", [["", "All operations"], ...GAME_MAPS.map((m) => [m.id, `${m.name} – ${m.title}`])], () => { state.areaId = ""; state.sectionId = ""; }),
          state.map ? select("Content area", "areaId", [["", "All content areas"], ...areas.map((a) => [a.id, `${a.id} ${a.title}`])], () => { state.sectionId = ""; }) : null,
          state.areaId ? select("Section", "sectionId", [["", "All sections"], ...sections.map((id) => [id, `${id} ${app.bank.questions.find((q) => q.specRef === id) ? "" : "(no questions yet)"}`.trim()])]) : null,
          select("Difficulty", "difficulty", [["", "Any difficulty"], ...DIFFICULTIES.map((d) => [d, d])]),
          select("Question type", "type", [["", "Any type"], ...Object.entries(TYPE_LABELS)]),
          select("Number of questions", "count", [["5", "5"], ["10", "10"], ["20", "20"], ["endless", "Endless (stop any time)"]]),
          h("div", { class: "field field-check" },
            h("input", { type: "checkbox", id: "practice-adaptive", checked: state.adaptive, on: { change: (event) => (state.adaptive = event.target.checked) } }),
            h("label", { for: "practice-adaptive" }, "Adaptive: prioritise weak and due topics"))),
        h("p", { class: available ? "" : "panel panel-warning" }, available ? `${available} questions match these settings.` : "No questions match. Try fewer filters."),
        h("div", { class: "actions" }, h("button", { class: "btn btn-primary", disabled: available === 0, on: { click: start } }, "Start practice")));
    }

    async function start() {
      const questions = pool();
      const total = state.count === "endless" ? null : Math.min(Number(state.count), questions.length);
      const asked = new Set();
      let stop = false;
      const stage = h("div");
      const stopButton = h("button", { class: "btn btn-ghost", on: { click: () => { stop = true; stopButton.disabled = true; stopButton.textContent = "Ending after this question…"; } } }, "End session");
      clear(body, total === null ? h("div", { class: "actions actions-top" }, stopButton) : null, stage);
      const next = () => {
        let remaining = questions.filter((q) => !asked.has(q.id));
        if (remaining.length === 0) {
          asked.clear();
          remaining = questions;
        }
        const [question] = state.adaptive ? app.revision.pick({ questions: remaining, count: 1 }) : shuffle(remaining);
        asked.add(question.id);
        return question;
      };
      const results = await runQuiz({ app, container: stage, next, total, mode: "practice", isCancelled: () => cancelled, stopRequested: () => stop });
      if (!results) return;
      clear(body, resultsSummary(results, {
        title: "Practice complete",
        actions: [
          h("button", { class: "btn btn-primary", on: { click: renderSetup } }, "Practise again"),
          h("button", { class: "btn", on: { click: () => navigate("revision") } }, "Revision memory"),
        ],
      }));
    }

    renderSetup();
    return () => { cancelled = true; };
  };
}
