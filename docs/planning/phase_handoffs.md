# Phase申し送り事項

## 目的

本書は、現在のPhaseでは前提機能が存在しないため対応できず、将来Phaseで確認または実装する事項を記録する。

各事項は解決時にも削除せず、状態と対応根拠を更新する。

2026年9月以降の対象Phaseは`docs/planning/milestones/mvp.md`の新ロードマップに従う。解決済み事項のPhase番号と、過去のPull Requestに対応する発生Phaseは履歴として変更しない。

## 状態

- `pending`: 対象Phaseでの確認または実装が必要
- `resolved`: 実装、仕様、テストなどの対応根拠を記録済み

---

## PH-001 Instruction implementationIdの許可リスト

- 状態: `resolved`
- 発生Phase: Phase 3 Program Validator
- 対象Phase: Phase 4 AI実行エンジン
- 関連: PR #5 review thread `PRRT_kwDOTGu1Vs6NKGl5`

### 背景

Phase 3時点ではInstruction Dispatcherと命令実装Registryが存在しない。Program EditorのData Repository生成時は、読込済みInstruction Definitionから`implementationId`を収集しているため、実装コードに存在するIDかどうかを検証できない。

### 対応条件

Phase 4でInstruction Dispatcherと命令実装Registryを追加する際、Registryが公開する固定の対応ID集合をData Repositoryへ渡す。Master Data自身から許可ID集合を生成してはならない。

未知の`implementationId`を持つInstruction Definitionが`unknown_implementation_id`で拒否される再発防止テストを追加する。

### 対応根拠

- 仕様: `docs/specs/current/instructions/instruction_model.md`で、Instruction Registryの固定キー集合をData Repositoryの許可リストとして使用すると定義済み
- 実装: `src/domain/ai/instructions.ts`で13命令の固定Registryと許可ID集合を公開し、`src/app/loadEditorMasterData.ts`からData Repositoryへ渡す
- テスト: `src/app/loadEditorMasterData.test.ts`で、未知の`implementationId`がEditor経由でも`unknown_implementation_id`として拒否されることを確認

---

## PH-002 Simulator行動状態とActionStatusSnapshot

- 状態: `resolved`
- 発生Phase: Phase 4 AI実行エンジン
- 対象Phase: Phase 5 シミュレーター基盤
- 関連: PR #27 review thread `PRRT_kwDOTGu1Vs6NnpzP`
- Phase 5設計: `docs/specs/planned/simulator/phase5_foundation.md`

### 背景

Phase 4ではWait Action命令が参照する`movement`と`combat`の`idle`または`running`をExecution Inputへ定義するが、現在の行動、次動作、予備動作、実動作、事後動作を保持・更新するSimulatorは存在しない。

### 対応条件

Simulatorがカテゴリごとに現在の行動と次動作を保持し、共通の段階遷移規則に従って更新する。現在の行動または次動作が存在する場合に`running`、どちらも存在しない場合に`idle`となるActionStatusSnapshotをTick開始時に生成する。

Wait Actionが同一Tickで生成済みの行動要求とActionStatusSnapshotの両方を使用して待機できる統合テストを追加する。

### 対応根拠

- 仕様: `docs/specs/current/13_data_ownership.md`でRobot Stateの行動状態、`docs/specs/current/simulator/action_arbitration.md`で行動要求の調停と`ActionStatusSnapshot`生成、`docs/specs/current/simulator/tick_update.md`でTick開始時SnapshotとAI実行順を定義済み
- 実装: `src/domain/runtime/actionArbitration.ts`でカテゴリ別の現在行動、次動作、`ActionStatusSnapshot`を生成し、`src/domain/runtime/updateGameSessionTick.ts`でTick開始時のSnapshotをAI Engineへ渡す
- テスト: `src/domain/runtime/updateGameSessionTick.test.ts`でWait Actionが同一Tick要求と次Tickの`ActionStatusSnapshot`の両方で待機することを確認し、`src/domain/runtime/createGameSession.test.ts`でGame Session生成、開始、複数Robotの複数Tick同期更新を統合検証

---

## PH-003 戦闘系行動の段階時間と完了Tick

- 状態: `pending`
- 発生Phase: Phase 4 AI実行エンジン
- 対象Phase: 新Phase 4 Weaponと戦闘の拡張（旧計画: Phase 8 武器）
- 関連: PR #27 review thread `PRRT_kwDOTGu1Vs6NnpzP`

### 背景

旧Phase 4ではFireを発射試行1回、Switch Weaponを切替試行1回で実動作完了と定義する。予備動作、試行を行うTick、事後動作の長さ、実動作のキャンセル可否はWeaponとSimulatorの実装が存在しないため確定できない。

### 対応条件

FireとSwitch Weaponについて、予備動作、実動作、事後動作のTick数、効果を適用するTick、実動作のキャンセル可否、および値を保持するMaster Dataを定義する。

FireまたはSwitch Weaponの要求採用からcombat行動が`idle`になるまでの段階遷移と、Wait Actionが解除されるTickを検証するテストを追加する。

### Phase 1での限定対応

`docs/specs/planned/phase1_playable_mvp.md`ではPlayable MVPに必要な固定WeaponのFireだけを対象に、予備動作なし、発射試行後の固定発射間隔中は`running`、キャンセルと次動作なしという限定規則を定義する。この対応は複数Weapon、Switch Weapon、キャンセル、Master Dataによる完全な段階時間を扱わないため、PH-003は`pending`のままとする。

---

## PH-004 移動に伴うエネルギー消費と熱発生

- 状態: `pending`
- 発生Phase: Phase 6 移動システム
- 対象Phase: 新Phase 5 Robot構築とリソース管理（旧計画: Phase 9 戦闘システム）
- Phase 6設計: `docs/specs/planned/simulator/phase6_movement.md`

### 背景

旧Phase 6ではMovement SystemがEngine Definitionの移動性能を使用するが、`energyConsumption`、Robot Stateの`energy`、`heat`による行動不能や熱処理は扱わない。移動コア、衝突判定、行動状態遷移を先に確定するため、移動に伴うリソース消費は対象外とする。

### 対応条件

移動、旋回、横移動、停止について、Engine Definitionの`energyConsumption`をどのタイミングで消費するか、エネルギー不足時に要求を採用しないのか実動作を停止するのか、および熱発生または排熱を扱うかを定義する。

Wait Action、ActionStatusSnapshot、勝敗または行動不能判定と矛盾しないよう、エネルギー不足または熱状態によって移動系行動が`idle`へ戻るTickを検証するテストを追加する。
