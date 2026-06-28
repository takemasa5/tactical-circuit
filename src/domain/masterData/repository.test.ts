import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type {
  InstructionDefinition,
  InstructionId,
  ParameterDefinition,
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

const parameter = (
  overrides: Partial<ParameterDefinition> = {},
): ParameterDefinition => ({
  id: "value",
  displayName: "Value",
  description: "",
  valueType: "count",
  required: false,
  ...overrides,
});

const instruction = (
  parameters: readonly ParameterDefinition[],
): InstructionDefinition => ({
  id: `instruction_${uuidA}` as InstructionId,
  displayName: "Test Instruction",
  description: "",
  enabled: true,
  implementationId: "test_instruction",
  category: "arithmetic",
  parameters,
  outputPaths: [],
  cpuCost: int32(1),
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

  it("Master Data IDをロケール非依存の文字列昇順で公開する", () => {
    const uppercaseId =
      "projectile_AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA" as ProjectileId;
    const lowercaseId =
      "projectile_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" as ProjectileId;
    const result = createDataRepository(
      [
        entry({
          dataType: "projectile",
          definition: projectile(lowercaseId),
        }),
        entry({
          dataType: "projectile",
          definition: projectile(uppercaseId),
        }),
      ],
      new Set(),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.getAll("projectile").map(({ id }) => id)).toEqual([
        uppercaseId,
        lowercaseId,
      ]);
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

  it.each([
    ["型が異なる", parameter({ valueType: "degree", defaultValue: "left" })],
    [
      "最小値を下回る",
      parameter({ defaultValue: int32(4), minValue: int32(5) }),
    ],
    [
      "最大値を上回る",
      parameter({ defaultValue: int32(6), maxValue: int32(5) }),
    ],
    [
      "未知の列挙値である",
      parameter({
        valueType: "enum",
        defaultValue: "left",
        enumValues: ["right"],
      }),
    ],
    [
      "参照形式が不正である",
      parameter({
        valueType: "register_reference",
        defaultValue: { type: "register_reference", registerName: "" },
      }),
    ],
  ])("既定値の%sParameter Definitionを拒否する", (_, invalidParameter) => {
    const result = createDataRepository(
      [
        entry({
          dataType: "instruction",
          definition: instruction([invalidParameter]),
        }),
      ],
      new Set(["test_instruction"]),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(
        "invalid_parameter_default",
      );
    }
  });

  it("最小値が最大値を超えるParameter Definitionを拒否する", () => {
    const result = createDataRepository(
      [
        entry({
          dataType: "instruction",
          definition: instruction([
            parameter({ minValue: int32(10), maxValue: int32(1) }),
          ]),
        }),
      ],
      new Set(["test_instruction"]),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(
        "invalid_parameter_range",
      );
    }
  });

  it("重複する列挙値を拒否する", () => {
    const result = createDataRepository(
      [
        entry({
          dataType: "instruction",
          definition: instruction([
            parameter({ valueType: "enum", enumValues: ["left", "left"] }),
          ]),
        }),
      ],
      new Set(["test_instruction"]),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(
        "duplicate_enum_value",
      );
    }
  });

  it("存在しないMaster Dataを参照する既定値を拒否する", () => {
    const result = createDataRepository(
      [
        entry({
          dataType: "instruction",
          definition: instruction([
            parameter({
              valueType: "master_data_reference",
              referenceDataType: "projectile",
              defaultValue: {
                type: "master_data_reference",
                dataType: "projectile",
                id: `projectile_${uuidB}`,
              },
            }),
          ]),
        }),
      ],
      new Set(["test_instruction"]),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(
        "invalid_parameter_default",
      );
    }
  });

  it("型と制約に適合する既定値を受け付ける", () => {
    const validParameters = [
      parameter({
        id: "count",
        defaultValue: int32(5),
        minValue: int32(0),
        maxValue: int32(10),
      }),
      parameter({ id: "degree", valueType: "degree", defaultValue: int32(90) }),
      parameter({ id: "enabled", valueType: "boolean", defaultValue: false }),
      parameter({
        id: "direction",
        valueType: "enum",
        defaultValue: "left",
        enumValues: ["left", "right"],
      }),
      parameter({
        id: "register",
        valueType: "register_reference",
        defaultValue: { type: "register_reference", registerName: "A" },
      }),
      parameter({
        id: "flag",
        valueType: "flag_reference",
        defaultValue: { type: "flag_reference", flagName: "F1" },
      }),
      parameter({
        id: "memory",
        valueType: "memory_reference",
        defaultValue: {
          type: "memory_reference",
          indexRegisterName: "A",
        },
      }),
      parameter({
        id: "node",
        valueType: "node_reference",
        defaultValue: { type: "node_reference", nodeId: "node_1" },
      }),
      parameter({
        id: "projectile",
        valueType: "master_data_reference",
        referenceDataType: "projectile",
        defaultValue: {
          type: "master_data_reference",
          dataType: "projectile",
          id: `projectile_${uuidA}`,
        },
      }),
    ];
    const result = createDataRepository(
      [
        entry({
          dataType: "instruction",
          definition: instruction(validParameters),
        }),
        entry({ dataType: "projectile", definition: projectile() }),
      ],
      new Set(["test_instruction"]),
    );

    expect(result.success).toBe(true);
  });
});
