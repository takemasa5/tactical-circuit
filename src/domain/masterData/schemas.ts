import type { ValidateFunction } from "ajv";

import { compileJsonSchema } from "../data/jsonEnvelope";
import type { MasterDataByType, MasterDataType } from "./models";

const int32 = {
  type: "integer",
  minimum: -2_147_483_648,
  maximum: 2_147_483_647,
} as const;

const nonNegativeInt32 = { ...int32, minimum: 0 } as const;
const positiveInt32 = { ...int32, minimum: 1 } as const;
const angle = { ...int32, minimum: 0, maximum: 359 } as const;
const fieldOfView = { ...int32, minimum: 1, maximum: 360 } as const;

const size = {
  type: "object",
  additionalProperties: false,
  required: ["width", "height"],
  properties: {
    width: positiveInt32,
    height: positiveInt32,
  },
} as const;

const position = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: { x: int32, y: int32 },
} as const;

const masterDataTypes: readonly MasterDataType[] = [
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
];

const baseProperties = {
  id: { type: "string", minLength: 1 },
  displayName: { type: "string" },
  description: { type: "string" },
  enabled: { type: "boolean" },
  implementationId: { type: "string", minLength: 1 },
} as const;

const baseRequired = ["id", "displayName", "description", "enabled"] as const;

const definitionSchema = (
  properties: Readonly<Record<string, object>>,
  required: readonly string[],
  implementationRequired = false,
): object => ({
  type: "object",
  additionalProperties: false,
  required: [
    ...baseRequired,
    ...(implementationRequired ? ["implementationId"] : []),
    ...required,
  ],
  properties: { ...baseProperties, ...properties },
});

const instructionSchema = definitionSchema(
  {
    category: {
      enum: [
        "control",
        "branch",
        "sensor",
        "arithmetic",
        "memory",
        "action",
        "special",
      ],
    },
    parameters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "displayName", "description", "valueType", "required"],
        properties: {
          id: { type: "string", pattern: "^[a-z]+(?:_[a-z]+)*$" },
          displayName: { type: "string" },
          description: { type: "string" },
          valueType: {
            enum: [
              "distance",
              "degree",
              "tick",
              "cpu_cost",
              "count",
              "speed",
              "damage",
              "heat",
              "ammunition",
              "boolean",
              "enum",
              "register_reference",
              "flag_reference",
              "memory_reference",
              "node_reference",
              "master_data_reference",
            ],
          },
          required: { type: "boolean" },
          defaultValue: {},
          minValue: int32,
          maxValue: int32,
          referenceDataType: { enum: masterDataTypes },
          enumValues: { type: "array", items: { type: "string" } },
          editorInfo: { type: "object" },
        },
      },
    },
    outputPaths: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "displayName",
          "description",
          "required",
          "displayOrder",
        ],
        properties: {
          id: { type: "string", pattern: "^[a-z]+(?:_[a-z]+)*$" },
          displayName: { type: "string" },
          description: { type: "string" },
          required: { type: "boolean" },
          displayOrder: int32,
        },
      },
    },
    cpuCost: nonNegativeInt32,
    editorInfo: { type: "object" },
  },
  ["category", "parameters", "outputPaths", "cpuCost"],
  true,
);

const robotBodySchema = definitionSchema(
  {
    weight: nonNegativeInt32,
    maxHp: nonNegativeInt32,
    maxEnergy: nonNegativeInt32,
    heatCapacity: nonNegativeInt32,
    size,
    slots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "displayName", "category"],
        properties: {
          id: { type: "string", pattern: "^slot_[1-9]\\d*$" },
          displayName: { type: "string" },
          category: { enum: ["weapon", "sensor", "engine", "armor", "option"] },
        },
      },
    },
  },
  ["weight", "maxHp", "maxEnergy", "heatCapacity", "size", "slots"],
);

