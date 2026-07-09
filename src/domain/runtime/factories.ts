import type { Int32 } from "../data/common";
import type { NodeId, RuntimeRobotId } from "../data/ids";
import type { GameRuleDefinition } from "../masterData/models";
import type {
  AIRuntimeState,
  ActionRequests,
  BulletId,
  CombatRequest,
  ExecutionRobotSnapshot,
  MovementRequest,
  RobotActionState,
  RobotState,
} from "./models";

/** `docs/specs/current/instructions/concept.md`に従い空のカテゴリ別行動要求を生成する。 */
export const createEmptyActionRequests = (): ActionRequests => ({
  movement: null,
  combat: null,
});

/** `docs/specs/current/13_data_ownership.md`に従い空のRobot行動状態を生成する。 */
export const createEmptyRobotActionState = (): RobotActionState => ({
  movement: { current: null, next: null },
  combat: { current: null, next: null },
});

export const cloneMovementRequest = (
  request: MovementRequest | null,
): MovementRequest | null => (request === null ? null : { ...request });

export const cloneCombatRequest = (
  request: CombatRequest | null,
): CombatRequest | null =>
  request?.type === "fire"
    ? { ...request, targetPosition: { ...request.targetPosition } }
    : request === null
      ? null
      : { ...request };

/** Simulator所有の行動詳細を除外し、可変参照を共有しないAI Engine向けSnapshotを生成する。 */
export const createExecutionRobotSnapshot = (
  robot: RobotState,
): ExecutionRobotSnapshot => ({
  id: robot.id,
  robotDesignId: robot.robotDesignId,
  position: { ...robot.position },
  direction: robot.direction,
  velocity: { ...robot.velocity },
  currentHp: robot.currentHp,
  energy: robot.energy,
  heat: robot.heat,
  status: robot.status,
  partDamage: { ...robot.partDamage },
  selectedWeaponSlotId: robot.selectedWeaponSlotId,
  ammunition: { ...robot.ammunition },
  aiRuntimeState: {
    ...robot.aiRuntimeState,
    registers: { ...robot.aiRuntimeState.registers },
    flags: { ...robot.aiRuntimeState.flags },
    callStack: [...robot.aiRuntimeState.callStack],
    memory: { values: [...robot.aiRuntimeState.memory.values] },
  },
  actionRequests: {
    movement: cloneMovementRequest(robot.actionRequests.movement),
    combat: cloneCombatRequest(robot.actionRequests.combat),
  },
});

/** `docs/specs/current/ai/00_overview.md`に従い戦闘開始時のAI Runtime Stateを生成する。 */
export const createInitialAIRuntimeState = (
  gameRule: GameRuleDefinition,
  startNodeId: NodeId,
): AIRuntimeState => ({
  nextNodeId: startNodeId,
  registers: Object.fromEntries(
    gameRule.registerNames.map((name) => [name, 0 as Int32]),
  ),
  flags: Object.fromEntries(gameRule.flagNames.map((name) => [name, false])),
  callStack: [],
  memory: {
    values: Array.from({ length: gameRule.memorySize }, () => 0 as Int32),
  },
});

/** `docs/specs/current/12_common_data_conventions.md`に従いGame Session内Robot IDを発番する。 */
export const createRuntimeRobotId = (sequence: Int32): RuntimeRobotId =>
  `robot_${sequence}` as RuntimeRobotId;

/** `docs/specs/current/13_data_ownership.md`に従いWorld State内Bullet IDを発番する。 */
export const createBulletId = (sequence: Int32): BulletId =>
  `bullet_${sequence}` as BulletId;
