import { describe, expect, it } from "vitest";

import masterManifestJson from "../../../public/master-data/manifest.json?raw";
import type { Int32 } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import { PRODUCTION_IMPLEMENTATION_IDS } from "../ai/instructions";
import {
  loadDataRepository,
  type MasterDataDocument,
} from "../masterData/loader";
import type {
  InstructionDefinition,
  MasterDataType,
} from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { Program } from "../program/models";
import { runFixedBattle } from "./runBattle";

const documents = import.meta.glob(
  "../../../public/master-data/{battle,instructions}/*.json",
  { eager: true, query: "?raw", import: "default" },
) as Readonly<Record<string, string>>;

const repository = (): DataRepository => {
  const masterDataDocuments: MasterDataDocument[] = [];
  Object.entries(documents)
    .filter(([path]) => !path.endsWith("/manifest.json"))
    .forEach(([path, json]) => {
      const envelope = JSON.parse(json) as { dataType: MasterDataType };
      masterDataDocuments.push({
        dataType: envelope.dataType,
        json,
        sourcePath: path,
      });
    });
  const loaded = loadDataRepository(
    masterManifestJson,
    masterDataDocuments,
    PRODUCTION_IMPLEMENTATION_IDS,
  );
  if (!loaded.success) throw new Error(JSON.stringify(loaded.errors));
  return loaded.data.repository;
};

const instructionId = (
  dataRepository: DataRepository,
  implementationId: string,
): InstructionDefinition["id"] => {
  const definition = dataRepository
    .getAll("instruction")
    .find((candidate) => candidate.implementationId === implementationId);
  if (definition === undefined) {
    throw new Error(`Instruction ${implementationId} is missing`);
  }
  return definition.id;
};

const metadata = (name: string) => ({
  name,
  author: "Tactical Circuit",
  description: "Phase 1 test Program",
  createdAt: "2026-09-13T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
});

const playerProgram = (dataRepository: DataRepository): Program => ({
  id: "program_10000000-0000-4000-8000-000000000030" as ProgramId,
  nodes: [
    {
      id: "node_1" as NodeId,
      instructionId: instructionId(dataRepository, "start"),
      parameterValues: {},
      connections: { next: "node_2" as NodeId },
    },
    {
      id: "node_2" as NodeId,
      instructionId: instructionId(dataRepository, "move_forward"),
      parameterValues: { distance: 40 as Int32 },
      connections: { next: "node_3" as NodeId },
    },
    {
      id: "node_3" as NodeId,
      instructionId: instructionId(dataRepository, "wait_action"),
      parameterValues: { category: "movement" },
      connections: { next: "node_4" as NodeId },
    },
    {
      id: "node_4" as NodeId,
      instructionId: instructionId(dataRepository, "detect_enemy"),
      parameterValues: {
        distance: 1000 as Int32,
        center_degree: 0 as Int32,
        sensing_degree: 180 as Int32,
      },
      connections: {
        detected: "node_5" as NodeId,
        not_detected: "node_8" as NodeId,
      },
    },
    {
      id: "node_5" as NodeId,
      instructionId: instructionId(dataRepository, "fire"),
      parameterValues: {},
      connections: { next: "node_6" as NodeId },
    },
    {
      id: "node_6" as NodeId,
      instructionId: instructionId(dataRepository, "wait_action"),
      parameterValues: { category: "combat" },
      connections: { next: "node_7" as NodeId },
    },
    {
      id: "node_7" as NodeId,
      instructionId: instructionId(dataRepository, "end"),
      parameterValues: {},
      connections: {},
    },
    {
      id: "node_8" as NodeId,
      instructionId: instructionId(dataRepository, "turn"),
      parameterValues: { direction: "right", degree: 10 as Int32 },
      connections: { next: "node_9" as NodeId },
    },
    {
      id: "node_9" as NodeId,
      instructionId: instructionId(dataRepository, "wait_action"),
      parameterValues: { category: "movement" },
      connections: { next: "node_7" as NodeId },
    },
  ],
  startNodeId: "node_1" as NodeId,
  nextNodeSequence: 10 as Int32,
  metadata: metadata("Player Program"),
  editorState: { nodePositions: {}, comments: {} },
});

