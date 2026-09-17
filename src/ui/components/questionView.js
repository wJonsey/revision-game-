import { h, clear } from "../dom.js";
import { shuffle } from "../../core/rng.js";
import { getSection } from "../../content/specIndex.js";
import { TYPE_LABELS } from "../../content/questionSchema.js";
import { checkAnswer, describeCorrectAnswer } from "../../revision/answerChecker.js";
import { BOX_NAMES } from "../../revision/leitner.js";

export const ORIGIN_LABELS = {
  verified: "Verified from specification",
  generated: "Generated practice – not an official question",
  "legacy-past-paper": "Based on a legacy DPDD past paper",
  user: "Your own question",
};

/** Header chips: spec reference, difficulty, type and provenance. */
export function questionMeta(question) {
  const section = getSection(question.specRef);
  return h("div", { class: "question-meta" },
    h("span", { class: "chip chip-accent" }, `Spec ${question.specRef} · ${section?.title ?? ""}`),
    h("span", { class: `chip difficulty-${question.difficulty}` }, question.difficulty),
    h("span", { class: "chip" }, TYPE_LABELS[question.type]),
    question.commandWord ? h("span", { class: "chip" }, `Command word: ${question.commandWord}`) : null,
    h("span", { class: `chip origin origin-${question.source.origin}`, title: question.source.reference }, ORIGIN_LABELS[question.source.origin]),
  );
}

export function codeBlock(code) {
  const lines = code.split("\n");
  return h("pre", { class: "code", "aria-label": "Python code" },
    h("code", {}, lines.map((line, index) => h("span", { class: "code-line" }, h("span", { class: "line-no", "aria-hidden": "true" }, String(index + 1)), line || " ", "\n"))));
}

/**
 * Builds the input for any question type.
 * @returns {{ element: HTMLElement, getResponse: () => any, isAnswered: () => boolean, focus: () => void, onChange: (fn: () => void) => void }}
 */
