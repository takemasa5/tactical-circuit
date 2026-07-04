import { describe, expect, it } from "vitest";
import type { Int32 } from "../data/common";
import type { GameRuleId, MapId } from "../masterData/models";
import type { GameSession, GameStatus } from "./models";
import { startGameSession } from "./startGameSession";

const gameSession = (status: GameStatus): GameSession => ({
  participants: [],
  initialRandomSeed: 123 as Int32,
  mapId: "map_test" as MapId,
  gameRuleId: "game_rule_test" as GameRuleId,
  masterDataVersion: "0.1.1",
  worldState: {
    tick: 42 as Int32,
    robots: [],
    bullets: [],
    obstacles: [],
    status,
    result: null,
    randomState: { value: 456 as Int32 },
    nextBulletSequence: 7 as Int32,
  },
});

describe("startGameSession", () => {
  it("statusだけをrunningへ変更した新しいGame Sessionを返す", () => {
    const input = gameSession("ready");
    const before = structuredClone(input);

    const result = startGameSession(input);

    expect(result).toEqual({
      success: true,
      data: {
        ...before,
        worldState: { ...before.worldState, status: "running" },
      },
    });
    expect(result.success && result.data).not.toBe(input);
    expect(result.success && result.data.worldState).not.toBe(input.worldState);
    expect(input).toEqual(before);
  });

  it.each(["running", "finished"] as const)(
    "%sのGame Sessionをinvalid_game_statusとして拒否する",
    (status) => {
      const input = gameSession(status);
      const before = structuredClone(input);

      expect(startGameSession(input)).toEqual({
        success: false,
        code: "invalid_game_status",
        message: "Game Sessionはreadyのときだけ開始できます",
      });
      expect(input).toEqual(before);
    },
  );
});
