import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, RobotDesignId, RuntimeRobotId } from "../data/ids";
import type { GameRuleDefinition, GameRuleId } from "../masterData/models";
import type { SlotId } from "../robotDesign/models";
import {
  createBulletId,
  createEmptyActionRequests,
  createEmptyRobotActionState,
  createExecutionRobotSnapshot,
  createInitialAIRuntimeState,
  createRuntimeRobotId,
} from "./factories";
import type { RobotState } from "./models";

const int32 = (value: number): Int32 => value as Int32;

const gameRule: GameRuleDefinition = {
  id: "game_rule_550e8400-e29b-41d4-a716-446655440000" as GameRuleId,
  displayName: "Test Rule",
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

const robot: RobotState = {
  id: "robot_1" as RuntimeRobotId,
  robotDesignId: "robo_550e8400-e29b-41d4-a716-446655440000" as RobotDesignId,
  position: { x: int32(10), y: int32(20) },
  direction: int32(90),
  velocity: { x: int32(1), y: int32(2) },
  currentHp: int32(100),
  energy: int32(100),
  heat: int32(0),
  status: "active",
  partDamage: { ["slot_1" as SlotId]: int32(0) },
  selectedWeaponSlotId: "slot_1" as SlotId,
  ammunition: { ["slot_1" as SlotId]: int32(3) },
  aiRuntimeState: {
    nextNodeId: "node_1" as NodeId,
    registers: { A: int32(0) },
    flags: { F1: false },
    callStack: [],
    memory: { values: [int32(0)] },
  },
  actionRequests: {
    movement: { type: "forward", distance: int32(100) },
    combat: {
      type: "fire",
      targetDirection: int32(45),
      targetPosition: { x: int32(30), y: int32(40) },
    },
  },
  actionState: createEmptyRobotActionState(),
};

describe("runtime factories", () => {
  it("Game RuleからAI Runtime Stateの初期値を生成する", () => {
    const state = createInitialAIRuntimeState(gameRule, "node_1" as NodeId);

    expect(state.registers).toEqual({ A: 0, B: 0, C: 0, D: 0 });
    expect(state.flags).toEqual({ F1: false, F2: false, F3: false });
    expect(state.memory.values).toHaveLength(20);
    expect(state.memory.values.every((value) => value === 0)).toBe(true);
  });

  it("カテゴリごとに要求なしの初期値を生成する", () => {
    expect(createEmptyActionRequests()).toEqual({
      movement: null,
      combat: null,
    });
  });

  it("カテゴリごとに現在行動と次動作がない初期値を生成する", () => {
    expect(createEmptyRobotActionState()).toEqual({
      movement: { current: null, next: null },
      combat: { current: null, next: null },
    });
  });

  it("仕様どおりのローカルIDを発番する", () => {
    expect(createRuntimeRobotId(int32(1))).toBe("robot_1");
    expect(createBulletId(int32(1))).toBe("bullet_1");
  });

  it("Execution Robot Snapshotから行動詳細を除外し、可変参照を共有しない", () => {
    const snapshot = createExecutionRobotSnapshot(robot);

    expect(snapshot).not.toHaveProperty("actionState");
    expect(snapshot).toEqual(
      expect.objectContaining({
        id: robot.id,
        actionRequests: robot.actionRequests,
      }),
    );
    expect(snapshot.position).not.toBe(robot.position);
    expect(snapshot.partDamage).not.toBe(robot.partDamage);
    expect(snapshot.aiRuntimeState).not.toBe(robot.aiRuntimeState);
    expect(snapshot.aiRuntimeState.memory.values).not.toBe(
      robot.aiRuntimeState.memory.values,
    );
    expect(snapshot.actionRequests.movement).not.toBe(
      robot.actionRequests.movement,
    );
    expect(snapshot.actionRequests.combat).not.toBe(
      robot.actionRequests.combat,
    );
    if (
      snapshot.actionRequests.combat?.type === "fire" &&
      robot.actionRequests.combat?.type === "fire"
    ) {
      expect(snapshot.actionRequests.combat.targetPosition).not.toBe(
        robot.actionRequests.combat.targetPosition,
      );
    }
  });
});
