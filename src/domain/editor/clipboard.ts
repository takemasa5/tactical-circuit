import { INT32_MAX, type Int32, type Position } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type {
  NodeReference,
  ParameterValue,
  Program,
  ProgramNode,
} from "../program/models";
import { editorFailure, editorSuccess, type EditorResult } from "./result";

/** `docs/specs/current/editor/clipboard.md`のアプリケーション専用Clipboard。 */
export type EditorClipboard = {
  readonly sourceProgramId: ProgramId;
  readonly nodes: readonly ProgramNode[];
  readonly positions: Readonly<Record<NodeId, Position>>;
  readonly comments: Readonly<Record<NodeId, string>>;
};

const isNodeReference = (value: ParameterValue): value is NodeReference =>
  typeof value === "object" &&
  value !== null &&
  value.type === "node_reference";

/** `docs/specs/current/editor/clipboard.md`の選択Node群を値としてコピーする。 */
export const copyNodes = (
  program: Program,
  selectedNodeIds: ReadonlySet<NodeId>,
): EditorResult<EditorClipboard> => {
  if (selectedNodeIds.size === 0) {
    return editorFailure("empty_selection", "コピー対象がありません");
  }
  const selectedNodes = program.nodes.filter(({ id }) =>
    selectedNodeIds.has(id),
  );
  if (selectedNodes.length !== selectedNodeIds.size) {
    return editorFailure("missing_node", "存在しないノードが含まれています");
  }
  if (
    selectedNodes.some(
      ({ id }) => program.editorState.nodePositions[id] === undefined,
    )
  ) {
    return editorFailure(
      "missing_clipboard_data",
      "コピー対象の位置情報がありません",
    );
  }

  const nodes = selectedNodes.map((node): ProgramNode => ({
    ...structuredClone(node),
    parameterValues: Object.fromEntries(
      Object.entries(node.parameterValues).filter(([, value]) => {
        return !isNodeReference(value) || selectedNodeIds.has(value.nodeId);
      }),
    ),
    connections: Object.fromEntries(
      Object.entries(node.connections).filter(([, targetNodeId]) =>
        selectedNodeIds.has(targetNodeId),
      ),
    ),
  }));
  const positions = Object.fromEntries(
    selectedNodes.map(({ id }) => [
      id,
      structuredClone(program.editorState.nodePositions[id]),
    ]),
  ) as Readonly<Record<NodeId, Position>>;
  const comments = Object.fromEntries(
    selectedNodes.flatMap(({ id }) => {
      const comment = program.editorState.comments[id];
      return comment === undefined ? [] : [[id, comment]];
    }),
  ) as Readonly<Record<NodeId, string>>;

  return editorSuccess({
    sourceProgramId: program.id,
    nodes,
    positions,
    comments,
  });
};

const remapParameterValue = (
  value: ParameterValue,
  nodeIds: ReadonlyMap<NodeId, NodeId>,
): ParameterValue => {
  if (!isNodeReference(value)) return structuredClone(value);
  return {
    ...value,
    nodeId: nodeIds.get(value.nodeId) ?? value.nodeId,
  };
};

/** `docs/specs/current/editor/clipboard.md`のNode群を原子的に貼り付ける。 */
export const pasteNodes = (
  program: Program,
  clipboard: EditorClipboard | null,
  updatedAt: string,
): EditorResult<{
  readonly program: Program;
  readonly nodeIds: ReadonlySet<NodeId>;
}> => {
  if (clipboard === null || clipboard.nodes.length === 0) {
    return editorFailure("empty_selection", "貼り付けるデータがありません");
  }
  if (clipboard.nodes.some(({ id }) => clipboard.positions[id] === undefined)) {
    return editorFailure(
      "missing_clipboard_data",
      "貼り付ける位置情報がありません",
    );
  }
  if (program.nextNodeSequence + clipboard.nodes.length > INT32_MAX) {
    return editorFailure(
      "node_sequence_exhausted",
      "Node IDをこれ以上発番できません",
    );
  }

  const sortedNodes = [...clipboard.nodes].sort(({ id: left }, { id: right }) =>
    left.localeCompare(right),
  );
  const nodeIds = new Map<NodeId, NodeId>();
  sortedNodes.forEach(({ id }, index) => {
    nodeIds.set(id, `node_${program.nextNodeSequence + index}` as NodeId);
  });
  const pastedNodes = sortedNodes.map((node): ProgramNode => ({
    ...node,
    id: nodeIds.get(node.id) as NodeId,
    parameterValues: Object.fromEntries(
      Object.entries(node.parameterValues).map(([parameterId, value]) => [
        parameterId,
        remapParameterValue(value, nodeIds),
      ]),
    ),
    connections: Object.fromEntries(
      Object.entries(node.connections).map(([outputPathId, targetNodeId]) => [
        outputPathId,
        nodeIds.get(targetNodeId) as NodeId,
      ]),
    ),
  }));
  const pastedPositions = Object.fromEntries(
    sortedNodes.map(({ id }) => [
      nodeIds.get(id) as NodeId,
      structuredClone(clipboard.positions[id]),
    ]),
  ) as Readonly<Record<NodeId, Position>>;
  const pastedComments = Object.fromEntries(
    sortedNodes.flatMap(({ id }) => {
      const comment = clipboard.comments[id];
      return comment === undefined
        ? []
        : [[nodeIds.get(id) as NodeId, comment]];
    }),
  ) as Readonly<Record<NodeId, string>>;
  const pastedNodeIds = new Set(pastedNodes.map(({ id }) => id));

  return editorSuccess({
    program: {
      ...program,
      nodes: [...program.nodes, ...pastedNodes],
      nextNodeSequence: (program.nextNodeSequence +
        pastedNodes.length) as Int32,
      metadata: { ...program.metadata, updatedAt },
      editorState: {
        nodePositions: {
          ...program.editorState.nodePositions,
          ...pastedPositions,
        },
        comments: { ...program.editorState.comments, ...pastedComments },
      },
    },
    nodeIds: pastedNodeIds,
  });
};
