/**
 * The three operation maps as ASCII grids. One character = one 2×2 metre cell.
 *   #  wall        .  floor         S  player spawn     E  drone spawn
 *   D  locked door (answer a question to open)
 *   T  terminal    X  defuse point  C  boss core
 * Zones are rectangles [x0, y0, x1, y1] (inclusive). Objectives in a zone ask questions
 * from that zone's content areas (`areaIds`) or spec sections (`sectionIds`); empty = any.
 */

export const MAPS = {
  core1: {
    id: "core1",
    name: "Foundation Facility",
    theme: { floor: "#10202a", wall: "#1f3b4d", accent: "#3ddbd9", fog: "#061018", light: "#9fe8ff" },
    layout: [
      "###############################",
      "#.....T.......#.......T.......#",
      "#..E..........#...........E...#",
      "#.....X.......D.......X.......#",
      "#.............#...............#",
      "#.T...........#.............T.#",
      "#######D###########D###########",
      "#.........#.........#.........#",
      "#..E......#....C....#......E..#",
      "#.........D.........D.........#",
      "#.T.......#....S....#.......T.#",
      "#######D###########D###########",
      "#.............#...............#",
      "#.T...........#.............T.#",
      "#.....X.......D.......X.......#",
      "#..E..........#...........E...#",
      "#.....T.......#.......T.......#",
      "###############################",
    ],
    zones: [
      { id: "programming-lab", name: "Programming Lab", rect: [1, 1, 13, 5], areaIds: ["CA2"], sectionIds: [] },
      { id: "algorithm-hall", name: "Algorithm Hall", rect: [15, 1, 29, 5], areaIds: ["CA1"], sectionIds: ["2.11"] },
      { id: "data-structures-bay", name: "Data Structures Bay", rect: [1, 7, 9, 10], areaIds: [], sectionIds: ["2.1", "2.2", "2.3", "2.4", "2.9", "2.10"] },
      { id: "core-chamber", name: "Core Chamber", rect: [11, 7, 19, 10], areaIds: [], sectionIds: [] },
      { id: "testing-lab", name: "Testing Lab", rect: [21, 7, 29, 10], areaIds: [], sectionIds: ["2.12", "2.8", "2.10"] },
      { id: "compliance-archive", name: "Compliance Archive", rect: [1, 12, 13, 16], areaIds: ["CA4"], sectionIds: [] },
      { id: "innovation-wing", name: "Innovation Wing", rect: [15, 12, 29, 16], areaIds: ["CA3"], sectionIds: [] },
    ],
  },
  core2: {
    id: "core2",
    name: "Enterprise Complex",
    theme: { floor: "#1a1428", wall: "#3a2d5c", accent: "#be95ff", fog: "#0d0818", light: "#d4bbff" },
    layout: [
      "#################################",
      "#..T.....#.............#.....T..#",
      "#........#.....E.......#........#",
      "#..E.....D.............D.....E..#",
      "#........#.....X.......#........#",
      "#..X.....#.............#.....X..#",
      "####D#########D###D#########D####",
      "#...............................#",
      "#..T.....E.......S.......E...T..#",
      "#...............................#",
      "####D#########D###D#########D####",
      "#..X.....#.............#.....X..#",
      "#........#.....C.......#........#",
      "#..E.....D.............D.....E..#",
      "#........#.............#........#",
      "#..T.....#......T......#.....T..#",
      "#################################",
    ],
    zones: [
      { id: "business-operations", name: "Business Operations", rect: [1, 1, 8, 5], areaIds: ["CA5"], sectionIds: [] },
      { id: "data-centre", name: "Data Centre", rect: [10, 1, 22, 5], areaIds: ["CA6"], sectionIds: [] },
      { id: "network-operations", name: "Network Operations", rect: [24, 1, 31, 5], areaIds: [], sectionIds: ["7.3", "7.1", "7.2"] },
      { id: "atrium", name: "Development Floor", rect: [1, 7, 31, 9], areaIds: [], sectionIds: [] },
      { id: "cyber-security-centre", name: "Cyber Security Centre", rect: [1, 11, 8, 15], areaIds: ["CA8"], sectionIds: [] },
      { id: "incident-response", name: "Incident Response Centre", rect: [10, 11, 22, 15], areaIds: [], sectionIds: [] },
      { id: "systems-architecture", name: "Systems Architecture", rect: [24, 11, 31, 15], areaIds: [], sectionIds: ["7.4", "7.5", "7.6"] },
    ],
  },
  esp: {
    id: "esp",
    name: "Client Solutions HQ",
    theme: { floor: "#241a10", wall: "#5c4326", accent: "#ffb784", fog: "#140d06", light: "#ffd8b8" },
    layout: [
      "###############################",
      "#....T.....#....T....#....T...#",
      "#..........#.........#........#",
      "#..X.......D....E....D.....X..#",
      "#..........#.........#........#",
      "#....E.....#....X....#...E....#",
      "#####D##########D#########D####",
      "#.............................#",
      "#...T.........S.........T.....#",
      "#.............................#",
      "#######D###############D#######",
      "#....T.........#......T.......#",
      "#..E.........X.#......C.......#",
      "#..............D..............#",
      "#....X.........#..E.......E...#",
      "#..T...........#.....T........#",
      "###############################",
    ],
    zones: [
      { id: "planning-room", name: "Planning Room", rect: [1, 1, 10, 5], areaIds: [], sectionIds: ["ESP.0", "ESP.1"] },
      { id: "bug-tracking", name: "Bug Tracking Centre", rect: [12, 1, 20, 5], areaIds: [], sectionIds: ["ESP.2"] },
      { id: "design-studio", name: "Design Studio", rect: [22, 1, 29, 5], areaIds: [], sectionIds: ["ESP.3"] },
      { id: "requirements-office", name: "Requirements Office", rect: [1, 7, 29, 9], areaIds: [], sectionIds: [] },
      { id: "development-floor", name: "Development Floor", rect: [1, 11, 14, 15], areaIds: [], sectionIds: ["ESP.4a"] },
      { id: "presentation-theatre", name: "Presentation Theatre", rect: [16, 11, 29, 15], areaIds: [], sectionIds: ["ESP.4b", "ESP.3"] },
    ],
  },
};

