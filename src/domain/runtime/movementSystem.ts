import {
  INT32_MAX,
  INT32_MIN,
  normalizeAngle,
  type Int32,
  type Position,
} from "../data/common";
import type { DataRepository } from "../masterData/repository";
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
): RobotState => ({
  ...robot,
  position,
  velocity,
  actionState: {
    ...robot.actionState,
    movement: { current, next: null },
  },
});

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
      data: withMovement(robot, null, robot.position, {
        x: 0 as Int32,
        y: 0 as Int32,
      }),
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
    data: withMovement(
      robot,
      nextCurrent,
      position,
      completed
        ? { x: 0 as Int32, y: 0 as Int32 }
        : { x: velocityX.data, y: velocityY.data },
    ),
  };
};

const updateTurn = (
  robot: RobotState,
  current: Extract<
    CurrentAction<MovementRequest, MovementProgress>,
    { readonly phase: "executing" }
  >,
  turnSpeed: Int32,
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
      data: withMovement(robot, null, robot.position, {
        x: 0 as Int32,
        y: 0 as Int32,
      }),
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
      ...withMovement(
        robot,
        completed
          ? null
          : {
              ...current,
              phaseElapsedTicks: (current.phaseElapsedTicks + 1) as Int32,
            },
        robot.position,
        { x: 0 as Int32, y: 0 as Int32 },
      ),
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
  if (current.phase === "recovering") {
    return movementError("Phase 1のmovement行動はrecoveringを保持しません");
  }
  const equipment = resolveEquipment(gameSession, robot, repository);
  const map = repository.get("map", gameSession.mapId);
  if (equipment === undefined || map === undefined) {
    return movementError(
      `Robot ${robot.id}のEngine、Body、またはMapを解決できません`,
    );
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
        equipment.body.size,
        map.size,
      )
    : updateTurn(robot, action, equipment.engine.turnSpeedDegree);
};
