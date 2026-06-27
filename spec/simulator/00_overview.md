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

* Tick管理
* World State更新
* ロボット更新
* 移動処理
* 武器処理
* 弾更新
* センサー更新
* 衝突判定
* 命中およびダメージ発生の判定
* ダメージのWorld Stateへの適用
* 勝敗判定
* World State変更内容のリプレイシステムへの通知
* リプレイ再生時のWorld State更新

以下は担当しない。

* AI編集
* AI命令の解釈
* プログラム検証
* UI描画

---

# World State

シミュレーターはWorld Stateを管理する。

World Stateにはゲーム中のすべての状態が含まれる。

例

* ロボット
* 弾
* マップ
* エフェクト
* 時間
* オブジェクト

World Stateはゲーム中の唯一の真実（Single Source of Truth）とする。

World StateはGame Sessionで共有する`xorshift32`乱数生成器の内部状態を保持する。

World State内のRobotはTickをまたぐRobot状態を保持する。Robot状態には以下を含む。

* 各部位のダメージ量
* 熱の蓄積量
* 現在実行中の行動
* 残弾数
* AI Runtime State

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

* 前進
* 後退
* 左旋回
* 右旋回
* 武器発射
* 武器切替
* ロックオン

シミュレーターはゲームルールに従って要求を実現する。

要求が実現できない場合は安全に無視する。

---

# センサー更新

センサー情報はシミュレーターが生成する。

センサー情報はTick開始時に更新し、そのTickのExecution Inputへ格納する。

AIは現在Tick中のセンサー情報を変更できない。シミュレーターも次のTick開始までセンサー情報を再計算しない。

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

* 全滅
* 制限時間終了
* 特殊ルール

勝敗ルールはゲームモードによって変更できる。

---

# リプレイ

通常シミュレーション開始時、シミュレーターは初期World Stateをリプレイシステムへ通知する。

毎Tick、シミュレーターはWorld Stateへ適用したすべての変更内容を適用順序とともにリプレイシステムへ通知する。リプレイシステムはそれをReplay Dataとして保存する。

リプレイ再生時、シミュレーターはReplay Dataの初期World Stateから再生用World Stateを作成する。その後、Replay Systemから受け取ったTickごとの変更内容を順番に適用する。

リプレイ再生ではAI、センサー、物理、武器の計算を再実行しない。Rendererは更新後の再生用World Stateのみを参照する。

---

# Deterministic

シミュレーターは決定論的に動作する。

以下が同一であれば常に同じ結果となる。

* World State
* AI
* Tick
* パーツ構成
* 乱数シード
* 完全なアプリケーションバージョン
* Master Data

これによりリプレイやデバッグを可能とする。

---

# エラー処理

シミュレーターは異常入力によって停止してはならない。

不正な行動要求は無視または既定動作へ置き換える。

ゲーム世界の整合性を常に維持する。

---

# モジュール構成

シミュレーターは以下のモジュールで構成する。

* Tick Manager
* World Manager
* Robot Manager
* Movement System
* Weapon System
* Projectile System
* Collision System
* Damage System
* Sensor System
* Rule System
* Replay Change Emitter

各モジュールは独立して実装可能であること。

---

# 拡張性

シミュレーターは以下を追加できる構造とする。

* 新しい武器
* 新しいロボット
* 新しいセンサー
* 新しいゲームルール
* 新しいマップ
* 新しいオブジェクト

既存モジュールへの影響を最小限に抑えることを原則とする。

---

# 個別仕様書

シミュレーターの詳細仕様は以下で定義する。

* world.md
* tick.md
* movement.md
* weapons.md
* projectiles.md
* collision.md
* damage.md
* sensors.md
* rules.md
* replay.md

本書では各処理のアルゴリズムや数値設定は扱わない。
