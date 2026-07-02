import { normalizeAngle, type Int32 } from "../data/common";
import type { NodeId } from "../data/ids";
import type { NodeReference } from "../program/models";
import type { DetectedBullet, DetectedRobot } from "../runtime/models";
import {
  createEmptyContextChanges,
  fail,
  succeed,
  type InstructionImplementation,
  type InstructionRegistry,
} from "./contracts";

const parameter = <T>(
  input: Parameters<InstructionImplementation>[0],
  name: string,
): T => input.node.parameterValues[name] as T;

const next = (input: Parameters<InstructionImplementation>[0]): NodeId =>
  input.node.connections.next as NodeId;

const start: InstructionImplementation = (input) => succeed(next(input));
const end: InstructionImplementation = () => succeed(null, undefined, true);

const call: InstructionImplementation = (input) => {
  const target = parameter<NodeReference>(input, "targetNodeId").nodeId;
  return succeed(target, {
    ...createEmptyContextChanges(),
    stackOperations: [{ type: "push", nodeId: next(input) }],
  });
};

const returnInstruction: InstructionImplementation = (input) => {
  const returnTo = input.context.aiRuntimeState.callStack.at(-1);
  if (returnTo === undefined) {
    return fail("empty_call_stack", "コールスタックが空です");
  }
  return succeed(returnTo, {
    ...createEmptyContextChanges(),
    stackOperations: [{ type: "pop" }],
  });
};

const move =
  (type: "forward" | "backward"): InstructionImplementation =>
  (input) =>
    succeed(next(input), {
      ...createEmptyContextChanges(),
      movementRequest: {
        type,
        distance: parameter<Int32>(input, "distance"),
      },
    });

const turn: InstructionImplementation = (input) => {
  const direction = parameter<"left" | "right">(input, "direction");
  const current = normalizeAngle(input.context.input.robot.direction);
  const degree = normalizeAngle(parameter<Int32>(input, "degree"));
  return succeed(next(input), {
    ...createEmptyContextChanges(),
    movementRequest: {
      type: direction === "left" ? "turn_left" : "turn_right",
      turnTo: normalizeAngle((current + degree) as Int32),
    },
  });
};

const angularDistance = (left: Int32, right: Int32): number => {
  const difference = Math.abs(normalizeAngle(left) - normalizeAngle(right));
  return Math.min(difference, 360 - difference);
};

const inSensingRange = (
  target: Pick<DetectedRobot | DetectedBullet, "distance" | "bearing">,
  distance: Int32,
  center: Int32,
  sensingDegree: Int32,
): boolean =>
  target.distance <= distance &&
  angularDistance(target.bearing, center) <= sensingDegree;

const detectEnemy: InstructionImplementation = (input) => {
  const detected = input.context.input.sensors.robots.some(
    (robot) =>
      robot.id !== input.context.input.robot.id &&
      robot.status === "active" &&
      inSensingRange(
        robot,
        parameter<Int32>(input, "distance"),
        parameter<Int32>(input, "center_degree"),
        parameter<Int32>(input, "sensing_degree"),
      ),
  );
  return succeed(
    input.node.connections[detected ? "detected" : "not_detected"] as NodeId,
  );
};

const detectBullet: InstructionImplementation = (input) => {
  const detected = input.context.input.sensors.bullets.some((bullet) =>
    inSensingRange(
      bullet,
      parameter<Int32>(input, "threshold"),
      parameter<Int32>(input, "center_degree"),
      parameter<Int32>(input, "sensing_degree"),
    ),
  );
  return succeed(
    input.node.connections[detected ? "detected" : "not_detected"] as NodeId,
  );
};

const checkAmmunition: InstructionImplementation = (input) => {
  const slotId = input.context.input.robot.selectedWeaponSlotId;
  const ammunition = slotId
    ? (input.context.input.robot.ammunition[slotId] ?? (0 as Int32))
    : (0 as Int32);
  const output =
    ammunition >= parameter<Int32>(input, "threshold")
      ? "at_least"
      : "less_than";
  return succeed(input.node.connections[output] as NodeId);
};

const fire: InstructionImplementation = (input) => {
  const enemy = input.context.input.sensors.robots.find(
    (robot) =>
      robot.id !== input.context.input.robot.id && robot.status === "active",
  );
  if (!enemy) return succeed(next(input));
  return succeed(next(input), {
    ...createEmptyContextChanges(),
    combatRequest: {
      type: "fire",
      targetDirection: normalizeAngle(
        (normalizeAngle(input.context.input.robot.direction) +
          normalizeAngle(enemy.bearing)) as Int32,
      ),
      targetPosition: { ...enemy.worldPosition },
    },
  });
};

const switchWeapon: InstructionImplementation = (input) =>
  succeed(next(input), {
    ...createEmptyContextChanges(),
    combatRequest: {
      type: "switch_weapon",
      hand: parameter<"right" | "left">(input, "hand"),
    },
  });

const waitAction: InstructionImplementation = (input) => {
  const category = parameter<"movement" | "combat">(input, "category");
  const waiting =
    input.context.actionRequests[category] !== null ||
    input.context.input.actionStatus[category] === "running";
  return waiting
    ? succeed(input.node.id, undefined, true)
    : succeed(next(input));
};

const entries = [
  ["start", start],
  ["end", end],
  ["call", call],
  ["return", returnInstruction],
  ["move_forward", move("forward")],
  ["move_backward", move("backward")],
  ["turn", turn],
  ["fire", fire],
  ["switch_weapon", switchWeapon],
  ["detect_enemy", detectEnemy],
  ["detect_bullet", detectBullet],
  ["check_ammunition", checkAmmunition],
  ["wait_action", waitAction],
] as const;

export const PRODUCTION_IMPLEMENTATION_IDS: ReadonlySet<string> = new Set(
  entries.map(([implementationId]) => implementationId),
);

export const productionInstructionRegistry: InstructionRegistry = new Map(
  entries,
);
