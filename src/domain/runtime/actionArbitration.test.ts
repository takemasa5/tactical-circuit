import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import {
  arbitrateRobotActionRequests,
  createActionStatusSnapshot,
} from "./actionArbitration";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import type { RobotActionState } from "./models";

const int32 = (value: number): Int32 => value as Int32;

describe("action request arbitration", () => {
  it("現在行動がないカテゴリの新規要求をpreparingとして採用する", () => {
    const result = arbitrateRobotActionRequests(createEmptyRobotActionState(), {
      movement: { type: "forward", distance: int32(100) },
      combat: null,
    });

    expect(result).toEqual({
      success: true,
      data: {
        movement: {
          current: {
            request: { type: "forward", distance: 100 },
            phase: "preparing",
            phaseElapsedTicks: 0,
            progress: null,
          },
          next: null,
        },
        combat: { current: null, next: null },
      },
    });
  });

  it("preparing中の同一要求を無視して現在行動を維持する", () => {
    const actionState: RobotActionState = {
      ...createEmptyRobotActionState(),
      movement: {
        current: {
          request: { type: "turn_left", turnTo: int32(90) },
          phase: "preparing",
          phaseElapsedTicks: int32(3),
          progress: null,
        },
        next: null,
      },
    };

    const result = arbitrateRobotActionRequests(actionState, {
      movement: { type: "turn_left", turnTo: int32(90) },
      combat: null,
    });

    expect(result.success && result.data.movement.current).toEqual(
      actionState.movement.current,
    );
  });

  it("Moveの同一判定では完了条件のdistanceを変更しない", () => {
    const actionState: RobotActionState = {
      ...createEmptyRobotActionState(),
      movement: {
        current: {
          request: { type: "forward", distance: int32(100) },
          phase: "preparing",
          phaseElapsedTicks: int32(1),
          progress: null,
        },
        next: null,
      },
    };

    const result = arbitrateRobotActionRequests(actionState, {
      movement: { type: "forward", distance: int32(200) },
      combat: null,
    });

    expect(result.success && result.data.movement.current).toEqual(
      actionState.movement.current,
    );
  });

  it("Turnの同一判定では完了目標のturnToを変更しない", () => {
    const actionState: RobotActionState = {
      ...createEmptyRobotActionState(),
      movement: {
        current: {
          request: { type: "turn_right", turnTo: int32(90) },
          phase: "preparing",
          phaseElapsedTicks: int32(1),
          progress: null,
        },
        next: null,
      },
    };

    const result = arbitrateRobotActionRequests(actionState, {
      movement: { type: "turn_right", turnTo: int32(180) },
      combat: null,
    });

    expect(result.success && result.data.movement.current).toEqual(
      actionState.movement.current,
    );
  });

  it("preparing中の異なる要求で現在行動を置き換える", () => {
    const actionState: RobotActionState = {
      ...createEmptyRobotActionState(),
      combat: {
        current: {
          request: { type: "switch_weapon", hand: "right" },
          phase: "preparing",
          phaseElapsedTicks: int32(2),
          progress: null,
        },
        next: null,
      },
    };

    const result = arbitrateRobotActionRequests(actionState, {
      movement: null,
      combat: {
        type: "fire",
        targetDirection: int32(45),
        targetPosition: { x: int32(1), y: int32(2) },
      },
    });

    expect(result.success && result.data.combat.current).toEqual({
      request: {
        type: "fire",
        targetDirection: 45,
        targetPosition: { x: 1, y: 2 },
      },
      phase: "preparing",
      phaseElapsedTicks: 0,
      progress: null,
    });
  });

  it("要求がnullでも継続中の現在行動と次動作を取り消さない", () => {
    const actionState: RobotActionState = {
      movement: {
        current: {
          request: { type: "stop" },
          phase: "preparing",
          phaseElapsedTicks: int32(0),
          progress: null,
        },
        next: { type: "backward", distance: int32(50) },
      },
      combat: {
        current: null,
        next: { type: "melee" },
      },
    };

    const result = arbitrateRobotActionRequests(
      actionState,
      createEmptyActionRequests(),
    );

    expect(result).toEqual({ success: true, data: actionState });
    expect(result.success && result.data).not.toBe(actionState);
  });

  it("現在行動または次動作があるカテゴリをrunningとして公開する", () => {
    expect(
      createActionStatusSnapshot({
        movement: { current: null, next: { type: "stop" } },
        combat: { current: null, next: null },
      }),
    ).toEqual({ movement: "running", combat: "idle" });
  });

  it("executing中の新しい要求を採用せず現在行動を維持する", () => {
    const actionState: RobotActionState = {
      ...createEmptyRobotActionState(),
      movement: {
        current: {
          request: { type: "forward", distance: int32(10) },
          phase: "executing",
          phaseElapsedTicks: int32(0),
          progress: {
            type: "forward",
            fixedPosition: { x: int32(0), y: int32(0) },
            fixedMovedDistance: int32(1000),
          },
        },
        next: null,
      },
    };

    const result = arbitrateRobotActionRequests(actionState, {
      movement: { type: "turn_right", turnTo: int32(90) },
      combat: null,
    });
    expect(result).toEqual({ success: true, data: actionState });
    expect(result.success && result.data).not.toBe(actionState);
  });

  it("recovering中は要求がnullでも現在行動を維持する", () => {
    const actionState: RobotActionState = {
      ...createEmptyRobotActionState(),
      combat: {
        current: {
          request: {
            type: "fire",
            targetDirection: int32(0),
            targetPosition: { x: int32(0), y: int32(1) },
          },
          phase: "recovering",
          phaseElapsedTicks: int32(0),
          progress: null,
        },
        next: null,
      },
    };

    const result = arbitrateRobotActionRequests(
      actionState,
      createEmptyActionRequests(),
    );
    expect(result).toEqual({ success: true, data: actionState });
  });
});
