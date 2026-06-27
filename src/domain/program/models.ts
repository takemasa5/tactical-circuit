import type { Int32, Position } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type {
  InstructionId,
  MasterDataId,
  MasterDataType,
} from "../masterData/models";

/** `spec/editor/program_model.md`のProgram表示メタデータ。 */
export type ProgramMetadata = {
  readonly name: string;
  readonly author: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** `spec/editor/program_model.md`のレジスタ参照Parameter Value。 */
export type RegisterReference = {
  readonly type: "register_reference";
  readonly registerName: string;
};

/** `spec/editor/program_model.md`のフラグ参照Parameter Value。 */
export type FlagReference = {
  readonly type: "flag_reference";
  readonly flagName: string;
};

/** `spec/editor/program_model.md`の永続AIメモリ参照Parameter Value。 */
export type MemoryReference = {
  readonly type: "memory_reference";
  readonly indexRegisterName: string;
};

/** `spec/editor/program_model.md`のNode参照Parameter Value。 */
export type NodeReference = {
  readonly type: "node_reference";
  readonly nodeId: NodeId;
};

/** `spec/editor/program_model.md`のMaster Data参照Parameter Value。 */
export type MasterDataReference = {
  readonly type: "master_data_reference";
  readonly dataType: MasterDataType;
  readonly id: MasterDataId;
};

/** `spec/editor/program_model.md`でNodeが保持できるParameter Value。 */
export type ParameterValue =
  | Int32
  | boolean
  | string
  | RegisterReference
  | FlagReference
  | MemoryReference
  | NodeReference
  | MasterDataReference;

/** `spec/editor/program_model.md`の1命令Node。 */
export type ProgramNode = {
  readonly id: NodeId;
  readonly instructionId: InstructionId;
  readonly parameterValues: Readonly<Record<string, ParameterValue>>;
  readonly connections: Readonly<Record<string, NodeId>>;
};

/** `spec/editor/program_model.md`の保存対象Editor専用情報。 */
export type ProgramEditorState = {
  readonly nodePositions: Readonly<Record<NodeId, Position>>;
  readonly comments: Readonly<Record<NodeId, string>>;
};

/** `spec/editor/program_model.md`の保存可能なProgram論理モデル。 */
export type Program = {
  readonly id: ProgramId;
  readonly nodes: readonly ProgramNode[];
  readonly startNodeId: NodeId;
  readonly nextNodeSequence: Int32;
  readonly metadata: ProgramMetadata;
  readonly editorState: ProgramEditorState;
};