export function createAnswerInput(question, { aids = new Set(), rng = Math.random, initial } = {}) {
  const listeners = [];
  const changed = () => listeners.forEach((fn) => fn());
  const base = { onChange: (fn) => listeners.push(fn) };

  switch (question.type) {
    case "multiple_choice": {
      let choice = initial?.choice ?? null;
      const wrong = question.options.map((_, i) => i).filter((i) => i !== question.answer);
      const eliminated = aids.has("eliminate") ? new Set(shuffle(wrong, rng).slice(0, Math.max(0, wrong.length - 1))) : new Set();
      const buttons = question.options.map((option, index) =>
        h("button", {
          class: "option", type: "button", role: "radio", "aria-checked": String(choice === index), disabled: eliminated.has(index),
          on: { click: () => select(index) },
        }, h("span", { class: "option-key" }, String.fromCharCode(65 + index)), h("span", { class: "option-text" }, option), eliminated.has(index) ? h("span", { class: "option-note" }, " (eliminated)") : null));
      function select(index) {
        if (eliminated.has(index)) return;
        choice = index;
        buttons.forEach((button, i) => button.setAttribute("aria-checked", String(i === index)));
        changed();
      }
      const element = h("div", { class: "options", role: "radiogroup", "aria-label": "Answer options", tabindex: "-1",
        on: { keydown: (event) => {
          const number = Number(event.key);
          if (number >= 1 && number <= question.options.length) select(number - 1);
        } } }, buttons, h("p", { class: "hint-text" }, "Tip: press 1–" + question.options.length + " to choose."));
      return { ...base, element, getResponse: () => ({ choice }), isAnswered: () => choice !== null, focus: () => buttons.find((b) => !b.disabled)?.focus() };
    }

    case "true_false": {
      let value = initial?.value ?? null;
      const make = (label, v) => h("button", { class: "option", type: "button", role: "radio", "aria-checked": "false", on: { click: () => { value = v; update(); } } }, label);
      const trueButton = make("True", true);
      const falseButton = make("False", false);
      function update() {
        trueButton.setAttribute("aria-checked", String(value === true));
        falseButton.setAttribute("aria-checked", String(value === false));
        changed();
      }
      if (value !== null) update();
      return { ...base, element: h("div", { class: "options options-row", role: "radiogroup" }, trueButton, falseButton), getResponse: () => ({ value }), isAnswered: () => value !== null, focus: () => trueButton.focus() };
    }

    case "predict_output":
    case "fill_blank": {
      const multiLine = question.type === "predict_output";
      const input = h(multiLine ? "textarea" : "input", {
        class: "text-answer", spellcheck: "false", autocomplete: "off", "aria-label": multiLine ? "Program output" : "Missing word",
        rows: multiLine ? 3 : undefined, placeholder: multiLine ? "Type exactly what the program prints…" : "Type the missing word…",
        on: { input: () => changed() },
      });
      if (initial?.text) input.value = initial.text;
      return { ...base, element: input, getResponse: () => ({ text: input.value }), isAnswered: () => input.value.trim().length > 0, focus: () => input.focus() };
    }

    case "ordering": {
      let order = initial?.order ?? shuffle(question.items, rng);
      if (!initial?.order && order.every((item, i) => item === question.items[i])) order = [...order.slice(1), order[0]];
      const list = h("ol", { class: "ordering" });
      function render(focusIndex, direction) {
        clear(list, order.map((item, index) => h("li", { class: "ordering-item" },
          h("span", { class: "ordering-text" }, item),
          h("span", { class: "ordering-buttons" },
            h("button", { class: "btn btn-small", type: "button", "aria-label": `Move "${item}" up`, disabled: index === 0, on: { click: () => move(index, -1) } }, "▲"),
            h("button", { class: "btn btn-small", type: "button", "aria-label": `Move "${item}" down`, disabled: index === order.length - 1, on: { click: () => move(index, 1) } }, "▼")))));
        if (focusIndex !== undefined) {
          const buttons = list.children[focusIndex]?.querySelectorAll("button");
          (direction < 0 ? buttons?.[0] : buttons?.[1])?.focus();
          if (document.activeElement?.disabled || !list.contains(document.activeElement)) buttons?.[direction < 0 ? 1 : 0]?.focus();
        }
      }
      function move(index, direction) {
        const target = index + direction;
        [order[index], order[target]] = [order[target], order[index]];
        order = [...order];
        render(target, direction);
        changed();
      }
      render();
      return { ...base, element: list, getResponse: () => ({ order: [...order] }), isAnswered: () => true, focus: () => list.querySelector("button:not([disabled])")?.focus() };
    }

    case "match": {
      const meanings = shuffle(question.pairs.map((pair) => pair[1]), rng);
      const chosen = { ...(initial?.pairs ?? {}) };
      const rows = question.pairs.map(([term], index) => {
        const id = `match-${question.id}-${index}`;
        const select = h("select", { id, on: { change: (event) => { chosen[term] = event.target.value; changed(); } } },
          h("option", { value: "" }, "Choose…"),
          meanings.map((meaning) => h("option", { value: meaning, selected: chosen[term] === meaning }, meaning)));
        return h("div", { class: "match-row" }, h("label", { for: id, class: "match-term" }, term), select);
      });
      return {
        ...base, element: h("div", { class: "match" }, rows),
        getResponse: () => ({ pairs: { ...chosen } }),
        isAnswered: () => question.pairs.every(([term]) => chosen[term]),
        focus: () => rows[0]?.querySelector("select")?.focus(),
      };
    }

    case "open_response": {
      const input = h("textarea", { class: "text-answer", rows: 6, "aria-label": "Your written answer", placeholder: `Write your answer (${question.marks} mark${question.marks > 1 ? "s" : ""})…`, on: { input: () => changed() } });
      if (initial?.text) input.value = initial.text;
      return { ...base, element: input, getResponse: () => ({ text: input.value }), isAnswered: () => input.value.trim().length >= 10, focus: () => input.focus() };
    }

    default:
      throw new Error(`No input for question type ${question.type}`);
  }
}

/** Self-marking checklist for written answers. */
export function createMarkPointChecklist(question, answerText) {
  const ticked = new Set();
  const element = h("div", { class: "mark-points" },
    h("h3", {}, "Mark your answer"),
    h("p", {}, `Tick each point your answer clearly makes. Up to ${question.marks} mark${question.marks > 1 ? "s" : ""}. Be honest – this is how the game learns what to revise.`),
    h("blockquote", { class: "your-answer" }, answerText || "(no answer)"),
    question.markPoints.map((point, index) => {
      const id = `mp-${question.id}-${index}`;
      return h("div", { class: "check-row" },
        h("input", { type: "checkbox", id, on: { change: (event) => (event.target.checked ? ticked.add(index) : ticked.delete(index)) } }),
        h("label", { for: id }, point));
    }));
  return { element, getTicked: () => [...ticked] };
}

