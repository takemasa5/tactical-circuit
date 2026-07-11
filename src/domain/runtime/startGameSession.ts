import type { GameSession } from "./models";
import type { SimulatorResult } from "./simulatorResult";

/** `ready`のGame Sessionを、入力を変更せず`running`へ遷移させる。 */
export const startGameSession = (
  gameSession: GameSession,
): SimulatorResult<GameSession> => {
  if (gameSession.worldState.status !== "ready") {
    return {
      success: false,
      code: "invalid_game_status",
      message: "Game Sessionはreadyのときだけ開始できます",
    };
  }

  return {
    success: true,
    data: {
      ...gameSession,
      worldState: {
        ...gameSession.worldState,
        status: "running",
      },
    },
  };
};
