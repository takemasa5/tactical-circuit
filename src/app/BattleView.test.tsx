import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BattleRun } from "../domain/battle/runBattle";
import type { Int32 } from "../domain/data/common";
import type { NodeId, RuntimeRobotId } from "../domain/data/ids";
import type { InstructionId } from "../domain/masterData/models";
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
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

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

  it("再生速度を切り替え、一時停止と再開を同じボタンで操作できる", async () => {
    vi.useFakeTimers();
    render(
      <BattleView
        battleRun={{
          ...battleRun,
          snapshots: [0, 1, 2, 3, 4].map(snapshot),
        }}
        tickLimit={600 as Int32}
        onReturnToEditor={() => undefined}
      />,
    );

    const speed = screen.getByRole("combobox", { name: "再生速度" });
    expect(speed).toHaveValue("100");
    expect(
      screen.getAllByRole("button", { name: /一時停止|再開/ }),
    ).toHaveLength(1);

    fireEvent.change(speed, { target: { value: "10" } });
    await act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText("Tick 0 / 600")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Tick 1 / 600")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
    await act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("Tick 1 / 600")).toBeInTheDocument();

    fireEvent.change(speed, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "再開" }));
    await act(() => vi.advanceTimersByTime(400));
    expect(screen.getByText("Tick 2 / 600")).toBeInTheDocument();

    fireEvent.change(speed, { target: { value: "75" } });
    await act(() => vi.advanceTimersByTime(133));
    expect(screen.getByText("Tick 3 / 600")).toBeInTheDocument();

    fireEvent.change(speed, { target: { value: "100" } });
    await act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText("Tick 4 / 600")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一時停止" })).toBeDisabled();
  });

  it("表示中のTickに対応する実行Nodeと選択分岐を順番に表示する", async () => {
    vi.useFakeTimers();
    const run: BattleRun = {
      ...battleRun,
      aiDebugInfoByTick: [
        [
          {
            robotId: "robot_1" as RuntimeRobotId,
            debugInfo: {
              executionTrace: [],
              executedSteps: [
                {
                  nodeId: "node_1" as NodeId,
                  instructionId: "instruction_1" as InstructionId,
                  instructionName: "Start",
                  selectedOutputPathId: null,
                  selectedOutputPathName: null,
                  nextNodeId: null,
                },
                {
                  nodeId: "node_2" as NodeId,
                  instructionId: "instruction_2" as InstructionId,
                  instructionName: "Detect Enemy",
                  selectedOutputPathId: "not_detected",
                  selectedOutputPathName: "Not Detected",
                  nextNodeId: null,
                },
              ],
              terminationReason: "命令によりTickの実行を中断しました",
              runtimeError: null,
              cpuUsed: 1 as Int32,
              executedNodeCount: 2 as Int32,
            },
          },
        ],
      ],
    };
    render(
      <BattleView
        battleRun={run}
        tickLimit={600 as Int32}
        onReturnToEditor={() => undefined}
      />,
    );
    expect(screen.getByText("戦闘開始前です")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTime(100));
    const path = screen.getByRole("region", { name: "Tickの実行経路" });
    expect(path).toHaveTextContent("node_1 Start");
    expect(path).toHaveTextContent("node_2 Detect Enemy");
    expect(path).toHaveTextContent("Not Detected");
    expect(path.textContent?.indexOf("node_1")).toBeLessThan(
      path.textContent?.indexOf("node_2") ?? 0,
    );
  });
});
