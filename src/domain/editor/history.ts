import type { Program } from "../program/models";

export const HISTORY_LIMIT = 100;

/** `spec/editor/history.md`のProgram全体を対象とする履歴状態。 */
export type HistoryState = {
  readonly past: readonly Program[];
  readonly present: Program;
  readonly future: readonly Program[];
};

export const createHistory = (program: Program): HistoryState => ({
  past: [],
  present: program,
  future: [],
});

/** `spec/editor/history.md`の変更済みProgramを履歴へ追加する。 */
export const pushHistory = (
  history: HistoryState,
  program: Program,
): HistoryState => ({
  past: [...history.past, history.present].slice(-HISTORY_LIMIT),
  present: program,
  future: [],
});

export const canUndo = (history: HistoryState): boolean =>
  history.past.length > 0;

export const canRedo = (history: HistoryState): boolean =>
  history.future.length > 0;

/** `spec/editor/history.md`のUndoを実行する。 */
export const undoHistory = (history: HistoryState): HistoryState => {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
};

/** `spec/editor/history.md`のRedoを実行する。 */
export const redoHistory = (history: HistoryState): HistoryState => {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
};
