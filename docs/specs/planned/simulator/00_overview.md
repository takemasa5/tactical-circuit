# simulator/00_overview.md

# シミュレーター概要

## 目的

本書はゲームシミュレーター全体の設計方針および責務を定義する。

シミュレーターはゲーム世界を更新する唯一のモジュールであり、AI実行結果をゲーム世界へ反映する。

個々の処理の詳細は各仕様書で定義し、本書ではシミュレーター全体の共通仕様を扱う。

---

# 基本理念

シミュレーターはゲーム世界（World State）の更新を担当する。

AIはゲーム世界を直接変更せず、Execution Contextを通じて行動要求を生成する。

シミュレーターはその要求を解釈し、ゲームルールに従ってゲーム世界を更新する。

ゲーム内のすべての状態変更はシミュレーターを経由して行われる。

---

# 責務

シミュレーターは以下を担当する。

- Tick管理
- World State更新
- ロボット更新
- 移動処理
- 武器処理
- 弾更新
- センサー更新
- 衝突判定
- 命中およびダメージ発生の判定
- ダメージのWorld Stateへの適用
- 勝敗判定
- World State変更内容のリプレイシステムへの通知
- リプレイ再生時のWorld State更新

以下は担当しない。

- AI編集
- AI命令の解釈
- プログラム検証
- UI描画

---

# World State

シミュレーターはWorld Stateを管理する。

World Stateにはゲーム中のすべての状態が含まれる。

例

- ロボット
- 弾
- マップ
- エフェクト
- 時間
- オブジェクト

World Stateはゲーム中の唯一の真実（Single Source of Truth）とする。

World StateはGame Sessionで共有する`xorshift32`乱数生成器の内部状態を保持する。

World State内のRobotはTickをまたぐRobot状態を保持する。Robot状態には以下を含む。

- 各部位のダメージ量
- 熱の蓄積量
- 現在実行中の行動
- 残弾数
- AI Runtime State

Robot状態は実行時Robot ID、Robot設計データID、位置、向き、速度、現在HP、エネルギー、熱、`active`または`destroyed`の状態、スロットごとのダメージ量、選択中Weaponスロット、残弾数、AI Runtime State、カテゴリ別行動要求を保持する。エネルギー0による行動不能は状態として保存せず、エネルギー値から判定する。

Bullet状態は`bullet_{World State内連番}`形式のID、発射元Robot ID、Weapon Definition ID、Projectile Definition ID、位置、進行Vector、残り寿命Tick数を保持する。World Stateは次回のBullet ID発番値を保持し、削除済みIDを再利用しない。弾の大きさはProjectile Definitionから取得する。

AI Runtime Stateは、次Tickで実行するノードID、レジスタ、フラグ、コールスタック、永続AIメモリを含む。

---

# Tick

ゲームはTick単位で更新される。

各Tickでは決められた順序で更新処理を実行する。

Tick長はゲーム全体で共通とする。

通常シミュレーション開始時のTickは0とする。通常シミュレーションの更新が1回完了した場合のみTickを1増加する。

---

# 更新順序

シミュレーターは毎Tick、以下の順序で処理を行う。

1. Tick開始
2. センサー更新
3. AI実行
4. 行動要求取得
5. 移動更新
6. 武器更新
7. 弾更新
8. 衝突判定
9. ダメージ処理
10. 状態更新
11. 勝敗判定
12. Tick更新
13. リプレイ記録

処理順序はゲーム全体で統一する。

---

# AIとの関係

SimulatorはTick開始時のWorld Stateから、Robot状態、AI Runtime State、センサー情報、Robotを中心とした座標系に変換した情報、乱数内部状態を含むExecution Inputを生成する。

シミュレーターはProgramとExecution InputをAI Engineへ渡し、行動要求、更新後のAI Runtime State、更新後の乱数内部状態を含むExecution Resultを取得する。

シミュレーターはExecution ResultのAI Runtime Stateと乱数内部状態をWorld Stateへ反映してから次のRobotのAIを実行する。すべてのAI実行後、行動要求をゲームルールに従って同時に実行する。

AIはWorld Stateを直接変更できない。

---

# パーツとの関係

シミュレーターはRobotに装備されたパーツを参照する。

