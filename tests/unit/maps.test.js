import { describe, expect, it } from "vitest";
import { MAPS, parseMap, distanceField, isSolid, zoneAt } from "../../src/maps/maps.js";
import { areasForMap, getSection } from "../../src/content/specIndex.js";
import core1 from "../../content/questions/core1.json";
import core2 from "../../content/questions/core2.json";
import esp from "../../content/questions/esp.json";

const packs = { core1, core2, esp };

describe.each(Object.values(MAPS).map((map) => [map.id, map]))("map %s", (_id, map) => {
  const parsed = parseMap(map);

  it("has a rectangular grid enclosed by walls", () => {
    for (const row of map.layout) expect(row.length).toBe(parsed.width);
    expect(map.layout[0]).toMatch(/^#+$/);
    expect(map.layout[parsed.height - 1]).toMatch(/^#+$/);
    for (const row of map.layout) expect(row[0] + row[row.length - 1]).toBe("##");
  });

  it("has one spawn, one boss core, terminals and drone spawns", () => {
    expect(parsed.spawn).not.toBeNull();
    expect(map.layout.join("").split("S")).toHaveLength(2);
    expect(parsed.objectives.filter((o) => o.kind === "core")).toHaveLength(1);
    expect(parsed.objectives.filter((o) => o.kind === "terminal").length).toBeGreaterThanOrEqual(6);
    expect(parsed.droneSpawns.length).toBeGreaterThanOrEqual(4);
  });

  it("puts every objective in a zone", () => {
    for (const objective of parsed.objectives) expect(objective.zone, objective.id).not.toBeNull();
  });

  it("places each door between two floor cells", () => {
    for (const door of parsed.objectives.filter((o) => o.kind === "door")) {
      const horizontal = !isSolid(map, door.x - 1, door.y) && !isSolid(map, door.x + 1, door.y);
      const vertical = !isSolid(map, door.x, door.y - 1) && !isSolid(map, door.x, door.y + 1);
      expect(horizontal || vertical, door.id).toBe(true);
    }
  });

  it("can reach every objective once doors are open, and some door without answering", () => {
    const allDoors = new Set(parsed.objectives.filter((o) => o.kind === "door").map((o) => o.id));
    const open = distanceField(map, parsed.spawn, allDoors);
    for (const objective of parsed.objectives) {
      const reachable = objective.kind === "door"
        ? [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => open.at(objective.x + dx, objective.y + dy) < Infinity)
        : open.at(objective.x, objective.y) < Infinity;
      expect(reachable, objective.id).toBe(true);
    }
    const locked = distanceField(map, parsed.spawn, new Set());
    const reachableDoor = parsed.objectives.some((o) => o.kind === "door" &&
      [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => locked.at(o.x + dx, o.y + dy) < Infinity));
    expect(reachableDoor).toBe(true);
  });

  it("has questions available for every zone's topics", () => {
    for (const zone of map.zones) {
      const matching = packs[map.id].questions.filter((q) =>
        (zone.areaIds.length === 0 && zone.sectionIds.length === 0) ||
        zone.areaIds.includes(getSection(q.specRef).areaId) || zone.sectionIds.includes(q.specRef));
      expect(matching.length, zone.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("covers every content area of its component with at least one zone or an all-topics zone", () => {
    const covered = new Set(map.zones.flatMap((z) => [...z.areaIds, ...z.sectionIds.map((s) => getSection(s).areaId)]));
    const hasAllZone = map.zones.some((z) => z.areaIds.length === 0 && z.sectionIds.length === 0);
    for (const area of areasForMap(map.id)) expect(covered.has(area.id) || hasAllZone).toBe(true);
  });

  it("finds the zone for a cell", () => {
    expect(zoneAt(map, parsed.spawn.x, parsed.spawn.y)).not.toBeNull();
  });
});
