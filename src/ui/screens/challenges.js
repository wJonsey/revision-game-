import { h, clear, screenLayout, percentText } from "../dom.js";
import { runQuiz, resultsSummary } from "../components/quizRunner.js";
import { buildDailyDeployment, currentIncident, DAILY_QUESTION_COUNT } from "../../revision/challenges.js";
import { DAILY_DEPLOYMENT_BONUS, WEEKLY_INCIDENT_BONUS } from "../../progression/xp.js";
import { dayKey, recentDayKeys } from "../../core/dates.js";
import { getMap } from "../../content/specIndex.js";
import { askQuestion, showFeedback } from "../components/questionView.js";
import { toast } from "../notify.js";

export function dailyScreen(app) {
  return (root, { navigate }) => {
    let cancelled = false;
    const { element, body } = screenLayout("Daily Deployment", { navigate, subtitle: "Ten questions mixing your weak topics with topics due for review. Same set all day." });
    root.append(element);
    const now = Date.now();
    const today = dayKey(now);

    function calendar() {
      return h("div", { class: "week-strip", "aria-label": "Daily deployments in the last 7 days" },
        recentDayKeys(now, 7).map((day) => {
          const done = app.save.dailyDeployments[day];
          return h("div", { class: `day ${done ? "day-done" : ""}` }, h("span", {}, day.slice(5)), h("strong", {}, done ? "✓" : "–"));
        }));
    }

    function intro() {
      const record = app.save.dailyDeployments[today];
      clear(body, calendar(),
        record
          ? h("div", { class: "panel" }, h("h2", {}, "Today's deployment is complete"),
            h("p", {}, `You scored ${record.correct}/${record.total} (${percentText(record.correct / record.total)}) and earned a ${record.bonus} XP bonus. Come back tomorrow for a new set.`),
            h("div", { class: "actions" }, h("button", { class: "btn btn-primary", on: { click: () => navigate("practice") } }, "Extra practice")))
          : h("div", { class: "panel" }, h("h2", {}, `Today: ${DAILY_QUESTION_COUNT} questions`),
            h("p", {}, `Complete all ${DAILY_QUESTION_COUNT} for a bonus: ${DAILY_DEPLOYMENT_BONUS} XP at 50% accuracy or better, ${DAILY_DEPLOYMENT_BONUS / 2} XP below that. The bonus rewards consistency, not guessing.`),
            h("div", { class: "actions" }, h("button", { class: "btn btn-primary", on: { click: start } }, "Deploy"))));
    }

    async function start() {
      const { questions } = buildDailyDeployment({ questions: app.bank.questions, save: app.save, now });
      const stage = h("div");
      clear(body, stage);
      const results = await runQuiz({ app, container: stage, next: (i) => questions[i], total: questions.length, mode: "daily", isCancelled: () => cancelled });
      if (!results) return;
      const correct = results.filter((r) => r.result.correct).length;
      const bonus = correct / results.length >= 0.5 ? DAILY_DEPLOYMENT_BONUS : DAILY_DEPLOYMENT_BONUS / 2;
      if (!app.save.dailyDeployments[today]) {
        app.save.dailyDeployments[today] = { correct, total: results.length, bonus, at: Date.now() };
        app.revision.awardXp(bonus, "Daily Deployment");
        app.sound.play("streak");
      }
      clear(body, calendar(), resultsSummary(results, { title: "Daily Deployment complete", extraXp: bonus, actions: [
        h("button", { class: "btn btn-primary", on: { click: () => navigate("menu") } }, "Main menu"),
        h("button", { class: "btn", on: { click: () => navigate("revision") } }, "Revision memory"),
      ] }));
    }

    intro();
    return () => { cancelled = true; };
  };
}

export function weeklyScreen(app) {
  return (root, { navigate }) => {
    let cancelled = false;
    const now = Date.now();
    const { week, incident } = currentIncident(app.incidents, now);
    const { element, body } = screenLayout("Weekly Incident", { navigate, subtitle: `${week} · ${getMap(incident.map).name} – ${getMap(incident.map).title}` });
    root.append(element);

    function intro() {
      const record = app.save.weeklyIncidents[week];
      clear(body, h("div", { class: "panel incident" },
        h("h2", {}, incident.title),
        h("p", {}, incident.briefing),
        h("ol", { class: "incident-steps" }, incident.steps.map((step) => h("li", {}, step.title))),
        record
          ? h("p", { class: "panel panel-success" }, `Resolved this week: ${record.correct}/${record.total} steps correct, +${record.bonus} XP. A new incident arrives next week.`)
          : h("p", {}, `Resolve every step for up to ${WEEKLY_INCIDENT_BONUS} XP (scaled by accuracy). Written steps are self-marked.`),
        h("div", { class: "actions" }, h("button", { class: "btn btn-primary", on: { click: start } }, record ? "Replay (no bonus)" : "Respond to incident"))));
    }

    async function start() {
      const results = [];
      for (const [index, step] of incident.steps.entries()) {
        if (cancelled) return;
        const stage = h("div");
        clear(body, h("div", { class: "panel narrative" }, h("h2", {}, `Step ${index + 1} of ${incident.steps.length}: ${step.title}`), h("p", {}, step.narrative)), stage);
        const answer = await askQuestion(stage, step.question, { app, title: incident.title });
        if (cancelled) return;
        const outcome = app.revision.recordAttempt({ question: step.question, result: answer.result, responseMs: answer.responseMs, confidence: answer.confidence, mode: "weekly" });
        await showFeedback(stage, step.question, answer, { app, outcome, continueLabel: index === incident.steps.length - 1 ? "Close incident" : "Next step" });
        results.push({ question: step.question, ...answer, outcome });
      }
      if (cancelled) return;
      const correct = results.filter((r) => r.result.correct).length;
      let bonus = 0;
      if (!app.save.weeklyIncidents[week]) {
        bonus = Math.round((WEEKLY_INCIDENT_BONUS * correct) / results.length);
        app.save.weeklyIncidents[week] = { incidentId: incident.id, correct, total: results.length, bonus, at: Date.now() };
        app.revision.awardXp(bonus, "Weekly Incident");
        app.sound.play("objective");
        toast(`Incident resolved: +${bonus} XP`, "success");
      }
      clear(body, resultsSummary(results, { title: `${incident.title} – incident report`, extraXp: bonus, actions: [
        h("button", { class: "btn btn-primary", on: { click: () => navigate("menu") } }, "Main menu"),
      ] }));
    }

    intro();
    return () => { cancelled = true; };
  };
}
