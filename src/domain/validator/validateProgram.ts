import { INT32_MAX, INT32_MIN } from "../data/common";
import type { NodeId } from "../data/ids";
import type {
  InstructionDefinition,
  MasterDataType,
  ParameterDefinition,
  ParameterValueType,
} from "../masterData/models";
import { isMasterDataId } from "../masterData/id";
import type { DataRepository } from "../masterData/repository";
import type { ParameterValue, Program, ProgramNode } from "../program/models";
import {
  buildControlFlowGraph,
  compareNodeIds,
  findPureCycles,
  findReachableNodeIds,
} from "./controlFlowGraph";
import type {
  InstructionValidatorRegistry,
  ValidationDiagnostic,
  ValidationResult,
  ValidationSeverity,
} from "./models";

const NODE_ID_PATTERN = /^node_([1-9]\d*)$/;

const numericTypes: ReadonlySet<ParameterValueType> = new Set([
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

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const diagnostic = (
  program: Program,
  severity: ValidationSeverity,
  code: string,
  message: string,
  nodeId: NodeId | null,
  fieldPath: string | null,
  relatedNodeIds: readonly NodeId[] = [],
): ValidationDiagnostic => ({
  severity,
  code,
  message,
  programId: program.id,
  nodeId,
  fieldPath,
  relatedNodeIds: [...relatedNodeIds].sort(compareNodeIds),
});

const isInt32 = (value: unknown): value is number =>
  Number.isInteger(value) &&
  typeof value === "number" &&
  value >= INT32_MIN &&
  value <= INT32_MAX;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const referenceType = (valueType: ParameterValueType): string | null => {
  switch (valueType) {
    case "register_reference":
    case "flag_reference":
    case "memory_reference":
    case "node_reference":
    case "master_data_reference":
      return valueType;
    default:
      return null;
  }
};

const hasReferenceShape = (
  value: ParameterValue,
  valueType: ParameterValueType,
): boolean => {
  const expectedType = referenceType(valueType);
  if (
    expectedType === null ||
    !isRecord(value) ||
    value.type !== expectedType
  ) {
    return false;
  }
  const reference: Readonly<Record<string, unknown>> = value;
  switch (valueType) {
    case "register_reference":
      return (
        typeof reference.registerName === "string" &&
        reference.registerName !== ""
      );
    case "flag_reference":
      return (
        typeof reference.flagName === "string" && reference.flagName !== ""
      );
    case "memory_reference":
      return (
        typeof reference.indexRegisterName === "string" &&
        reference.indexRegisterName !== ""
      );
    case "node_reference":
      return (
        typeof reference.nodeId === "string" &&
        NODE_ID_PATTERN.test(reference.nodeId)
      );
    case "master_data_reference":
      return (
        typeof reference.dataType === "string" &&
        typeof reference.id === "string" &&
        reference.id !== ""
      );
    default:
      return false;
  }
};

const validateParameterType = (
  value: ParameterValue,
  definition: ParameterDefinition,
): boolean => {
  if (numericTypes.has(definition.valueType)) return isInt32(value);
  if (definition.valueType === "boolean") return typeof value === "boolean";
  if (definition.valueType === "enum") return typeof value === "string";
  return hasReferenceShape(value, definition.valueType);
};

const validateNodeIds = (
  program: Program,
  diagnostics: ValidationDiagnostic[],
): boolean => {
  const seen = new Set<NodeId>();
  let valid = true;
  program.nodes.forEach((node) => {
    if (seen.has(node.id)) {
      valid = false;
      diagnostics.push(
        diagnostic(
          program,
          "error",
          "duplicate_node_id",
          "Node IDが重複しています",
          node.id,
          "id",
        ),
      );
    }
    seen.add(node.id);
  });

  const maximumSequence = Math.max(
    0,
    ...program.nodes.map(({ id }) =>
      Number(NODE_ID_PATTERN.exec(id)?.[1] ?? 0),
    ),
  );
  if (
    !isInt32(program.nextNodeSequence) ||
    program.nextNodeSequence < 1 ||
    program.nextNodeSequence <= maximumSequence
  ) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "invalid_next_node_sequence",
        "次のNode連番が不正です",
        null,
        "nextNodeSequence",
      ),
    );
  }
  return valid;
};

const resolveInstructions = (
  program: Program,
  repository: DataRepository,
  diagnostics: ValidationDiagnostic[],
): ReadonlyMap<NodeId, InstructionDefinition> => {
  const resolved = new Map<NodeId, InstructionDefinition>();
  program.nodes.forEach((node) => {
    const instruction = repository.get("instruction", node.instructionId);
    if (instruction === undefined) {
      diagnostics.push(
        diagnostic(
          program,
          "error",
          "unknown_instruction_id",
          "Instruction Definitionが存在しません",
          node.id,
          "instructionId",
        ),
      );
      return;
    }
    resolved.set(node.id, instruction);
  });
  return resolved;
};

