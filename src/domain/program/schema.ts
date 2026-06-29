import { compileJsonSchema } from "../data/jsonEnvelope";
import type { Program } from "./models";

const int32 = {
  type: "integer",
  minimum: -2_147_483_648,
  maximum: 2_147_483_647,
} as const;

const nodeId = { type: "string", pattern: "^node_[1-9]\\d*$" } as const;
const parameterId = {
  type: "string",
  pattern: "^(?:[a-z]+(?:_[a-z]+)*|targetNodeId)$",
} as const;
const outputPathId = {
  type: "string",
  pattern: "^[a-z]+(?:_[a-z]+)*$",
} as const;
const utcIso8601 = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$",
} as const;

const reference = (
  type: string,
  field: string,
  fieldSchema: object = { type: "string", minLength: 1 },
): object => ({
  type: "object",
  additionalProperties: false,
  required: ["type", field],
  properties: {
    type: { const: type },
    [field]: fieldSchema,
  },
});

const parameterValue = {
  anyOf: [
    int32,
    { type: "boolean" },
    { type: "string" },
    reference("register_reference", "registerName"),
    reference("flag_reference", "flagName"),
    reference("memory_reference", "indexRegisterName"),
    reference("node_reference", "nodeId", nodeId),
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "dataType", "id"],
      properties: {
        type: { const: "master_data_reference" },
        dataType: {
          enum: [
            "instruction",
            "robot_body",
            "weapon",
            "sensor",
            "engine",
            "armor",
            "option",
            "projectile",
            "map",
            "game_rule",
          ],
        },
        id: { type: "string", minLength: 1 },
      },
    },
  ],
} as const;

export const programSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "nodes",
    "startNodeId",
    "nextNodeSequence",
    "metadata",
    "editorState",
  ],
  properties: {
    id: {
      type: "string",
      pattern:
        "^program_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    },
    nodes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "instructionId", "parameterValues", "connections"],
        properties: {
          id: nodeId,
          instructionId: {
            type: "string",
            pattern:
              "^instruction_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
          },
          parameterValues: {
            type: "object",
            propertyNames: parameterId,
            additionalProperties: parameterValue,
          },
          connections: {
            type: "object",
            propertyNames: outputPathId,
            additionalProperties: nodeId,
          },
        },
      },
    },
    startNodeId: nodeId,
    nextNodeSequence: { ...int32, minimum: 1 },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["name", "author", "description", "createdAt", "updatedAt"],
      properties: {
        name: { type: "string" },
        author: { type: "string" },
        description: { type: "string" },
        createdAt: utcIso8601,
        updatedAt: utcIso8601,
      },
    },
    editorState: {
      type: "object",
      additionalProperties: false,
      required: ["nodePositions", "comments"],
      properties: {
        nodePositions: {
          type: "object",
          propertyNames: nodeId,
          additionalProperties: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y"],
            properties: { x: int32, y: int32 },
          },
        },
        comments: {
          type: "object",
          propertyNames: nodeId,
          additionalProperties: { type: "string" },
        },
      },
    },
  },
} as const;

export const programValidator = compileJsonSchema<Program>(programSchema);
