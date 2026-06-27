import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type {
  ProjectileDefinition,
  ProjectileId,
  WeaponDefinition,
  WeaponId,
} from "./models";
import { createDataRepository, type MasterDataEntry } from "./repository";

const int32 = (value: number): Int32 => value as Int32;
const uuidA = "550e8400-e29b-41d4-a716-446655440000";
const uuidB = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

const projectile = (
  id = `projectile_${uuidA}` as ProjectileId,
): ProjectileDefinition => ({
  id,
  displayName: "Test Projectile",
  description: "",
  enabled: true,
  speed: int32(10),
  size: { width: int32(1), height: int32(1) },
  explosionRadius: int32(0),
  explosionDamage: int32(0),
});

const weapon = (
  projectileId = `projectile_${uuidA}` as ProjectileId,
): WeaponDefinition => ({
  id: `weapon_${uuidB}` as WeaponId,
  displayName: "Test Weapon",
  description: "",
  enabled: true,
  projectileId,
  damage: int32(10),
  maxAmmunition: int32(5),
  lifetimeTicks: int32(20),
  fireIntervalTicks: int32(1),
  reloadTicks: int32(10),
  heatGeneration: int32(1),
  energyConsumption: int32(1),
  aimSpreadDegree: int32(0),
  weight: int32(10),
  ammunitionWeight: int32(1),
});

const entry = <TEntry extends MasterDataEntry>(value: TEntry): TEntry => value;

describe("Data Repository", () => {
  it("参照を解決してID順で読み取り専用データを公開する", () => {
    const secondProjectile = projectile(`projectile_${uuidB}` as ProjectileId);
    const result = createDataRepository(
      [
        entry({ dataType: "projectile", definition: secondProjectile }),
        entry({ dataType: "weapon", definition: weapon() }),
        entry({ dataType: "projectile", definition: projectile() }),
      ],
      new Set(),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.getAll("projectile").map(({ id }) => id)).toEqual([
        `projectile_${uuidA}`,
        `projectile_${uuidB}`,
      ]);
      expect(
        Object.isFrozen(result.data.get("weapon", `weapon_${uuidB}`)),
      ).toBe(true);
    }
  });

  it("存在しないProjectile参照を拒否する", () => {
    const result = createDataRepository(
      [entry({ dataType: "weapon", definition: weapon() })],
      new Set(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(
        "missing_master_data_reference",
      );
    }
  });

  it("Data Repository全体のID重複を拒否する", () => {
    const duplicate = projectile();
    const result = createDataRepository(
      [
        entry({ dataType: "projectile", definition: projectile() }),
        entry({ dataType: "projectile", definition: duplicate }),
      ],
      new Set(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(
        "duplicate_master_data_id",
      );
    }
  });

  it("照準ブレ角度の範囲外を拒否する", () => {
    const invalidWeapon = { ...weapon(), aimSpreadDegree: int32(360) };
    const result = createDataRepository(
      [
        entry({ dataType: "projectile", definition: projectile() }),
        entry({ dataType: "weapon", definition: invalidWeapon }),
      ],
      new Set(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain("invalid_angle");
    }
  });
});
