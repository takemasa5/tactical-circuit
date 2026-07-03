import type { ProgramId } from "../data/ids";
import type { DataValidationError } from "../data/loadResult";
import { loadProgram, saveProgram } from "../program/codec";
import type { Program } from "../program/models";

const PROGRAM_KEY_PREFIX = "tactical-circuit:program:";

/** `docs/specs/current/editor/persistence.md`の永続化エラー分類。 */
export type PersistenceErrorCode =
  | "storage_unavailable"
  | "storage_write_failed"
  | "program_not_found"
  | "invalid_program";

/** `docs/specs/current/editor/persistence.md`の保存・読込操作結果。 */
export type PersistenceResult<T> =
  | { readonly success: true; readonly data: T }
  | {
      readonly success: false;
      readonly code: PersistenceErrorCode;
      readonly message: string;
      readonly validationErrors?: readonly DataValidationError[];
    };

/** `docs/specs/current/editor/persistence.md`のExportファイル情報。 */
export type ProgramExport = {
  readonly filename: string;
  readonly json: string;
};

const storageKey = (programId: ProgramId): string =>
  `${PROGRAM_KEY_PREFIX}${programId}`;

/** `docs/specs/current/editor/persistence.md`に従いlocalStorageへProgramを保存する。 */
export const saveProgramToStorage = (
  storage: Storage,
  program: Program,
): PersistenceResult<string> => {
  const json = saveProgram(program);
  try {
    storage.setItem(storageKey(program.id), json);
    return { success: true, data: json };
  } catch {
    return {
      success: false,
      code: "storage_write_failed",
      message: "ProgramをlocalStorageへ保存できませんでした",
    };
  }
};

/** localStorageに保存されたProgram IDを決定的な順序で返す。 */
export const listStoredProgramIds = (
  storage: Storage,
): PersistenceResult<readonly ProgramId[]> => {
  try {
    const programIds: ProgramId[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(PROGRAM_KEY_PREFIX) === true) {
        programIds.push(key.slice(PROGRAM_KEY_PREFIX.length) as ProgramId);
      }
    }
    return { success: true, data: programIds.sort() };
  } catch {
    return {
      success: false,
      code: "storage_unavailable",
      message: "localStorageを利用できません",
    };
  }
};

/** `docs/specs/current/editor/persistence.md`に従いlocalStorageからProgramを読み込む。 */
export const loadProgramFromStorage = (
  storage: Storage,
  programId: ProgramId,
): PersistenceResult<{ readonly program: Program; readonly json: string }> => {
  let json: string | null;
  try {
    json = storage.getItem(storageKey(programId));
  } catch {
    return {
      success: false,
      code: "storage_unavailable",
      message: "localStorageからProgramを取得できません",
    };
  }
  if (json === null) {
    return {
      success: false,
      code: "program_not_found",
      message: "保存済みProgramが見つかりません",
    };
  }
  const loaded = loadProgram(json);
  if (!loaded.success) {
    return {
      success: false,
      code: "invalid_program",
      message: "保存済みProgramの形式が不正です",
      validationErrors: loaded.errors,
    };
  }
  return {
    success: true,
    data: { program: loaded.data, json: saveProgram(loaded.data) },
  };
};

/** 現在のProgramをファイル出力可能な値へ変換する。 */
export const exportProgram = (program: Program): ProgramExport => ({
  filename: `program-${program.id.slice("program_".length)}.json`,
  json: saveProgram(program),
});

/** UTF-8ファイルから取得した文字列をProgramとしてImportする。 */
export const importProgram = (json: string): PersistenceResult<Program> => {
  const loaded = loadProgram(json);
  if (!loaded.success) {
    return {
      success: false,
      code: "invalid_program",
      message: "ImportするProgramの形式が不正です",
      validationErrors: loaded.errors,
    };
  }
  return { success: true, data: loaded.data };
};

export const hasUnsavedChanges = (
  baselineJson: string | null,
  program: Program,
): boolean => baselineJson === null || baselineJson !== saveProgram(program);
