import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type {
  NodeId,
  ProgramId,
  ReplayId,
  RobotDesignId,
  RuntimeRobotId,
} from "../data/ids";
import type {
  GameRuleDefinition,
  GameRuleId,
  InstructionId,
  MapDefinition,
  MapId,
  ProjectileDefinition,
  ProjectileId,
  RobotBodyDefinition,
  RobotBodyId,
  WeaponDefinition,
  WeaponId,
} from "../masterData/models";
import {
  createDataRepository,
  type DataRepository,
  type MasterDataEntry,
} from "../masterData/repository";
import type { Program } from "../program/models";
import type { RobotDesign } from "../robotDesign/models";
import type { BulletState, RobotState, WorldState } from "../runtime/models";
import { loadReplay, saveReplay } from "./codec";
import type { ReplaySaveData } from "./models";

const int32 = (value: number): Int32 => value as Int32;
const uuidA = "550e8400-e29b-41d4-a716-446655440000";
const uuidB = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const bodyId = `robot_body_${uuidA}` as RobotBodyId;
const mapId = `map_${uuidA}` as MapId;
const gameRuleId = `game_rule_${uuidA}` as GameRuleId;
const designId = `robo_${uuidA}` as RobotDesignId;
const programId = `program_${uuidA}` as ProgramId;
const robotId = "robot_1" as RuntimeRobotId;
const weaponId = `weapon_${uuidA}` as WeaponId;
const projectileId = `projectile_${uuidA}` as ProjectileId;

const body: RobotBodyDefinition = {
  id: bodyId,
  displayName: "Body",
  description: "",
  enabled: true,
  weight: int32(100),
  maxHp: int32(100),
  maxEnergy: int32(100),
  heatCapacity: int32(100),
  size: { width: int32(10), height: int32(10) },
  slots: [],
};

const map: MapDefinition = {
  id: mapId,
  displayName: "Map",
  description: "",
  enabled: true,
  size: { width: int32(100), height: int32(100) },
  obstacles: [],
  spawnPoints: [
    { position: { x: int32(10), y: int32(10) }, direction: int32(0) },
    { position: { x: int32(90), y: int32(90) }, direction: int32(180) },
  ],
};

const gameRule: GameRuleDefinition = {
  id: gameRuleId,
  displayName: "Rule",
  description: "",
  enabled: true,
  cpuLimit: int32(100),
  tickLimit: int32(1_000),
  participantCount: int32(2),
  registerNames: ["A", "B", "C", "D"],
  flagNames: ["F1", "F2", "F3"],
  memorySize: int32(20),
  callStackSize: int32(20),
};

const projectile: ProjectileDefinition = {
  id: projectileId,
  displayName: "Projectile",
  description: "",
  enabled: true,
  speed: int32(10),
  size: { width: int32(1), height: int32(1) },
  explosionRadius: int32(0),
  explosionDamage: int32(0),
};

const weapon: WeaponDefinition = {
  id: weaponId,
  displayName: "Weapon",
  description: "",
  enabled: true,
  projectileId,
  damage: int32(10),
  maxAmmunition: int32(1),
  lifetimeTicks: int32(10),
  fireIntervalTicks: int32(1),
  reloadTicks: int32(1),
  heatGeneration: int32(1),
  energyConsumption: int32(1),
  aimSpreadDegree: int32(0),
  weight: int32(1),
  ammunitionWeight: int32(1),
};

const repository = (): DataRepository => {
  const entries: MasterDataEntry[] = [
    { dataType: "robot_body", definition: body },
    { dataType: "map", definition: map },
    { dataType: "game_rule", definition: gameRule },
    { dataType: "projectile", definition: projectile },
    { dataType: "weapon", definition: weapon },
  ];
  const result = createDataRepository(entries, new Set());
  if (!result.success) throw new Error("Fixture repository is invalid");
  return result.data;
};

const program: Program = {
  id: programId,
  nodes: [
    {
      id: "node_1" as NodeId,
      instructionId: `instruction_${uuidB}` as InstructionId,
      parameterValues: {},
      connections: {},
    },
  ],
  startNodeId: "node_1" as NodeId,
  nextNodeSequence: int32(2),
  metadata: {
    name: "Program",
    author: "",
    description: "",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  },
  editorState: { nodePositions: {}, comments: {} },
};

const design: RobotDesign = {
  id: designId,
  bodyDefinitionId: bodyId,
  programId,
  equipment: {},
  ammunition: {},
  metadata: {
    name: "Robot",
    author: "",
    description: "",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  },
};

