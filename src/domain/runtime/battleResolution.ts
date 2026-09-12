import {
  INT32_MAX,
  INT32_MIN,
  type Int32,
  type Position,
  type Size,
} from "../data/common";
import type { DataRepository } from "../masterData/repository";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
} from "./factories";
import type {
  BulletId,
  BulletState,
  GameSession,
  RobotState,
  WorldState,
} from "./models";
import type { SimulatorResult } from "./simulatorResult";

const resolutionError = <T>(message: string): SimulatorResult<T> => ({
  success: false,
  code: "inconsistent_session",
  message,
});

const checkedInt32 = (value: number): SimulatorResult<Int32> =>
  Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX
    ? { success: true, data: value as Int32 }
    : resolutionError("戦闘計算が符号付き32bit整数の範囲を超えました");

const bulletSequence = (id: BulletId): number =>
  Number.parseInt(id.slice("bullet_".length), 10);

const overlaps = (
  leftPosition: Position,
  leftSize: Size,
  rightPosition: Position,
  rightSize: Size,
): boolean => {
  const leftX = leftPosition.x * 2;
  const leftY = leftPosition.y * 2;
  const rightX = rightPosition.x * 2;
  const rightY = rightPosition.y * 2;
  const values = [leftX, leftY, rightX, rightY];
  return (
    values.every(Number.isSafeInteger) &&
    Math.abs(leftX - rightX) < leftSize.width + rightSize.width &&
    Math.abs(leftY - rightY) < leftSize.height + rightSize.height
  );
};

const resolveRobotBody = (
  gameSession: GameSession,
  robot: RobotState,
  repository: DataRepository,
) => {
  const participant = gameSession.participants.find(
    ({ robotId }) => robotId === robot.id,
  );
  return participant === undefined
    ? undefined
    : repository.get("robot_body", participant.robotDesign.bodyDefinitionId);
};

const isOutsideMap = (position: Position, mapSize: Size): boolean =>
  position.x < 0 ||
  position.x > mapSize.width ||
  position.y < 0 ||
  position.y > mapSize.height;

type BulletUpdate = {
  readonly bullets: readonly BulletState[];
  readonly damageByRobot: ReadonlyMap<RobotState["id"], Int32>;
};

const updateExistingBullets = (
  gameSession: GameSession,
  worldState: WorldState,
  tickStartBulletIds: ReadonlySet<BulletId>,
  repository: DataRepository,
): SimulatorResult<BulletUpdate> => {
  const map = repository.get("map", gameSession.mapId);
  if (map === undefined) return resolutionError("Mapを解決できません");

  const damageByRobot = new Map<RobotState["id"], Int32>();
  const updatedBullets: BulletState[] = [];
  const existing = worldState.bullets
    .filter(({ id }) => tickStartBulletIds.has(id))
    .sort((left, right) => bulletSequence(left.id) - bulletSequence(right.id));
  const created = worldState.bullets.filter(
    ({ id }) => !tickStartBulletIds.has(id),
  );

  for (const bullet of existing) {
    const weapon = repository.get("weapon", bullet.weaponId);
    const projectile = repository.get("projectile", bullet.projectileId);
    if (
      weapon === undefined ||
      projectile === undefined ||
      weapon.projectileId !== projectile.id
    ) {
      return resolutionError(`Bullet ${bullet.id}の参照を解決できません`);
    }
    if (bullet.remainingLifetimeTicks <= 0) {
      return resolutionError(`Bullet ${bullet.id}の残り寿命が不正です`);
    }
    const x = checkedInt32(bullet.position.x + bullet.vector.x);
    if (!x.success) return x;
    const y = checkedInt32(bullet.position.y + bullet.vector.y);
    if (!y.success) return y;
    const moved: BulletState = {
      ...bullet,
      position: { x: x.data, y: y.data },
      remainingLifetimeTicks: (bullet.remainingLifetimeTicks - 1) as Int32,
    };

    let hitRobot: RobotState | undefined;
    for (const participant of gameSession.participants) {
      const target = worldState.robots.find(
        ({ id }) => id === participant.robotId,
      );
      if (
        target === undefined ||
        target.id === bullet.ownerRobotId ||
        target.status !== "active"
      ) {
        continue;
      }
      const body = resolveRobotBody(gameSession, target, repository);
      if (body === undefined) {
        return resolutionError(`Robot ${target.id}のBodyを解決できません`);
      }
      if (
        overlaps(moved.position, projectile.size, target.position, body.size)
      ) {
        hitRobot = target;
        break;
      }
    }

    if (hitRobot !== undefined) {
      const total = checkedInt32(
        (damageByRobot.get(hitRobot.id) ?? 0) + weapon.damage,
      );
      if (!total.success) return total;
      damageByRobot.set(hitRobot.id, total.data);
      continue;
    }
    if (
      moved.remainingLifetimeTicks === 0 ||
      isOutsideMap(moved.position, map.size)
    ) {
      continue;
    }
    updatedBullets.push(moved);
  }

  return {
    success: true,
    data: {
      bullets: [...updatedBullets, ...created].sort(
        (left, right) => bulletSequence(left.id) - bulletSequence(right.id),
      ),
      damageByRobot,
    },
  };
};

