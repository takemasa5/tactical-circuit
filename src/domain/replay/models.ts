import type { FormatVersion, Int32 } from "../data/common";
import type { ReplayId } from "../data/ids";
import type { GameRuleId, MapId } from "../masterData/models";
import type { Program } from "../program/models";
import type { RobotDesign } from "../robotDesign/models";
import type {
  BattleResult,
  BulletId,
  BulletState,
  GameStatus,
  RandomState,
  RobotState,
  WorldState,
} from "../runtime/models";

/** `spec/14_determinism_rules.md`のWorld State変更イベント。 */
export type ReplayEvent =
  | { readonly type: "robot_updated"; readonly robot: RobotState }
  | { readonly type: "bullet_created"; readonly bullet: BulletState }
  | { readonly type: "bullet_updated"; readonly bullet: BulletState }
  | { readonly type: "bullet_removed"; readonly bulletId: BulletId }
  | {
      readonly type: "game_state_updated";
      readonly status: GameStatus;
      readonly result: BattleResult | null;
    }
  | {
      readonly type: "random_state_updated";
      readonly randomState: RandomState;
    };

/** `spec/14_determinism_rules.md`の1Tick分Replay変更記録。 */
export type ReplayFrame = {
  readonly tick: Int32;
  readonly events: readonly ReplayEvent[];
};

/** `spec/13_data_ownership.md`のReplay System所有データ。 */
export type ReplayData = {
  readonly id: ReplayId;
  readonly initialWorldState: WorldState;
  readonly frames: readonly ReplayFrame[];
};

/** `spec/13_data_ownership.md`のJSON保存対象Replayデータ。 */
export type ReplaySaveData = {
  readonly replayData: ReplayData;
  readonly robotDesigns: readonly RobotDesign[];
  readonly programs: readonly Program[];
  readonly mapId: MapId;
  readonly gameRuleId: GameRuleId;
  readonly initialRandomSeed: Int32;
  readonly masterDataVersion: FormatVersion;
};