export const OBJECTIVE_KINDS = { D: "door", T: "terminal", X: "defuse", C: "core" };

export function zoneAt(map, x, y) {
  return map.zones.find(({ rect: [x0, y0, x1, y1] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1) ?? null;
}

/**
 * Parses a map into cells and objectives. Doors sit in walls, so they take the zone
 * of the first neighbouring floor cell.
 */
export function parseMap(map) {
  const objectives = [];
  const droneSpawns = [];
  let spawn = null;
  map.layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "S") spawn = { x, y };
      if (cell === "E") droneSpawns.push({ x, y });
      const kind = OBJECTIVE_KINDS[cell];
      if (!kind) return;
      let zone = zoneAt(map, x, y);
      if (!zone) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          zone = zoneAt(map, x + dx, y + dy);
          if (zone) break;
        }
      }
      objectives.push({ id: `${kind}-${x}-${y}`, kind, x, y, zone });
    });
  });
  return { width: map.layout[0].length, height: map.layout.length, spawn, droneSpawns, objectives };
}

/** Cells a player or drone cannot enter. Locked doors are solid until opened. */
export function isSolid(map, x, y, openDoors = new Set()) {
  const cell = map.layout[y]?.[x];
  if (cell === undefined || cell === "#") return true;
  if (cell === "D") return !openDoors.has(`door-${x}-${y}`);
  return false;
}

/** Breadth-first search distances (in cells) from a start cell. Used for drone pathfinding. */
export function distanceField(map, start, openDoors) {
  const height = map.layout.length;
  const width = map.layout[0].length;
  const distances = new Array(width * height).fill(Infinity);
  const queue = [[start.x, start.y]];
  distances[start.y * width + start.x] = 0;
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    const next = distances[y * width + x] + 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || isSolid(map, nx, ny, openDoors)) continue;
      if (distances[ny * width + nx] <= next) continue;
      distances[ny * width + nx] = next;
      queue.push([nx, ny]);
    }
  }
  return { width, distances, at: (x, y) => distances[y * width + x] ?? Infinity };
}