const applyDamage = (
  robots: readonly RobotState[],
  damageByRobot: ReadonlyMap<RobotState["id"], Int32>,
): readonly RobotState[] =>
  robots.map((robot) => {
    const damage = damageByRobot.get(robot.id) ?? (0 as Int32);
    if (damage === 0 || robot.status === "destroyed") return robot;
    const currentHp = Math.max(0, robot.currentHp - damage) as Int32;
    return currentHp > 0
      ? { ...robot, currentHp }
      : {
          ...robot,
          currentHp,
          status: "destroyed",
          velocity: { x: 0 as Int32, y: 0 as Int32 },
          actionRequests: createEmptyActionRequests(),
          actionState: createEmptyRobotActionState(),
        };
  });

const finishBattle = (
  gameSession: GameSession,
  worldState: WorldState,
  tickLimit: Int32,
): WorldState => {
  if (worldState.tick >= tickLimit) {
    return {
      ...worldState,
      status: "finished",
      result: { winnerRobotIds: [], reason: "tick_limit" },
    };
  }
  if (worldState.bullets.length > 0) return worldState;

  const destroyed = gameSession.participants.filter(({ robotId }) =>
    worldState.robots.some(
      (robot) => robot.id === robotId && robot.status === "destroyed",
    ),
  );
  if (destroyed.length === gameSession.participants.length) {
    return {
      ...worldState,
      status: "finished",
      result: { winnerRobotIds: [], reason: "mutual_destruction" },
    };
  }
  if (destroyed.length === 1) {
    return {
      ...worldState,
      status: "finished",
      result: {
        winnerRobotIds: gameSession.participants
          .map(({ robotId }) => robotId)
          .filter((robotId) => robotId !== destroyed[0]!.robotId),
        reason: "opponent_destroyed",
      },
    };
  }
  return worldState;
};

/** 既存Bullet、Damage、Tick増加、Phase 1勝敗判定を順に確定する。 */
export const resolveBattleTick = (
  gameSession: GameSession,
  workingWorldState: WorldState,
  tickStartBulletIds: ReadonlySet<BulletId>,
  repository: DataRepository,
): SimulatorResult<WorldState> => {
  const gameRule = repository.get("game_rule", gameSession.gameRuleId);
  if (gameRule === undefined)
    return resolutionError("Game Ruleを解決できません");
  if (workingWorldState.tick >= INT32_MAX) {
    return {
      success: false,
      code: "tick_overflow",
      message: "Tickが符号付き32bit整数の上限を超えます",
    };
  }
  const bulletUpdate = updateExistingBullets(
    gameSession,
    workingWorldState,
    tickStartBulletIds,
    repository,
  );
  if (!bulletUpdate.success) return bulletUpdate;
  const nextWorld: WorldState = {
    ...workingWorldState,
    tick: (workingWorldState.tick + 1) as Int32,
    robots: applyDamage(
      workingWorldState.robots,
      bulletUpdate.data.damageByRobot,
    ),
    bullets: bulletUpdate.data.bullets,
  };
  return {
    success: true,
    data: finishBattle(gameSession, nextWorld, gameRule.tickLimit),
  };
};
