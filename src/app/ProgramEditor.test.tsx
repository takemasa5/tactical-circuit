import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Int32 } from "../domain/data/common";
import type { ProgramId } from "../domain/data/ids";
import type {
  InstructionDefinition,
  InstructionId,
} from "../domain/masterData/models";
import { createProgram as createEditorProgram } from "../domain/editor/programOperations";
import { loadProgram, saveProgram } from "../domain/program/codec";
import { ProgramEditor } from "./ProgramEditor";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  get length(): number {
    return this.#values.size;
  }
  clear(): void {
    this.#values.clear();
  }
  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

const startInstructionId =
  "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId;
const endInstructionId =
  "instruction_6ba7b810-9dad-41d1-80b4-00c04fd430c8" as InstructionId;
const detectEnemyInstructionId =
  "instruction_4e80c913-705a-4d87-a05c-4c7f92b4c332" as InstructionId;
const moveForwardInstructionId =
  "instruction_1b671a64-40d5-491e-99b0-da01ff1f3341" as InstructionId;
const outputPath = {
  id: "next",
  displayName: "Next",
  description: "",
  required: true,
  displayOrder: 0 as Int32,
};
const instructions: readonly InstructionDefinition[] = [
  {
    id: startInstructionId,
    displayName: "Start",
    description: "",
    enabled: true,
    implementationId: "start",
    category: "control",
    parameters: [],
    outputPaths: [outputPath],
    cpuCost: 0 as Int32,
  },
  {
    id: endInstructionId,
    displayName: "End",
    description: "",
    enabled: true,
    implementationId: "end",
    category: "control",
    parameters: [],
    outputPaths: [],
    cpuCost: 0 as Int32,
  },
  {
    id: detectEnemyInstructionId,
    displayName: "Detect Enemy",
    description: "",
    enabled: true,
    implementationId: "detect_enemy",
    category: "sensor",
    parameters: [],
    outputPaths: [
      {
        id: "detected",
        displayName: "Detected",
        description: "",
        required: true,
        displayOrder: 0 as Int32,
      },
      {
        id: "not_detected",
        displayName: "Not Detected",
        description: "",
        required: true,
        displayOrder: 1 as Int32,
      },
    ],
    cpuCost: 1 as Int32,
  },
  {
    id: moveForwardInstructionId,
    displayName: "Move Forward",
    description: "",
    enabled: true,
    implementationId: "move_forward",
    category: "action",
    parameters: [
      {
        id: "speed",
        displayName: "Speed",
        description: "",
        valueType: "speed",
        required: true,
        defaultValue: 100,
      },
    ],
    outputPaths: [outputPath],
    cpuCost: 1 as Int32,
  },
];
const fixedProgramId =
  "program_550e8400-e29b-41d4-a716-446655440000" as ProgramId;

const renderEditor = () =>
  render(
    <ProgramEditor
      instructions={instructions}
      startInstructionId={startInstructionId}
      createId={() => fixedProgramId}
      now={() => "2026-06-29T00:00:00.000Z"}
    />,
  );

