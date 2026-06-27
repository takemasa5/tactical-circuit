import type { MasterDataType } from "./models";

const UUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const PREFIX_BY_TYPE: Readonly<Record<MasterDataType, string>> = {
  instruction: "instruction",
  robot_body: "robot_body",
  weapon: "weapon",
  sensor: "sensor",
  engine: "engine",
  armor: "armor",
  option: "option",
  projectile: "projectile",
  map: "map",
  game_rule: "game_rule",
};

const TYPES_BY_PREFIX_LENGTH = Object.entries(PREFIX_BY_TYPE).sort(
  ([, left], [, right]) => right.length - left.length,
) as readonly (readonly [MasterDataType, string])[];

export const isMasterDataId = (
  value: unknown,
  dataType: MasterDataType,
): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  return new RegExp(`^${PREFIX_BY_TYPE[dataType]}_${UUID_PATTERN}$`).test(
    value,
  );
};

export const getMasterDataTypeFromId = (
  value: string,
): MasterDataType | undefined =>
  TYPES_BY_PREFIX_LENGTH.find(([dataType]) =>
    isMasterDataId(value, dataType),
  )?.[0];
