import type { Int32 } from "../data/common";
import type { RobotDesignId } from "../data/ids";
import type {
  EngineId,
  GameRuleId,
  MapId,
  RobotBodyId,
  SensorId,
  WeaponId,
} from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { Program } from "../program/models";
import type { RobotDesign, SlotId } from "../robotDesign/models";
import type { GameSessionCreationInput } from "../runtime/createGameSession";

export const PHASE1_BODY_ID =
  "robot_body_10000000-0000-4000-8000-000000000001" as RobotBodyId;
export const PHASE1_ENGINE_ID =
  "engine_10000000-0000-4000-8000-000000000002" as EngineId;
export const PHASE1_SENSOR_ID =
  "sensor_10000000-0000-4000-8000-000000000003" as SensorId;
export const PHASE1_WEAPON_ID =
  "weapon_10000000-0000-4000-8000-000000000004" as WeaponId;
export const PHASE1_MAP_ID =
  "map_10000000-0000-4000-8000-000000000006" as MapId;
export const PHASE1_GAME_RULE_ID =
  "game_rule_10000000-0000-4000-8000-000000000007" as GameRuleId;

export const PHASE1_RIGHT_WEAPON_SLOT_ID = "slot_1" as SlotId;
export const PHASE1_SENSOR_SLOT_ID = "slot_3" as SlotId;
export const PHASE1_ENGINE_SLOT_ID = "slot_4" as SlotId;

const createRobotDesign = (
  id: RobotDesignId,
  name: string,
  program: Program,
): RobotDesign => ({
  id,
  bodyDefinitionId: PHASE1_BODY_ID,
  programId: program.id,
  initialWeaponHand: "right",
  equipment: {
    [PHASE1_RIGHT_WEAPON_SLOT_ID]: PHASE1_WEAPON_ID,
    [PHASE1_SENSOR_SLOT_ID]: PHASE1_SENSOR_ID,
    [PHASE1_ENGINE_SLOT_ID]: PHASE1_ENGINE_ID,
  },
  ammunition: { [PHASE1_RIGHT_WEAPON_SLOT_ID]: 12 as Int32 },
  metadata: {
    name,
    author: "Tactical Circuit",
    description: "Phase 1固定対戦用Robot",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  },
});

/** Phase 1固定対戦のGame Session生成入力をProgramだけから構築する。 */
export const createFixedBattleInput = (
  playerProgram: Program,
  opponentProgram: Program,
  repository: DataRepository,
): GameSessionCreationInput => ({
  participants: [
    {
      robotDesign: createRobotDesign(
        "robo_10000000-0000-4000-8000-000000000020" as RobotDesignId,
        "PLAYER",
        playerProgram,
      ),
      program: playerProgram,
    },
    {
      robotDesign: createRobotDesign(
        "robo_10000000-0000-4000-8000-000000000021" as RobotDesignId,
        "OPPONENT",
        opponentProgram,
      ),
      program: opponentProgram,
    },
  ],
  mapId: PHASE1_MAP_ID,
  gameRuleId: PHASE1_GAME_RULE_ID,
  initialRandomSeed: 1 as Int32,
  repository,
});
