/// <reference types="node" />

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadEditorMasterData,
  parseEditorMasterData,
  parseInstructionDocumentManifest,
} from "./loadEditorMasterData";

const readPublicFile = (path: string): string =>
  readFileSync(join(process.cwd(), "public", path), "utf8");

const requestPath = (input: string | URL | Request): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

describe("Editor Master Data", () => {
  afterEach(() => vi.restoreAllMocks());

  it("生成manifestに記載された公開Instruction JSONをすべて読み込む", () => {
    const instructionManifest = parseInstructionDocumentManifest(
      readPublicFile("/master-data/instructions/manifest.json"),
    );
    const masterData = parseEditorMasterData(
      readPublicFile("/master-data/manifest.json"),
      instructionManifest.files.map((file) => {
        const path = `/master-data/instructions/${file}`;
        return { path, json: readPublicFile(path) };
      }),
    );
    const byImplementationId = new Map(
      masterData.instructions.map((instruction) => [
        instruction.implementationId,
        instruction,
      ]),
    );

    expect(masterData.instructions).toHaveLength(
      instructionManifest.files.length,
    );
    expect(byImplementationId.get("fire")?.category).toBe("action");
    expect(byImplementationId.get("detect_enemy")?.outputPaths).toHaveLength(2);
    expect(byImplementationId.get("call")?.parameters[0]?.id).toBe(
      "targetNodeId",
    );
    expect(byImplementationId.get("return")?.outputPaths).toEqual([]);
    expect(
      byImplementationId
        .get("turn")
        ?.parameters.find(({ id }) => id === "degree"),
    ).not.toHaveProperty("maxValue");
  });

  it("manifestに不正なファイル名または重複がある場合は拒否する", () => {
    expect(() =>
      parseInstructionDocumentManifest('{"files":["../start.json"]}'),
    ).toThrow("invalid file name");
    expect(() =>
      parseInstructionDocumentManifest('{"files":["start.json","start.json"]}'),
    ).toThrow("duplicate file names");
  });

  it("ブラウザ読込ではInstruction manifestに記載されたファイルだけを取得する", async () => {
    const responses = new Map<string, string>([
      [
        "/master-data/manifest.json",
        readPublicFile("/master-data/manifest.json"),
      ],
      [
        "/master-data/instructions/manifest.json",
        '{"files":["start.json","end.json"]}',
      ],
      [
        "/master-data/instructions/start.json",
        readPublicFile("/master-data/instructions/start.json"),
      ],
      [
        "/master-data/instructions/end.json",
        readPublicFile("/master-data/instructions/end.json"),
      ],
    ]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        const path = requestPath(input);
        const body = responses.get(path);
        return Promise.resolve(
          new Response(body ?? "", { status: body === undefined ? 404 : 200 }),
        );
      });
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const masterData = await loadEditorMasterData();

    expect(masterData.instructions).toHaveLength(2);
    expect(fetchMock.mock.calls.map(([input]) => requestPath(input))).toEqual([
      "/master-data/manifest.json",
      "/master-data/instructions/manifest.json",
      "/master-data/instructions/start.json",
      "/master-data/instructions/end.json",
    ]);
  });

  it("ファイル取得失敗時は対象パスをエラーログへ出力する", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = requestPath(input);
      if (path === "/master-data/manifest.json") {
        return Promise.resolve(
          new Response(readPublicFile(path), { status: 200 }),
        );
      }
      if (path === "/master-data/instructions/manifest.json") {
        return Promise.resolve(
          new Response('{"files":["missing.json"]}', { status: 200 }),
        );
      }
      return Promise.resolve(new Response("", { status: 404 }));
    });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(loadEditorMasterData()).rejects.toThrow("HTTP 404");
    expect(errorLog).toHaveBeenCalledWith(
      "[editor-master-data] fetch failed",
      expect.objectContaining({
        path: "/master-data/instructions/missing.json",
      }),
    );
  });
});
