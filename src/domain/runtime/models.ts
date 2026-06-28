import type {
  FormatVersion,
  Int32,
  Position,
  Size,
  Vector,
} from "../data/common";
import type { NodeId, RobotDesignId, RuntimeRobotId } from "../data/ids";
import type {
  GameRuleId,
  MapId,
  ProjectileId,
  WeaponId,
} from "../masterData/models";
import type { Program } from "../program/models";
import type { RobotDesign, SlotId } from "../robotDesign/models";

/** `spec/simulator/00_overview.md`のWorld State内Bullet ID。 */
export type BulletId = string & { readonly __brand: "BulletId" };

/** `spec/instructions/concept.md`の移動系行動要求。 */
export type MovementRequest = {
  readonly type:
    | "forward"
    | "backward"
    | "turn_left"
    | "turn_right"
    | "strafe_left"
    | "strafe_right"
    | "stop";
};

/** `spec/instructions/concept.md`のWeapon切替要求。 */
export type SwitchRequest = {
  readonly type: "switch_weapon";
  readonly slotId: SlotId;
};

/** `spec/instructions/concept.md`の攻撃系行動要求。 */
export type AttackRequest = {
  readonly type: "fire" | "melee";
};

/** `spec/instructions/concept.md`のカテゴリ別行動要求。 */
export type ActionRequests = {
  readonly movement: MovementRequest | null;
  readonly switching: SwitchRequest | null;
  readonly attack: AttackRequest | null;
};

/** `spec/14_determinism_rules.md`のxorshift32内部状態。 */
export type RandomState = {
  readonly value: Int32;
};

/** `spec/13_data_ownership.md`のTickをまたぐAI実行状態。 */
export type AIRuntimeState = {
  readonly nextNodeId: NodeId | null;
  readonly registers: Readonly<Record<string, Int32>>;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly callStack: readonly NodeId[];
  readonly memory: { readonly values: readonly Int32[] };
};

/** `spec/simulator/00_overview.md`の実行時Robot状態。 */
export type RobotState = {
  readonly id: RuntimeRobotId;
  readonly robotDesignId: RobotDesignId;
  readonly position: Position;
  readonly direction: Int32;
  readonly velocity: Vector;
  readonly currentHp: Int32;
  readonly energy: Int32;
  readonly heat: Int32;
  readonly status: "active" | "destroyed";
  readonly partDamage: Readonly<Record<SlotId, Int32>>;
  readonly selectedWeaponSlotId: SlotId | null;
  readonly ammunition: Readonly<Record<SlotId, Int32>>;
  readonly aiRuntimeState: AIRuntimeState;
  readonly actionRequests: ActionRequests;
};

/** `spec/simulator/00_overview.md`の飛翔中Bullet状態。 */
export type BulletState = {
  readonly id: BulletId;
  readonly ownerRobotId: RuntimeRobotId;
  readonly weaponId: WeaponId;
  readonly projectileId: ProjectileId;
  readonly position: Position;
  readonly vector: Vector;
  readonly remainingLifetimeTicks: Int32;
};

/** `spec/13_data_ownership.md`のWorld State内障害物状態。 */
export type ObstacleState = {
  readonly id: string;
  readonly position: Position;
  readonly size: Size;
};

/** `spec/simulator/00_overview.md`の戦闘終了理由。 */
export type BattleEndReason =
  "opponent_destroyed" | "mutual_destruction" | "tick_limit";

/** `spec/13_data_ownership.md`の勝敗結果。 */
export type BattleResult = {
  readonly winnerRobotIds: readonly RuntimeRobotId[];
  readonly reason: BattleEndReason;
};

/** `spec/13_data_ownership.md`のゲーム進行状態。 */
export type GameStatus = "ready" | "running" | "finished";

/** `spec/13_data_ownership.md`のゲーム世界における唯一の状態。 */
export type WorldState = {
  readonly tick: Int32;
  readonly robots: readonly RobotState[];
  readonly bullets: readonly BulletState[];
  readonly obstacles: readonly ObstacleState[];
  readonly status: GameStatus;
  readonly result: BattleResult | null;
  readonly randomState: RandomState;
  readonly nextBulletSequence: Int32;
};

/** `spec/instructions/concept.md`の検出Robot情報。 */
export type DetectedRobot = {
  readonly id: RuntimeRobotId;
  readonly relativePosition: Position;
  readonly distance: Int32;
  readonly bearing: Int32;
  readonly status: RobotState["status"];
};

/** `spec/instructions/concept.md`の検出Bullet情報。 */
export type DetectedBullet = {
  readonly id: BulletId;
  readonly ownerRobotId: RuntimeRobotId;
  readonly relativePosition: Position;
  readonly vector: Vector;
  readonly distance: Int32;
  readonly bearing: Int32;
};

/** `spec/instructions/concept.md`のTick開始時センサースナップショット。 */
export type SensorSnapshot = {
  readonly robots: readonly DetectedRobot[];
  readonly bullets: readonly DetectedBullet[];
};

/** `spec/13_data_ownership.md`のAI Engine向け読取専用入力。 */
export type ExecutionInput = {
  readonly tick: Int32;
  readonly robot: RobotState;
  readonly aiRuntimeState: AIRuntimeState;
  readonly sensors: SensorSnapshot;
  readonly randomState: RandomState;
};

/** `spec/instructions/instruction_model.md`のAIメモリ更新要求。 */
export type MemoryWrite = {
  readonly index: Int32;
  readonly value: Int32;
};

/** `spec/instructions/instruction_model.md`のコールスタック更新要求。 */
export type StackOperation =
  { readonly type: "push"; readonly nodeId: NodeId } | { readonly type: "pop" };

/** `spec/instructions/instruction_model.md`の命令単位のContext変更要求。 */
export type ExecutionContextChanges = {
  readonly registerWrites: Readonly<Record<string, Int32>>;
  readonly flagWrites: Readonly<Record<string, boolean>>;
  readonly memoryWrites: readonly MemoryWrite[];
  readonly stackOperations: readonly StackOperation[];
  readonly movementRequest?: MovementRequest;
  readonly switchRequest?: SwitchRequest;
  readonly attackRequest?: AttackRequest;
  readonly randomState: RandomState | null;
};

/** `spec/instructions/concept.md`の1Tick限りのAI実行環境。 */
export type ExecutionContext = {
  readonly program: Program;
  readonly input: ExecutionInput;
  readonly aiRuntimeState: AIRuntimeState;
  readonly cpuUsed: Int32;
  readonly cpuRemaining: Int32;
  readonly temporaryVariables: Readonly<
    Record<string, Int32 | boolean | string>
  >;
  readonly actionRequests: ActionRequests;
  readonly randomState: RandomState;
};

/** `spec/13_data_ownership.md`のAI Engine実行結果。 */
export type ExecutionResult = {
  readonly actionRequests: ActionRequests;
  readonly aiRuntimeState: AIRuntimeState;
  readonly randomState: RandomState;
};

/** `spec/13_data_ownership.md`のGame Session参加者。 */
export type GameSessionParticipant = {
  readonly robotId: RuntimeRobotId;
  readonly robotDesign: RobotDesign;
  readonly program: Program;
};

/** `spec/13_data_ownership.md`の1回の通常シミュレーション。 */
export type GameSession = {
  readonly participants: readonly GameSessionParticipant[];
  readonly initialRandomSeed: Int32;
  readonly mapId: MapId;
  readonly gameRuleId: GameRuleId;
  readonly masterDataVersion: FormatVersion;
  readonly worldState: WorldState;
};
