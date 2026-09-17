import { validatePack } from "./questionSchema.js";
import { getSection } from "./specIndex.js";

/**
 * Holds every valid question from the built-in packs plus the player's own packs.
 * Invalid packs are skipped and reported, never loaded half-broken.
 */
export class QuestionBank {
  constructor() {
    this.questions = [];
    this.byId = new Map();
    this.problems = [];
  }

  /** @param {any} pack @param {{ forceOrigin?: string }} [options] */
  addPack(pack, { forceOrigin } = {}) {
    const check = validatePack(pack);
    if (!check.valid) {
      this.problems.push({ packId: pack?.packId ?? "(unknown)", errors: check.errors });
      return false;
    }
    for (const question of pack.questions) {
      if (this.byId.has(question.id)) {
        this.problems.push({ packId: pack.packId, errors: [`${question.id}: id already used by another pack`] });
        continue;
      }
      const stored = forceOrigin
        ? { ...question, source: { ...question.source, origin: forceOrigin } }
        : question;
      this.questions.push(stored);
      this.byId.set(stored.id, stored);
    }
    return true;
  }

  get(id) {
    return this.byId.get(id);
  }

  /**
   * @param {{ map?: string, areaIds?: string[], sectionIds?: string[], difficulties?: string[], types?: string[] }} filter
   */
  filter({ map, areaIds, sectionIds, difficulties, types } = {}) {
    return this.questions.filter((question) => {
      if (map && question.map !== map) return false;
      if (areaIds?.length && !areaIds.includes(getSection(question.specRef)?.areaId)) return false;
      if (sectionIds?.length && !sectionIds.includes(question.specRef)) return false;
      if (difficulties?.length && !difficulties.includes(question.difficulty)) return false;
      if (types?.length && !types.includes(question.type)) return false;
      return true;
    });
  }
}
