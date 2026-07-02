import { normalizeAngle, type FormatVersion, type Int32 } from "../data/common";
import { loadJsonEnvelope, saveJsonEnvelope } from "../data/jsonEnvelope";
import type { DataValidationError, LoadResult } from "../data/loadResult";
import type { DataRepository } from "../masterData/repository";
import { canonicalizeProgram } from "../program/codec";
import {
  canonicalizeRobotDesign,
  validateRobotDesignReferences,
} from "../robotDesign/codec";
import type {
  CombatRequest,
  MovementRequest,
  RobotState,
  WorldState,
} from "../runtime/models";
import type { BulletState } from "../runtime/models";
import type { ReplayEvent, ReplaySaveData } from "./models";
import { replaySaveDataValidator } from "./schema";

const compareIds = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const validationError = (
  code: string,
  path: string,
  message: string,
  actualValue: unknown,
  expected: string,
): DataValidationError => ({ code, path, message, actualValue, expected });

const canonicalizeMovementRequest = (
  request: MovementRequest | null,
): MovementRequest | null =>
  request?.type === "turn_left" || request?.type === "turn_right"
    ? { ...request, turnTo: normalizeAngle(request.turnTo) }
    : request;

const canonicalizeCombatRequest = (
  request: CombatRequest | null,
): CombatRequest | null =>
  request?.type === "fire"
    ? {
        ...request,
        targetDirection: normalizeAngle(request.targetDirection),
      }
    : request;

const canonicalizeRobotState = (robot: RobotState): RobotState => ({
  ...robot,
  direction: normalizeAngle(robot.direction),
  actionRequests: {
    movement: canonicalizeMovementRequest(robot.actionRequests.movement),
    combat: canonicalizeCombatRequest(robot.actionRequests.combat),
  },
});

const canonicalizeWorldState = (worldState: WorldState): WorldState => ({
  ...worldState,
  robots: worldState.robots.map(canonicalizeRobotState),
});

const canonicalizeEvent = (event: ReplayEvent): ReplayEvent => {
  if (event.type === "robot_updated") {
    return { ...event, robot: canonicalizeRobotState(event.robot) };
  }
  return event;
};

const canonicalizeReplaySaveData = (data: ReplaySaveData): ReplaySaveData => ({
  ...data,
  replayData: {
    ...data.replayData,
    initialWorldState: canonicalizeWorldState(
      data.replayData.initialWorldState,
    ),
    frames: data.replayData.frames.map((frame) => ({
      ...frame,
      events: frame.events.map(canonicalizeEvent),
    })),
  },
  robotDesigns: [...data.robotDesigns]
    .sort((left, right) => compareIds(left.id, right.id))
    .map(canonicalizeRobotDesign),
  programs: [...data.programs]
    .sort((left, right) => compareIds(left.id, right.id))
    .map(canonicalizeProgram),
});

const validateFrameOrder = (data: ReplaySaveData): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  let previousTick: Int32 | undefined;
  data.replayData.frames.forEach((frame, index) => {
    const minimumTick = previousTick ?? data.replayData.initialWorldState.tick;
    if (frame.tick <= minimumTick) {
      errors.push(
        validationError(
          "invalid_replay_tick_order",
          `/replayData/frames/${index}/tick`,
          "Replay FrameのTickが昇順ではありません",
          frame.tick,
          `${minimumTick}より大きいTick`,
        ),
      );
    }
    previousTick = frame.tick;
  });
  return errors;
};

const validateUniqueIds = (
  ids: readonly string[],
  path: string,
): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      errors.push(
        validationError(
          "duplicate_replay_id",
          `${path}/${index}`,
          "Replay保存データ内でIDが重複しています",
          id,
          "配列内で一意なID",
        ),
      );
    }
    seen.add(id);
  });
  return errors;
};

