import type { DataRepository } from "../masterData/repository";
import type { SlotId } from "../robotDesign/models";
import {
  relativeBearing,
  relativePosition,
  roundedDistance,
} from "./deterministicGeometry";
import type {
  DetectedRobot,
  GameSession,
  RobotState,
  SensorSnapshot,
} from "./models";
import type { SimulatorResult } from "./simulatorResult";

const inconsistentSensor = <T>(message: string): SimulatorResult<T> => ({
  success: false,
  code: "inconsistent_session",
  message,
});

const compareAscii = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const resolveSensor = (
  gameSession: GameSession,
  robot: RobotState,
  repository: DataRepository,
) => {
  const participant = gameSession.participants.find(
    ({ robotId }) => robotId === robot.id,
  );
  if (participant === undefined) return undefined;
  const body = repository.get(
    "robot_body",
    participant.robotDesign.bodyDefinitionId,
  );
  if (body === undefined) return undefined;

  const sensorIds = body.slots
    .filter(({ category }) => category === "sensor")
    .map(({ id }) => participant.robotDesign.equipment[id as SlotId])
    .filter((id) => id !== undefined)
    .map((id) => repository.get("sensor", id))
    .filter((sensor) => sensor !== undefined);
  return sensorIds.length === 1 ? sensorIds[0] : undefined;
};

const isInsideFieldOfView = (bearing: number, fieldOfView: number): boolean => {
  if (fieldOfView === 360) return true;
  const angularDistance = Math.min(bearing, 360 - bearing);
  return angularDistance * 2 <= fieldOfView;
};

/** Phase 1の固定Sensorから、対象Robot用のTick開始時Snapshotを生成する。 */
export const createSensorSnapshot = (
  gameSession: GameSession,
  robot: RobotState,
  repository: DataRepository,
): SimulatorResult<SensorSnapshot> => {
  const sensor = resolveSensor(gameSession, robot, repository);
  if (sensor === undefined) {
    return inconsistentSensor(
      `Robot ${robot.id}にPhase 1で使用するSensorが1つ装備されていません`,
    );
  }

  const detected: DetectedRobot[] = [];
  const targets = [...gameSession.worldState.robots]
    .filter((target) => target.id !== robot.id && target.status === "active")
    .sort((left, right) => compareAscii(left.id, right.id));

  for (const target of targets) {
    const distance = roundedDistance(robot.position, target.position);
    if (!distance.success) return distance;
    if (distance.data > sensor.detectionDistance) continue;

    const bearing = relativeBearing(
      robot.position,
      robot.direction,
      target.position,
    );
    if (!bearing.success) return bearing;
    if (!isInsideFieldOfView(bearing.data, sensor.fieldOfViewDegree)) continue;

    const position = relativePosition(
      robot.position,
      robot.direction,
      target.position,
    );
    if (!position.success) return position;
    detected.push({
      id: target.id,
      worldPosition: { ...target.position },
      relativePosition: position.data,
      distance: distance.data,
      bearing: bearing.data,
      status: target.status,
    });
  }

  return { success: true, data: { robots: detected, bullets: [] } };
};
