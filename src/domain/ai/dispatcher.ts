import type {
  InstructionExecutionOutcome,
  InstructionRegistry,
} from "./contracts";
import type { InstructionDefinition } from "../masterData/models";
import type { ProgramNode } from "../program/models";
import type { ExecutionContext } from "../runtime/models";

/** implementationIdだけで命令実装を解決し、例外をRuntime Errorへ変換する。 */
export const dispatchInstruction = (
  registry: InstructionRegistry,
  definition: InstructionDefinition,
  node: ProgramNode,
  context: ExecutionContext,
): InstructionExecutionOutcome => {
  const implementation = registry.get(definition.implementationId);
  if (!implementation) {
    return {
      success: false,
      error: {
        code: "internal_instruction_error",
        message: `命令実装${definition.implementationId}が登録されていません`,
      },
    };
  }
  try {
    return implementation({ definition, node, context });
  } catch {
    return {
      success: false,
      error: {
        code: "internal_instruction_error",
        message: `命令実装${definition.implementationId}で内部エラーが発生しました`,
      },
    };
  }
};
