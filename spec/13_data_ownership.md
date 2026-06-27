# 13_data_ownership.md

# データの分類と所有権

## 目的

本書は、主要データの定義、寿命、所有モジュール、読み書き権限を定義する。

---

# Program

ProgramはユーザーがEditorで作成したAIプログラムである。

Editorは作業中のProgramを作成、読取、更新、削除する。Save ManagerはProgramの保存と読込を担当する。

シミュレーション開始時に実行用Programの読み取り専用スナップショットを作成する。AI Engineはそのスナップショットのみを読み取り、シミュレーション中に変更しない。

---

# Robot設計データ

Robot設計データはユーザーがEditorで作成する機体とパーツの構成である。

Editorは作業中のRobot設計データを作成、読取、更新、削除する。Save Managerは保存と読込を担当する。

シミュレーション開始時に実行用の読み取り専用スナップショットを作成する。

---

# Game Session

Game Sessionは1回の通常シミュレーションを表す実行単位である。実行用Program、Robot設計データ、Robotの参加者配列、初期乱数シード、ゲームルール、World Stateを含む。

Simulatorはシミュレーション開始時にGame Sessionを作成し、シミュレーション終了後に破棄する。戦闘途中のGame Sessionは保存しない。

---

# World State

World StateはGame SessionまたはReplay Sessionにおけるゲーム世界の内部表現である。

以下を含む。

* Tick
* Robotの位置、ダメージ量、発熱量、状態、実行中の行動
* RobotのAI Runtime State
* 発射された弾の位置とベクトル
* 障害物の位置と大きさ
* ゲームの進行状態と勝敗結果
* 共通乱数生成器の内部状態

World State内の位置とベクトルはワールド座標系で保持する。

Simulatorはセッション開始時にWorld Stateを作成し、毎Tick読み取りおよび更新し、セッション終了時に破棄する。World Stateを更新できるのはSimulatorだけとする。

RenderingはWorld Stateを読み取るが更新しない。

---

# AI Runtime State

AI Runtime StateはWorld State内のRobotが保持する、TickをまたぐAI実行状態である。

以下を含む。

* 次Tickで実行するノードID
* レジスタ
* フラグ
* コールスタック
* 永続AIメモリ

戦闘開始時は開始ノードを次実行ノードとする。CPU上限でAI実行を終了した場合は、中断時の次実行ノードから次Tickの実行を再開する。終了ノードへ到達した場合は、開始ノードを次Tickの実行ノードとする。

---

# Execution Input

Execution InputはSimulatorがTick開始時のWorld Stateから生成する、AI Engine向けの読み取り専用スナップショットである。

以下を含む。

* Tick開始時の自機Robot状態
* AI Runtime State
* Tick開始時に確定したセンサー情報
* Robotを中心とした座標系へ変換した位置とベクトル
* 共通乱数生成器の内部状態

Execution InputはWorld State全体を公開しない。AI EngineはExecution Inputを読み取るが変更しない。Simulatorは対象TickのAI実行終了後にExecution Inputを破棄する。

---

# Execution Context

Execution ContextはAI Engineが毎Tick作成するAI実行環境である。

以下を含む。

* Programへの読み取り専用参照
* Execution Inputへの読み取り専用参照
* AI Runtime Stateの作業コピー
* CPU使用量とCPU残量
* 一時変数
* そのTickの行動要求
* 共通乱数生成器の内部状態の作業コピー

AI命令はExecution Contextのみを読み書きする。AI EngineはAI実行終了後にExecution Contextを破棄する。

---

# Execution Result

Execution ResultはAI EngineがAI実行終了時に生成する出力である。

以下を含む。

* そのTickの行動要求
* 更新後のAI Runtime State
* 更新後の共通乱数生成器の内部状態

Simulatorは行動要求をゲームルールに従って処理し、AI Runtime StateをWorld State内のRobotへ、乱数内部状態をWorld Stateへ反映する。Execution Resultは反映後に破棄する。

---

# Replay Data

Replay DataはReplay Systemが所有する。

通常シミュレーション開始時のWorld Stateと、SimulatorがTickごとにWorld Stateへ適用したすべての変更内容を適用順序付きで保持する。

リプレイ再生時に乱数の生成や再判定を行わない。乱数によって発生した結果はWorld Stateの変更内容として記録する。

Simulatorは変更内容をReplay Systemへ通知するが、Replay Dataを直接更新しない。

---

# Save Data

Save DataはSave Managerが所有する。保存形式はJSONとする。

## ユーザー情報

ユーザーが作成したProgramとRobot設計データを含む。Replay Dataは含まない。UIからのユーザー操作を受け、Save Managerが作成、読取、更新、削除を行う。

## リプレイ保存データ

Replay Data、使用したRobot設計データ、Program、マップ、ゲームルール、初期乱数シード、再生に必要なマスターデータを含む。

シミュレーション終了時、Save ManagerはReplay SystemからReplay Dataを受け取り、リプレイ保存データを自動的に`localStorage`へ保存する。ユーザー操作によるexport、import、削除を可能とする。

戦闘途中のGame SessionまたはWorld StateはSave Dataとして保存しない。シミュレーション終了前にアプリケーションを終了した場合、実行中の状態は失われる。

---

# CRUD一覧

| データ | 作成 | 読取 | 更新 | 削除 |
| --- | --- | --- | --- | --- |
| Program作業データ | Editor | Editor / Validator | Editor | Editor |
| Program実行用スナップショット | Simulator | AI Engine | なし | Simulator |
| Robot設計データ | Editor | Editor / Simulator | Editor | Editor |
| Game Session | Simulator | Simulator | Simulator | Simulator |
| World State | Simulator | Simulator / Rendering | Simulator | Simulator |
| Execution Input | Simulator | AI Engine | なし | Simulator |
| Execution Context | AI Engine | AI Engine / AI命令 | AI Engine / AI命令 | AI Engine |
| Execution Result | AI Engine | Simulator | なし | Simulator |
| Replay Data | Replay System | Replay System | Replay System | Replay System |
| Save Data | Save Manager | Save Manager | Save Manager | Save Manager |
