import { validatePack } from "../content/questionSchema.js";

/**
 * Save data: one JSON document stored in localStorage and exportable as a file.
 * School PCs may wipe browser storage at logout, so export/import is a core feature.
 */

export const SAVE_VERSION = 1;
export const SAVE_KEY = "codebreach.save.v1";
export const MAX_ATTEMPTS_STORED = 5000;

export const DEFAULT_SETTINGS = {
  textScale: 1,
  highContrast: false,
  reducedMotion: false,
  readableFont: false,
  colourBlindPalette: false,
  captions: true,
  masterVolume: 0.7,
  mouseSensitivity: 1,
  invertY: false,
  graphicsQuality: "low",
  combatDifficulty: "standard",
  showConfidence: true,
};

export const DEFAULT_LOADOUT = {
  classId: "developer",
  primary: "syntax-blaster",
  secondary: "compiler-pistol",
  skin: "default",
  focusAreas: [],
};

export function createDefaultSave(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    player: {
      username: "Recruit",
      createdAt: now,
      xp: 0,
      streak: { current: 0, longest: 0, lastDay: null },
      xpByDay: {},
    },
    cards: {},
    attempts: [],
    matches: [],
    exams: [],
    dailyDeployments: {},
    weeklyIncidents: {},
    userPacks: [],
    settings: { ...DEFAULT_SETTINGS },
    loadout: { ...DEFAULT_LOADOUT },
  };
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Checks the shape of a save document. Returns a list of problems. */
export function validateSave(save) {
  const errors = [];
  if (!isObject(save)) return ["Save file is not a JSON object"];
  if (save.version !== SAVE_VERSION) errors.push(`Unsupported save version: ${save.version}`);
  if (!isObject(save.player)) errors.push("player is missing");
  else {
    if (typeof save.player.username !== "string") errors.push("player.username must be text");
    if (!Number.isFinite(save.player.xp) || save.player.xp < 0) errors.push("player.xp must be a positive number");
    if (!isObject(save.player.streak)) errors.push("player.streak is missing");
  }
  if (!isObject(save.cards)) errors.push("cards must be an object");
  for (const key of ["attempts", "matches", "exams", "userPacks"]) {
    if (!Array.isArray(save[key])) errors.push(`${key} must be a list`);
  }
  if (Array.isArray(save.attempts) && save.attempts.some((a) => !isObject(a) || typeof a.questionId !== "string")) {
    errors.push("attempts contain an invalid record");
  }
  if (Array.isArray(save.userPacks)) {
    for (const pack of save.userPacks) {
      const check = validatePack(pack);
      if (!check.valid) errors.push(`user pack invalid: ${check.errors[0]}`);
    }
  }
  return errors;
}

/** Fills in fields added in later builds so older saves keep working. */
export function normaliseSave(save) {
  const defaults = createDefaultSave(save.player?.createdAt);
  return {
    ...defaults,
    ...save,
    player: { ...defaults.player, ...save.player },
    settings: { ...DEFAULT_SETTINGS, ...save.settings },
    loadout: { ...DEFAULT_LOADOUT, ...save.loadout },
    dailyDeployments: save.dailyDeployments ?? {},
    weeklyIncidents: save.weeklyIncidents ?? {},
  };
}

/** Parses and validates exported save text. Throws an Error with a readable message. */
export function parseSaveText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON, so it cannot be a CODE//BREACH save.");
  }
  const errors = validateSave(data);
  if (errors.length) throw new Error(`Save file rejected: ${errors.slice(0, 3).join("; ")}`);
  return normaliseSave(data);
}

export class SaveStore {
  /** @param {() => Storage} getStorage */
  constructor(getStorage, key = SAVE_KEY) {
    this.key = key;
    this.getStorage = getStorage;
    this.persistent = true;
    this.memoryCopy = null;
  }

  #storage() {
    try {
      return this.getStorage();
    } catch {
      return null;
    }
  }

  /** Loads the save, or a new one. Sets `loadError` if stored data was unreadable. */
  load(now = Date.now()) {
    this.loadError = null;
    const storage = this.#storage();
    let text = null;
    try {
      text = storage ? storage.getItem(this.key) : null;
    } catch {
      this.persistent = false;
    }
    if (!storage) this.persistent = false;
    if (!text) return this.memoryCopy ?? createDefaultSave(now);
    try {
      return parseSaveText(text);
    } catch (error) {
      this.loadError = error.message;
      return createDefaultSave(now);
    }
  }

  /** @returns {boolean} true if written to browser storage */
  save(data) {
    if (data.attempts.length > MAX_ATTEMPTS_STORED) {
      data.attempts = data.attempts.slice(-MAX_ATTEMPTS_STORED);
    }
    this.memoryCopy = data;
    const storage = this.#storage();
    try {
      storage.setItem(this.key, JSON.stringify(data));
      this.persistent = true;
      return true;
    } catch {
      this.persistent = false;
      return false;
    }
  }

  exportText(data) {
    return JSON.stringify(data, null, 2);
  }
}
