import { h, clear, screenLayout } from "../dom.js";
import { toast } from "../notify.js";

const CONTROLS = [
  ["Move", "W A S D or arrow keys", "Left stick"],
  ["Look", "Mouse", "Right stick"],
  ["Fire", "Left mouse button", "Right trigger"],
  ["Interact / answer terminal", "E", "A / Cross"],
  ["Reload", "R", "X / Square"],
  ["Switch weapon", "1 / 2 or mouse wheel", "Y / Triangle"],
  ["Basic ability", "Q", "Left bumper"],
  ["Tactical ability", "F", "Right bumper"],
  ["Ultimate (question aid)", "X", "Left trigger"],
  ["Objectives and map", "Tab (hold)", "Back / Share"],
  ["Pause", "Esc", "Start / Options"],
  ["Answer options", "1–6, Tab, Enter", "Use mouse or keyboard"],
];

export function settingsScreen(app) {
  return (root, { navigate }) => {
    const { element, body } = screenLayout("Settings", { navigate, subtitle: "Changes apply immediately and are saved with your profile." });
    root.append(element);
    const settings = app.save.settings;

    function update(key, value) {
      settings[key] = value;
      app.persist();
      app.applySettings();
    }

    const checkbox = (key, label, hint) => {
      const id = `setting-${key}`;
      return h("div", { class: "field field-check" },
        h("input", { type: "checkbox", id, checked: settings[key], on: { change: (event) => update(key, event.target.checked) } }),
        h("label", { for: id }, label), hint ? h("p", { class: "hint-text" }, hint) : null);
    };
    const choice = (key, label, options, parse = (v) => v) => {
      const id = `setting-${key}`;
      return h("div", { class: "field" }, h("label", { for: id }, label),
        h("select", { id, on: { change: (event) => update(key, parse(event.target.value)) } },
          options.map(([value, text]) => h("option", { value, selected: String(settings[key]) === String(value) }, text))));
    };
    const slider = (key, label, min, max, step, format) => {
      const id = `setting-${key}`;
      const output = h("output", { for: id }, format(settings[key]));
      return h("div", { class: "field" }, h("label", { for: id }, label, " ", output),
        h("input", { type: "range", id, min, max, step, value: settings[key], on: { input: (event) => { update(key, Number(event.target.value)); output.textContent = format(Number(event.target.value)); } } }));
    };

    const checks = app.capabilities;
    clear(body,
      h("section", { class: "panel" }, h("h2", {}, "Display and accessibility"),
        choice("textScale", "Text size", [[1, "100%"], [1.15, "115%"], [1.3, "130%"], [1.5, "150%"]], Number),
        checkbox("highContrast", "High contrast"),
        checkbox("colourBlindPalette", "Colour-blind friendly palette", "Uses blue and orange instead of green and red. Results always show ✓/✗ symbols as well."),
        checkbox("readableFont", "Readable font", "A sans-serif font with extra letter and line spacing, which some dyslexic readers find easier."),
        checkbox("reducedMotion", "Reduced motion", "Turns off animations, screen shake and head bob."),
        checkbox("showConfidence", "Ask how confident I am", "Recommended: correct guesses do not count towards mastery.")),
      h("section", { class: "panel" }, h("h2", {}, "Audio and captions"),
        slider("masterVolume", "Volume", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
        checkbox("captions", "Captions for sound effects"),
        h("button", { class: "btn", on: { click: () => app.sound.play("objective") } }, "Test sound")),
      h("section", { class: "panel" }, h("h2", {}, "Game"),
        slider("mouseSensitivity", "Mouse sensitivity", 0.2, 3, 0.1, (v) => `${v.toFixed(1)}×`),
        checkbox("invertY", "Invert vertical look"),
        choice("graphicsQuality", "Graphics quality", [["low", "Low (recommended for school PCs)"], ["high", "High"]]),
        choice("combatDifficulty", "Combat difficulty (does not change questions)", [["relaxed", "Relaxed – drones hit softly"], ["standard", "Standard"], ["hard", "Hard"]])),
      h("section", { class: "panel" }, h("h2", {}, "Controls"),
        h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Action"), h("th", {}, "Keyboard & mouse"), h("th", {}, "Controller"))),
          h("tbody", {}, CONTROLS.map((row) => h("tr", {}, row.map((cell) => h("td", {}, cell)))))))),
      h("section", { class: "panel" }, h("h2", {}, "System check"),
        h("ul", { class: "checklist" },
          [["webgl", "3D graphics (WebGL)"], ["localStorage", "Local save (localStorage)"], ["indexedDB", "Database save (IndexedDB)"], ["pointerLock", "Mouse look (Pointer Lock)"]]
            .map(([key, label]) => h("li", { class: checks[key] ? "pass" : "fail" }, `${checks[key] ? "[ OK ]" : "[FAIL]"} ${label}`)),
          h("li", { class: app.store.persistent ? "pass" : "fail" }, `${app.store.persistent ? "[ OK ]" : "[FAIL]"} Progress saving in this browser`)),
        h("button", { class: "btn", on: { click: () => toast("Settings are saved automatically.", "success") } }, "Done")));
  };
}
