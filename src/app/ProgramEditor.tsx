import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";

import { toInt32, type Int32, type Position } from "../domain/data/common";
import type { NodeId, ProgramId } from "../domain/data/ids";
import {
  copyNodes,
  pasteNodes,
  type EditorClipboard,
} from "../domain/editor/clipboard";
import {
  connectNodes,
  disconnectNodes,
} from "../domain/editor/connectionOperations";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "../domain/editor/history";
import {
  exportProgram,
  hasUnsavedChanges,
  importProgram,
  listStoredProgramIds,
  loadProgramFromStorage,
  saveProgramToStorage,
} from "../domain/editor/persistence";
import {
  addNode,
  createProgram,
  deleteNodes,
  moveNodes,
  setNodeComment,
  setParameterValue,
  updateProgramMetadata,
} from "../domain/editor/programOperations";
import type { EditorResult } from "../domain/editor/result";
import {
  emptySelection,
  reconcileSelection,
  selectConnection,
  selectNode,
  type EditorSelection,
} from "../domain/editor/selection";
import type {
  InstructionDefinition,
  InstructionId,
  MasterDataId,
  ParameterDefinition,
} from "../domain/masterData/models";
import type { DataRepository } from "../domain/masterData/repository";
import type { ParameterValue, Program } from "../domain/program/models";
import { validateProgram } from "../domain/validator/validateProgram";

const NODE_WIDTH = 190;
const NODE_HEADER_HEIGHT = 52;
const NODE_BASE_HEIGHT = 78;
const NODE_PORTS_PADDING = 8;
const OUTPUT_PORT_HEIGHT = 24;
const OUTPUT_PORT_GAP = 4;
const INPUT_PORT_CENTER_Y = 24;
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 1200;
const MIN_ZOOM_PERCENT = 50;
const MAX_ZOOM_PERCENT = 200;
const ZOOM_STEP_PERCENT = 10;

/** `spec/editor/phase2.md`と`spec/editor/validator.md`のEditor起動入力。 */
type ProgramEditorProps = {
  readonly instructions: readonly InstructionDefinition[];
  readonly startInstructionId: InstructionId;
  readonly repository: DataRepository;
  readonly createId?: () => ProgramId;
  readonly now?: () => string;
};

/** `spec/editor/nodes.md`のドラッグ中だけ保持するNode位置。 */
type DragState = {
  readonly startX: number;
  readonly startY: number;
  readonly origins: Readonly<Record<NodeId, Position>>;
};

/** `spec/editor/selection.md`の矩形選択中だけ保持する範囲。 */
type SelectionBox = {
  readonly startX: number;
  readonly startY: number;
  readonly currentX: number;
  readonly currentY: number;
  readonly additive: boolean;
};

/** `spec/editor/connections.md`の接続ドラッグ中だけ保持する表示状態。 */
type PendingConnection = {
  readonly sourceNodeId: NodeId;
  readonly outputPathId: string;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly dragged: boolean;
};

const defaultCreateId = (): ProgramId =>
  `program_${crypto.randomUUID()}` as ProgramId;

const createInitialProgram = (
  startInstructionId: InstructionId,
  createId: () => ProgramId,
  now: () => string,
): Program => {
  const result = createProgram({
    id: createId(),
    startInstructionId,
    metadata: { name: "Untitled Program", author: "", description: "" },
    createdAt: now(),
    startPosition: { x: 80 as Int32, y: 100 as Int32 },
  });
  if (!result.success) throw new Error(result.message);
  return result.data;
};

const isTextInputTarget = (
  target: EventTarget | null,
): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
};

const TextCommitField = ({
  label,
  description,
  value,
  multiline = false,
  onCommit,
}: {
  readonly label: string;
  readonly description?: string;
  readonly value: string;
  readonly multiline?: boolean;
  readonly onCommit: (value: string) => void;
}) => {
  const field = multiline ? (
    <textarea
      key={value}
      defaultValue={value}
      onBlur={(event) => onCommit(event.currentTarget.value)}
    />
  ) : (
    <input
      key={value}
      defaultValue={value}
      onBlur={(event) => onCommit(event.currentTarget.value)}
    />
  );
  return (
    <label className="field">
      <span title={description}>{label}</span>
      {field}
    </label>
  );
};

const numericTypes = new Set([
  "distance",
  "degree",
  "tick",
  "cpu_cost",
  "count",
  "speed",
  "damage",
  "heat",
  "ammunition",
]);

