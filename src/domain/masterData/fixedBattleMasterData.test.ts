import { describe, expect, it } from "vitest";

import battleManifestJson from "../../../public/master-data/battle/manifest.json?raw";
import engineJson from "../../../public/master-data/battle/engine.json?raw";
import gameRuleJson from "../../../public/master-data/battle/game_rule.json?raw";
import mapJson from "../../../public/master-data/battle/map.json?raw";
import projectileJson from "../../../public/master-data/battle/projectile.json?raw";
import robotBodyJson from "../../../public/master-data/battle/robot_body.json?raw";
import sensorJson from "../../../public/master-data/battle/sensor.json?raw";
import weaponJson from "../../../public/master-data/battle/weapon.json?raw";
import masterManifestJson from "../../../public/master-data/manifest.json?raw";
import { PRODUCTION_IMPLEMENTATION_IDS } from "../ai/instructions";
import { loadDataRepository, type MasterDataDocument } from "./loader";

const documents: readonly MasterDataDocument[] = [
  { dataType: "robot_body", json: robotBodyJson },
  { dataType: "engine", json: engineJson },
  { dataType: "sensor", json: sensorJson },
  { dataType: "projectile", json: projectileJson },
  { dataType: "weapon", json: weaponJson },
  { dataType: "map", json: mapJson },
  { dataType: "game_rule", json: gameRuleJson },
];

describe("Phase 1固定対戦Master Data", () => {
  it("manifestに記載した全DefinitionをData Repositoryへ読み込める", () => {
    const battleManifest = JSON.parse(battleManifestJson) as {
      files: readonly { dataType: string; path: string }[];
    };
    expect(battleManifest.files).toHaveLength(documents.length);

    const result = loadDataRepository(
      masterManifestJson,
      documents,
      PRODUCTION_IMPLEMENTATION_IDS,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.repository.getAll("robot_body")[0]).toMatchObject({
      maxHp: 100,
      size: { width: 40, height: 40 },
    });
    expect(result.data.repository.getAll("sensor")[0]).toMatchObject({
      detectionDistance: 1000,
      fieldOfViewDegree: 360,
    });
    expect(result.data.repository.getAll("weapon")[0]).toMatchObject({
      damage: 25,
      maxAmmunition: 12,
      fireIntervalTicks: 10,
      lifetimeTicks: 50,
    });
    expect(result.data.repository.getAll("game_rule")[0]).toMatchObject({
      tickLimit: 600,
      participantCount: 2,
    });
  });
});
