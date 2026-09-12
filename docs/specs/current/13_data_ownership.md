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

Robot設計データは以下を含む。

- Robot設計データID
- 名前（必須）
- 作者（必須、空文字を許容）
- 説明（必須、空文字を許容）
- 作成日時（必須）
- 更新日時（必須）
- Robot Body Definition ID
- Program ID 1つ
- 初期選択Weaponの手
- スロットIDと装備するPart Definition IDの対応
- Weaponを装備したスロットごとの初期装弾数

作成日時と更新日時はISO 8601形式の文字列とする。装備順には意味を持たせない。空スロットと、同一Part Definitionを複数スロットへ装備することを許容する。

装備はスロットIDをキー、Part Definition IDを値とする`equipment`オブジェクトとして保持する。`equipment`にキーが存在しないスロットは空スロットとする。

初期装弾数はWeaponを装備したスロットIDをキー、符号付き32bit整数を値とする`ammunition`オブジェクトとして保持する。Weaponを装備したすべてのスロットで指定を必須とし、0を許容する。参照するWeapon Definitionの装弾上限数以下とする。装備スロット、Partカテゴリ、装弾上限の整合性はData Repositoryを使用して読込時に検証する。

初期選択Weaponの手は`initialWeaponHand`として`right`、`left`、または`null`のいずれかを必ず保持する。`null`はWeapon未選択を表す。`right`または`left`はRobot Body Definitionの`weaponMount`がそれぞれ`right_hand`または`left_hand`であるWeapon Slot IDへ解決する。指定した手のWeapon Slotが空の場合は検証Errorとし、別の手または`null`へ暗黙変換しない。

Robot設計データの保存と読込では`initialWeaponHand`を保持する。フィールドが欠損したJSONを暗黙補完せず、読込Errorとする。初期公開前の`formatVersion`は`0.1.1`のままとする。

Editorは作業中のRobot設計データを作成、読取、更新、削除する。Save Managerは保存と読込を担当する。

シミュレーション開始時に実行用の読み取り専用スナップショットを作成する。

---

# Game Session

Game Sessionは1回の通常シミュレーションを表す実行単位である。Game Session自体のIDは持たない。実行用Program、Robot設計データ、Robotの参加者配列、初期乱数シード、マップID、ゲームルールID、Master Dataのバージョン、World Stateを含む。

同じRobot設計データから複数のRobotを参加させることを許容する。

参加者は実行時Robot ID、Robot設計データの読み取り専用スナップショット、Programの読み取り専用スナップショットを持つ。

Simulatorはシミュレーション開始時にGame Sessionを作成し、シミュレーション終了後に破棄する。戦闘途中のGame Sessionは保存しない。

---

# World State

World StateはGame SessionまたはReplay Sessionにおけるゲーム世界の内部表現である。

以下を含む。

- Tick
- Robotの位置、ダメージ量、発熱量、状態
- RobotのAI Runtime State
- 発射された弾の位置とベクトル
- 障害物の位置と大きさ
- ゲームの進行状態と勝敗結果
- 共通乱数生成器の内部状態

World State内の位置とベクトルはワールド座標系で保持する。

Robot状態は、実行時Robot ID、Robot設計データID、位置、向き、速度、現在HP、エネルギー、熱、`active`または`destroyed`の状態、スロットごとのダメージ量、選択中Weaponスロット、スロットごとの残弾数、AI Runtime State、カテゴリ別行動要求、およびカテゴリ別行動状態を保持する。カテゴリ別行動要求はAI EngineがそのTickに生成した`movement`と`combat`の要求であり、現在動作や次動作を保持するカテゴリ別行動状態とは区別する。

カテゴリ別行動状態はSimulatorだけが読み取りおよび更新する。`movement`と`combat`はそれぞれ現在行動`current`と次動作`next`を持つ。現在行動は要求、`preparing`、`executing`、`recovering`の段階、段階内の経過Tick、および行動別進捗を持つ。

```ts
type ActionCategoryState<TRequest, TProgress> = {
  readonly current: CurrentAction<TRequest, TProgress> | null;
  readonly next: TRequest | null;
};

type CurrentAction<TRequest, TProgress> =
  | {
      readonly request: TRequest;
      readonly phase: "preparing";
      readonly phaseElapsedTicks: Int32;
      readonly progress: null;
    }
  | {
      readonly request: TRequest;
      readonly phase: "executing";
      readonly phaseElapsedTicks: Int32;
      readonly progress: TProgress;
    }
  | {
      readonly request: TRequest;
      readonly phase: "recovering";
      readonly phaseElapsedTicks: Int32;
      readonly progress: null;
    };

type RobotActionState = {
  readonly movement: ActionCategoryState<MovementRequest, MovementProgress>;
  readonly combat: ActionCategoryState<CombatRequest, CombatProgress>;
};
```

