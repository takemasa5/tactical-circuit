import { compileJsonSchema } from "../data/jsonEnvelope";
import { programSchema } from "../program/schema";
import { robotDesignSchema } from "../robotDesign/schema";
import {
  battleResultSchema,
  bulletStateSchema,
  randomStateSchema,
  robotStateSchema,
  worldStateSchema,
} from "../runtime/schema";
import type { ReplaySaveData } from "./models";

const int32 = {
  type: "integer",
  minimum: -2_147_483_648,
  maximum: 2_147_483_647,
} as const;
const nonNegativeInt32 = { ...int32, minimum: 0 } as const;
const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const replayEventSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "robot"],
      properties: {
        type: { const: "robot_updated" },
        robot: robotStateSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "bullet"],
      properties: {
        type: { const: "bullet_created" },
        bullet: bulletStateSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "bullet"],
      properties: {
        type: { const: "bullet_updated" },
        bullet: bulletStateSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "bulletId"],
      properties: {
        type: { const: "bullet_removed" },
        bulletId: { type: "string", pattern: "^bullet_[1-9]\\d*$" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "status", "result"],
      properties: {
        type: { const: "game_state_updated" },
        status: { enum: ["ready", "running", "finished"] },
        result: { anyOf: [{ type: "null" }, battleResultSchema] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "randomState"],
      properties: {
        type: { const: "random_state_updated" },
        randomState: randomStateSchema,
      },
    },
  ],
} as const;

export const replaySaveDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "replayData",
    "robotDesigns",
    "programs",
    "mapId",
    "gameRuleId",
    "initialRandomSeed",
    "masterDataVersion",
  ],
  properties: {
    replayData: {
      type: "object",
      additionalProperties: false,
      required: ["id", "initialWorldState", "frames"],
      properties: {
        id: { type: "string", pattern: `^replay_${uuid}$` },
        initialWorldState: worldStateSchema,
        frames: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["tick", "events"],
            properties: {
              tick: nonNegativeInt32,
              events: { type: "array", items: replayEventSchema },
            },
          },
        },
      },
    },
    robotDesigns: { type: "array", items: robotDesignSchema },
    programs: { type: "array", items: programSchema },
    mapId: { type: "string", pattern: `^map_${uuid}$` },
    gameRuleId: { type: "string", pattern: `^game_rule_${uuid}$` },
    initialRandomSeed: int32,
    masterDataVersion: {
      type: "string",
      pattern: "^(0|[1-9]\\d*)\\.([1-9]\\d*)\\.([1-9]\\d*)$",
    },
  },
} as const;

export const replaySaveDataValidator =
  compileJsonSchema<ReplaySaveData>(replaySaveDataSchema);
