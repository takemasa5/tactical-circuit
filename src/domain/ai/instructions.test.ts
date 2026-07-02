import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, RuntimeRobotId } from "../data/ids";
import type {
  InstructionDefinition,
  InstructionId,
} from "../masterData/models";
import type { ProgramNode } from "../program/models";
import type { ExecutionContext } from "../runtime/models";
import { dispatchInstruction } from "./dispatcher";
import {
  PRODUCTION_IMPLEMENTATION_IDS,
  productionInstructionRegistry,
} from "./instructions";

const int32 = (value: number): Int32 => value as Int32;
const nodeId = (value: number): NodeId => `node_${value}` as NodeId;

const definition = (implementationId: string): InstructionDefinition =>
  ({
    id: `instruction_550e8400-e29b-41d4-a716-446655440000` as InstructionId,
    implementationId,
  }) as InstructionDefinition;

const node = (
  parameterValues: ProgramNode["parameterValues"] = {},
  connections: ProgramNode["connections"] = { next: nodeId(2) },
): ProgramNode => ({
  id: nodeId(1),
  instructionId: definition("test").id,
  parameterValues,
  connections,
});

const context = (overrides: Record<string, unknown> = {}): ExecutionContext =>
  ({
    input: {
      robot: {
        id: "robot_1" as RuntimeRobotId,
        direction: int32(350),
        selectedWeaponSlotId: null,
        ammunition: {},
      },
      sensors: { robots: [], bullets: [] },
      actionStatus: { movement: "idle", combat: "idle" },
    },
    aiRuntimeState: { callStack: [] },
    actionRequests: { movement: null, combat: null },
    ...overrides,
  }) as unknown as ExecutionContext;

const run = (
  implementationId: string,
  testNode = node(),
  testContext = context(),
) =>
  dispatchInstruction(
    productionInstructionRegistry,
    definition(implementationId),
    testNode,
    testContext,
  );

describe("Production Instruction Registry", () => {
  it("公開13命令だけを一意に登録する", () => {
    expect([...PRODUCTION_IMPLEMENTATION_IDS].sort()).toEqual(
      [
        "start",
        "end",
        "call",
        "return",
        "move_forward",
        "move_backward",
        "turn",
        "fire",
        "switch_weapon",
        "detect_enemy",
        "detect_bullet",
        "check_ammunition",
        "wait_action",
      ].sort(),
    );
    expect(productionInstructionRegistry.size).toBe(13);
  });

  it("Turnは左右とも現在方向とdegreeの和をturnToにする", () => {
    for (const direction of ["left", "right"] as const) {
      const result = run("turn", node({ direction, degree: int32(45) }));
      expect(result).toMatchObject({
        success: true,
        result: {
          contextChanges: {
            movementRequest: {
              type: direction === "left" ? "turn_left" : "turn_right",
              turnTo: 35,
            },
          },
        },
      });
    }
  });

  it("Detect Enemyは0度跨ぎと包含境界を判定し、自機・撃破済みを除外する", () => {
    const robots = [
      {
        id: "robot_1",
        distance: int32(1),
        bearing: int32(0),
        status: "active",
      },
      {
        id: "robot_2",
        distance: int32(500),
        bearing: int32(10),
        status: "destroyed",
      },
      {
        id: "robot_3",
        distance: int32(500),
        bearing: int32(10),
        status: "active",
      },
    ];
    const result = run(
      "detect_enemy",
      node(
        {
          distance: int32(500),
          center_degree: int32(350),
          sensing_degree: int32(20),
        },
        { detected: nodeId(2), not_detected: nodeId(3) },
      ),
      context({
        input: {
          ...context().input,
          sensors: { robots, bullets: [] },
        },
      }),
    );
    expect(result).toMatchObject({
      success: true,
      result: { nextNodeId: nodeId(2) },
    });
  });

  it("Detect Bulletは自弾を含め、全周180度を判定する", () => {
    const result = run(
      "detect_bullet",
      node(
        {
          threshold: int32(100),
          center_degree: int32(0),
          sensing_degree: int32(180),
        },
        { detected: nodeId(2), not_detected: nodeId(3) },
      ),
      context({
        input: {
          ...context().input,
          sensors: {
            robots: [],
            bullets: [
              {
                ownerRobotId: "robot_1",
                distance: int32(100),
                bearing: int32(180),
              },
            ],
          },
        },
      }),
    );
    expect(result).toMatchObject({
      success: true,
      result: { nextNodeId: nodeId(2) },
    });
  });

  it("Check AmmunitionはWeapon未選択時の残弾を0として扱う", () => {
    const result = run(
      "check_ammunition",
      node(
        { threshold: int32(1) },
        { at_least: nodeId(2), less_than: nodeId(3) },
      ),
    );
    expect(result).toMatchObject({
      success: true,
      result: { nextNodeId: nodeId(3) },
    });
  });

  it("Fireは敵未検出時に要求を生成せず正常終了する", () => {
    const result = run("fire");
    expect(result).toMatchObject({
      success: true,
      result: { nextNodeId: nodeId(2) },
    });
    if (result.success) {
      expect(result.result.contextChanges.combatRequest).toBeUndefined();
    }
  });

  it("Wait ActionはExecution Inputのrunning状態でも同じNodeで中断する", () => {
    const result = run(
      "wait_action",
      node({ category: "combat" }),
      context({
        input: {
          ...context().input,
          actionStatus: { movement: "idle", combat: "running" },
        },
      }),
    );
    expect(result).toMatchObject({
      success: true,
      result: { nextNodeId: nodeId(1), interruptTick: true },
    });
  });

  it("命令実装の例外をinternal_instruction_errorへ変換する", () => {
    const result = dispatchInstruction(
      new Map([
        [
          "throws",
          () => {
            throw new Error("unexpected");
          },
        ],
      ]),
      definition("throws"),
      node(),
      context(),
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: "internal_instruction_error" },
    });
  });
});
