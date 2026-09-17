import { h, clear, screenLayout } from "../dom.js";
import { CLASSES } from "../../game/classes.js";
import { WEAPONS, SKINS } from "../../game/arsenal.js";
import { rankFor } from "../../progression/ranks.js";
import { GAME_MAPS, areasForMap } from "../../content/specIndex.js";

export function arsenalScreen(app) {
  return (root, { navigate }) => {
    const { element, body } = screenLayout("Arsenal", { navigate, subtitle: "Choose your class and loadout. Weapons are cosmetic-light; answering questions matters most." });
    root.append(element);

    function render() {
      const loadout = app.save.loadout;
      const rankIndex = rankFor(app.save.player.xp).index;
      const set = (key, value) => {
        loadout[key] = value;
        app.persist();
        render();
      };

      clear(body,
        h("section", { class: "panel" }, h("h2", {}, "Class"),
          h("div", { class: "class-grid", role: "radiogroup", "aria-label": "Class" }, CLASSES.map((playerClass) =>
            h("button", { class: "class-card", role: "radio", "aria-checked": String(loadout.classId === playerClass.id), style: { borderColor: loadout.classId === playerClass.id ? playerClass.colour : undefined }, on: { click: () => set("classId", playerClass.id) } },
              h("strong", { style: { color: playerClass.colour } }, playerClass.name),
              h("span", { class: "muted" }, playerClass.focus),
              h("dl", { class: "abilities" },
                [["Passive", playerClass.passive], ["Q · Basic", playerClass.basic], ["F · Tactical", playerClass.tactical], ["X · Ultimate", playerClass.ultimate]].map(([slot, ability]) => [
                  h("dt", {}, `${slot}: ${ability.name}`),
                  h("dd", {}, ability.description, ability.charge ? ` (charges after ${ability.charge} correct answers)` : ability.cooldown ? ` (${ability.cooldown}s cooldown)` : ""),
                ])))))),
        h("section", { class: "panel" }, h("h2", {}, "Weapons"),
          ["primary", "secondary"].map((slot) => h("div", { class: "field" }, h("label", { for: `weapon-${slot}` }, slot === "primary" ? "Primary" : "Secondary"),
            h("select", { id: `weapon-${slot}`, on: { change: (event) => set(slot, event.target.value) } },
              WEAPONS.filter((w) => w.slot === slot).map((w) => h("option", { value: w.id, selected: loadout[slot] === w.id }, `${w.name} – ${w.description}`))))),
          h("div", { class: "field" }, h("label", { for: "skin" }, "Skin (unlocked by rank)"),
            h("select", { id: "skin", on: { change: (event) => set("skin", event.target.value) } },
              SKINS.map((skin) => h("option", { value: skin.id, selected: loadout.skin === skin.id, disabled: skin.unlockRank > rankIndex },
                skin.unlockRank > rankIndex ? `${skin.name} – unlocks at ${skin.unlockRankName}` : skin.name))))),
        h("section", { class: "panel" }, h("h2", {}, "Revision focus"),
          h("p", {}, "Topics you tick appear more often in matches and adaptive practice, on top of your weak topics."),
          GAME_MAPS.map((map) => h("fieldset", { class: "focus-group" }, h("legend", {}, `${map.name} – ${map.title}`),
            areasForMap(map.id).map((area) => {
              const id = `focus-${area.id}`;
              return h("div", { class: "field field-check" },
                h("input", { type: "checkbox", id, checked: loadout.focusAreas.includes(area.id), on: { change: (event) => {
                  set("focusAreas", event.target.checked ? [...loadout.focusAreas, area.id] : loadout.focusAreas.filter((a) => a !== area.id));
                } } }),
                h("label", { for: id }, `${area.id} ${area.title}`));
            })))));
    }
    render();
  };
}
