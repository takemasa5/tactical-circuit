import { PRODUCTION_IMPLEMENTATION_IDS } from "../domain/ai/instructions";
import { loadDataRepository } from "../domain/masterData/loader";
import type { DataRepository } from "../domain/masterData/repository";
import type {
  InstructionDefinition,
  InstructionId,
  MasterDataType,
} from "../domain/masterData/models";

const MASTER_DATA_MANIFEST_PATH = "/master-data/manifest.json";
const INSTRUCTION_MANIFEST_PATH = "/master-data/instructions/manifest.json";
const BATTLE_MANIFEST_PATH = "/master-data/battle/manifest.json";
const INSTRUCTION_FILE_PATTERN = /^[^/\\]+\.json$/;
const BATTLE_FILE_PATTERN = /^[^/\\]+\.json$/;
const battleDataTypes: ReadonlySet<MasterDataType> = new Set([
  "robot_body",
  "engine",
  "sensor",
  "projectile",
  "weapon",
  "map",
  "game_rule",
]);

export const START_INSTRUCTION_ID =
  "instruction_550e8400-e29b-41d4-a716-446655440000" as InstructionId;

/** build前に生成するInstruction Definitionファイル一覧。 */
export type InstructionDocumentManifest = {
  readonly files: readonly string[];
};

/** Phase 1固定対戦に必要なMaster Data文書の一覧。 */
export type BattleDocumentManifest = {
  readonly files: readonly {
    readonly dataType: MasterDataType;
    readonly path: string;
  }[];
};

/** 取得元ファイルを保持するEditor用Master Data文書。 */
export type EditorMasterDataDocument = {
  readonly dataType?: MasterDataType;
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

export const parseBattleDocumentManifest = (
  json: string,
): BattleDocumentManifest => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    throw new Error("Battle manifest is not valid JSON", { cause: error });
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.files)) {
    throw new Error("Battle manifest must contain a files array");
  }
  const files = parsed.files;
  if (
    files.some(
      (file) =>
        !isRecord(file) ||
        typeof file.dataType !== "string" ||
        !battleDataTypes.has(file.dataType as MasterDataType) ||
        typeof file.path !== "string" ||
        !BATTLE_FILE_PATTERN.test(file.path),
    )
  ) {
    throw new Error("Battle manifest contains an invalid document");
  }
  const paths = files.map(({ path }) => path as string);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Battle manifest contains duplicate file names");
  }
  return {
    files: files.map(({ dataType, path }) => ({
      dataType: dataType as MasterDataType,
      path: path as string,
    })),
  };
};

/** 取得済みJSONをData Repositoryで検証してEditor入力へ変換する。 */
export const parseEditorMasterData = (
  manifestJson: string,
  documents: readonly EditorMasterDataDocument[],
): EditorMasterData => {
  const loaded = loadDataRepository(
    manifestJson,
    documents.map(({ dataType = "instruction", path, json }) => ({
      dataType,
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
    battleManifestPath: BATTLE_MANIFEST_PATH,
  });
  try {
    const [manifestJson, instructionManifestJson, battleManifestJson] =
      await Promise.all([
        fetchText(MASTER_DATA_MANIFEST_PATH),
        fetchText(INSTRUCTION_MANIFEST_PATH),
        fetchText(BATTLE_MANIFEST_PATH),
      ]);
    let instructionManifest: InstructionDocumentManifest;
    let battleManifest: BattleDocumentManifest;
    try {
      instructionManifest = parseInstructionDocumentManifest(
        instructionManifestJson,
      );
      battleManifest = parseBattleDocumentManifest(battleManifestJson);
    } catch (error) {
      console.error("[editor-master-data] manifest invalid", {
        path: INSTRUCTION_MANIFEST_PATH,
        error,
      });
      throw error;
    }
    const paths = instructionManifest.files.map(
      (file) => `/master-data/instructions/${file}`,
    );
    const battleDocuments = battleManifest.files.map(({ dataType, path }) => ({
      dataType,
      path: `/master-data/battle/${path}`,
    }));
    const jsonDocuments = await Promise.all([
      ...paths.map(fetchText),
      ...battleDocuments.map(({ path }) => fetchText(path)),
    ]);
    const masterData = parseEditorMasterData(manifestJson, [
      ...paths.map((path, index) => ({
        path,
        json: jsonDocuments[index] ?? "",
      })),
      ...battleDocuments.map(({ dataType, path }, index) => ({
        dataType,
        path,
        json: jsonDocuments[paths.length + index] ?? "",
      })),
    ]);
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
