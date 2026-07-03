import { loadJsonEnvelope, saveJsonEnvelope } from "../data/jsonEnvelope";
import type { LoadResult } from "../data/loadResult";
import type { Program, ProgramNode } from "./models";
import { programValidator } from "./schema";

const compareIds = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const sortRecord = <T>(
  values: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> =>
  Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => compareIds(left, right)),
  );

const canonicalNode = (node: ProgramNode): ProgramNode => ({
  ...node,
  parameterValues: sortRecord(node.parameterValues),
  connections: sortRecord(node.connections),
});

/** `docs/specs/current/editor/program_model.md`の順序不問データを安定した保存順へ整える。 */
export const canonicalizeProgram = (program: Program): Program => ({
  ...program,
  nodes: [...program.nodes]
    .sort((left, right) => compareIds(left.id, right.id))
    .map(canonicalNode),
  editorState: {
    nodePositions: sortRecord(program.editorState.nodePositions),
    comments: sortRecord(program.editorState.comments),
  },
});

/** `docs/specs/current/editor/program_model.md`に従いProgramをJSONへ保存する。 */
export const saveProgram = (program: Program): string =>
  saveJsonEnvelope("program", canonicalizeProgram(program));

/** `docs/specs/current/editor/program_model.md`に従いProgram JSONの構造だけを検証する。 */
export const loadProgram = (value: string): LoadResult<Program> => {
  const result = loadJsonEnvelope(value, "program", programValidator);
  if (!result.success) return result;
  return { success: true, data: result.data.payload };
};
