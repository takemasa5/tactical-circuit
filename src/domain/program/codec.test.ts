import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type { InstructionId } from "../masterData/models";
import { loadProgram, saveProgram } from "./codec";
import type { Program } from "./models";

const int32 = (value: number): Int32 => value as Int32;
const uuid = "550e8400-e29b-41d4-a716-446655440000";
const instructionId = `instruction_${uuid}` as InstructionId;
const node1 = "node_1" as NodeId;
const node2 = "node_2" as NodeId;

const program = (): Program => ({
  id: `program_${uuid}` as ProgramId,
  nodes: [
    {
      id: node2,
      instructionId,
      parameterValues: { value: int32(1) },
      connections: {},
    },
    {
      id: node1,
      instructionId,
      parameterValues: {},
      connections: { next: node2 },
    },
  ],
  startNodeId: node1,
  nextNodeSequence: int32(3),
  metadata: {
    name: "Test Program",
    author: "",
    description: "",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
  },
  editorState: {
    nodePositions: {
      [node2]: { x: int32(10), y: int32(20) },
      [node1]: { x: int32(0), y: int32(0) },
    },
    comments: { [node1]: "start" },
  },
});

describe("Program codec", () => {
  it("ProgramをNode ID順に保存して読み戻す", () => {
    const loaded = loadProgram(saveProgram(program()));

    expect(loaded.success).toBe(true);
    if (loaded.success) {
      expect(loaded.data.nodes.map(({ id }) => id)).toEqual([
        "node_1",
        "node_2",
      ]);
      expect(loaded.data.metadata.name).toBe("Test Program");
    }
  });

  it("意味的に不完全なProgramも読み込む", () => {
    const incomplete = {
      ...program(),
      startNodeId: "node_99" as NodeId,
    };
    const loaded = loadProgram(saveProgram(incomplete));

    expect(loaded.success).toBe(true);
  });

  it("不正なNode IDを拒否する", () => {
    const json = saveProgram(program()).replace('"node_1"', '"node_0"');

    expect(loadProgram(json).success).toBe(false);
  });

  it("CALLの予約Parameter ID targetNodeIdを保存して読み戻す", () => {
    const callProgram = program();
    const value = {
      ...callProgram,
      nodes: callProgram.nodes.map((node) =>
        node.id === node2
          ? {
              ...node,
              parameterValues: {
                targetNodeId: {
                  type: "node_reference" as const,
                  nodeId: node1,
                },
              },
            }
          : node,
      ),
    };

    const loaded = loadProgram(saveProgram(value));

    expect(loaded.success).toBe(true);
    if (loaded.success) {
      expect(loaded.data.nodes[1]?.parameterValues.targetNodeId).toEqual({
        type: "node_reference",
        nodeId: node1,
      });
    }
  });
});
