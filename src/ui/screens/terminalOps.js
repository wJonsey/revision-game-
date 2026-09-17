import { h, clear, bar } from "../dom.js";
import { parseMap, distanceField } from "../../maps/maps.js";
import { runObjective, showRoundSummary, OBJECTIVE_LABELS } from "../components/objectiveFlow.js";
import { toast } from "../notify.js";
import { MAX_SHIELD } from "../../game/matchSession.js";

const BOSS_QUESTION_SECONDS = 90;
const DRONE_DAMAGE = { relaxed: 4, standard: 7, hard: 10 };

/**
 * Terminal Ops: the full match without 3D graphics, for devices without WebGL
 * or players who prefer it. Same rounds, zones, doors, objectives and scoring.
 */
export function runTerminalOps({ app, session, map, root, finish, isCancelled }) {
  const parsed = parseMap(map);
  const openDoors = new Set();
  const usedThisRound = new Set();
  const status = h("div", { class: "ops-status", "aria-live": "polite" });
  const board = h("div", { class: "ops-board" });
  const stage = h("div", { class: "ops-stage" });
  root.append(h("section", { class: "screen terminal-ops" },
    h("header", { class: "screen-header" },
      h("button", { class: "btn btn-ghost", on: { click: () => { if (window.confirm("Abandon this operation? Answers so far are kept.")) finish("quit"); } } }, "Abandon"),
      h("h1", { class: "screen-title" }, `TERMINAL OPS // ${map.name}`)),
    status, board, stage));

  const timer = setInterval(() => {
    if (isCancelled()) return clearInterval(timer);
    renderStatus();
    if (session.timeRemainingSeconds() === 0) finish("time");
  }, 1000);

  function renderStatus() {
    const time = session.timeRemainingSeconds();
    const ultimate = session.playerClass.ultimate;
    clear(status,
      h("span", {}, `Round ${session.roundIndex + 1}/${session.mode.rounds.length}: ${session.round.name}`),
      h("span", {}, `Questions ${session.roundState.answered}/${session.round.questions}`),
      h("span", { class: "shield" }, `Shield ${session.shield}/${MAX_SHIELD}`, bar(session.shield, { max: MAX_SHIELD, label: "Shield" })),
      h("span", {}, `Alarms ${session.alarms}`),
      time === null ? null : h("span", {}, `Time ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`),
      h("button", { class: "btn btn-small", disabled: !session.ultimateReady || session.pendingAids.size > 0, on: { click: () => {
        session.activateUltimate();
        toast(`${ultimate.name} ready: ${ultimate.description}`, "success", 5000);
        renderBoard();
      } } }, session.pendingAids.size ? `${ultimate.name}: armed` : `X · ${ultimate.name} (${session.ultimateCharge}/${ultimate.charge})`));
  }

  function reachable() {
    return distanceField(map, parsed.spawn, openDoors);
  }

  const NEIGHBOURS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  /** For a locked door: the zone on the reachable side and the zone it leads into. */
  function doorSides(door, field) {
    const sides = NEIGHBOURS.map(([dx, dy]) => ({ x: door.x + dx, y: door.y + dy }))
      .map((cell) => ({ ...cell, zone: map.zones.find(({ rect: [x0, y0, x1, y1] }) => cell.x >= x0 && cell.x <= x1 && cell.y >= y0 && cell.y <= y1) }))
      .filter((cell) => cell.zone);
    const near = sides.find((cell) => field.at(cell.x, cell.y) < Infinity);
    const far = sides.find((cell) => cell.zone.id !== near?.zone.id);
    return { from: near?.zone ?? null, to: far?.zone ?? null };
  }

  function renderBoard() {
    renderStatus();
    const field = reachable();
    const lockedDoors = parsed.objectives
      .filter((o) => o.kind === "door" && !openDoors.has(o.id))
      .map((door) => ({ door, ...doorSides(door, field) }))
      .filter((entry) => entry.from);

    const zoneCards = map.zones.map((zone) => {
      const inside = parsed.objectives.filter((o) => o.kind !== "door" && o.zone?.id === zone.id);
      const accessible = field.at(...zoneCell(zone, inside)) < Infinity;
      const actions = [];
      if (accessible) {
        for (const objective of inside) {
          if (objective.kind === "core") {
            if (session.round.boss) actions.push(button(objective, "Restore the core (boss)"));
            continue;
          }
          const used = usedThisRound.has(objective.id);
          actions.push(button(objective, `${OBJECTIVE_LABELS[objective.kind]}${used ? " (used this round)" : ""}`, used));
        }
        for (const entry of lockedDoors.filter((e) => e.from.id === zone.id)) {
          actions.push(button(entry.door, `Unlock door to ${entry.to?.name ?? "next area"}`));
        }
      }
      return h("section", { class: `panel zone-card ${accessible ? "" : "zone-locked"}` },
        h("h3", {}, zone.name, accessible ? "" : " (locked)"),
        h("p", { class: "muted" }, zone.areaIds.length || zone.sectionIds.length ? `Topics: ${[...zone.areaIds, ...zone.sectionIds].join(", ")}` : "Topics: all"),
        actions.length ? h("div", { class: "zone-actions" }, actions) : h("p", { class: "muted" }, accessible ? "Nothing to do here this round." : "Open a door from a neighbouring zone to get in."));
    });
    clear(board, session.round.boss ? h("p", { class: "panel panel-warning" }, "⚠ BOSS ROUND: reach the core and restore it.") : null, h("div", { class: "zone-grid" }, zoneCards));
    clear(stage);
  }

  /** A floor cell inside the zone, used to test whether the zone is reachable. */
  function zoneCell(zone, inside) {
    if (inside.length) return [inside[0].x, inside[0].y];
    const [x0, y0, x1, y1] = zone.rect;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (map.layout[y][x] !== "#") return [x, y];
    return [x0, y0];
  }

  function button(objective, label, disabled = false) {
    return h("button", { class: `btn objective objective-${objective.kind}`, disabled, on: { click: () => interact(objective) } }, label);
  }

  async function interact(objective) {
    clear(board);
    if (objective.kind === "core") {
      app.sound.play("boss");
      while (!session.isRoundComplete && !isCancelled()) {
        const effects = await runObjective({ app, session, container: stage, objective, isCancelled, timeLimitSeconds: BOSS_QUESTION_SECONDS });
        if (!effects) return;
        renderStatus();
      }
    } else {
      const effects = await runObjective({ app, session, container: stage, objective, isCancelled });
      if (!effects) return;
      if (objective.kind === "door" && effects.unlock) {
        openDoors.add(objective.id);
        app.sound.play("door");
      } else if (objective.kind !== "door") {
        usedThisRound.add(objective.id);
      }
      if (effects.alarm) app.sound.play("alarm");
      droneEncounter();
      const remaining = parsed.objectives.filter((o) => (o.kind === "terminal" || o.kind === "defuse") && !usedThisRound.has(o.id));
      if (remaining.length === 0) usedThisRound.clear();
    }
    if (isCancelled()) return;
    if (session.isRoundComplete) {
      const summary = session.completeRound();
      await showRoundSummary(stage, session, summary, app);
      if (isCancelled()) return;
      if (session.finished) return finish("complete");
      session.startNextRound();
      usedThisRound.clear();
      if (session.round.boss) app.sound.play("boss");
    }
    renderBoard();
  }

  function droneEncounter() {
    if (session.alarms === 0 || Math.random() > 0.5) return;
    const damage = DRONE_DAMAGE[app.save.settings.combatDifficulty] * Math.min(session.alarms, 3);
    const crashed = session.takeDamage(damage);
    app.sound.play("damage");
    toast(crashed ? "System crash! Rebooted with 60 shield." : `Bug drones attacked: -${damage} shield. Answer defuse objectives to clear alarms.`, crashed ? "error" : "warning", 4000);
  }

  renderBoard();
  return () => clearInterval(timer);
}