const validateBulletLifecycle = (
  data: ReplaySaveData,
): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  const initialBullets = data.replayData.initialWorldState.bullets;
  const seenBulletIds = new Set(initialBullets.map(({ id }) => id));
  const liveBullets = new Map(
    initialBullets.map((bullet) => [bullet.id, bullet] as const),
  );

  data.replayData.frames.forEach((frame, frameIndex) => {
    frame.events.forEach((event, eventIndex) => {
      const eventPath = `/replayData/frames/${frameIndex}/events/${eventIndex}`;
      if (event.type === "bullet_created") {
        if (seenBulletIds.has(event.bullet.id)) {
          errors.push(
            validationError(
              "duplicate_replay_bullet_create",
              `${eventPath}/bullet/id`,
              "発番済みのBullet IDは再利用できません",
              event.bullet.id,
              "Replay内で未発番のBullet ID",
            ),
          );
          return;
        }
        seenBulletIds.add(event.bullet.id);
        liveBullets.set(event.bullet.id, event.bullet);
        return;
      }
      if (event.type === "bullet_updated") {
        const currentBullet = liveBullets.get(event.bullet.id);
        if (currentBullet === undefined) {
          errors.push(
            validationError(
              "unknown_replay_bullet_update",
              `${eventPath}/bullet/id`,
              "存在しないBulletは更新できません",
              event.bullet.id,
              "現在のWorld Stateに存在するBullet ID",
            ),
          );
          return;
        }
        if (
          event.bullet.ownerRobotId !== currentBullet.ownerRobotId ||
          event.bullet.weaponId !== currentBullet.weaponId ||
          event.bullet.projectileId !== currentBullet.projectileId
        ) {
          errors.push(
            validationError(
              "replay_bullet_reference_changed",
              `${eventPath}/bullet`,
              "Bullet生成時の参照は変更できません",
              {
                ownerRobotId: event.bullet.ownerRobotId,
                weaponId: event.bullet.weaponId,
                projectileId: event.bullet.projectileId,
              },
              `ownerRobotId=${currentBullet.ownerRobotId}, weaponId=${currentBullet.weaponId}, projectileId=${currentBullet.projectileId}`,
            ),
          );
          return;
        }
        liveBullets.set(event.bullet.id, event.bullet);
        return;
      }
      if (event.type === "bullet_removed") {
        if (!liveBullets.has(event.bulletId)) {
          errors.push(
            validationError(
              "unknown_replay_bullet_remove",
              `${eventPath}/bulletId`,
              "存在しないBulletは削除できません",
              event.bulletId,
              "現在のWorld Stateに存在するBullet ID",
            ),
          );
          return;
        }
        liveBullets.delete(event.bulletId);
      }
    });
  });
  return errors;
};

const validateBulletReference = (
  bullet: BulletState,
  path: string,
  repository: DataRepository,
  robotIds: ReadonlySet<string>,
): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  if (!robotIds.has(bullet.ownerRobotId)) {
    errors.push(
      validationError(
        "missing_replay_bullet_owner",
        `${path}/ownerRobotId`,
        "Bulletの発射元RobotがReplayの初期World Stateに存在しません",
        bullet.ownerRobotId,
        "初期World Stateに存在するRobot ID",
      ),
    );
  }
  const weapon = repository.get("weapon", bullet.weaponId);
  if (weapon === undefined) {
    errors.push(
      validationError(
        "missing_replay_weapon",
        `${path}/weaponId`,
        "Weapon Definitionが存在しません",
        bullet.weaponId,
        "存在するWeapon Definition ID",
      ),
    );
  }
  if (repository.get("projectile", bullet.projectileId) === undefined) {
    errors.push(
      validationError(
        "missing_replay_projectile",
        `${path}/projectileId`,
        "Projectile Definitionが存在しません",
        bullet.projectileId,
        "存在するProjectile Definition ID",
      ),
    );
  }
  if (weapon !== undefined && weapon.projectileId !== bullet.projectileId) {
    errors.push(
      validationError(
        "replay_projectile_mismatch",
        `${path}/projectileId`,
        "Weaponが参照するProjectileと一致しません",
        bullet.projectileId,
        weapon.projectileId,
      ),
    );
  }
  return errors;
};