const weaponSchema = definitionSchema(
  {
    projectileId: { type: "string" },
    damage: nonNegativeInt32,
    maxAmmunition: nonNegativeInt32,
    lifetimeTicks: nonNegativeInt32,
    fireIntervalTicks: nonNegativeInt32,
    reloadTicks: nonNegativeInt32,
    heatGeneration: nonNegativeInt32,
    energyConsumption: nonNegativeInt32,
    aimSpreadDegree: angle,
    weight: nonNegativeInt32,
    ammunitionWeight: nonNegativeInt32,
  },
  [
    "projectileId",
    "damage",
    "maxAmmunition",
    "lifetimeTicks",
    "fireIntervalTicks",
    "reloadTicks",
    "heatGeneration",
    "energyConsumption",
    "aimSpreadDegree",
    "weight",
    "ammunitionWeight",
  ],
);

const sensorSchema = definitionSchema(
  {
    detectionDistance: nonNegativeInt32,
    fieldOfViewDegree: fieldOfView,
    energyConsumption: nonNegativeInt32,
    weight: nonNegativeInt32,
  },
  ["detectionDistance", "fieldOfViewDegree", "energyConsumption", "weight"],
);

const engineSchema = definitionSchema(
  {
    maxForwardSpeed: nonNegativeInt32,
    maxBackwardSpeed: nonNegativeInt32,
    maxStrafeSpeed: nonNegativeInt32,
    acceleration: nonNegativeInt32,
    turnSpeedDegree: nonNegativeInt32,
    energyConsumption: nonNegativeInt32,
    weight: nonNegativeInt32,
  },
  [
    "maxForwardSpeed",
    "maxBackwardSpeed",
    "maxStrafeSpeed",
    "acceleration",
    "turnSpeedDegree",
    "energyConsumption",
    "weight",
  ],
);

const armorSchema = definitionSchema(
  {
    durability: nonNegativeInt32,
    defense: nonNegativeInt32,
    weight: nonNegativeInt32,
    heatDissipation: nonNegativeInt32,
  },
  ["durability", "defense", "weight", "heatDissipation"],
);

const optionSchema = definitionSchema({}, [], true);

const projectileSchema = definitionSchema(
  {
    speed: nonNegativeInt32,
    size,
    explosionRadius: nonNegativeInt32,
    explosionDamage: nonNegativeInt32,
  },
  ["speed", "size", "explosionRadius", "explosionDamage"],
);

const mapSchema = definitionSchema(
  {
    size,
    obstacles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "position", "size"],
        properties: {
          id: { type: "string", pattern: "^obstacle_[1-9]\\d*$" },
          position,
          size,
        },
      },
    },
    spawnPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "direction"],
        properties: { position, direction: angle },
      },
    },
  },
  ["size", "obstacles", "spawnPoints"],
);

const gameRuleSchema = definitionSchema(
  {
    cpuLimit: positiveInt32,
    tickLimit: positiveInt32,
    participantCount: positiveInt32,
    registerNames: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    flagNames: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    memorySize: positiveInt32,
    callStackSize: positiveInt32,
  },
  [
    "cpuLimit",
    "tickLimit",
    "participantCount",
    "registerNames",
    "flagNames",
    "memorySize",
    "callStackSize",
  ],
);

const validators: {
  [TType in MasterDataType]: ValidateFunction<MasterDataByType[TType]>;
} = {
  instruction: compileJsonSchema(instructionSchema),
  robot_body: compileJsonSchema(robotBodySchema),
  weapon: compileJsonSchema(weaponSchema),
  sensor: compileJsonSchema(sensorSchema),
  engine: compileJsonSchema(engineSchema),
  armor: compileJsonSchema(armorSchema),
  option: compileJsonSchema(optionSchema),
  projectile: compileJsonSchema(projectileSchema),
  map: compileJsonSchema(mapSchema),
  game_rule: compileJsonSchema(gameRuleSchema),
};

export const getMasterDataValidator = <TType extends MasterDataType>(
  dataType: TType,
): ValidateFunction<MasterDataByType[TType]> => validators[dataType];
