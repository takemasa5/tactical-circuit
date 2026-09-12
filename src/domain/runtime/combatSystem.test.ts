import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { ProgramId, RobotDesignId, RuntimeRobotId } from "../data/ids";
import type {
  ProjectileDefinition,
  ProjectileId,
  WeaponDefinition,
  WeaponId,
} from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { Program } from "../program/models";
import type { RobotDesign, SlotId } from "../robotDesign/models";
import { updateCombatAction } from "./combatSystem";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import type { GameSession, RobotState } from "./models";

const int32 = (value: number): Int32 => value as Int32;
const weaponId = "weapon_10000000-0000-4000-8000-000000000004" as WeaponId;
const projectileId =
  "projectile_10000000-0000-4000-8000-000000000005" as ProjectileId;
const weaponSlot = "slot_1" as SlotId;

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

const repository = {
  get: (dataType: string) => {
    if (dataType === "weapon") return weapon;
    if (dataType === "projectile") return projectile;
    return undefined;
  },
} as unknown as DataRepository;

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
  bodyDefinitionId:
    "robot_body_10000000-0000-4000-8000-000000000001" as RobotDesign["bodyDefinitionId"],
  programId: program.id,
  initialWeaponHand: "right",
  equipment: { [weaponSlot]: weaponId },
  ammunition: { [weaponSlot]: int32(2) },
  metadata: {
    name: "Robot",
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const robot = (ammunition = 2): RobotState => ({
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
  selectedWeaponSlotId: weaponSlot,
  ammunition: { [weaponSlot]: int32(ammunition) },
  aiRuntimeState: {
    nextNodeId: program.startNodeId,
    registers: {},
    flags: {},
    callStack: [],
    memory: { values: [] },
  },
  actionRequests: createEmptyActionRequests(),
  actionState: {
    ...createEmptyRobotActionState(),
    combat: {
      current: {
        request: {
          type: "fire",
          targetDirection: int32(90),
          targetPosition: { x: int32(600), y: int32(225) },
        },
        phase: "preparing",
        phaseElapsedTicks: int32(0),
        progress: null,
      },
      next: null,
    },
  },
});

const session = (runtimeRobot: RobotState): GameSession => ({
  participants: [{ robotId: runtimeRobot.id, robotDesign: design, program }],
  initialRandomSeed: int32(1),
  mapId: "map_10000000-0000-4000-8000-000000000006" as GameSession["mapId"],
  gameRuleId:
    "game_rule_10000000-0000-4000-8000-000000000007" as GameSession["gameRuleId"],
  masterDataVersion: "0.1.1",
  worldState: {
    tick: int32(0),
    robots: [runtimeRobot],
    bullets: [],
    obstacles: [],
    status: "running",
    result: null,
    randomState: { value: int32(1) },
    nextBulletSequence: int32(1),
  },
});

describe("updateCombatAction", () => {
  it("Fire採用Tickに残弾を消費してBulletを生成する", () => {
    const input = robot();
    const result = updateCombatAction(
      session(input),
      input,
      int32(1),
      repository,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.createdBullet).toMatchObject({
      id: "bullet_1",
      ownerRobotId: "robot_1",
      position: { x: 200, y: 225 },
      vector: { x: 20, y: 0 },
      remainingLifetimeTicks: 50,
    });
    expect(result.data.robot.ammunition[weaponSlot]).toBe(1);
    expect(result.data.robot.actionState.combat.current).toMatchObject({
      phase: "recovering",
      phaseElapsedTicks: 1,
    });
    expect(result.data.nextBulletSequence).toBe(2);
  });

  it("残弾0でも発射試行後の間隔へ入りBulletを生成しない", () => {
    const input = robot(0);
    const result = updateCombatAction(
      session(input),
      input,
      int32(1),
      repository,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.createdBullet).toBeNull();
    expect(result.data.robot.actionState.combat.current).toMatchObject({
      phase: "recovering",
      phaseElapsedTicks: 1,
    });
    expect(result.data.nextBulletSequence).toBe(1);
  });

  it("発射試行を1 Tick目として10 Tick目にcombatをidleへ戻す", () => {
    let runtimeRobot = robot();
    let result = updateCombatAction(
      session(runtimeRobot),
      runtimeRobot,
      int32(1),
      repository,
    );
    if (!result.success) throw new Error(result.message);
    runtimeRobot = result.data.robot;
    for (let tick = 2; tick <= 10; tick += 1) {
      result = updateCombatAction(
        session(runtimeRobot),
        runtimeRobot,
        result.data.nextBulletSequence,
        repository,
      );
      if (!result.success) throw new Error(result.message);
      runtimeRobot = result.data.robot;
    }
    expect(runtimeRobot.actionState.combat.current).toBeNull();
  });
});
