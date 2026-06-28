import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

import {
  CURRENT_FORMAT_VERSION,
  isFormatVersion,
  parseJson,
  type FormatVersion,
  type JsonEnvelope,
} from "./common";
import {
  loadFailure,
  loadSuccess,
  type DataValidationError,
  type LoadResult,
} from "./loadResult";

const ajv = new Ajv({ allErrors: true });

const envelopeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataType", "formatVersion", "payload"],
  properties: {
    dataType: { type: "string", minLength: 1 },
    formatVersion: {
      type: "string",
      pattern: "^(0|[1-9]\\d*)\\.([1-9]\\d*)\\.([1-9]\\d*)$",
    },
    payload: {},
  },
} as const;

const validateEnvelope = ajv.compile(envelopeSchema);

const validationError = (
  code: string,
  path: string,
  message: string,
  actualValue: unknown,
  expected: string,
): DataValidationError => ({
  code,
  path,
  message,
  actualValue,
  expected,
});

const fromAjvError = (
  error: ErrorObject,
  actualValue: unknown,
): DataValidationError =>
  validationError(
    `schema_${error.keyword}`,
    error.instancePath || "$",
    error.message ?? "JSON Schemaに適合しません",
    actualValue,
    JSON.stringify(error.params),
  );

const currentMajor = Number(CURRENT_FORMAT_VERSION.split(".")[0]);

const isSupportedVersion = (version: FormatVersion): boolean =>
  Number(version.split(".")[0]) === currentMajor;

export const loadJsonEnvelope = <TDataType extends string, TPayload>(
  value: string,
  expectedDataType: TDataType,
  validatePayload: ValidateFunction<TPayload>,
): LoadResult<JsonEnvelope<TDataType, TPayload>> => {
  const parsed = parseJson(value);
  if (!parsed.success) {
    return parsed;
  }

  if (!validateEnvelope(parsed.data)) {
    return {
      success: false,
      errors: (validateEnvelope.errors ?? []).map((error) =>
        fromAjvError(error, parsed.data),
      ),
    };
  }

  const envelope = parsed.data as JsonEnvelope<string, unknown>;
  if (envelope.dataType !== expectedDataType) {
    return loadFailure(
      validationError(
        "unexpected_data_type",
        "/dataType",
        "保存データの種別が一致しません",
        envelope.dataType,
        expectedDataType,
      ),
    );
  }

  if (
    !isFormatVersion(envelope.formatVersion) ||
    !isSupportedVersion(envelope.formatVersion)
  ) {
    return loadFailure(
      validationError(
        "unsupported_format_version",
        "/formatVersion",
        "未対応の保存形式バージョンです",
        envelope.formatVersion,
        `major version ${currentMajor}`,
      ),
    );
  }

  if (!validatePayload(envelope.payload)) {
    return {
      success: false,
      errors: (validatePayload.errors ?? []).map((error) =>
        fromAjvError(error, envelope.payload),
      ),
    };
  }

  return loadSuccess({
    dataType: expectedDataType,
    formatVersion: envelope.formatVersion,
    payload: envelope.payload,
  });
};

export const saveJsonEnvelope = <TDataType extends string, TPayload>(
  dataType: TDataType,
  payload: TPayload,
): string =>
  JSON.stringify({
    dataType,
    formatVersion: CURRENT_FORMAT_VERSION,
    payload,
  } satisfies JsonEnvelope<TDataType, TPayload>);

export const compileJsonSchema = <T>(schema: object): ValidateFunction<T> =>
  ajv.compile<T>(schema);
