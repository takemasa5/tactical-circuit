import type { NodeId } from "../data/ids";
import type { InstructionDefinition } from "../masterData/models";
import type { Program } from "../program/models";
import { editorFailure, editorSuccess, type EditorResult } from "./result";

const updateConnection = (
  program: Program,
  sourceNodeId: NodeId,
  outputPathId: string,
  targetNodeId: NodeId | undefined,
  updatedAt: string,
): Program => ({
  ...program,
  nodes: program.nodes.map((node) => {
    if (node.id !== sourceNodeId) return node;
    const connections = { ...node.connections };
    if (targetNodeId === undefined) delete connections[outputPathId];
    else connections[outputPathId] = targetNodeId;
    return { ...node, connections };
  }),
  metadata: { ...program.metadata, updatedAt },
});

/** `spec/editor/connections.md`の接続を作成または置換する。 */
export const connectNodes = (
  program: Program,
  sourceNodeId: NodeId,
  outputPathId: string,
  targetNodeId: NodeId,
  instructions: ReadonlyMap<string, InstructionDefinition>,
  updatedAt: string,
): EditorResult<Program> => {
  const source = program.nodes.find(({ id }) => id === sourceNodeId);
  if (
    source === undefined ||
    !program.nodes.some(({ id }) => id === targetNodeId)
  ) {
    return editorFailure("missing_node", "接続するノードが存在しません");
  }
  const instruction = instructions.get(source.instructionId);
  if (
    instruction === undefined ||
    !instruction.outputPaths.some(({ id }) => id === outputPathId)
  ) {
    return editorFailure("invalid_instruction", "出力パスが存在しません");
  }
  if (source.connections[outputPathId] === targetNodeId) {
    return editorSuccess(program, false);
  }
  return editorSuccess(
    updateConnection(
      program,
      sourceNodeId,
      outputPathId,
      targetNodeId,
      updatedAt,
    ),
  );
};

/** `spec/editor/connections.md`の接続を削除する。 */
export const disconnectNodes = (
  program: Program,
  sourceNodeId: NodeId,
  outputPathId: string,
  updatedAt: string,
): EditorResult<Program> => {
  const source = program.nodes.find(({ id }) => id === sourceNodeId);
  if (source === undefined) {
    return editorFailure("missing_node", "接続元ノードが存在しません");
  }
  if (source.connections[outputPathId] === undefined) {
    return editorSuccess(program, false);
  }
  return editorSuccess(
    updateConnection(program, sourceNodeId, outputPathId, undefined, updatedAt),
  );
};
