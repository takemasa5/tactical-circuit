import { useEffect, useState } from "react";

import "./App.css";
import {
  loadEditorMasterData,
  type EditorMasterData,
} from "./loadEditorMasterData";
import { ProgramEditor } from "./ProgramEditor";

export function App() {
  const [masterData, setMasterData] = useState<EditorMasterData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
