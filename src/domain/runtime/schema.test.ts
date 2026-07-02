import { describe, expect, it } from "vitest";

import { compileJsonSchema } from "../data/jsonEnvelope";
import type { ExecutionInput } from "./models";
import { executionInputSchema } from "./schema";

const validateExecutionInput =
  compileJsonSchema<ExecutionInput>(executionInputSchema);

const input = {
  tick: 0,
  robot: {
    id: "robot_1",
    robotDesignId: "robo_550e8400-e29b-41d4-a716-446655440000",
    position: { x: 0, y: 0 },
    direction: 0,
    velocity: { x: 0, y: 0 },
    currentHp: 100,
    energy: 100,
    heat: 0,
    status: "active",
    partDamage: {},
    selectedWeaponSlotId: null,
    ammunition: {},
    aiRuntimeState: {
      nextNodeId: "node_1",
      registers: { A: 0 },
      flags: { F1: false },
      callStack: [],
      memory: { values: [0] },
    },
    actionRequests: { movement: null, combat: null },
  },
  aiRuntimeState: {
    nextNodeId: "node_1",
    registers: { A: 0 },
    flags: { F1: false },
    callStack: [],
    memory: { values: [0] },
  },
  sensors: {
    robots: [
      {
        id: "robot_2",
        worldPosition: { x: 10, y: 20 },
        relativePosition: { x: 10, y: 20 },
        distance: 22,
        bearing: -10,
        status: "active",
      },
    ],
    bullets: [],
  },
  randomState: { value: 1 },
  actionStatus: { movement: "idle", combat: "running" },
};

describe("Execution Input schema", () => {
  it("World Stateを公開せず、worldPositionとカテゴリ別行動状態を受け付ける", () => {
    expect(validateExecutionInput(input)).toBe(true);
    expect(validateExecutionInput({ ...input, bullets: [] })).toBe(false);
  });

  it("worldPosition欠損と詳細な行動状態を拒否する", () => {
    const robot = { ...input.sensors.robots[0] } as Record<string, unknown>;
    delete robot.worldPosition;
    expect(
      validateExecutionInput({
        ...input,
        sensors: { robots: [robot], bullets: [] },
      }),
    ).toBe(false);
    expect(
      validateExecutionInput({
        ...input,
        actionStatus: { movement: "preparing", combat: "idle" },
      }),
    ).toBe(false);
  });
});
