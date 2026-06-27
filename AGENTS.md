# AGENTS.md

# AIエージェント向け開発ガイド

このプロジェクトは AI コーディングエージェント（Codex 等）による実装を前提として設計されている。

本書はプロジェクト全体で共通となる開発ルールを定義する。

実装時は必ず本書を確認すること。

---

# 基本方針

本プロジェクトは **仕様書駆動開発** を採用する。

実装は必ず仕様書に基づいて行うこと。

仕様に存在しない挙動を独自判断で追加してはならない。

仕様が不足している場合は実装せず、仕様追加を提案すること。

---

# 仕様書の優先順位

仕様が競合する場合は以下を優先する。

1. AGENTS.md
2. spec/01_architecture.md
3. spec/10_game_loop.md
4. spec/11_coordinate_system.md
5. spec/12_common_data_conventions.md
6. spec/13_data_ownership.md
7. spec/14_determinism_rules.md
8. spec/15_master_data.md
9. 各 overview
10. 各個別仕様
11. 実装コード

コードより仕様書を正とする。

---

# 実装方針

変更はできる限り小さく行うこと。

一度に複数の問題を解決しようとしない。

リファクタリングと機能追加は同時に行わない。

動作変更を伴う場合は仕様書を更新してから実装する。

---

# モジュールの責務

各モジュールの責務を厳守すること。

## Editor

Programを編集する。

AI実行を行わない。

ゲーム状態を変更しない。

---

## Program Validator

Programの妥当性のみ検証する。

ゲーム実行は行わない。

開始ノードから到達可能な循環のうち、条件分岐を含まず、循環外へ出る接続を持たないものを純粋な循環プログラムとして検出する。

純粋な循環プログラムはWarningとし、Errorとしない。

---

## AI Engine

Programを実行する。

Execution Contextを管理する。

World Stateを書き換えてはならない。

---

## Simulator

World Stateを更新する唯一のモジュールである。

AIを解釈しない。

Programを編集しない。

衝突と命中を判定し、ダメージが発生するかを決定する。

Weapon Systemが算出したダメージ量をWorld Stateへ適用する。

---

## Weapon System

武器データと命中情報を元にダメージ量を算出する。

命中判定を行わない。

World Stateを更新しない。

---

## Renderer

World Stateを読み取り、ゲーム状態を表示する。

ゲームロジックを持たない。

Replay Dataを直接描画しない。

---

## Replay System

シミュレーション開始時のWorld Stateと、SimulatorがTickごとにWorld Stateへ適用した変更内容をReplay Dataとして記録する。

リプレイ再生時は、Replay DataからTickごとの変更内容をSimulatorへ供給する。

World Stateを更新しない。

---

# Program

Programは静的データである。

AI実行中に変更してはならない。

ProgramはAIの実行状態を保持しない。

---

# AI Runtime State

TickをまたぐAI実行状態はWorld State内のRobotが保持する。

AI Runtime Stateは、次Tickで実行するノードID、レジスタ、フラグ、コールスタック、永続AIメモリを含む。

戦闘開始時は、次に実行するノードをProgramの開始ノードとする。

終了ノードへ到達した場合は、次Tickで実行するノードをProgramの開始ノードとする。

---

# Execution Input

SimulatorはWorld StateからExecution Inputを生成する。

Execution InputはRobot状態、AI Runtime State、センサー情報、Robotを中心とした座標系へ変換した情報、乱数内部状態を含む読み取り専用スナップショットである。

AI EngineはWorld Stateを参照せず、ゲーム世界に関する入力はExecution Inputのみから取得する。

---

# Execution Context

Execution Contextは1Tickだけ存在する。

AI命令はExecution Contextのみを読み書きする。

Execution Contextから直接World Stateを変更してはならない。

Execution ContextはExecution Inputへの読み取り専用アクセスを提供する。

Execution ContextはAI Runtime Stateと乱数内部状態の作業コピー、そのTickのCPU使用量、行動要求を保持する。センサー情報はExecution Inputを介して参照する。

CPU使用量、センサー情報、行動要求はTickをまたがない。

AI EngineはAI実行終了時にExecution Resultを生成する。Execution Resultは行動要求、更新後のAI Runtime State、更新後の乱数内部状態を含み、SimulatorがWorld Stateへ反映する。

---

# World State

World Stateはゲーム世界の唯一の状態である。

Simulatorだけが更新できる。

他モジュールは読み取りのみ行う。

通常シミュレーションとリプレイ再生は別のセッションとし、それぞれ独立したWorld Stateを持つ。

---

# 行動要求

AIはロボットを直接操作しない。

Execution Contextへ行動要求を書き込む。

AI Engineは行動要求をExecution ResultとしてSimulatorへ返す。Simulatorがその要求を実行する。

---

# Deterministic

ゲームは決定論的でなければならない。

同じ

- 完全なアプリケーションバージョン
- Program
- World State
- Tick
- 乱数シード
- Master Data

からは常に同じ結果を得られること。

minorまたはbuildバージョンの変更でも、ロジックまたはMaster Dataの変更によってシミュレーション過程と結果が変わることを許容する。

乱数は共通の乱数生成器を使用する。

Math.random()等を直接使用してはならない。

例外として、Game Session開始前の初期シード生成に限り、開発言語または実行環境の乱数生成器を使用できる。

Game Session開始後のすべての乱数は、World Stateに内部状態を保持する単一の`xorshift32`乱数生成器から取得する。

AIはGame Sessionの参加者配列順に実行し、非同期処理の完了順を乱数消費順に使用しない。

---

# データ駆動

ゲームバランスに関わる値はコードへ埋め込まない。

以下はデータとして管理する。

- 武器性能
- センサー性能
- ロボット性能
- CPU消費
- ダメージ
- 射程
- 移動速度

---

# 責務の分離

UIからゲームロジックを呼び出さない。

ゲームロジックからUIを呼び出さない。

モジュール間の循環依存は禁止する。

---

# 拡張性

新しい

- 命令
- パーツ
- ロボット
- 武器
- センサー

を追加しても既存コードの変更を最小限にすること。

条件分岐ではなくデータ追加で拡張できる設計を優先する。

---

# コーディング方針

関数はできるだけ短く保つ。

単一責任を意識する。

意味の分かる名前を使用する。

不要なコメントは書かない。

コメントは「なぜ」を説明する。

「何をしているか」はコードで表現する。

---

# エラー処理

ゲーム全体を停止させてはならない。

異常値は安全に処理する。

Program構造の問題はProgram Validatorが担当する。

AI Engineでは構造エラーを前提としない。

---

# テスト

新しい機能には可能な限りテストを追加する。

バグ修正では再発防止のテストを追加する。

---

# ドキュメント

動作変更を伴う実装では仕様書も更新する。

コードと仕様書は常に一致させる。

---

# 実装前チェック

実装前に以下を確認する。

- 関連仕様書を読んだか
- 責務を越えていないか
- 他モジュールへ影響しないか
- より小さい変更で実現できないか

---

# 実装後チェック

完了前に以下を確認する。

- ビルドが通る
- テストが通る
- Lintエラーがない
- 不要ファイルがない
- 仕様書との矛盾がない

---

# 判断に迷った場合

仕様を優先する。

責務を優先する。

拡張性を優先する。

不明点は実装せず、仕様追加を提案する。

---

# 実装時の優先順位

実装方針が複数考えられる場合は、次の優先順位で判断する。

1. 正しさ
2. 決定論の維持
3. 保守性
4. 拡張性
5. 可読性
6. パフォーマンス

パフォーマンスのみを目的として設計を複雑化してはならない。

最適化は必要性が確認された後に行う。
