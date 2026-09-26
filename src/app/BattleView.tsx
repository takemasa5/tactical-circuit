import { useEffect, useState } from "react";

import type { BattleRun } from "../domain/battle/runBattle";
import { PHASE1_SENSOR_ID } from "../domain/battle/fixedBattle";
import type { Int32 } from "../domain/data/common";
import type { RuntimeRobotId } from "../domain/data/ids";
import type { DataRepository } from "../domain/masterData/repository";
import type { RobotState, WorldState } from "../domain/runtime/models";

/** `docs/specs/planned/phase1_playable_mvp.md`のSnapshot再生用Battle画面入力。 */
type BattleViewProps = {
  readonly battleRun: BattleRun;
  readonly repository: DataRepository;
  readonly tickLimit: Int32;
  readonly onReturnToEditor: () => void;
};

const MAP_HEIGHT = 450;
/** `docs/specs/current/battle/tick_debug.md`のTick開始時Detect Enemy判定範囲。 */
type SensorRange = {
  readonly robotId: RuntimeRobotId;
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
  readonly direction: number;
  readonly configuredDistance: number;
  readonly sensorDistance: number;
  readonly distance: number;
  readonly centerDegree: number;
  readonly sensingDegree: number;
};

const PLAYBACK_SPEEDS = [10, 25, 75, 100] as const;
/** `docs/specs/current/battle/playback.md`の再生速度選択肢。 */
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
const TICKS_PER_SECOND_AT_FULL_SPEED = 10;

const toSvgY = (worldY: number): number => MAP_HEIGHT - worldY;

const sensorRangePath = (range: SensorRange): string => {
  const halfAngle = range.sensingDegree;
  const steps = Math.max(1, Math.ceil((halfAngle * 2) / 5));
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const angle =
      ((range.direction +
        range.centerDegree -
        halfAngle +
        (halfAngle * 2 * index) / steps) *
        Math.PI) /
      180;
    return `${range.x + range.distance * Math.sin(angle)} ${toSvgY(range.y + range.distance * Math.cos(angle))}`;
  });
  return `M ${range.x} ${toSvgY(range.y)} L ${points.join(" L ")} Z`;
};

const sensorRangesForTick = (
  battleRun: BattleRun,
  repository: DataRepository,
  snapshotIndex: number,
): SensorRange[] => {
  if (snapshotIndex === 0) return [];
  const tickStart = battleRun.snapshots[snapshotIndex - 1];
  const debugInfo = battleRun.aiDebugInfoByTick[snapshotIndex - 1];
  const sensor = repository.get("sensor", PHASE1_SENSOR_ID);
  if (
    tickStart === undefined ||
    debugInfo === undefined ||
    sensor === undefined
  )
    return [];

  return debugInfo.flatMap(({ robotId, debugInfo: { executedSteps } }) => {
    const robot = tickStart.robots.find(({ id }) => id === robotId);
    const program = battleRun.finalGameSession.participants.find(
      (participant) => participant.robotId === robotId,
    )?.program;
    if (robot === undefined || program === undefined) return [];

    const visitedNodes = new Set<string>();
    return executedSteps.flatMap((step) => {
      if (
        repository.get("instruction", step.instructionId)?.implementationId !==
          "detect_enemy" ||
        visitedNodes.has(step.nodeId)
      )
        return [];
      visitedNodes.add(step.nodeId);
      const node = program.nodes.find(({ id }) => id === step.nodeId);
      if (node === undefined) return [];
      const configuredDistance = Number(node.parameterValues.distance);
      const centerDegree = Number(node.parameterValues.center_degree);
      const sensingDegree = Number(node.parameterValues.sensing_degree);
      return [
        {
          robotId,
          nodeId: step.nodeId,
          x: robot.position.x,
          y: robot.position.y,
          direction: robot.direction,
          configuredDistance,
          sensorDistance: sensor.detectionDistance,
          distance: Math.min(configuredDistance, sensor.detectionDistance),
          centerDegree,
          sensingDegree,
        },
      ];
    });
  });
};

const robotName = (robot: RobotState): string =>
  robot.id === "robot_1" ? "PLAYER" : "OPPONENT";

const ammunition = (robot: RobotState): Int32 => {
  const slotId = robot.selectedWeaponSlotId;
  return slotId === null
    ? (0 as Int32)
    : (robot.ammunition[slotId] ?? (0 as Int32));
};

