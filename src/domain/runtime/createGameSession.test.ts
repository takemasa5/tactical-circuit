import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, ProgramId, RobotDesignId } from "../data/ids";
import { createAIEngine } from "../ai/engine";
import { productionInstructionRegistry } from "../ai/instructions";
import type {
  GameRuleDefinition,
  GameRuleId,
  InstructionDefinition,
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
import type { RobotDesign, SlotId } from "../robotDesign/models";
import { createGameSession } from "./createGameSession";
import { startGameSession } from "./startGameSession";
import { updateGameSessionTick } from "./updateGameSessionTick";

const int32 = (value: number): Int32 => value as Int32;
const uuid = (suffix: string): string =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

const startInstructionId = `instruction_${uuid("1")}` as InstructionId;
const unusedInstructionId = `instruction_${uuid("2")}` as InstructionId;
const switchWeaponInstructionId = `instruction_${uuid("10")}` as InstructionId;
const waitActionInstructionId = `instruction_${uuid("11")}` as InstructionId;
const endInstructionId = `instruction_${uuid("12")}` as InstructionId;
const bodyId = `robot_body_${uuid("3")}` as RobotBodyId;
const projectileId = `projectile_${uuid("4")}` as ProjectileId;
const weaponId = `weapon_${uuid("5")}` as WeaponId;
const mapId = `map_${uuid("6")}` as MapId;
const gameRuleId = `game_rule_${uuid("7")}` as GameRuleId;
const programId = `program_${uuid("8")}` as ProgramId;
const robotDesignId = `robo_${uuid("9")}` as RobotDesignId;
const weaponSlotId = "slot_right" as SlotId;

const instruction = (
  id: InstructionId,
  cpuCost: number,
  implementationId = "start",
): InstructionDefinition => ({
  id,
  displayName: implementationId,
  description: "",
  enabled: true,
  implementationId,
  category: "control",
  parameters: [],
  outputPaths: [],
  cpuCost: int32(cpuCost),
});

const body: RobotBodyDefinition = {
  id: bodyId,
  displayName: "Body",
  description: "",
  enabled: true,
  weight: int32(10),
  maxHp: int32(100),
  maxEnergy: int32(80),
  heatCapacity: int32(50),
  size: { width: int32(2), height: int32(2) },
  slots: [
    {
      id: weaponSlotId,
      displayName: "Right weapon",
      category: "weapon",
      weaponMount: "right_hand",
    },
    {
      id: "slot_left",
      displayName: "Left weapon",
      category: "weapon",
      weaponMount: "left_hand",
    },
  ],
};

const projectile: ProjectileDefinition = {
  id: projectileId,
  displayName: "Projectile",
  description: "",
  enabled: true,
  speed: int32(1),
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
  weight: int32(1),
  ammunitionWeight: int32(1),
};

const map: MapDefinition = {
  id: mapId,
  displayName: "Map",
  description: "",
  enabled: true,
  size: { width: int32(100), height: int32(100) },
  obstacles: [
    {
      id: "obstacle_1",
      position: { x: int32(50), y: int32(50) },
      size: { width: int32(4), height: int32(4) },
    },
  ],
  spawnPoints: [
    { position: { x: int32(10), y: int32(10) }, direction: int32(0) },
    { position: { x: int32(20), y: int32(20) }, direction: int32(90) },
  ],
};

const gameRule: GameRuleDefinition = {
  id: gameRuleId,
  displayName: "Rule",
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

const program: Program = {
  id: programId,
  nodes: [
    {
      id: "node_1" as NodeId,
      instructionId: startInstructionId,
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  editorState: { nodePositions: {}, comments: {} },
};

const robotDesign: RobotDesign = {
  id: robotDesignId,
  bodyDefinitionId: bodyId,
  programId,
  initialWeaponHand: "right",
  equipment: { [weaponSlotId]: weaponId },
  ammunition: { [weaponSlotId]: int32(3) },
  metadata: {
    name: "Robot",
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const repository = (
  startCpuCost = 10,
  entriesOverride?: readonly MasterDataEntry[],
): DataRepository => {
  const entries: readonly MasterDataEntry[] = entriesOverride ?? [
    {
      dataType: "instruction",
      definition: instruction(startInstructionId, startCpuCost),
    },
    {
      dataType: "instruction",
      definition: instruction(unusedInstructionId, 11, "unused"),
    },
    { dataType: "robot_body", definition: body },
    { dataType: "projectile", definition: projectile },
    { dataType: "weapon", definition: weapon },
    { dataType: "map", definition: map },
    { dataType: "game_rule", definition: gameRule },
  ];
  const result = createDataRepository(
    entries,
    new Set(["start", "unused", "switch_weapon", "wait_action", "end"]),
  );
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.data;
};

const input = (dataRepository = repository()) => ({
  participants: [
    { robotDesign, program },
    { robotDesign, program },
  ],
  mapId,
  gameRuleId,
  initialRandomSeed: int32(0),
  repository: dataRepository,
});

describe("createGameSession", () => {
  it("参加者順の独立した初期Game Sessionを決定論的に生成する", () => {
    const creationInput = input();
    const result = createGameSession(creationInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      initialRandomSeed: 0,
      mapId,
      gameRuleId,
      masterDataVersion: "0.1.1",
      participants: [{ robotId: "robot_1" }, { robotId: "robot_2" }],
      worldState: {
        tick: 0,
        status: "ready",
        result: null,
        bullets: [],
        nextBulletSequence: 1,
        randomState: { value: 0x6d2b79f5 },
      },
    });
    expect(result.data.worldState.robots).toEqual([
      expect.objectContaining({
        id: "robot_1",
        position: { x: 10, y: 10 },
        direction: 0,
        velocity: { x: 0, y: 0 },
        currentHp: 100,
        energy: 80,
        heat: 0,
        status: "active",
        partDamage: { [weaponSlotId]: 0 },
        selectedWeaponSlotId: weaponSlotId,
        ammunition: { [weaponSlotId]: 3 },
        actionRequests: { movement: null, combat: null },
        actionState: {
          movement: { current: null, next: null },
          combat: { current: null, next: null },
        },
      }),
      expect.objectContaining({
        id: "robot_2",
        position: { x: 20, y: 20 },
        direction: 90,
      }),
    ]);
    expect(result.data.worldState.obstacles).toEqual(map.obstacles);
    expect(result.data.worldState.robots[0]!.aiRuntimeState.nextNodeId).toBe(
      "node_1",
    );
    expect(result.data.participants[0]!.robotDesign).not.toBe(robotDesign);
    expect(result.data.participants[0]!.program).not.toBe(program);
    expect(result.data.participants[0]!.robotDesign).not.toBe(
      result.data.participants[1]!.robotDesign,
    );
    expect(result.data.worldState.robots[0]!.aiRuntimeState).not.toBe(
      result.data.worldState.robots[1]!.aiRuntimeState,
    );
    expect(result.data.worldState.obstacles[0]).not.toBe(map.obstacles[0]);
  });

  it("使用InstructionだけをCPU上限と照合し、上限超過を拒否する", () => {
    expect(createGameSession(input(repository(10))).success).toBe(true);

    const result = createGameSession(input(repository(11)));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.errors.filter(
        ({ code }) => code === "instruction_cpu_cost_exceeded",
      ),
    ).toHaveLength(2);
  });

  it("使用Instructionの既定参照をGame Ruleと照合する", () => {
    const instructionWithUnknownDefault: InstructionDefinition = {
      ...instruction(startInstructionId, 10),
      parameters: [
        {
          id: "register",
          displayName: "Register",
          description: "",
          valueType: "register_reference",
          required: false,
          defaultValue: { type: "register_reference", registerName: "B" },
        },
      ],
    };
    const entries: readonly MasterDataEntry[] = [
      { dataType: "instruction", definition: instructionWithUnknownDefault },
      { dataType: "robot_body", definition: body },
      { dataType: "projectile", definition: projectile },
      { dataType: "weapon", definition: weapon },
      { dataType: "map", definition: map },
      { dataType: "game_rule", definition: gameRule },
    ];

    const result = createGameSession(input(repository(10, entries)));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.errors.filter(({ code }) => code === "unknown_game_rule_register"),
    ).toHaveLength(2);
    expect(result.errors[0]?.path).toContain(
      "/instructionDefinition/parameters/0/defaultValue",
    );
  });

  it("開始前検証の複数Errorを集約し、部分的なGame Sessionを返さない", () => {
    const result = createGameSession({
      ...input(),
      participants: [
        {
          robotDesign: {
            ...robotDesign,
            bodyDefinitionId: `robot_body_${uuid("99")}` as RobotBodyId,
            programId: `program_${uuid("98")}` as ProgramId,
          },
          program,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result).not.toHaveProperty("data");
    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "participant_count_mismatch",
        "missing_robot_body",
        "missing_weapon_mount",
        "program_id_mismatch",
      ]),
    );
  });

  it("同一入力から同一Game Sessionを生成する", () => {
    expect(createGameSession(input())).toEqual(createGameSession(input()));
  });

  it("検証済み入力から開始し、複数Robotを複数Tick同期更新する", () => {
    const entries: readonly MasterDataEntry[] = [
      {
        dataType: "instruction",
        definition: {
          ...instruction(startInstructionId, 0, "start"),
          outputPaths: [
            {
              id: "next",
              displayName: "Next",
              description: "次のノード",
              required: true,
              displayOrder: int32(0),
            },
          ],
        },
      },
      {
        dataType: "instruction",
        definition: {
          ...instruction(switchWeaponInstructionId, 1, "switch_weapon"),
          category: "action",
          parameters: [
            {
              id: "hand",
              displayName: "Hand",
              description: "切替先の手",
              valueType: "enum",
              required: true,
              defaultValue: "right",
              enumValues: ["right", "left"],
            },
          ],
          outputPaths: [
            {
              id: "next",
              displayName: "Next",
              description: "次のノード",
              required: true,
              displayOrder: int32(0),
            },
          ],
        },
      },
      {
        dataType: "instruction",
        definition: {
          ...instruction(waitActionInstructionId, 0, "wait_action"),
          parameters: [
            {
              id: "category",
              displayName: "Category",
              description: "待機する行動カテゴリ",
              valueType: "enum",
              required: true,
              defaultValue: "movement",
              enumValues: ["movement", "combat"],
            },
          ],
          outputPaths: [
            {
              id: "next",
              displayName: "Next",
              description: "次のノード",
              required: true,
              displayOrder: int32(0),
            },
          ],
        },
      },
      {
        dataType: "instruction",
        definition: instruction(endInstructionId, 1, "end"),
      },
      { dataType: "robot_body", definition: body },
      { dataType: "projectile", definition: projectile },
      { dataType: "weapon", definition: weapon },
      { dataType: "map", definition: map },
      { dataType: "game_rule", definition: gameRule },
    ];
    const dataRepository = repository(10, entries);
    const waitCombatProgram: Program = {
      ...program,
      nodes: [
        {
          id: "node_1" as NodeId,
          instructionId: startInstructionId,
          parameterValues: {},
          connections: { next: "node_2" as NodeId },
        },
        {
          id: "node_2" as NodeId,
          instructionId: switchWeaponInstructionId,
          parameterValues: { hand: "left" },
          connections: { next: "node_3" as NodeId },
        },
        {
          id: "node_3" as NodeId,
          instructionId: waitActionInstructionId,
          parameterValues: { category: "combat" },
          connections: { next: "node_4" as NodeId },
        },
        {
          id: "node_4" as NodeId,
          instructionId: endInstructionId,
          parameterValues: {},
          connections: {},
        },
      ],
      nextNodeSequence: int32(5),
    };

    const runTwoTicks = () => {
      const created = createGameSession({
        ...input(dataRepository),
        participants: [
          { robotDesign, program: waitCombatProgram },
          { robotDesign, program: waitCombatProgram },
        ],
      });
      expect(created.success).toBe(true);
      if (!created.success) return created;

      const started = startGameSession(created.data);
      expect(started.success).toBe(true);
      if (!started.success) return started;

      const aiEngine = createAIEngine({
        repository: dataRepository,
        instructionRegistry: productionInstructionRegistry,
      });
      const firstTick = updateGameSessionTick(started.data, {
        repository: dataRepository,
        aiEngine,
      });
      expect(firstTick.success).toBe(true);
      if (!firstTick.success) return firstTick;

      const secondTick = updateGameSessionTick(firstTick.data.gameSession, {
        repository: dataRepository,
        aiEngine,
      });
      return secondTick;
    };

    const result = runTwoTicks();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.gameSession.worldState).toMatchObject({
      tick: 2,
      status: "running",
      bullets: [],
      obstacles: map.obstacles,
    });
    expect(
      result.data.gameSession.worldState.robots.map(({ id }) => id),
    ).toEqual(["robot_1", "robot_2"]);
    expect(
      result.data.aiDebugInfoByRobot.map(({ robotId }) => robotId),
    ).toEqual(["robot_1", "robot_2"]);
    expect(
      result.data.gameSession.worldState.robots.map(
        ({ actionRequests }) => actionRequests.combat,
      ),
    ).toEqual([null, null]);
    expect(
      result.data.gameSession.worldState.robots.map(
        ({ actionState }) => actionState.combat.current?.request,
      ),
    ).toEqual([
      { type: "switch_weapon", hand: "left" },
      { type: "switch_weapon", hand: "left" },
    ]);
    expect(
      result.data.gameSession.worldState.robots.map(
        ({ aiRuntimeState }) => aiRuntimeState.nextNodeId,
      ),
    ).toEqual(["node_3", "node_3"]);
    expect(runTwoTicks()).toEqual(result);
  });
});