/**
 * Asks one question and resolves when the player submits.
 * @returns {Promise<{ response: any, result: any, responseMs: number, confidence: string, timedOut: boolean }>}
 */
export function askQuestion(container, question, { app, aids = new Set(), timeLimitSeconds = null, title = null } = {}) {
  return new Promise((resolve) => {
    const started = performance.now();
    const input = createAnswerInput(question, { aids });
    let confidence = "unsure";
    let timerId = null;
    let submitted = false;

    const section = getSection(question.specRef);
    const hint = aids.has("hint")
      ? h("div", { class: "panel panel-hint", role: "note" }, h("strong", {}, "Hint: "), `This is spec ${question.specRef} ${section?.title}. `, question.commonMistake ? `Avoid this mistake: ${question.commonMistake}` : "Read every option carefully.")
      : null;

    const confidenceRow = app.save.settings.showConfidence
      ? h("fieldset", { class: "confidence" }, h("legend", {}, "How confident are you?"),
        ["sure", "unsure", "guess"].map((value) => {
          const id = `conf-${question.id}-${value}`;
          return h("span", { class: "radio" },
            h("input", { type: "radio", name: `confidence-${question.id}`, id, value, checked: value === confidence, on: { change: () => (confidence = value) } }),
            h("label", { for: id }, { sure: "Sure", unsure: "Unsure", guess: "Guessing" }[value]));
        }),
        h("p", { class: "hint-text" }, "Correct guesses earn half XP and don't count towards mastery."))
      : null;

    const submitButton = h("button", { class: "btn btn-primary", disabled: !input.isAnswered(), on: { click: () => submit(false) } }, question.type === "open_response" ? "Submit and mark" : "Submit answer");
    input.onChange(() => (submitButton.disabled = !input.isAnswered()));
    const timerText = h("span", { class: "timer", "aria-live": "off" });

    const card = h("div", { class: "question-card" },
      title ? h("p", { class: "question-context" }, title) : null,
      questionMeta(question),
      timeLimitSeconds ? h("div", { class: "timer-row" }, "Time left: ", timerText) : null,
      hint,
      h("h2", { class: "question-prompt", id: `prompt-${question.id}` }, question.prompt),
      question.code ? codeBlock(question.code) : null,
      input.element,
      confidenceRow,
      h("div", { class: "actions" }, submitButton));
    clear(container, card);
    app.sound.play("terminal");
    input.focus();

    if (timeLimitSeconds) {
      const deadline = started + timeLimitSeconds * 1000;
      const tick = () => {
        const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        timerText.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        timerText.classList.toggle("timer-low", left <= 10);
        if (left <= 0) submit(true);
      };
      tick();
      timerId = setInterval(tick, 250);
    }

    function submit(timedOut) {
      if (submitted) return;
      submitted = true;
      clearInterval(timerId);
      const responseMs = performance.now() - started;
      const response = input.getResponse();
      if (question.type !== "open_response") {
        resolve({ response, result: checkAnswer(question, response), responseMs, confidence, timedOut });
        return;
      }
      const checklist = createMarkPointChecklist(question, response.text);
      clear(container, h("div", { class: "question-card" },
        questionMeta(question),
        h("h2", { class: "question-prompt" }, question.prompt),
        checklist.element,
        h("div", { class: "actions" }, h("button", { class: "btn btn-primary", on: { click: () => {
          const marked = { ...response, ticked: checklist.getTicked() };
          resolve({ response: marked, result: checkAnswer(question, marked), responseMs, confidence, timedOut });
        } } }, "Confirm marks"))));
      container.querySelector("input")?.focus();
    }
  });
}

