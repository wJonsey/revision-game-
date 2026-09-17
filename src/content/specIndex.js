import specMap from "../../content/spec/spec-map.json";

/**
 * Lookup helpers over content/spec/spec-map.json.
 * A "section" is the smallest unit questions are tagged with (e.g. "2.8", "ESP.2").
 */

const sectionsById = new Map();
const areasById = new Map();

for (const component of specMap.components) {
  for (const area of component.contentAreas) {
    areasById.set(area.id, {
      id: area.id,
      title: area.title,
      componentId: component.id,
      componentName: component.name,
      map: component.gameMap,
      sectionIds: area.sections.map((section) => section.id),
    });
    for (const section of area.sections) {
      sectionsById.set(section.id, {
        id: section.id,
        title: section.title,
        areaId: area.id,
        areaTitle: area.title,
        componentId: component.id,
        componentName: component.name,
        map: component.gameMap,
      });
    }
  }
}

export const GAME_MAPS = [
  { id: "core1", name: "CORE 1", title: "Foundation Facility", componentId: "core-paper-1" },
  { id: "core2", name: "CORE 2", title: "Enterprise Complex", componentId: "core-paper-2" },
  { id: "esp", name: "ESP", title: "Client Solutions HQ", componentId: "esp" },
];

export const qualification = specMap.qualification;

export function getSection(sectionId) {
  return sectionsById.get(sectionId);
}

export function getArea(areaId) {
  return areasById.get(areaId);
}

/** Content areas that belong to a game map, in spec order. */
export function areasForMap(mapId) {
  return [...areasById.values()].filter((area) => area.map === mapId);
}

export function allAreas() {
  return [...areasById.values()];
}

export function getMap(mapId) {
  return GAME_MAPS.find((map) => map.id === mapId);
}