const validateReferences = (
  data: ReplaySaveData,
  repository: DataRepository,
): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  errors.push(
    ...validateUniqueIds(
      data.robotDesigns.map(({ id }) => id),
      "/robotDesigns",
    ),
    ...validateUniqueIds(
      data.programs.map(({ id }) => id),
      "/programs",
    ),
    ...validateUniqueIds(
      data.replayData.initialWorldState.robots.map(({ id }) => id),
      "/replayData/initialWorldState/robots",
    ),
    ...validateUniqueIds(
      data.replayData.initialWorldState.bullets.map(({ id }) => id),
      "/replayData/initialWorldState/bullets",
    ),
  );
  if (repository.get("map", data.mapId) === undefined) {
    errors.push(
      validationError(
        "missing_replay_map",
        "/mapId",
        "Map Definitionが存在しません",
        data.mapId,
        "存在するMap Definition ID",
      ),
    );
  }
  if (repository.get("game_rule", data.gameRuleId) === undefined) {
    errors.push(
      validationError(
        "missing_replay_game_rule",
        "/gameRuleId",
        "Game Rule Definitionが存在しません",
        data.gameRuleId,
        "存在するGame Rule Definition ID",
      ),
    );
  }

  const designIds = new Set(data.robotDesigns.map(({ id }) => id));
  const programIds = new Set(data.programs.map(({ id }) => id));
  const robotIds = new Set(
    data.replayData.initialWorldState.robots.map(({ id }) => id),
  );
  data.robotDesigns.forEach((design, index) => {
    errors.push(
      ...validateRobotDesignReferences(design, repository).map((error) => ({
        ...error,
        path: `/robotDesigns/${index}${error.path}`,
      })),
    );
    if (!programIds.has(design.programId)) {
      errors.push(
        validationError(
          "missing_replay_program",
          `/robotDesigns/${index}/programId`,
          "RobotDesignが参照するProgramが保存されていません",
          design.programId,
          "Replay保存データ内のProgram ID",
        ),
      );
    }
  });
  data.replayData.initialWorldState.robots.forEach((robot, index) => {
    if (!designIds.has(robot.robotDesignId)) {
      errors.push(
        validationError(
          "missing_replay_robot_design",
          `/replayData/initialWorldState/robots/${index}/robotDesignId`,
          "Robot状態が参照するRobotDesignが保存されていません",
          robot.robotDesignId,
          "Replay保存データ内のRobotDesign ID",
        ),
      );
    }
  });
  data.replayData.initialWorldState.bullets.forEach((bullet, index) => {
    errors.push(
      ...validateBulletReference(
        bullet,
        `/replayData/initialWorldState/bullets/${index}`,
        repository,
        robotIds,
      ),
    );
  });
  data.replayData.frames.forEach((frame, frameIndex) => {
    frame.events.forEach((event, eventIndex) => {
      const eventPath = `/replayData/frames/${frameIndex}/events/${eventIndex}`;
      if (event.type === "robot_updated") {
        if (!robotIds.has(event.robot.id)) {
          errors.push(
            validationError(
              "missing_replay_robot",
              `${eventPath}/robot/id`,
              "更新対象RobotがReplayの初期World Stateに存在しません",
              event.robot.id,
              "初期World Stateに存在するRobot ID",
            ),
          );
        }
        if (!designIds.has(event.robot.robotDesignId)) {
          errors.push(
            validationError(
              "missing_replay_robot_design",
              `${eventPath}/robot/robotDesignId`,
              "Robot状態が参照するRobotDesignが保存されていません",
              event.robot.robotDesignId,
              "Replay保存データ内のRobotDesign ID",
            ),
          );
        }
      }
      if (event.type === "bullet_created" || event.type === "bullet_updated") {
        errors.push(
          ...validateBulletReference(
            event.bullet,
            `${eventPath}/bullet`,
            repository,
            robotIds,
          ),
        );
      }
    });
  });
  return errors;
};

/** `spec/13_data_ownership.md`に従いReplay保存データをJSONへ保存する。 */
export const saveReplay = (data: ReplaySaveData): string =>
  saveJsonEnvelope("replay", canonicalizeReplaySaveData(data));

/** `spec/13_data_ownership.md`に従いReplay JSONと参照を検証する。 */
export const loadReplay = (
  value: string,
  currentMasterDataVersion: FormatVersion,
  repository: DataRepository,
): LoadResult<ReplaySaveData> => {
  const loaded = loadJsonEnvelope(value, "replay", replaySaveDataValidator);
  if (!loaded.success) return loaded;

  const data = loaded.data.payload;
  const errors = [
    ...validateFrameOrder(data),
    ...validateBulletLifecycle(data),
    ...validateReferences(data, repository),
  ];
  if (data.masterDataVersion !== currentMasterDataVersion) {
    errors.push(
      validationError(
        "master_data_version_mismatch",
        "/masterDataVersion",
        "Master Data versionが現在値と一致しません",
        data.masterDataVersion,
        currentMasterDataVersion,
      ),
    );
  }
  if (errors.length > 0) return { success: false, errors };
  return { success: true, data };
};
