/// <reference types="node" />

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Int32 } from "../data/common";
import type {
  NodeId,
  ProgramId,
  RobotDesignId,
  RuntimeRobotId,
} from "../data/ids";
import { loadDataRepository } from "../masterData/loader";
import type { DataRepository } from "../masterData/repository";
import type {
  GameRuleDefinition,
  GameRuleId,
  InstructionId,
} from "../masterData/models";
import type { Program, ProgramNode } from "../program/models";
import type { SlotId } from "../robotDesign/models";
import { createEmptyActionRequests } from "../runtime/factories";
import type {
  AIExecutionOutput,
  AIRuntimeState,
  DetectedRobot,
  ExecutionInput,
  RobotState,
} from "../runtime/models";
import { createAIEngine } from "./engine";
import {
  PRODUCTION_IMPLEMENTATION_IDS,
  productionInstructionRegistry,
} from "./instructions";

const int32 = (value: number): Int32 => value as Int32;
const nodeId = (value: number): NodeId => `node_${value}` as NodeId;
const robotId = (value: number): RuntimeRobotId =>
  `robot_${value}` as RuntimeRobotId;

const gameRule: GameRuleDefinition = {
  id: "game_rule_550e8400-e29b-41d4-a716-446655440000" as GameRuleId,
  displayName: "Test",
  description: "",
  enabled: true,
  cpuLimit: int32(10),
  tickLimit: int32(100),
  participantCount: int32(2),
  registerNames: ["A", "B", "C", "D"],
  flagNames: ["F1", "F2", "F3"],
  memorySize: int32(20),
  callStackSize: int32(20),
};

let repository: DataRepository;
let instructionIds: ReadonlyMap<string, InstructionId>;

beforeAll(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const instructionDirectory = join(
    process.cwd(),
    "public/master-data/instructions",
  );
  const { files } = JSON.parse(
    readFileSync(join(instructionDirectory, "manifest.json"), "utf8"),
  ) as { files: string[] };
  const result = loadDataRepository(
    readFileSync(
      join(process.cwd(), "public/master-data/manifest.json"),
      "utf8",
    ),
    files.map((file) => ({
      dataType: "instruction" as const,
      json: readFileSync(join(instructionDirectory, file), "utf8"),
      sourcePath: file,
    })),
    PRODUCTION_IMPLEMENTATION_IDS,
  );
  if (!result.success) throw new Error("テスト用Master Dataを読み込めません");
  repository = result.data.repository;
  instructionIds = new Map(
    repository
      .getAll("instruction")
      .map(({ implementationId, id }) => [implementationId, id]),
  );
});

const runtimeState = (
  nextNodeId: NodeId | null = nodeId(1),
): AIRuntimeState => ({
  nextNodeId,
  registers: { A: int32(0), B: int32(0), C: int32(0), D: int32(0) },
  flags: { F1: false, F2: false, F3: false },
  callStack: [],
  memory: { values: Array.from({ length: 20 }, () => int32(0)) },
});

const robot = (aiRuntimeState = runtimeState()): RobotState => ({
  id: robotId(1),
  robotDesignId: "robo_550e8400-e29b-41d4-a716-446655440000" as RobotDesignId,
  position: { x: int32(100), y: int32(200) },
  direction: int32(350),
  velocity: { x: int32(0), y: int32(0) },
  currentHp: int32(100),
  energy: int32(100),
  heat: int32(0),
  status: "active",
  partDamage: {},
  selectedWeaponSlotId: "slot_1" as SlotId,
  ammunition: { ["slot_1" as SlotId]: int32(3) },
  aiRuntimeState,
  actionRequests: createEmptyActionRequests(),
});

const enemy = (overrides: Partial<DetectedRobot> = {}): DetectedRobot => ({
  id: robotId(2),
  worldPosition: { x: int32(300), y: int32(400) },
  relativePosition: { x: int32(200), y: int32(200) },
  distance: int32(500),
  bearing: int32(20),
  status: "active",
  ...overrides,
});

const executionInput = (
  overrides: Partial<ExecutionInput> = {},
): ExecutionInput => {
  const aiRuntimeState = overrides.aiRuntimeState ?? runtimeState();
  return {
    tick: int32(0),
    robot: robot(aiRuntimeState),
    aiRuntimeState,
    sensors: { robots: [], bullets: [] },
    randomState: { value: int32(123) },
    actionStatus: { movement: "idle", combat: "idle" },
    ...overrides,
  };
};

type NodeSpec = {
  implementationId: string;
  parameters?: ProgramNode["parameterValues"];
  connections?: ProgramNode["connections"];
};

