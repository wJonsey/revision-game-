import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import core1 from "../../content/questions/core1.json";
import core2 from "../../content/questions/core2.json";
import esp from "../../content/questions/esp.json";
import incidents from "../../content/incidents/incidents.json";
import { validatePack, validateQuestion } from "../../src/content/questionSchema.js";
import { normaliseOutput } from "../../src/revision/answerChecker.js";
import { areasForMap } from "../../src/content/specIndex.js";
import { getSection } from "../../src/content/specIndex.js";

const packs = [core1, core2, esp];
const allQuestions = [...packs.flatMap((pack) => pack.questions), ...incidents.flatMap((i) => i.steps.map((s) => s.question))];

describe("built-in question packs", () => {
  it.each(packs.map((pack) => [pack.packId, pack]))("%s is valid", (_id, pack) => {
    const check = validatePack(pack);
    expect(check.errors).toEqual([]);
  });

  it("uses unique ids across all packs and incidents", () => {
    const ids = allQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every content area of every map", () => {
    for (const [pack, mapId] of [[core1, "core1"], [core2, "core2"], [esp, "esp"]]) {
      const areasCovered = new Set(pack.questions.map((q) => getSection(q.specRef).areaId));
      for (const area of areasForMap(mapId)) expect(areasCovered, `${mapId} ${area.id}`).toContain(area.id);
    }
  });

  it("never labels generated questions as verified without a spec or document reference", () => {
    for (const question of allQuestions.filter((q) => q.source.origin === "verified")) {
      expect(question.source.reference).toMatch(/Spec/);
    }
  });
});

describe("weekly incidents", () => {
  it("have valid questions matching the incident map", () => {
    for (const incident of incidents) {
      expect(incident.steps.length).toBeGreaterThanOrEqual(5);
      for (const step of incident.steps) {
        expect(validateQuestion(step.question)).toEqual([]);
        expect(step.question.map).toBe(incident.map);
      }
    }
  });
});

// Quality rule: predicted outputs must be what Python really prints (spec: Python 3.10+).
const python = spawnSync("python3", ["--version"]).status === 0 ? "python3" : null;
const outputQuestions = allQuestions.filter((q) => q.type === "predict_output");

describe.skipIf(!python)("predict-the-output answers match real Python", () => {
  it.each(outputQuestions.map((q) => [q.id, q]))("%s", (_id, question) => {
    const directory = mkdtempSync(join(tmpdir(), "codebreach-"));
    try {
      const file = join(directory, "question.py");
      writeFileSync(file, question.code);
      const run = spawnSync(python, [file], { cwd: directory, encoding: "utf8", timeout: 10000 });
      expect(run.stderr).toBe("");
      expect(normaliseOutput(run.stdout)).toBe(normaliseOutput(question.answer[0]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
