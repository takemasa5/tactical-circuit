import type { Int32, Size } from "../data/common";
import type { DataValidationError, LoadResult } from "../data/loadResult";
import { isMasterDataId } from "./id";
import type {
  MasterDataByType,
  MasterDataDefinition,
  MasterDataId,
  MasterDataType,
  WeaponDefinition,
} from "./models";

/** `spec/15_master_data.md`のフォルダ種別とDefinitionの組。 */
export type MasterDataEntry = {
  [TType in MasterDataType]: {
    readonly dataType: TType;
    readonly definition: MasterDataByType[TType];
  };
}[MasterDataType];

/** `spec/15_master_data.md`の種別別読取専用格納領域。 */
type RepositoryMaps = {
  [TType in MasterDataType]: ReadonlyMap<string, MasterDataByType[TType]>;
};

const error = (
  code: string,
  path: string,
  message: string,
  actualValue: unknown,
  expected: string,
): DataValidationError => ({ code, path, message, actualValue, expected });

const validateNonNegative = (
  value: Int32,
  path: string,
  errors: DataValidationError[],
): void => {
  if (value < 0) {
    errors.push(error("negative_value", path, "0未満です", value, "0以上"));
  }
};

const validatePositive = (
  value: Int32,
  path: string,
  errors: DataValidationError[],
): void => {
  if (value < 1) {
    errors.push(error("non_positive_value", path, "1未満です", value, "1以上"));
  }
};

const validateSize = (
  size: Size,
  path: string,
  errors: DataValidationError[],
): void => {
  validatePositive(size.width, `${path}/width`, errors);
  validatePositive(size.height, `${path}/height`, errors);
};

const validateUniqueStrings = (
  values: readonly string[],
  path: string,
  errors: DataValidationError[],
): void => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      errors.push(
        error(
          "duplicate_local_id",
          `${path}/${index}`,
          "同じ値が重複しています",
          value,
          "配列内で一意な値",
        ),
      );
    }
    seen.add(value);
  });
};

const numericFields = (
  definition: MasterDataDefinition,
): readonly [string, Int32][] => {
  if ("weight" in definition) {
    const fields: [string, Int32][] = [["weight", definition.weight]];
    return fields;
  }
  return [];
};

