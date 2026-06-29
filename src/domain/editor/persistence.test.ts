import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type { InstructionId } from "../masterData/models";
import type { Program } from "../program/models";
import {
  exportProgram,
  hasUnsavedChanges,
  importProgram,
  listStoredProgramIds,
  loadProgramFromStorage,
  saveProgramToStorage,
} from "./persistence";

const programId = "program_550e8400-e29b-41d4-a716-446655440000" as ProgramId;

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

const createProgram = (): Program => ({
  id: programId,
  nodes: [
    {
      id: "node_1" as NodeId,
      instructionId:
        "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId,
      parameterValues: {},
      connections: {},
    },
  ],
  startNodeId: "node_1" as NodeId,
  nextNodeSequence: 2 as Int32,
  metadata: {
    name: "Test",
    author: "",
    description: "",
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  },
  editorState: {
    nodePositions: {
      ["node_1" as NodeId]: { x: 0 as Int32, y: 0 as Int32 },
    },
    comments: {},
  },
});

describe("Program persistence", () => {
  it("localStorageへ保存してID一覧から読み込む", () => {
    const storage = new MemoryStorage();
    const program = createProgram();
    const saved = saveProgramToStorage(storage, program);

    expect(saved.success).toBe(true);
    expect(listStoredProgramIds(storage)).toEqual({
      success: true,
      data: [programId],
    });
    const loaded = loadProgramFromStorage(storage, programId);
    expect(loaded.success).toBe(true);
    if (loaded.success) expect(loaded.data.program).toEqual(program);
  });

  it("JSONファイル向けにExportしてImportする", () => {
    const program = createProgram();
    const exported = exportProgram(program);
    const imported = importProgram(exported.json);

    expect(exported.filename).toBe(
      "program-550e8400-e29b-41d4-a716-446655440000.json",
    );
    expect(imported).toEqual({ success: true, data: program });
  });

  it("保存基準との差分を判定する", () => {
    const storage = new MemoryStorage();
    const program = createProgram();
    const saved = saveProgramToStorage(storage, program);
    if (!saved.success) throw new Error(saved.message);

    expect(hasUnsavedChanges(saved.data, program)).toBe(false);
    expect(
      hasUnsavedChanges(saved.data, {
        ...program,
        metadata: { ...program.metadata, name: "Changed" },
      }),
    ).toBe(true);
  });

  it("不正な保存データを拒否して例外を外へ出さない", () => {
    const storage = new MemoryStorage();
    storage.setItem(`tactical-circuit:program:${programId}`, "invalid");

    expect(loadProgramFromStorage(storage, programId)).toMatchObject({
      success: false,
      code: "invalid_program",
    });
  });
});