const SnapshotMap = ({
  worldState,
  sensorRanges,
}: {
  readonly worldState: WorldState;
  readonly sensorRanges: readonly SensorRange[];
}) => (
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
    {sensorRanges.map((range, index) => (
      <g
        className={`battle-sensor-range ${range.robotId === "robot_1" ? "player" : "opponent"}`}
        key={`${range.robotId}:${range.nodeId}:${index}`}
        aria-label={`${range.robotId} ${range.nodeId}のDetect Enemy判定範囲`}
      >
        <title>{`${range.nodeId}: 判定距離 ${range.distance}, 中心 ${range.centerDegree}°, 半角 ${range.sensingDegree}°`}</title>
        {range.sensingDegree === 180 ? (
          <circle cx={range.x} cy={toSvgY(range.y)} r={range.distance} />
        ) : (
          <path d={sensorRangePath(range)} />
        )}
        <circle
          className="battle-sensor-origin"
          cx={range.x}
          cy={toSvgY(range.y)}
          r="3"
        />
      </g>
    ))}
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
  repository,
  tickLimit,
  onReturnToEditor,
}: BattleViewProps) {
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(100);
  const currentSnapshot = battleRun.snapshots[snapshotIndex]!;
  const currentDebugInfo =
    snapshotIndex === 0
      ? []
      : (battleRun.aiDebugInfoByTick[snapshotIndex - 1] ?? []);
  const sensorRanges = sensorRangesForTick(
    battleRun,
    repository,
    snapshotIndex,
  );
  const atLastSnapshot = snapshotIndex >= battleRun.snapshots.length - 1;

  useEffect(() => {
    if (!isPlaying || atLastSnapshot) return;
    const timer = window.setInterval(
      () => {
        setSnapshotIndex((current) =>
          Math.min(current + 1, battleRun.snapshots.length - 1),
        );
      },
      Math.round(
        1000 / (TICKS_PER_SECOND_AT_FULL_SPEED * (playbackSpeed / 100)),
      ),
    );
    return () => window.clearInterval(timer);
  }, [atLastSnapshot, battleRun.snapshots.length, isPlaying, playbackSpeed]);

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
        <SnapshotMap worldState={currentSnapshot} sensorRanges={sensorRanges} />
        <aside className="battle-status" aria-label="戦闘情報">
          <section className="battle-debug" aria-label="Tickの実行経路">
            <h2>Tick {currentSnapshot.tick} の実行経路</h2>
            {snapshotIndex === 0 && <p>戦闘開始前です</p>}
            {snapshotIndex > 0 && currentDebugInfo.length === 0 && (
              <p>このTickでAIは実行されていません</p>
            )}
            {currentDebugInfo.map(({ robotId, debugInfo }) => (
              <section key={robotId} aria-label={`${robotId}の実行経路`}>
                <h3>{robotId === "robot_1" ? "PLAYER" : "OPPONENT"}</h3>
                {debugInfo.executedSteps.length === 0 ? (
                  <p>実行したノードはありません</p>
                ) : (
                  <ol>
                    {debugInfo.executedSteps.map((step, index) => (
                      <li key={`${index}:${step.nodeId}`}>
                        <span>
                          {step.nodeId} {step.instructionName}
                        </span>
                        {step.selectedOutputPathId !== null && (
                          <span className="battle-debug-path">
                            →{" "}
                            {step.selectedOutputPathName ??
                              step.selectedOutputPathId}
                            {step.nextNodeId !== null &&
                              ` (${step.nextNodeId})`}
                          </span>
                        )}
                        {sensorRanges
                          .filter(
                            (range) =>
                              range.robotId === robotId &&
                              range.nodeId === step.nodeId,
                          )
                          .map((range) => (
                            <span
                              className="battle-debug-sensor"
                              key={range.nodeId}
                            >
                              判定距離 {range.distance} (設定{" "}
                              {range.configuredDistance} / Sensor上限{" "}
                              {range.sensorDistance}) · 中心{" "}
                              {range.centerDegree}° ±{range.sensingDegree}° ·
                              Tick開始位置
                            </span>
                          ))}
                      </li>
                    ))}
                  </ol>
                )}
                {debugInfo.runtimeError !== null && (
                  <p role="alert">{debugInfo.runtimeError.message}</p>
                )}
              </section>
            ))}
            {sensorRanges.length > 0 && (
              <p className="battle-debug-note">
                着色範囲は判定時の概形です。境界では距離と角度の整数丸めが適用されます。
              </p>
            )}
          </section>
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
        <label>
          再生速度
          <select
            aria-label="再生速度"
            value={playbackSpeed}
            onChange={(event) =>
              setPlaybackSpeed(Number(event.target.value) as PlaybackSpeed)
            }
          >
            {PLAYBACK_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}%
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={atLastSnapshot}
          onClick={() => setIsPlaying((current) => !current)}
        >
          {isPlaying ? "一時停止" : "再開"}
        </button>
        <button type="button" onClick={onReturnToEditor}>
          Editorへ戻る
        </button>
      </footer>
    </main>
  );
}
