import type { Int32, Position } from "../data/common";
import type { NodeId, ProgramId } from "../data/ids";
import type { InstructionId } from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { Program, ProgramNode } from "../program/models";

const OPPONENT_PROGRAM_ID =
  "program_10000000-0000-4000-8000-000000000031" as ProgramId;

const position = (x: number, y: number): Position => ({
  x: x as Int32,
  y: y as Int32,
});

const nodePositions = (
  entries: readonly (readonly [NodeId, Position])[],
): Readonly<Record<NodeId, Position>> => Object.fromEntries(entries);

const instructionId = (
  repository: DataRepository,
  implementationId: string,
): InstructionId => {
  const definition = repository
    .getAll("instruction")
    .find((candidate) => candidate.implementationId === implementationId);
  if (definition === undefined) {
    throw new Error(`Phase 1 Instruction is missing: ${implementationId}`);
  }
  return definition.id;
};

const metadata = (name: string, now: string) => ({
  name,
  author: "Tactical Circuit",
  description: "Phase 1固定対戦用Program",
  createdAt: now,
  updatedAt: now,
});

const playerNodes = (repository: DataRepository): readonly ProgramNode[] => [
  {
    id: "node_1" as NodeId,
    instructionId: instructionId(repository, "start"),
    parameterValues: {},
    connections: { next: "node_2" as NodeId },
  },
  {
    id: "node_2" as NodeId,
    instructionId: instructionId(repository, "move_forward"),
    parameterValues: { distance: 40 as Int32 },
    connections: { next: "node_3" as NodeId },
  },
  {
    id: "node_3" as NodeId,
    instructionId: instructionId(repository, "wait_action"),
    parameterValues: { category: "movement" },
    connections: { next: "node_4" as NodeId },
  },
  {
    id: "node_4" as NodeId,
    instructionId: instructionId(repository, "detect_enemy"),
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
    instructionId: instructionId(repository, "fire"),
    parameterValues: {},
    connections: { next: "node_6" as NodeId },
  },
  {
    id: "node_6" as NodeId,
    instructionId: instructionId(repository, "wait_action"),
    parameterValues: { category: "combat" },
    connections: { next: "node_7" as NodeId },
  },
  {
    id: "node_7" as NodeId,
    instructionId: instructionId(repository, "end"),
    parameterValues: {},
    connections: {},
  },
  {
    id: "node_8" as NodeId,
    instructionId: instructionId(repository, "turn"),
    parameterValues: { direction: "right", degree: 10 as Int32 },
    connections: { next: "node_9" as NodeId },
  },
  {
    id: "node_9" as NodeId,
    instructionId: instructionId(repository, "wait_action"),
    parameterValues: { category: "movement" },
    connections: { next: "node_7" as NodeId },
  },
];

const opponentNodes = (repository: DataRepository): readonly ProgramNode[] => [
  {
    id: "node_1" as NodeId,
    instructionId: instructionId(repository, "start"),
    parameterValues: {},
    connections: { next: "node_2" as NodeId },
  },
  {
    id: "node_2" as NodeId,
    instructionId: instructionId(repository, "detect_enemy"),
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
    instructionId: instructionId(repository, "fire"),
    parameterValues: {},
    connections: { next: "node_4" as NodeId },
  },
  {
    id: "node_4" as NodeId,
    instructionId: instructionId(repository, "wait_action"),
    parameterValues: { category: "combat" },
    connections: { next: "node_5" as NodeId },
  },
  {
    id: "node_5" as NodeId,
    instructionId: instructionId(repository, "end"),
    parameterValues: {},
    connections: {},
  },
  {
    id: "node_6" as NodeId,
    instructionId: instructionId(repository, "turn"),
    parameterValues: { direction: "right", degree: 10 as Int32 },
    connections: { next: "node_7" as NodeId },
  },
  {
    id: "node_7" as NodeId,
    instructionId: instructionId(repository, "wait_action"),
    parameterValues: { category: "movement" },
    connections: { next: "node_5" as NodeId },
  },
];

const playerPositions = nodePositions([
  ["node_1" as NodeId, position(80, 100)],
  ["node_2" as NodeId, position(330, 100)],
  ["node_3" as NodeId, position(580, 100)],
  ["node_4" as NodeId, position(830, 100)],
  ["node_5" as NodeId, position(1080, 40)],
  ["node_6" as NodeId, position(1330, 40)],
  ["node_7" as NodeId, position(1580, 100)],
  ["node_8" as NodeId, position(1080, 280)],
  ["node_9" as NodeId, position(1330, 280)],
]);

/** `docs/specs/current/simulator/phase1_minimal_battle.md`のプレイヤー用サンプルProgram。 */
export const createPhase1PlayerProgram = (
  id: ProgramId,
  repository: DataRepository,
  now: string,
): Program => ({
  id,
  nodes: playerNodes(repository),
  startNodeId: "node_1" as NodeId,
  nextNodeSequence: 10 as Int32,
  metadata: metadata("Player Program", now),
  editorState: { nodePositions: playerPositions, comments: {} },
});

/** `docs/specs/current/simulator/phase1_minimal_battle.md`の相手用固定Program。 */
export const createPhase1OpponentProgram = (
  repository: DataRepository,
  now: string,
): Program => ({
  id: OPPONENT_PROGRAM_ID,
  nodes: opponentNodes(repository),
  startNodeId: "node_1" as NodeId,
  nextNodeSequence: 8 as Int32,
  metadata: metadata("Opponent Program", now),
  editorState: {
    nodePositions: nodePositions([
      ["node_1" as NodeId, position(80, 100)],
      ["node_2" as NodeId, position(330, 100)],
      ["node_3" as NodeId, position(580, 40)],
      ["node_4" as NodeId, position(830, 40)],
      ["node_5" as NodeId, position(1080, 100)],
      ["node_6" as NodeId, position(580, 280)],
      ["node_7" as NodeId, position(830, 280)],
    ]),
    comments: {},
  },
});
