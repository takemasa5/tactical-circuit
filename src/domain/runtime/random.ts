import type { Int32 } from "../data/common";
import type { RandomState } from "./models";

/** `docs/specs/current/14_determinism_rules.md`の乱数生成結果。 */
export type RandomGeneration<TValue> = {
  readonly value: TValue;
  readonly randomState: RandomState;
};

/** `docs/specs/current/14_determinism_rules.md`の範囲指定乱数生成結果。 */
export type RandomRangeResult =
  | {
      readonly success: true;
      readonly data: RandomGeneration<Int32>;
    }
  | {
      readonly success: false;
      readonly code: "invalid_random_range";
      readonly message: string;
      readonly randomState: RandomState;
    };

const ZERO_SEED_REPLACEMENT = 0x6d2b79f5;

const toStoredInt32 = (value: number): Int32 => (value | 0) as Int32;

/** シードの32bitビット列からxorshift32の初期状態を生成する。 */
export const initializeRandomState = (seed: Int32): RandomState => ({
  value: seed === 0 ? (ZERO_SEED_REPLACEMENT as Int32) : seed,
});

/** 入力状態を変更せず、xorshift32の次の符号なし32bit値を生成する。 */
export const nextUint32 = (state: RandomState): RandomGeneration<number> => {
  let nextValue = state.value >>> 0;
  nextValue ^= nextValue << 13;
  nextValue ^= nextValue >>> 17;
  nextValue ^= nextValue << 5;
  nextValue >>>= 0;

  return {
    value: nextValue,
    randomState: { value: toStoredInt32(nextValue) },
  };
};

/** 指定した半開区間の次の符号付き32bit整数を生成する。 */
export const nextInt = (
  state: RandomState,
  minInclusive: Int32,
  maxExclusive: Int32,
): RandomRangeResult => {
  if (minInclusive >= maxExclusive) {
    return {
      success: false,
      code: "invalid_random_range",
      message: "乱数の最小値は最大値より小さくする必要があります",
      randomState: state,
    };
  }

  const generation = nextUint32(state);
  const range = maxExclusive - minInclusive;
  const value = minInclusive + (generation.value % range);

  return {
    success: true,
    data: {
      value: value as Int32,
      randomState: generation.randomState,
    },
  };
};
