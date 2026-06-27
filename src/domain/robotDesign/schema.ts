import { compileJsonSchema } from "../data/jsonEnvelope";
import type { RobotDesign } from "./models";

const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const slotId = { type: "string", pattern: "^slot_[1-9]\\d*$" } as const;
const utcIso8601 = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$",
} as const;

export const robotDesignSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "bodyDefinitionId",
    "programId",
    "equipment",
    "ammunition",
    "metadata",
  ],
  properties: {
    id: { type: "string", pattern: `^robo_${uuid}$` },
    bodyDefinitionId: { type: "string", pattern: `^robot_body_${uuid}$` },
    programId: { type: "string", pattern: `^program_${uuid}$` },
    equipment: {
      type: "object",
      propertyNames: slotId,
      additionalProperties: {
        type: "string",
        pattern: `^(?:weapon|sensor|engine|armor|option)_${uuid}$`,
      },
    },
    ammunition: {
      type: "object",
      propertyNames: slotId,
      additionalProperties: {
        type: "integer",
        minimum: 0,
        maximum: 2_147_483_647,
      },
    },
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
  },
} as const;

export const robotDesignValidator =
  compileJsonSchema<RobotDesign>(robotDesignSchema);
