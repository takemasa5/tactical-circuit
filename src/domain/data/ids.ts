/** `docs/specs/current/12_common_data_conventions.md`のProgramグローバルID。 */
export type ProgramId = string & { readonly __brand: "ProgramId" };
/** `docs/specs/current/12_common_data_conventions.md`のRobotDesignグローバルID。 */
export type RobotDesignId = string & { readonly __brand: "RobotDesignId" };
/** `docs/specs/current/12_common_data_conventions.md`のReplayグローバルID。 */
export type ReplayId = string & { readonly __brand: "ReplayId" };
/** `docs/specs/current/12_common_data_conventions.md`のGame Session内Robot ID。 */
export type RuntimeRobotId = string & { readonly __brand: "RuntimeRobotId" };
/** `docs/specs/current/editor/program_model.md`のProgram内Node ID。 */
export type NodeId = string & { readonly __brand: "NodeId" };

const UUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const globalIdPattern = (prefix: string): RegExp =>
  new RegExp(`^${prefix}_${UUID_PATTERN}$`);

export const isProgramId = (value: unknown): value is ProgramId =>
  typeof value === "string" && globalIdPattern("program").test(value);

export const isRobotDesignId = (value: unknown): value is RobotDesignId =>
  typeof value === "string" && globalIdPattern("robo").test(value);

export const isReplayId = (value: unknown): value is ReplayId =>
  typeof value === "string" && globalIdPattern("replay").test(value);

export const isRuntimeRobotId = (value: unknown): value is RuntimeRobotId =>
  typeof value === "string" && /^robot_[1-9]\d*$/.test(value);

export const isNodeId = (value: unknown): value is NodeId =>
  typeof value === "string" && /^node_[1-9]\d*$/.test(value);
