import { compileJsonSchema, loadJsonEnvelope } from "../data/jsonEnvelope";
import type { FormatVersion } from "../data/common";
import type { DataValidationError, LoadResult } from "../data/loadResult";
import type { MasterDataByType, MasterDataType } from "./models";
import {
  createDataRepository,
  type DataRepository,
  type MasterDataEntry,
} from "./repository";
import { getMasterDataValidator } from "./schemas";

/** `spec/15_master_data.md`のMaster Data Manifest payload。 */
export type MasterDataManifest = {
  readonly masterDataVersion: FormatVersion;
};

/** `spec/15_master_data.md`から読み込む1 JSON文書。 */
export type MasterDataDocument = {
  readonly dataType: MasterDataType;
  readonly json: string;
  readonly sourcePath?: string;
};

const manifestValidator = compileJsonSchema<MasterDataManifest>({
  type: "object",
  additionalProperties: false,
  required: ["masterDataVersion"],
  properties: {
    masterDataVersion: {
      type: "string",
      pattern: "^(0|[1-9]\\d*)\\.([1-9]\\d*)\\.([1-9]\\d*)$",
    },
  },
});

export const loadMasterDataDefinition = <TType extends MasterDataType>(
  document: MasterDataDocument & { readonly dataType: TType },
): LoadResult<MasterDataByType[TType]> => {
  const result = loadJsonEnvelope(
    document.json,
    document.dataType,
    getMasterDataValidator(document.dataType),
  );
  if (!result.success) {
    console.error("[master-data] definition validation failed", {
      sourcePath: document.sourcePath ?? null,
      dataType: document.dataType,
      errors: result.errors,
    });
    return result;
  }
  return { success: true, data: result.data.payload };
};

export const loadDataRepository = (
  manifestJson: string,
  documents: readonly MasterDataDocument[],
  implementationIds: ReadonlySet<string>,
): LoadResult<{
  readonly masterDataVersion: FormatVersion;
  readonly repository: DataRepository;
}> => {
  console.info("[master-data] repository load start", {
    documentCount: documents.length,
    sourcePaths: documents.map(({ sourcePath }) => sourcePath ?? null),
  });
  const manifest = loadJsonEnvelope(
    manifestJson,
    "master_data_manifest",
    manifestValidator,
  );
  if (!manifest.success) {
    console.error("[master-data] manifest validation failed", {
      errors: manifest.errors,
    });
    return manifest;
  }

  const entries: MasterDataEntry[] = [];
  const errors: DataValidationError[] = [];
  documents.forEach((document) => {
    const loaded = loadMasterDataDefinition(document);
    if (loaded.success) {
      entries.push({
        dataType: document.dataType,
        definition: loaded.data,
      } as MasterDataEntry);
    } else {
      errors.push(...loaded.errors);
    }
  });
  if (errors.length > 0) {
    console.error("[master-data] definition load failed", { errors });
    return { success: false, errors };
  }

  const repository = createDataRepository(entries, implementationIds);
  if (!repository.success) {
    console.error("[master-data] repository validation failed", {
      errors: repository.errors.map((validationError) => {
        const definitionIndex = Number(
          /^\/definitions\/(\d+)/.exec(validationError.path)?.[1] ?? -1,
        );
        return {
          sourcePath: documents[definitionIndex]?.sourcePath ?? null,
          ...validationError,
        };
      }),
    });
    return repository;
  }

  console.info("[master-data] repository load complete", {
    documentCount: documents.length,
    masterDataVersion: manifest.data.payload.masterDataVersion,
  });
  return {
    success: true,
    data: {
      masterDataVersion: manifest.data.payload.masterDataVersion,
      repository: repository.data,
    },
  };
};
