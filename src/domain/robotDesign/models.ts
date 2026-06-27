import type { Int32 } from "../data/common";
import type { ProgramId, RobotDesignId } from "../data/ids";
import type { MasterDataId, RobotBodyId } from "../masterData/models";

/** `spec/13_data_ownership.md`のRobotDesign装備スロットID。 */
export type SlotId = string & { readonly __brand: "SlotId" };

/** `spec/13_data_ownership.md`のRobotDesign表示メタデータ。 */
export type RobotDesignMetadata = {
  readonly name: string;
  readonly author: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** `spec/13_data_ownership.md`の保存可能なRobot設計データ。 */
export type RobotDesign = {
  readonly id: RobotDesignId;
  readonly bodyDefinitionId: RobotBodyId;
  readonly programId: ProgramId;
  readonly equipment: Readonly<Record<SlotId, MasterDataId>>;
  readonly ammunition: Readonly<Record<SlotId, Int32>>;
  readonly metadata: RobotDesignMetadata;
};
