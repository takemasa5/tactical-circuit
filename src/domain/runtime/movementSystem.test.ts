import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { ProgramId, RobotDesignId, RuntimeRobotId } from "../data/ids";
import type {
  EngineDefinition,
  EngineId,
  MapDefinition,
  MapId,
  RobotBodyDefinition,
  RobotBodyId,
} from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { Program } from "../program/models";
import type { RobotDesign, SlotId } from "../robotDesign/models";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import { arbitrateRobotActionRequests } from "./actionArbitration";
import type { GameSession, RobotState } from "./models";
import { updateMovementAction } from "./movementSystem";

const int32 = (value: number): Int32 => value as Int32;
const bodyId = "robot_body_10000000-0000-4000-8000-000000000001" as RobotBodyId;
const engineId = "engine_10000000-0000-4000-8000-000000000002" as EngineId;
const mapId = "map_10000000-0000-4000-8000-000000000006" as MapId;
const engineSlot = "slot_4" as SlotId;

const body: RobotBodyDefinition = {
  id: bodyId,
  displayName: "Body",
  description: "",
  enabled: true,
  weight: int32(0),
  maxHp: int32(100),
  maxEnergy: int32(100),
  heatCapacity: int32(100),
  size: { width: int32(40), height: int32(40) },
  slots: [
    {
      id: "slot_1",
      displayName: "Right",
      category: "weapon",
      weaponMount: "right_hand",
    },
    {
      id: "slot_2",
      displayName: "Left",
      category: "weapon",
      weaponMount: "left_hand",
    },
    { id: engineSlot, displayName: "Engine", category: "engine" },
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

const map: MapDefinition = {
  id: mapId,
  displayName: "Map",
  description: "",
  enabled: true,
  size: { width: int32(800), height: int32(450) },
  obstacles: [],
  spawnPoints: [],
};

const repositoryFor = (selectedEngine: EngineDefinition): DataRepository =>
  ({
    get: (dataType: string) => {
      if (dataType === "robot_body") return body;
      if (dataType === "engine") return selectedEngine;
      if (dataType === "map") return map;
      return undefined;
    },
  }) as unknown as DataRepository;

const repository = repositoryFor(engine);

const program: Program = {
  id: "program_10000000-0000-4000-8000-000000000010" as ProgramId,
  nodes: [],
  startNodeId: "node_1" as Program["startNodeId"],
  nextNodeSequence: int32(1),
  metadata: {
    name: "Program",
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  editorState: { nodePositions: {}, comments: {} },
};

const design: RobotDesign = {
  id: "robo_10000000-0000-4000-8000-000000000011" as RobotDesignId,
  bodyDefinitionId: bodyId,
  programId: program.id,
  initialWeaponHand: null,
  equipment: { [engineSlot]: engineId },
  ammunition: {},
  metadata: {
    name: "Robot",
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const baseRobot = (): RobotState => ({
  id: "robot_1" as RuntimeRobotId,
  robotDesignId: design.id,
  position: { x: int32(200), y: int32(225) },
  direction: int32(90),
  velocity: { x: int32(0), y: int32(0) },
  currentHp: int32(100),
  energy: int32(100),
  heat: int32(0),
  status: "active",
  partDamage: {},
  selectedWeaponSlotId: null,
  ammunition: {},
  aiRuntimeState: {
    nextNodeId: program.startNodeId,
    registers: {},
    flags: {},
    callStack: [],
    memory: { values: [] },
  },
  actionRequests: createEmptyActionRequests(),
  actionState: createEmptyRobotActionState(),
});

const session = (robot: RobotState): GameSession => ({
  participants: [{ robotId: robot.id, robotDesign: design, program }],
  initialRandomSeed: int32(1),
  mapId,
  gameRuleId:
    "game_rule_10000000-0000-4000-8000-000000000007" as GameSession["gameRuleId"],
  masterDataVersion: "0.1.1",
  worldState: {
    tick: int32(0),
    robots: [robot],
    bullets: [],
    obstacles: [],
    status: "running",
    result: null,
    randomState: { value: int32(1) },
    nextBulletSequence: int32(1),
  },
});

const update = (
  robot: RobotState,
  activeRepository: DataRepository = repository,
): RobotState => {
  const result = updateMovementAction(session(robot), robot, activeRepository);
  if (!result.success) throw new Error(result.message);
  return result.data;
};

describe("updateMovementAction", () => {
  it("Move Forwardを速度上限で進め、要求距離で終了する", () => {
    let robot: RobotState = {
      ...baseRobot(),
      actionState: {
        ...createEmptyRobotActionState(),
        movement: {
          current: {
            request: { type: "forward", distance: int32(10) },
            phase: "preparing",
            phaseElapsedTicks: int32(0),
            progress: null,
          },
          next: null,
        },
      },
    };

    robot = update(robot);
    expect(robot.position).toEqual({ x: 204, y: 225 });
    expect(robot.actionState.movement.current?.phase).toBe("executing");
    robot = update(robot);
    expect(robot.position).toEqual({ x: 208, y: 225 });
    robot = update(robot);
    expect(robot.position).toEqual({ x: 210, y: 225 });
    expect(robot.velocity).toEqual({ x: 0, y: 0 });
    expect(robot.actionState.movement.current).toBeNull();
  });

  it("Turnを速度上限で進め、目標角度で終了する", () => {
    let robot: RobotState = {
      ...baseRobot(),
      actionState: {
        ...createEmptyRobotActionState(),
        movement: {
          current: {
            request: { type: "turn_right", turnTo: int32(120) },
            phase: "preparing",
            phaseElapsedTicks: int32(0),
            progress: null,
          },
          next: null,
        },
      },
    };

    robot = update(robot);
    expect(robot.direction).toBe(100);
    robot = update(robot);
    expect(robot.direction).toBe(110);
    robot = update(robot);
    expect(robot.direction).toBe(120);
    expect(robot.actionState.movement.current).toBeNull();
  });

  it("Map境界で進めない前進を終了する", () => {
    const robot: RobotState = {
      ...baseRobot(),
      position: { x: int32(780), y: int32(225) },
      actionState: {
        ...createEmptyRobotActionState(),
        movement: {
          current: {
            request: { type: "forward", distance: int32(10) },
            phase: "preparing",
            phaseElapsedTicks: int32(0),
            progress: null,
          },
          next: null,
        },
      },
    };
    const updated = update(robot);
    expect(updated.position).toEqual(robot.position);
    expect(updated.actionState.movement.current).toBeNull();
  });

  it("Turn実動作を前進要求で止め、Engineの予備・事後Tickを適用する", () => {
    const timedRepository = repositoryFor({
      ...engine,
      turnPrepareTicks: int32(1),
      forwardPrepareTicks: int32(2),
      forwardRecoveryTicks: int32(1),
    });
    let robot: RobotState = {
      ...baseRobot(),
      actionState: {
        ...createEmptyRobotActionState(),
        movement: {
          current: {
            request: { type: "turn_right", turnTo: int32(180) },
            phase: "executing",
            phaseElapsedTicks: int32(1),
            progress: { type: "turn_right" },
          },
          next: null,
        },
      },
    };
    const arbitration = arbitrateRobotActionRequests(robot.actionState, {
      movement: { type: "forward", distance: int32(4) },
      combat: null,
    });
    if (!arbitration.success) throw new Error(arbitration.message);
    robot = update(
      { ...robot, actionState: arbitration.data },
      timedRepository,
    );
    expect(robot.direction).toBe(90);
    expect(robot.position.x).toBe(200);
    expect(robot.actionState.movement.current).toMatchObject({
      request: { type: "forward" },
      phase: "preparing",
      phaseElapsedTicks: 1,
    });

    robot = update(robot, timedRepository);
    expect(robot.position.x).toBe(200);
    robot = update(robot, timedRepository);
    expect(robot.position.x).toBe(204);
    expect(robot.actionState.movement.current?.phase).toBe("recovering");
    robot = update(robot, timedRepository);
    expect(robot.actionState.movement.current).toBeNull();
  });

  it("Turnの予備動作1 Tickでは旋回せず、次Tickから旋回する", () => {
    const timedRepository = repositoryFor({
      ...engine,
      turnPrepareTicks: int32(1),
    });
    let robot: RobotState = {
      ...baseRobot(),
      actionState: {
        ...createEmptyRobotActionState(),
        movement: {
          current: {
            request: { type: "turn_right", turnTo: int32(100) },
            phase: "preparing",
            phaseElapsedTicks: int32(0),
            progress: null,
          },
          next: null,
        },
      },
    };
    robot = update(robot, timedRepository);
    expect(robot.direction).toBe(90);
    expect(robot.actionState.movement.current).toMatchObject({
      phase: "preparing",
      phaseElapsedTicks: 1,
    });
    robot = update(robot, timedRepository);
    expect(robot.direction).toBe(100);
    expect(robot.actionState.movement.current).toBeNull();
  });

  it("前進をTurnでキャンセルしたTickは前進せず、事後・予備動作後に旋回する", () => {
    const timedRepository = repositoryFor({
      ...engine,
      forwardRecoveryTicks: int32(1),
      turnPrepareTicks: int32(1),
    });
    let robot: RobotState = {
      ...baseRobot(),
      actionState: {
        ...createEmptyRobotActionState(),
        movement: {
          current: {
            request: { type: "forward", distance: int32(20) },
            phase: "executing",
            phaseElapsedTicks: int32(1),
            progress: {
              type: "forward",
              fixedPosition: { x: int32(200000), y: int32(225000) },
              fixedMovedDistance: int32(0),
            },
          },
          next: null,
        },
      },
    };
    const arbitration = arbitrateRobotActionRequests(robot.actionState, {
      movement: { type: "turn_right", turnTo: int32(100) },
      combat: null,
    });
    if (!arbitration.success) throw new Error(arbitration.message);
    robot = update(
      { ...robot, actionState: arbitration.data },
      timedRepository,
    );
    expect(robot.position).toEqual({ x: 200, y: 225 });
    expect(robot.actionState.movement.current).toMatchObject({
      request: { type: "turn_right" },
      phase: "preparing",
      phaseElapsedTicks: 0,
    });

    robot = update(robot, timedRepository);
    expect(robot.direction).toBe(90);
    robot = update(robot, timedRepository);
    expect(robot.direction).toBe(100);
  });
});
