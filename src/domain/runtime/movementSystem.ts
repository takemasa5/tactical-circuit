import {
  INT32_MAX,
  INT32_MIN,
  normalizeAngle,
  type Int32,
  type Position,
} from "../data/common";
import type { DataRepository } from "../masterData/repository";
import type { EngineDefinition } from "../masterData/models";
import type { SlotId } from "../robotDesign/models";
import {
  DIRECTION_SCALE,
  directionUnitVector,
  roundDivision,
} from "./deterministicGeometry";
import type {
  CurrentAction,
  GameSession,
  MovementProgress,
  MovementRequest,
  RobotState,
} from "./models";
import type { SimulatorResult } from "./simulatorResult";

const movementError = <T>(message: string): SimulatorResult<T> => ({
  success: false,
  code: "inconsistent_session",
  message,
});

const checkedInt32 = (value: number): SimulatorResult<Int32> =>
  Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX
    ? { success: true, data: value as Int32 }
    : movementError("移動計算が符号付き32bit整数の範囲を超えました");

const resolveEquipment = (
  gameSession: GameSession,
  robot: RobotState,
  repository: DataRepository,
) => {
  const participant = gameSession.participants.find(
    ({ robotId }) => robotId === robot.id,
  );
  if (participant === undefined) return undefined;
  const body = repository.get(
    "robot_body",
    participant.robotDesign.bodyDefinitionId,
  );
  if (body === undefined) return undefined;
  const engineIds = body.slots
    .filter(({ category }) => category === "engine")
    .map(({ id }) => participant.robotDesign.equipment[id as SlotId])
    .filter((id) => id !== undefined);
  const engines = engineIds
    .map((id) => repository.get("engine", id))
    .filter((engine) => engine !== undefined);
  return engines.length === 1 ? { body, engine: engines[0]! } : undefined;
};

const isInsideMap = (
  position: Position,
  bodySize: { readonly width: Int32; readonly height: Int32 },
  mapSize: { readonly width: Int32; readonly height: Int32 },
): boolean => {
  const twiceX = position.x * 2;
  const twiceY = position.y * 2;
  const twiceWidth = mapSize.width * 2;
  const twiceHeight = mapSize.height * 2;
  return (
    [twiceX, twiceY, twiceWidth, twiceHeight].every(Number.isSafeInteger) &&
    twiceX - bodySize.width >= 0 &&
    twiceX + bodySize.width <= twiceWidth &&
    twiceY - bodySize.height >= 0 &&
    twiceY + bodySize.height <= twiceHeight
  );
};

const withMovement = (
  robot: RobotState,
  current: CurrentAction<MovementRequest, MovementProgress> | null,
  position: Position = robot.position,
  velocity: Position = robot.velocity,
  next: MovementRequest | null = robot.actionState.movement.next,
): RobotState => ({
  ...robot,
  position,
  velocity,
  actionState: {
    ...robot.actionState,
    movement: { current, next },
  },
});

const preparingNext = (
  request: MovementRequest | null,
): CurrentAction<MovementRequest, MovementProgress> | null =>
  request === null
    ? null
    : {
        request: { ...request },
        phase: "preparing",
        phaseElapsedTicks: 0 as Int32,
        progress: null,
      };

const finishMovement = (
  robot: RobotState,
  current: CurrentAction<MovementRequest, MovementProgress>,
  recoveryTicks: Int32,
  position: Position,
): RobotState => {
  const next = robot.actionState.movement.next;
  return recoveryTicks > 0
    ? withMovement(
        robot,
        {
          request: { ...current.request },
          phase: "recovering",
          phaseElapsedTicks: 0 as Int32,
          progress: null,
        },
        position,
        { x: 0 as Int32, y: 0 as Int32 },
      )
    : withMovement(
        robot,
        preparingNext(next),
        position,
        { x: 0 as Int32, y: 0 as Int32 },
        null,
      );
};

const movementTiming = (
  engine: EngineDefinition,
  request: MovementRequest,
): { readonly prepare: Int32; readonly recovery: Int32 } | null => {
  switch (request.type) {
    case "forward":
      return {
        prepare: engine.forwardPrepareTicks,
        recovery: engine.forwardRecoveryTicks,
      };
    case "turn_left":
    case "turn_right":
      return {
        prepare: engine.turnPrepareTicks,
        recovery: engine.turnRecoveryTicks,
      };
    default:
      return null;
  }
};

