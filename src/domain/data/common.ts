import { loadFailure, loadSuccess, type LoadResult } from "./loadResult";

export const INT32_MIN = -2_147_483_648;
export const INT32_MAX = 2_147_483_647;
export const CURRENT_FORMAT_VERSION = "0.1.1" as const;

/** `docs/specs/current/12_common_data_conventions.md`の符号付き32bit整数。 */
export type Int32 = number & { readonly __brand: "Int32" };
/** `docs/specs/current/12_common_data_conventions.md`の3要素バージョン文字列。 */
export type FormatVersion = `${number}.${number}.${number}`;

/** `docs/specs/current/11_coordinate_system.md`の論理座標。 */
export type Position = {
  x: Int32;
  y: Int32;
};

/** `docs/specs/current/11_coordinate_system.md`の方向と移動量。 */
export type Vector = {
  x: Int32;
  y: Int32;
};

/** `docs/specs/current/11_coordinate_system.md`の軸平行矩形サイズ。 */
export type Size = {
  width: Int32;
  height: Int32;
};

/** `docs/specs/current/12_common_data_conventions.md`の保存JSON共通ヘッダ。 */
export type JsonEnvelope<TDataType extends string, TPayload> = {
  dataType: TDataType;
  formatVersion: FormatVersion;
  payload: TPayload;
};

export const toInt32 = (value: unknown, path = "$"): LoadResult<Int32> => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < INT32_MIN ||
    value > INT32_MAX
  ) {
    return loadFailure({
      code: "invalid_int32",
      path,
      message: "符号付き32bit整数ではありません",
      actualValue: value,
      expected: `${INT32_MIN}以上${INT32_MAX}以下の整数`,
    });
  }

  return loadSuccess(value as Int32);
};

export const normalizeAngle = (angle: Int32): Int32 => {
  const normalized = ((angle % 360) + 360) % 360;
  return normalized as Int32;
};

export const isFormatVersion = (value: unknown): value is FormatVersion => {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(0|[1-9]\d*)\.([1-9]\d*)\.([1-9]\d*)$/.exec(value);
  return match !== null;
};

export const parseJson = (value: string): LoadResult<unknown> => {
  try {
    return loadSuccess(JSON.parse(value) as unknown);
  } catch {
    return loadFailure({
      code: "invalid_json",
      path: "$",
      message: "JSONを解析できません",
      actualValue: value,
      expected: "有効なJSON文字列",
    });
  }
};
