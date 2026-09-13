import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BattleRun } from "../domain/battle/runBattle";
import type { Int32 } from "../domain/data/common";
import type { WorldState } from "../domain/runtime/models";
import { BattleView } from "./BattleView";

const snapshot = (tick: number): WorldState =>
  ({
    tick: tick as Int32,
    status: tick === 1 ? "finished" : "running",
    result: null,
    bullets: [],
    obstacles: [],
    randomState: { value: 1 },
    nextBulletSequence: 1,
    robots: [
      {
        id: "robot_1",
        position: { x: 200, y: 100 },
        direction: 90,
        currentHp: 100,
        status: "active",
        selectedWeaponSlotId: "slot_1",
        ammunition: { slot_1: 12 },
      },
      {
        id: "robot_2",
        position: { x: 600, y: 350 },
        direction: 270,
        currentHp: 75,
        status: "active",
        selectedWeaponSlotId: "slot_1",
        ammunition: { slot_1: 8 },
      },
    ],
  }) as unknown as WorldState;

const battleRun: BattleRun = {
  finalGameSession: {} as BattleRun["finalGameSession"],
  snapshots: [snapshot(0), snapshot(1)],
  aiDebugInfoByTick: [],
};

describe("BattleView", () => {
  afterEach(() => vi.useRealTimers());

  it("Snapshotを10 Tick/秒で再生し、Editorへ戻れる", async () => {
    vi.useFakeTimers();
    const onReturnToEditor = vi.fn();
    render(
      <BattleView
        battleRun={battleRun}
        tickLimit={600 as Int32}
        onReturnToEditor={onReturnToEditor}
      />,
    );

    expect(screen.getByText("Tick 0 / 600")).toBeInTheDocument();
    expect(screen.getAllByText("PLAYER")).toHaveLength(2);
    expect(screen.getAllByText("OPPONENT")).toHaveLength(2);
    expect(screen.getAllByText("PLAYER")[0]?.closest("g")).toHaveAttribute(
      "transform",
      "translate(200 350) rotate(90)",
    );

    await act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText("Tick 1 / 600")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一時停止" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Editorへ戻る" }));
    expect(onReturnToEditor).toHaveBeenCalledTimes(1);
  });
});
