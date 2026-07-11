# Phase 5 シミュレーター基盤

## 目的

本書はPhase 5で実装するGame Session生成、初期World State、開始操作、1 Tick更新、行動状態基盤、共通擬似乱数生成器、およびエラー処理を定義する。

Phase 5の完了時点では、検証済みのRobotとProgramを空のMap上で初期化し、AIを実行してWorld Stateを1 Tickずつ決定論的に更新できることを目的とする。

---

## 対象範囲

Phase 5では以下を実装する。

- Game Session開始前検証
- Game Sessionと初期World Stateの生成
- `ready`から`running`への明示的な開始操作
- 同期的な1 Tick更新
- AI Engineとの統合
- Robotごとの行動要求の取得
- 現在行動、次動作、および`ActionStatusSnapshot`の基盤
- `xorshift32`共通擬似乱数生成器
- Robot、Bullet、Obstacleのオブジェクト配列管理
- Robot単位のAI実行時エラー継続
- Simulator全体の回復不能エラーの安全な返却

以下はPhase 5の対象外とする。

- 実時間、`requestAnimationFrame`、描画フレームとの接続
- Robotの位置、向き、速度の更新
- 行動の具体的な予備動作時間、実動作、事後動作時間
- センサー計算
- 武器、Bullet生成、Bullet更新
- 衝突、ダメージ、撃破、勝敗、Tick上限による終了
- リプレイ記録と再生
- UI表示

実時間と描画フレームの接続はBattle UIを実装するPhaseで行う。移動はPhase 6、センサーはPhase 7、武器はPhase 8、勝敗とTick上限はPhase 9、リプレイはPhase 11で実装する。

---

## Game Session生成入力

Game Session生成入力は`docs/specs/current/simulator/game_session_creation.md`に実装済み仕様として定義する。

---

## Game Session開始前検証

Game Session開始前検証は`docs/specs/current/simulator/game_session_creation.md`に実装済み仕様として定義する。

---

## 初期Game Session

初期Game Sessionは`docs/specs/current/simulator/game_session_creation.md`に実装済み仕様として定義する。

---

## 初期Robot State

初期Robot Stateは`docs/specs/current/simulator/game_session_creation.md`に実装済み仕様として定義する。

---

## Execution Input用Robot Snapshot

Robot StateとExecution InputのSnapshot境界、専用Schema、および参照分離は`docs/specs/current/13_data_ownership.md`に実装済み仕様として定義する。

SimulatorはTick開始時のRobot Stateから新しい`ExecutionRobotSnapshot`を生成する。現在行動、次動作、段階、進捗の情報は`robot`へ含めず、AI Engineへ公開する行動状態は`actionStatus`の`idle`または`running`だけとする。

---

## 行動状態

Robot Stateが保持するカテゴリ別行動状態の型、所有権、Schema、およびReplay保存時の正規化は`docs/specs/current/13_data_ownership.md`に実装済み仕様として定義する。

Phase 5の行動採用と`ActionStatusSnapshot`生成は`docs/specs/current/simulator/action_arbitration.md`に実装済み仕様として定義する。

`executing`の具体的な進捗型と、`recovering`へ入る条件は後続Phaseが対応行動ごとに追加する。未定義の進捗を汎用オブジェクトや単一数値で代用しない。

---

## 行動要求の調停

行動要求の調停は`docs/specs/current/simulator/action_arbitration.md`に実装済み仕様として定義する。

具体的な段階更新では、長さ0 Tickの段階だけを同一Tick内で即座に飛ばす。1 Tick以上を消費した場合は、次段階の処理を次Tickから行う。現在行動完了後の次動作も同じ規則で開始する。

共通の許可遷移は次のとおりとする。

- `preparing`から`executing`
- キャンセルされた`preparing`から、新しい要求の`preparing`
- 正常完了またはキャンセルされた`executing`から`recovering`
- `recovering`完了後、次動作があればその要求の`preparing`
- `recovering`完了後、次動作がなければ現在行動を`null`

事後動作を持たない行動でも、長さ0 Tickの`recovering`を経由したものとして同じ遷移規則を適用する。許可されていない遷移要求はSimulator全体の内部整合性Errorとする。

段階時間、効果、および完了条件を所有する後続サブシステムは、現在段階を直接書き換えず、継続、正常完了、またはキャンセルの遷移結果を共通行動状態更新へ返す。Phase 5の既定処理は`preparing`の継続だけを返す。

---

## `actionRequests`のTickライフサイクル

`RobotState.actionRequests`は、そのTickにAI Engineが生成した要求だけを表す。

Tick開始時、すべてのRobotの`actionRequests`を両カテゴリとも`null`へ戻す。その後、各RobotのAI実行結果に含まれる`actionRequests`で対象Robotの値を置き換える。Tick完了時は、そのTickに生成された値をWorld Stateへ保持する。

前Tickの`actionRequests`をExecution InputのRobotスナップショットへ混入させない。

---

## Game Session開始操作

Game Session開始操作は`docs/specs/current/simulator/game_session_start.md`に実装済み仕様として定義する。

---

## 実装済み仕様

Phase 5の同期的な1 Tick更新、Tick処理順、AI実行時エラー、Simulator全体の回復不能エラー、およびTick更新時のオブジェクト順序は`docs/specs/current/simulator/tick_update.md`に実装済み仕様として定義する。

Game Session開始前検証は複数の不正をまとめて返すため、`SimulatorResult`ではなく既存の`LoadResult<GameSession>`と`DataValidationError[]`を使用する。

Game Session生成時の参加者、Robot State、Obstacle State、および順序不問オブジェクトの初期順序は`docs/specs/current/simulator/game_session_creation.md`に実装済み仕様として定義する。

---

## 必須テスト

Phase 5の必須テストは対応する実装済み仕様とともに`docs/specs/current/`へ反映済み。

- Game Session生成、開始前検証、初期World State: `docs/specs/current/simulator/game_session_creation.md`
- 開始操作: `docs/specs/current/simulator/game_session_start.md`
- 同期的な1 Tick更新、AI実行時エラー、回復不能エラー、オブジェクト順序: `docs/specs/current/simulator/tick_update.md`
- 行動要求の調停と`ActionStatusSnapshot`: `docs/specs/current/simulator/action_arbitration.md`
- `xorshift32`共通擬似乱数生成器: `docs/specs/current/14_determinism_rules.md`

---

## Phase 5完了条件

Phase 5の完了条件は満たされ、対応する規範的仕様は`docs/specs/current/`へ反映済み。
