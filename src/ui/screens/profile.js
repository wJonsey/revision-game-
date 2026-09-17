import { h, clear, screenLayout, bar, downloadText, readFileText } from "../dom.js";
import { rankFor, levelFor, RANKS } from "../../progression/ranks.js";
import { displayedStreak } from "../../progression/streaks.js";
import { dayKey } from "../../core/dates.js";
import { parseSaveText, createDefaultSave } from "../../persistence/saveStore.js";
import { validatePack } from "../../content/questionSchema.js";
import { toast } from "../notify.js";
import { BUILT_IN_PACKS } from "../../app/context.js";

const USERNAME_PATTERN = /^[A-Za-z0-9 _-]{1,20}$/;

const TEMPLATE_PACK = {
  packId: "my-notes",
  title: "My revision notes",
  questions: [
    {
      id: "my-001", map: "core1", specRef: "2.8", difficulty: "easy", type: "multiple_choice",
      prompt: "Which validation check makes sure a field is not left empty?",
      options: ["Presence check", "Range check", "Format check", "Check digit"], answer: 0,
      explanation: "A presence check ensures data has been entered.",
      source: { origin: "user", reference: "My class notes, week 3" },
    },
    {
      id: "my-002", map: "core2", specRef: "8.4", difficulty: "medium", type: "open_response", commandWord: "explain", marks: 2,
      prompt: "Explain why integrity depends on confidentiality in the CIA triad.",
      markPoints: ["Only authorised people can access the data", "So fewer people are able to tamper with it", "Linked justification"],
      explanation: "Controlling access (confidentiality) reduces the chance of data being altered (integrity).",
      source: { origin: "user", reference: "Teacher slides, security lesson 2" },
    },
  ],
};

