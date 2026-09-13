import { describe, expect, it } from "vitest";

import masterManifestJson from "../../../public/master-data/manifest.json?raw";
import type { ProgramId } from "../data/ids";
import { PRODUCTION_IMPLEMENTATION_IDS } from "../ai/instructions";
import {
  loadDataRepository,
  type MasterDataDocument,
} from "../masterData/loader";
import type { MasterDataType } from "../masterData/models";
import { validateProgram } from "../validator/validateProgram";
import { runFixedBattle } from "./runBattle";
import {
  createPhase1OpponentProgram,
  createPhase1PlayerProgram,
} from "./phase1Programs";

const documents = import.meta.glob(
  "../../../public/master-data/{battle,instructions}/*.json",
  { eager: true, query: "?raw", import: "default" },
) as Readonly<Record<string, string>>;

const createRepository = () => {
  const masterDataDocuments: MasterDataDocument[] = Object.entries(documents)
    .filter(([path]) => !path.endsWith("/manifest.json"))
    .map(([path, json]) => {
      const { dataType } = JSON.parse(json) as { dataType: MasterDataType };
      return { dataType, json, sourcePath: path };
    });
  const result = loadDataRepository(
    masterManifestJson,
    masterDataDocuments,
    PRODUCTION_IMPLEMENTATION_IDS,
  );
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.data.repository;
};

describe("Phase 1 Program", () => {
  it("プレイヤー用サンプルと相手用固定Programを検証済みの戦闘入力として生成する", () => {
    const repository = createRepository();
    const now = "2026-09-13T00:00:00.000Z";
    const player = createPhase1PlayerProgram(
      "program_10000000-0000-4000-8000-000000000030" as ProgramId,
      repository,
      now,
    );
    const opponent = createPhase1OpponentProgram(repository, now);

    expect(validateProgram(player, repository).diagnostics).toEqual([]);
    expect(validateProgram(opponent, repository).diagnostics).toEqual([]);
    expect(runFixedBattle(player, opponent, repository)).toMatchObject({
      success: true,
    });
  });
});
