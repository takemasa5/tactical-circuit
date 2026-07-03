import { PRODUCTION_IMPLEMENTATION_IDS } from "../domain/ai/instructions";
import { loadDataRepository } from "../domain/masterData/loader";
import type { DataRepository } from "../domain/masterData/repository";
import type {
  InstructionDefinition,
  InstructionId,
} from "../domain/masterData/models";

const MASTER_DATA_MANIFEST_PATH = "/master-data/manifest.json";
const INSTRUCTION_MANIFEST_PATH = "/master-data/instructions/manifest.json";
const INSTRUCTION_FILE_PATTERN = /^[^/\\]+\.json$/;

export const START_INSTRUCTION_ID =
  "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId;

/** build前に生成するInstruction Definitionファイル一覧。 */
export type InstructionDocumentManifest = {
  readonly files: readonly string[];
};

/** 取得元ファイルを保持するEditor用Master Data文書。 */
export type EditorMasterDataDocument = {
  readonly path: string;
  readonly json: string;
};

/** `docs/specs/current/editor/phase2.md`と`docs/specs/current/editor/validator.md`のEditor起動用Master Data。 */
export type EditorMasterData = {
  readonly instructions: readonly InstructionDefinition[];
  readonly startInstructionId: InstructionId;
  readonly repository: DataRepository;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseInstructionDocumentManifest = (
  json: string,
): InstructionDocumentManifest => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    throw new Error("Instruction manifest is not valid JSON", { cause: error });
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.files)) {
    throw new Error("Instruction manifest must contain a files array");
  }
  const files = parsed.files;
  if (
    files.some(
      (file) =>
        typeof file !== "string" ||
        !INSTRUCTION_FILE_PATTERN.test(file) ||
        file === "manifest.json",
    )
  ) {
    throw new Error("Instruction manifest contains an invalid file name");
  }
  if (new Set(files).size !== files.length) {
    throw new Error("Instruction manifest contains duplicate file names");
  }
  return { files };
};

/** 取得済みJSONをData Repositoryで検証してEditor入力へ変換する。 */
export const parseEditorMasterData = (
  manifestJson: string,
  documents: readonly EditorMasterDataDocument[],
): EditorMasterData => {
  const loaded = loadDataRepository(
    manifestJson,
    documents.map(({ path, json }) => ({
      dataType: "instruction" as const,
      json,
      sourcePath: path,
    })),
    PRODUCTION_IMPLEMENTATION_IDS,
  );
  if (!loaded.success) {
    throw new Error(
      `Master Data validation failed: ${loaded.errors
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`,
    );
  }
  const startInstruction = loaded.data.repository.get(
    "instruction",
    START_INSTRUCTION_ID,
  );
  if (startInstruction?.implementationId !== "start") {
    const error = new Error(
      "Start Instruction Definition is missing or invalid",
    );
    console.error("[editor-master-data] start instruction invalid", {
      instructionId: START_INSTRUCTION_ID,
      implementationId: startInstruction?.implementationId ?? null,
      error,
    });
    throw error;
  }
  return {
    instructions: loaded.data.repository.getAll("instruction"),
    startInstructionId: START_INSTRUCTION_ID,
    repository: loaded.data.repository,
  };
};

const fetchText = async (path: string): Promise<string> => {
  let response: Response;
  try {
    response = await fetch(path);
  } catch (error) {
    console.error("[editor-master-data] fetch failed", { path, error });
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    console.error("[editor-master-data] fetch failed", { path, error });
    throw error;
  }
  try {
    return await response.text();
  } catch (error) {
    console.error("[editor-master-data] response read failed", { path, error });
    throw error;
  }
};

/** Program Editorで使用する検証済みMaster Dataを読み込む。 */
export const loadEditorMasterData = async (): Promise<EditorMasterData> => {
  console.info("[editor-master-data] load start", {
    masterDataManifestPath: MASTER_DATA_MANIFEST_PATH,
    instructionManifestPath: INSTRUCTION_MANIFEST_PATH,
  });
  try {
    const [manifestJson, instructionManifestJson] = await Promise.all([
      fetchText(MASTER_DATA_MANIFEST_PATH),
      fetchText(INSTRUCTION_MANIFEST_PATH),
    ]);
    let instructionManifest: InstructionDocumentManifest;
    try {
      instructionManifest = parseInstructionDocumentManifest(
        instructionManifestJson,
      );
    } catch (error) {
      console.error("[editor-master-data] instruction manifest invalid", {
        path: INSTRUCTION_MANIFEST_PATH,
        error,
      });
      throw error;
    }
    const paths = instructionManifest.files.map(
      (file) => `/master-data/instructions/${file}`,
    );
    const jsonDocuments = await Promise.all(paths.map(fetchText));
    const masterData = parseEditorMasterData(
      manifestJson,
      paths.map((path, index) => ({
        path,
        json: jsonDocuments[index] ?? "",
      })),
    );
    console.info("[editor-master-data] load complete", {
      instructionCount: masterData.instructions.length,
      paths,
    });
    return masterData;
  } catch (error) {
    console.error("[editor-master-data] load failed", { error });
    throw error;
  }
};
