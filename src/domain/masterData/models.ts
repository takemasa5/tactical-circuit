import type { Int32, Position, Size } from "../data/common";

/** `docs/specs/current/15_master_data.md`の初期Master Data種別。 */
export type MasterDataType =
  | "instruction"
  | "robot_body"
  | "weapon"
  | "sensor"
  | "engine"
  | "armor"
  | "option"
  | "projectile"
  | "map"
  | "game_rule";

/** `docs/specs/current/15_master_data.md`の種別付きグローバルIDを区別する内部型。 */
type BrandedId<TName extends string> = string & { readonly __brand: TName };

/** `docs/specs/current/15_master_data.md`のInstruction Definition ID。 */
export type InstructionId = BrandedId<"InstructionId">;
/** `docs/specs/current/15_master_data.md`のRobot Body Definition ID。 */
export type RobotBodyId = BrandedId<"RobotBodyId">;
/** `docs/specs/current/15_master_data.md`のWeapon Definition ID。 */
export type WeaponId = BrandedId<"WeaponId">;
/** `docs/specs/current/15_master_data.md`のSensor Definition ID。 */
export type SensorId = BrandedId<"SensorId">;
/** `docs/specs/current/15_master_data.md`のEngine Definition ID。 */
export type EngineId = BrandedId<"EngineId">;
/** `docs/specs/current/15_master_data.md`のArmor Definition ID。 */
export type ArmorId = BrandedId<"ArmorId">;
/** `docs/specs/current/15_master_data.md`のOption Definition ID。 */
export type OptionId = BrandedId<"OptionId">;
/** `docs/specs/current/15_master_data.md`のProjectile Definition ID。 */
export type ProjectileId = BrandedId<"ProjectileId">;
/** `docs/specs/current/15_master_data.md`のMap Definition ID。 */
export type MapId = BrandedId<"MapId">;
/** `docs/specs/current/15_master_data.md`のGame Rule Definition ID。 */
export type GameRuleId = BrandedId<"GameRuleId">;

/** `docs/specs/current/15_master_data.md`で参照可能なMaster Data IDの総称。 */
export type MasterDataId =
  | InstructionId
  | RobotBodyId
  | WeaponId
  | SensorId
  | EngineId
  | ArmorId
  | OptionId
  | ProjectileId
  | MapId
  | GameRuleId;

/** `docs/specs/current/15_master_data.md`の全Definition共通フィールド。 */
export type MasterDataBase<TId extends MasterDataId> = {
  readonly id: TId;
  readonly displayName: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly implementationId?: string;
};

/** `docs/specs/current/instructions/instruction_model.md`の命令カテゴリ。 */
export type InstructionCategory =
  | "control"
  | "branch"
  | "sensor"
  | "arithmetic"
  | "memory"
  | "action"
  | "special";

/** `docs/specs/current/instructions/instruction_model.md`のParameter Value種別。 */
export type ParameterValueType =
  | "distance"
  | "degree"
  | "tick"
  | "cpu_cost"
  | "count"
  | "speed"
  | "damage"
  | "heat"
  | "ammunition"
  | "boolean"
  | "enum"
  | "register_reference"
  | "flag_reference"
  | "memory_reference"
  | "node_reference"
  | "master_data_reference";

/** `docs/specs/current/instructions/instruction_model.md`のParameter Definition。 */
export type ParameterDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly valueType: ParameterValueType;
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly minValue?: Int32;
  readonly maxValue?: Int32;
  readonly referenceDataType?: MasterDataType;
  readonly enumValues?: readonly string[];
  readonly editorInfo?: Readonly<Record<string, unknown>>;
};

/** `docs/specs/current/instructions/instruction_model.md`のOutput Path Definition。 */
export type OutputPathDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly required: boolean;
  readonly displayOrder: Int32;
};

/** `docs/specs/current/instructions/instruction_model.md`のInstruction Definition。 */
export type InstructionDefinition = MasterDataBase<InstructionId> & {
  readonly implementationId: string;
  readonly category: InstructionCategory;
  readonly parameters: readonly ParameterDefinition[];
  readonly outputPaths: readonly OutputPathDefinition[];
  readonly cpuCost: Int32;
  readonly editorInfo?: Readonly<Record<string, unknown>>;
};

/** `docs/specs/current/15_master_data.md`の装備スロットカテゴリ。 */
export type PartCategory = "weapon" | "sensor" | "engine" | "armor" | "option";

/** `docs/specs/current/15_master_data.md`のRobot Body装備スロット。 */
export type SlotDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly category: PartCategory;
  readonly weaponMount?: "right_hand" | "left_hand";
};

