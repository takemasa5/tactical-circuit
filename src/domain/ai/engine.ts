import type { Int32 } from "../data/common";
import type { NodeId } from "../data/ids";
import type { DataRepository } from "../masterData/repository";
import type {
  AIExecutionInput,
  AIExecutionOutput,
  AIRuntimeError,
  ExecutionContext,
} from "../runtime/models";
import type { InstructionRegistry } from "./contracts";
import { dispatchInstruction } from "./dispatcher";
import {
  applyExecutionContextChanges,
  commitCpuCost,
  createExecutionContext,
} from "./executionContext";

export type AIEngineDependencies = {
  readonly repository: DataRepository;
  readonly instructionRegistry: InstructionRegistry;
};

export type AIEngine = {
  readonly execute: (input: AIExecutionInput) => AIExecutionOutput;
};

const reasons = {
  instruction: "命令によりTickの実行を中断しました",
  cpu: "CPUが不足したためTickの実行を終了しました",
  zeroCostLimit:
    "CPUコスト0の実行Node数上限に到達したためTickの実行を終了しました",
  error: "実行時エラーが発生したためTickの実行を終了しました",
} as const;

type RunState = {
  context: ExecutionContext;
  nextNodeId: NodeId;
  trace: string[];
  executedNodeCount: number;
  zeroCostNodeCount: number;
};

const runtimeError = (
  code: AIRuntimeError["code"],
  message: string,
  nodeId: NodeId,
  instructionId: AIRuntimeError["instructionId"],
): AIRuntimeError => ({ code, message, nodeId, instructionId });

const output = (
  state: RunState,
  resumeNodeId: NodeId,
  terminationReason: string,
  error: AIRuntimeError | null,
): AIExecutionOutput => ({
  executionResult: {
    actionRequests: state.context.actionRequests,
    aiRuntimeState: {
      ...state.context.aiRuntimeState,
      nextNodeId: resumeNodeId,
    },
    randomState: state.context.randomState,
  },
  debugInfo: {
    executionTrace: state.trace,
    terminationReason,
    runtimeError: error,
    cpuUsed: state.context.cpuUsed,
    executedNodeCount: state.executedNodeCount as Int32,
  },
});

/** 検証済みProgramを1Tick分実行するAI Engineを生成する。 */
export const createAIEngine = (
  dependencies: AIEngineDependencies,
): AIEngine => ({
  execute: ({ program, executionInput, gameRule }) => {
    const nodes = new Map(program.nodes.map((node) => [node.id, node]));
    const initialNodeId =
      executionInput.aiRuntimeState.nextNodeId ?? program.startNodeId;
    const state: RunState = {
      context: createExecutionContext(program, executionInput, gameRule),
      nextNodeId: initialNodeId,
      trace: [],
      executedNodeCount: 0,
      zeroCostNodeCount: 0,
    };
    const zeroCostNodeLimit = Math.max(gameRule.cpuLimit, 2);

    for (;;) {
      const node = nodes.get(state.nextNodeId);
      if (!node) {
        const error = runtimeError(
          "internal_instruction_error",
          `Node ${state.nextNodeId}が見つかりません`,
          state.nextNodeId,
          "instruction_00000000-0000-0000-0000-000000000000" as AIRuntimeError["instructionId"],
        );
        return output(state, program.startNodeId, reasons.error, error);
      }
      const definition = dependencies.repository.get(
        "instruction",
        node.instructionId,
      );
      if (!definition) {
        const error = runtimeError(
          "internal_instruction_error",
          `Instruction ${node.instructionId}が見つかりません`,
          node.id,
          node.instructionId,
        );
        return output(state, program.startNodeId, reasons.error, error);
      }

      if (definition.cpuCost > state.context.cpuRemaining) {
        return output(state, node.id, reasons.cpu, null);
      }
      if (
        definition.cpuCost === 0 &&
        state.zeroCostNodeCount >= zeroCostNodeLimit
      ) {
        return output(state, node.id, reasons.zeroCostLimit, null);
      }

      state.trace.push(
        `at ${definition.implementationId} (${node.id}, ${definition.id})`,
      );
      const dispatched = dispatchInstruction(
        dependencies.instructionRegistry,
        definition,
        node,
        state.context,
      );
      if (!dispatched.success) {
        return output(
          state,
          program.startNodeId,
          reasons.error,
          runtimeError(
            dispatched.error.code,
            dispatched.error.message,
            node.id,
            node.instructionId,
          ),
        );
      }
      const { result } = dispatched;
      if (!result.interruptTick && result.nextNodeId === null) {
        return output(
          state,
          program.startNodeId,
          reasons.error,
          runtimeError(
            "invalid_instruction_result",
            "Tickを継続する命令のnextNodeIdがnullです",
            node.id,
            node.instructionId,
          ),
        );
      }

      const applied = applyExecutionContextChanges(
        state.context,
        result.contextChanges,
        gameRule,
      );
      if (!applied.success) {
        return output(
          state,
          program.startNodeId,
          reasons.error,
          runtimeError(
            applied.error.code,
            applied.error.message,
            node.id,
            node.instructionId,
          ),
        );
      }

      state.context = commitCpuCost(applied.context, definition.cpuCost);
      state.executedNodeCount += 1;
      if (definition.cpuCost === 0) state.zeroCostNodeCount += 1;

      if (result.interruptTick) {
        return output(
          state,
          result.nextNodeId ?? program.startNodeId,
          reasons.instruction,
          null,
        );
      }
      state.nextNodeId = result.nextNodeId as NodeId;
    }
  },
});