各パーツが提供する能力を利用して処理を行う。

パーツ自身はゲーム進行を制御しない。

---

# 行動要求

行動要求とはAIが生成した実行希望である。

例

- 前進
- 後退
- 左横移動
- 右横移動
- 左旋回
- 右旋回
- 武器発射
- 武器切替
- 格闘
- 停止

行動要求は移動系、戦闘系の2カテゴリに分ける。同一Tick内で同じカテゴリの行動要求が複数回生成された場合、Simulatorはそのカテゴリで最後に生成された要求だけを処理する。異なるカテゴリの要求は同一Tickで併用でき、カテゴリ間では競合しない。

- 移動系：前進、後退、左旋回、右旋回、左横移動、右横移動、停止
- 戦闘系：武器切替、武器発射、格闘

各行動要求は`type`を判別子とし、そのほかに、どのように実行するか、および何をもって行動完了とするかを行動固有のプロパティとして持つ。Simulatorは`type`によって要求の種類を判別し、その`type`に対応する構造として処理する。

AI EngineはRobotの現在の動作段階を考慮せず、Programに従って行動要求を生成する。Simulatorは現在の動作状態と新しい行動要求を照合し、要求を採用、上書き、キャンセル、次動作として保持、または無視する。要求が採用されなかった場合もAI命令の実行時エラーにはしない。

採用した行動要求は、完了またはキャンセルされるまでTickをまたいで有効とする。後続Tickで同じカテゴリの要求がない場合も現在の行動と次動作を取り消さない。

Robotの行動は予備動作、実動作、事後動作の順に進行する。予備動作はキャンセルでき、キャンセル時は事後動作を行わず新しい行動の予備動作へ移る。実動作のキャンセル可否は行動ごとに定義する。実動作を開始した行動は、正常完了またはキャンセルのどちらでも、次の行動へ移る前に事後動作を完了する。事後動作はキャンセルできない。

Simulatorはカテゴリごとに現在の行動と最大1件の次動作を保持する。次動作の開始前に新しい要求を保持した場合は、最新の要求で上書きする。現在の行動に対する同一要求の判定、動作段階ごとの要求処理、および次動作への遷移は`docs/specs/current/instructions/concept.md`に従う。

各段階の長さ、効果を発生させる時点、実動作のキャンセル可否、および行動完了条件は行動ごとの個別仕様で定義する。

武器切替、武器発射、格闘は同じ戦闘系カテゴリであるため同一Tickでは最後の要求だけを処理し、並行して実行しない。武器発射要求は、Simulatorが要求を実行する時点で選択されているWeaponだけを対象とし、複数Weaponを同時に発射しない。

シミュレーターはゲームルールに従って要求を実現する。

要求が実現できない場合は安全に無視する。

---

# センサー更新

センサー情報はシミュレーターが生成する。

センサー情報はTick開始時に更新し、そのTickのExecution Inputへ格納する。

AIは現在Tick中のセンサー情報を変更できない。シミュレーターも次のTick開始までセンサー情報を再計算しない。

検出Robot情報には、実行時Robot ID、ワールド座標系の位置、Robotを中心とした座標系の相対位置、距離、相対方位、Robot状態を格納する。ワールド座標系の位置は、個別命令のための座標変換ではなく、検出対象の基礎情報としてセンサースナップショットへ含める。

センサーはRobotに加えて弾を検出対象とする。発射元にかかわらず、すべての弾を検出対象とする。

---

# ダメージ

シミュレーターは衝突と命中を判定し、ダメージが発生するかを決定する。

ダメージが発生する場合、シミュレーターは命中情報をWeapon Systemへ渡し、ダメージ量の算出を依頼する。

Weapon Systemは武器データ、命中情報、対象の防御データを元にダメージ量を算出し、結果のみを返す。

シミュレーターは返されたダメージ量をWorld Stateへ適用する。AIおよびWeapon SystemはWorld Stateのダメージ状態を直接変更しない。

ダメージ計算方法はWeapon仕様およびRobot仕様に従い、武器ごとの性能値はデータとして定義する。

---

# 勝敗判定

勝敗判定はシミュレーターが担当する。

例

