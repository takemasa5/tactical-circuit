import {
  INT32_MAX,
  INT32_MIN,
  type Int32,
  type Position,
} from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type {
  InstructionDefinition,
  InstructionId,
} from "../masterData/models";
import type {
  ParameterValue,
  Program,
  ProgramMetadata,
  ProgramNode,
} from "../program/models";
import { editorFailure, editorSuccess, type EditorResult } from "./result";

/** `spec/editor/property_editor.md`で編集可能なProgramメタデータ。 */
export type ProgramMetadataInput = Pick<
  ProgramMetadata,
  "name" | "author" | "description"
>;

const isInt32 = (value: number): value is Int32 =>
  Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX;

const isPosition = (position: Position): boolean =>
  isInt32(position.x) && isInt32(position.y);

const withUpdatedAt = (program: Program, updatedAt: string): Program => ({
  ...program,
  metadata: { ...program.metadata, updatedAt },
});

const cloneDefaultValue = (value: unknown): ParameterValue =>
  structuredClone(value) as ParameterValue;

const defaultParameterValues = (
  instruction: InstructionDefinition,
): Readonly<Record<string, ParameterValue>> =>
  Object.fromEntries(
    instruction.parameters
      .filter(({ defaultValue }) => defaultValue !== undefined)
      .map(({ id, defaultValue }) => [id, cloneDefaultValue(defaultValue)]),
  );

