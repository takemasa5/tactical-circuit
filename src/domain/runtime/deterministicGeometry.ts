import {
  INT32_MAX,
  INT32_MIN,
  normalizeAngle,
  type Int32,
  type Position,
  type Vector,
} from "../data/common";
import type { SimulatorResult } from "./simulatorResult";

export const DIRECTION_SCALE = 1000 as Int32;

// 実行環境の三角関数差をゲーム結果へ持ち込まないため、生成済みの第1象限だけを保持する。
const SINE_FIRST_QUADRANT = [
  0, 17, 35, 52, 70, 87, 105, 122, 139, 156, 174, 191, 208, 225, 242, 259, 276,
  292, 309, 326, 342, 358, 375, 391, 407, 423, 438, 454, 469, 485, 500, 515,
  530, 545, 559, 574, 588, 602, 616, 629, 643, 656, 669, 682, 695, 707, 719,
  731, 743, 755, 766, 777, 788, 799, 809, 819, 829, 839, 848, 857, 866, 875,
  883, 891, 899, 906, 914, 921, 927, 934, 940, 946, 951, 956, 961, 966, 970,
  974, 978, 982, 985, 988, 990, 993, 995, 996, 998, 999, 999, 1000, 1000,
] as const;

const inconsistentGeometry = <T>(message: string): SimulatorResult<T> => ({
  success: false,
  code: "inconsistent_session",
  message,
});

const asInt32 = (value: number): SimulatorResult<Int32> =>
  Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX
    ? { success: true, data: value as Int32 }
    : inconsistentGeometry("座標計算が符号付き32bit整数の範囲を超えました");

const sineComponent = (normalizedDegree: number): number => {
  if (normalizedDegree <= 90) return SINE_FIRST_QUADRANT[normalizedDegree]!;
  if (normalizedDegree <= 180)
    return SINE_FIRST_QUADRANT[180 - normalizedDegree]!;
  if (normalizedDegree <= 270)
    return -SINE_FIRST_QUADRANT[normalizedDegree - 180]!;
  return -SINE_FIRST_QUADRANT[360 - normalizedDegree]!;
};

/** Phase 1の0度=+Y、時計回りの固定小数点方向ベクトル。 */
export const directionUnitVector = (degree: Int32): Vector => {
  const normalized = normalizeAngle(degree);
  return {
    x: sineComponent(normalized) as Int32,
    y: sineComponent((90 - normalized + 360) % 360) as Int32,
  };
};

export const roundDivision = (
  numerator: number,
  denominator: number,
): SimulatorResult<Int32> => {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator === 0
  ) {
    return inconsistentGeometry("整数除算へ安全でない値が渡されました");
  }
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator % denominator;
  const rounded =
    Math.abs(remainder) * 2 >= Math.abs(denominator)
      ? quotient + Math.sign(numerator) * Math.sign(denominator)
      : quotient;
  return asInt32(rounded);
};

/** 固定方向へ指定距離だけ進む1 Tick分の整数Vectorを生成する。 */
export const scaleDirectionVector = (
  degree: Int32,
  distance: Int32,
): SimulatorResult<Vector> => {
  const unit = directionUnitVector(degree);
  const x = roundDivision(unit.x * distance, DIRECTION_SCALE);
  if (!x.success) return x;
  const y = roundDivision(unit.y * distance, DIRECTION_SCALE);
  if (!y.success) return y;
  return { success: true, data: { x: x.data, y: y.data } };
};

/** 2点間距離を浮動小数点演算なしで最も近い整数へ丸める。 */
export const roundedDistance = (
  from: Position,
  to: Position,
): SimulatorResult<Int32> => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const squared = dx * dx + dy * dy;
  const checked = asInt32(squared);
  if (!checked.success) return checked;

  let low = 0;
  let high = Math.min(46_340, checked.data);
  while (low <= high) {
    const middle = Math.trunc((low + high) / 2);
    const square = middle * middle;
    if (square <= checked.data) low = middle + 1;
    else high = middle - 1;
  }
  const floor = high;
  const remainder = checked.data - floor * floor;
  return asInt32(remainder >= floor + 1 ? floor + 1 : floor);
};

/** 対象へのWorld方位を固定方向表との外積と内積で決定する。 */
export const worldBearing = (
  from: Position,
  to: Position,
): SimulatorResult<Int32> => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const checkedDx = asInt32(dx);
  if (!checkedDx.success) return checkedDx;
  const checkedDy = asInt32(dy);
  if (!checkedDy.success) return checkedDy;
  if (dx === 0 && dy === 0) return { success: true, data: 0 as Int32 };

  let selected = 0 as Int32;
  let smallestCross = Number.POSITIVE_INFINITY;
  let greatestDot = Number.NEGATIVE_INFINITY;
  for (let degree = 0; degree < 360; degree += 1) {
    const direction = directionUnitVector(degree as Int32);
    const cross = Math.abs(dx * direction.y - dy * direction.x);
    const dot = dx * direction.x + dy * direction.y;
    const checkedCross = asInt32(cross);
    if (!checkedCross.success) return checkedCross;
    const checkedDot = asInt32(dot);
    if (!checkedDot.success) return checkedDot;
    if (
      cross < smallestCross ||
      (cross === smallestCross && dot > greatestDot)
    ) {
      selected = degree as Int32;
      smallestCross = cross;
      greatestDot = dot;
    }
  }
  return { success: true, data: selected };
};

/** 自機正面を0度とする相対方位を生成する。 */
export const relativeBearing = (
  origin: Position,
  originDirection: Int32,
  target: Position,
): SimulatorResult<Int32> => {
  const bearing = worldBearing(origin, target);
  return bearing.success
    ? {
        success: true,
        data: normalizeAngle((bearing.data - originDirection) as Int32),
      }
    : bearing;
};

/** World座標差を自機の右方向X、正面方向Yの座標へ変換する。 */
export const relativePosition = (
  origin: Position,
  originDirection: Int32,
  target: Position,
): SimulatorResult<Position> => {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const forward = directionUnitVector(originDirection);
  const x = roundDivision(dx * forward.y - dy * forward.x, DIRECTION_SCALE);
  if (!x.success) return x;
  const y = roundDivision(dx * forward.x + dy * forward.y, DIRECTION_SCALE);
  if (!y.success) return y;
  return { success: true, data: { x: x.data, y: y.data } };
};
