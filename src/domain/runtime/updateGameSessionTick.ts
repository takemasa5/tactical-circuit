import { INT32_MAX, type Int32 } from "../data/common";
import type { DataRepository } from "../masterData/repository";
import type { AIEngine } from "../ai/engine";
import {
  arbitrateRobotActionRequests,
  createActionStatusSnapshot,
} from "./actionArbitration";
import { resolveBattleTick } from "./battleResolution";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
  createExecutionRobotSnapshot,
} from "./factories";
import { updateCombatAction } from "./combatSystem";
import { updateMovementAction } from "./movementSystem";
import { createSensorSnapshot } from "./sensorSystem";
import type {
  AIDebugInfo,
  ExecutionInput,
  GameSession,
  RandomState,
  RobotState,
  SensorSnapshot,
} from "./models";
import type { SimulatorResult } from "./simulatorResult";

/** `docs/specs/current/simulator/tick_update.md`のRobot別AIデバッグ情報。 */
export type RobotAIDebugInfo = {
  readonly robotId: RobotState["id"];
  readonly debugInfo: AIDebugInfo;
};

/** `docs/specs/current/simulator/tick_update.md`の1 Tick更新成功結果。 */
export type GameSessionTickUpdate = {
  readonly gameSession: GameSession;
  readonly aiDebugInfoByRobot: readonly RobotAIDebugInfo[];
};

export type GameSessionTickDependencies = {
  readonly repository: DataRepository;
  readonly aiEngine: AIEngine;
};

const internalError = <T>(message: string): SimulatorResult<T> => ({
  success: false,
  code: "inconsistent_session",
  message,
});

const unexpectedError = <T>(error: unknown): SimulatorResult<T> => ({
  success: false,
  code: "internal_simulator_error",
  message:
    error instanceof Error
      ? `Tick更新中に予期しないエラーが発生しました: ${error.message}`
      : "Tick更新中に予期しないエラーが発生しました",
});

const replaceRobot = (
  robots: readonly RobotState[],
  robot: RobotState,
): readonly RobotState[] =>
  robots.map((candidate) => (candidate.id === robot.id ? robot : candidate));

const createExecutionInput = (
  tick: Int32,
  robot: RobotState,
  randomState: RandomState,
  sensors: SensorSnapshot,
): ExecutionInput => ({
  tick,
  robot: createExecutionRobotSnapshot(robot),
  aiRuntimeState: {
    ...robot.aiRuntimeState,
    registers: { ...robot.aiRuntimeState.registers },
    flags: { ...robot.aiRuntimeState.flags },
    callStack: [...robot.aiRuntimeState.callStack],
    memory: { values: [...robot.aiRuntimeState.memory.values] },
  },
  sensors,
  randomState: { ...randomState },
  actionStatus: createActionStatusSnapshot(robot.actionState),
});

