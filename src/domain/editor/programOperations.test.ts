import { describe, expect, it } from "vitest";

import type { Int32, Position } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type {
  InstructionDefinition,
  InstructionId,
} from "../masterData/models";
import type { Program } from "../program/models";
import { connectNodes, disconnectNodes } from "./connectionOperations";
import {
  addNode,
  createProgram,
  deleteNodes,
  moveNodes,
  setNodeComment,
  setParameterValue,
  updateProgramMetadata,
} from "./programOperations";

const startInstructionId =
  "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId;
const waitInstructionId =
  "instruction_6ba7b810-9dad-41d1-80b4-00c04fd430c8" as InstructionId;
const now = "2026-06-29T00:00:00.000Z";
const later = "2026-06-29T00:01:00.000Z";

const instruction = (
  id: InstructionId,
  defaultValue?: number,
): InstructionDefinition => ({
  id,
  displayName: "Instruction",
  description: "",
  enabled: true,
  implementationId: "test",
  category: "control",
  parameters:
    defaultValue === undefined
      ? []
      : [
          {
            id: "ticks",
            displayName: "Ticks",
            description: "",
            valueType: "tick",
            required: true,
            defaultValue,
          },
        ],
  outputPaths: [
    {
      id: "next",
      displayName: "Next",
      description: "",
      required: true,
      displayOrder: 0 as Int32,
    },
  ],
  cpuCost: 0 as Int32,
});

const createTestProgram = (): Program => {
  const result = createProgram({
    id: "program_550e8400-e29b-41d4-a716-446655440000" as ProgramId,
    startInstructionId,
    metadata: { name: "Test", author: "", description: "" },
    createdAt: now,
    startPosition: { x: 0 as Int32, y: 0 as Int32 },
  });
  if (!result.success) throw new Error(result.message);
  return result.data;
};

const addWaitNode = (program: Program): Program => {
  const result = addNode(
    program,
    instruction(waitInstructionId, 3),
    { x: 10 as Int32, y: 20 as Int32 },
    later,
  );
  if (!result.success) throw new Error(result.message);
  return result.data.program;
};

describe("Program editor operations", () => {
  it("Start Nodeを持つProgramを作成する", () => {
    const program = createTestProgram();

    expect(program.startNodeId).toBe("node_1");
    expect(program.nextNodeSequence).toBe(2);
    expect(program.nodes).toHaveLength(1);
  });

  it("既定値と位置を持つNodeを追加する", () => {
    const result = addNode(
      createTestProgram(),
      instruction(waitInstructionId, 3),
      { x: 10 as Int32, y: 20 as Int32 },
      later,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodeId).toBe("node_2");
      expect(result.data.program.nodes[1]?.parameterValues).toEqual({
        ticks: 3,
      });
      expect(result.data.program.nextNodeSequence).toBe(3);
      expect(result.data.program.metadata.updatedAt).toBe(later);
    }
  });

  it("Start Nodeの削除を拒否する", () => {
    const result = deleteNodes(
      createTestProgram(),
      new Set(["node_1" as NodeId]),
      later,
    );

    expect(result).toMatchObject({
      success: false,
      code: "start_node_deletion",
    });
  });

  it("Node削除時に位置、コメント、入力接続を削除する", () => {
    let program = addWaitNode(createTestProgram());
    const instructions = new Map([
      [startInstructionId, instruction(startInstructionId)],
    ]);
    const connected = connectNodes(
      program,
      "node_1" as NodeId,
      "next",
      "node_2" as NodeId,
      instructions,
      later,
    );
    if (!connected.success) throw new Error(connected.message);
    const commented = setNodeComment(
      connected.data,
      "node_2" as NodeId,
      "memo",
      later,
    );
    if (!commented.success) throw new Error(commented.message);
    program = commented.data;

    const result = deleteNodes(program, new Set(["node_2" as NodeId]), later);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0]?.connections).toEqual({});
      expect(
        result.data.editorState.nodePositions["node_2" as NodeId],
      ).toBeUndefined();
      expect(
        result.data.editorState.comments["node_2" as NodeId],
      ).toBeUndefined();
    }
  });

  it("複数Nodeの位置を一度に更新し、同じ位置では変更しない", () => {
    const program = addWaitNode(createTestProgram());
    const position = { x: 30 as Int32, y: 40 as Int32 };
    const moved = moveNodes(
      program,
      { node_2: position } as Record<NodeId, Position>,
      later,
    );
    if (!moved.success) throw new Error(moved.message);

    expect(moved.changed).toBe(true);
    const unchanged = moveNodes(
      moved.data,
      { node_2: position } as Record<NodeId, Position>,
      later,
    );
    expect(unchanged).toMatchObject({ success: true, changed: false });
  });

  it("接続の作成、置換、削除を行う", () => {
    let program = addWaitNode(createTestProgram());
    const instructions = new Map([
      [startInstructionId, instruction(startInstructionId)],
    ]);
    const connected = connectNodes(
      program,
      "node_1" as NodeId,
      "next",
      "node_2" as NodeId,
      instructions,
      later,
    );
    if (!connected.success) throw new Error(connected.message);
    program = connected.data;
    expect(program.nodes[0]?.connections.next).toBe("node_2");

    const disconnected = disconnectNodes(
      program,
      "node_1" as NodeId,
      "next",
      later,
    );
    expect(disconnected.success).toBe(true);
    if (disconnected.success) {
      expect(disconnected.data.nodes[0]?.connections).toEqual({});
    }
  });

  it("Parameter、コメント、メタデータを更新する", () => {
    let program = addWaitNode(createTestProgram());
    const parameter = setParameterValue(
      program,
      "node_2" as NodeId,
      "ticks",
      5 as Int32,
      later,
    );
    if (!parameter.success) throw new Error(parameter.message);
    program = parameter.data;
    const comment = setNodeComment(program, "node_2" as NodeId, "wait", later);
    if (!comment.success) throw new Error(comment.message);
    const metadata = updateProgramMetadata(
      comment.data,
      { name: "Changed", author: "A", description: "D" },
      later,
    );

    expect(metadata.success).toBe(true);
    if (metadata.success) {
      expect(metadata.data.nodes[1]?.parameterValues.ticks).toBe(5);
      expect(metadata.data.editorState.comments["node_2" as NodeId]).toBe(
        "wait",
      );
      expect(metadata.data.metadata.name).toBe("Changed");
    }
  });
});
