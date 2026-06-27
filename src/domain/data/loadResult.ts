/** `spec/12_common_data_conventions.md`のJSON読込エラーを表す。 */
export type DataValidationError = {
  code: string;
  path: string;
  message: string;
  actualValue: unknown;
  expected: string;
};

/** `spec/12_common_data_conventions.md`の安全な読込成功・拒否を表す。 */
export type LoadResult<T> =
  | { success: true; data: T }
  | { success: false; errors: DataValidationError[] };

export const loadSuccess = <T>(data: T): LoadResult<T> => ({
  success: true,
  data,
});

export const loadFailure = <T>(error: DataValidationError): LoadResult<T> => ({
  success: false,
  errors: [error],
});
