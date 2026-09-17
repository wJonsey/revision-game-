import { MatchSession } from "../../game/matchSession.js";
import { MAPS } from "../../maps/maps.js";
import { runObjective, showRoundSummary } from "../components/objectiveFlow.js";
import { runTerminalOps } from "./terminalOps.js";
import { toast } from "../notify.js";

const BOSS_QUESTION_SECONDS = 90;

export function matchScreen(app) {
  return (root, { navigate, params }) => {
    const { mapId, mode, engine, areaIds = [] } = params;
    if (!mapId || !mode) {
      navigate("play");
      return;
    }
    let cancelled = false;
    const map = MAPS[mapId];
    let questionPool = app.bank.filter({ map: mapId, areaIds });
    if (questionPool.length === 0) questionPool = app.bank.filter({ map: mapId });
    const session = new MatchSession({ mode, mapId, classId: app.save.loadout.classId, revision: app.revision, questionPool });
    const isCancelled = () => cancelled;

    const finish = (reason) => {
      if (cancelled) return;
      const summary = session.finished ? session.summary : session.finish(reason);
      cancelled = true;
      navigate("matchSummary", { summary });
    };

    if (engine === "terminal" || !app.capabilities.webgl) {
      const stop = runTerminalOps({ app, session, map, root, finish, isCancelled });
      return () => {
        cancelled = true;
        stop();
      };
    }

    let game = null;
    let busy = false;

    async function endRoundIfComplete(overlay) {
      if (!session.isRoundComplete) return false;
      const summary = session.completeRound();
      await showRoundSummary(overlay, session, summary, app);
      if (cancelled) return true;
      if (session.finished) {
        finish("complete");
        return true;
      }
      session.startNextRound();
      if (session.round.boss) {
        app.sound.play("boss");
        toast("BOSS ROUND: find the core.", "warning", 4000);
      }
      game.startRound();
      return false;
    }

    async function interact(objective) {
      if (busy) return;
      busy = true;
      let ended = false;
      await game.runPaused(async (overlay) => {
        if (objective.kind === "core") {
          while (!session.isRoundComplete && !cancelled) {
            const effects = await runObjective({ app, session, container: overlay, objective, isCancelled, timeLimitSeconds: BOSS_QUESTION_SECONDS });
            if (!effects) return;
          }
        } else {
          const effects = await runObjective({ app, session, container: overlay, objective, isCancelled });
          if (!effects) return;
          game.applyEffects(objective, effects);
        }
        if (!cancelled) ended = await endRoundIfComplete(overlay);
      });
      busy = false;
      if (ended || cancelled) return;
    }

    import("../../game3d/fpsGame.js").then(({ FpsGame }) => {
      if (cancelled) return;
      try {
        game = new FpsGame({
          container: root, app, session, map,
          handlers: { interact, timeUp: () => finish("time"), quit: () => finish("quit") },
        });
        // Development-only hook so automated browser tests can drive objectives.
        if (import.meta.env.DEV) window.__codebreach = { game, interact };
      } catch (error) {
        console.error(error);
        toast("3D could not start on this device. Switching to Terminal Ops.", "error", 6000);
        root.replaceChildren();
        runTerminalOps({ app, session, map, root, finish, isCancelled });
      }
    });

    return () => {
      cancelled = true;
      game?.dispose();
    };
  };
}
