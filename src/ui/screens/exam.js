import { h, clear, screenLayout, bar } from "../dom.js";
import { GAME_MAPS } from "../../content/specIndex.js";
import { buildExam, analyseExam, EXAM_PRESETS, marksFor } from "../../revision/examService.js";
import { createAnswerInput, createMarkPointChecklist, codeBlock, questionMeta } from "../components/questionView.js";
import { describeCorrectAnswer } from "../../revision/answerChecker.js";

const PAPERS = { core1: "Core Paper 1", core2: "Core Paper 2", esp: "ESP knowledge check" };

export function examScreen(app) {
  return (root, { navigate }) => {
    let timer = null;
    const { element, body } = screenLayout("Exam Simulation", { navigate, subtitle: "Timed, no combat, no feedback until the end. Results are factual; nothing here predicts a grade." });
    root.append(element);

    function setup() {
      let mapId = "core1";
      let preset = "short";
      clear(body, h("div", { class: "panel" },
        h("h2", {}, "Set up your paper"),
        h("div", { class: "form-grid" },
          h("div", { class: "field" }, h("label", { for: "exam-paper" }, "Paper"),
            h("select", { id: "exam-paper", on: { change: (e) => (mapId = e.target.value) } }, GAME_MAPS.map((m) => h("option", { value: m.id }, PAPERS[m.id])))),
          h("div", { class: "field" }, h("label", { for: "exam-length" }, "Length"),
            h("select", { id: "exam-length", on: { change: (e) => (preset = e.target.value) } }, Object.entries(EXAM_PRESETS).map(([key, p]) => h("option", { value: key }, `${p.label}: ${p.durationMinutes} minutes, about ${p.targetMarks} marks`))))),
        h("ul", {},
          h("li", {}, "The real Core exams are 2 hours 15 minutes, 90 marks, with short, medium and extended open-response questions. This is shorter practice in the same style."),
          h("li", {}, "Written answers are marked by you against mark points after the timer ends."),
          h("li", {}, "The paper ends automatically when time runs out.")),
        h("div", { class: "actions" }, h("button", { class: "btn btn-primary", on: { click: () => start(mapId, preset) } }, "Start exam"))));
    }

    function start(mapId, presetKey) {
      const preset = EXAM_PRESETS[presetKey];
      const exam = buildExam({ questions: app.bank.questions, mapId, targetMarks: preset.targetMarks });
      if (exam.questions.length === 0) {
        clear(body, h("p", { class: "panel panel-warning" }, "No questions available for this paper."));
        return;
      }
      const responses = {};
      const inputs = new Map();
      const startedAt = performance.now();
      const deadline = startedAt + preset.durationMinutes * 60 * 1000;
      let current = 0;

      const timerText = h("span", { class: "timer" });
      const navigator = h("nav", { class: "exam-nav", "aria-label": "Questions" });
      const stage = h("div", { class: "exam-stage" });

      function saveCurrent() {
        const input = inputs.get(exam.questions[current].id);
        if (input) responses[exam.questions[current].id] = input.getResponse();
      }

      function renderNav() {
        clear(navigator, exam.questions.map((q, i) => {
          const answered = inputs.get(q.id)?.isAnswered();
          return h("button", { class: `exam-nav-item ${i === current ? "current" : ""} ${answered ? "answered" : ""}`, "aria-current": i === current ? "step" : undefined, "aria-label": `Question ${i + 1}${answered ? ", answered" : ""}`, on: { click: () => go(i) } }, String(i + 1));
        }));
      }

      function go(index) {
        saveCurrent();
        current = index;
        const question = exam.questions[index];
        if (!inputs.has(question.id)) {
          const created = createAnswerInput(question, { initial: responses[question.id] });
          created.onChange(renderNav);
          inputs.set(question.id, created);
        }
        const input = inputs.get(question.id);
        clear(stage, h("div", { class: "question-card exam-question" },
          h("p", { class: "question-context" }, `Question ${index + 1} of ${exam.questions.length} · [${marksFor(question)} mark${marksFor(question) > 1 ? "s" : ""}]`),
          h("h2", { class: "question-prompt" }, question.prompt),
          question.code ? codeBlock(question.code) : null,
          input.element,
          h("div", { class: "actions" },
            h("button", { class: "btn", disabled: index === 0, on: { click: () => go(index - 1) } }, "< Previous"),
            index < exam.questions.length - 1
              ? h("button", { class: "btn btn-primary", on: { click: () => go(index + 1) } }, "Next >")
              : h("button", { class: "btn btn-primary", on: { click: () => { if (window.confirm("Finish the paper now?")) finishExam(); } } }, "Finish paper"))));
        renderNav();
        input.focus();
      }

      function tick() {
        const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        timerText.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        timerText.classList.toggle("timer-low", left <= 60);
        if (left === 0) finishExam();
      }

      function finishExam() {
        if (timer === null) return;
        clearInterval(timer);
        timer = null;
        saveCurrent();
        selfMark(exam, responses, performance.now() - startedAt, PAPERS[mapId]);
      }

      clear(body, h("div", { class: "exam-bar" }, h("strong", {}, `${PAPERS[mapId]} · ${exam.totalMarks} marks`), h("span", {}, "Time left: ", timerText)), navigator, stage);
      timer = setInterval(tick, 500);
      tick();
      go(0);
    }

    function selfMark(exam, responses, durationMs, paper) {
      const written = exam.questions.filter((q) => q.type === "open_response");
      const checklists = new Map();
      const finishButton = h("button", { class: "btn btn-primary", on: { click: () => {
        for (const [id, checklist] of checklists) responses[id] = { ...(responses[id] ?? {}), ticked: checklist.getTicked() };
        results(exam, responses, durationMs, paper);
      } } }, "See exam analysis");
      if (written.length === 0) return results(exam, responses, durationMs, paper);
      clear(body, h("div", { class: "panel" }, h("h2", {}, "Mark your written answers"), h("p", {}, "Tick each mark point your answer clearly makes. Honest marking gives an accurate analysis.")),
        written.map((question) => {
          const checklist = createMarkPointChecklist(question, responses[question.id]?.text);
          checklists.set(question.id, checklist);
          return h("div", { class: "question-card" }, questionMeta(question), h("h3", {}, question.prompt), checklist.element);
        }),
        h("div", { class: "actions" }, finishButton));
    }

    function results(exam, responses, durationMs, paper) {
      const analysis = analyseExam(exam.questions, responses);
      const now = Date.now();
      exam.questions.forEach((question, index) => {
        const item = analysis.perQuestion[index];
        app.revision.recordAttempt({ question, result: item, responseMs: durationMs / exam.questions.length, confidence: "unsure", mode: "exam" });
      });
      app.save.exams.push({ paper, awarded: analysis.awarded, available: analysis.available, percent: analysis.percent, byArea: analysis.byArea.map(({ areaId, percent }) => ({ areaId, percent })), at: now });
      app.persist();

      clear(body,
        h("div", { class: "question-card results" },
          h("h2", {}, "EXAM ANALYSIS"),
          h("p", {}, `${paper}: ${analysis.awarded}/${analysis.available} marks (${analysis.percent}%) in ${Math.round(durationMs / 60000)} minutes.`),
          h("div", { class: "exam-areas" }, analysis.byArea.map((area) => h("div", { class: "area-row" },
            h("span", { class: "area-name" }, `${area.areaId} ${area.title}`),
            bar(area.percent, { max: 100, label: `${area.title} score` }),
            h("span", { class: "area-value" }, `${area.percent}% (${area.awarded}/${area.available})`)))),
          h("h3", {}, "Recommended revision"),
          h("ul", {}, analysis.recommendations.map((text) => h("li", {}, text))),
          h("p", { class: "muted" }, "This analysis reports your marks on this practice paper only. It is not a prediction of your exam result.")),
        h("section", { class: "panel" }, h("h2", {}, "Question review"),
          analysis.perQuestion.map((item, index) => h("details", { class: "review-item" },
            h("summary", {}, `${item.correct ? "✓" : "✗"} Q${index + 1} (${item.marksAwarded}/${item.marksAvailable}) – ${item.question.specRef} ${item.question.prompt.slice(0, 80)}${item.question.prompt.length > 80 ? "…" : ""}`),
            item.question.code ? codeBlock(item.question.code) : null,
            h("h4", {}, "Correct answer"), h("pre", { class: "answer-text" }, describeCorrectAnswer(item.question)),
            h("p", {}, item.question.explanation)))),
        h("div", { class: "actions" },
          h("button", { class: "btn btn-primary", on: { click: setup } }, "Another paper"),
          h("button", { class: "btn", on: { click: () => navigate("revision") } }, "Revision memory")));
    }

    setup();
    return () => clearInterval(timer);
  };
}
