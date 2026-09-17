import { h, clear, screenLayout, percentText, bar } from "../dom.js";
import { computeStats } from "../../revision/stats.js";
import { runCommand } from "../../revision/devConsole.js";
import { GAME_MAPS, getMap, getSection } from "../../content/specIndex.js";

export function revisionScreen(app) {
  return (root, { navigate }) => {
    const { element, body } = screenLayout("Revision Memory", { navigate, subtitle: "What you know, what is slipping, and what to revise next." });
    root.append(element);
    const now = Date.now();
    const stats = computeStats(app.save, app.bank, now);

    const practiseSection = (specRef) => {
      const section = getSection(specRef);
      return h("button", { class: "btn btn-small", on: { click: () => navigate("practice", { map: section?.map, areaId: section?.areaId, sectionId: specRef }) } }, "Practise");
    };

    const sectionList = (items, empty, detail) => items.length
      ? h("ul", { class: "section-list" }, items.map((item) => h("li", {}, h("span", {}, h("strong", {}, item.specRef), ` ${item.title}`, detail ? h("span", { class: "muted" }, ` – ${detail(item)}`) : null), practiseSection(item.specRef))))
      : h("p", { class: "muted" }, empty);

    const output = h("pre", { class: "console-output", "aria-live": "polite" }, "CODE//BREACH developer console. Type help.\n");
    const input = h("input", { class: "console-input", "aria-label": "Console command", placeholder: "scan topic algorithms", autocomplete: "off", spellcheck: "false" });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const command = input.value;
      input.value = "";
      const result = runCommand(command, { stats: computeStats(app.save, app.bank, Date.now()), xp: app.save.player.xp });
      if (result.clear) output.textContent = "";
      else output.textContent += `> ${command}\n${result.lines.join("\n")}\n\n`;
      output.scrollTop = output.scrollHeight;
    });

    clear(body,
      h("div", { class: "stat-tiles" }, stats.boxCounts.map((box) => h("div", { class: `tile box-${box.name.toLowerCase()}` }, h("span", { class: "tile-value" }, String(box.count)), h("span", { class: "tile-label" }, box.name)))),
      h("div", { class: "grid-2" },
        h("section", { class: "panel" }, h("h2", {}, `Due for review (${stats.dueCount})`), sectionList(stats.dueBySection, "Nothing is due. Keep practising new topics.", (i) => `${i.count} question${i.count > 1 ? "s" : ""}`)),
        h("section", { class: "panel" }, h("h2", {}, "Weak topics"), sectionList(stats.weakSections.slice(0, 8), "No weak topics detected yet – answer at least 2 questions in a section.", (i) => `accuracy ${percentText(i.accuracy)}`)),
        h("section", { class: "panel" }, h("h2", {}, "Strong topics"), sectionList(stats.strongSections.slice(0, 8), "No strong topics yet.", (i) => `accuracy ${percentText(i.accuracy)}`)),
        h("section", { class: "panel" }, h("h2", {}, "Recently learned (7 days)"),
          stats.recentlyLearned.length ? h("ul", { class: "section-list" }, stats.recentlyLearned.slice(0, 8).map((q) => h("li", {}, h("span", {}, h("strong", {}, q.specRef), ` ${q.prompt.slice(0, 70)}${q.prompt.length > 70 ? "…" : ""}`)))) : h("p", { class: "muted" }, "Questions you move up to Familiar or higher appear here."))),
      h("section", { class: "panel" }, h("h2", {}, "Mastered sections"),
        stats.masteredSections.length ? h("p", {}, stats.masteredSections.map((s) => `${s.specRef} ${s.title}`).join(" · ")) : h("p", { class: "muted" }, "A section is mastered when every question in it reaches the Mastered box.")),
      h("section", { class: "panel" }, h("h2", {}, "Accuracy by content area"),
        GAME_MAPS.map((map) => h("div", { class: "area-group" }, h("h3", {}, `${map.name} – ${getMap(map.id).title}`),
          stats.byArea.filter((a) => a.map === map.id).map((area) => h("div", { class: "area-row" },
            h("span", { class: "area-name" }, `${area.id} ${area.title}`),
            bar(area.accuracy, { label: `${area.title} accuracy` }),
            h("span", { class: "area-value" }, area.attempts ? `${percentText(area.accuracy)} (${area.attempts})` : "not started")))))),
      h("section", { class: "panel console" }, h("h2", {}, "Developer console"), output, input));
  };
}
