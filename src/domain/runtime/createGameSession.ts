import { CURRENT_FORMAT_VERSION, type Int32 } from "../data/common";
import type { DataValidationError, LoadResult } from "../data/loadResult";
import type { MapId, GameRuleId } from "../masterData/models";
import type { DataRepository } from "../masterData/repository";
import type { ParameterValue, Program } from "../program/models";
import {
  resolveInitialWeaponSlotId,
  validateRobotDesignReferences,
} from "../robotDesign/codec";
import type { RobotDesign, SlotId } from "../robotDesign/models";
import { validateProgram } from "../validator/validateProgram";
import {
  createEmptyActionRequests,
  createEmptyRobotActionState,
  createInitialAIRuntimeState,
  createRuntimeRobotId,
} from "./factories";
import { initializeRandomState } from "./random";
import type { GameSession, RobotState } from "./models";

/** Phase 5のGame Session生成へ渡す参加者データ。 */
export type GameSessionCreationParticipant = {
  readonly robotDesign: RobotDesign;
  readonly program: Program;
};

/** Phase 5のGame Session生成に必要な明示入力。 */
export type GameSessionCreationInput = {
  readonly participants: readonly GameSessionCreationParticipant[];
  readonly mapId: MapId;
  readonly gameRuleId: GameRuleId;
  readonly initialRandomSeed: Int32;
  readonly repository: DataRepository;
};

const validationError = (
  code: string,
  path: string,
  message: string,
  actualValue: unknown,
  expected: string,
): DataValidationError => ({ code, path, message, actualValue, expected });

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const clone = <T>(value: T): T => structuredClone(value);

const prefixErrorPath = (
  error: DataValidationError,
  prefix: string,
): DataValidationError => ({
  ...error,
  path: `${prefix}${error.path}`,
});

const validateGameRuleReferences = (
  program: Program,
  repository: DataRepository,
  registerNames: ReadonlySet<string>,
  flagNames: ReadonlySet<string>,
  participantPath: string,
): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  const validateReference = (value: ParameterValue, path: string): void => {
    if (typeof value !== "object" || value === null) return;
    if (
      (value.type === "register_reference" &&
        !registerNames.has(value.registerName)) ||
      (value.type === "memory_reference" &&
        !registerNames.has(value.indexRegisterName))
    ) {
      errors.push(
        validationError(
          "unknown_game_rule_register",
          path,
          "Game Ruleに存在しないレジスタを参照しています",
          value,
          "Game Ruleに定義されたレジスタ名",
        ),
      );
    } else if (
      value.type === "flag_reference" &&
      !flagNames.has(value.flagName)
    ) {
      errors.push(
        validationError(
          "unknown_game_rule_flag",
          path,
          "Game Ruleに存在しないフラグを参照しています",
          value,
          "Game Ruleに定義されたフラグ名",
        ),
      );
    }
  };

  program.nodes.forEach((node, nodeIndex) => {
    Object.entries(node.parameterValues).forEach(([parameterId, value]) => {
      validateReference(
        value,
        `${participantPath}/program/nodes/${nodeIndex}/parameterValues/${parameterId}`,
      );
    });

    const instruction = repository.get("instruction", node.instructionId);
    instruction?.parameters.forEach((parameter, parameterIndex) => {
      if (parameter.defaultValue !== undefined) {
        validateReference(
          parameter.defaultValue as ParameterValue,
          `${participantPath}/program/nodes/${nodeIndex}/instructionDefinition/parameters/${parameterIndex}/defaultValue`,
        );
      }
    });
  });
  return errors;
};

const validateParticipant = (
  participant: GameSessionCreationParticipant,
  participantIndex: number,
  input: GameSessionCreationInput,
): DataValidationError[] => {
  const { repository } = input;
  const { robotDesign, program } = participant;
  const participantPath = `/participants/${participantIndex}`;
  const errors = validateRobotDesignReferences(robotDesign, repository).map(
    (error) => prefixErrorPath(error, `${participantPath}/robotDesign`),
  );

  if (robotDesign.programId !== program.id) {
    errors.push(
      validationError(
        "program_id_mismatch",
        `${participantPath}/program/id`,
        "Robot設計データが参照するProgram IDと一致しません",
        program.id,
        robotDesign.programId,
      ),
    );
  }

  const selectedWeaponSlotId = resolveInitialWeaponSlotId(
    robotDesign,
    repository,
  );
  if (
    robotDesign.initialWeaponHand !== null &&
    selectedWeaponSlotId === undefined
  ) {
    errors.push(
      validationError(
        "missing_weapon_mount",
        `${participantPath}/robotDesign/initialWeaponHand`,
        "初期選択した手に対応するWeapon Slotがありません",
        robotDesign.initialWeaponHand,
        "対応するWeapon Slotを持つRobot Body",
      ),
    );
  }

  const programValidation = validateProgram(program, repository);
  programValidation.diagnostics
    .filter(({ severity }) => severity === "error")
    .forEach((diagnostic) => {
      errors.push(
        validationError(
          `program_${diagnostic.code}`,
          `${participantPath}/program${diagnostic.fieldPath === null ? "" : `/${diagnostic.fieldPath.replaceAll(".", "/")}`}`,
          diagnostic.message,
          diagnostic.nodeId,
          "Program ValidatorをErrorなしで通過するProgram",
        ),
      );
    });

  const gameRule = repository.get("game_rule", input.gameRuleId);
  if (gameRule !== undefined) {
    errors.push(
      ...validateGameRuleReferences(
        program,
        repository,
        new Set(gameRule.registerNames),
        new Set(gameRule.flagNames),
        participantPath,
      ),
    );
    program.nodes.forEach((node, nodeIndex) => {
      const instruction = repository.get("instruction", node.instructionId);
      if (
        instruction !== undefined &&
        instruction.cpuCost > gameRule.cpuLimit
      ) {
        errors.push(
          validationError(
            "instruction_cpu_cost_exceeded",
            `${participantPath}/program/nodes/${nodeIndex}/instructionId`,
            "Programが使用するInstructionのCPU CostがGame Ruleの上限を超えています",
            instruction.cpuCost,
            `${gameRule.cpuLimit}以下`,
          ),
        );
      }
    });
  }

  return errors;
};

