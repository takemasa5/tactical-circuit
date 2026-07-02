import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId } from "../data/ids";
import type { GameRuleDefinition, GameRuleId } from "../masterData/models";
import {
  createBulletId,
  createEmptyActionRequests,
  createInitialAIRuntimeState,
  createRuntimeRobotId,
} from "./factories";

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

  it("仕様どおりのローカルIDを発番する", () => {
    expect(createRuntimeRobotId(int32(1))).toBe("robot_1");
    expect(createBulletId(int32(1))).toBe("bullet_1");
  });
});