- 全滅
- 制限時間終了
- 特殊ルール

勝敗ルールはゲームモードによって変更できる。

初期Game Ruleの通常勝敗判定は以下とする。

- HPが0になったRobotは撃破状態とする
- エネルギーが0になったRobotは行動不能とするが、撃破状態にはしない
- Robotが撃破状態になっても、World Stateに弾が残っている間はTickを継続する
- 相手Robotが撃破状態、World Stateに弾が残っていない、かつTick上限に達していない場合にのみ勝利とする
- 両方のRobotが撃破状態になり、World Stateに弾が残っていない場合は引き分けとする
- Tick上限に達した場合は、残HPその他の状態にかかわらず引き分けとする

撃破済みRobotが発射した弾も、消滅するまで通常どおり更新と命中判定を行う。

勝敗結果は勝者Robot ID配列と終了理由を保持する。終了理由は、相手撃破による勝利を`opponent_destroyed`、相互撃破による引き分けを`mutual_destruction`、Tick上限による引き分けを`tick_limit`とする。

---

# リプレイ

通常シミュレーション開始時、シミュレーターは初期World Stateをリプレイシステムへ通知する。

毎Tick、シミュレーターはWorld Stateへ適用したすべての変更内容を適用順序とともにリプレイシステムへ通知する。リプレイシステムはそれをReplay Dataとして保存する。

リプレイ再生時、シミュレーターはReplay Dataの初期World Stateから再生用World Stateを作成する。その後、Replay Systemから受け取ったTickごとの変更内容を順番に適用する。

リプレイ再生ではAI、センサー、物理、武器の計算を再実行しない。Rendererは更新後の再生用World Stateのみを参照する。

Replay Dataの読込時は以下を検証し、違反するデータを拒否する。

- 初期World State内のRobot IDとBullet IDが、それぞれの配列内で一意である
- FrameのTickが初期World StateのTickより後から始まり、Frame配列内で狭義単調増加する
- `robot_updated`が初期World Stateに存在するRobot IDだけを更新する
- 初期BulletおよびBulletの生成・更新イベントの`ownerRobotId`が、初期World Stateに存在するRobot IDを参照する
- `bullet_created`が初期World Stateとそれ以前のイベントで一度も発番されていないBullet IDを使用する
- `bullet_updated`と`bullet_removed`が、そのイベントの適用時点で存在するBullet IDだけを対象とする
- `bullet_updated`の`ownerRobotId`、Weapon Definition ID、Projectile Definition IDが、初期World Stateまたは`bullet_created`で確定した値と一致する
- 削除したBullet IDが後続イベントで再利用されない

FrameはTick昇順に処理し、同一Frame内のイベントはイベント配列順に検証および適用する。初期World Stateに存在するBulletは、発番済みかつ存在中のBulletとしてイベントの検証を開始する。

---

# Deterministic

シミュレーターは決定論的に動作する。

以下が同一であれば常に同じ結果となる。

- World State
- AI
- Tick
- パーツ構成
- 乱数シード
- 完全なアプリケーションバージョン
- Master Data

これによりリプレイやデバッグを可能とする。

---

# エラー処理

シミュレーターは異常入力によって停止してはならない。

不正な行動要求は無視または既定動作へ置き換える。

ゲーム世界の整合性を常に維持する。

---

# モジュール構成

シミュレーターは以下のモジュールで構成する。

- Tick Manager
- World Manager
- Robot Manager
- Movement System
- Weapon System
- Projectile System
- Collision System
- Damage System
- Sensor System
- Rule System
- Replay Change Emitter

各モジュールは独立して実装可能であること。

---

# 拡張性

シミュレーターは以下を追加できる構造とする。

- 新しい武器
- 新しいロボット
- 新しいセンサー
- 新しいゲームルール
- 新しいマップ
- 新しいオブジェクト

既存モジュールへの影響を最小限に抑えることを原則とする。

---

# 個別仕様書

シミュレーターの詳細仕様は以下で定義する。

- world.md
- tick.md
- movement.md
- weapons.md
- projectiles.md
- collision.md
- damage.md
- sensors.md
- rules.md
- replay.md

本書では各処理のアルゴリズムや数値設定は扱わない。