function describeResponse(question, response) {
  switch (question.type) {
    case "multiple_choice": return response.choice === null || response.choice === undefined ? "(no answer)" : question.options[response.choice];
    case "true_false": return response.value === null || response.value === undefined ? "(no answer)" : response.value ? "True" : "False";
    case "predict_output":
    case "fill_blank":
    case "open_response": return response.text?.trim() || "(no answer)";
    case "ordering": return response.order.map((item, i) => `${i + 1}. ${item}`).join("\n");
    case "match": return question.pairs.map(([term]) => `${term} → ${response.pairs?.[term] || "?"}`).join("\n");
    default: return "";
  }
}

/**
 * Shows feedback after an answer. After a wrong answer the player always sees the correct answer,
 * a short explanation, why their answer was wrong, and an optional deeper explanation.
 * @returns {Promise<void>} resolves when the player continues
 */
export function showFeedback(container, question, { response, result, timedOut }, { app, outcome = null, effects = [], continueLabel = "Continue" }) {
  return new Promise((resolve) => {
    const partial = question.type === "open_response" || question.type === "ordering" || question.type === "match";
    const status = result.correct ? "correct" : result.score > 0 && partial ? "partial" : "incorrect";
    const heading = {
      correct: question.type === "open_response" ? `✓ ${result.marksAwarded}/${result.marksAvailable} marks` : "✓ Correct",
      partial: question.type === "open_response" ? `◐ ${result.marksAwarded}/${result.marksAvailable} marks – needs more` : `◐ Partly correct (${Math.round(result.score * 100)}%)`,
      incorrect: timedOut ? "✗ Time's up" : "✗ Incorrect",
    }[status];
    app.sound.play(result.correct ? "correct" : "incorrect");

    let whyWrong = null;
    if (!result.correct) {
      if (question.type === "multiple_choice" && Number.isInteger(response.choice) && question.optionFeedback?.[response.choice]) {
        whyWrong = question.optionFeedback[response.choice];
      } else if (question.commonMistake) {
        whyWrong = `A common mistake: ${question.commonMistake}`;
      } else {
        whyWrong = "Compare your answer with the correct answer below, line by line.";
      }
    }

    const section = getSection(question.specRef);
    const continueButton = h("button", { class: "btn btn-primary", on: { click: () => resolve() } }, continueLabel);
    const rewards = [];
    if (outcome) {
      if (outcome.xp > 0) rewards.push(`+${outcome.xp} XP`);
      if (outcome.dailyBonus > 0) rewards.push(`+${outcome.dailyBonus} XP first revision today`);
      if (outcome.boxChange !== 0 && outcome.card) rewards.push(`Revision memory: ${BOX_NAMES[outcome.card.box]}`);
      if (outcome.repeatInSession && result.correct) rewards.push("Repeat this session – reduced XP");
    }

    clear(container, h("div", { class: `question-card feedback feedback-${status}` },
      h("h2", { class: "feedback-heading", role: "alert" }, heading),
      rewards.length || effects.length ? h("p", { class: "rewards" }, [...rewards, ...effects].join(" · ")) : null,
      h("h3", {}, question.prompt),
      question.code ? codeBlock(question.code) : null,
      h("div", { class: "answer-compare" },
        h("div", {}, h("h4", {}, "Your answer"), h("pre", { class: "answer-text" }, describeResponse(question, response))),
        question.type !== "open_response" || !result.correct
          ? h("div", {}, h("h4", {}, question.type === "open_response" ? "What a full answer covers" : "Correct answer"), h("pre", { class: "answer-text" }, describeCorrectAnswer(question)))
          : null),
      whyWrong ? h("div", { class: "panel panel-warning" }, h("h4", {}, "Why your answer was wrong"), h("p", {}, whyWrong)) : null,
      h("div", { class: "panel" }, h("h4", {}, "Explanation"), h("p", {}, question.explanation)),
      h("details", { class: "deeper" },
        h("summary", {}, "Deeper explanation"),
        h("p", {}, `Specification: ${question.specRef} ${section?.title} (${section?.areaId} ${section?.areaTitle}, ${section?.componentName}).`),
        question.commonMistake && result.correct ? h("p", {}, `Watch out for: ${question.commonMistake}`) : null,
        h("p", {}, `Source: ${question.source.reference}. ${ORIGIN_LABELS[question.source.origin]}.`),
        h("p", {}, "Revise this section in the Practice Range, or type ", h("code", {}, `scan section ${question.specRef}`), " in the Revision console.")),
      h("div", { class: "actions" }, continueButton)));
    continueButton.focus();
  });
}
