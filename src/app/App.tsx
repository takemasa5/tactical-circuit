import { useEffect, useRef, useState } from "react";

import "./App.css";
import {
  createPhase1OpponentProgram,
  createPhase1PlayerProgram,
} from "../domain/battle/phase1Programs";
import { runFixedBattle, type BattleRun } from "../domain/battle/runBattle";
import type { ProgramId } from "../domain/data/ids";
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
  const battleRunRef = useRef<BattleRun | null>(null);

  useEffect(() => {
    let active = true;
    void loadEditorMasterData()
      .then((loaded) => {
        if (active) setMasterData(loaded);
      })
      .catch(() => {
        if (active)
          setError("Program EditorのMaster Dataを読み込めませんでした");
      });
    return () => {
      active = false;
    };
  }, []);

  if (masterData !== null) {
    return (
      <ProgramEditor
        instructions={masterData.instructions}
        startInstructionId={masterData.startInstructionId}
        repository={masterData.repository}
        initialProgram={createPhase1PlayerProgram(
          createProgramId(),
          masterData.repository,
          new Date().toISOString(),
        )}
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
          battleRunRef.current = result.data;
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
