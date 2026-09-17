import "./styles.css";
import { createApp } from "./app/context.js";
import { createRouter } from "./ui/router.js";
import { menuScreen } from "./ui/screens/menu.js";
import { playScreen } from "./ui/screens/play.js";
import { matchScreen } from "./ui/screens/match.js";
import { matchSummaryScreen } from "./ui/screens/matchSummary.js";
import { practiceScreen } from "./ui/screens/practice.js";
import { examScreen } from "./ui/screens/exam.js";
import { dailyScreen, weeklyScreen } from "./ui/screens/challenges.js";
import { revisionScreen } from "./ui/screens/revision.js";
import { statisticsScreen } from "./ui/screens/statistics.js";
import { arsenalScreen } from "./ui/screens/arsenal.js";
import { profileScreen } from "./ui/screens/profile.js";
import { settingsScreen } from "./ui/screens/settings.js";

const app = createApp();

const screens = {
  menu: menuScreen(app),
  play: playScreen(app),
  match: matchScreen(app),
  matchSummary: matchSummaryScreen(app),
  practice: practiceScreen(app),
  exam: examScreen(app),
  daily: dailyScreen(app),
  weekly: weeklyScreen(app),
  revision: revisionScreen(app),
  statistics: statisticsScreen(app),
  arsenal: arsenalScreen(app),
  profile: profileScreen(app),
  settings: settingsScreen(app),
};

const root = document.querySelector("#app");
const router = createRouter(root, screens);

// Esc returns to the menu from simple screens. Matches and exams handle Esc themselves.
const ESCAPABLE = new Set(["play", "revision", "statistics", "arsenal", "profile", "settings", "matchSummary"]);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !ESCAPABLE.has(router.currentScreen)) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  router.navigate("menu");
});

// Scroll to the top and announce the new screen when navigating.
const navigate = router.navigate;
router.navigate = (name, params) => {
  navigate(name, params);
  window.scrollTo(0, 0);
};
for (const key of Object.keys(screens)) {
  const render = screens[key];
  screens[key] = (element, context) => render(element, { ...context, navigate: router.navigate });
}

router.navigate("menu");
