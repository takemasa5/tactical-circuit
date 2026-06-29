import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type { InstructionId } from "../masterData/models";
import type { Program } from "../program/models";
import { copyNodes, pasteNodes } from "./clipboard";
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history";
import { emptySelection, reconcileSelection, selectNode } from "./selection";

const nodeId = (sequence: number): NodeId => `node_${sequence}` as NodeId;

const createProgram = (name = "Program"): Program => ({
  id: "program_550e8400-e29b-41d4-a716-446655440000" as ProgramId,
  nodes: [
    {
      id: nodeId(1),
      instructionId:
        "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId,
      parameterValues: {},
      connections: {},
    },
    {
      id: nodeId(2),
      instructionId:
        "instruction_6ba7b810-9dad-41d1-80b4-00c04fd430c8" as InstructionId,
      parameterValues: {
        internal: { type: "node_reference", nodeId: nodeId(1) },
        external: { type: "node_reference", nodeId: nodeId(3) },
      },
      connections: { next: nodeId(1), outside: nodeId(3) },
    },
    {
      id: nodeId(3),
      instructionId:
        "instruction_6ba7b810-9dad-41d1-80b4-00c04fd430c8" as InstructionId,
      parameterValues: {},
      connections: {},
    },
  ],
  startNodeId: nodeId(1),
  nextNodeSequence: 4 as Int32,
  metadata: {
    name,
    author: "",
    description: "",
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  },
  editorState: {
    nodePositions: {
      [nodeId(1)]: { x: 10 as Int32, y: 20 as Int32 },
      [nodeId(2)]: { x: 30 as Int32, y: 40 as Int32 },
      [nodeId(3)]: { x: 50 as Int32, y: 60 as Int32 },
    },
    comments: { [nodeId(2)]: "copied" },
  },
});

describe("Editor history", () => {
  it("UndoとRedoでProgramスナップショットを復元する", () => {
    const initial = createProgram("Initial");
    const changed = createProgram("Changed");
    const history = pushHistory(createHistory(initial), changed);

    expect(canUndo(history)).toBe(true);
    const undone = undoHistory(history);
    expect(undone.present.metadata.name).toBe("Initial");
    expect(canRedo(undone)).toBe(true);
    expect(redoHistory(undone).present.metadata.name).toBe("Changed");
  });

  it("履歴を直近100操作に制限する", () => {
    let history = createHistory(createProgram("0"));
    for (let index = 1; index <= HISTORY_LIMIT + 5; index += 1) {
      history = pushHistory(history, createProgram(String(index)));
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]?.metadata.name).toBe("5");
  });
});

describe("Editor selection", () => {
  it("追加選択し、Programに存在しないNodeを除外する", () => {
    let selection = selectNode(emptySelection(), nodeId(1), false);
    selection = selectNode(selection, nodeId(2), true);
    const program = {
      ...createProgram(),
      nodes: createProgram().nodes.filter(({ id }) => id !== nodeId(2)),
    };

    expect(reconcileSelection(selection, program).nodeIds).toEqual(
      new Set([nodeId(1)]),
    );
  });
});

describe("Editor clipboard", () => {
  it("選択範囲内の接続とNode参照だけをコピーする", () => {
    const copied = copyNodes(createProgram(), new Set([nodeId(1), nodeId(2)]));

    expect(copied.success).toBe(true);
    if (copied.success) {
      const second = copied.data.nodes.find(({ id }) => id === nodeId(2));
      expect(second?.connections).toEqual({ next: nodeId(1) });
      expect(second?.parameterValues.internal).toEqual({
        type: "node_reference",
        nodeId: nodeId(1),
      });
      expect(second?.parameterValues.external).toBeUndefined();
    }
  });

  it("Node IDと内部参照を振り直して同じ位置へ貼り付ける", () => {
    const source = createProgram();
    const copied = copyNodes(source, new Set([nodeId(1), nodeId(2)]));
    if (!copied.success) throw new Error(copied.message);
    const pasted = pasteNodes(source, copied.data, "2026-06-29T01:00:00.000Z");

    expect(pasted.success).toBe(true);
    if (pasted.success) {
      expect(pasted.data.nodeIds).toEqual(new Set([nodeId(4), nodeId(5)]));
      expect(pasted.data.program.nextNodeSequence).toBe(6);
      expect(pasted.data.program.editorState.nodePositions[nodeId(4)]).toEqual({
        x: 10,
        y: 20,
      });
      const second = pasted.data.program.nodes.find(
        ({ id }) => id === nodeId(5),
      );
      expect(second?.connections.next).toBe(nodeId(4));
      expect(second?.parameterValues.internal).toEqual({
        type: "node_reference",
        nodeId: nodeId(4),
      });
    }
  });
});
