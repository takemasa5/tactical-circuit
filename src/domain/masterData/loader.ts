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
  const manifest = loadJsonEnvelope(
    manifestJson,
    "master_data_manifest",
    manifestValidator,
  );
  if (!manifest.success) {
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
    return { success: false, errors };
  }

  const repository = createDataRepository(entries, implementationIds);
  if (!repository.success) {
    return repository;
  }

  return {
    success: true,
    data: {
      masterDataVersion: manifest.data.payload.masterDataVersion,
      repository: repository.data,
    },
  };
};
