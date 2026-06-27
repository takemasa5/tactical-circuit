import { describe, expect, it } from "vitest";

import {
  compileJsonSchema,
  loadJsonEnvelope,
  saveJsonEnvelope,
} from "./jsonEnvelope";

/** `spec/12_common_data_conventions.md`のpayload検証に使うテスト型。 */
type TestPayload = { value: number };

const validateTestPayload = compileJsonSchema<TestPayload>({
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: { type: "integer" },
  },
});

describe("JSON envelope", () => {
  it("保存したデータを読み戻す", () => {
    const json = saveJsonEnvelope("test", { value: 1 });

    expect(loadJsonEnvelope(json, "test", validateTestPayload)).toEqual({
      success: true,
      data: {
        dataType: "test",
        formatVersion: "0.1.1",
        payload: { value: 1 },
      },
    });
  });

  it("異なるdataTypeを拒否する", () => {
    const json = saveJsonEnvelope("other", { value: 1 });
    const result = loadJsonEnvelope(json, "test", validateTestPayload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe("unexpected_data_type");
    }
  });

  it("未対応majorを拒否する", () => {
    const json = JSON.stringify({
      dataType: "test",
      formatVersion: "1.1.1",
      payload: { value: 1 },
    });
    const result = loadJsonEnvelope(json, "test", validateTestPayload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe("unsupported_format_version");
    }
  });

  it("Schemaに適合しないpayloadを拒否する", () => {
    const json = saveJsonEnvelope("test", { value: "invalid" });
    const result = loadJsonEnvelope(json, "test", validateTestPayload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe("schema_type");
    }
  });

  it("共通ヘッダの余分なプロパティを拒否する", () => {
    const json = JSON.stringify({
      dataType: "test",
      formatVersion: "0.1.1",
      payload: { value: 1 },
      extra: true,
    });

    expect(loadJsonEnvelope(json, "test", validateTestPayload).success).toBe(
      false,
    );
  });
});
