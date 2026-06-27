import { loadJsonEnvelope, saveJsonEnvelope } from "../data/jsonEnvelope";
import type { DataValidationError, LoadResult } from "../data/loadResult";
import { getMasterDataTypeFromId } from "../masterData/id";
import type { DataRepository } from "../masterData/repository";
import type { RobotDesign, SlotId } from "./models";
import { robotDesignValidator } from "./schema";

const compareIds = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const sortRecord = <T>(
  values: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> =>
  Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => compareIds(left, right)),
  );

const validationError = (
  code: string,
  path: string,
  message: string,
  actualValue: unknown,
  expected: string,
): DataValidationError => ({ code, path, message, actualValue, expected });

const validateEquipment = (
  design: RobotDesign,
  repository: DataRepository,
): DataValidationError[] => {
  const body = repository.get("robot_body", design.bodyDefinitionId);
  if (body === undefined) {
    return [
      validationError(
        "missing_robot_body",
        "/bodyDefinitionId",
        "Robot Body Definitionが存在しません",
        design.bodyDefinitionId,
        "存在するRobot Body Definition ID",
      ),
    ];
  }

  const errors: DataValidationError[] = [];
  const slots = new Map(body.slots.map((slot) => [slot.id, slot]));
  for (const [slotId, partId] of Object.entries(design.equipment)) {
    const slot = slots.get(slotId);
    if (slot === undefined) {
      errors.push(
        validationError(
          "unknown_slot",
          `/equipment/${slotId}`,
          "Robot Bodyに存在しないスロットです",
          slotId,
          "Robot Bodyに定義されたスロットID",
        ),
      );
      continue;
    }

    const partType = getMasterDataTypeFromId(partId);
    if (partType !== slot.category) {
      errors.push(
        validationError(
          "part_category_mismatch",
          `/equipment/${slotId}`,
          "スロットとPartのカテゴリが一致しません",
          partId,
          slot.category,
        ),
      );
      continue;
    }
    if (repository.get(partType, partId) === undefined) {
      errors.push(
        validationError(
          "missing_part",
          `/equipment/${slotId}`,
          "Part Definitionが存在しません",
          partId,
          `存在する${partType} Definition ID`,
        ),
      );
    }
  }
  return errors;
};

const validateAmmunition = (
  design: RobotDesign,
  repository: DataRepository,
): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  const weaponSlots = Object.entries(design.equipment).filter(
    ([, partId]) => getMasterDataTypeFromId(partId) === "weapon",
  );

  for (const [slotId, partId] of weaponSlots) {
    const ammunition = design.ammunition[slotId as SlotId];
    if (ammunition === undefined) {
      errors.push(
        validationError(
          "missing_ammunition",
          `/ammunition/${slotId}`,
          "Weaponスロットの初期装弾数がありません",
          undefined,
          "0以上の初期装弾数",
        ),
      );
      continue;
    }
    const weapon = repository.get("weapon", partId);
    if (weapon !== undefined && ammunition > weapon.maxAmmunition) {
      errors.push(
        validationError(
          "ammunition_over_capacity",
          `/ammunition/${slotId}`,
          "初期装弾数が装弾上限数を超えています",
          ammunition,
          `${weapon.maxAmmunition}以下`,
        ),
      );
    }
  }

  for (const slotId of Object.keys(design.ammunition)) {
    if (!weaponSlots.some(([weaponSlotId]) => weaponSlotId === slotId)) {
      errors.push(
        validationError(
          "ammunition_for_non_weapon",
          `/ammunition/${slotId}`,
          "Weapon以外のスロットに装弾数が指定されています",
          design.ammunition[slotId as SlotId],
          "Weaponを装備したスロットID",
        ),
      );
    }
  }
  return errors;
};

/** `spec/13_data_ownership.md`の装備・装弾数参照を検証する。 */
export const validateRobotDesignReferences = (
  design: RobotDesign,
  repository: DataRepository,
): DataValidationError[] => [
  ...validateEquipment(design, repository),
  ...validateAmmunition(design, repository),
];

/** `spec/13_data_ownership.md`の順序不問データを安定した保存順へ整える。 */
export const canonicalizeRobotDesign = (design: RobotDesign): RobotDesign => ({
  ...design,
  equipment: sortRecord(design.equipment),
  ammunition: sortRecord(design.ammunition),
});

/** `spec/13_data_ownership.md`に従いRobotDesignをJSONへ保存する。 */
export const saveRobotDesign = (design: RobotDesign): string =>
  saveJsonEnvelope("robot_design", canonicalizeRobotDesign(design));

/** `spec/13_data_ownership.md`に従いRobotDesign JSONと装備を検証する。 */
export const loadRobotDesign = (
  value: string,
  repository: DataRepository,
): LoadResult<RobotDesign> => {
  const loaded = loadJsonEnvelope(value, "robot_design", robotDesignValidator);
  if (!loaded.success) return loaded;

  const design = loaded.data.payload;
  const errors = validateRobotDesignReferences(design, repository);
  if (errors.length > 0) return { success: false, errors };
  return { success: true, data: design };
};
