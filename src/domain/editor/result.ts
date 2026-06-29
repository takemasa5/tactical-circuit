/** Phase 2 Editor操作がUIへ返す安定したエラー分類。 */
export type EditorErrorCode =
  | "empty_selection"
  | "invalid_instruction"
  | "invalid_position"
  | "missing_clipboard_data"
  | "missing_connection"
  | "missing_node"
  | "node_sequence_exhausted"
  | "start_node_deletion";

/** `spec/editor/phase2.md`の編集操作結果。 */
export type EditorResult<T> =
  | { readonly success: true; readonly changed: boolean; readonly data: T }
  | {
      readonly success: false;
      readonly code: EditorErrorCode;
      readonly message: string;
    };

export const editorSuccess = <T>(data: T, changed = true): EditorResult<T> => ({
  success: true,
  changed,
  data,
});

export const editorFailure = <T>(
  code: EditorErrorCode,
  message: string,
): EditorResult<T> => ({ success: false, code, message });
