import { loadDataRepository } from "../domain/masterData/loader";
import type { DataRepository } from "../domain/masterData/repository";
import type {
  InstructionDefinition,
  InstructionId,
} from "../domain/masterData/models";

export const START_INSTRUCTION_ID =
  "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId;

export const EDITOR_MASTER_DATA_DOCUMENTS = [
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/start.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/end.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/fire.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/move_forward.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/move_backward.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/turn.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/detect_enemy.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/compare_distance.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/call.json",
  },
  {
    dataType: "instruction" as const,
    path: "/master-data/instructions/return.json",
  },
] as const;

const editorImplementationIds = new Set([
  "start",
  "end",
  "fire",
  "move_forward",
  "move_backward",
  "turn",
  "detect_enemy",
  "compare_distance",
  "call",
  "return",
]);

/** `spec/editor/phase2.md`と`spec/editor/validator.md`のEditor起動用Master Data。 */
export type EditorMasterData = {
  readonly instructions: readonly InstructionDefinition[];
  readonly startInstructionId: InstructionId;
  readonly repository: DataRepository;
};

/** 取得済みJSONをData Repositoryで検証してEditor入力へ変換する。 */
export const parseEditorMasterData = (
  manifestJson: string,
  documentJson: readonly string[],
): EditorMasterData => {
  const loaded = loadDataRepository(
    manifestJson,
    EDITOR_MASTER_DATA_DOCUMENTS.map(({ dataType }, index) => ({
      dataType,
      json: documentJson[index] ?? "",
    })),
    editorImplementationIds,
  );
  if (!loaded.success) {
    throw new Error("Master Dataの検証に失敗しました");
  }
  return {
    instructions: loaded.data.repository.getAll("instruction"),
    startInstructionId: START_INSTRUCTION_ID,
    repository: loaded.data.repository,
  };
};

/** Program Editorで使用する検証済みMaster Dataを読み込む。 */
export const loadEditorMasterData = async (): Promise<EditorMasterData> => {
  const [manifestResponse, ...documentResponses] = await Promise.all([
    fetch("/master-data/manifest.json"),
    ...EDITOR_MASTER_DATA_DOCUMENTS.map(({ path }) => fetch(path)),
  ]);
  if (
    !manifestResponse.ok ||
    documentResponses.some((response) => !response.ok)
  ) {
    throw new Error("Master Dataを取得できませんでした");
  }
  const manifestJson = await manifestResponse.text();
  const documentJson = await Promise.all(
    documentResponses.map((response) => response.text()),
  );
  return parseEditorMasterData(manifestJson, documentJson);
};