const opponentProgram = (dataRepository: DataRepository): Program => ({
  id: "program_10000000-0000-4000-8000-000000000031" as ProgramId,
  nodes: [
    {
      id: "node_1" as NodeId,
      instructionId: instructionId(dataRepository, "start"),
      parameterValues: {},
      connections: { next: "node_2" as NodeId },
    },
    {
      id: "node_2" as NodeId,
      instructionId: instructionId(dataRepository, "detect_enemy"),
      parameterValues: {
        distance: 1000 as Int32,
        center_degree: 0 as Int32,
        sensing_degree: 180 as Int32,
      },
      connections: {
        detected: "node_3" as NodeId,
        not_detected: "node_6" as NodeId,
      },
    },
    {
      id: "node_3" as NodeId,
      instructionId: instructionId(dataRepository, "fire"),
      parameterValues: {},
      connections: { next: "node_4" as NodeId },
    },
    {
      id: "node_4" as NodeId,
      instructionId: instructionId(dataRepository, "wait_action"),
      parameterValues: { category: "combat" },
      connections: { next: "node_5" as NodeId },
    },
    {
      id: "node_5" as NodeId,
      instructionId: instructionId(dataRepository, "end"),
      parameterValues: {},
      connections: {},
    },
    {
      id: "node_6" as NodeId,
      instructionId: instructionId(dataRepository, "turn"),
      parameterValues: { direction: "right", degree: 10 as Int32 },
      connections: { next: "node_7" as NodeId },
    },
    {
      id: "node_7" as NodeId,
      instructionId: instructionId(dataRepository, "wait_action"),
      parameterValues: { category: "movement" },
      connections: { next: "node_5" as NodeId },
    },
  ],
  startNodeId: "node_1" as NodeId,
  nextNodeSequence: 8 as Int32,
  metadata: metadata("Opponent Program"),
  editorState: { nodePositions: {}, comments: {} },
});

describe("runFixedBattle", () => {
  it("実AIから撃破結果と再生用Snapshotを最後まで生成する", () => {
    const dataRepository = repository();
    const result = runFixedBattle(
      playerProgram(dataRepository),
      opponentProgram(dataRepository),
      dataRepository,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const { finalGameSession, snapshots } = result.data;
    expect(snapshots[0]).toMatchObject({ tick: 0, status: "running" });
    expect(snapshots.at(-1)).toEqual(finalGameSession.worldState);
    expect(snapshots.length).toBeLessThanOrEqual(601);
    expect(snapshots.some(({ bullets }) => bullets.length > 0)).toBe(true);
    expect(snapshots.some(({ robots }) => robots[0]!.position.x > 200)).toBe(
      true,
    );
    expect(finalGameSession.worldState.status).toBe("finished");
    expect(finalGameSession.worldState.result?.reason).not.toBe("tick_limit");
    expect(
      finalGameSession.worldState.robots.some(
        ({ status }) => status === "destroyed",
      ),
    ).toBe(true);
    expect(Object.isFrozen(snapshots[0])).toBe(true);
  });

  it("同じ入力から同じ全Snapshotと最終結果を生成する", () => {
    const dataRepository = repository();
    const player = playerProgram(dataRepository);
    const opponent = opponentProgram(dataRepository);
    expect(runFixedBattle(player, opponent, dataRepository)).toEqual(
      runFixedBattle(player, opponent, dataRepository),
    );
  });

  it("不正Programでは部分Snapshotを返さない", () => {
    const dataRepository = repository();
    const invalidPlayer = { ...playerProgram(dataRepository), nodes: [] };
    expect(
      runFixedBattle(
        invalidPlayer,
        opponentProgram(dataRepository),
        dataRepository,
      ),
    ).toMatchObject({ success: false, code: "invalid_battle_input" });
  });
});
