import type { NodeId, ProgramId } from "../data/ids";
import type { DataRepository } from "../masterData/repository";
import type { InstructionDefinition } from "../masterData/models";
import type { Program, ProgramNode } from "../program/models";

/** `docs/specs/current/validator/00_overview.md`の診断重要度。 */
export type ValidationSeverity = "error" | "warning";

/** `docs/specs/current/validator/00_overview.md`の検証診断。 */
export type ValidationDiagnostic = {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly programId: ProgramId;
  readonly nodeId: NodeId | null;
  readonly fieldPath: string | null;
  readonly relatedNodeIds: readonly NodeId[];
};

/** `docs/specs/current/validator/00_overview.md`のProgram検証結果。 */
export type ValidationResult = {
  readonly isValid: boolean;
  readonly diagnostics: readonly ValidationDiagnostic[];
};

/** 命令実装が固有の静的検証を行うための読取専用入力。 */
export type InstructionValidationContext = {
  readonly program: Program;
  readonly node: ProgramNode;
  readonly instruction: InstructionDefinition;
  readonly repository: DataRepository;
};

/** `implementationId`に対応する命令固有の静的Validator。 */
export type InstructionStaticValidator = (
  context: InstructionValidationContext,
) => readonly ValidationDiagnostic[];

export type InstructionValidatorRegistry = ReadonlyMap<
  string,
  InstructionStaticValidator
>;
