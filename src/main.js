import "./styles.css";
import { detectCapabilities } from "./core/capabilities.js";

const MENU_ITEMS = [
  "Play",
  "Revision",
  "Practice Range",
  "Exam Simulation",
  "Daily Deployment",
  "Arsenal",
  "Profile",
  "Statistics",
  "Settings",
];

const CHECK_LABELS = {
  webgl: "3D graphics (WebGL)",
  localStorage: "Local save (localStorage)",
  indexedDB: "Database save (IndexedDB)",
  pointerLock: "Mouse look (Pointer Lock)",
};

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderMenu(root) {
  root.append(createElement("h1", "title", "CODE//BREACH"));
  const nav = createElement("nav", "menu");
  nav.setAttribute("aria-label", "Main menu");
  for (const label of MENU_ITEMS) {
    const button = createElement("button", "menu-item", label);
    button.disabled = true;
    button.title = "Coming soon";
    nav.append(button);
  }
  root.append(nav);
}

function renderSystemCheck(root, capabilities) {
  const panel = createElement("section", "system-check");
  panel.append(createElement("h2", null, "SYSTEM CHECK"));
  const list = createElement("ul");
  for (const [key, passed] of Object.entries(capabilities)) {
    const item = createElement("li", passed ? "pass" : "fail");
    item.textContent = `${passed ? "[ OK ]" : "[FAIL]"} ${CHECK_LABELS[key]}`;
    list.append(item);
  }
  panel.append(list);
  root.append(panel);
}

const app = document.querySelector("#app");
renderMenu(app);
renderSystemCheck(app, detectCapabilities(window));
