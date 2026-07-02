import type { NodeId } from "../data/ids";
import type { InstructionDefinition } from "../masterData/models";
import type { ProgramNode } from "../program/models";
import type {
  AIRuntimeErrorCode,
  ExecutionContext,
  ExecutionContextChanges,
} from "../runtime/models";

/** `spec/instructions/instruction_model.md`の命令実行入力。 */
export type InstructionExecutionInput = {
  readonly definition: InstructionDefinition;
  readonly node: ProgramNode;
  readonly context: ExecutionContext;
};

/** `spec/instructions/instruction_model.md`の正常な命令実行結果。 */
export type InstructionExecutionResult = {
  readonly nextNodeId: NodeId | null;
  readonly contextChanges: ExecutionContextChanges;
  readonly interruptTick: boolean;
};

/** `spec/instructions/instruction_model.md`の命令実行成否。 */
export type InstructionExecutionOutcome =
  | { readonly success: true; readonly result: InstructionExecutionResult }
  | {
      readonly success: false;
      readonly error: {
        readonly code: AIRuntimeErrorCode;
        readonly message: string;
      };
    };

export type InstructionImplementation = (
  input: InstructionExecutionInput,
) => InstructionExecutionOutcome;

/** implementationIdだけをキーとする固定命令Registry。 */
export type InstructionRegistry = ReadonlyMap<
  string,
  InstructionImplementation
>;

export const createEmptyContextChanges = (): ExecutionContextChanges => ({
  registerWrites: {},
  flagWrites: {},
  memoryWrites: [],
  stackOperations: [],
  randomState: null,
});

export const succeed = (
  nextNodeId: NodeId | null,
  contextChanges = createEmptyContextChanges(),
  interruptTick = false,
): InstructionExecutionOutcome => ({
  success: true,
  result: { nextNodeId, contextChanges, interruptTick },
});

export const fail = (
  code: AIRuntimeErrorCode,
  message: string,
): InstructionExecutionOutcome => ({
  success: false,
  error: { code, message },
});
