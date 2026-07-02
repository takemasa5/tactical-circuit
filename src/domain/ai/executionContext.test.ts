import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId } from "../data/ids";
import type { GameRuleDefinition, GameRuleId } from "../masterData/models";
import type { Program } from "../program/models";
import type { ExecutionInput } from "../runtime/models";
import {
  applyExecutionContextChanges,
  createExecutionContext,
} from "./executionContext";

const int32 = (value: number): Int32 => value as Int32;
const gameRule = {
  cpuLimit: int32(5),
  memorySize: int32(2),
  callStackSize: int32(1),
} as GameRuleDefinition;
const program = { nodes: [] } as unknown as Program;
const input = {
  aiRuntimeState: {
    nextNodeId: "node_1" as NodeId,
    registers: { A: int32(1) },
    flags: { F1: false },
    callStack: [],
    memory: { values: [int32(10), int32(20)] },
  },
  randomState: { value: int32(7) },
} as unknown as ExecutionInput;

describe("Execution Context", () => {
  it("入力と参照共有しない作業コピーを生成する", () => {
    const context = createExecutionContext(program, input, {
      ...gameRule,
      id: "game_rule_550e8400-e29b-41d4-a716-446655440000" as GameRuleId,
    });

    expect(context.aiRuntimeState).not.toBe(input.aiRuntimeState);
    expect(context.aiRuntimeState.memory.values).not.toBe(
      input.aiRuntimeState.memory.values,
    );
    expect(context.randomState).not.toBe(input.randomState);
    expect(context.cpuUsed).toBe(0);
    expect(context.cpuRemaining).toBe(5);
    expect(context.actionRequests).toEqual({ movement: null, combat: null });
  });

  it("同一対象は後勝ち、Stack操作は配列順で適用する", () => {
    const context = createExecutionContext(program, input, gameRule);
    const result = applyExecutionContextChanges(
      context,
      {
        registerWrites: { A: int32(2) },
        flagWrites: { F1: true },
        memoryWrites: [
          { index: int32(0), value: int32(30) },
          { index: int32(0), value: int32(40) },
        ],
        stackOperations: [
          { type: "push", nodeId: "node_2" as NodeId },
          { type: "pop" },
        ],
        movementRequest: { type: "stop" },
        randomState: { value: int32(8) },
      },
      gameRule,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.context.aiRuntimeState.registers.A).toBe(2);
      expect(result.context.aiRuntimeState.flags.F1).toBe(true);
      expect(result.context.aiRuntimeState.memory.values[0]).toBe(40);
      expect(result.context.aiRuntimeState.callStack).toEqual([]);
      expect(result.context.actionRequests.movement).toEqual({ type: "stop" });
      expect(result.context.randomState.value).toBe(8);
    }
  });

  it("途中失敗時は変更を一切適用しない", () => {
    const context = createExecutionContext(program, input, gameRule);
    const result = applyExecutionContextChanges(
      context,
      {
        registerWrites: { A: int32(99) },
        flagWrites: {},
        memoryWrites: [{ index: int32(2), value: int32(99) }],
        stackOperations: [],
        randomState: null,
      },
      gameRule,
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: "invalid_memory_access" },
    });
    expect(context.aiRuntimeState.registers.A).toBe(1);
    expect(context.aiRuntimeState.memory.values).toEqual([10, 20]);
  });
});
