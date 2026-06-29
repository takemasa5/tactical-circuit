import { describe, expect, it } from "vitest";

import type { MasterDataType } from "./models";
import { getMasterDataValidator } from "./schemas";

const uuid = "550e8400-e29b-41d4-a716-446655440000";
const common = {
  displayName: "Test",
  description: "",
  enabled: true,
};

const definitions: Readonly<Record<MasterDataType, object>> = {
  instruction: {
    ...common,
    id: `instruction_${uuid}`,
    implementationId: "test_instruction",
    category: "control",
    parameters: [],
    outputPaths: [],
    cpuCost: 0,
  },
  robot_body: {
    ...common,
    id: `robot_body_${uuid}`,
    weight: 0,
    maxHp: 0,
    maxEnergy: 0,
    heatCapacity: 0,
    size: { width: 1, height: 1 },
    slots: [],
  },
  weapon: {
    ...common,
    id: `weapon_${uuid}`,
    projectileId: `projectile_${uuid}`,
    damage: 0,
    maxAmmunition: 0,
    lifetimeTicks: 0,
    fireIntervalTicks: 0,
    reloadTicks: 0,
    heatGeneration: 0,
    energyConsumption: 0,
    aimSpreadDegree: 0,
    weight: 0,
    ammunitionWeight: 0,
  },
  sensor: {
    ...common,
    id: `sensor_${uuid}`,
    detectionDistance: 0,
    fieldOfViewDegree: 360,
    energyConsumption: 0,
    weight: 0,
  },
  engine: {
    ...common,
    id: `engine_${uuid}`,
    maxForwardSpeed: 0,
    maxBackwardSpeed: 0,
    maxStrafeSpeed: 0,
    acceleration: 0,
    turnSpeedDegree: 0,
    energyConsumption: 0,
    weight: 0,
  },
  armor: {
    ...common,
    id: `armor_${uuid}`,
    durability: 0,
    defense: 0,
    weight: 0,
    heatDissipation: 0,
  },
  option: {
    ...common,
    id: `option_${uuid}`,
    implementationId: "test_option",
  },
  projectile: {
    ...common,
    id: `projectile_${uuid}`,
    speed: 0,
    size: { width: 1, height: 1 },
    explosionRadius: 0,
    explosionDamage: 0,
  },
  map: {
    ...common,
    id: `map_${uuid}`,
    size: { width: 1, height: 1 },
    obstacles: [],
    spawnPoints: [],
  },
  game_rule: {
    ...common,
    id: `game_rule_${uuid}`,
    cpuLimit: 1,
    tickLimit: 1,
    participantCount: 2,
    registerNames: ["A", "B", "C", "D"],
    flagNames: ["F1", "F2", "F3"],
    memorySize: 20,
    callStackSize: 20,
  },
};

describe("Master Data schemas", () => {
  it.each(Object.entries(definitions))(
    "%s Definitionを検証できる",
    (type, value) => {
      const validator = getMasterDataValidator(type as MasterDataType);

      expect(validator(value), JSON.stringify(validator.errors)).toBe(true);
    },
  );

  it("CALLの予約Parameter ID targetNodeIdを受け付ける", () => {
    const validator = getMasterDataValidator("instruction");

    expect(
      validator({
        ...definitions.instruction,
        implementationId: "call",
        parameters: [
          {
            id: "targetNodeId",
            displayName: "Target Node",
            description: "",
            valueType: "node_reference",
            required: true,
          },
        ],
      }),
      JSON.stringify(validator.errors),
    ).toBe(true);
  });

  it("CALL以外では予約Parameter ID targetNodeIdを拒否する", () => {
    const validator = getMasterDataValidator("instruction");

    expect(
      validator({
        ...definitions.instruction,
        parameters: [
          {
            id: "targetNodeId",
            displayName: "Target Node",
            description: "",
            valueType: "node_reference",
            required: true,
          },
        ],
      }),
    ).toBe(false);
  });
});
