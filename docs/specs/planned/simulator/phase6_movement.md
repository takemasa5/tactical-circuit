# Phase 6 移動システム

## 目的

本書はPhase 6で実装するMovement System、移動系命令、移動系行動状態、Engine Definition拡張、Map境界およびObstacleとの衝突判定を定義する。

Phase 6完了時点では、AIが前進、後退、左右横移動、左右旋回、停止を要求し、Simulatorが装備Engine性能とMap制約に従ってRobot Stateを決定論的に更新できることを目的とする。

## 対象

Phase 6では以下を実装する。

- Strafe Left命令、Strafe Right命令、Stop命令
- `MovementProgress`の具体型
- 固定小数点による移動計算
- 0度から359度の整数方向ベクトルテーブル
- Map境界およびObstacleとのAABB衝突判定
- Movement Systemによる前進、後退、左右横移動、左右旋回、停止
- `updateGameSessionTick()`へのMovement System統合

## 対象外

以下はPhase 6の対象外とする。

- Robot同士の衝突
- Bullet、Weapon、Sensorとの相互作用
- 移動に伴うエネルギー消費
- 移動に伴う熱発生
- HP、撃破、勝敗判定
- Tick上限による終了
- Replay差分イベント
- 実時間または描画フレームとの接続

## 移動系命令

Phase 6では次の命令を追加する。

- Strafe Left
- Strafe Right
- Stop

Strafe Left命令は`strafe_left`の移動系行動要求を生成する。
Strafe Right命令は`strafe_right`の移動系行動要求を生成する。
Stop命令は`stop`の移動系行動要求を生成する。

各命令は行動要求の生成だけを担当し、Robotの位置、向き、速度、World Stateを直接変更しない。実際の移動、旋回、停止はSimulatorが担当する。

Strafe Left、Strafe Right、Stopはいずれも`next`をrequiredな出力パスとし、実行中Nodeの`connections.next`を`nextNodeId`として返す。CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの初期値は1とする。

Strafe Left、Strafe Right、Stopはレジスタ、フラグ、永続AIメモリ、コールスタック、戦闘系行動要求、Random Stateを変更しない。

同一Tickですでに移動系行動要求が生成されている場合、各命令は自身の移動系行動要求で上書きする。戦闘系行動要求は変更しない。

## 移動系行動要求

Phase 6のMovement Systemは次の移動系行動要求を実行対象とする。

```ts
type MovementRequest =
  | { readonly type: "forward"; readonly distance: Int32 }
  | { readonly type: "backward"; readonly distance: Int32 }
  | { readonly type: "strafe_left" }
  | { readonly type: "strafe_right" }
  | { readonly type: "turn_left"; readonly turnTo: Int32 }
  | { readonly type: "turn_right"; readonly turnTo: Int32 }
  | { readonly type: "stop" };
```

`forward`と`backward`の同一判定は既存仕様どおり`type`だけを使用し、`distance`を使用しない。

`strafe_left`、`strafe_right`、`stop`は`type`が同じ場合に同一要求とする。

`turn_left`と`turn_right`の同一判定は既存仕様どおり`type`だけを使用し、`turnTo`を使用しない。

## MovementProgress

Phase 6では`MovementProgress`を行動`type`ごとの判別可能な共用体として定義する。

```ts
type LinearMovementProgress = {
  readonly type: "forward" | "backward" | "strafe_left" | "strafe_right";
  readonly fixedPosition: FixedPointPosition;
  readonly fixedVelocity: FixedPointVector;
  readonly fixedMovedDistance: Int32;
  readonly blockedTicks: Int32;
};

type TurnMovementProgress = {
  readonly type: "turn_left" | "turn_right";
};

type MovementProgress = LinearMovementProgress | TurnMovementProgress;
```

`fixedPosition`は移動行動中の内部位置を固定小数点で保持する。
`fixedVelocity`は移動行動中の内部速度を固定小数点で保持する。
`fixedMovedDistance`は要求採用後に実際に移動できた距離の累計を固定小数点で保持する。
`blockedTicks`は連続して実移動距離0だったTick数を保持する。

`TurnMovementProgress`は旋回行動中であることだけを表す。Turnは角速度を`velocity`へ格納しない。

移動行動が完了またはキャンセルされた場合、`MovementProgress`は破棄する。

AI Engineへ公開する`ExecutionRobotSnapshot`は、Phase 6でも整数の`position`および`velocity`だけを持つ。固定小数点の内部位置、内部速度、進捗、段階、次動作はAI Engineへ公開しない。

## 固定小数点

Movement Systemは前進、後退、左右横移動の内部計算に固定小数点を使用する。

固定小数点スケールは`1000`とし、実装コードの定数として定義する。1座標単位は1000内部単位とする。

