import { describe, expect, it } from "vitest";

import { INT32_MAX, type Int32 } from "../data/common";
import type {
  NodeId,
  ProgramId,
  RobotDesignId,
  RuntimeRobotId,
} from "../data/ids";
import type {
  EngineDefinition,
  EngineId,
  GameRuleDefinition,
  GameRuleId,
  InstructionDefinition,
  InstructionId,
  MapDefinition,
  MapId,
  RobotBodyDefinition,
  RobotBodyId,
  SensorDefinition,
  SensorId,
} from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { AIEngine } from "../ai/engine";
import { createAIEngine } from "../ai/engine";
import { productionInstructionRegistry } from "../ai/instructions";
import type { Program } from "../program/models";
import type {
  AIDebugInfo,
  AIExecutionInput,
  AIExecutionOutput,
  AIRuntimeState,
  GameSession,
  RobotState,
} from "./models";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import { updateGameSessionTick } from "./updateGameSessionTick";

const int32 = (value: number): Int32 => value as Int32;
const nodeId = (value: number): NodeId => `node_${value}` as NodeId;
const robotId = (value: number): RuntimeRobotId =>
  `robot_${value}` as RuntimeRobotId;

const gameRuleId =
  "game_rule_550e8400-e29b-41d4-a716-446655440000" as GameRuleId;
const mapId = "map_550e8400-e29b-41d4-a716-446655440000" as MapId;
const bodyId = "robot_body_550e8400-e29b-41d4-a716-446655440000" as RobotBodyId;
const engineId = "engine_550e8400-e29b-41d4-a716-446655440001" as EngineId;
const sensorId = "sensor_550e8400-e29b-41d4-a716-446655440002" as SensorId;
const engineSlotId = "slot_engine";
const sensorSlotId = "slot_sensor";

const gameRule: GameRuleDefinition = {
  id: gameRuleId,
  displayName: "Test rule",
  description: "",
  enabled: true,
  cpuLimit: int32(10),
  tickLimit: int32(100),
  participantCount: int32(2),
  registerNames: ["A"],
  flagNames: ["F1"],
  memorySize: int32(2),
  callStackSize: int32(2),
};

const body: RobotBodyDefinition = {
  id: bodyId,
  displayName: "Body",
  description: "",
  enabled: true,
  weight: int32(0),
  maxHp: int32(100),
  maxEnergy: int32(100),
  heatCapacity: int32(100),
  size: { width: int32(2), height: int32(2) },
  slots: [
    {
      id: "slot_right",
      displayName: "Right",
      category: "weapon",
      weaponMount: "right_hand",
    },
    {
      id: "slot_left",
      displayName: "Left",
      category: "weapon",
      weaponMount: "left_hand",
    },
    { id: engineSlotId, displayName: "Engine", category: "engine" },
    { id: sensorSlotId, displayName: "Sensor", category: "sensor" },
  ],
};

const engine: EngineDefinition = {
  id: engineId,
  displayName: "Engine",
  description: "",
  enabled: true,
  maxForwardSpeed: int32(4),
  maxBackwardSpeed: int32(0),
  maxStrafeSpeed: int32(0),
  acceleration: int32(4),
  turnSpeedDegree: int32(10),
  forwardPrepareTicks: int32(0),
  forwardRecoveryTicks: int32(0),
  backwardPrepareTicks: int32(0),
  backwardRecoveryTicks: int32(0),
  strafePrepareTicks: int32(0),
  strafeRecoveryTicks: int32(0),
  turnPrepareTicks: int32(0),
  turnRecoveryTicks: int32(0),
  blockedCancelTicks: int32(1),
  energyConsumption: int32(0),
  weight: int32(0),
};

const sensor: SensorDefinition = {
  id: sensorId,
  displayName: "Sensor",
  description: "",
  enabled: true,
  detectionDistance: int32(1000),
  fieldOfViewDegree: int32(360),
  energyConsumption: int32(0),
  weight: int32(0),
};

const map: MapDefinition = {
  id: mapId,
  displayName: "Map",
  description: "",
  enabled: true,
  size: { width: int32(800), height: int32(450) },
  obstacles: [],
  spawnPoints: [],
};

const runtimeState = (
  nextNodeId: NodeId | null = nodeId(1),
): AIRuntimeState => ({
  nextNodeId,
  registers: { A: int32(0) },
  flags: { F1: false },
  callStack: [],
  memory: { values: [int32(0), int32(0)] },
});

