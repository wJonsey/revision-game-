import { describe, expect, it } from "vitest";
import specMap from "../../content/spec/spec-map.json";

const allSections = specMap.components.flatMap((component) =>
  component.contentAreas.flatMap((area) =>
    area.sections.map((section) => ({ ...section, areaId: area.id, componentId: component.id })),
  ),
);

describe("spec-map.json", () => {
  it("has unique section ids", () => {
    const ids = allSections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numbers each core exam section under its content area (e.g. 2.8 is in CA2)", () => {
    const examSections = allSections.filter((s) => s.componentId.startsWith("core-paper"));
    for (const section of examSections) {
      expect(section.id.split(".")[0]).toBe(section.areaId.replace("CA", ""));
    }
  });

  it("gives Paper 1 content areas 1-4 and Paper 2 content areas 5-8", () => {
    const areaIds = (id) =>
      specMap.components.find((c) => c.id === id).contentAreas.map((a) => a.id);
    expect(areaIds("core-paper-1")).toEqual(["CA1", "CA2", "CA3", "CA4"]);
    expect(areaIds("core-paper-2")).toEqual(["CA5", "CA6", "CA7", "CA8"]);
  });

  it("has core component weightings that add up to 100%", () => {
    const total = specMap.components
      .map((c) => c.assessment.percentOfCore)
      .filter((value) => value !== null)
      .reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);
  });
});