`MovementProgress`は行動`type`ごとの判別可能な共用体とする。Phase 1では、Move Forwardが固定小数点内部位置と累積実移動距離、Turnが旋回方向を保持する。`CombatProgress`はPhase 1では具体型を持たず、Fireの発射間隔は`recovering`の`phaseElapsedTicks`で管理する。

World State SchemaとReplay Data Schemaは`actionState`を検証する。Replay保存時は現在行動と次動作に含まれる要求を、`actionRequests`と同じ規則で正規化する。

Bullet状態は、World State内Bullet ID、発射元Robot ID、Weapon Definition ID、Projectile Definition ID、位置、進行Vector、残り寿命Tick数を保持する。Bullet IDは`bullet_{World State内連番}`形式とし、World Stateが次回の発番値を保持して削除済みIDを再利用しない。弾の大きさはBullet状態へ重複して保持せず、Projectile Definitionから取得する。障害物状態は、障害物ID、位置、軸平行矩形サイズを保持する。

World Stateは以下を保持する。

- Tick
- Robot状態配列
- Bullet状態配列
- 障害物配列
- ゲーム進行状態
- 勝敗結果
- Random State
- 次に発番するBullet IDの連番

ゲーム進行状態は`ready`、`running`、`finished`のいずれかとする。勝敗結果は勝者RobotのID配列と終了理由を保持する。勝者RobotのID配列が空の場合は引き分けを表す。チーム情報は保持しない。

Simulatorはセッション開始時にWorld Stateを作成し、毎Tick読み取りおよび更新し、セッション終了時に破棄する。World Stateを更新できるのはSimulatorだけとする。

RenderingはWorld Stateを読み取るが更新しない。

---

# AI Runtime State

AI Runtime StateはWorld State内のRobotが保持する、TickをまたぐAI実行状態である。

以下を含む。

- 次Tickで実行するノードID
- レジスタ
- フラグ
- コールスタック
- 永続AIメモリ

レジスタはレジスタ名をキーとする符号付き32bit整数のオブジェクト、フラグはフラグ名をキーとするbooleanのオブジェクト、コールスタックはNode ID配列とする。永続AIメモリは符号付き32bit整数配列を`values`に持つオブジェクトとする。

戦闘開始時は開始ノードを次実行ノードとする。CPU不足で命令を実行できなかった場合は、そのNodeから次Tickの実行を再開する。

命令実行結果の`interruptTick`が`true`の場合、`nextNodeId`がNode IDならそのNodeを次Tickの実行ノードとし、`null`なら開始ノードを次Tickの実行ノードとする。終了ノードは`nextNodeId`を`null`としてTickを中断する。

実行時エラーの場合も開始ノードを次Tickの実行ノードとする。

---

# Execution Input

Execution InputはSimulatorがTick開始時のWorld Stateから生成する、AI Engine向けの読み取り専用スナップショットである。

以下を含む。

- Tick開始時の自機Robot状態
- AI Runtime State
- Tick開始時に確定したセンサー情報
- Robotを中心とした座標系へ変換した位置とベクトル
- 共通乱数生成器の内部状態
- カテゴリ別の行動状態

Execution InputはWorld State全体を公開しない。AI EngineはExecution Inputを読み取るが変更しない。Simulatorは対象TickのAI実行終了後にExecution Inputを破棄する。

Execution Inputの`robot`はRobot Stateそのものではなく、Simulator所有の`actionState`を除外した専用の`ExecutionRobotSnapshot`とする。Snapshot生成時は位置、速度、ダメージ、残弾、AI Runtime State、行動要求を複製し、元のRobot Stateと可変参照を共有しない。

```ts
type ExecutionRobotSnapshot = Omit<RobotState, "actionState">;

type ExecutionInput = {
  readonly tick: Int32;
  readonly robot: ExecutionRobotSnapshot;
  readonly aiRuntimeState: AIRuntimeState;
  readonly sensors: SensorSnapshot;
  readonly randomState: RandomState;
  readonly actionStatus: ActionStatusSnapshot;
};
```

Execution Input用JSON SchemaはRobot State Schemaを直接再利用せず、`actionState`をプロパティとして受け付けない。

Execution Input内の検出Robot情報は、実行時Robot ID、ワールド座標系の位置、Robotを中心とした座標系の相対位置、距離、Robotの正面を0度とする相対方位、Robot状態を含む。ワールド座標系の位置は、検出対象の基礎情報としてSimulatorがセンサースナップショット生成時に格納する。AI EngineはWorld Stateを参照せず、このスナップショットだけを使用する。

カテゴリ別の行動状態は`movement`と`combat`を持ち、それぞれ`idle`または`running`とする。対象カテゴリに現在の行動または次動作が存在する場合は`running`、どちらも存在しない場合は`idle`とする。AI Engineへ現在の動作段階や進捗などの詳細状態は公開しない。

```ts
type ActionStatusSnapshot = {
  readonly movement: "idle" | "running";
  readonly combat: "idle" | "running";
};
```

---

