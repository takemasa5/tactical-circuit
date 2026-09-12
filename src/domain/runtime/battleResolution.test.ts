import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { ProgramId, RobotDesignId, RuntimeRobotId } from "../data/ids";
import type {
  GameRuleDefinition,
  MapDefinition,
  ProjectileDefinition,
  RobotBodyDefinition,
  WeaponDefinition,
} from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { Program } from "../program/models";
import type { RobotDesign } from "../robotDesign/models";
import { resolveBattleTick } from "./battleResolution";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import type { BulletState, GameSession, RobotState } from "./models";

const int32 = (value: number): Int32 => value as Int32;
const bodyId =
  "robot_body_10000000-0000-4000-8000-000000000001" as RobotBodyDefinition["id"];
const projectileId =
  "projectile_10000000-0000-4000-8000-000000000005" as ProjectileDefinition["id"];
const weaponId =
  "weapon_10000000-0000-4000-8000-000000000004" as WeaponDefinition["id"];
const mapId = "map_10000000-0000-4000-8000-000000000006" as MapDefinition["id"];
const gameRuleId =
  "game_rule_10000000-0000-4000-8000-000000000007" as GameRuleDefinition["id"];

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
  slots: [],
};

const projectile: ProjectileDefinition = {
  id: projectileId,
  displayName: "Projectile",
  description: "",
  enabled: true,
  speed: int32(20),
  size: { width: int32(8), height: int32(8) },
  explosionRadius: int32(0),
  explosionDamage: int32(0),
};

const weapon: WeaponDefinition = {
  id: weaponId,
  displayName: "Weapon",
  description: "",
  enabled: true,
  projectileId,
  damage: int32(25),
  maxAmmunition: int32(12),
  lifetimeTicks: int32(50),
  fireIntervalTicks: int32(10),
  reloadTicks: int32(0),
  heatGeneration: int32(0),
  energyConsumption: int32(0),
  aimSpreadDegree: int32(0),
  weight: int32(0),
  ammunitionWeight: int32(0),
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

const gameRule: GameRuleDefinition = {
  id: gameRuleId,
  displayName: "Rule",
  description: "",
  enabled: true,
  cpuLimit: int32(100),
  tickLimit: int32(600),
  participantCount: int32(2),
  registerNames: ["A"],
  flagNames: ["F1"],
  memorySize: int32(1),
  callStackSize: int32(1),
};

const repository = {
  get: (dataType: string) => {
    if (dataType === "robot_body") return body;
    if (dataType === "projectile") return projectile;
    if (dataType === "weapon") return weapon;
    if (dataType === "map") return map;
    if (dataType === "game_rule") return gameRule;
    return undefined;
  },
} as unknown as DataRepository;

const program = (sequence: number): Program => ({
  id: `program_10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as ProgramId,
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

const design = (sequence: number, programId: ProgramId): RobotDesign => ({
  id: `robo_10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as RobotDesignId,
  bodyDefinitionId: bodyId,
  programId,
  initialWeaponHand: null,
  equipment: {},
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
  sequence: number,
  x: number,
  hp = 100,
  status: RobotState["status"] = "active",
): RobotState => ({
  id: `robot_${sequence}` as RuntimeRobotId,
  robotDesignId:
    `robo_10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as RobotDesignId,
  position: { x: int32(x), y: int32(225) },
  direction: int32(sequence === 1 ? 90 : 270),
  velocity: { x: int32(0), y: int32(0) },
  currentHp: int32(hp),
  energy: int32(100),
  heat: int32(0),
  status,
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

const bullet = (
  sequence: number,
  owner: number,
  x: number,
  velocityX: number,
): BulletState => ({
  id: `bullet_${sequence}` as BulletState["id"],
  ownerRobotId: `robot_${owner}` as RuntimeRobotId,
  weaponId,
  projectileId,
  position: { x: int32(x), y: int32(225) },
  vector: { x: int32(velocityX), y: int32(0) },
  remainingLifetimeTicks: int32(50),
});

const session = (
  robots: readonly RobotState[],
  bullets: readonly BulletState[],
  tick = 0,
): GameSession => {
  const programs = [program(1), program(2)];
  const designs = [design(1, programs[0]!.id), design(2, programs[1]!.id)];
  return {
    participants: robots.map((runtimeRobot, index) => ({
      robotId: runtimeRobot.id,
      robotDesign: designs[index]!,
      program: programs[index]!,
    })),
    initialRandomSeed: int32(1),
    mapId,
    gameRuleId,
    masterDataVersion: "0.1.1",
    worldState: {
      tick: int32(tick),
      robots,
      bullets,
      obstacles: [],
      status: "running",
      result: null,
      randomState: { value: int32(1) },
      nextBulletSequence: int32(bullets.length + 1),
    },
  };
};

describe("resolveBattleTick", () => {
  it("既存Bulletを移動して命中Damageを適用する", () => {
    const input = session(
      [robot(1, 200), robot(2, 600)],
      [bullet(1, 1, 560, 20)],
    );
    const result = resolveBattleTick(
      input,
      input.worldState,
      new Set(["bullet_1" as BulletState["id"]]),
      repository,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tick).toBe(1);
    expect(result.data.bullets).toEqual([]);
    expect(result.data.robots[1]!.currentHp).toBe(75);
    expect(result.data.status).toBe("running");
  });

  it("同じTickに生成されたBulletは移動しない", () => {
    const input = session(
      [robot(1, 200), robot(2, 600)],
      [bullet(1, 1, 200, 20)],
    );
    const result = resolveBattleTick(
      input,
      input.worldState,
      new Set(),
      repository,
    );
    expect(result.success && result.data.bullets[0]!.position).toEqual({
      x: 200,
      y: 225,
    });
  });

  it("同一TickのDamageを同時適用して相互撃破にする", () => {
    const input = session(
      [robot(1, 200, 25), robot(2, 600, 25)],
      [bullet(1, 1, 560, 20), bullet(2, 2, 240, -20)],
    );
    const result = resolveBattleTick(
      input,
      input.worldState,
      new Set(input.worldState.bullets.map(({ id }) => id)),
      repository,
    );
    expect(result.success && result.data).toMatchObject({
      status: "finished",
      result: { winnerRobotIds: [], reason: "mutual_destruction" },
      robots: [{ status: "destroyed" }, { status: "destroyed" }],
    });
  });

  it("撃破済みRobotの残存Bulletによる相互撃破を待つ", () => {
    const input = session(
      [robot(1, 200, 0, "destroyed"), robot(2, 600, 25)],
      [bullet(1, 1, 560, 20)],
    );
    const result = resolveBattleTick(
      input,
      input.worldState,
      new Set(input.worldState.bullets.map(({ id }) => id)),
      repository,
    );
    expect(result.success && result.data.result).toEqual({
      winnerRobotIds: [],
      reason: "mutual_destruction",
    });
  });

  it("Tick上限を残HPとBulletより優先して引き分けにする", () => {
    const input = session(
      [robot(1, 200), robot(2, 600)],
      [bullet(1, 1, 200, 20)],
      599,
    );
    const result = resolveBattleTick(
      input,
      input.worldState,
      new Set(),
      repository,
    );
    expect(result.success && result.data).toMatchObject({
      tick: 600,
      status: "finished",
      result: { winnerRobotIds: [], reason: "tick_limit" },
    });
  });
});