const robot: RobotState = {
  id: robotId,
  robotDesignId: designId,
  position: { x: int32(10), y: int32(10) },
  direction: int32(450),
  velocity: { x: int32(0), y: int32(0) },
  currentHp: int32(100),
  energy: int32(100),
  heat: int32(0),
  status: "active",
  partDamage: {},
  selectedWeaponSlotId: null,
  ammunition: {},
  aiRuntimeState: {
    nextNodeId: "node_1" as NodeId,
    registers: { A: int32(0), B: int32(0), C: int32(0), D: int32(0) },
    flags: { F1: false, F2: false, F3: false },
    callStack: [],
    memory: { values: Array.from({ length: 20 }, () => int32(0)) },
  },
  actionRequests: { movement: null, switching: null, attack: null },
};

const worldState: WorldState = {
  tick: int32(0),
  robots: [robot],
  bullets: [],
  obstacles: [],
  status: "running",
  result: null,
  randomState: { value: int32(1) },
  nextBulletSequence: int32(1),
};

const bullet = (ownerRobotId: RuntimeRobotId): BulletState => ({
  id: "bullet_1" as BulletState["id"],
  ownerRobotId,
  weaponId,
  projectileId,
  position: { x: int32(10), y: int32(10) },
  vector: { x: int32(1), y: int32(0) },
  remainingLifetimeTicks: int32(10),
});

const replay = (): ReplaySaveData => ({
  replayData: {
    id: `replay_${uuidA}` as ReplayId,
    initialWorldState: worldState,
    frames: [
      {
        tick: int32(1),
        events: [
          {
            type: "random_state_updated",
            randomState: { value: int32(2) },
          },
        ],
      },
    ],
  },
  robotDesigns: [design],
  programs: [program],
  mapId,
  gameRuleId,
  initialRandomSeed: int32(1),
  masterDataVersion: "0.1.1",
});

describe("Replay codec", () => {
  it("Replayを保存して読み戻し、JSON保存角度を正規化する", () => {
    const loaded = loadReplay(saveReplay(replay()), "0.1.1", repository());

    expect(loaded.success).toBe(true);
    if (loaded.success) {
      expect(
        loaded.data.replayData.initialWorldState.robots[0]?.direction,
      ).toBe(90);
    }
  });

  it("Master Data versionの不一致を拒否する", () => {
    const loaded = loadReplay(saveReplay(replay()), "0.2.1", repository());

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "master_data_version_mismatch",
      );
    }
  });

  it("Replay FrameのTick逆転を拒否する", () => {
    const invalid = replay();
    const loaded = loadReplay(
      saveReplay({
        ...invalid,
        replayData: {
          ...invalid.replayData,
          frames: [
            ...invalid.replayData.frames,
            { tick: int32(0), events: [] },
          ],
        },
      }),
      "0.1.1",
      repository(),
    );

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "invalid_replay_tick_order",
      );
    }
  });

  it("初期Bulletの発射元Robotが存在しないReplayを拒否する", () => {
    const invalid = replay();
    const loaded = loadReplay(
      saveReplay({
        ...invalid,
        replayData: {
          ...invalid.replayData,
          initialWorldState: {
            ...invalid.replayData.initialWorldState,
            bullets: [bullet("robot_99" as RuntimeRobotId)],
          },
        },
      }),
      "0.1.1",
      repository(),
    );

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "missing_replay_bullet_owner",
      );
    }
  });

  it("Bullet生成イベントの発射元Robotが存在しないReplayを拒否する", () => {
    const invalid = replay();
    const loaded = loadReplay(
      saveReplay({
        ...invalid,
        replayData: {
          ...invalid.replayData,
          frames: [
            {
              tick: int32(1),
              events: [
                {
                  type: "bullet_created",
                  bullet: bullet("robot_99" as RuntimeRobotId),
                },
              ],
            },
          ],
        },
      }),
      "0.1.1",
      repository(),
    );

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "missing_replay_bullet_owner",
      );
    }
  });

  it("更新対象Robotが初期World Stateに存在しないReplayを拒否する", () => {
    const invalid = replay();
    const loaded = loadReplay(
      saveReplay({
        ...invalid,
        replayData: {
          ...invalid.replayData,
          frames: [
            {
              tick: int32(1),
              events: [
                {
                  type: "robot_updated",
                  robot: {
                    ...robot,
                    id: "robot_99" as RuntimeRobotId,
                  },
                },
              ],
            },
          ],
        },
      }),
      "0.1.1",
      repository(),
    );

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "missing_replay_robot",
      );
    }
  });
});