const validateDefinition = (
  entry: MasterDataEntry,
  index: number,
  implementationIds: ReadonlySet<string>,
  errors: DataValidationError[],
): void => {
  const basePath = `/definitions/${index}`;

  if (!isMasterDataId(entry.definition.id, entry.dataType)) {
    errors.push(
      error(
        "invalid_master_data_id",
        `${basePath}/id`,
        "Master Data IDの形式がデータ種別と一致しません",
        entry.definition.id,
        `${entry.dataType}_{uuid}`,
      ),
    );
  }

  if (
    entry.definition.implementationId !== undefined &&
    !implementationIds.has(entry.definition.implementationId)
  ) {
    errors.push(
      error(
        "unknown_implementation_id",
        `${basePath}/implementationId`,
        "対応する実装がありません",
        entry.definition.implementationId,
        "登録済みimplementationId",
      ),
    );
  }

  if (
    (entry.dataType === "instruction" || entry.dataType === "option") &&
    entry.definition.implementationId === undefined
  ) {
    errors.push(
      error(
        "missing_implementation_id",
        `${basePath}/implementationId`,
        "implementationIdが必要です",
        undefined,
        "登録済みimplementationId",
      ),
    );
  }

  for (const [field, value] of numericFields(entry.definition)) {
    validateNonNegative(value, `${basePath}/${field}`, errors);
  }

  switch (entry.dataType) {
    case "instruction":
      {
        const { definition } = entry;
        validateNonNegative(definition.cpuCost, `${basePath}/cpuCost`, errors);
        validateUniqueStrings(
          definition.parameters.map(({ id }) => id),
          `${basePath}/parameters`,
          errors,
        );
        validateUniqueStrings(
          definition.outputPaths.map(({ id }) => id),
          `${basePath}/outputPaths`,
          errors,
        );
      }
      break;
    case "robot_body":
      {
        const { definition } = entry;
        validateNonNegative(definition.maxHp, `${basePath}/maxHp`, errors);
        validateNonNegative(
          definition.maxEnergy,
          `${basePath}/maxEnergy`,
          errors,
        );
        validateNonNegative(
          definition.heatCapacity,
          `${basePath}/heatCapacity`,
          errors,
        );
        validateSize(definition.size, `${basePath}/size`, errors);
        validateUniqueStrings(
          definition.slots.map(({ id }) => id),
          `${basePath}/slots`,
          errors,
        );
      }
      break;
    case "weapon":
      validateWeapon(entry.definition, basePath, errors);
      break;
    case "sensor":
      {
        const { definition } = entry;
        validateNonNegative(
          definition.detectionDistance,
          `${basePath}/detectionDistance`,
          errors,
        );
        validateNonNegative(
          definition.fieldOfViewDegree,
          `${basePath}/fieldOfViewDegree`,
          errors,
        );
        if (
          definition.fieldOfViewDegree < 1 ||
          definition.fieldOfViewDegree > 360
        ) {
          errors.push(
            error(
              "invalid_field_of_view",
              `${basePath}/fieldOfViewDegree`,
              "視野角が範囲外です",
              definition.fieldOfViewDegree,
              "1以上360以下",
            ),
          );
        }
        validateNonNegative(
          definition.energyConsumption,
          `${basePath}/energyConsumption`,
          errors,
        );
      }
      break;
    case "engine":
      validateEngine(entry.definition, basePath, errors);
      break;
    case "armor":
      validateArmor(entry.definition, basePath, errors);
      break;
    case "option":
      break;
    case "projectile":
      {
        const { definition } = entry;
        validateNonNegative(definition.speed, `${basePath}/speed`, errors);
        validateSize(definition.size, `${basePath}/size`, errors);
        validateNonNegative(
          definition.explosionRadius,
          `${basePath}/explosionRadius`,
          errors,
        );
        validateNonNegative(
          definition.explosionDamage,
          `${basePath}/explosionDamage`,
          errors,
        );
      }
      break;
    case "map":
      {
        const { definition } = entry;
        validateSize(definition.size, `${basePath}/size`, errors);
        validateUniqueStrings(
          definition.obstacles.map(({ id }) => id),
          `${basePath}/obstacles`,
          errors,
        );
        definition.obstacles.forEach((obstacle, obstacleIndex) => {
          validateSize(
            obstacle.size,
            `${basePath}/obstacles/${obstacleIndex}/size`,
            errors,
          );
        });
      }
      break;
    case "game_rule":
      validateGameRule(entry.definition, basePath, errors);
      break;
  }
};

const validateWeapon = (
  definition: WeaponDefinition,
  path: string,
  errors: DataValidationError[],
): void => {
  const fields: readonly (keyof WeaponDefinition)[] = [
    "damage",
    "maxAmmunition",
    "lifetimeTicks",
    "fireIntervalTicks",
    "reloadTicks",
    "heatGeneration",
    "energyConsumption",
    "aimSpreadDegree",
    "ammunitionWeight",
  ];
  fields.forEach((field) => {
    const value = definition[field];
    if (typeof value === "number") {
      validateNonNegative(value, `${path}/${field}`, errors);
    }
  });
  if (definition.aimSpreadDegree >= 360) {
    errors.push(
      error(
        "invalid_angle",
        `${path}/aimSpreadDegree`,
        "角度が正規化範囲外です",
        definition.aimSpreadDegree,
        "0以上360未満",
      ),
    );
  }
};

const validateEngine = (
  definition: MasterDataByType["engine"],
  path: string,
  errors: DataValidationError[],
): void => {
  const values = [
    definition.maxForwardSpeed,
    definition.maxBackwardSpeed,
    definition.maxStrafeSpeed,
    definition.acceleration,
    definition.turnSpeedDegree,
    definition.energyConsumption,
  ];
  values.forEach((value, index) =>
    validateNonNegative(value, `${path}/performance/${index}`, errors),
  );
};