const beginAction = (
  robot: RobotState,
  current: NonNullable<RobotState["actionState"]["movement"]["current"]>,
): SimulatorResult<CurrentAction<MovementRequest, MovementProgress>> => {
  const fixedX = checkedInt32(robot.position.x * DIRECTION_SCALE);
  if (!fixedX.success) return fixedX;
  const fixedY = checkedInt32(robot.position.y * DIRECTION_SCALE);
  if (!fixedY.success) return fixedY;

  switch (current.request.type) {
    case "forward":
      return {
        success: true,
        data: {
          request: { ...current.request },
          phase: "executing",
          phaseElapsedTicks: 0 as Int32,
          progress: {
            type: "forward",
            fixedPosition: { x: fixedX.data, y: fixedY.data },
            fixedMovedDistance: 0 as Int32,
          },
        },
      };
    case "turn_left":
    case "turn_right":
      return {
        success: true,
        data: {
          request: { ...current.request },
          phase: "executing",
          phaseElapsedTicks: 0 as Int32,
          progress: { type: current.request.type },
        },
      };
    case "backward":
    case "strafe_left":
    case "strafe_right":
    case "stop":
      return movementError(
        `Phase 1で未対応のmovement要求です: ${current.request.type}`,
      );
  }
};

const updateForward = (
  robot: RobotState,
  current: Extract<
    CurrentAction<MovementRequest, MovementProgress>,
    { readonly phase: "executing" }
  >,
  speed: Int32,
  recoveryTicks: Int32,
  bodySize: { readonly width: Int32; readonly height: Int32 },
  mapSize: { readonly width: Int32; readonly height: Int32 },
): SimulatorResult<RobotState> => {
  if (
    current.request.type !== "forward" ||
    current.progress.type !== "forward"
  ) {
    return movementError("前進要求とMovement進捗が一致しません");
  }
  const targetDistance = current.request.distance * DIRECTION_SCALE;
  const remaining = targetDistance - current.progress.fixedMovedDistance;
  if (remaining <= 0 || speed <= 0) {
    return {
      success: true,
      data: finishMovement(robot, current, recoveryTicks, robot.position),
    };
  }

  const distanceThisTick = Math.min(speed, remaining / DIRECTION_SCALE);
  const unit = directionUnitVector(robot.direction);
  let fixedPosition = { ...current.progress.fixedPosition };
  let movedUnits = 0;
  let position = { ...robot.position };
  for (let unitIndex = 0; unitIndex < distanceThisTick; unitIndex += 1) {
    const fixedX = checkedInt32(fixedPosition.x + unit.x);
    if (!fixedX.success) return fixedX;
    const fixedY = checkedInt32(fixedPosition.y + unit.y);
    if (!fixedY.success) return fixedY;
    const x = roundDivision(fixedX.data, DIRECTION_SCALE);
    if (!x.success) return x;
    const y = roundDivision(fixedY.data, DIRECTION_SCALE);
    if (!y.success) return y;
    const candidate = { x: x.data, y: y.data };
    if (!isInsideMap(candidate, bodySize, mapSize)) break;
    fixedPosition = { x: fixedX.data, y: fixedY.data };
    position = candidate;
    movedUnits += 1;
  }

  const movedDistance = checkedInt32(
    current.progress.fixedMovedDistance + movedUnits * DIRECTION_SCALE,
  );
  if (!movedDistance.success) return movedDistance;
  const velocityX = checkedInt32(position.x - robot.position.x);
  if (!velocityX.success) return velocityX;
  const velocityY = checkedInt32(position.y - robot.position.y);
  if (!velocityY.success) return velocityY;
  const completed = movedDistance.data >= targetDistance || movedUnits === 0;
  const nextCurrent = completed
    ? null
    : ({
        ...current,
        phaseElapsedTicks: (current.phaseElapsedTicks + 1) as Int32,
        progress: {
          type: "forward",
          fixedPosition,
          fixedMovedDistance: movedDistance.data,
        },
      } satisfies CurrentAction<MovementRequest, MovementProgress>);

  return {
    success: true,
    data: completed
      ? finishMovement(robot, current, recoveryTicks, position)
      : withMovement(robot, nextCurrent, position, {
          x: velocityX.data,
          y: velocityY.data,
        }),
  };
};

