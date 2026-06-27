import { describe, expect, it } from "vitest";

import type { Int32, Size } from "../data/common";
import type { ProgramId, RobotDesignId } from "../data/ids";
import type {
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
import { loadRobotDesign, saveRobotDesign } from "./codec";
import type { RobotDesign, SlotId } from "./models";

const int32 = (value: number): Int32 => value as Int32;
const uuidA = "550e8400-e29b-41d4-a716-446655440000";
const uuidB = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const size: Size = { width: int32(10), height: int32(10) };
const bodyId = `robot_body_${uuidA}` as RobotBodyId;
const weaponId = `weapon_${uuidA}` as WeaponId;
const projectileId = `projectile_${uuidB}` as ProjectileId;
const weaponSlot = "slot_1" as SlotId;

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
  maxAmmunition: int32(5),
  lifetimeTicks: int32(10),
  fireIntervalTicks: int32(1),
  reloadTicks: int32(1),
  heatGeneration: int32(1),
  energyConsumption: int32(1),
  aimSpreadDegree: int32(0),
  weight: int32(10),
  ammunitionWeight: int32(1),
};

const body: RobotBodyDefinition = {
  id: bodyId,
  displayName: "Body",
  description: "",
  enabled: true,
  weight: int32(100),
  maxHp: int32(100),
  maxEnergy: int32(100),
  heatCapacity: int32(100),
  size,
  slots: [
    { id: weaponSlot, displayName: "Weapon", category: "weapon" },
    { id: "slot_2", displayName: "Option", category: "option" },
  ],
};

const repository = (): DataRepository => {
  const entries: MasterDataEntry[] = [
    { dataType: "robot_body", definition: body },
    { dataType: "projectile", definition: projectile },
    { dataType: "weapon", definition: weapon },
  ];
  const result = createDataRepository(entries, new Set());
  if (!result.success) throw new Error("Fixture repository is invalid");
  return result.data;
};

const design = (ammunition = 3): RobotDesign => ({
  id: `robo_${uuidA}` as RobotDesignId,
  bodyDefinitionId: bodyId,
  programId: `program_${uuidB}` as ProgramId,
  equipment: { [weaponSlot]: weaponId },
  ammunition: { [weaponSlot]: int32(ammunition) },
  metadata: {
    name: "Test Robot",
    author: "",
    description: "",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  },
});

describe("RobotDesign codec", () => {
  it("装備と装弾数を検証して読み戻す", () => {
    const loaded = loadRobotDesign(saveRobotDesign(design()), repository());

    expect(loaded.success).toBe(true);
    if (loaded.success) {
      expect(loaded.data.ammunition[weaponSlot]).toBe(3);
    }
  });

  it("空スロットを許容する", () => {
    const loaded = loadRobotDesign(saveRobotDesign(design()), repository());

    expect(loaded.success).toBe(true);
    if (loaded.success) {
      expect(loaded.data.equipment["slot_2" as SlotId]).toBeUndefined();
    }
  });

  it("装弾上限を超えるRobotDesignを拒否する", () => {
    const loaded = loadRobotDesign(saveRobotDesign(design(6)), repository());

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "ammunition_over_capacity",
      );
    }
  });

  it("Weaponスロットの装弾数欠損を拒否する", () => {
    const withoutAmmunition = { ...design(), ammunition: {} };
    const loaded = loadRobotDesign(
      saveRobotDesign(withoutAmmunition),
      repository(),
    );

    expect(loaded.success).toBe(false);
    if (!loaded.success) {
      expect(loaded.errors.map(({ code }) => code)).toContain(
        "missing_ammunition",
      );
    }
  });
});