const validateStartNode = (
  program: Program,
  resolved: ReadonlyMap<NodeId, InstructionDefinition>,
  diagnostics: ValidationDiagnostic[],
): boolean => {
  let valid = true;
  const referencedNode = program.nodes.find(
    ({ id }) => id === program.startNodeId,
  );
  if (referencedNode === undefined) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "invalid_start_node_id",
        "startNodeIdの参照先が存在しません",
        null,
        "startNodeId",
      ),
    );
    valid = false;
  }
  const startNodes = program.nodes
    .filter(({ id }) => resolved.get(id)?.implementationId === "start")
    .sort((left, right) => compareNodeIds(left.id, right.id));
  if (startNodes.length === 0) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "missing_start_node",
        "Start Nodeが存在しません",
        null,
        "startNodeId",
      ),
    );
    return false;
  }
  if (startNodes.length > 1) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "multiple_start_nodes",
        "Start Nodeが複数存在します",
        startNodes[0]!.id,
        "instructionId",
        startNodes.slice(1).map(({ id }) => id),
      ),
    );
    return false;
  }
  if (referencedNode !== undefined && referencedNode.id !== startNodes[0]!.id) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "start_node_mismatch",
        "startNodeIdがStart命令以外を参照しています",
        referencedNode.id,
        "instructionId",
        [startNodes[0]!.id],
      ),
    );
    return false;
  }
  return valid;
};

const validateReferenceTarget = (
  program: Program,
  node: ProgramNode,
  definition: ParameterDefinition,
  value: ParameterValue,
  repository: DataRepository,
  diagnostics: ValidationDiagnostic[],
): void => {
  const fieldPath = `parameterValues.${definition.id}`;
  if (definition.valueType === "node_reference") {
    const nodeId = (value as { readonly nodeId: NodeId }).nodeId;
    if (!program.nodes.some(({ id }) => id === nodeId)) {
      diagnostics.push(
        diagnostic(
          program,
          "error",
          "missing_reference_target",
          "参照先Nodeが存在しません",
          node.id,
          fieldPath,
        ),
      );
    }
    return;
  }
  if (definition.valueType !== "master_data_reference") return;
  const reference = value as {
    readonly dataType: MasterDataType;
    readonly id: string;
  };
  if (reference.dataType !== definition.referenceDataType) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "reference_type_mismatch",
        "Master Data参照の種別が一致しません",
        node.id,
        fieldPath,
      ),
    );
  } else if (!isMasterDataId(reference.id, reference.dataType)) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "invalid_reference",
        "Master Data参照IDの形式が不正です",
        node.id,
        fieldPath,
      ),
    );
  } else if (repository.get(reference.dataType, reference.id) === undefined) {
    diagnostics.push(
      diagnostic(
        program,
        "error",
        "missing_reference_target",
        "参照先Master Dataが存在しません",
        node.id,
        fieldPath,
      ),
    );
  }
};

const validateParameters = (
  program: Program,
  resolved: ReadonlyMap<NodeId, InstructionDefinition>,
  repository: DataRepository,
  diagnostics: ValidationDiagnostic[],
): void => {
  program.nodes.forEach((node) => {
    const instruction = resolved.get(node.id);
    if (instruction === undefined) return;
    const definitions = new Map(
      instruction.parameters.map((definition) => [definition.id, definition]),
    );
    instruction.parameters.forEach((definition) => {
      const value = node.parameterValues[definition.id];
      const fieldPath = `parameterValues.${definition.id}`;
      if (value === undefined) {
        if (definition.required) {
          diagnostics.push(
            diagnostic(
              program,
              "error",
              "missing_parameter",
              `必須パラメータ「${definition.displayName}」が未設定です`,
              node.id,
              fieldPath,
            ),
          );
        }
        return;
      }
      if (!validateParameterType(value, definition)) {
        diagnostics.push(
          diagnostic(
            program,
            "error",
            referenceType(definition.valueType) === null
              ? "parameter_type_mismatch"
              : "invalid_reference",
            "Parameter Valueの型が一致しません",
            node.id,
            fieldPath,
          ),
        );
        return;
      }
      if (typeof value === "number") {
        const outOfRange =
          (definition.minValue !== undefined && value < definition.minValue) ||
          (definition.maxValue !== undefined && value > definition.maxValue);
        if (outOfRange) {
          diagnostics.push(
            diagnostic(
              program,
              "error",
              "parameter_out_of_range",
              "Parameter Valueが値域外です",
              node.id,
              fieldPath,
            ),
          );
        }
      } else if (
        definition.valueType === "enum" &&
        !definition.enumValues?.includes(value as string)
      ) {
        diagnostics.push(
          diagnostic(
            program,
            "error",
            "unknown_enum_value",
            "未定義の列挙値です",
            node.id,
            fieldPath,
          ),
        );
      } else if (referenceType(definition.valueType) !== null) {
        validateReferenceTarget(
          program,
          node,
          definition,
          value,
          repository,
          diagnostics,
        );
      }
    });

    Object.keys(node.parameterValues).forEach((parameterId) => {
      if (!definitions.has(parameterId)) {
        diagnostics.push(
          diagnostic(
            program,
            "error",
            "unknown_parameter",
            "未定義のParameter IDが保存されています",
            node.id,
            `parameterValues.${parameterId}`,
          ),
        );
      }
    });
  });
};