const updateTurn = (
  robot: RobotState,
  current: Extract<
    CurrentAction<MovementRequest, MovementProgress>,
    { readonly phase: "executing" }
  >,
  turnSpeed: Int32,
  recoveryTicks: Int32,
): SimulatorResult<RobotState> => {
  if (
    (current.request.type !== "turn_left" &&
      current.request.type !== "turn_right") ||
    current.progress.type !== current.request.type
  ) {
    return movementError("旋回要求とMovement進捗が一致しません");
  }
  const remaining =
    current.request.type === "turn_right"
      ? normalizeAngle((current.request.turnTo - robot.direction) as Int32)
      : normalizeAngle((robot.direction - current.request.turnTo) as Int32);
  if (remaining === 0 || turnSpeed <= 0) {
    return {
      success: true,
      data: finishMovement(robot, current, recoveryTicks, robot.position),
    };
  }

  const turn = Math.min(remaining, turnSpeed) as Int32;
  const signedTurn =
    current.request.type === "turn_right"
      ? turn
      : ((0 - Number(turn)) as Int32);
  const direction = normalizeAngle((robot.direction + signedTurn) as Int32);
  const completed = turn === remaining;
  return {
    success: true,
    data: {
      ...(completed
        ? finishMovement(robot, current, recoveryTicks, robot.position)
        : withMovement(
            robot,
            {
              ...current,
              phaseElapsedTicks: (current.phaseElapsedTicks + 1) as Int32,
            },
            robot.position,
            { x: 0 as Int32, y: 0 as Int32 },
          )),
      direction,
    },
  };
};

/** Phase 1のMove ForwardまたはTurnを1 Tick進める。 */
export const updateMovementAction = (
  gameSession: GameSession,
  robot: RobotState,
  repository: DataRepository,
): SimulatorResult<RobotState> => {
  const current = robot.actionState.movement.current;
  if (current === null) return { success: true, data: robot };
  const equipment = resolveEquipment(gameSession, robot, repository);
  const map = repository.get("map", gameSession.mapId);
  if (equipment === undefined || map === undefined) {
    return movementError(
      `Robot ${robot.id}のEngine、Body、またはMapを解決できません`,
    );
  }
  const timing = movementTiming(equipment.engine, current.request);
  if (timing === null) {
    return movementError(
      `Phase 1で未対応のmovement要求です: ${current.request.type}`,
    );
  }
  if (current.phase === "recovering") {
    const next = robot.actionState.movement.next;
    if (timing.recovery === 0) {
      const promoted = withMovement(
        robot,
        preparingNext(next),
        robot.position,
        { x: 0 as Int32, y: 0 as Int32 },
        null,
      );
      return next === null
        ? { success: true, data: promoted }
        : updateMovementAction(gameSession, promoted, repository);
    }
    const elapsed = checkedInt32(current.phaseElapsedTicks + 1);
    if (!elapsed.success) return elapsed;
    return {
      success: true,
      data:
        elapsed.data >= timing.recovery
          ? withMovement(
              robot,
              preparingNext(next),
              robot.position,
              { x: 0 as Int32, y: 0 as Int32 },
              null,
            )
          : withMovement(
              robot,
              { ...current, phaseElapsedTicks: elapsed.data },
              robot.position,
              { x: 0 as Int32, y: 0 as Int32 },
            ),
    };
  }
  if (
    current.phase === "preparing" &&
    current.phaseElapsedTicks < timing.prepare
  ) {
    const elapsed = checkedInt32(current.phaseElapsedTicks + 1);
    if (!elapsed.success) return elapsed;
    return {
      success: true,
      data: withMovement(robot, {
        ...current,
        phaseElapsedTicks: elapsed.data,
      }),
    };
  }
  const executing =
    current.phase === "preparing" ? beginAction(robot, current) : null;
  if (executing !== null && !executing.success) return executing;
  const action = executing?.data ?? current;
  if (action.phase !== "executing") {
    return movementError("Phase 1のmovement行動を実動作へ遷移できません");
  }
  return action.request.type === "forward"
    ? updateForward(
        robot,
        action,
        equipment.engine.maxForwardSpeed,
        timing.recovery,
        equipment.body.size,
        map.size,
      )
    : updateTurn(
        robot,
        action,
        equipment.engine.turnSpeedDegree,
        timing.recovery,
      );
};
