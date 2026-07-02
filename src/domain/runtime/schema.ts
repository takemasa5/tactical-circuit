const int32 = {
  type: "integer",
  minimum: -2_147_483_648,
  maximum: 2_147_483_647,
} as const;
const nonNegativeInt32 = { ...int32, minimum: 0 } as const;
const positiveInt32 = { ...int32, minimum: 1 } as const;
const angle = { ...int32, minimum: 0, maximum: 359 } as const;
const movementDistance = { ...int32, minimum: 0, maximum: 10_000 } as const;
const nodeId = { type: "string", pattern: "^node_[1-9]\\d*$" } as const;
const robotId = { type: "string", pattern: "^robot_[1-9]\\d*$" } as const;
const bulletId = { type: "string", pattern: "^bullet_[1-9]\\d*$" } as const;
const slotId = { type: "string", pattern: "^slot_[1-9]\\d*$" } as const;
const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export const positionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: { x: int32, y: int32 },
} as const;

export const vectorSchema = positionSchema;

export const randomStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: { value: int32 },
} as const;

const moveRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "distance"],
  properties: {
    type: { enum: ["forward", "backward"] },
    distance: movementDistance,
  },
} as const;

const turnRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "turnTo"],
  properties: {
    type: { enum: ["turn_left", "turn_right"] },
    turnTo: angle,
  },
} as const;

const basicMovementRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: { type: { enum: ["strafe_left", "strafe_right", "stop"] } },
} as const;

const movementRequestSchema = {
  oneOf: [moveRequestSchema, turnRequestSchema, basicMovementRequestSchema],
} as const;

const switchWeaponRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "hand"],
  properties: {
    type: { const: "switch_weapon" },
    hand: { enum: ["right", "left"] },
  },
} as const;

const fireRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "targetDirection", "targetPosition"],
  properties: {
    type: { const: "fire" },
    targetDirection: angle,
    targetPosition: positionSchema,
  },
} as const;

const meleeRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: { type: { const: "melee" } },
} as const;

const combatRequestSchema = {
  oneOf: [switchWeaponRequestSchema, fireRequestSchema, meleeRequestSchema],
} as const;

export const actionRequestsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["movement", "combat"],
  properties: {
    movement: { anyOf: [{ type: "null" }, movementRequestSchema] },
    combat: { anyOf: [{ type: "null" }, combatRequestSchema] },
  },
} as const;

export const aiRuntimeStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nextNodeId", "registers", "flags", "callStack", "memory"],
  properties: {
    nextNodeId: { anyOf: [{ type: "null" }, nodeId] },
    registers: { type: "object", additionalProperties: int32 },
    flags: { type: "object", additionalProperties: { type: "boolean" } },
    callStack: { type: "array", items: nodeId },
    memory: {
      type: "object",
      additionalProperties: false,
      required: ["values"],
      properties: { values: { type: "array", items: int32 } },
    },
  },
} as const;

export const robotStateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "robotDesignId",
    "position",
    "direction",
    "velocity",
    "currentHp",
    "energy",
    "heat",
    "status",
    "partDamage",
    "selectedWeaponSlotId",
    "ammunition",
    "aiRuntimeState",
    "actionRequests",
  ],
  properties: {
    id: robotId,
    robotDesignId: {
      type: "string",
      pattern:
        "^robo_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    },
    position: positionSchema,
    direction: angle,
    velocity: vectorSchema,
    currentHp: nonNegativeInt32,
    energy: nonNegativeInt32,
    heat: nonNegativeInt32,
    status: { enum: ["active", "destroyed"] },
    partDamage: {
      type: "object",
      propertyNames: slotId,
      additionalProperties: nonNegativeInt32,
    },
    selectedWeaponSlotId: { anyOf: [{ type: "null" }, slotId] },
    ammunition: {
      type: "object",
      propertyNames: slotId,
      additionalProperties: nonNegativeInt32,
    },
    aiRuntimeState: aiRuntimeStateSchema,
    actionRequests: actionRequestsSchema,
  },
} as const;

export const sensorSnapshotSchema = {
  type: "object",
  additionalProperties: false,
  required: ["robots", "bullets"],
  properties: {
    robots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "worldPosition",
          "relativePosition",
          "distance",
          "bearing",
          "status",
        ],
        properties: {
          id: robotId,
          worldPosition: positionSchema,
          relativePosition: positionSchema,
          distance: nonNegativeInt32,
          bearing: int32,
          status: { enum: ["active", "destroyed"] },
        },
      },
    },
    bullets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "ownerRobotId",
          "relativePosition",
          "vector",
          "distance",
          "bearing",
        ],
        properties: {
          id: bulletId,
          ownerRobotId: robotId,
          relativePosition: positionSchema,
          vector: vectorSchema,
          distance: nonNegativeInt32,
          bearing: int32,
        },
      },
    },
  },
} as const;

export const actionStatusSnapshotSchema = {
  type: "object",
  additionalProperties: false,
  required: ["movement", "combat"],
  properties: {
    movement: { enum: ["idle", "running"] },
    combat: { enum: ["idle", "running"] },
  },
} as const;

export const executionInputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "tick",
    "robot",
    "aiRuntimeState",
    "sensors",
    "randomState",
    "actionStatus",
  ],
  properties: {
    tick: nonNegativeInt32,
    robot: robotStateSchema,
    aiRuntimeState: aiRuntimeStateSchema,
    sensors: sensorSnapshotSchema,
    randomState: randomStateSchema,
    actionStatus: actionStatusSnapshotSchema,
  },
} as const;

export const bulletStateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "ownerRobotId",
    "weaponId",
    "projectileId",
    "position",
    "vector",
    "remainingLifetimeTicks",
  ],
  properties: {
    id: bulletId,
    ownerRobotId: robotId,
    weaponId: { type: "string", pattern: `^weapon_${uuid}$` },
    projectileId: {
      type: "string",
      pattern: `^projectile_${uuid}$`,
    },
    position: positionSchema,
    vector: vectorSchema,
    remainingLifetimeTicks: nonNegativeInt32,
  },
} as const;

export const battleResultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["winnerRobotIds", "reason"],
  properties: {
    winnerRobotIds: { type: "array", items: robotId },
    reason: {
      enum: ["opponent_destroyed", "mutual_destruction", "tick_limit"],
    },
  },
} as const;

export const worldStateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "tick",
    "robots",
    "bullets",
    "obstacles",
    "status",
    "result",
    "randomState",
    "nextBulletSequence",
  ],
  properties: {
    tick: nonNegativeInt32,
    robots: { type: "array", items: robotStateSchema },
    bullets: { type: "array", items: bulletStateSchema },
    obstacles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "position", "size"],
        properties: {
          id: { type: "string", pattern: "^obstacle_[1-9]\\d*$" },
          position: positionSchema,
          size: {
            type: "object",
            additionalProperties: false,
            required: ["width", "height"],
            properties: { width: positiveInt32, height: positiveInt32 },
          },
        },
      },
    },
    status: { enum: ["ready", "running", "finished"] },
    result: { anyOf: [{ type: "null" }, battleResultSchema] },
    randomState: randomStateSchema,
    nextBulletSequence: positiveInt32,
  },
} as const;
