import type { NodeId } from "../data/ids";
import type { InstructionDefinition } from "../masterData/models";
import type { Program, ProgramNode } from "../program/models";

export type ControlFlowGraph = ReadonlyMap<NodeId, ReadonlySet<NodeId>>;

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const nodeSequence = (nodeId: NodeId): number =>
  Number(/^node_(\d+)$/.exec(nodeId)?.[1] ?? Number.MAX_SAFE_INTEGER);

export const compareNodeIds = (left: NodeId, right: NodeId): number => {
  const sequenceDifference = nodeSequence(left) - nodeSequence(right);
  return sequenceDifference || compareAscii(left, right);
};

export const buildControlFlowGraph = (
  program: Program,
  instructions: ReadonlyMap<string, InstructionDefinition>,
): ControlFlowGraph => {
  const nodeIds = new Set(program.nodes.map(({ id }) => id));
  const graph = new Map<NodeId, Set<NodeId>>(
    program.nodes.map(({ id }) => [id, new Set<NodeId>()]),
  );

  program.nodes.forEach((node) => {
    const instruction = instructions.get(node.instructionId);
    if (instruction === undefined) return;
    const outputPathIds = new Set(instruction.outputPaths.map(({ id }) => id));
    Object.entries(node.connections).forEach(([outputPathId, targetNodeId]) => {
      if (outputPathIds.has(outputPathId) && nodeIds.has(targetNodeId)) {
        graph.get(node.id)?.add(targetNodeId);
      }
    });

    const target = node.parameterValues.targetNodeId;
    if (
      instruction.implementationId === "call" &&
      typeof target === "object" &&
      target !== null &&
      "type" in target &&
      target.type === "node_reference" &&
      nodeIds.has(target.nodeId)
    ) {
      graph.get(node.id)?.add(target.nodeId);
    }
  });

  return new Map(
    [...graph].map(([nodeId, targets]) => [
      nodeId,
      new Set([...targets].sort(compareNodeIds)),
    ]),
  );
};

export const findReachableNodeIds = (
  graph: ControlFlowGraph,
  startNodeId: NodeId,
): ReadonlySet<NodeId> => {
  if (!graph.has(startNodeId)) return new Set();
  const reachable = new Set<NodeId>();
  const pending = [startNodeId];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (nodeId === undefined || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const targets = [...(graph.get(nodeId) ?? [])]
      .sort(compareNodeIds)
      .reverse();
    pending.push(...targets);
  }
  return reachable;
};

const stronglyConnectedComponents = (
  graph: ControlFlowGraph,
): readonly (readonly NodeId[])[] => {
  let nextIndex = 0;
  const indices = new Map<NodeId, number>();
  const lowLinks = new Map<NodeId, number>();
  const stack: NodeId[] = [];
  const onStack = new Set<NodeId>();
  const components: NodeId[][] = [];

  const visit = (nodeId: NodeId): void => {
    indices.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    [...(graph.get(nodeId) ?? [])].sort(compareNodeIds).forEach((targetId) => {
      if (!indices.has(targetId)) {
        visit(targetId);
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, lowLinks.get(targetId)!),
        );
      } else if (onStack.has(targetId)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, indices.get(targetId)!),
        );
      }
    });

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
    const component: NodeId[] = [];
    let current: NodeId;
    do {
      current = stack.pop()!;
      onStack.delete(current);
      component.push(current);
    } while (current !== nodeId);
    components.push(component.sort(compareNodeIds));
  };

  [...graph.keys()].sort(compareNodeIds).forEach((nodeId) => {
    if (!indices.has(nodeId)) visit(nodeId);
  });
  return components;
};

export const findPureCycles = (
  program: Program,
  graph: ControlFlowGraph,
  reachable: ReadonlySet<NodeId>,
  instructions: ReadonlyMap<string, InstructionDefinition>,
): readonly (readonly NodeId[])[] => {
  const nodes = new Map<NodeId, ProgramNode>(
    program.nodes.map((node) => [node.id, node]),
  );
  return stronglyConnectedComponents(graph)
    .filter((component) => {
      const componentIds = new Set(component);
      const formsCycle =
        component.length > 1 ||
        (graph.get(component[0]!)?.has(component[0]!) ?? false);
      if (!formsCycle || component.some((nodeId) => !reachable.has(nodeId))) {
        return false;
      }
      return component.every((nodeId) => {
        const node = nodes.get(nodeId);
        const instruction =
          node === undefined ? undefined : instructions.get(node.instructionId);
        if (
          instruction === undefined ||
          instruction.outputPaths.length > 1 ||
          instruction.implementationId === "call" ||
          instruction.implementationId === "return"
        ) {
          return false;
        }
        return [...(graph.get(nodeId) ?? [])].every((targetId) =>
          componentIds.has(targetId),
        );
      });
    })
    .sort((left, right) => compareNodeIds(left[0]!, right[0]!));
};
