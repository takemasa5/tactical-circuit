import { describe, expect, it } from "vitest";

import { saveJsonEnvelope } from "../data/jsonEnvelope";
import { loadDataRepository, loadMasterDataDefinition } from "./loader";

const uuidA = "550e8400-e29b-41d4-a716-446655440000";
const uuidB = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

const projectilePayload = {
  id: `projectile_${uuidA}`,
  displayName: "Test Projectile",
  description: "",
  enabled: true,
  speed: 10,
  size: { width: 1, height: 1 },
  explosionRadius: 0,
  explosionDamage: 0,
};

const weaponPayload = {
  id: `weapon_${uuidB}`,
  displayName: "Test Weapon",
  description: "",
  enabled: true,
  projectileId: `projectile_${uuidA}`,
  damage: 10,
  maxAmmunition: 5,
  lifetimeTicks: 20,
  fireIntervalTicks: 1,
  reloadTicks: 10,
  heatGeneration: 1,
  energyConsumption: 1,
  aimSpreadDegree: 0,
  weight: 10,
  ammunitionWeight: 1,
};

describe("Master Data loader", () => {
  it("JSON Schemaに適合するDefinitionを読み込む", () => {
    const result = loadMasterDataDefinition({
      dataType: "projectile",
      json: saveJsonEnvelope("projectile", projectilePayload),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(`projectile_${uuidA}`);
    }
  });

  it("フォルダ種別とdataTypeが異なるDefinitionを拒否する", () => {
    const result = loadMasterDataDefinition({
      dataType: "weapon",
      json: saveJsonEnvelope("projectile", projectilePayload),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe("unexpected_data_type");
    }
  });

  it("Manifestと全Definitionを検証してRepositoryを公開する", () => {
    const result = loadDataRepository(
      saveJsonEnvelope("master_data_manifest", {
        masterDataVersion: "0.1.1",
      }),
      [
        {
          dataType: "weapon",
          json: saveJsonEnvelope("weapon", weaponPayload),
        },
        {
          dataType: "projectile",
          json: saveJsonEnvelope("projectile", projectilePayload),
        },
      ],
      new Set(),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.masterDataVersion).toBe("0.1.1");
      expect(
        result.data.repository.get("weapon", `weapon_${uuidB}`)?.projectileId,
      ).toBe(`projectile_${uuidA}`);
    }
  });

  it("不正な数値範囲をSchemaで拒否する", () => {
    const result = loadMasterDataDefinition({
      dataType: "weapon",
      json: saveJsonEnvelope("weapon", {
        ...weaponPayload,
        aimSpreadDegree: 360,
      }),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map(({ code }) => code)).toContain("schema_maximum");
    }
  });

  it("Sensorの全周視野360度を受け付ける", () => {
    const result = loadMasterDataDefinition({
      dataType: "sensor",
      json: saveJsonEnvelope("sensor", {
        id: `sensor_${uuidA}`,
        displayName: "Omnidirectional Sensor",
        description: "",
        enabled: true,
        detectionDistance: 100,
        fieldOfViewDegree: 360,
        energyConsumption: 1,
        weight: 1,
      }),
    });

    expect(result.success).toBe(true);
  });
});
