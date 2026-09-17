import { h } from "../dom.js";
import { rankFor, levelFor } from "../../progression/ranks.js";
import { displayedStreak } from "../../progression/streaks.js";
import { dayKey, isoWeekKey } from "../../core/dates.js";
import { bar } from "../dom.js";

const MENU = [
  { id: "play", label: "Play", detail: "Tactical revision matches" },
  { id: "revision", label: "Revision", detail: "Revision memory and console" },
  { id: "practice", label: "Practice Range", detail: "Choose a topic, no combat" },
  { id: "exam", label: "Exam Simulation", detail: "Timed paper and analysis" },
  { id: "daily", label: "Daily Deployment", detail: "10 questions a day" },
  { id: "weekly", label: "Weekly Incident", detail: "Multi-topic scenario" },
  { id: "arsenal", label: "Arsenal", detail: "Class, weapons, focus" },
  { id: "profile", label: "Profile", detail: "Rank, save export/import" },
  { id: "statistics", label: "Statistics", detail: "Accuracy and progress" },
  { id: "settings", label: "Settings", detail: "Accessibility and controls" },
];

export function menuScreen(app) {
  return (root, { navigate }) => {
    const save = app.save;
    const now = Date.now();
    const rank = rankFor(save.player.xp);
    const level = levelFor(save.player.xp);
    const streak = displayedStreak(save.player.streak, dayKey(now));
    const dailyDone = Boolean(save.dailyDeployments[dayKey(now)]);
    const weeklyDone = Boolean(save.weeklyIncidents[isoWeekKey(now)]);

    const warnings = [];
    if (!app.store.persistent) warnings.push("This browser is not saving your progress. Export your save from Profile before you close the tab.");
    if (app.store.loadError) warnings.push(`Your saved progress could not be read (${app.store.loadError}). A new profile was started – import a backup from Profile if you have one.`);
    for (const problem of app.bank.problems) warnings.push(`Question pack "${problem.packId}" was not loaded: ${problem.errors[0]}`);
    if (!app.capabilities.webgl) warnings.push("3D graphics (WebGL) are unavailable on this device. Use Terminal Ops mode in Play.");

    const badges = { daily: dailyDone ? "Done today" : "Available", weekly: weeklyDone ? "Done this week" : "Available" };

    root.append(h("section", { class: "menu-screen" },
      h("h1", { class: "title" }, "CODE//BREACH"),
      h("p", { class: "tagline" }, "T Level Digital Software Development revision operations"),
      h("div", { class: "player-strip" },
        h("div", {}, h("strong", {}, save.player.username), ` · ${rank.name} · Level ${level.level}`),
        h("div", { class: "player-xp" }, bar(rank.progress, { label: "Progress to next rank" }),
          h("span", {}, rank.next ? `${save.player.xp} / ${rank.next.minXp} XP to ${rank.next.name}` : `${save.player.xp} XP · top rank`)),
        h("div", {}, `Streak: ${streak} day${streak === 1 ? "" : "s"}`)),
      warnings.map((warning) => h("p", { class: "panel panel-warning", role: "alert" }, warning)),
      h("nav", { class: "menu", "aria-label": "Main menu" },
        MENU.map((item) => h("button", { class: "menu-item", on: { click: () => navigate(item.id) } },
          h("span", { class: "menu-label" }, item.label),
          h("span", { class: "menu-detail" }, badges[item.id] ?? item.detail)))),
      h("p", { class: "footnote" }, "Ranks are game progression only, not real qualifications. Generated questions are practice material, not official exam questions.")));
    root.querySelector(".menu-item").focus();
  };
}
