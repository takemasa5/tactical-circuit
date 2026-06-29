import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type {
  InstructionDefinition,
  InstructionId,
  MasterDataId,
} from "../masterData/models";
import {
  createDataRepository,
  type MasterDataEntry,
} from "../masterData/repository";
import type { Program, ProgramNode } from "../program/models";
import { validateProgram } from "./validateProgram";

const instructionId = (suffix: string): InstructionId =>
  `instruction_00000000-0000-4000-8000-${suffix.padStart(12, "0")}` as InstructionId;
const nodeId = (sequence: number): NodeId => `node_${sequence}` as NodeId;

const startInstruction: InstructionDefinition = {
  id: instructionId("1"),
  displayName: "Start",
  description: "",
  enabled: true,
  implementationId: "start",
  category: "control",
  parameters: [],
  outputPaths: [
    {
      id: "next",
      displayName: "Next",
      description: "",
      required: true,
      displayOrder: 0 as Int32,
    },
  ],
  cpuCost: 0 as Int32,
};

const endInstruction: InstructionDefinition = {
  id: instructionId("2"),
  displayName: "End",
  description: "",
  enabled: true,
  implementationId: "end",
  category: "control",
  parameters: [],
  outputPaths: [],
  cpuCost: 0 as Int32,
};

const actionInstruction: InstructionDefinition = {
  id: instructionId("3"),
  displayName: "Move",
  description: "",
  enabled: true,
  implementationId: "move",
  category: "action",
  parameters: [
    {
      id: "speed",
      displayName: "Speed",
      description: "",
      valueType: "speed",
      required: true,
      minValue: 0 as Int32,
      maxValue: 100 as Int32,
    },
  ],
  outputPaths: [
    {
      id: "next",
      displayName: "Next",
      description: "",
      required: false,
      displayOrder: 0 as Int32,
    },
  ],
  cpuCost: 1 as Int32,
};

const branchInstruction: InstructionDefinition = {
  ...actionInstruction,
  id: instructionId("4"),
  displayName: "Branch",
  implementationId: "branch",
  category: "branch",
  parameters: [],
  outputPaths: [
    {
      id: "yes",
      displayName: "Yes",
      description: "",
      required: true,
      displayOrder: 0 as Int32,
    },
    {
      id: "no",
      displayName: "No",
      description: "",
      required: true,
      displayOrder: 1 as Int32,
    },
  ],
};

const referenceInstruction: InstructionDefinition = {
  ...actionInstruction,
  id: instructionId("5"),
  displayName: "Reference",
  implementationId: "reference",
  parameters: [
    {
      id: "mode",
      displayName: "Mode",
      description: "",
      valueType: "enum",
      required: true,
      enumValues: ["safe", "fast"],
    },
    {
      id: "target",
      displayName: "Target",
      description: "",
      valueType: "node_reference",
      required: true,
    },
    {
      id: "weapon",
      displayName: "Weapon",
      description: "",
      valueType: "master_data_reference",
      required: true,
      referenceDataType: "weapon",
    },
  ],
  outputPaths: [
    {
      id: "next",
      displayName: "Next",
      description: "",
      required: true,
      displayOrder: 0 as Int32,
    },
  ],
};

const callInstruction: InstructionDefinition = {
  ...actionInstruction,
  id: instructionId("6"),
  displayName: "CALL",
  implementationId: "call",
  category: "branch",
  parameters: [
    {
      id: "targetNodeId",
      displayName: "Target",
      description: "",
      valueType: "node_reference",
      required: true,
    },
  ],
  outputPaths: [
    {
      id: "next",
      displayName: "Next",
      description: "",
      required: true,
      displayOrder: 0 as Int32,
    },
  ],
};

const instructions = [
  startInstruction,
  endInstruction,
  actionInstruction,
  branchInstruction,
  referenceInstruction,
  callInstruction,
];

