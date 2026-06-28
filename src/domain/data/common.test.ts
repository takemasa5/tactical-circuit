import { describe, expect, it } from "vitest";

import {
  INT32_MAX,
  INT32_MIN,
  isFormatVersion,
  normalizeAngle,
  parseJson,
  toInt32,
  type Int32,
} from "./common";
import {
  isNodeId,
  isProgramId,
  isRobotDesignId,
  isRuntimeRobotId,
} from "./ids";

describe("toInt32", () => {
  it.each([INT32_MIN, 0, INT32_MAX])("%sを受け付ける", (value) => {
    expect(toInt32(value)).toEqual({ success: true, data: value });
  });

  it.each([INT32_MIN - 1, INT32_MAX + 1, 1.5, "1", null])(
    "%sを拒否する",
    (value) => {
      expect(toInt32(value).success).toBe(false);
    },
  );
});

describe("normalizeAngle", () => {
  it.each([
    [0, 0],
    [360, 0],
    [-90, 270],
    [450, 90],
  ])("%sを%sへ正規化する", (angle, expected) => {
    expect(normalizeAngle(angle as Int32)).toBe(expected);
  });
});

describe("format version", () => {
  it.each(["0.1.1", "1.1.1", "10.20.30"])("%sを受け付ける", (value) => {
    expect(isFormatVersion(value)).toBe(true);
  });

  it.each(["0.0.1", "0.1.0", "v0.1.1", "0.1", 1])("%sを拒否する", (value) => {
    expect(isFormatVersion(value)).toBe(false);
  });
});

describe("parseJson", () => {
  it("有効なJSONを読み込む", () => {
    expect(parseJson('{"value":1}')).toEqual({
      success: true,
      data: { value: 1 },
    });
  });

  it("不正なJSONを安全に拒否する", () => {
    expect(parseJson("{").success).toBe(false);
  });
});

describe("IDs", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";

  it("グローバルIDの接頭辞を検証する", () => {
    expect(isProgramId(`program_${uuid}`)).toBe(true);
    expect(isRobotDesignId(`robo_${uuid}`)).toBe(true);
    expect(isProgramId(`robo_${uuid}`)).toBe(false);
  });

  it("ローカルIDを検証する", () => {
    expect(isRuntimeRobotId("robot_1")).toBe(true);
    expect(isRuntimeRobotId("robot_0")).toBe(false);
    expect(isNodeId("node_1")).toBe(true);
    expect(isNodeId("node_01")).toBe(false);
  });
});