const createRobotState = (
  participant: GameSessionCreationParticipant,
  participantIndex: number,
  input: GameSessionCreationInput,
): RobotState => {
  const gameRule = input.repository.get("game_rule", input.gameRuleId)!;
  const map = input.repository.get("map", input.mapId)!;
  const body = input.repository.get(
    "robot_body",
    participant.robotDesign.bodyDefinitionId,
  )!;
  const equippedSlotIds = Object.keys(participant.robotDesign.equipment).sort(
    compareAscii,
  ) as SlotId[];

  return {
    id: createRuntimeRobotId((participantIndex + 1) as Int32),
    robotDesignId: participant.robotDesign.id,
    position: clone(map.spawnPoints[participantIndex]!.position),
    direction: map.spawnPoints[participantIndex]!.direction,
    velocity: { x: 0 as Int32, y: 0 as Int32 },
    currentHp: body.maxHp,
    energy: body.maxEnergy,
    heat: 0 as Int32,
    status: "active",
    partDamage: Object.fromEntries(
      equippedSlotIds.map((slotId) => [slotId, 0 as Int32]),
    ),
    selectedWeaponSlotId:
      resolveInitialWeaponSlotId(participant.robotDesign, input.repository) ??
      null,
    ammunition: Object.fromEntries(
      Object.entries(participant.robotDesign.ammunition).sort(
        ([left], [right]) => compareAscii(left, right),
      ),
    ),
    aiRuntimeState: createInitialAIRuntimeState(
      gameRule,
      participant.program.startNodeId,
    ),
    actionRequests: createEmptyActionRequests(),
    actionState: createEmptyRobotActionState(),
  };
};

/** 検証済みData Repositoryと参加者から、成功時だけ初期Game Sessionを生成する。 */
export const createGameSession = (
  input: GameSessionCreationInput,
): LoadResult<GameSession> => {
  const errors: DataValidationError[] = [];
  const map = input.repository.get("map", input.mapId);
  const gameRule = input.repository.get("game_rule", input.gameRuleId);

  if (map === undefined) {
    errors.push(
      validationError(
        "missing_map",
        "/mapId",
        "Map Definitionが存在しません",
        input.mapId,
        "Data Repositoryに存在するMap Definition ID",
      ),
    );
  }
  if (gameRule === undefined) {
    errors.push(
      validationError(
        "missing_game_rule",
        "/gameRuleId",
        "Game Rule Definitionが存在しません",
        input.gameRuleId,
        "Data Repositoryに存在するGame Rule Definition ID",
      ),
    );
  } else if (input.participants.length !== gameRule.participantCount) {
    errors.push(
      validationError(
        "participant_count_mismatch",
        "/participants",
        "参加者数がGame Ruleと一致しません",
        input.participants.length,
        `${gameRule.participantCount}件`,
      ),
    );
  }
  if (map !== undefined && map.spawnPoints.length < input.participants.length) {
    errors.push(
      validationError(
        "insufficient_spawn_points",
        "/mapId",
        "MapのSpawn Point数が参加者数より少ないです",
        map.spawnPoints.length,
        `${input.participants.length}件以上`,
      ),
    );
  }

  const runtimeRobotIds = input.participants.map((_, index) =>
    createRuntimeRobotId((index + 1) as Int32),
  );
  if (new Set(runtimeRobotIds).size !== runtimeRobotIds.length) {
    errors.push(
      validationError(
        "duplicate_runtime_robot_id",
        "/participants",
        "Runtime Robot IDが重複しています",
        runtimeRobotIds,
        "一意なRuntime Robot ID",
      ),
    );
  }

  input.participants.forEach((participant, index) => {
    errors.push(...validateParticipant(participant, index, input));
  });
  if (errors.length > 0) return { success: false, errors };

  const participants = input.participants.map((participant, index) => ({
    robotId: runtimeRobotIds[index]!,
    robotDesign: clone(participant.robotDesign),
    program: clone(participant.program),
  }));

  return {
    success: true,
    data: {
      participants,
      initialRandomSeed: input.initialRandomSeed,
      mapId: input.mapId,
      gameRuleId: input.gameRuleId,
      masterDataVersion: CURRENT_FORMAT_VERSION,
      worldState: {
        tick: 0 as Int32,
        robots: input.participants.map((participant, index) =>
          createRobotState(participant, index, input),
        ),
        bullets: [],
        obstacles: map!.obstacles.map((obstacle) => clone(obstacle)),
        status: "ready",
        result: null,
        randomState: initializeRandomState(input.initialRandomSeed),
        nextBulletSequence: 1 as Int32,
      },
    },
  };
};
