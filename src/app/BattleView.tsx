import { useEffect, useState } from "react";

import type { BattleRun } from "../domain/battle/runBattle";
import type { Int32 } from "../domain/data/common";
import type { RobotState, WorldState } from "../domain/runtime/models";

/** `docs/specs/planned/phase1_playable_mvp.md`のSnapshot再生用Battle画面入力。 */
type BattleViewProps = {
  readonly battleRun: BattleRun;
  readonly tickLimit: Int32;
  readonly onReturnToEditor: () => void;
};

const MAP_HEIGHT = 450;

const toSvgY = (worldY: number): number => MAP_HEIGHT - worldY;

const robotName = (robot: RobotState): string =>
  robot.id === "robot_1" ? "PLAYER" : "OPPONENT";

const ammunition = (robot: RobotState): Int32 => {
  const slotId = robot.selectedWeaponSlotId;
  return slotId === null
    ? (0 as Int32)
    : (robot.ammunition[slotId] ?? (0 as Int32));
};

const SnapshotMap = ({ worldState }: { readonly worldState: WorldState }) => (
  <svg
    className="battle-map"
    viewBox="0 0 800 450"
    role="img"
    aria-label={`Tick ${worldState.tick}のMap`}
  >
    <rect
      className="battle-map-boundary"
      x="0"
      y="0"
      width="800"
      height="450"
    />
    {worldState.obstacles.map((obstacle) => (
      <rect
        className="battle-obstacle"
        key={obstacle.id}
        x={obstacle.position.x - obstacle.size.width / 2}
        y={toSvgY(obstacle.position.y + obstacle.size.height / 2)}
        width={obstacle.size.width}
        height={obstacle.size.height}
      />
    ))}
    {worldState.bullets.map((bullet) => (
      <circle
        className="battle-bullet"
        cx={bullet.position.x}
        cy={toSvgY(bullet.position.y)}
        key={bullet.id}
        r="4"
      />
    ))}
    {worldState.robots.map((robot) => (
      <g
        className={`battle-robot ${robot.status}`}
        key={robot.id}
        transform={`translate(${robot.position.x} ${toSvgY(robot.position.y)}) rotate(${robot.direction})`}
      >
        <rect x="-20" y="-20" width="40" height="40" rx="4" />
        <line x1="0" y1="0" x2="0" y2="-24" />
        <text transform={`rotate(${-Number(robot.direction)})`} x="-28" y="-30">
          {robotName(robot)}
        </text>
      </g>
    ))}
  </svg>
);

export function BattleView({
  battleRun,
  tickLimit,
  onReturnToEditor,
}: BattleViewProps) {
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const currentSnapshot = battleRun.snapshots[snapshotIndex]!;
  const atLastSnapshot = snapshotIndex >= battleRun.snapshots.length - 1;

  useEffect(() => {
    if (!isPlaying || atLastSnapshot) return;
    const timer = window.setInterval(() => {
      setSnapshotIndex((current) =>
        Math.min(current + 1, battleRun.snapshots.length - 1),
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [atLastSnapshot, battleRun.snapshots.length, isPlaying]);

  return (
    <main className="battle-app">
      <header className="battle-header">
        <div>
          <p className="eyebrow">BATTLE / PHASE 1</p>
          <h1>Tactical Circuit</h1>
        </div>
        <p className="battle-tick">
          Tick {currentSnapshot.tick} / {tickLimit}
        </p>
      </header>

      <section className="battle-layout" aria-label="Battle">
        <SnapshotMap worldState={currentSnapshot} />
        <aside className="battle-status" aria-label="Robot状態">
          <h2>Robots</h2>
          {currentSnapshot.robots.map((robot) => (
            <section className="battle-robot-status" key={robot.id}>
              <h3>{robotName(robot)}</h3>
              <dl>
                <dt>HP</dt>
                <dd>{robot.currentHp}</dd>
                <dt>残弾</dt>
                <dd>{ammunition(robot)}</dd>
                <dt>状態</dt>
                <dd>{robot.status}</dd>
              </dl>
            </section>
          ))}
        </aside>
      </section>

      <footer className="battle-controls">
        <button
          type="button"
          disabled={!isPlaying || atLastSnapshot}
          onClick={() => setIsPlaying(false)}
        >
          一時停止
        </button>
        <button
          type="button"
          disabled={isPlaying || atLastSnapshot}
          onClick={() => setIsPlaying(true)}
        >
          再開
        </button>
        <button type="button" onClick={onReturnToEditor}>
          Editorへ戻る
        </button>
      </footer>
    </main>
  );
}