# Execution Context

Execution ContextはAI Engineが毎Tick作成するAI実行環境である。

以下を含む。

- Programへの読み取り専用参照
- Execution Inputへの読み取り専用参照
- AI Runtime Stateの作業コピー
- CPU使用量とCPU残量
- 一時変数
- そのTickの行動要求
- 共通乱数生成器の内部状態の作業コピー

AI命令はExecution Contextだけを読み取り、write、コールスタック操作、乱数内部状態の更新、行動要求の変更をExecution Context Changesとして返す。AI Engineは命令の正常終了後に変更要求をExecution Contextへ反映し、AI実行終了後にExecution Contextを破棄する。

---

# Execution Result

Execution ResultはAI EngineがAI実行終了時に生成する、Simulatorがゲーム進行へ反映する出力である。

以下を含む。

- そのTickの行動要求
- 更新後のAI Runtime State
- 更新後の共通乱数生成器の内部状態

Simulatorは行動要求をゲームルールに従って処理し、AI Runtime StateをWorld State内のRobotへ、乱数内部状態をWorld Stateへ反映する。Execution Resultは反映後に破棄する。

AI Engineが返すAIExecutionOutputはExecution Resultとデバッグ情報を持つ。デバッグ情報は命令の実行履歴、終了理由、任意の実行時エラー、CPU使用量、実行Node数を含む。Simulatorはデバッグ情報をWorld Stateへ反映せず、デバッグ情報はゲーム進行と決定論的な結果へ影響を与えない。

---

# Replay Data

Replay DataはReplay Systemが所有する。

通常シミュレーション開始時のWorld Stateと、SimulatorがTickごとにWorld Stateへ適用したすべての変更内容を適用順序付きで保持する。

リプレイ再生時に乱数の生成や再判定を行わない。乱数によって発生した結果はWorld Stateの変更内容として記録する。

Simulatorは変更内容をReplay Systemへ通知するが、Replay Dataを直接更新しない。

Phase 1の固定対戦Application ServiceはReplay Dataとは別に、開始時と各Tick完了後のWorld Stateを独立して複製、freezeした一時Snapshot配列を所有する。この配列は同一ブラウザーセッション内の先頭からの再生にだけ使用し、永続保存しない。

---

# Save Data

Save DataはSave Managerが所有する。保存形式はJSONとする。

## ユーザー情報

ユーザーが作成したProgramとRobot設計データを含む。Replay Dataは含まない。UIからのユーザー操作を受け、Save Managerが作成、読取、更新、削除を行う。

## リプレイ保存データ

Replay Data、使用したRobot設計データ、Program、マップID、ゲームルールID、初期乱数シード、`masterDataVersion`を含む。Master Data本体は含めない。

リプレイ読込時に現在のData Repositoryの`masterDataVersion`が記録値と一致しない場合は、読込を安全に拒否する。

リプレイ保存データ内のRobot設計データIDとProgram IDは、それぞれの配列内で一意とする。初期World StateのRobotが参照するRobot設計データと、各Robot設計データが参照するProgramはリプレイ保存データ内に存在しなければならない。

Map、Game Rule、Weapon、Projectileへの参照は現在のData Repositoryで解決できなければならない。BulletのProjectile Definition IDは、同じBulletが参照するWeapon DefinitionのProjectile Definition IDと一致しなければならない。

シミュレーション終了時、Save ManagerはReplay SystemからReplay Dataを受け取り、リプレイ保存データを自動的に`localStorage`へ保存する。ユーザー操作によるexport、import、削除を可能とする。

戦闘途中のGame SessionまたはWorld StateはSave Dataとして保存しない。シミュレーション終了前にアプリケーションを終了した場合、実行中の状態は失われる。

---

# CRUD一覧

| データ                        | 作成            | 読取                           | 更新               | 削除          |
| ----------------------------- | --------------- | ------------------------------ | ------------------ | ------------- |
| Program作業データ             | Editor          | Editor / Validator             | Editor             | Editor        |
| Master Data                   | Data Repository | Simulator / AI Engine / Editor | 公開後はなし       | 公開後はなし  |
| Program実行用スナップショット | Simulator       | AI Engine                      | なし               | Simulator     |
| Robot設計データ               | Editor          | Editor / Simulator             | Editor             | Editor        |
| Game Session                  | Simulator       | Simulator                      | Simulator          | Simulator     |
| World State                   | Simulator       | Simulator / Rendering          | Simulator          | Simulator     |
| Execution Input               | Simulator       | AI Engine                      | なし               | Simulator     |
| Execution Context             | AI Engine       | AI Engine / AI命令             | AI Engine / AI命令 | AI Engine     |
| Execution Result              | AI Engine       | Simulator                      | なし               | Simulator     |
| Replay Data                   | Replay System   | Replay System                  | Replay System      | Replay System |
| Save Data                     | Save Manager    | Save Manager                   | Save Manager       | Save Manager  |
