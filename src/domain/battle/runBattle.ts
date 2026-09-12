import { createAIEngine } from "../ai/engine";
import { productionInstructionRegistry } from "../ai/instructions";
import type { DataValidationError } from "../data/loadResult";
import type { DataRepository } from "../masterData/repository";
import type { Program } from "../program/models";
import { createGameSession } from "../runtime/createGameSession";
import type { GameSession, WorldState } from "../runtime/models";
import type { RobotAIDebugInfo } from "../runtime/updateGameSessionTick";
import { startGameSession } from "../runtime/startGameSession";
import { updateGameSessionTick } from "../runtime/updateGameSessionTick";
import { createFixedBattleInput } from "./fixedBattle";

export type BattleRun = {
  readonly finalGameSession: GameSession;
  readonly snapshots: readonly WorldState[];
  readonly aiDebugInfoByTick: readonly (readonly RobotAIDebugInfo[])[];
};

export type BattleRunResult =
  | { readonly success: true; readonly data: BattleRun }
  | {
      readonly success: false;
      readonly code: "invalid_battle_input" | "simulator_error";
      readonly message: string;
      readonly validationErrors?: readonly DataValidationError[];
    };

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const snapshot = (worldState: WorldState): WorldState =>
  deepFreeze(structuredClone(worldState));

/** Phase 1固定対戦を終了まで同期実行し、再計算不要の全Snapshotを返す。 */
export const runFixedBattle = (
  playerProgram: Program,
  opponentProgram: Program,
  repository: DataRepository,
): BattleRunResult => {
  const created = createGameSession(
    createFixedBattleInput(playerProgram, opponentProgram, repository),
  );
  if (!created.success) {
    return {
      success: false,
      code: "invalid_battle_input",
      message: "固定対戦の入力を検証できませんでした",
      validationErrors: created.errors,
    };
  }
  const started = startGameSession(created.data);
  if (!started.success) {
    return {
      success: false,
      code: "simulator_error",
      message: started.message,
    };
  }

  const aiEngine = createAIEngine({
    repository,
    instructionRegistry: productionInstructionRegistry,
  });
  let gameSession = started.data;
  const snapshots: WorldState[] = [snapshot(gameSession.worldState)];
  const aiDebugInfoByTick: (readonly RobotAIDebugInfo[])[] = [];
  while (gameSession.worldState.status === "running") {
    const updated = updateGameSessionTick(gameSession, {
      repository,
      aiEngine,
    });
    if (!updated.success) {
      return {
        success: false,
        code: "simulator_error",
        message: updated.message,
      };
    }
    gameSession = updated.data.gameSession;
    aiDebugInfoByTick.push(
      deepFreeze(structuredClone(updated.data.aiDebugInfoByRobot)),
    );
    snapshots.push(snapshot(gameSession.worldState));
  }

  return {
    success: true,
    data: {
      finalGameSession: gameSession,
      snapshots,
      aiDebugInfoByTick,
    },
  };
};
