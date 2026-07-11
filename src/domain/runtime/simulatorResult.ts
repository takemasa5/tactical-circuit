/** `docs/specs/current/simulator/game_session_start.md`のSimulator共通Error code。 */
export type SimulatorErrorCode =
  | "invalid_game_status"
  | "tick_overflow"
  | "inconsistent_session"
  | "internal_simulator_error";

/** `docs/specs/current/simulator/game_session_start.md`のSimulator共通結果型。 */
export type SimulatorResult<T> =
  | { readonly success: true; readonly data: T }
  | {
      readonly success: false;
      readonly code: SimulatorErrorCode;
      readonly message: string;
    };