const robot = (
  sequence: number,
  overrides: Partial<RobotState> = {},
): RobotState => ({
  id: robotId(sequence),
  robotDesignId: `robo_${sequence}` as RobotDesignId,
  position: { x: int32(sequence * 10), y: int32(sequence * 10) },
  direction: int32(0),
  velocity: { x: int32(0), y: int32(0) },
  currentHp: int32(100),
  energy: int32(100),
  heat: int32(0),
  status: "active",
  partDamage: {},
  selectedWeaponSlotId: null,
  ammunition: {},
  aiRuntimeState: runtimeState(),
  actionRequests: createEmptyActionRequests(),
  actionState: createEmptyRobotActionState(),
  ...overrides,
});

const program = (sequence: number): Program => ({
  id: `program_${sequence}` as ProgramId,
  nodes: [],
  startNodeId: nodeId(1),
  nextNodeSequence: int32(1),
  metadata: {
    name: `Program ${sequence}`,
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  editorState: { nodePositions: {}, comments: {} },
});

const session = (overrides: Partial<GameSession> = {}): GameSession => {
  const robots = [robot(1), robot(2)];
  return {
    participants: robots.map((runtimeRobot, index) => ({
      robotId: runtimeRobot.id,
      robotDesign: {
        id: `robo_${index + 1}` as RobotDesignId,
        bodyDefinitionId: bodyId,
        programId: program(index + 1).id,
        initialWeaponHand: null,
        equipment: {
          [engineSlotId]: engineId,
          [sensorSlotId]: sensorId,
        },
        ammunition: {},
        metadata: {
          name: `Robot ${index + 1}`,
          author: "",
          description: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      program: program(index + 1),
    })),
    initialRandomSeed: int32(1),
    mapId,
    gameRuleId,
    masterDataVersion: "0.1.1",
    worldState: {
      tick: int32(5),
      robots,
      bullets: [],
      obstacles: [],
      status: "running",
      result: null,
      randomState: { value: int32(10) },
      nextBulletSequence: int32(1),
    },
    ...overrides,
  };
};

const debugInfo = (label: string): AIDebugInfo => ({
  executionTrace: [label],
  terminationReason: label,
  runtimeError: null,
  cpuUsed: int32(1),
  executedNodeCount: int32(1),
});

const repository = (
  definitions: ReadonlyMap<InstructionId, InstructionDefinition> = new Map(),
): DataRepository =>
  ({
    get: (dataType: string, id: string) => {
      if (dataType === "game_rule" && id === gameRuleId) return gameRule;
      if (dataType === "robot_body" && id === bodyId) return body;
      if (dataType === "engine" && id === engineId) return engine;
      if (dataType === "sensor" && id === sensorId) return sensor;
      if (dataType === "map" && id === mapId) return map;
      if (dataType === "instruction")
        return definitions.get(id as InstructionId);
      return undefined;
    },
  }) as unknown as DataRepository;

const scriptedEngine = (
  execute: (input: AIExecutionInput, index: number) => AIExecutionOutput,
): AIEngine => {
  let index = 0;
  return {
    execute: (input) => {
      const result = execute(input, index);
      index += 1;
      return result;
    },
  };
};

describe("updateGameSessionTick", () => {
  it("running以外とTickオーバーフローを入力不変で拒否する", () => {
    const ready = session({
      worldState: { ...session().worldState, status: "ready" },
    });
    const overflow = session({
      worldState: { ...session().worldState, tick: INT32_MAX as Int32 },
    });

    expect(
      updateGameSessionTick(ready, {
        repository: repository(),
        aiEngine: scriptedEngine(() => {
          throw new Error("should not execute");
        }),
      }),
    ).toMatchObject({ success: false, code: "invalid_game_status" });
    expect(
      updateGameSessionTick(overflow, {
        repository: repository(),
        aiEngine: scriptedEngine(() => {
          throw new Error("should not execute");
        }),
      }),
    ).toMatchObject({ success: false, code: "tick_overflow" });
    expect(ready.worldState.status).toBe("ready");
    expect(overflow.worldState.tick).toBe(INT32_MAX);
  });

  it("参加者順にAIを実行し、Random Stateとデバッグ情報を同じ順序で返す", () => {
    const input = session({
      worldState: {
        ...session().worldState,
        robots: [
          robot(1, {
            actionRequests: {
              movement: { type: "forward", distance: int32(999) },
              combat: null,
            },
            actionState: {
              movement: { current: null, next: { type: "stop" } },
              combat: { current: null, next: null },
            },
          }),
          robot(2),
        ],
      },
    });
    const before = structuredClone(input);
    const seen: Array<{
      readonly robotId: RuntimeRobotId;
      readonly randomValue: Int32;
      readonly sensors: AIExecutionInput["executionInput"]["sensors"];
      readonly movementStatus: "idle" | "running";
      readonly previousRequest:
        | AIExecutionInput["executionInput"]["robot"]["actionRequests"]["movement"]
        | null;
    }> = [];

    const result = updateGameSessionTick(input, {
      repository: repository(),
      aiEngine: scriptedEngine(({ executionInput }, index) => {
        seen.push({
          robotId: executionInput.robot.id,
          randomValue: executionInput.randomState.value,
          sensors: executionInput.sensors,
          movementStatus: executionInput.actionStatus.movement,
          previousRequest: executionInput.robot.actionRequests.movement,
        });
        return {
          executionResult: {
            aiRuntimeState: {
              ...executionInput.aiRuntimeState,
              nextNodeId: nodeId(index + 2),
            },
            randomState: { value: int32(index === 0 ? 20 : 30) },
            actionRequests:
              index === 0
                ? {
                    movement: { type: "forward", distance: int32(100) },
                    combat: null,
                  }
                : {
                    movement: null,
                    combat: null,
                  },
          },
          debugInfo: debugInfo(`robot_${index + 1}`),
        };
      }),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(input).toEqual(before);
    expect(seen).toEqual([
      {
        robotId: "robot_1",
        randomValue: 10,
        sensors: {
          robots: [
            {
              id: "robot_2",
              worldPosition: { x: 20, y: 20 },
              relativePosition: { x: 10, y: 10 },
              distance: 14,
              bearing: 45,
              status: "active",
            },
          ],
          bullets: [],
        },
        movementStatus: "running",
        previousRequest: null,
      },
      {
        robotId: "robot_2",
        randomValue: 20,
        sensors: {
          robots: [
            {
              id: "robot_1",
              worldPosition: { x: 10, y: 10 },
              relativePosition: { x: -10, y: -10 },
              distance: 14,
              bearing: 225,
              status: "active",
            },
          ],
          bullets: [],
        },
        movementStatus: "idle",
        previousRequest: null,
      },
    ]);
    expect(result.data.gameSession.worldState.tick).toBe(6);
    expect(result.data.gameSession.worldState.randomState.value).toBe(30);
    expect(
      result.data.gameSession.worldState.robots[0]!.actionRequests,
    ).toEqual({
      movement: { type: "forward", distance: 100 },
      combat: null,
    });
    expect(
      result.data.gameSession.worldState.robots[0]!.actionState.movement
        .current,
    ).toMatchObject({ request: { type: "forward", distance: 100 } });
    expect(
      result.data.gameSession.worldState.robots[1]!.actionState.combat.current,
    ).toBeNull();
    expect(
      result.data.aiDebugInfoByRobot.map(({ robotId }) => robotId),
    ).toEqual(["robot_1", "robot_2"]);
    expect("aiDebugInfoByRobot" in result.data.gameSession.worldState).toBe(
      false,
    );

    const repeat = updateGameSessionTick(before, {
      repository: repository(),
      aiEngine: scriptedEngine(({ executionInput }, index) => ({
        executionResult: {
          aiRuntimeState: {
            ...executionInput.aiRuntimeState,
            nextNodeId: nodeId(index + 2),
          },
          randomState: { value: int32(index === 0 ? 20 : 30) },
          actionRequests:
            index === 0
              ? {
                  movement: { type: "forward", distance: int32(100) },
                  combat: null,
                }
              : {
                  movement: null,
                  combat: null,
                },
        },
        debugInfo: debugInfo(`robot_${index + 1}`),
      })),
    });
    expect(repeat).toEqual(result);
  });

  it("Wait Actionは同一Tick要求と次TickのActionStatusSnapshotの両方で待機する", () => {
    const startId =
      "instruction_00000000-0000-4000-8000-000000000001" as InstructionId;
    const moveId =
      "instruction_00000000-0000-4000-8000-000000000002" as InstructionId;
    const waitId =
      "instruction_00000000-0000-4000-8000-000000000003" as InstructionId;
    const endId =
      "instruction_00000000-0000-4000-8000-000000000004" as InstructionId;
    const definitions = new Map<InstructionId, InstructionDefinition>(
      [
        [startId, "start"],
        [moveId, "move_forward"],
        [waitId, "wait_action"],
        [endId, "end"],
      ].map(([id, implementationId]) => [
        id as InstructionId,
        {
          id: id as InstructionId,
          displayName: implementationId,
          description: "",
          enabled: true,
          implementationId,
          category: "control",
          parameters: [],
          outputPaths: [],
          cpuCost: int32(1),
        } as InstructionDefinition,
      ]),
    );
    const testProgram: Program = {
      ...program(1),
      nodes: [
        {
          id: nodeId(1),
          instructionId: startId,
          parameterValues: {},
          connections: { next: nodeId(2) },
        },
        {
          id: nodeId(2),
          instructionId: moveId,
          parameterValues: { distance: int32(100) },
          connections: { next: nodeId(3) },
        },
        {
          id: nodeId(3),
          instructionId: waitId,
          parameterValues: { category: "movement" },
          connections: { next: nodeId(4) },
        },
        {
          id: nodeId(4),
          instructionId: endId,
          parameterValues: {},
          connections: {},
        },
      ],
      nextNodeSequence: int32(5),
    };
    const input = session({
      participants: [
        {
          ...session().participants[0]!,
          program: testProgram,
        },
      ],
      worldState: {
        ...session().worldState,
        robots: [robot(1)],
      },
    });
    const aiEngine = createAIEngine({
      repository: repository(definitions),
      instructionRegistry: productionInstructionRegistry,
    });

    const first = updateGameSessionTick(input, {
      repository: repository(definitions),
      aiEngine,
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(
      first.data.gameSession.worldState.robots[0]!.actionRequests.movement,
    ).toEqual({ type: "forward", distance: 100 });
    expect(
      first.data.gameSession.worldState.robots[0]!.aiRuntimeState.nextNodeId,
    ).toBe(nodeId(3));
    expect(
      first.data.gameSession.worldState.robots[0]!.actionState.movement.current,
    ).toMatchObject({ request: { type: "forward", distance: 100 } });

    const second = updateGameSessionTick(first.data.gameSession, {
      repository: repository(definitions),
      aiEngine,
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(
      second.data.gameSession.worldState.robots[0]!.aiRuntimeState.nextNodeId,
    ).toBe(nodeId(3));
    expect(
      second.data.gameSession.worldState.robots[0]!.actionRequests.movement,
    ).toBeNull();
  });

  it("Robot単位のAI実行時エラー後も後続RobotとTick更新を継続する", () => {
    const input = session({
      participants: [
        ...session().participants,
        {
          ...session().participants[0]!,
          robotId: robotId(3),
          program: program(3),
        },
      ],
      worldState: {
        ...session().worldState,
        robots: [robot(1), robot(2), robot(3)],
      },
    });

    const result = updateGameSessionTick(input, {
      repository: repository(),
      aiEngine: scriptedEngine(({ executionInput }, index) => ({
        executionResult: {
          aiRuntimeState: {
            ...executionInput.aiRuntimeState,
            nextNodeId: index === 1 ? nodeId(1) : nodeId(index + 2),
          },
          randomState: { value: int32(100 + index) },
          actionRequests:
            index === 2
              ? {
                  movement: { type: "forward", distance: int32(10) },
                  combat: null,
                }
              : createEmptyActionRequests(),
        },
        debugInfo: {
          ...debugInfo(`robot_${index + 1}`),
          runtimeError:
            index === 1
              ? {
                  code: "internal_instruction_error",
                  message: "failed",
                  nodeId: nodeId(2),
                  instructionId:
                    "instruction_00000000-0000-4000-8000-000000000099" as InstructionId,
                }
              : null,
        },
      })),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.gameSession.worldState.tick).toBe(6);
    expect(
      result.data.aiDebugInfoByRobot[1]!.debugInfo.runtimeError?.message,
    ).toBe("failed");
    expect(
      result.data.gameSession.worldState.robots[2]!.actionState.movement
        .current,
    ).toMatchObject({ request: { type: "forward", distance: 10 } });
  });

  it("行動調停できない内部整合性エラーでは入力を変更せずTickを増やさない", () => {
    const input = session({
      worldState: {
        ...session().worldState,
        robots: [
          robot(1, {
            actionState: {
              movement: {
                current: {
                  request: { type: "stop" },
                  phase: "executing",
                  phaseElapsedTicks: int32(0),
                  progress: {},
                },
                next: null,
              },
              combat: { current: null, next: null },
            } as RobotState["actionState"],
          }),
          robot(2),
        ],
      },
    });
    const before = structuredClone(input);

    const result = updateGameSessionTick(input, {
      repository: repository(),
      aiEngine: scriptedEngine(({ executionInput }) => ({
        executionResult: {
          aiRuntimeState: executionInput.aiRuntimeState,
          randomState: executionInput.randomState,
          actionRequests: createEmptyActionRequests(),
        },
        debugInfo: debugInfo("noop"),
      })),
    });

    expect(result).toMatchObject({
      success: false,
      code: "inconsistent_session",
    });
    expect(input).toEqual(before);
  });
});