describe("ProgramEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it("Start Nodeを表示し、InstructionからNodeを追加できる", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByText("node_1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Endcontrol" }));
    expect(screen.getAllByText("node_2")).not.toHaveLength(0);
  });

  it("Nodeを接続し、UndoとRedoを実行できる", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Endcontrol" }));

    fireEvent.pointerDown(screen.getByRole("button", { name: "Next" }));
    fireEvent.pointerUp(screen.getByRole("button", { name: "node_2へ接続" }));
    expect(screen.getByText("Nodeを接続しました")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByText("Redoを実行しました")).toBeInTheDocument();
  });

  it("接続ドラッグ中に出力ポートからポインターまでプレビュー線を表示する", () => {
    const { container } = renderEditor();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Next" }));
    fireEvent.pointerMove(screen.getByTestId("canvas-content"), {
      clientX: 400,
      clientY: 250,
    });

    const preview = container.querySelector("line.connection-preview");
    expect(preview).toHaveAttribute("x1", "270");
    expect(preview).toHaveAttribute("y1", "172");
    expect(preview).toHaveAttribute("x2", "400");
    expect(preview).toHaveAttribute("y2", "250");

    fireEvent.pointerUp(window);
    expect(container.querySelector("line.connection-preview")).toBeNull();
  });

  it("位置情報が欠けた読込済みNodeをフォールバック位置からドラッグする", async () => {
    const user = userEvent.setup();
    const created = createEditorProgram({
      id: fixedProgramId,
      startInstructionId,
      metadata: { name: "Missing Position", author: "", description: "" },
      createdAt: "2026-06-29T00:00:00.000Z",
      startPosition: { x: 80 as Int32, y: 100 as Int32 },
    });
    if (!created.success) throw new Error(created.message);
    const programWithoutPosition = {
      ...created.data,
      editorState: { ...created.data.editorState, nodePositions: {} },
    };
    window.localStorage.setItem(
      `tactical-circuit:program:${fixedProgramId}`,
      saveProgram(programWithoutPosition),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderEditor();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "保存済みProgram" }),
      fixedProgramId,
    );
    await user.click(screen.getByRole("button", { name: "読込" }));

    const node = screen.getByText("node_1").closest("article");
    expect(node).not.toBeNull();
    Object.defineProperty(node!, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(node!, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(node!, { pointerId: 1, clientX: 30, clientY: 40 });

    expect(node).toHaveStyle({ left: "20px", top: "30px" });
  });

  it("複数Connectionの接続線を各出力ポートの右辺中央へ接続する", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await user.click(
      screen.getByRole("button", { name: "Detect Enemysensor" }),
    );
    await user.click(screen.getByRole("button", { name: "Endcontrol" }));
    await user.click(screen.getByRole("button", { name: "Endcontrol" }));

    const detectedPort = screen.getByRole("button", { name: "Detected" });
    const node3InputPort = screen.getByRole("button", {
      name: "node_3へ接続",
    });
    expect(detectedPort).not.toHaveClass("connected");
    expect(node3InputPort).not.toHaveClass("connected");

    fireEvent.pointerDown(detectedPort);
    fireEvent.pointerUp(node3InputPort);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Not Detected" }));
    fireEvent.pointerUp(screen.getByRole("button", { name: "node_4へ接続" }));

    expect(detectedPort).toHaveClass("connected");
    expect(node3InputPort).toHaveClass("connected");

    const detected = container.querySelector(
      'line.connection[data-output-path-id="detected"]',
    );
    const notDetected = container.querySelector(
      'line.connection[data-output-path-id="not_detected"]',
    );
    expect(detected).toHaveAttribute("x1", "510");
    expect(detected).toHaveAttribute("y1", "172");
    expect(notDetected).toHaveAttribute("x1", "510");
    expect(notDetected).toHaveAttribute("y1", "200");
  });

  it("キャンバス全体をZoom InとZoom Outする", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Zoom In" }));
    expect(screen.getByLabelText("Zoom倍率")).toHaveTextContent("110%");
    expect(screen.getByTestId("canvas-content")).toHaveStyle({
      transform: "scale(1.1)",
    });

    await user.click(screen.getByRole("button", { name: "Zoom Out" }));
    expect(screen.getByLabelText("Zoom倍率")).toHaveTextContent("100%");
  });

  it("localStorageへ保存する", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByText("localStorageへ保存しました")).toBeInTheDocument();
    expect(window.localStorage.length).toBe(1);
    expect(screen.getByText("保存済み")).toBeInTheDocument();
  });

  it("入力欄の編集中も保存ショートカットでlocalStorageへ保存する", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("textbox", { name: "名前" }));
    await user.keyboard("{Control>}s{/Control}");
    expect(window.localStorage.length).toBe(1);
    expect(screen.getByText("localStorageへ保存しました")).toBeInTheDocument();

    window.localStorage.clear();
    await user.keyboard("{Meta>}s{/Meta}");
    expect(window.localStorage.length).toBe(1);
  });

  it("数値ParameterへInt32範囲外の整数を反映しない", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(
      screen.getByRole("button", { name: "Move Forwardaction" }),
    );

    const speedInput = screen.getByRole("textbox", { name: "Speed" });
    await user.clear(speedInput);
    await user.type(speedInput, "2147483647");
    await user.tab();

    const updatedSpeedInput = screen.getByRole("textbox", { name: "Speed" });
    await user.clear(updatedSpeedInput);
    await user.type(updatedSpeedInput, "2147483648");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "保存" }));

    const key = window.localStorage.key(0);
    expect(key).not.toBeNull();
    const loaded = loadProgram(window.localStorage.getItem(key!)!);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    expect(loaded.data.nodes[1]?.parameterValues.speed).toBe(2_147_483_647);
  });
});