ゲーム実行時の移動方向計算では、0度から359度の整数方向ベクトルテーブルを実装コードの定数として参照する。実行時に`Math.sin()`、`Math.cos()`、その他の浮動小数点三角関数を使用して移動結果を決めてはならない。

方向ベクトルテーブルは各角度に対応する固定小数点ベクトルを持つ。テーブル生成方法とスケール値はDecision Recordまたは本仕様の追補で追跡可能にする。

方向ベクトルテーブル生成時は、各成分について三角関数の結果に1000を乗算し、四捨五入して整数へ確定する。端数がちょうど半分の場合は、共通の丸め規則に従い0から遠い整数へ丸める。ゲーム実行時は生成済みの整数テーブルだけを参照し、三角関数を実行しない。

World角0度はワールド座標系の`+Y`方向とする。90度は`+X`、180度は`-Y`、270度は`-X`方向とする。

固定小数点値をWorld Stateの`position`として保存しない。World Stateの`position`は常に整数座標とする。

## 前後移動と横移動

前進、後退、左右横移動では、Robot Stateの`direction`をRobot正面のWorld角として使用する。行動ごとの相対角を加算し、0以上360未満へ正規化したWorld角から方向ベクトルテーブルを参照する。

前進の相対角は0度とする。
右横移動の相対角は90度とする。
後退の相対角は180度とする。
左横移動の相対角は270度とする。

前進の速度上限は`maxForwardSpeed`を使用する。
後退の速度上限は`maxBackwardSpeed`を使用する。
左右横移動の速度上限は`maxStrafeSpeed`を使用する。

前進、後退、左右横移動は`acceleration`で加速する。各Tickの内部速度は、前Tickの内部速度に`acceleration`を固定小数点スケールへ変換した値を加算し、対応する速度上限を超えない値とする。

アイドル中の長時間ドリフトはPhase 6では扱わない。移動行動が完了またはキャンセルされた場合、Robot Stateの`velocity`は`{ x: 0, y: 0 }`へ戻す。

Move ForwardおよびMove Backwardでは、最終Tickの予定移動距離が要求の残り距離を超える場合、残り距離まで切り詰める。要求距離を超えて移動しない。

Strafe LeftおよびStrafe Rightは距離パラメータを持たない。Stop要求、別の移動系要求によるキャンセル、または詰まり判定によるキャンセルが発生するまで継続する。

## 旋回

TurnはRobotの`direction`だけを更新し、`position`を変更しない。

Turn中のRobot Stateの`velocity`は常に`{ x: 0, y: 0 }`とする。角速度を`velocity`へ格納しない。

右旋回および左旋回の残り角度と1Tickあたりの実旋回角度は、`docs/specs/current/instructions/details/turn.md`に従う。最後のTickで`turnTo`を越えて旋回しない。残り角度が0になった時点で実動作を完了する。

Turnは加速度を使用しない。

## Stop

Stop要求は移動系の停止制御として扱い、通常の`preparing`、`executing`、`recovering`を持つ行動として採用しない。

Stop要求を受けた場合、保持中の`next`を破棄する。

現在行動が`null`の場合、Stop要求はRobot Stateの`velocity`を`{ x: 0, y: 0 }`にし、移動系カテゴリを`idle`のままにする。

現在行動が`preparing`の場合、Stop要求は現在行動を即時破棄し、Robot Stateの`velocity`を`{ x: 0, y: 0 }`にし、同Tick内に移動系カテゴリを`idle`へ戻す。

現在行動が`executing`の場合、Stop要求は現在行動をキャンセルして`recovering`へ遷移させ、Robot Stateの`velocity`を`{ x: 0, y: 0 }`にする。`recovering`完了後、移動系カテゴリは`idle`になる。

現在行動が`recovering`の場合、Stop要求は保持中の`next`だけを破棄し、現在の`recovering`完了後に移動系カテゴリを`idle`にする。

## 段階遷移

Movement Systemは`updateGameSessionTick()`内で行動要求の調停後、Tick増加前に実行する。

1 Tick更新の順序は次とする。

1. 入力Game Sessionが`running`であることを確認する
2. Tick増加が符号付き32bit整数を超えないことを確認する
3. Tick開始時のWorld Stateを作業状態として複製する
4. 全Robotの`actionRequests`を空にする
5. Tick開始時の各Robotについて`ActionStatusSnapshot`を生成する
6. 各RobotのSensor Snapshotを生成する
7. 参加者配列の先頭から順にAI Engineを実行する
8. RobotごとにExecution ResultのAI Runtime State、Random State、`actionRequests`を作業状態へ反映する
9. すべてのAI実行後、参加者順に行動要求を現在行動または次動作へ調停する
10. 参加者順にMovement Systemで移動系現在行動を更新する
11. Tickを1増加する
12. 更新後Game SessionとRobot別AIデバッグ情報を返す

