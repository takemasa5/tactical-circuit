import type { NodeId } from "../data/ids";
import type { Program } from "../program/models";

/** `docs/specs/current/editor/selection.md`の接続選択。 */
export type ConnectionSelection = {
  readonly sourceNodeId: NodeId;
  readonly outputPathId: string;
};

/** `docs/specs/current/editor/selection.md`の編集セッション内選択状態。 */
export type EditorSelection = {
  readonly nodeIds: ReadonlySet<NodeId>;
  readonly connection: ConnectionSelection | null;
};

export const emptySelection = (): EditorSelection => ({
  nodeIds: new Set(),
  connection: null,
});

export const selectNode = (
  selection: EditorSelection,
  nodeId: NodeId,
  additive: boolean,
): EditorSelection => {
  if (!additive) return { nodeIds: new Set([nodeId]), connection: null };
  const nodeIds = new Set(selection.nodeIds);
  if (nodeIds.has(nodeId)) nodeIds.delete(nodeId);
  else nodeIds.add(nodeId);
  return { nodeIds, connection: null };
};

export const selectConnection = (
  connection: ConnectionSelection,
): EditorSelection => ({ nodeIds: new Set(), connection });

/** Program変更後に存在しない選択対象を除外する。 */
export const reconcileSelection = (
  selection: EditorSelection,
  program: Program,
): EditorSelection => {
  const existingNodeIds = new Set(program.nodes.map(({ id }) => id));
  const nodeIds = new Set(
    [...selection.nodeIds].filter((nodeId) => existingNodeIds.has(nodeId)),
  );
  const { connection } = selection;
  const source =
    connection === null
      ? undefined
      : program.nodes.find(({ id }) => id === connection.sourceNodeId);
  const reconciledConnection =
    source?.connections[connection?.outputPathId ?? ""] === undefined
      ? null
      : connection;
  return { nodeIds, connection: reconciledConnection };
};