/** `spec/editor/nodes.md`の新規Programを作成する。 */
export const createProgram = (input: {
  readonly id: ProgramId;
  readonly startInstructionId: InstructionId;
  readonly metadata: ProgramMetadataInput;
  readonly createdAt: string;
  readonly startPosition: Position;
}): EditorResult<Program> => {
  if (!isPosition(input.startPosition)) {
    return editorFailure("invalid_position", "開始ノードの位置が範囲外です");
  }

  const startNodeId = "node_1" as NodeId;
  return editorSuccess({
    id: input.id,
    nodes: [
      {
        id: startNodeId,
        instructionId: input.startInstructionId,
        parameterValues: {},
        connections: {},
      },
    ],
    startNodeId,
    nextNodeSequence: 2 as Int32,
    metadata: {
      ...input.metadata,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    editorState: {
      nodePositions: { [startNodeId]: input.startPosition },
      comments: {},
    },
  });
};

/** `spec/editor/nodes.md`のNodeを追加する。 */
export const addNode = (
  program: Program,
  instruction: InstructionDefinition,
  position: Position,
  updatedAt: string,
): EditorResult<{ readonly program: Program; readonly nodeId: NodeId }> => {
  if (!instruction.enabled) {
    return editorFailure("invalid_instruction", "無効な命令は追加できません");
  }
  if (!isPosition(position)) {
    return editorFailure("invalid_position", "ノードの位置が範囲外です");
  }
  if (program.nextNodeSequence >= INT32_MAX) {
    return editorFailure(
      "node_sequence_exhausted",
      "Node IDをこれ以上発番できません",
    );
  }

  const nodeId = `node_${program.nextNodeSequence}` as NodeId;
  const node: ProgramNode = {
    id: nodeId,
    instructionId: instruction.id,
    parameterValues: defaultParameterValues(instruction),
    connections: {},
  };
  const nextProgram = withUpdatedAt(
    {
      ...program,
      nodes: [...program.nodes, node],
      nextNodeSequence: (program.nextNodeSequence + 1) as Int32,
      editorState: {
        ...program.editorState,
        nodePositions: {
          ...program.editorState.nodePositions,
          [nodeId]: position,
        },
      },
    },
    updatedAt,
  );

  return editorSuccess({ program: nextProgram, nodeId });
};

/** `spec/editor/nodes.md`のNode群を原子的に削除する。 */
export const deleteNodes = (
  program: Program,
  nodeIds: ReadonlySet<NodeId>,
  updatedAt: string,
): EditorResult<Program> => {
  if (nodeIds.size === 0) {
    return editorFailure("empty_selection", "削除対象がありません");
  }
  const existingIds = new Set(program.nodes.map(({ id }) => id));
  if ([...nodeIds].some((nodeId) => !existingIds.has(nodeId))) {
    return editorFailure("missing_node", "存在しないノードが含まれています");
  }
  if (nodeIds.has(program.startNodeId)) {
    return editorFailure("start_node_deletion", "開始ノードは削除できません");
  }

  const nodes = program.nodes
    .filter(({ id }) => !nodeIds.has(id))
    .map((node) => ({
      ...node,
      connections: Object.fromEntries(
        Object.entries(node.connections).filter(
          ([, targetNodeId]) => !nodeIds.has(targetNodeId),
        ),
      ),
    }));
  const nodePositions = Object.fromEntries(
    Object.entries(program.editorState.nodePositions).filter(
      ([nodeId]) => !nodeIds.has(nodeId as NodeId),
    ),
  ) as Readonly<Record<NodeId, Position>>;
  const comments = Object.fromEntries(
    Object.entries(program.editorState.comments).filter(
      ([nodeId]) => !nodeIds.has(nodeId as NodeId),
    ),
  ) as Readonly<Record<NodeId, string>>;

  return editorSuccess(
    withUpdatedAt(
      {
        ...program,
        nodes,
        editorState: { nodePositions, comments },
      },
      updatedAt,
    ),
  );
};

/** `spec/editor/nodes.md`のNode群の確定位置を反映する。 */
export const moveNodes = (
  program: Program,
  positions: Readonly<Record<NodeId, Position>>,
  updatedAt: string,
): EditorResult<Program> => {
  const entries = Object.entries(positions) as [NodeId, Position][];
  const existingIds = new Set(program.nodes.map(({ id }) => id));
  if (entries.some(([nodeId]) => !existingIds.has(nodeId))) {
    return editorFailure("missing_node", "存在しないノードが含まれています");
  }
  if (entries.some(([, position]) => !isPosition(position))) {
    return editorFailure("invalid_position", "ノードの位置が範囲外です");
  }
  const changed = entries.some(
    ([nodeId, position]) =>
      program.editorState.nodePositions[nodeId]?.x !== position.x ||
      program.editorState.nodePositions[nodeId]?.y !== position.y,
  );
  if (!changed) return editorSuccess(program, false);

  return editorSuccess(
    withUpdatedAt(
      {
        ...program,
        editorState: {
          ...program.editorState,
          nodePositions: {
            ...program.editorState.nodePositions,
            ...positions,
          },
        },
      },
      updatedAt,
    ),
  );
};

export const updateProgramMetadata = (
  program: Program,
  metadata: ProgramMetadataInput,
  updatedAt: string,
): EditorResult<Program> => {
  if (
    program.metadata.name === metadata.name &&
    program.metadata.author === metadata.author &&
    program.metadata.description === metadata.description
  ) {
    return editorSuccess(program, false);
  }
  return editorSuccess(
    withUpdatedAt(
      { ...program, metadata: { ...program.metadata, ...metadata } },
      updatedAt,
    ),
  );
};

export const setParameterValue = (
  program: Program,
  nodeId: NodeId,
  parameterId: string,
  value: ParameterValue | undefined,
  updatedAt: string,
): EditorResult<Program> => {
  const node = program.nodes.find(({ id }) => id === nodeId);
  if (node === undefined) {
    return editorFailure("missing_node", "対象ノードが存在しません");
  }
  const currentValue = node.parameterValues[parameterId];
  if (JSON.stringify(currentValue) === JSON.stringify(value)) {
    return editorSuccess(program, false);
  }
  const parameterValues = { ...node.parameterValues };
  if (value === undefined) delete parameterValues[parameterId];
  else parameterValues[parameterId] = value;

  return editorSuccess(
    withUpdatedAt(
      {
        ...program,
        nodes: program.nodes.map((candidate) =>
          candidate.id === nodeId
            ? { ...candidate, parameterValues }
            : candidate,
        ),
      },
      updatedAt,
    ),
  );
};

export const setNodeComment = (
  program: Program,
  nodeId: NodeId,
  comment: string,
  updatedAt: string,
): EditorResult<Program> => {
  if (!program.nodes.some(({ id }) => id === nodeId)) {
    return editorFailure("missing_node", "対象ノードが存在しません");
  }
  if ((program.editorState.comments[nodeId] ?? "") === comment) {
    return editorSuccess(program, false);
  }
  const comments = { ...program.editorState.comments };
  if (comment === "") delete comments[nodeId];
  else comments[nodeId] = comment;

  return editorSuccess(
    withUpdatedAt(
      {
        ...program,
        editorState: { ...program.editorState, comments },
      },
      updatedAt,
    ),
  );
};
