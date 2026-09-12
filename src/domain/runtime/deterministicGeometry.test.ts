import { describe, expect, it } from "vitest";

import type { Int32 } from "../data/common";
import {
  directionUnitVector,
  relativeBearing,
  relativePosition,
  roundedDistance,
  scaleDirectionVector,
} from "./deterministicGeometry";

const int32 = (value: number): Int32 => value as Int32;

describe("deterministicGeometry", () => {
  it("0、90、180、270度を共通座標系の方向へ変換する", () => {
    expect(directionUnitVector(int32(0))).toEqual({ x: 0, y: 1000 });
    expect(directionUnitVector(int32(90))).toEqual({ x: 1000, y: 0 });
    expect(directionUnitVector(int32(180))).toEqual({ x: 0, y: -1000 });
    expect(directionUnitVector(int32(270))).toEqual({ x: -1000, y: 0 });
  });

  it("方向Vectorを指定距離へ四捨五入する", () => {
    expect(scaleDirectionVector(int32(45), int32(4))).toEqual({
      success: true,
      data: { x: 3, y: 3 },
    });
  });

  it("ユークリッド距離を最も近い整数へ丸める", () => {
    expect(
      roundedDistance(
        { x: int32(0), y: int32(0) },
        { x: int32(3), y: int32(4) },
      ),
    ).toEqual({ success: true, data: 5 });
    expect(
      roundedDistance(
        { x: int32(0), y: int32(0) },
        { x: int32(1), y: int32(1) },
      ),
    ).toEqual({ success: true, data: 1 });
  });

  it("自機の向きを基準に相対位置と方位を返す", () => {
    const origin = { x: int32(10), y: int32(10) };
    const target = { x: int32(20), y: int32(10) };
    expect(relativeBearing(origin, int32(90), target)).toEqual({
      success: true,
      data: 0,
    });
    expect(relativePosition(origin, int32(90), target)).toEqual({
      success: true,
      data: { x: 0, y: 10 },
    });
  });

  it("距離計算が符号付き32bit整数を超える場合は失敗する", () => {
    expect(
      roundedDistance(
        { x: int32(0), y: int32(0) },
        { x: int32(50_000), y: int32(50_000) },
      ),
    ).toMatchObject({ success: false, code: "inconsistent_session" });
  });
});