const validateConnections = (
  program: Program,
  resolved: ReadonlyMap<NodeId, InstructionDefinition>,
  diagnostics: ValidationDiagnostic[],
): void => {
  const nodeIds = new Set(program.nodes.map(({ id }) => id));
  program.nodes.forEach((node) => {
    const instruction = resolved.get(node.id);
    Object.entries(node.connections).forEach(([outputPathId, targetNodeId]) => {
      const fieldPath = `connections.${outputPathId}`;
      if (!nodeIds.has(targetNodeId)) {
        diagnostics.push(
          diagnostic(
            program,
            "error",
            "invalid_connection_target",
            "接続先Nodeが存在しません",
            node.id,
            fieldPath,
          ),
        );
      }
      if (instruction === undefined) return;
      const outputPaths = new Set(
        instruction.outputPaths.map((outputPath) => outputPath.id),
      );
      if (instruction.outputPaths.length === 0) {
        diagnostics.push(
          diagnostic(
            program,
            "error",
            "connection_not_allowed",
            "この命令には接続を保存できません",
            node.id,
            fieldPath,
          ),
        );
      } else if (!outputPaths.has(outputPathId)) {
        diagnostics.push(
          diagnostic(
            program,
            "error",
            "unknown_output_path",
            "未定義のOutput Path IDが保存されています",
            node.id,
            fieldPath,
          ),
        );
      }
    });
    if (instruction === undefined) return;
    instruction.outputPaths.forEach((outputPath) => {
      if (node.connections[outputPath.id] !== undefined) return;
      diagnostics.push(
        diagnostic(
          program,
          outputPath.required ? "error" : "warning",
          outputPath.required
            ? "missing_required_connection"
            : "optional_connection_missing",
          outputPath.required
            ? `必須出力パス「${outputPath.displayName}」が未接続です`
            : `任意出力パス「${outputPath.displayName}」が未接続です`,
          node.id,
          `connections.${outputPath.id}`,
        ),
      );
    });
  });
};

const sortDiagnostics = (
  diagnostics: readonly ValidationDiagnostic[],
): readonly ValidationDiagnostic[] =>
  [...diagnostics].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1;
    }
    if (left.nodeId === null || right.nodeId === null) {
      if (left.nodeId !== right.nodeId) return left.nodeId === null ? -1 : 1;
    } else {
      const nodeDifference = compareNodeIds(left.nodeId, right.nodeId);
      if (nodeDifference !== 0) return nodeDifference;
    }
    const codeDifference = compareAscii(left.code, right.code);
    if (codeDifference !== 0) return codeDifference;
    return compareAscii(left.fieldPath ?? "", right.fieldPath ?? "");
  });

/** `spec/validator/00_overview.md`に従ってProgramを静的検証する。 */
export const validateProgram = (
  program: Program,
  repository: DataRepository,
  instructionValidators: InstructionValidatorRegistry = new Map(),
): ValidationResult => {
  const diagnostics: ValidationDiagnostic[] = [];
  const validNodeIds = validateNodeIds(program, diagnostics);
  const resolved = resolveInstructions(program, repository, diagnostics);
  const validStartNode = validateStartNode(program, resolved, diagnostics);
  validateParameters(program, resolved, repository, diagnostics);
  validateConnections(program, resolved, diagnostics);

  program.nodes.forEach((node) => {
    const instruction = resolved.get(node.id);
    if (instruction === undefined) return;
    const validator = instructionValidators.get(instruction.implementationId);
    if (validator !== undefined) {
      diagnostics.push(
        ...validator({ program, node, instruction, repository }),
      );
    }
  });

  if (
    validNodeIds &&
    validStartNode &&
    resolved.size === program.nodes.length
  ) {
    const instructionMap = new Map(
      [...resolved].map(([nodeId, instruction]) => [
        program.nodes.find(({ id }) => id === nodeId)!.instructionId,
        instruction,
      ]),
    );
    const graph = buildControlFlowGraph(program, instructionMap);
    const reachable = findReachableNodeIds(graph, program.startNodeId);
    program.nodes
      .filter(({ id }) => !reachable.has(id))
      .sort((left, right) => compareNodeIds(left.id, right.id))
      .forEach((node) => {
        diagnostics.push(
          diagnostic(
            program,
            "warning",
            "unreachable_node",
            "Start Nodeから到達できません",
            node.id,
            null,
          ),
        );
      });
    findPureCycles(program, graph, reachable, instructionMap).forEach(
      (cycle) => {
        diagnostics.push(
          diagnostic(
            program,
            "warning",
            "pure_cycle",
            "終了経路を持たない純粋な循環です",
            cycle[0]!,
            null,
            cycle.slice(1),
          ),
        );
      },
    );
  }

  const orderedDiagnostics = sortDiagnostics(
    diagnostics.map((item) => ({
      ...item,
      relatedNodeIds: [...item.relatedNodeIds].sort(compareNodeIds),
    })),
  );
  return {
    isValid: orderedDiagnostics.every(({ severity }) => severity !== "error"),
    diagnostics: orderedDiagnostics,
  };
};
