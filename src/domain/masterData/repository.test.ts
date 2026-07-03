import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type {
  InstructionDefinition,
  InstructionId,
  MapDefinition,
  MapId,
  ParameterDefinition,
  ProjectileDefinition,
  ProjectileId,
  RobotBodyDefinition,
  RobotBodyId,
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

const robotBody = (
  slots: RobotBodyDefinition["slots"] = [
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
  ],
  size: RobotBodyDefinition["size"] = {
    width: int32(10),
    height: int32(10),
  },
): RobotBodyDefinition => ({
  id: `robot_body_${uuidA}` as RobotBodyId,
  displayName: "Test Body",
  description: "",
  enabled: true,
  weight: int32(100),
  maxHp: int32(100),
  maxEnergy: int32(100),
  heatCapacity: int32(100),
  size,
  slots,
});

const mapDefinition = (
  overrides: Partial<MapDefinition> = {},
): MapDefinition => ({
  id: `map_${uuidA}` as MapId,
  displayName: "Test Map",
  description: "",
  enabled: true,
  size: { width: int32(100), height: int32(100) },
  obstacles: [],
  spawnPoints: [],
  ...overrides,
});

describe("Data Repository", () => {
  it("Robot Bodyの右手・左手Weapon Slotを受け付ける", () => {
    const result = createDataRepository(
      [
        entry({
          dataType: "robot_body",
          definition: robotBody([
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
          ]),
        }),
      ],
      new Set(),
    );

    expect(result.success).toBe(true);
  });

  it("Robot Bodyの最大幅と最大高さを独立に使ってSpawn Pointを検証する", () => {
    const result = createDataRepository(
      [
        entry({
          dataType: "robot_body",
          definition: robotBody(undefined, {
            width: int32(20),
            height: int32(4),
          }),
        }),
        entry({
          dataType: "robot_body",
          definition: {
            ...robotBody(undefined, {
              width: int32(4),
              height: int32(30),
            }),
            id: `robot_body_${uuidB}` as RobotBodyId,
          },
        }),
        entry({
          dataType: "map",
          definition: mapDefinition({
            spawnPoints: [
              { position: { x: int32(10), y: int32(15) }, direction: int32(0) },
            ],
          }),
        }),
      ],
      new Set(),
    );

    expect(result.success).toBe(true);
  });

  it("Spawn Pointを持つMapにRobot Bodyがない場合は拒否する", () => {
    const result = createDataRepository(
      [
        entry({
          dataType: "map",
          definition: mapDefinition({
            spawnPoints: [
              { position: { x: int32(50), y: int32(50) }, direction: int32(0) },
            ],
          }),
        }),
      ],
      new Set(),
    );

    expect(result).toMatchObject({
      success: false,
      errors: [
        {
          code: "missing_robot_body_definition",
          path: "/definitions/0/spawnPoints",
        },
      ],
    });
  });

  it("Spawn PointがないMapはRobot Bodyがなくても受け付ける", () => {
    const result = createDataRepository(
      [entry({ dataType: "map", definition: mapDefinition() })],
      new Set(),
    );

    expect(result.success).toBe(true);
  });

  it.each([
    [
      "Map外のSpawn Point",
      mapDefinition({
        spawnPoints: [
          { position: { x: int32(4), y: int32(50) }, direction: int32(0) },
        ],
      }),
      "spawn_point_outside_map",
      "/definitions/1/spawnPoints/0",
    ],
    [
      "Obstacleと重複するSpawn Point",
      mapDefinition({
        obstacles: [
          {
            id: "obstacle_1",
            position: { x: int32(50), y: int32(50) },
            size: { width: int32(10), height: int32(10) },
          },
        ],
        spawnPoints: [
          { position: { x: int32(50), y: int32(50) }, direction: int32(0) },
        ],
      }),
      "spawn_point_overlaps_obstacle",
      "/definitions/1/spawnPoints/0",
    ],
    [
      "重複するSpawn Point",
      mapDefinition({
        spawnPoints: [
          { position: { x: int32(50), y: int32(50) }, direction: int32(0) },
          { position: { x: int32(59), y: int32(50) }, direction: int32(0) },
        ],
      }),
      "spawn_points_overlap",
      "/definitions/1/spawnPoints/1",
    ],
    [
      "Map外のObstacle",
      mapDefinition({
        obstacles: [
          {
            id: "obstacle_1",
            position: { x: int32(4), y: int32(50) },
            size: { width: int32(10), height: int32(10) },
          },
        ],
      }),
      "obstacle_outside_map",
      "/definitions/1/obstacles/0",
    ],
  ])("%sをパス付きErrorで拒否する", (_, definition, code, path) => {
    const result = createDataRepository(
      [
        entry({ dataType: "robot_body", definition: robotBody() }),
        entry({ dataType: "map", definition }),
      ],
      new Set(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code, path })]),
      );
    }
  });

  it("Map境界、Obstacle、別Spawn Pointへの辺・頂点接触を受け付ける", () => {
    const result = createDataRepository(
      [
        entry({ dataType: "robot_body", definition: robotBody() }),
        entry({
          dataType: "map",
          definition: mapDefinition({
            obstacles: [
              {
                id: "obstacle_1",
                position: { x: int32(20), y: int32(20) },
                size: { width: int32(10), height: int32(10) },
              },
            ],
            spawnPoints: [
              { position: { x: int32(5), y: int32(95) }, direction: int32(0) },
              { position: { x: int32(10), y: int32(10) }, direction: int32(0) },
              { position: { x: int32(20), y: int32(10) }, direction: int32(0) },
            ],
          }),
        }),
      ],
      new Set(),
    );

    expect(result.success).toBe(true);
  });

  it("奇数サイズを2倍座標で比較し、面積重複だけを拒否する", () => {
    const touching = createDataRepository(
      [
        entry({
          dataType: "robot_body",
          definition: robotBody(undefined, {
            width: int32(3),
            height: int32(3),
          }),
        }),
        entry({
          dataType: "map",
          definition: mapDefinition({
            spawnPoints: [
              { position: { x: int32(10), y: int32(10) }, direction: int32(0) },
              { position: { x: int32(13), y: int32(10) }, direction: int32(0) },
            ],
          }),
        }),
      ],
      new Set(),
    );
    const overlapping = createDataRepository(
      [
        entry({
          dataType: "robot_body",
          definition: robotBody(undefined, {
            width: int32(3),
            height: int32(3),
          }),
        }),
        entry({
          dataType: "map",
          definition: mapDefinition({
            spawnPoints: [
              { position: { x: int32(10), y: int32(10) }, direction: int32(0) },
              { position: { x: int32(12), y: int32(10) }, direction: int32(0) },
            ],
          }),
        }),
      ],
      new Set(),
    );

    expect(touching.success).toBe(true);
    expect(overlapping.success).toBe(false);
    if (!overlapping.success) {
      expect(overlapping.errors.map(({ code }) => code)).toContain(
        "spawn_points_overlap",
      );
    }
  });

  it("2倍座標が安全整数を超える入力を丸めず拒否する", () => {
    const unsafeCoordinate = (Number.MAX_SAFE_INTEGER / 2 + 1) as Int32;
    const result = createDataRepository(
      [
        entry({ dataType: "robot_body", definition: robotBody() }),
        entry({
          dataType: "map",
          definition: mapDefinition({
            spawnPoints: [
              {
                position: { x: unsafeCoordinate, y: int32(50) },
                direction: int32(0),
              },
            ],
          }),
        }),
      ],
      new Set(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "unsafe_aabb_coordinate",
            path: "/definitions/1/spawnPoints/0",
          }),
        ]),
      );
    }
  });

  it.each([
    [
      "片方がない",
      [
        {
          id: "slot_1",
          displayName: "Right",
          category: "weapon" as const,
          weaponMount: "right_hand" as const,
        },
      ],
      "missing_weapon_mount",
    ],
    [
      "装備位置が重複する",
      [
        {
          id: "slot_1",
          displayName: "Right 1",
          category: "weapon" as const,
          weaponMount: "right_hand" as const,
        },
        {
          id: "slot_2",
          displayName: "Right 2",
          category: "weapon" as const,
          weaponMount: "right_hand" as const,
        },
      ],
      "duplicate_local_id",
    ],
  ])("Weapon Slotの%sRobot Bodyを拒否する", (_, slots, expectedCode) => {
    const result = createDataRepository(
      [
        entry({
          dataType: "robot_body",
          definition: robotBody(slots),
        }),
      ],
      new Set(),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain(expectedCode);
    }
  });

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