const program = (specs: readonly NodeSpec[]): Program => ({
  id: "program_550e8400-e29b-41d4-a716-446655440000" as ProgramId,
  nodes: specs.map((spec, index) => ({
    id: nodeId(index + 1),
    instructionId: instructionIds.get(spec.implementationId) as InstructionId,
    parameterValues: spec.parameters ?? {},
    connections: spec.connections ?? {},
  })),
  startNodeId: nodeId(1),
  nextNodeSequence: int32(specs.length + 1),
  metadata: {
    name: "Test",
    author: "",
    description: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  editorState: { nodePositions: {}, comments: {} },
});

const execute = (
  testProgram: Program,
  input = executionInput(),
  rule = gameRule,
): AIExecutionOutput =>
  createAIEngine({
    repository,
    instructionRegistry: productionInstructionRegistry,
  }).execute({ program: testProgram, executionInput: input, gameRule: rule });

describe("AI Engine integration", () => {
  it("Start → Move → Wait → Endを複数Tickで実行する", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "move_forward",
        parameters: { distance: int32(100) },
        connections: { next: nodeId(3) },
      },
      {
        implementationId: "wait_action",
        parameters: { category: "movement" },
        connections: { next: nodeId(4) },
      },
      { implementationId: "end" },
    ]);

    const first = execute(testProgram);
    expect(first.executionResult.actionRequests.movement).toEqual({
      type: "forward",
      distance: 100,
    });
    expect(first.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(3));
    expect(first.debugInfo).toMatchObject({ cpuUsed: 1, executedNodeCount: 3 });

    const secondState = first.executionResult.aiRuntimeState;
    const second = execute(
      testProgram,
      executionInput({
        tick: int32(1),
        aiRuntimeState: secondState,
        robot: robot(secondState),
      }),
    );
    expect(second.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(1));
    expect(second.executionResult.actionRequests.movement).toBeNull();
  });

  it("Detect → Fire → Endで検出位置への発射要求を生成する", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "detect_enemy",
        parameters: {
          distance: int32(500),
          center_degree: int32(0),
          sensing_degree: int32(20),
        },
        connections: { detected: nodeId(3), not_detected: nodeId(4) },
      },
      { implementationId: "fire", connections: { next: nodeId(4) } },
      { implementationId: "end" },
    ]);

    const result = execute(
      testProgram,
      executionInput({ sensors: { robots: [enemy()], bullets: [] } }),
    );

    expect(result.executionResult.actionRequests.combat).toEqual({
      type: "fire",
      targetDirection: 10,
      targetPosition: { x: 300, y: 400 },
    });
  });

  it("Switch Weapon → Wait combat → Fireで同一Tick要求を待機対象にする", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "switch_weapon",
        parameters: { hand: "left" },
        connections: { next: nodeId(3) },
      },
      {
        implementationId: "wait_action",
        parameters: { category: "combat" },
        connections: { next: nodeId(4) },
      },
      { implementationId: "fire", connections: { next: nodeId(5) } },
      { implementationId: "end" },
    ]);
    const sensors = { robots: [enemy()], bullets: [] };

    const first = execute(testProgram, executionInput({ sensors }));
    expect(first.executionResult.actionRequests.combat).toEqual({
      type: "switch_weapon",
      hand: "left",
    });
    expect(first.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(3));

    const state = first.executionResult.aiRuntimeState;
    const second = execute(
      testProgram,
      executionInput({ aiRuntimeState: state, robot: robot(state), sensors }),
    );
    expect(second.executionResult.actionRequests.combat).toMatchObject({
      type: "fire",
    });
  });

  it("CALLで復帰先を保存しRETURNで復帰する", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "call",
        parameters: {
          targetNodeId: { type: "node_reference", nodeId: nodeId(4) },
        },
        connections: { next: nodeId(3) },
      },
      { implementationId: "end" },
      { implementationId: "return" },
    ]);

    const result = execute(testProgram);
    expect(
      result.debugInfo.executionTrace.map((line) => line.split(" ")[1]),
    ).toEqual(["start", "call", "return", "end"]);
    expect(result.executionResult.aiRuntimeState.callStack).toEqual([]);
  });

  it("再帰CALLのStack Overflowで失敗命令だけをロールバックする", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "call",
        parameters: {
          targetNodeId: { type: "node_reference", nodeId: nodeId(2) },
        },
        connections: { next: nodeId(3) },
      },
      { implementationId: "end" },
    ]);
    const rule = { ...gameRule, callStackSize: int32(2) };

    const result = execute(testProgram, executionInput(), rule);
    expect(result.debugInfo.runtimeError?.code).toBe("call_stack_overflow");
    expect(result.debugInfo.cpuUsed).toBe(2);
    expect(result.executionResult.aiRuntimeState.callStack).toEqual([
      nodeId(3),
      nodeId(3),
    ]);
    expect(result.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(1));
  });

  it("CPU不足では未実行Nodeを次Tickの再開位置にする", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "move_forward",
        parameters: { distance: int32(10) },
        connections: { next: nodeId(3) },
      },
      { implementationId: "fire", connections: { next: nodeId(4) } },
      { implementationId: "end" },
    ]);
    const rule = { ...gameRule, cpuLimit: int32(1) };

    const first = execute(testProgram, executionInput(), rule);
    expect(first.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(3));
    expect(first.debugInfo.executionTrace).toHaveLength(2);

    const state = first.executionResult.aiRuntimeState;
    const second = execute(
      testProgram,
      executionInput({
        aiRuntimeState: state,
        robot: robot(state),
        sensors: { robots: [enemy()], bullets: [] },
      }),
      rule,
    );
    expect(second.executionResult.actionRequests.combat).toMatchObject({
      type: "fire",
    });
  });

  it("CPUコスト0循環をNode数上限で終了する", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      {
        implementationId: "wait_action",
        parameters: { category: "movement" },
        connections: { next: nodeId(2) },
      },
    ]);

    const result = execute(testProgram, executionInput(), {
      ...gameRule,
      cpuLimit: int32(1),
    });
    expect(result.debugInfo.terminationReason).toContain("Node数上限");
    expect(result.debugInfo.executedNodeCount).toBe(2);
    expect(result.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(2));
  });

  it("Runtime Error後はStartへ戻り、同一入力から同一結果を返す", () => {
    const testProgram = program([
      { implementationId: "start", connections: { next: nodeId(2) } },
      { implementationId: "return" },
    ]);
    const input = executionInput();

    const first = execute(testProgram, input);
    const second = execute(testProgram, input);
    expect(first).toEqual(second);
    expect(first.debugInfo.runtimeError?.code).toBe("empty_call_stack");
    expect(first.executionResult.aiRuntimeState.nextNodeId).toBe(nodeId(1));
    expect(first.debugInfo.executedNodeCount).toBe(1);
  });
});
