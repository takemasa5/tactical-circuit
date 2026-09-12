import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { ProgramId, RobotDesignId, RuntimeRobotId } from "../data/ids";
import type {
  RobotBodyDefinition,
  RobotBodyId,
  SensorDefinition,
  SensorId,
} from "../masterData/models";
import {
  createDataRepository,
  type DataRepository,
} from "../masterData/repository";
import type { Program } from "../program/models";
import type { RobotDesign, SlotId } from "../robotDesign/models";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import type { GameSession, RobotState } from "./models";
import { createSensorSnapshot } from "./sensorSystem";

const int32 = (value: number): Int32 => value as Int32;
const bodyId = "robot_body_10000000-0000-4000-8000-000000000001" as RobotBodyId;
const sensorId = "sensor_10000000-0000-4000-8000-000000000003" as SensorId;
const sensorSlot = "slot_3" as SlotId;

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
    { id: sensorSlot, displayName: "Sensor", category: "sensor" },
  ],
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

const repository = (): DataRepository => {
  const result = createDataRepository(
    [
      { dataType: "robot_body", definition: body },
      { dataType: "sensor", definition: sensor },
    ],
    new Set(),
  );
  if (!result.success) throw new Error("test repository is invalid");
  return result.data;
};

const program = (id: string): Program => ({
  id: id as ProgramId,
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
});

const design = (id: string, programId: ProgramId): RobotDesign => ({
  id: id as RobotDesignId,
  bodyDefinitionId: bodyId,
  programId,
  initialWeaponHand: null,
  equipment: { [sensorSlot]: sensorId },
  ammunition: {},
  metadata: {
    name: "Robot",
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
});

const robot = (
  id: RuntimeRobotId,
  robotDesignId: RobotDesignId,
  x: number,
  direction: number,
): RobotState => ({
  id,
  robotDesignId,
  position: { x: int32(x), y: int32(225) },
  direction: int32(direction),
  velocity: { x: int32(0), y: int32(0) },
  currentHp: int32(100),
  energy: int32(100),
  heat: int32(0),
  status: "active",
  partDamage: {},
  selectedWeaponSlotId: null,
  ammunition: {},
  aiRuntimeState: {
    nextNodeId: "node_1" as RobotState["aiRuntimeState"]["nextNodeId"],
    registers: {},
    flags: {},
    callStack: [],
    memory: { values: [] },
  },
  actionRequests: createEmptyActionRequests(),
  actionState: createEmptyRobotActionState(),
});

const session = (): GameSession => {
  const firstProgram = program("program_10000000-0000-4000-8000-000000000010");
  const secondProgram = program("program_10000000-0000-4000-8000-000000000011");
  const firstDesign = design(
    "robo_10000000-0000-4000-8000-000000000012",
    firstProgram.id,
  );
  const secondDesign = design(
    "robo_10000000-0000-4000-8000-000000000013",
    secondProgram.id,
  );
  const robots = [
    robot("robot_1" as RuntimeRobotId, firstDesign.id, 200, 90),
    robot("robot_2" as RuntimeRobotId, secondDesign.id, 600, 270),
  ];
  return {
    participants: [
      {
        robotId: robots[0]!.id,
        robotDesign: firstDesign,
        program: firstProgram,
      },
      {
        robotId: robots[1]!.id,
        robotDesign: secondDesign,
        program: secondProgram,
      },
    ],
    initialRandomSeed: int32(1),
    mapId: "map_10000000-0000-4000-8000-000000000006" as GameSession["mapId"],
    gameRuleId:
      "game_rule_10000000-0000-4000-8000-000000000007" as GameSession["gameRuleId"],
    masterDataVersion: "0.1.1",
    worldState: {
      tick: int32(0),
      robots,
      bullets: [],
      obstacles: [],
      status: "running",
      result: null,
      randomState: { value: int32(1) },
      nextBulletSequence: int32(1),
    },
  };
};

describe("createSensorSnapshot", () => {
  it("検出距離内のactiveな相手機を自機相対情報へ変換する", () => {
    const gameSession = session();
    expect(
      createSensorSnapshot(
        gameSession,
        gameSession.worldState.robots[0]!,
        repository(),
      ),
    ).toEqual({
      success: true,
      data: {
        robots: [
          {
            id: "robot_2",
            worldPosition: { x: 600, y: 225 },
            relativePosition: { x: 0, y: 400 },
            distance: 400,
            bearing: 0,
            status: "active",
          },
        ],
        bullets: [],
      },
    });
  });

  it("destroyedな相手機は検出しない", () => {
    const original = session();
    const gameSession: GameSession = {
      ...original,
      worldState: {
        ...original.worldState,
        robots: original.worldState.robots.map((candidate, index) =>
          index === 1 ? { ...candidate, status: "destroyed" } : candidate,
        ),
      },
    };
    expect(
      createSensorSnapshot(
        gameSession,
        gameSession.worldState.robots[0]!,
        repository(),
      ),
    ).toEqual({ success: true, data: { robots: [], bullets: [] } });
  });
});
