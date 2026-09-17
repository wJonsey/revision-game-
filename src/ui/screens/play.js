import { h, clear, screenLayout } from "../dom.js";
import { GAME_MAPS, areasForMap } from "../../content/specIndex.js";
import { MATCH_MODES, BOSSES, customMode } from "../../game/matchConfig.js";
import { getClass } from "../../game/classes.js";
import { getWeapon } from "../../game/arsenal.js";
import { DIFFICULTIES } from "../../content/questionSchema.js";

export function playScreen(app) {
  return (root, { navigate }) => {
    const { element, body } = screenLayout("Select Operation", { navigate });
    root.append(element);
    const custom = { rounds: 3, questionsPerRound: 5, min: 0, max: 3, timeLimitMinutes: 0, includeBoss: true, areaIds: new Set() };
    let mapId = null;

    function selectMap() {
      clear(body, h("div", { class: "map-grid" }, GAME_MAPS.map((map) => {
        const count = app.bank.filter({ map: map.id }).length;
        return h("button", { class: `map-card map-${map.id}`, on: { click: () => { mapId = map.id; custom.areaIds = new Set(); selectMode(); } } },
          h("span", { class: "map-name" }, `[ ${map.name} ]`),
          h("span", { class: "map-title" }, map.title),
          h("span", { class: "muted" }, areasForMap(map.id).map((a) => a.title).join(" · ")),
          h("span", { class: "muted" }, `${count} questions · Boss: ${BOSSES[map.id].name}`));
      })));
      body.querySelector("button").focus();
    }

    function launch(mode, engine) {
      navigate("match", { mapId, mode, engine, areaIds: [...custom.areaIds] });
    }

    function selectMode() {
      const map = GAME_MAPS.find((m) => m.id === mapId);
      const loadout = app.save.loadout;
      const playerClass = getClass(loadout.classId);
      const webgl = app.capabilities.webgl;
      const launchButtons = (mode) => h("div", { class: "actions" },
        h("button", { class: "btn btn-primary", disabled: !webgl, title: webgl ? "" : "WebGL is unavailable on this device", on: { click: () => launch(mode, "3d") } }, "Deploy (3D)"),
        h("button", { class: "btn", on: { click: () => launch(mode, "terminal") } }, "Terminal Ops (no 3D)"));

      const numberField = (key, label, min, max) => h("div", { class: "field" }, h("label", { for: `custom-${key}` }, label),
        h("input", { type: "number", id: `custom-${key}`, min, max, value: custom[key], on: { change: (event) => {
          const value = Math.round(Number(event.target.value));
          custom[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
          event.target.value = custom[key];
        } } }));
      const difficultySelect = (key, label) => h("div", { class: "field" }, h("label", { for: `custom-${key}` }, label),
        h("select", { id: `custom-${key}`, on: { change: (event) => (custom[key] = Number(event.target.value)) } },
          DIFFICULTIES.map((d, i) => h("option", { value: i, selected: custom[key] === i }, d))));

      clear(body,
        h("div", { class: "panel" },
          h("h2", {}, `${map.name} – ${map.title}`),
          h("p", {}, BOSSES[mapId].briefing),
          h("p", {}, `Loadout: ${playerClass.name} · ${getWeapon(loadout.primary).name} + ${getWeapon(loadout.secondary).name} `,
            h("button", { class: "btn btn-small", on: { click: () => navigate("arsenal") } }, "Change in Arsenal")),
          webgl ? null : h("p", { class: "panel panel-warning" }, "3D is unavailable on this device, so use Terminal Ops. It uses the same rounds, objectives and scoring without graphics.")),
        h("div", { class: "grid-2" },
          Object.values(MATCH_MODES).map((mode) => h("section", { class: "panel mode-card" },
            h("h3", {}, mode.name), h("p", {}, mode.description),
            h("p", { class: "muted" }, mode.rounds.map((r) => `${r.name} (${r.questions})`).join(" → ")),
            launchButtons(mode))),
          h("section", { class: "panel mode-card" },
            h("h3", {}, "Custom Match"), h("p", {}, "Choose topics, difficulty, length and a time limit."),
            h("div", { class: "form-grid" },
              numberField("rounds", "Rounds", 1, 8),
              numberField("questionsPerRound", "Questions per round", 1, 20),
              difficultySelect("min", "Easiest difficulty"),
              difficultySelect("max", "Hardest difficulty"),
              h("div", { class: "field" }, h("label", { for: "custom-time" }, "Time limit"),
                h("select", { id: "custom-time", on: { change: (event) => (custom.timeLimitMinutes = Number(event.target.value)) } },
                  [[0, "None"], [10, "10 minutes"], [20, "20 minutes"], [30, "30 minutes"]].map(([v, t]) => h("option", { value: v, selected: custom.timeLimitMinutes === v }, t)))),
              h("div", { class: "field field-check" },
                h("input", { type: "checkbox", id: "custom-boss", checked: custom.includeBoss, on: { change: (event) => (custom.includeBoss = event.target.checked) } }),
                h("label", { for: "custom-boss" }, "Final round is a boss round"))),
            h("fieldset", { class: "focus-group" }, h("legend", {}, "Topics (none ticked = all)"),
              areasForMap(mapId).map((area) => h("div", { class: "field field-check" },
                h("input", { type: "checkbox", id: `custom-area-${area.id}`, checked: custom.areaIds.has(area.id), on: { change: (event) => (event.target.checked ? custom.areaIds.add(area.id) : custom.areaIds.delete(area.id)) } }),
                h("label", { for: `custom-area-${area.id}` }, `${area.id} ${area.title}`)))),
            h("div", { class: "actions" },
              h("button", { class: "btn btn-primary", disabled: !webgl, on: { click: () => launch(buildCustom(), "3d") } }, "Deploy (3D)"),
              h("button", { class: "btn", on: { click: () => launch(buildCustom(), "terminal") } }, "Terminal Ops (no 3D)")))),
        h("div", { class: "actions" }, h("button", { class: "btn btn-ghost", on: { click: selectMap } }, "< Choose another operation")));
    }

    function buildCustom() {
      const min = Math.min(custom.min, custom.max);
      const max = Math.max(custom.min, custom.max);
      return customMode({ rounds: custom.rounds, questionsPerRound: custom.questionsPerRound, difficulty: [min, max], timeLimitMinutes: custom.timeLimitMinutes || null, includeBoss: custom.includeBoss });
    }

    selectMap();
  };
}
