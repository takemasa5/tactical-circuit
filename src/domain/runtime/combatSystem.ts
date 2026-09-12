import { INT32_MAX, type Int32 } from "../data/common";
import type { DataRepository } from "../masterData/repository";
import type { SlotId } from "../robotDesign/models";
import { scaleDirectionVector } from "./deterministicGeometry";
import { createBulletId } from "./factories";
import type { BulletState, GameSession, RobotState } from "./models";
import type { SimulatorResult } from "./simulatorResult";

export type CombatActionUpdate = {
  readonly robot: RobotState;
  readonly createdBullet: BulletState | null;
  readonly nextBulletSequence: Int32;
};

const combatError = <T>(message: string): SimulatorResult<T> => ({
  success: false,
  code: "inconsistent_session",
  message,
});

const resolveWeapon = (
  gameSession: GameSession,
  robot: RobotState,
  repository: DataRepository,
) => {
  const participant = gameSession.participants.find(
    ({ robotId }) => robotId === robot.id,
  );
  const slotId = robot.selectedWeaponSlotId;
  if (participant === undefined || slotId === null) return undefined;
  const weaponId = participant.robotDesign.equipment[slotId as SlotId];
  if (weaponId === undefined) return undefined;
  const weapon = repository.get("weapon", weaponId);
  if (weapon === undefined) return undefined;
  const projectile = repository.get("projectile", weapon.projectileId);
  return projectile === undefined ? undefined : { slotId, weapon, projectile };
};

const withCombatState = (
  robot: RobotState,
  current: RobotState["actionState"]["combat"]["current"],
  ammunition: RobotState["ammunition"] = robot.ammunition,
): RobotState => ({
  ...robot,
  ammunition,
  actionState: {
    ...robot.actionState,
    combat: { current, next: null },
  },
});

/** Phase 1のFireと発射間隔を1 Tick進める。 */
export const updateCombatAction = (
  gameSession: GameSession,
  robot: RobotState,
  nextBulletSequence: Int32,
  repository: DataRepository,
): SimulatorResult<CombatActionUpdate> => {
  const current = robot.actionState.combat.current;
  if (current === null) {
    return {
      success: true,
      data: { robot, createdBullet: null, nextBulletSequence },
    };
  }
  if (current.request.type !== "fire") {
    return combatError(
      `Phase 1で未対応のcombat要求です: ${current.request.type}`,
    );
  }
  const equipped = resolveWeapon(gameSession, robot, repository);
  if (equipped === undefined) {
    return combatError(
      `Robot ${robot.id}の選択中WeaponまたはProjectileを解決できません`,
    );
  }
  if (current.phase === "executing") {
    return combatError("Phase 1のcombat行動はexecutingを保持しません");
  }

  if (current.phase === "recovering") {
    const elapsed = current.phaseElapsedTicks + 1;
    if (elapsed > INT32_MAX) {
      return combatError("combat行動の経過Tickが上限を超えました");
    }
    const completed = elapsed >= equipped.weapon.fireIntervalTicks;
    return {
      success: true,
      data: {
        robot: withCombatState(
          robot,
          completed
            ? null
            : { ...current, phaseElapsedTicks: elapsed as Int32 },
        ),
        createdBullet: null,
        nextBulletSequence,
      },
    };
  }

  const ammunition = robot.ammunition[equipped.slotId] ?? (0 as Int32);
  const nextCurrent =
    equipped.weapon.fireIntervalTicks <= 1
      ? null
      : {
          request: {
            ...current.request,
            targetPosition: { ...current.request.targetPosition },
          },
          phase: "recovering" as const,
          phaseElapsedTicks: 1 as Int32,
          progress: null,
        };
  if (ammunition <= 0) {
    return {
      success: true,
      data: {
        robot: withCombatState(robot, nextCurrent),
        createdBullet: null,
        nextBulletSequence,
      },
    };
  }
  if (nextBulletSequence >= INT32_MAX) {
    return combatError("Bullet IDの発番値が上限へ到達しました");
  }
  const vector = scaleDirectionVector(
    current.request.targetDirection,
    equipped.projectile.speed,
  );
  if (!vector.success) return vector;
  const createdBullet: BulletState = {
    id: createBulletId(nextBulletSequence),
    ownerRobotId: robot.id,
    weaponId: equipped.weapon.id,
    projectileId: equipped.projectile.id,
    position: { ...robot.position },
    vector: vector.data,
    remainingLifetimeTicks: equipped.weapon.lifetimeTicks,
  };
  return {
    success: true,
    data: {
      robot: withCombatState(robot, nextCurrent, {
        ...robot.ammunition,
        [equipped.slotId]: (ammunition - 1) as Int32,
      }),
      createdBullet,
      nextBulletSequence: (nextBulletSequence + 1) as Int32,
    },
  };
};