/** `running`のGame Sessionを、入力を変更せず同期的に1 Tick進める。 */
export const updateGameSessionTick = (
  gameSession: GameSession,
  dependencies: GameSessionTickDependencies,
): SimulatorResult<GameSessionTickUpdate> => {
  if (gameSession.worldState.status !== "running") {
    return {
      success: false,
      code: "invalid_game_status",
      message: "Game SessionはrunningのときだけTick更新できます",
    };
  }
  if (gameSession.worldState.tick >= INT32_MAX) {
    return {
      success: false,
      code: "tick_overflow",
      message: "Tickが符号付き32bit整数の上限を超えます",
    };
  }

  try {
    const gameRule = dependencies.repository.get(
      "game_rule",
      gameSession.gameRuleId,
    );
    if (gameRule === undefined) {
      return internalError("Game SessionのGame Ruleが見つかりません");
    }

    const tickStartSession = structuredClone(gameSession);
    const tickStartBulletIds = new Set(
      gameSession.worldState.bullets.map(({ id }) => id),
    );
    let workingWorld = structuredClone(gameSession.worldState);
    workingWorld = {
      ...workingWorld,
      robots: workingWorld.robots.map((robot) => ({
        ...robot,
        actionRequests: createEmptyActionRequests(),
        actionState:
          robot.status === "destroyed"
            ? createEmptyRobotActionState()
            : robot.actionState,
      })),
    };
    let currentRandomState = { ...workingWorld.randomState };
    const aiDebugInfoByRobot: RobotAIDebugInfo[] = [];

    for (const participant of gameSession.participants) {
      const robot = workingWorld.robots.find(
        (candidate) => candidate.id === participant.robotId,
      );
      if (robot === undefined) {
        return internalError(
          `参加者${participant.robotId}に対応するRobot Stateが見つかりません`,
        );
      }
      if (robot.status === "destroyed") continue;

      const tickStartRobot = tickStartSession.worldState.robots.find(
        (candidate) => candidate.id === participant.robotId,
      );
      if (tickStartRobot === undefined) {
        return internalError(
          `参加者${participant.robotId}に対応するTick開始時Robot Stateが見つかりません`,
        );
      }
      const sensors = createSensorSnapshot(
        tickStartSession,
        tickStartRobot,
        dependencies.repository,
      );
      if (!sensors.success) return sensors;

      const execution = dependencies.aiEngine.execute({
        program: participant.program,
        executionInput: createExecutionInput(
          workingWorld.tick,
          robot,
          currentRandomState,
          sensors.data,
        ),
        gameRule,
      });
      currentRandomState = { ...execution.executionResult.randomState };
      const updatedRobot: RobotState = {
        ...robot,
        aiRuntimeState: structuredClone(
          execution.executionResult.aiRuntimeState,
        ),
        actionRequests: {
          movement: execution.executionResult.actionRequests.movement,
          combat: execution.executionResult.actionRequests.combat,
        },
      };
      workingWorld = {
        ...workingWorld,
        robots: replaceRobot(workingWorld.robots, updatedRobot),
        randomState: currentRandomState,
      };
      aiDebugInfoByRobot.push({
        robotId: participant.robotId,
        debugInfo: structuredClone(execution.debugInfo),
      });
    }

    for (const participant of gameSession.participants) {
      const robot = workingWorld.robots.find(
        (candidate) => candidate.id === participant.robotId,
      );
      if (robot === undefined) {
        return internalError(
          `参加者${participant.robotId}に対応するRobot Stateが見つかりません`,
        );
      }
      if (robot.status === "destroyed") continue;
      const actionState = arbitrateRobotActionRequests(
        robot.actionState,
        robot.actionRequests,
      );
      if (!actionState.success) {
        return actionState;
      }
      workingWorld = {
        ...workingWorld,
        robots: replaceRobot(workingWorld.robots, {
          ...robot,
          actionState: actionState.data,
        }),
      };
    }

    for (const participant of gameSession.participants) {
      const robot = workingWorld.robots.find(
        (candidate) => candidate.id === participant.robotId,
      );
      if (robot === undefined) {
        return internalError(
          `参加者${participant.robotId}に対応するRobot Stateが見つかりません`,
        );
      }
      if (robot.status === "destroyed") continue;
      const movement = updateMovementAction(
        { ...gameSession, worldState: workingWorld },
        robot,
        dependencies.repository,
      );
      if (!movement.success) return movement;
      workingWorld = {
        ...workingWorld,
        robots: replaceRobot(workingWorld.robots, movement.data),
      };
    }

    for (const participant of gameSession.participants) {
      const robot = workingWorld.robots.find(
        (candidate) => candidate.id === participant.robotId,
      );
      if (robot === undefined) {
        return internalError(
          `参加者${participant.robotId}に対応するRobot Stateが見つかりません`,
        );
      }
      if (robot.status === "destroyed") continue;
      const combat = updateCombatAction(
        { ...gameSession, worldState: workingWorld },
        robot,
        workingWorld.nextBulletSequence,
        dependencies.repository,
      );
      if (!combat.success) return combat;
      workingWorld = {
        ...workingWorld,
        robots: replaceRobot(workingWorld.robots, combat.data.robot),
        bullets:
          combat.data.createdBullet === null
            ? workingWorld.bullets
            : [...workingWorld.bullets, combat.data.createdBullet],
        nextBulletSequence: combat.data.nextBulletSequence,
      };
    }

    const resolvedWorld = resolveBattleTick(
      gameSession,
      workingWorld,
      tickStartBulletIds,
      dependencies.repository,
    );
    if (!resolvedWorld.success) return resolvedWorld;

    return {
      success: true,
      data: {
        gameSession: {
          ...structuredClone(gameSession),
          worldState: resolvedWorld.data,
        },
        aiDebugInfoByRobot,
      },
    };
  } catch (error) {
    return unexpectedError(error);
  }
};