export function profileScreen(app) {
  return (root, { navigate }) => {
    const { element, body } = screenLayout("Profile", { navigate });
    root.append(element);

    function render() {
      const save = app.save;
      const rank = rankFor(save.player.xp);
      const level = levelFor(save.player.xp);
      const usernameInput = h("input", { id: "username", value: save.player.username, maxlength: 20, autocomplete: "off" });
      const usernameError = h("p", { class: "field-error", role: "alert" });
      const saveFileInput = h("input", { type: "file", accept: ".json,application/json", id: "import-save", class: "sr-only-file" });
      const packFileInput = h("input", { type: "file", accept: ".json,application/json", id: "import-pack", class: "sr-only-file" });

      saveFileInput.addEventListener("change", async () => {
        const file = saveFileInput.files[0];
        if (!file) return;
        try {
          const imported = parseSaveText(await readFileText(file));
          if (!window.confirm(`Replace your current progress (${save.player.xp} XP) with "${imported.player.username}" (${imported.player.xp} XP)?`)) return;
          app.replaceSave(imported);
          toast("Save imported.", "success");
          render();
        } catch (error) {
          toast(error.message, "error", 7000);
        }
      });

      packFileInput.addEventListener("change", async () => {
        const file = packFileInput.files[0];
        if (!file) return;
        try {
          let pack;
          try {
            pack = JSON.parse(await readFileText(file));
          } catch {
            throw new Error("That file is not valid JSON.");
          }
          const check = validatePack(pack);
          if (!check.valid) throw new Error(`Pack rejected: ${check.errors.slice(0, 3).join("; ")}`);
          const takenIds = new Set([...BUILT_IN_PACKS, ...save.userPacks.filter((p) => p.packId !== pack.packId)].flatMap((p) => p.questions.map((q) => q.id)));
          const clash = pack.questions.find((q) => takenIds.has(q.id));
          if (clash) throw new Error(`Pack rejected: question id "${clash.id}" is already used.`);
          save.userPacks = [...save.userPacks.filter((p) => p.packId !== pack.packId), pack];
          app.reloadBank();
          app.persist();
          toast(`Imported ${pack.questions.length} questions from "${pack.title}". They are labelled as your own questions.`, "success", 5000);
          render();
        } catch (error) {
          toast(error.message, "error", 7000);
        }
      });

      clear(body,
        h("section", { class: "panel rank-card" },
          h("h2", {}, save.player.username),
          h("p", { class: "rank-name" }, `${rank.name} · Level ${level.level}`),
          bar(rank.progress, { label: "Rank progress" }),
          h("p", {}, rank.next ? `${save.player.xp} XP · ${rank.next.minXp - save.player.xp} XP to ${rank.next.name}` : `${save.player.xp} XP · highest rank`),
          h("p", {}, `Level progress: ${level.intoLevel}/${level.needed} XP`),
          h("p", {}, `Streak: ${displayedStreak(save.player.streak, dayKey(Date.now()))} days (longest ${save.player.streak.longest}) · Questions answered: ${save.attempts.length} · Matches: ${save.matches.length}`),
          h("details", {}, h("summary", {}, "All ranks"), h("ol", {}, RANKS.map((r) => h("li", {}, `${r.name} – ${r.minXp} XP`))), h("p", { class: "muted" }, "Ranks are fictional game progression and are not real-world qualifications."))),

        h("section", { class: "panel" }, h("h2", {}, "Callsign"),
          h("div", { class: "field" }, h("label", { for: "username" }, "Username (1–20 letters, numbers, spaces, _ or -)"), usernameInput, usernameError),
          h("button", { class: "btn", on: { click: () => {
            const value = usernameInput.value.trim();
            if (!USERNAME_PATTERN.test(value)) {
              usernameError.textContent = "Use 1–20 letters, numbers, spaces, underscores or hyphens.";
              return;
            }
            save.player.username = value;
            app.persist();
            toast("Username saved.", "success");
            render();
          } } }, "Save username")),

        h("section", { class: "panel" }, h("h2", {}, "Save data"),
          h("p", {}, app.store.persistent ? "Progress is saved automatically in this browser." : "⚠ This browser is not keeping your progress. Export your save before closing the tab."),
          h("p", { class: "muted" }, "School computers often clear browser data when you log out. Export your save to your school drive or email it to yourself, then import it next time."),
          h("div", { class: "actions" },
            h("button", { class: "btn btn-primary", on: { click: () => {
              downloadText(`codebreach-save-${dayKey(Date.now())}.json`, app.store.exportText(app.save));
              toast("Save exported.", "success");
            } } }, "Export save file"),
            h("label", { class: "btn", for: "import-save" }, "Import save file"), saveFileInput,
            h("button", { class: "btn btn-danger", on: { click: () => {
              if (window.prompt("Type RESET to delete all progress. This cannot be undone.") !== "RESET") return;
              const fresh = createDefaultSave();
              fresh.settings = save.settings;
              app.replaceSave(fresh);
              toast("Progress reset.", "info");
              render();
            } } }, "Reset progress"))),

        h("section", { class: "panel" }, h("h2", {}, "Your question packs"),
          h("p", {}, "Turn your notes into questions. Packs use the same JSON format as the built-in questions and are always labelled as your own content."),
          save.userPacks.length
            ? h("ul", { class: "section-list" }, save.userPacks.map((pack) => h("li", {}, h("span", {}, h("strong", {}, pack.title), ` – ${pack.questions.length} questions`),
              h("button", { class: "btn btn-small btn-danger", on: { click: () => {
                if (!window.confirm(`Remove "${pack.title}"?`)) return;
                save.userPacks = save.userPacks.filter((p) => p !== pack);
                app.reloadBank();
                app.persist();
                render();
              } } }, "Remove"))))
            : h("p", { class: "muted" }, "No packs imported yet."),
          h("div", { class: "actions" },
            h("label", { class: "btn btn-primary", for: "import-pack" }, "Import question pack"), packFileInput,
            h("button", { class: "btn", on: { click: () => downloadText("codebreach-question-pack-template.json", JSON.stringify(TEMPLATE_PACK, null, 2)) } }, "Download template"))));
    }

    render();
  };
}