/** `docs/specs/current/15_master_data.md`のRobot Body Definition。 */
export type RobotBodyDefinition = MasterDataBase<RobotBodyId> & {
  readonly weight: Int32;
  readonly maxHp: Int32;
  readonly maxEnergy: Int32;
  readonly heatCapacity: Int32;
  readonly size: Size;
  readonly slots: readonly SlotDefinition[];
};

/** `docs/specs/current/15_master_data.md`のWeapon Definition。 */
export type WeaponDefinition = MasterDataBase<WeaponId> & {
  readonly projectileId: ProjectileId;
  readonly damage: Int32;
  readonly maxAmmunition: Int32;
  readonly lifetimeTicks: Int32;
  readonly fireIntervalTicks: Int32;
  readonly reloadTicks: Int32;
  readonly heatGeneration: Int32;
  readonly energyConsumption: Int32;
  readonly aimSpreadDegree: Int32;
  readonly weight: Int32;
  readonly ammunitionWeight: Int32;
};

/** `docs/specs/current/15_master_data.md`のSensor Definition。 */
export type SensorDefinition = MasterDataBase<SensorId> & {
  readonly detectionDistance: Int32;
  readonly fieldOfViewDegree: Int32;
  readonly energyConsumption: Int32;
  readonly weight: Int32;
};

/** `docs/specs/current/15_master_data.md`のEngine Definition。 */
export type EngineDefinition = MasterDataBase<EngineId> & {
  readonly maxForwardSpeed: Int32;
  readonly maxBackwardSpeed: Int32;
  readonly maxStrafeSpeed: Int32;
  readonly acceleration: Int32;
  readonly turnSpeedDegree: Int32;
  readonly energyConsumption: Int32;
  readonly weight: Int32;
};

/** `docs/specs/current/15_master_data.md`のArmor Definition。 */
export type ArmorDefinition = MasterDataBase<ArmorId> & {
  readonly durability: Int32;
  readonly defense: Int32;
  readonly weight: Int32;
  readonly heatDissipation: Int32;
};

/** `docs/specs/current/15_master_data.md`のOption Definition。 */
export type OptionDefinition = MasterDataBase<OptionId> & {
  readonly implementationId: string;
};

/** `docs/specs/current/15_master_data.md`のProjectile Definition。 */
export type ProjectileDefinition = MasterDataBase<ProjectileId> & {
  readonly speed: Int32;
  readonly size: Size;
  readonly explosionRadius: Int32;
  readonly explosionDamage: Int32;
};

/** `docs/specs/current/15_master_data.md`のMap内Obstacle Definition。 */
export type ObstacleDefinition = {
  readonly id: string;
  readonly position: Position;
  readonly size: Size;
};

/** `docs/specs/current/15_master_data.md`のMap内Spawn Point Definition。 */
export type SpawnPointDefinition = {
  readonly position: Position;
  readonly direction: Int32;
};

/** `docs/specs/current/15_master_data.md`のMap Definition。 */
export type MapDefinition = MasterDataBase<MapId> & {
  readonly size: Size;
  readonly obstacles: readonly ObstacleDefinition[];
  readonly spawnPoints: readonly SpawnPointDefinition[];
};

/** `docs/specs/current/15_master_data.md`のGame Rule Definition。 */
export type GameRuleDefinition = MasterDataBase<GameRuleId> & {
  readonly cpuLimit: Int32;
  readonly tickLimit: Int32;
  readonly participantCount: Int32;
  readonly registerNames: readonly string[];
  readonly flagNames: readonly string[];
  readonly memorySize: Int32;
  readonly callStackSize: Int32;
};

/** `docs/specs/current/15_master_data.md`に定義された全Definitionの共用体。 */
export type MasterDataDefinition =
  | InstructionDefinition
  | RobotBodyDefinition
  | WeaponDefinition
  | SensorDefinition
  | EngineDefinition
  | ArmorDefinition
  | OptionDefinition
  | ProjectileDefinition
  | MapDefinition
  | GameRuleDefinition;

/** `docs/specs/current/15_master_data.md`の種別と対応Definition型の対応表。 */
export type MasterDataByType = {
  instruction: InstructionDefinition;
  robot_body: RobotBodyDefinition;
  weapon: WeaponDefinition;
  sensor: SensorDefinition;
  engine: EngineDefinition;
  armor: ArmorDefinition;
  option: OptionDefinition;
  projectile: ProjectileDefinition;
  map: MapDefinition;
  game_rule: GameRuleDefinition;
};