同Tickで採用された移動行動も、そのTickのMovement System更新対象とする。

`preparing`では、対象行動のprepare Tick数に達するまで`phaseElapsedTicks`を進める。prepare Tick数が0の場合、同Tick内に`executing`へ遷移できる。

`executing`では、対象行動の効果を適用し、完了条件またはキャンセル条件を判定する。

`recovering`では、対象行動のrecovery Tick数に達するまで`phaseElapsedTicks`を進める。recovery Tick数が0の場合、同Tick内に次動作開始または`idle`へ遷移できる。

実動作を開始した移動行動は、正常完了またはキャンセルのどちらであっても、次の行動へ移る前に`recovering`を完了する。

## キャンセル

前進、後退、左右横移動、左右旋回の実動作はキャンセル可能とする。

実動作中に現在行動と異なる移動系要求を受けた場合、現在行動をキャンセルして`recovering`へ遷移し、新しい要求を`next`として保持する。ただしStop要求はStop仕様に従い、`next`を破棄する。

キャンセルされたTickでRobot Stateの`velocity`を`{ x: 0, y: 0 }`にする。キャンセル時点までの進捗は以後の完了条件に使用せず、`MovementProgress`は`recovering`遷移時に破棄する。

`preparing`中に異なる移動系要求を受けた場合、現在行動を破棄し、新しい要求を`preparing`の現在行動として採用する。破棄した行動の`recovering`は行わない。

`recovering`中に移動系要求を受けた場合、その要求を`next`として保持する。同じカテゴリの新しい要求を保持した場合は最新の要求で`next`を上書きする。

## 衝突判定

Phase 6のMovement Systemは、移動後のRobot矩形がMap境界内に収まり、かつObstacle矩形と面積重複しない位置だけを有効位置とする。

Robot、Obstacle、Map境界の位置と矩形は`docs/specs/current/11_coordinate_system.md`および`docs/decisions/0001_center_position_aabb.md`に従う。RobotとObstacleの`position`は中心点とする。矩形同士は共通部分が正の幅かつ正の高さを持つ場合に面積重複とし、辺または頂点だけの接触は面積重複としない。

Robot同士の衝突はPhase 6では扱わない。

前進、後退、左右横移動の各Tickでは、予定移動距離を1座標単位ずつ判定し、衝突しない最後の整数位置まで進める。実移動距離は実際に進めた座標単位数を固定小数点へ変換した値として`fixedMovedDistance`へ加算する。

まったく進めなかったTickでは実移動距離を0とし、`blockedTicks`を1増加する。

## エラー処理

Movement Systemは検証済みProgram、検証済みMaster Data、Game Session作成時に検証済みの参加Robotを前提とする。

通常の移動不能、衝突、詰まりキャンセル、Stopによる停止はSimulator全体の失敗にしない。

Game Session、World State、Robot設計データ、Master Data間の内部整合性が失われている場合は、`inconsistent_session`の失敗結果を返し、Tick開始前のGame Sessionを変更せず、Tickを増加しない。

固定小数点演算、座標計算、角度計算、Tick計算で符号付き32bit整数または仕様で許可した安全整数の範囲を超える場合は、対象Tick更新を失敗させる。失敗時は部分更新を確定しない。

## Issue分割

Phase 6は変更対象ファイルを小さく保つため、次のIssueへ分割する。

1. Strafe Left、Strafe Right、Stop命令追加
2. MovementProgressとAction State SchemaおよびReplay保存対応
3. 固定小数点、方向ベクトル、移動距離計算ユーティリティ
4. Map境界およびObstacle衝突判定ユーティリティ
5. Movement Systemの前後移動および左右横移動
6. Movement SystemのTurn、Stop、キャンセル遷移
7. Tick統合と複数Tickシナリオテスト

各Issueは本書の該当見出しをSource Specとして指定し、対象外のPhase 6項目および後続Issueの範囲をOut of Scopeへ明記する。

## Phase 6完了条件

Phase 6は以下をすべて満たした時点で完了とする。

- 参加RobotがEngineをちょうど1つ装備している場合だけGame Sessionを作成できる
- AIから前進、後退、左右横移動、左右旋回、停止を要求できる
- Movement Systemが装備Engine性能に従って位置、向き、速度、移動系行動状態を更新する
- 前進、後退、左右横移動がMap境界およびObstacleを貫通しない
- Stop要求が仕様どおり現在行動と次動作を停止する
- 同じ完全なアプリケーションバージョン、Program、Robot設計データ、Master Data、Map、Game Rule、初期World State、乱数シードで同じ移動結果になる
- 実装済みとなった仕様が`docs/specs/current/`へ反映される