const validateArmor = (
  definition: MasterDataByType["armor"],
  path: string,
  errors: DataValidationError[],
): void => {
  validateNonNegative(definition.durability, `${path}/durability`, errors);
  validateNonNegative(definition.defense, `${path}/defense`, errors);
  validateNonNegative(
    definition.heatDissipation,
    `${path}/heatDissipation`,
    errors,
  );
};

const validateGameRule = (
  definition: MasterDataByType["game_rule"],
  path: string,
  errors: DataValidationError[],
): void => {
  validatePositive(definition.cpuLimit, `${path}/cpuLimit`, errors);
  validatePositive(definition.tickLimit, `${path}/tickLimit`, errors);
  validatePositive(
    definition.participantCount,
    `${path}/participantCount`,
    errors,
  );
  validatePositive(definition.memorySize, `${path}/memorySize`, errors);
  validatePositive(definition.callStackSize, `${path}/callStackSize`, errors);
  validateUniqueStrings(
    definition.registerNames,
    `${path}/registerNames`,
    errors,
  );
  validateUniqueStrings(definition.flagNames, `${path}/flagNames`, errors);
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

/** `spec/15_master_data.md`の検証済み・読取専用Data Repository。 */
export class DataRepository {
  readonly #maps: RepositoryMaps;

  constructor(maps: RepositoryMaps) {
    this.#maps = maps;
  }

  get<TType extends MasterDataType>(
    dataType: TType,
    id: string,
  ): MasterDataByType[TType] | undefined {
    return this.#maps[dataType].get(id);
  }

  getAll<TType extends MasterDataType>(
    dataType: TType,
  ): readonly MasterDataByType[TType][] {
    return [...this.#maps[dataType].values()];
  }
}

export const createDataRepository = (
  entries: readonly MasterDataEntry[],
  implementationIds: ReadonlySet<string>,
): LoadResult<DataRepository> => {
  const errors: DataValidationError[] = [];
  const ids = new Set<MasterDataId>();

  entries.forEach((entry, index) => {
    if (ids.has(entry.definition.id)) {
      errors.push(
        error(
          "duplicate_master_data_id",
          `/definitions/${index}/id`,
          "Master Data IDが重複しています",
          entry.definition.id,
          "Data Repository全体で一意なID",
        ),
      );
    }
    ids.add(entry.definition.id);
    validateDefinition(entry, index, implementationIds, errors);
  });

  const projectileIds = new Set(
    entries
      .filter(({ dataType }) => dataType === "projectile")
      .map(({ definition }) => definition.id),
  );
  entries.forEach((entry, index) => {
    if (
      entry.dataType === "weapon" &&
      !projectileIds.has(entry.definition.projectileId)
    ) {
      errors.push(
        error(
          "missing_master_data_reference",
          `/definitions/${index}/projectileId`,
          "参照先のProjectile Definitionが存在しません",
          entry.definition.projectileId,
          "存在するProjectile Definition ID",
        ),
      );
    }
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const buildMap = <TType extends MasterDataType>(
    dataType: TType,
  ): ReadonlyMap<string, MasterDataByType[TType]> => {
    const definitions: readonly (readonly [string, MasterDataByType[TType]])[] =
      entries
        .filter((entry) => entry.dataType === dataType)
        .sort((left, right) =>
          left.definition.id.localeCompare(right.definition.id),
        )
        .map(({ definition }) => [
          definition.id,
          deepFreeze(definition) as MasterDataByType[TType],
        ]);
    return new Map(definitions);
  };

  const maps: RepositoryMaps = {
    instruction: buildMap("instruction"),
    robot_body: buildMap("robot_body"),
    weapon: buildMap("weapon"),
    sensor: buildMap("sensor"),
    engine: buildMap("engine"),
    armor: buildMap("armor"),
    option: buildMap("option"),
    projectile: buildMap("projectile"),
    map: buildMap("map"),
    game_rule: buildMap("game_rule"),
  };

  return { success: true, data: new DataRepository(maps) };
};