const ParameterField = ({
  definition,
  value,
  nodeIds,
  onCommit,
}: {
  readonly definition: ParameterDefinition;
  readonly value: ParameterValue | undefined;
  readonly nodeIds: readonly NodeId[];
  readonly onCommit: (value: ParameterValue | undefined) => void;
}) => {
  const stringValue = typeof value === "string" ? value : "";
  if (definition.valueType === "boolean") {
    return (
      <label className="field field-inline">
        <span title={definition.description}>{definition.displayName}</span>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onCommit(event.target.checked)}
        />
      </label>
    );
  }
  if (definition.valueType === "enum") {
    return (
      <label className="field">
        <span title={definition.description}>{definition.displayName}</span>
        <select
          value={stringValue}
          onChange={(event) => onCommit(event.target.value)}
        >
          <option value="">未設定</option>
          {definition.enumValues?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (numericTypes.has(definition.valueType)) {
    return (
      <TextCommitField
        label={definition.displayName}
        description={definition.description}
        value={typeof value === "number" ? String(value) : ""}
        onCommit={(draft) => {
          if (draft === "") onCommit(undefined);
          else {
            const parsed = toInt32(Number(draft));
            if (parsed.success) onCommit(parsed.data);
          }
        }}
      />
    );
  }
  if (definition.valueType === "node_reference") {
    const selectedNodeId =
      typeof value === "object" && value?.type === "node_reference"
        ? value.nodeId
        : "";
    return (
      <label className="field">
        <span title={definition.description}>{definition.displayName}</span>
        <select
          value={selectedNodeId}
          onChange={(event) =>
            onCommit(
              event.target.value === ""
                ? undefined
                : {
                    type: "node_reference",
                    nodeId: event.target.value as NodeId,
                  },
            )
          }
        >
          <option value="">未設定</option>
          {nodeIds.map((nodeId) => (
            <option key={nodeId} value={nodeId}>
              {nodeId}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const referenceValue = (() => {
    if (typeof value !== "object" || value === null) return stringValue;
    switch (value.type) {
      case "register_reference":
        return value.registerName;
      case "flag_reference":
        return value.flagName;
      case "memory_reference":
        return value.indexRegisterName;
      case "master_data_reference":
        return value.id;
      default:
        return "";
    }
  })();
  return (
    <TextCommitField
      label={definition.displayName}
      description={definition.description}
      value={referenceValue}
      onCommit={(draft) => {
        if (draft === "") {
          onCommit(undefined);
          return;
        }
        switch (definition.valueType) {
          case "register_reference":
            onCommit({ type: "register_reference", registerName: draft });
            break;
          case "flag_reference":
            onCommit({ type: "flag_reference", flagName: draft });
            break;
          case "memory_reference":
            onCommit({ type: "memory_reference", indexRegisterName: draft });
            break;
          case "master_data_reference":
            if (definition.referenceDataType !== undefined) {
              onCommit({
                type: "master_data_reference",
                dataType: definition.referenceDataType,
                id: draft as MasterDataId,
              });
            }
            break;
          default:
            onCommit(draft);
        }
      }}
    />
  );
};

export function ProgramEditor({
  instructions,
  startInstructionId,
  repository,
  createId = defaultCreateId,
  now = () => new Date().toISOString(),
}: ProgramEditorProps) {
  const instructionMap = useMemo(
    () =>
      new Map(instructions.map((instruction) => [instruction.id, instruction])),
    [instructions],
  );
  const [history, setHistory] = useState<HistoryState>(() =>
    createHistory(createInitialProgram(startInstructionId, createId, now)),
  );
  const program = history.present;
  const programRef = useRef(program);
  useLayoutEffect(() => {
    programRef.current = program;
  }, [program]);
  const [selection, setSelection] = useState<EditorSelection>(emptySelection);
  const [clipboard, setClipboard] = useState<EditorClipboard | null>(null);
  const [baselineJson, setBaselineJson] = useState<string | null>(null);
  const [message, setMessage] = useState("新しいProgramを作成しました");
  const [storedProgramIds, setStoredProgramIds] = useState<
    readonly ProgramId[]
  >(() => {
    try {
      const result = listStoredProgramIds(window.localStorage);
      return result.success ? result.data : [];
    } catch {
      return [];
    }
  });
  const [selectedStoredId, setSelectedStoredId] = useState<ProgramId | "">("");
  const pendingConnectionRef = useRef<PendingConnection | null>(null);
  const [pendingConnection, setPendingConnection] =
    useState<PendingConnection | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewPositions, setPreviewPositions] = useState<
    Readonly<Record<NodeId, Position>>
  >({});
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const importInputRef = useRef<HTMLInputElement>(null);
  const zoom = zoomPercent / 100;

  const dirty = hasUnsavedChanges(baselineJson, program);
  const selectedNode =
    selection.nodeIds.size === 1
      ? program.nodes.find(({ id }) => selection.nodeIds.has(id))
      : undefined;
  const validationResult = useMemo(
    () => validateProgram(program, repository),
    [program, repository],
  );
  const errorCount = validationResult.diagnostics.filter(
    ({ severity }) => severity === "error",
  ).length;
  const warningCount = validationResult.diagnostics.length - errorCount;
  const validationSeverityByNode = useMemo(() => {
    const severities = new Map<NodeId, "error" | "warning">();
    validationResult.diagnostics.forEach((item) => {
      const nodeIds = [item.nodeId, ...item.relatedNodeIds].filter(
        (nodeId): nodeId is NodeId => nodeId !== null,
      );
      nodeIds.forEach((nodeId) => {
        if (item.severity === "error" || !severities.has(nodeId)) {
          severities.set(nodeId, item.severity);
        }
      });
    });
    return severities;
  }, [validationResult]);

  const focusDiagnostic = (index: number) => {
    const item = validationResult.diagnostics[index];
    if (item?.nodeId === null || item === undefined) return;
    setSelection({
      nodeIds: new Set([item.nodeId, ...item.relatedNodeIds]),
      connection: null,
    });
  };

  const getStorage = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      setMessage("localStorageを利用できません");
      return null;
    }
  };

  const refreshStoredPrograms = () => {
    const storage = getStorage();
    if (storage === null) return;
    const result = listStoredProgramIds(storage);
    if (result.success) setStoredProgramIds(result.data);
    else setMessage(result.message);
  };

  const commitProgram = (
    result: EditorResult<Program>,
    successMessage: string,
  ) => {
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    if (!result.changed) return;
    setHistory((current) => pushHistory(current, result.data));
    setSelection((current) => reconcileSelection(current, result.data));
    setMessage(successMessage);
  };

  const confirmDiscard = (): boolean =>
    !dirty || window.confirm("未保存の編集内容を破棄しますか？");

  const clearPendingConnection = () => {
    pendingConnectionRef.current = null;
    setPendingConnection(null);
  };

  const handleNew = () => {
    if (!confirmDiscard()) return;
    const next = createInitialProgram(startInstructionId, createId, now);
    setHistory(createHistory(next));
    setSelection(emptySelection());
    clearPendingConnection();
    setBaselineJson(null);
    setMessage("新しいProgramを作成しました");
  };

  const handleAddNode = (instruction: InstructionDefinition) => {
    const result = addNode(
      program,
      instruction,
      {
        x: (80 + (program.nodes.length % 3) * 240) as Int32,
        y: (100 + Math.floor(program.nodes.length / 3) * 160) as Int32,
      },
      now(),
    );
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setHistory((current) => pushHistory(current, result.data.program));
    setSelection({ nodeIds: new Set([result.data.nodeId]), connection: null });
    setMessage(`${instruction.displayName}を追加しました`);
  };

  const handleDelete = () => {
    if (selection.connection !== null) {
      commitProgram(
        disconnectNodes(
          program,
          selection.connection.sourceNodeId,
          selection.connection.outputPathId,
          now(),
        ),
        "接続を削除しました",
      );
      setSelection(emptySelection());
      return;
    }
    commitProgram(
      deleteNodes(program, selection.nodeIds, now()),
      "Nodeを削除しました",
    );
  };

  const handleCopy = () => {
    const result = copyNodes(program, selection.nodeIds);
    if (!result.success) setMessage(result.message);
    else {
      setClipboard(result.data);
      setMessage(`${result.data.nodes.length}件のNodeをコピーしました`);
    }
  };

  const handlePaste = () => {
    const result = pasteNodes(program, clipboard, now());
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setHistory((current) => pushHistory(current, result.data.program));
    setSelection({ nodeIds: result.data.nodeIds, connection: null });
    setMessage(`${result.data.nodeIds.size}件のNodeを貼り付けました`);
  };

  const handleUndo = () => {
    const next = undoHistory(history);
    setHistory(next);
    setSelection((current) => reconcileSelection(current, next.present));
    clearPendingConnection();
    setMessage("Undoを実行しました");
  };

  const handleRedo = () => {
    const next = redoHistory(history);
    setHistory(next);
    setSelection((current) => reconcileSelection(current, next.present));
    clearPendingConnection();
    setMessage("Redoを実行しました");
  };

  const saveCurrentProgram = (programToSave: Program) => {
    const storage = getStorage();
    if (storage === null) return;
    const result = saveProgramToStorage(storage, programToSave);
    if (!result.success) setMessage(result.message);
    else {
      setBaselineJson(result.data);
      setMessage("localStorageへ保存しました");
      refreshStoredPrograms();
      setSelectedStoredId(programToSave.id);
    }
  };

  const handleSave = () => saveCurrentProgram(program);

  const handleLoad = () => {
    if (selectedStoredId === "" || !confirmDiscard()) return;
    const storage = getStorage();
    if (storage === null) return;
    const result = loadProgramFromStorage(storage, selectedStoredId);
    if (!result.success) setMessage(result.message);
    else {
      setHistory(createHistory(result.data.program));
      setSelection(emptySelection());
      clearPendingConnection();
      setBaselineJson(result.data.json);
      setMessage("localStorageから読み込みました");
    }
  };

  const handleExport = () => {
    const exported = exportProgram(program);
    const url = URL.createObjectURL(
      new Blob([exported.json], { type: "application/json;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exported.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("ProgramをExportしました");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined || !confirmDiscard()) return;
    let json: string;
    try {
      json = await file.text();
    } catch {
      setMessage("Import対象ファイルを読み取れません");
      return;
    }
    const result = importProgram(json);
    if (!result.success) setMessage(result.message);
    else {
      setHistory(createHistory(result.data));
      setSelection(emptySelection());
      clearPendingConnection();
      setBaselineJson(null);
      setMessage("ProgramをImportしました。localStorageには未保存です");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const target = event.target;
        if (isTextInputTarget(target)) {
          flushSync(() => target.blur());
          saveCurrentProgram(programRef.current);
        } else handleSave();
        return;
      }
      if (isTextInputTarget(event.target)) return;
      if (command && event.key.toLowerCase() === "c") handleCopy();
      else if (command && event.key.toLowerCase() === "v") handlePaste();
      else if (command && event.key.toLowerCase() === "z" && event.shiftKey)
        handleRedo();
      else if (command && event.key.toLowerCase() === "z") handleUndo();
      else if (event.key === "Delete" || event.key === "Backspace")
        handleDelete();
      else if (event.key === "Escape") setSelection(emptySelection());
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const startDrag = (event: ReactPointerEvent<HTMLElement>, nodeId: NodeId) => {
    if ((event.target as HTMLElement).closest("button") !== null) return;
    let selected: ReadonlySet<NodeId>;
    if (event.shiftKey) {
      const nextSelection = selectNode(selection, nodeId, true);
      setSelection(nextSelection);
      selected = nextSelection.nodeIds;
      if (!selected.has(nodeId)) return;
    } else if (selection.nodeIds.has(nodeId)) {
      selected = selection.nodeIds;
    } else {
      selected = new Set([nodeId]);
      setSelection({ nodeIds: selected, connection: null });
    }
    const origins = Object.fromEntries(
      [...selected].map((id) => [id, nodePosition(id)]),
    ) as Readonly<Record<NodeId, Position>>;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ startX: event.clientX, startY: event.clientY, origins });
  };

  const updateDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragState === null) return;
    const deltaX = Math.round((event.clientX - dragState.startX) / zoom);
    const deltaY = Math.round((event.clientY - dragState.startY) / zoom);
    setPreviewPositions(
      Object.fromEntries(
        Object.entries(dragState.origins).map(([nodeId, position]) => [
          nodeId,
          {
            x: (position.x + deltaX) as Int32,
            y: (position.y + deltaY) as Int32,
          },
        ]),
      ),
    );
  };

  const finishDrag = () => {
    if (dragState === null) return;
    commitProgram(
      moveNodes(program, previewPositions, now()),
      "Nodeを移動しました",
    );
    setDragState(null);
    setPreviewPositions({});
  };

  const nodePosition = (nodeId: NodeId): Position =>
    previewPositions[nodeId] ??
    program.editorState.nodePositions[nodeId] ?? {
      x: 0 as Int32,
      y: 0 as Int32,
    };

  const orderedOutputPaths = (nodeId: NodeId) => {
    const node = program.nodes.find(({ id }) => id === nodeId);
    if (node === undefined) return [];
    return [
      ...(instructionMap.get(node.instructionId)?.outputPaths ?? []),
    ].sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.id.localeCompare(right.id),
    );
  };

  const connectionSourcePosition = (
    nodeId: NodeId,
    outputPathId: string,
  ): { readonly x: number; readonly y: number } => {
    const position = nodePosition(nodeId);
    const outputIndex = Math.max(
      0,
      orderedOutputPaths(nodeId).findIndex(({ id }) => id === outputPathId),
    );
    return {
      x: position.x + NODE_WIDTH,
      y:
        position.y +
        NODE_HEADER_HEIGHT +
        NODE_PORTS_PADDING +
        OUTPUT_PORT_HEIGHT / 2 +
        outputIndex * (OUTPUT_PORT_HEIGHT + OUTPUT_PORT_GAP),
    };
  };

  const nodeHeight = (nodeId: NodeId): number => {
    const outputCount = orderedOutputPaths(nodeId).length;
    const portsHeight =
      NODE_PORTS_PADDING * 2 +
      outputCount * OUTPUT_PORT_HEIGHT +
      Math.max(0, outputCount - 1) * OUTPUT_PORT_GAP;
    return Math.max(NODE_BASE_HEIGHT, NODE_HEADER_HEIGHT + portsHeight);
  };

  const finishConnection = (targetNodeId: NodeId) => {
    const pendingConnection = pendingConnectionRef.current;
    if (pendingConnection === null) return;
    pendingConnectionRef.current = null;
    setPendingConnection(null);
    commitProgram(
      connectNodes(
        program,
        pendingConnection.sourceNodeId,
        pendingConnection.outputPathId,
        targetNodeId,
        instructionMap,
        now(),
      ),
      "Nodeを接続しました",
    );
  };

  const beginConnection = (sourceNodeId: NodeId, outputPathId: string) => {
    const source = connectionSourcePosition(sourceNodeId, outputPathId);
    const connection: PendingConnection = {
      sourceNodeId,
      outputPathId,
      pointerX: source.x,
      pointerY: source.y,
      dragged: false,
    };
    pendingConnectionRef.current = connection;
    setPendingConnection(connection);
  };

  const pointerPosition = (
    event: ReactPointerEvent<HTMLElement>,
  ): { readonly x: number; readonly y: number } => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / zoom,
      y: (event.clientY - bounds.top) / zoom,
    };
  };

  const updateConnectionPreview = (event: ReactPointerEvent<HTMLElement>) => {
    const current = pendingConnectionRef.current;
    if (current === null) return;
    const pointer = pointerPosition(event);
    const next = {
      ...current,
      pointerX: pointer.x,
      pointerY: pointer.y,
      dragged: true,
    };
    pendingConnectionRef.current = next;
    setPendingConnection(next);
  };

  const cancelDraggedConnection = () => {
    if (pendingConnectionRef.current?.dragged === true) {
      clearPendingConnection();
    }
  };

  useEffect(() => {
    const handleWindowPointerUp = (event: PointerEvent) => {
      const current = pendingConnectionRef.current;
      if (current === null) return;
      const releasedOnSource =
        !current.dragged &&
        event.target instanceof Element &&
        event.target.closest(".output-port") !== null;
      if (releasedOnSource) return;
      pendingConnectionRef.current = null;
      setPendingConnection(null);
    };
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => window.removeEventListener("pointerup", handleWindowPointerUp);
  }, []);

  const startRangeSelection = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const { x, y } = pointerPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionBox({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      additive: event.shiftKey,
    });
  };

  const updateRangeSelection = (event: ReactPointerEvent<HTMLElement>) => {
    if (selectionBox === null) return;
    const pointer = pointerPosition(event);
    setSelectionBox({
      ...selectionBox,
      currentX: pointer.x,
      currentY: pointer.y,
    });
  };

  const finishRangeSelection = () => {
    if (selectionBox === null) return;
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const right = Math.max(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const bottom = Math.max(selectionBox.startY, selectionBox.currentY);
    const nodeIds = selectionBox.additive
      ? new Set(selection.nodeIds)
      : new Set<NodeId>();
    program.nodes.forEach((node) => {
      const position = nodePosition(node.id);
      const height = nodeHeight(node.id);
      if (
        position.x <= right &&
        position.x + NODE_WIDTH >= left &&
        position.y <= bottom &&
        position.y + height >= top
      ) {
        nodeIds.add(node.id);
      }
    });
    setSelection({ nodeIds, connection: null });
    setSelectionBox(null);
  };

  const orderedInstructions = [...instructions]
    .filter(({ enabled }) => enabled)
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.displayName.localeCompare(right.displayName) ||
        left.id.localeCompare(right.id),
    );

  return (
    <main className="editor-app">
      <header className="editor-header">
        <div>
          <p className="eyebrow">PROGRAM EDITOR / PHASE 3</p>
          <h1>Tactical Circuit</h1>
        </div>
        <div className="program-status">
          <strong>{program.metadata.name}</strong>
          <span>{dirty ? "未保存" : "保存済み"}</span>
          <span
            className={
              errorCount > 0 ? "validation-invalid" : "validation-valid"
            }
            role="status"
          >
            Error {errorCount} / Warning {warningCount}
          </span>
        </div>
      </header>

      <nav className="toolbar" aria-label="Program操作">
        <button type="button" onClick={handleNew}>
          新規
        </button>
        <button type="button" onClick={handleSave}>
          保存
        </button>
        <select
          aria-label="保存済みProgram"
          value={selectedStoredId}
          onChange={(event) =>
            setSelectedStoredId(event.target.value as ProgramId)
          }
        >
          <option value="">保存済みProgramを選択</option>
          {storedProgramIds.map((programId) => (
            <option key={programId} value={programId}>
              {programId}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={selectedStoredId === ""}
          onClick={handleLoad}
        >
          読込
        </button>
        <button type="button" onClick={handleExport}>
          Export
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()}>
          Import
        </button>
        <input
          ref={importInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="ImportするProgramファイル"
          onChange={(event) => void handleImport(event)}
        />
        <span className="toolbar-divider" />
        <button type="button" disabled={!canUndo(history)} onClick={handleUndo}>
          Undo
        </button>
        <button type="button" disabled={!canRedo(history)} onClick={handleRedo}>
          Redo
        </button>
        <button
          type="button"
          disabled={selection.nodeIds.size === 0}
          onClick={handleCopy}
        >
          コピー
        </button>
        <button
          type="button"
          disabled={clipboard === null}
          onClick={handlePaste}
        >
          貼り付け
        </button>
        <button
          type="button"
          disabled={
            selection.nodeIds.size === 0 && selection.connection === null
          }
          onClick={handleDelete}
        >
          削除
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          aria-label="Zoom Out"
          disabled={zoomPercent <= MIN_ZOOM_PERCENT}
          onClick={() =>
            setZoomPercent((current) =>
              Math.max(MIN_ZOOM_PERCENT, current - ZOOM_STEP_PERCENT),
            )
          }
        >
          −
        </button>
        <span
          className="zoom-value"
          role="meter"
          aria-label="Zoom倍率"
          aria-valuemin={MIN_ZOOM_PERCENT}
          aria-valuemax={MAX_ZOOM_PERCENT}
          aria-valuenow={zoomPercent}
        >
          {zoomPercent}%
        </span>
        <button
          type="button"
          aria-label="Zoom In"
          disabled={zoomPercent >= MAX_ZOOM_PERCENT}
          onClick={() =>
            setZoomPercent((current) =>
              Math.min(MAX_ZOOM_PERCENT, current + ZOOM_STEP_PERCENT),
            )
          }
        >
          ＋
        </button>
      </nav>

      <div className="editor-layout">
        <aside className="panel palette" aria-label="Instructionパレット">
          <h2>Instructions</h2>
          {orderedInstructions.map((instruction) => (
            <button
              className="instruction-card"
              type="button"
              key={instruction.id}
              title={instruction.description}
              onClick={() => handleAddNode(instruction)}
            >
              <strong>{instruction.displayName}</strong>
              <span>{instruction.category}</span>
            </button>
          ))}
        </aside>

        <section className="program-canvas" aria-label="Programキャンバス">
          <div
            className="canvas-scroll-area"
            style={{
              width: CANVAS_WIDTH * zoom,
              height: CANVAS_HEIGHT * zoom,
            }}
          >
            <div
              className="canvas-content"
              data-testid="canvas-content"
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                transform: `scale(${zoom})`,
              }}
              onPointerDown={startRangeSelection}
              onPointerMove={(event) => {
                updateRangeSelection(event);
                updateConnectionPreview(event);
              }}
              onPointerUp={() => {
                finishRangeSelection();
                cancelDraggedConnection();
              }}
            >
              <svg
                className="connection-layer"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                aria-hidden="true"
              >
                {program.nodes.flatMap((source) =>
                  Object.entries(source.connections).flatMap(
                    ([outputPathId, targetNodeId]) => {
                      const target = program.nodes.find(
                        ({ id }) => id === targetNodeId,
                      );
                      if (target === undefined) return [];
                      const targetPosition = nodePosition(target.id);
                      const sourcePosition = connectionSourcePosition(
                        source.id,
                        outputPathId,
                      );
                      const outputPath = instructionMap
                        .get(source.instructionId)
                        ?.outputPaths.find(({ id }) => id === outputPathId);
                      return [
                        <g key={`${source.id}:${outputPathId}`}>
                          {outputPath?.description !== undefined && (
                            <title>{outputPath.description}</title>
                          )}
                          <line
                            data-source-node-id={source.id}
                            data-output-path-id={outputPathId}
                            className="connection-hit-area"
                            x1={sourcePosition.x}
                            y1={sourcePosition.y}
                            x2={targetPosition.x}
                            y2={targetPosition.y + INPUT_PORT_CENTER_Y}
                            onClick={() =>
                              setSelection(
                                selectConnection({
                                  sourceNodeId: source.id,
                                  outputPathId,
                                }),
                              )
                            }
                          />
                          <line
                            data-source-node-id={source.id}
                            data-output-path-id={outputPathId}
                            className={
                              selection.connection?.sourceNodeId ===
                                source.id &&
                              selection.connection.outputPathId === outputPathId
                                ? "connection selected"
                                : "connection"
                            }
                            x1={sourcePosition.x}
                            y1={sourcePosition.y}
                            x2={targetPosition.x}
                            y2={targetPosition.y + INPUT_PORT_CENTER_Y}
                          />
                        </g>,
                      ];
                    },
                  ),
                )}
                {pendingConnection !== null && (
                  <line
                    className="connection-preview"
                    data-output-path-id={pendingConnection.outputPathId}
                    x1={
                      connectionSourcePosition(
                        pendingConnection.sourceNodeId,
                        pendingConnection.outputPathId,
                      ).x
                    }
                    y1={
                      connectionSourcePosition(
                        pendingConnection.sourceNodeId,
                        pendingConnection.outputPathId,
                      ).y
                    }
                    x2={pendingConnection.pointerX}
                    y2={pendingConnection.pointerY}
                  />
                )}
              </svg>

              {selectionBox !== null && (
                <div
                  className="selection-box"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                    width: Math.abs(
                      selectionBox.currentX - selectionBox.startX,
                    ),
                    height: Math.abs(
                      selectionBox.currentY - selectionBox.startY,
                    ),
                  }}
                />
              )}

              {program.nodes.map((node) => {
                const instruction = instructionMap.get(node.instructionId);
                const position = nodePosition(node.id);
                const hasIncomingConnection = program.nodes.some((source) =>
                  Object.values(source.connections).includes(node.id),
                );
                const outputPaths = [...(instruction?.outputPaths ?? [])].sort(
                  (left, right) =>
                    left.displayOrder - right.displayOrder ||
                    left.id.localeCompare(right.id),
                );
                return (
                  <article
                    className={`program-node ${selection.nodeIds.has(node.id) ? "selected" : ""} ${
                      validationSeverityByNode.has(node.id)
                        ? `validation-${validationSeverityByNode.get(node.id)}`
                        : ""
                    }`}
                    key={node.id}
                    title={instruction?.description}
                    style={{ left: position.x, top: position.y }}
                    onPointerDown={(event) => startDrag(event, node.id)}
                    onPointerMove={updateDrag}
                    onPointerUp={finishDrag}
                  >
                    <button
                      className={`input-port ${hasIncomingConnection ? "connected" : ""}`}
                      type="button"
                      aria-label={`${node.id}へ接続`}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        finishConnection(node.id);
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        finishConnection(node.id);
                      }}
                    />
                    <header>
                      <strong>
                        {instruction?.displayName ?? "Unknown Instruction"}
                      </strong>
                      <small>{node.id}</small>
                    </header>
                    <div className="node-ports">
                      {outputPaths.map((outputPath) => (
                        <button
                          type="button"
                          data-node-id={node.id}
                          data-output-path-id={outputPath.id}
                          className={`output-port ${
                            node.connections[outputPath.id] !== undefined
                              ? "connected"
                              : ""
                          } ${
                            pendingConnection?.sourceNodeId === node.id &&
                            pendingConnection.outputPathId === outputPath.id
                              ? "pending"
                              : ""
                          }`}
                          key={outputPath.id}
                          title={outputPath.description}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            beginConnection(node.id, outputPath.id);
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            beginConnection(node.id, outputPath.id);
                          }}
                        >
                          {outputPath.displayName}
                        </button>
                      ))}
                      {program.editorState.comments[node.id] !== undefined && (
                        <span
                          className="comment-indicator"
                          title="コメントあり"
                        >
                          ●
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="panel properties" aria-label="Property Editor">
          <h2>Properties</h2>
          <section className="validation-panel" aria-label="Program診断">
            <h3>Validation</h3>
            {validationResult.diagnostics.length === 0 ? (
              <p className="validation-empty">問題はありません</p>
            ) : (
              <ol className="diagnostic-list">
                {validationResult.diagnostics.map((item, index) => (
                  <li
                    className={`diagnostic-${item.severity}`}
                    key={`${item.code}:${item.nodeId ?? "program"}:${item.fieldPath ?? ""}:${index}`}
                  >
                    <strong className="diagnostic-severity">
                      {item.severity === "error" ? "Error" : "Warning"}
                    </strong>
                    {item.nodeId === null ? (
                      <span>{item.message}</span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`${item.nodeId}の診断を表示`}
                        onClick={() => focusDiagnostic(index)}
                      >
                        {item.message}
                      </button>
                    )}
                    <code>{item.code}</code>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {selectedNode === undefined && selection.nodeIds.size > 1 ? (
            <p>{selection.nodeIds.size}件のNodeを選択中</p>
          ) : selectedNode === undefined && selection.connection !== null ? (
            <dl className="node-info">
              <dt>接続元</dt>
              <dd>{selection.connection.sourceNodeId}</dd>
              <dt>出力パス</dt>
              <dd>{selection.connection.outputPathId}</dd>
            </dl>
          ) : selectedNode === undefined ? (
            <>
              <TextCommitField
                label="名前"
                value={program.metadata.name}
                onCommit={(name) =>
                  commitProgram(
                    updateProgramMetadata(
                      program,
                      { ...program.metadata, name },
                      now(),
                    ),
                    "Program名を変更しました",
                  )
                }
              />
              <TextCommitField
                label="作者"
                value={program.metadata.author}
                onCommit={(author) =>
                  commitProgram(
                    updateProgramMetadata(
                      program,
                      { ...program.metadata, author },
                      now(),
                    ),
                    "作者を変更しました",
                  )
                }
              />
              <TextCommitField
                label="説明"
                multiline
                value={program.metadata.description}
                onCommit={(description) =>
                  commitProgram(
                    updateProgramMetadata(
                      program,
                      { ...program.metadata, description },
                      now(),
                    ),
                    "説明を変更しました",
                  )
                }
              />
            </>
          ) : (
            <>
              <dl className="node-info">
                <dt>Node ID</dt>
                <dd>{selectedNode.id}</dd>
                <dt>Instruction</dt>
                <dd>
                  {instructionMap.get(selectedNode.instructionId)
                    ?.displayName ?? selectedNode.instructionId}
                </dd>
              </dl>
              {instructionMap
                .get(selectedNode.instructionId)
                ?.parameters.map((parameter) => (
                  <ParameterField
                    key={parameter.id}
                    definition={parameter}
                    value={selectedNode.parameterValues[parameter.id]}
                    nodeIds={program.nodes.map(({ id }) => id)}
                    onCommit={(value) =>
                      commitProgram(
                        setParameterValue(
                          program,
                          selectedNode.id,
                          parameter.id,
                          value,
                          now(),
                        ),
                        `${parameter.displayName}を変更しました`,
                      )
                    }
                  />
                ))}
              {Object.entries(selectedNode.parameterValues)
                .filter(
                  ([parameterId]) =>
                    !instructionMap
                      .get(selectedNode.instructionId)
                      ?.parameters.some(({ id }) => id === parameterId),
                )
                .map(([parameterId, value]) => (
                  <div className="unknown-parameter" key={parameterId}>
                    <span>{parameterId}（未定義）</span>
                    <code>{JSON.stringify(value)}</code>
                  </div>
                ))}
              <TextCommitField
                label="コメント"
                multiline
                value={program.editorState.comments[selectedNode.id] ?? ""}
                onCommit={(comment) =>
                  commitProgram(
                    setNodeComment(program, selectedNode.id, comment, now()),
                    "コメントを変更しました",
                  )
                }
              />
            </>
          )}
        </aside>
      </div>

      <footer className="editor-message" role="status">
        {message}
      </footer>
    </main>
  );
}