const repository = (() => {
  const result = createDataRepository(
    instructions.map((definition): MasterDataEntry => ({
      dataType: "instruction",
      definition,
    })),
    new Set(instructions.map(({ implementationId }) => implementationId)),
  );
  if (!result.success) throw new Error("テスト用Repositoryを作成できません");
  return result.data;
})();

const node = (
  id: number,
  instruction: InstructionDefinition,
  connections: Readonly<Record<string, NodeId>> = {},
  parameterValues: ProgramNode["parameterValues"] = {},
): ProgramNode => ({
  id: nodeId(id),
  instructionId: instruction.id,
  parameterValues,
  connections,
});

const program = (nodes: readonly ProgramNode[]): Program => ({
  id: "program_00000000-0000-4000-8000-000000000001" as ProgramId,
  nodes,
  startNodeId: nodeId(1),
  nextNodeSequence: (nodes.length + 1) as Int32,
  metadata: {
    name: "test",
    author: "",
    description: "",
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  },
  editorState: { nodePositions: {}, comments: {} },
});

describe("validateProgram", () => {
  it("ErrorがないProgramを実行可能と判定する", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(2, endInstruction),
    ]);

    expect(validateProgram(target, repository)).toEqual({
      isValid: true,
      diagnostics: [],
    });
  });

  it("必須接続、必須Parameter、値域、未知Parameterをまとめて検出する", () => {
    const target = program([
      node(1, startInstruction),
      node(2, actionInstruction, {}, { speed: 101 as Int32, extra: true }),
    ]);

    const result = validateProgram(target, repository);

    expect(result.isValid).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "missing_required_connection",
      "parameter_out_of_range",
      "unknown_parameter",
      "optional_connection_missing",
      "unreachable_node",
    ]);
  });

  it("到達可能な終了経路のない自己ループをWarningにする", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(2, actionInstruction, { next: nodeId(2) }, { speed: 10 as Int32 }),
    ]);

    const result = validateProgram(target, repository);

    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toMatchObject([
      {
        severity: "warning",
        code: "pure_cycle",
        nodeId: nodeId(2),
        relatedNodeIds: [],
      },
    ]);
  });

  it("複数Nodeの純粋循環を1件のWarningと関連Nodeで返す", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(2, actionInstruction, { next: nodeId(3) }, { speed: 10 as Int32 }),
      node(3, actionInstruction, { next: nodeId(2) }, { speed: 20 as Int32 }),
    ]);

    const cycle = validateProgram(target, repository).diagnostics.find(
      ({ code }) => code === "pure_cycle",
    );

    expect(cycle).toMatchObject({
      nodeId: nodeId(2),
      relatedNodeIds: [nodeId(3)],
    });
  });

  it("複数出力パスを持つ条件分岐の循環を純粋循環にしない", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(2, branchInstruction, { yes: nodeId(2), no: nodeId(2) }),
    ]);

    expect(
      validateProgram(target, repository).diagnostics.some(
        ({ code }) => code === "pure_cycle",
      ),
    ).toBe(false);
  });

  it("CALLを含む循環を純粋循環にしない", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(
        2,
        callInstruction,
        { next: nodeId(2) },
        {
          targetNodeId: { type: "node_reference", nodeId: nodeId(2) },
        },
      ),
    ]);

    expect(
      validateProgram(target, repository).diagnostics.some(
        ({ code }) => code === "pure_cycle",
      ),
    ).toBe(false);
  });

  it("Start Nodeの重複とstartNodeIdの不一致を検出する", () => {
    const duplicated = program([
      node(1, startInstruction, { next: nodeId(3) }),
      node(2, startInstruction, { next: nodeId(3) }),
      node(3, endInstruction),
    ]);
    const mismatched = {
      ...program([
        node(1, endInstruction),
        node(2, startInstruction, { next: nodeId(1) }),
      ]),
      startNodeId: nodeId(1),
    };

    expect(validateProgram(duplicated, repository).diagnostics).toMatchObject([
      {
        code: "multiple_start_nodes",
        nodeId: nodeId(1),
        relatedNodeIds: [nodeId(2)],
      },
    ]);
    expect(
      validateProgram(mismatched, repository).diagnostics.some(
        ({ code }) => code === "start_node_mismatch",
      ),
    ).toBe(true);
  });

  it("列挙値、Node参照、Master Data参照の不正を検出する", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(
        2,
        referenceInstruction,
        { next: nodeId(3) },
        {
          mode: "unknown",
          target: { type: "node_reference", nodeId: nodeId(99) },
          weapon: {
            type: "master_data_reference",
            dataType: "sensor",
            id: "sensor_00000000-0000-4000-8000-000000000001" as MasterDataId,
          },
        },
      ),
      node(3, endInstruction),
    ]);

    expect(
      validateProgram(target, repository).diagnostics.map(({ code }) => code),
    ).toEqual([
      "missing_reference_target",
      "reference_type_mismatch",
      "unknown_enum_value",
    ]);
  });

  it("Master Data参照IDの形式と参照先の存在を区別する", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(
        2,
        referenceInstruction,
        { next: nodeId(3) },
        {
          mode: "safe",
          target: { type: "node_reference", nodeId: nodeId(3) },
          weapon: {
            type: "master_data_reference",
            dataType: "weapon",
            id: "weapon_invalid" as MasterDataId,
          },
        },
      ),
      node(3, endInstruction),
    ]);
    const missingTarget = {
      ...target,
      nodes: target.nodes.map((current) =>
        current.id === nodeId(2)
          ? {
              ...current,
              parameterValues: {
                ...current.parameterValues,
                weapon: {
                  type: "master_data_reference" as const,
                  dataType: "weapon" as const,
                  id: "weapon_00000000-0000-4000-8000-000000000001" as MasterDataId,
                },
              },
            }
          : current,
      ),
    };

    expect(validateProgram(target, repository).diagnostics).toMatchObject([
      { code: "invalid_reference" },
    ]);
    expect(
      validateProgram(missingTarget, repository).diagnostics,
    ).toMatchObject([{ code: "missing_reference_target" }]);
  });

  it("未知の出力パス、存在しない接続先、接続禁止命令の接続を検出する", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(2, endInstruction, { next: nodeId(99) }),
    ]);

    expect(
      validateProgram(target, repository).diagnostics.map(({ code }) => code),
    ).toEqual(["connection_not_allowed", "invalid_connection_target"]);
  });

  it("implementationIdに対応する命令固有Validatorを呼び出す", () => {
    const target = program([
      node(1, startInstruction, { next: nodeId(2) }),
      node(2, endInstruction),
    ]);

    const result = validateProgram(
      target,
      repository,
      new Map([
        [
          "end",
          ({ program: validatedProgram, node: validatedNode }) => [
            {
              severity: "warning" as const,
              code: "end_specific_warning",
              message: "命令固有Warning",
              programId: validatedProgram.id,
              nodeId: validatedNode.id,
              fieldPath: null,
              relatedNodeIds: [],
            },
          ],
        ],
      ]),
    );

    expect(result).toMatchObject({
      isValid: true,
      diagnostics: [{ code: "end_specific_warning" }],
    });
  });

  it("診断結果を入力配列順によらず決定論的に並べる", () => {
    const first = program([
      node(1, startInstruction, { next: nodeId(3) }),
      node(3, endInstruction),
      node(2, endInstruction),
    ]);
    const second = {
      ...first,
      nodes: [first.nodes[2]!, ...first.nodes.slice(0, 2)],
    };

    expect(validateProgram(first, repository)).toEqual(
      validateProgram(second, repository),
    );
  });

  it("入力Programを変更しない", () => {
    const target = program([node(1, startInstruction)]);
    const before = JSON.stringify(target);

    validateProgram(target, repository);

    expect(JSON.stringify(target)).toBe(before);
  });
});
