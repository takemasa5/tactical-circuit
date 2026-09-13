import { useEffect, useState } from "react";

import "./App.css";
import {
  createPhase1OpponentProgram,
  createPhase1PlayerProgram,
} from "../domain/battle/phase1Programs";
import { PHASE1_GAME_RULE_ID } from "../domain/battle/fixedBattle";
import { runFixedBattle, type BattleRun } from "../domain/battle/runBattle";
import type { ProgramId } from "../domain/data/ids";
import type { Program } from "../domain/program/models";
import { BattleView } from "./BattleView";
import {
  loadEditorMasterData,
  type EditorMasterData,
} from "./loadEditorMasterData";
import { ProgramEditor } from "./ProgramEditor";

const createProgramId = (): ProgramId =>
  `program_${crypto.randomUUID()}` as ProgramId;

export function App() {
  const [masterData, setMasterData] = useState<EditorMasterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [battleRun, setBattleRun] = useState<BattleRun | null>(null);
  const [initialProgram, setInitialProgram] = useState<Program | null>(null);
  const [playerProgram, setPlayerProgram] = useState<Program | null>(null);
  const [screen, setScreen] = useState<"editor" | "battle">("editor");

  useEffect(() => {
    let active = true;
    void loadEditorMasterData()
      .then((loaded) => {
        if (active) {
          setInitialProgram(
            createPhase1PlayerProgram(
              createProgramId(),
              loaded.repository,
              new Date().toISOString(),
            ),
          );
          setMasterData(loaded);
        }
      })
      .catch(() => {
        if (active)
          setError("Program EditorのMaster Dataを読み込めませんでした");
      });
    return () => {
      active = false;
    };
  }, []);

  if (masterData !== null && initialProgram !== null) {
    const gameRule = masterData.repository.get(
      "game_rule",
      PHASE1_GAME_RULE_ID,
    );
    if (screen === "battle" && battleRun !== null && gameRule !== undefined) {
      return (
        <BattleView
          battleRun={battleRun}
          tickLimit={gameRule.tickLimit}
          onReturnToEditor={() => setScreen("editor")}
        />
      );
    }
    return (
      <ProgramEditor
        instructions={masterData.instructions}
        startInstructionId={masterData.startInstructionId}
        repository={masterData.repository}
        initialProgram={playerProgram ?? initialProgram}
        onStartBattle={(playerProgram) => {
          const result = runFixedBattle(
            playerProgram,
            createPhase1OpponentProgram(
              masterData.repository,
              new Date().toISOString(),
            ),
            masterData.repository,
          );
          if (!result.success) {
            return { success: false, message: result.message };
          }
          setBattleRun(result.data);
          setPlayerProgram(playerProgram);
          setScreen("battle");
          return { success: true };
        }}
      />
    );
  }

  return (
    <main className="loading-shell">
      <section className="loading-panel" aria-labelledby="app-title">
        <p className="eyebrow">PROGRAM EDITOR / PHASE 3</p>
        <h1 id="app-title">Tactical Circuit</h1>
        <p role={error === null ? "status" : "alert"}>
          {error ?? "Master Dataを読み込んでいます…"}
        </p>
      </section>
    </main>
  );
}
