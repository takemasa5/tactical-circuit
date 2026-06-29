/// <reference types="node" />

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EDITOR_MASTER_DATA_DOCUMENTS,
  parseEditorMasterData,
} from "./loadEditorMasterData";

describe("Editor Master Data", () => {
  it("公開JSONから行動・分岐Instructionを読み込む", () => {
    const readPublicFile = (path: string): string =>
      readFileSync(join(process.cwd(), "public", path), "utf8");
    const masterData = parseEditorMasterData(
      readPublicFile("/master-data/manifest.json"),
      EDITOR_MASTER_DATA_DOCUMENTS.map(({ path }) => readPublicFile(path)),
    );
    const byImplementationId = new Map(
      masterData.instructions.map((instruction) => [
        instruction.implementationId,
        instruction,
      ]),
    );

    expect(masterData.instructions).toHaveLength(10);
    expect(byImplementationId.get("fire")?.category).toBe("action");
    expect(byImplementationId.get("detect_enemy")?.outputPaths).toHaveLength(2);
    expect(byImplementationId.get("call")?.parameters[0]?.id).toBe(
      "targetNodeId",
    );
    expect(byImplementationId.get("return")?.outputPaths).toEqual([]);
  });
});
