# Phase申し送り事項

## 目的

本書は、現在のPhaseでは前提機能が存在しないため対応できず、将来Phaseで確認または実装する事項を記録する。

各事項は解決時にも削除せず、状態と対応根拠を更新する。

## 状態

- `pending`: 対象Phaseでの確認または実装が必要
- `resolved`: 実装、仕様、テストなどの対応根拠を記録済み

---

## PH-001 Instruction implementationIdの許可リスト

- 状態: `pending`
- 発生Phase: Phase 3 Program Validator
- 対象Phase: Phase 4 AI実行エンジン
- 関連: PR #5 review thread `PRRT_kwDOTGu1Vs6NKGl5`

### 背景

Phase 3時点ではInstruction Dispatcherと命令実装Registryが存在しない。Program EditorのData Repository生成時は、読込済みInstruction Definitionから`implementationId`を収集しているため、実装コードに存在するIDかどうかを検証できない。

### 対応条件

Phase 4でInstruction Dispatcherと命令実装Registryを追加する際、Registryが公開する固定の対応ID集合をData Repositoryへ渡す。Master Data自身から許可ID集合を生成してはならない。

未知の`implementationId`を持つInstruction Definitionが`unknown_implementation_id`で拒否される再発防止テストを追加する。

---

## PH-002 Simulator行動状態とActionStatusSnapshot

- 状態: `pending`
- 発生Phase: Phase 4 AI実行エンジン
- 対象Phase: Phase 5 シミュレーター基盤
- 関連: PR #27 review thread `PRRT_kwDOTGu1Vs6NnpzP`

### 背景

Phase 4ではWait Action命令が参照する`movement`と`combat`の`idle`または`running`をExecution Inputへ定義するが、現在の行動、次動作、予備動作、実動作、事後動作を保持・更新するSimulatorは存在しない。

### 対応条件

Simulatorがカテゴリごとに現在の行動と次動作を保持し、共通の段階遷移規則に従って更新する。現在の行動または次動作が存在する場合に`running`、どちらも存在しない場合に`idle`となるActionStatusSnapshotをTick開始時に生成する。

Wait Actionが同一Tickで生成済みの行動要求とActionStatusSnapshotの両方を使用して待機できる統合テストを追加する。

---

## PH-003 戦闘系行動の段階時間と完了Tick

- 状態: `pending`
- 発生Phase: Phase 4 AI実行エンジン
- 対象Phase: Phase 8 武器
- 関連: PR #27 review thread `PRRT_kwDOTGu1Vs6NnpzP`

### 背景

Phase 4ではFireを発射試行1回、Switch Weaponを切替試行1回で実動作完了と定義する。予備動作、試行を行うTick、事後動作の長さ、実動作のキャンセル可否はWeaponとSimulatorの実装が存在しないため確定できない。

### 対応条件

FireとSwitch Weaponについて、予備動作、実動作、事後動作のTick数、効果を適用するTick、実動作のキャンセル可否、および値を保持するMaster Dataを定義する。

FireまたはSwitch Weaponの要求採用からcombat行動が`idle`になるまでの段階遷移と、Wait Actionが解除されるTickを検証するテストを追加する。
