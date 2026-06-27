# ai/00_overview.md

# AI実行エンジン概要

## 目的

本書はAI実行エンジンの設計方針および共通仕様を定義する。

AI実行エンジンは、プログラムエディタで作成されたAIを解釈・実行し、ロボットの行動要求を生成する。

個々の命令の動作は `instructions/` 配下で定義し、本書では実行環境のみを扱う。

---

# 基本理念

AI実行エンジンは、ゲーム世界から独立した仮想実行環境である。

AIはゲーム世界を直接操作せず、Execution Context を介してゲーム世界を認識し、行動要求を生成する。

AI実行エンジンはゲームロジックを持たず、プログラムの実行のみを担当する。

---

# 責務

AI実行エンジンは以下を担当する。

* プログラム実行
* 命令実行
* Program Counter管理
* CPU管理
* レジスタ管理
* メモリ管理
* コールスタック管理
* Execution Context管理
* デバッグ情報生成

以下は担当しない。

* 描画
* 物理演算
* 当たり判定
* 武器処理
* センサー計算
* 勝敗判定

---

# 実行対象

AI実行エンジンは以下を入力として受け取る。

* Program
* Execution Input

Execution InputはSimulatorがWorld Stateから生成する読み取り専用スナップショットである。AI実行エンジンはWorld Stateを直接参照しない。

AI実行終了後、行動要求、更新後のAI Runtime State、更新後の乱数内部状態を含むExecution ResultをSimulatorへ返却する。

---

# 実行モデル

AIはTick単位で実行される。

各Tickでは新しいExecution Contextが生成される。

AIはExecution Context上で命令を実行し、終了後にExecution Contextは破棄される。

TickをまたぐAI Runtime StateはWorld State内のRobotが保持する。AI Runtime Stateは、次Tickで実行するノードID、レジスタ、フラグ、コールスタック、永続AIメモリを含む。

Execution ContextはExecution Input内のAI Runtime Stateから作業コピーを生成し、現在のTickの実行中のみ更新する。

---

# Program Counter

Program Counter は現在実行中の命令を指す。

戦闘開始時はProgramの開始ノードを指す。Tick開始時はAI Runtime Stateに保存された次実行ノードから再開する。

命令実行後は、命令が指定する接続先へ移動する。

Program Counterの更新方法は命令によって決定される。

---

# 命令実行

AI実行エンジンは命令の意味を解釈しない。

各命令へExecution Contextを渡し、命令がExecution Contextを更新する。

命令実行後、Program Counterを更新し、次の命令へ進む。

---

# Execution Context

Execution Context はAI実行中の状態を保持する。

AI実行エンジンはExecution Contextの生成・初期化・破棄を担当する。

Execution Contextの詳細は `instructions/concept.md` を参照する。

---

# レジスタ

AI実行エンジンはレジスタ領域を管理する。

命令はExecution Contextを介してレジスタへアクセスする。

レジスタ数や型は別仕様書で定義する。

レジスタはAI Runtime Stateの一部としてTickをまたいで保持する。

---

# メモリ

AI実行エンジンは、Robotが保持する永続AIメモリから生成したExecution Context内の作業コピーへのアクセスを提供する。

メモリはTickをまたいで保持される。

AI実行終了後も保持される。

Tick開始時にAI Runtime StateをExecution Contextへ作業コピーとして渡す。AI命令は作業コピーのみを更新する。

AI実行終了後、SimulatorがExecution Resultに含まれる更新後のAI Runtime StateをWorld State内のRobotへ反映する。AI実行エンジンはRobotを直接更新しない。

---

# コールスタック

CALL命令およびRETURN命令を使用する場合、AI実行エンジンはコールスタックを管理する。

スタックサイズや動作は別仕様書で定義する。

コールスタックはAI Runtime Stateの一部としてTickをまたいで保持する。

---

# CPU

AI実行エンジンはCPU消費量を管理する。

各命令実行時にCPUを消費する。

CPU上限へ到達した場合、そのTickのAI実行を終了する。

CPU上限へ到達するまでに生成した行動要求は破棄しない。

CPU上限へ到達した場合、現在のProgram Counterが指す次実行ノードをAI Runtime Stateに保存する。次のTickはそのノードから再開する。

そのTickのCPU使用量とCPU残量はTickをまたがず、次TickのExecution Context生成時に初期化する。

終了ノードへ到達した場合はそのTickのAI実行を終了し、次Tickで実行するノードをProgramの開始ノードとする。

CPU制限はゲームバランスを目的とした論理的制約である。

---

# エラー処理

AI実行中のエラーによってゲーム全体を停止させてはならない。

異常が発生した場合は安全な既定値を使用し、AI実行を継続する。

構造上の問題はProgram Validatorが事前に検出する。

---

# Deterministic

AI実行は決定論的でなければならない。

同一Program

同一Robot

同一Execution Context

同一の完全なアプリケーションバージョン

同一Master Data

で実行した場合、必ず同じ結果を返すこと。

---

# デバッグ

AI実行エンジンはデバッグ情報を生成する。

例

* 現在命令
* 実行履歴
* Program Counter
* CPU使用量
* レジスタ内容
* メモリ内容
* 行動要求

デバッグ情報はゲーム進行へ影響を与えない。

---

# モジュール構成

AI実行エンジンは以下のモジュールで構成する。

* Program Loader
* Execution Context
* Scheduler
* Instruction Dispatcher
* Register Manager
* Memory Manager
* Stack Manager
* CPU Manager
* Debug Logger

各モジュールは独立して実装可能であること。

---

# Simulatorとの関係

AI実行エンジンはSimulatorを直接操作しない。

AI実行エンジンはSimulatorが生成したExecution Inputを受け取る。AI実行終了後、行動要求、更新後のAI Runtime State、更新後の乱数内部状態をExecution ResultとしてSimulatorへ返す。

両者は疎結合であることを原則とする。

---

# Program Validatorとの関係

AI実行エンジンは、Program Validatorを通過したProgramのみ受け付ける。

Program構造の検証はAI実行エンジンの責務ではない。

---

# 拡張性

AI実行エンジンは、新しい命令や命令カテゴリを追加しても変更を最小限に抑えられる構造とする。

命令の追加によってProgram CounterやExecution Contextの基本仕様を変更しないことを原則とする。

---

# 個別仕様書

AI実行エンジンの詳細は以下の仕様書で定義する。

* execution_context.md
* scheduler.md
* cpu.md
* registers.md
* memory.md
* stack.md
* dispatcher.md
* debug.md

本書では各モジュールの実装方法や数値設定は扱わない。
