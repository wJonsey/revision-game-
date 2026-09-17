import { describe, expect, it } from "vitest";
import { SaveStore, createDefaultSave, parseSaveText, validateSave, MAX_ATTEMPTS_STORED } from "../../src/persistence/saveStore.js";

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

describe("SaveStore", () => {
  it("round-trips a save through storage", () => {
    const storage = memoryStorage();
    const store = new SaveStore(() => storage);
    const save = createDefaultSave(1);
    save.player.xp = 1234;
    expect(store.save(save)).toBe(true);
    expect(new SaveStore(() => storage).load().player.xp).toBe(1234);
  });

  it("keeps working in memory when storage is blocked", () => {
    const store = new SaveStore(() => { throw new Error("SecurityError"); });
    const save = store.load();
    save.player.xp = 50;
    expect(store.save(save)).toBe(false);
    expect(store.persistent).toBe(false);
    expect(store.load().player.xp).toBe(50);
  });

  it("starts a fresh save and reports an error when stored data is corrupt", () => {
    const storage = memoryStorage();
    storage.setItem("codebreach.save.v1", "{not json");
    const store = new SaveStore(() => storage);
    expect(store.load().player.xp).toBe(0);
    expect(store.loadError).toMatch(/not valid JSON/);
  });

  it("caps stored attempts", () => {
    const store = new SaveStore(() => memoryStorage());
    const save = createDefaultSave();
    save.attempts = Array.from({ length: MAX_ATTEMPTS_STORED + 10 }, (_, i) => ({ questionId: `q${i}` }));
    store.save(save);
    expect(save.attempts).toHaveLength(MAX_ATTEMPTS_STORED);
    expect(save.attempts[0].questionId).toBe("q10");
  });
});

describe("import validation", () => {
  it("accepts an exported save", () => {
    const exported = JSON.stringify(createDefaultSave());
    expect(parseSaveText(exported).version).toBe(1);
  });

  it("rejects files that are not saves", () => {
    expect(() => parseSaveText("hello")).toThrow(/not valid JSON/);
    expect(() => parseSaveText("[]")).toThrow(/rejected/);
    expect(validateSave({ version: 1, player: { username: "x", xp: -5, streak: {} }, cards: {}, attempts: [], matches: [], exams: [], userPacks: [] }))
      .toContain("player.xp must be a positive number");
  });

  it("fills in settings added in later versions", () => {
    const old = createDefaultSave();
    delete old.settings.captions;
    expect(parseSaveText(JSON.stringify(old)).settings.captions).toBe(true);
  });
});
