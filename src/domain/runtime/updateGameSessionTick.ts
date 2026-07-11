import { INT32_MAX, type Int32 } from "../data/common";
import type { DataRepository } from "../masterData/repository";
import type { AIEngine } from "../ai/engine";
import {
  arbitrateRobotActionRequests,
  createActionStatusSnapshot,
} from "./actionArbitration";
import {
  createEmptyActionRequests,
  createExecutionRobotSnapshot,
} from "./factories";
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

const emptySensors = (): SensorSnapshot => ({ robots: [], bullets: [] });

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
  sensors: emptySensors(),
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

    let workingWorld = structuredClone(gameSession.worldState);
    workingWorld = {
      ...workingWorld,
      robots: workingWorld.robots.map((robot) => ({
        ...robot,
        actionRequests: createEmptyActionRequests(),
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

      const execution = dependencies.aiEngine.execute({
        program: participant.program,
        executionInput: createExecutionInput(
          workingWorld.tick,
          robot,
          currentRandomState,
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

    return {
      success: true,
      data: {
        gameSession: {
          ...structuredClone(gameSession),
          worldState: {
            ...workingWorld,
            tick: (workingWorld.tick + 1) as Int32,
          },
        },
        aiDebugInfoByRobot,
      },
    };
  } catch (error) {
    return unexpectedError(error);
  }
};
