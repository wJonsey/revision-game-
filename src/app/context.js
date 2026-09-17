import core1 from "../../content/questions/core1.json";
import core2 from "../../content/questions/core2.json";
import esp from "../../content/questions/esp.json";
import incidents from "../../content/incidents/incidents.json";
import { QuestionBank } from "../content/questionBank.js";
import { SaveStore } from "../persistence/saveStore.js";
import { RevisionService } from "../revision/revisionService.js";
import { applySettings, systemPrefersReducedMotion } from "../settings/settings.js";
import { SoundBoard } from "../audio/sound.js";
import { detectCapabilities } from "../core/capabilities.js";

export const BUILT_IN_PACKS = [core1, core2, esp];

function buildBank(userPacks) {
  const bank = new QuestionBank();
  for (const pack of BUILT_IN_PACKS) bank.addPack(pack);
  for (const pack of userPacks) bank.addPack(pack, { forceOrigin: "user" });
  return bank;
}

/**
 * Creates the application: loads content and save data and wires services together.
 * Screens receive this object instead of importing global state.
 */
export function createApp() {
  const store = new SaveStore(() => window.localStorage);
  const save = store.load();
  const firstRun = save.attempts.length === 0 && save.player.xp === 0;
  if (firstRun && systemPrefersReducedMotion()) save.settings.reducedMotion = true;

  const app = {
    store,
    incidents,
    capabilities: detectCapabilities(window),
    bank: buildBank(save.userPacks),
    revision: null,
    sound: null,
    get save() {
      return app.revision.save;
    },
    persist() {
      store.save(app.revision.save);
    },
    applySettings() {
      applySettings(app.save.settings);
    },
    /** Replaces all progress, e.g. after importing a save file. */
    replaceSave(newSave) {
      app.bank = buildBank(newSave.userPacks);
      app.revision = new RevisionService({ bank: app.bank, save: newSave, persist: (data) => store.save(data) });
      app.persist();
      app.applySettings();
    },
    /** Rebuilds the bank after user packs change. */
    reloadBank() {
      app.bank = buildBank(app.save.userPacks);
      app.revision.bank = app.bank;
    },
  };

  app.revision = new RevisionService({ bank: app.bank, save, persist: (data) => store.save(data) });
  app.sound = new SoundBoard(() => app.save.settings);
  app.persist();
  app.applySettings();
  return app;
}
