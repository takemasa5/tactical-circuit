import type { Int32 } from "../data/common";
import {
  cloneCombatRequest,
  cloneMovementRequest,
  createEmptyRobotActionState,
} from "./factories";
import type {
  ActionCategoryState,
  ActionRequests,
  ActionStatusSnapshot,
  CombatProgress,
  CombatRequest,
  CurrentAction,
  MovementProgress,
  MovementRequest,
  RobotActionState,
} from "./models";
import type { SimulatorResult } from "./simulatorResult";

type CloneRequest<TRequest> = (request: TRequest | null) => TRequest | null;
type SameRequest<TRequest> = (left: TRequest, right: TRequest) => boolean;

const zeroTicks = 0 as Int32;

const createPreparingAction = <TRequest, TProgress>(
  request: TRequest,
  cloneRequest: CloneRequest<TRequest>,
): CurrentAction<TRequest, TProgress> => ({
  request: cloneRequest(request) as TRequest,
  phase: "preparing",
  phaseElapsedTicks: zeroTicks,
  progress: null,
});

const cloneActionCategoryState = <TRequest, TProgress>(
  state: ActionCategoryState<TRequest, TProgress>,
  cloneRequest: CloneRequest<TRequest>,
): ActionCategoryState<TRequest, TProgress> => ({
  current:
    state.current === null
      ? null
      : {
          ...state.current,
          request: cloneRequest(state.current.request) as TRequest,
        },
  next: cloneRequest(state.next),
});

const movementRequestsAreSame: SameRequest<MovementRequest> = (left, right) => {
  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case "forward":
    case "backward":
    case "turn_left":
    case "turn_right":
    case "strafe_left":
    case "strafe_right":
    case "stop":
      return true;
  }
};

const combatRequestsAreSame: SameRequest<CombatRequest> = (left, right) => {
  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case "switch_weapon":
      return right.type === "switch_weapon" && left.hand === right.hand;
    case "fire":
      return (
        right.type === "fire" &&
        left.targetDirection === right.targetDirection &&
        left.targetPosition.x === right.targetPosition.x &&
        left.targetPosition.y === right.targetPosition.y
      );
    case "melee":
      return true;
  }
};

const arbitrateCategory = <TRequest, TProgress>(
  state: ActionCategoryState<TRequest, TProgress>,
  request: TRequest | null,
  cloneRequest: CloneRequest<TRequest>,
  sameRequest: SameRequest<TRequest>,
): SimulatorResult<ActionCategoryState<TRequest, TProgress>> => {
  if (request === null) {
    return {
      success: true,
      data: cloneActionCategoryState(state, cloneRequest),
    };
  }

  if (state.current === null) {
    return {
      success: true,
      data: {
        current: createPreparingAction(request, cloneRequest),
        next: cloneRequest(state.next),
      },
    };
  }

  if (state.current.phase !== "preparing") {
    return {
      success: true,
      data: cloneActionCategoryState(state, cloneRequest),
    };
  }

  if (sameRequest(state.current.request, request)) {
    return {
      success: true,
      data: cloneActionCategoryState(state, cloneRequest),
    };
  }

  return {
    success: true,
    data: {
      current: createPreparingAction(request, cloneRequest),
      next: cloneRequest(state.next),
    },
  };
};

/** `docs/specs/current/simulator/action_arbitration.md`のカテゴリ別行動要求調停。 */
export const arbitrateRobotActionRequests = (
  actionState: RobotActionState,
  actionRequests: ActionRequests,
): SimulatorResult<RobotActionState> => {
  const movement = arbitrateCategory<MovementRequest, MovementProgress>(
    actionState.movement,
    actionRequests.movement,
    cloneMovementRequest,
    movementRequestsAreSame,
  );
  if (!movement.success) {
    return movement;
  }

  const combat = arbitrateCategory<CombatRequest, CombatProgress>(
    actionState.combat,
    actionRequests.combat,
    cloneCombatRequest,
    combatRequestsAreSame,
  );
  if (!combat.success) {
    return combat;
  }

  return {
    success: true,
    data: {
      movement: movement.data,
      combat: combat.data,
    },
  };
};

const categoryStatus = <TRequest, TProgress>(
  state: ActionCategoryState<TRequest, TProgress>,
): "idle" | "running" =>
  state.current === null && state.next === null ? "idle" : "running";

/** Tick開始時にAI Engineへ公開するカテゴリ別のidle/runningだけを生成する。 */
export const createActionStatusSnapshot = (
  actionState: RobotActionState = createEmptyRobotActionState(),
): ActionStatusSnapshot => ({
  movement: categoryStatus(actionState.movement),
  combat: categoryStatus(actionState.combat),
});
