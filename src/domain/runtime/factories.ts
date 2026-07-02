import type { Int32 } from "../data/common";
import type { NodeId, RuntimeRobotId } from "../data/ids";
import type { GameRuleDefinition } from "../masterData/models";
import type { AIRuntimeState, ActionRequests, BulletId } from "./models";

/** `spec/instructions/concept.md`に従い空のカテゴリ別行動要求を生成する。 */
export const createEmptyActionRequests = (): ActionRequests => ({
  movement: null,
  combat: null,
});

/** `spec/ai/00_overview.md`に従い戦闘開始時のAI Runtime Stateを生成する。 */
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

/** `spec/12_common_data_conventions.md`に従いGame Session内Robot IDを発番する。 */
export const createRuntimeRobotId = (sequence: Int32): RuntimeRobotId =>
  `robot_${sequence}` as RuntimeRobotId;

/** `spec/simulator/00_overview.md`に従いWorld State内Bullet IDを発番する。 */
export const createBulletId = (sequence: Int32): BulletId =>
  `bullet_${sequence}` as BulletId;
