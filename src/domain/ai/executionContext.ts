import type { Int32 } from "../data/common";
import type { GameRuleDefinition } from "../masterData/models";
import type { Program } from "../program/models";
import { createEmptyActionRequests } from "../runtime/factories";
import type {
  AIRuntimeErrorCode,
  ExecutionContext,
  ExecutionContextChanges,
  ExecutionInput,
} from "../runtime/models";

type ContextChangeResult =
  | { readonly success: true; readonly context: ExecutionContext }
  | {
      readonly success: false;
      readonly error: {
        readonly code: AIRuntimeErrorCode;
        readonly message: string;
      };
    };

/** Tickをまたぐ値を参照共有しないExecution Context作業コピーを生成する。 */
export const createExecutionContext = (
  program: Program,
  input: ExecutionInput,
  gameRule: GameRuleDefinition,
): ExecutionContext => ({
  program,
  input,
  aiRuntimeState: {
    nextNodeId: input.aiRuntimeState.nextNodeId,
    registers: { ...input.aiRuntimeState.registers },
    flags: { ...input.aiRuntimeState.flags },
    callStack: [...input.aiRuntimeState.callStack],
    memory: { values: [...input.aiRuntimeState.memory.values] },
  },
  cpuUsed: 0 as Int32,
  cpuRemaining: gameRule.cpuLimit,
  temporaryVariables: {},
  actionRequests: createEmptyActionRequests(),
  randomState: { ...input.randomState },
});

const failure = (
  code: AIRuntimeErrorCode,
  message: string,
): ContextChangeResult => ({ success: false, error: { code, message } });

/** 命令単位の変更要求を作業コピーへ原子的に適用する。 */
export const applyExecutionContextChanges = (
  context: ExecutionContext,
  changes: ExecutionContextChanges,
  gameRule: GameRuleDefinition,
): ContextChangeResult => {
  const memory = [...context.aiRuntimeState.memory.values];
  for (const write of changes.memoryWrites) {
    if (write.index < 0 || write.index >= gameRule.memorySize) {
      return failure(
        "invalid_memory_access",
        `メモリインデックス${write.index}は範囲外です`,
      );
    }
    memory[write.index] = write.value;
  }

  const callStack = [...context.aiRuntimeState.callStack];
  for (const operation of changes.stackOperations) {
    if (operation.type === "pop") {
      if (callStack.length === 0) {
        return failure("empty_call_stack", "コールスタックが空です");
      }
      callStack.pop();
    } else {
      if (callStack.length >= gameRule.callStackSize) {
        return failure(
          "call_stack_overflow",
          "コールスタックの上限を超えました",
        );
      }
      callStack.push(operation.nodeId);
    }
  }

  return {
    success: true,
    context: {
      ...context,
      aiRuntimeState: {
        ...context.aiRuntimeState,
        registers: {
          ...context.aiRuntimeState.registers,
          ...changes.registerWrites,
        },
        flags: { ...context.aiRuntimeState.flags, ...changes.flagWrites },
        callStack,
        memory: { values: memory },
      },
      actionRequests: {
        movement: changes.movementRequest ?? context.actionRequests.movement,
        combat: changes.combatRequest ?? context.actionRequests.combat,
      },
      randomState: changes.randomState
        ? { ...changes.randomState }
        : context.randomState,
    },
  };
};

export const commitCpuCost = (
  context: ExecutionContext,
  cpuCost: Int32,
): ExecutionContext => ({
  ...context,
  cpuUsed: (context.cpuUsed + cpuCost) as Int32,
  cpuRemaining: (context.cpuRemaining - cpuCost) as Int32,
});
