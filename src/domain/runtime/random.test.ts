import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import type { RandomState } from "./models";
import { initializeRandomState, nextInt, nextUint32 } from "./random";

const int32 = (value: number): Int32 => value as Int32;

describe("runtime random", () => {
  it("シードの32bitビット列を保持し、0だけを既定値へ置き換える", () => {
    expect(initializeRandomState(int32(-1))).toEqual({ value: -1 });
    expect(initializeRandomState(int32(0))).toEqual({ value: 0x6d2b79f5 });
  });

  it("既知シードからxorshift32の値を順番に生成する", () => {
    const initialState = initializeRandomState(int32(1));
    const first = nextUint32(initialState);
    const second = nextUint32(first.randomState);
    const third = nextUint32(second.randomState);

    expect([first.value, second.value, third.value]).toEqual([
      270_369, 67_634_689, 2_647_435_461,
    ]);
    expect(initialState).toEqual({ value: 1 });
    expect(first.randomState).toEqual({ value: 270_369 });
    expect(third.randomState).toEqual({ value: -1_647_531_835 });
  });

  it("指定された半開区間の範囲内で値と更新後状態を返す", () => {
    const state = initializeRandomState(int32(1));
    const result = nextInt(state, int32(-10), int32(10));

    expect(result).toEqual({
      success: true,
      data: {
        value: -1,
        randomState: { value: 270_369 },
      },
    });
    expect(state).toEqual({ value: 1 });
  });

  it("1要素の範囲と符号付き32bit整数の全範囲を処理する", () => {
    const state = initializeRandomState(int32(-1));
    const singleValue = nextInt(state, int32(5), int32(6));
    const fullRange = nextInt(
      state,
      int32(-2_147_483_648),
      int32(2_147_483_647),
    );

    expect(singleValue.success && singleValue.data.value).toBe(5);
    expect(fullRange.success && fullRange.data.value).toBeGreaterThanOrEqual(
      -2_147_483_648,
    );
    expect(fullRange.success && fullRange.data.value).toBeLessThan(
      2_147_483_647,
    );
  });

  it.each([
    [5, 5],
    [6, 5],
  ])("不正な範囲 %i..%i では状態を進めない", (min, max) => {
    const state: RandomState = { value: int32(123) };
    const result = nextInt(state, int32(min), int32(max));

    expect(result).toEqual({
      success: false,
      code: "invalid_random_range",
      message: "乱数の最小値は最大値より小さくする必要があります",
      randomState: state,
    });
    expect(!result.success && result.randomState).toBe(state);
  });
});
