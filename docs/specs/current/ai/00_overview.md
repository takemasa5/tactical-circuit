# ai/00_overview.md

# AI実行エンジン概要

## 目的

本書はAI実行エンジンの設計方針および共通仕様を定義する。

AI実行エンジンは、プログラムエディタで作成されたAIを解釈・実行し、ロボットの行動要求を生成する。

個々の命令の動作は`docs/specs/current/instructions/`配下で定義し、本書では実行環境のみを扱う。

---

# 基本理念

AI実行エンジンは、ゲーム世界から独立した仮想実行環境である。

AIはゲーム世界を直接操作せず、Execution Context を介してゲーム世界を認識し、行動要求を生成する。

AI実行エンジンはゲームロジックを持たず、プログラムの実行のみを担当する。

---

# 責務

AI実行エンジンは以下を担当する。

- プログラム実行
- 命令実行
- Program Counter管理
- CPU管理
- レジスタ管理
- メモリ管理
- コールスタック管理
- Execution Context管理
- デバッグ情報生成

以下は担当しない。

- 描画
- 物理演算
- 当たり判定
- 武器処理
- センサー計算
- 勝敗判定

---

# 実行契約

AI実行エンジンは、生成時に検証済みData Repositoryと固定のInstruction Registryを依存関係として受け取る。Tickごとの実行時には、Program、Execution Input、選択中のGame Rule Definitionを受け取る。

```ts
type AIEngineDependencies = {
  readonly repository: DataRepository;
  readonly instructionRegistry: InstructionRegistry;
};

type AIExecutionInput = {
  readonly program: Program;
  readonly executionInput: ExecutionInput;
  readonly gameRule: GameRuleDefinition;
};

type AIExecutionOutput = {
  readonly executionResult: ExecutionResult;
  readonly debugInfo: AIDebugInfo;
};
```

ProgramはProgram Validatorを通過済みであることを前提とし、AI実行エンジンはProgramの構造を再検証しない。

Execution InputはSimulatorがWorld Stateから生成する読み取り専用スナップショットである。AI実行エンジンはWorld Stateを直接参照しない。

AI実行終了後、行動要求、更新後のAI Runtime State、更新後の乱数内部状態を含むExecution Resultと、ゲーム進行へ影響しないデバッグ情報をAIExecutionOutputとして返却する。Simulatorは`executionResult`だけをゲーム進行へ反映する。

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

命令実行後は、命令実行結果の`nextNodeId`が参照するNodeへ移動する。

命令実装には実行中Nodeの`connections`を渡す。命令実装は、選択した出力パスを接続先Node IDへ解決して`nextNodeId`として返す。CALLの呼出先とRETURNの復帰先はNode IDとして直接`nextNodeId`になる。

---

# 命令実行

AI実行エンジンは命令の意味を解釈しない。

各命令へExecution Contextへの読み取り専用アクセスを渡し、命令から`nextNodeId`、Execution Context Changes、`interruptTick`を含む命令実行結果を受け取る。

命令が正常終了した場合、AI実行エンジンはExecution Context Changesをまとめて反映する。`interruptTick`が`false`なら`nextNodeId`へProgram Counterを更新して同一Tickの実行を続ける。

`interruptTick`が`true`なら、そのTickのAI実行を終了する。`nextNodeId`がNode IDなら次TickはそのNodeから、`null`ならProgramのStart Nodeから開始する。

1Tickで正常終了できるCPUコスト0のNode数の上限は、選択中のGame Rule Definitionの`cpuLimit`と2の大きい方とする。これにより`cpuLimit`が1の場合もStartからEndまでを同一Tickで実行できる。正常終了したCPUコスト0の命令だけを上限判定用の実行Node数へ加算し、次のCPUコスト0のNodeを実行する前に上限を確認する。CPUコスト1以上のNodeはこの上限へ数えず、CPU残量によって実行可否を判定する。

CPUコスト0の実行Node数上限への到達は実行時エラーとしない。上限到達までのExecution Context Changes、行動要求、CPU消費を維持し、次に実行予定だったNodeを次Tickの再開位置とする。上限と同じ件数目のCPUコスト0命令が`interruptTick`によってTickを終了した場合は、命令による終了を優先する。

---

# Execution Context

Execution Context はAI実行中の状態を保持する。

AI実行エンジンはExecution Contextの生成・初期化・破棄を担当する。

Execution Contextの詳細は`docs/specs/current/instructions/concept.md`を参照する。

---

# レジスタ

AI実行エンジンはレジスタ領域を管理する。

命令はExecution Contextを介してレジスタへアクセスする。

Game Rule Definitionはレジスタ名の配列を`registerNames`として定義する。既定値は`A`、`B`、`C`、`D`の4つとし、それぞれ符号付き32bit整数を保持する。初期値はすべて0とする。レジスタは配列ではなく、レジスタ名をキーとする独立したオブジェクトとして保持する。

レジスタはAI Runtime Stateの一部としてTickをまたいで保持する。

Game Rule Definitionはフラグ名の配列を`flagNames`として定義する。既定値は`F1`、`F2`、`F3`の3つとし、それぞれ真偽値を保持する。初期値はすべて`false`とする。フラグは配列ではなく、フラグ名をキーとする独立したオブジェクトとして保持する。

---

# メモリ

AI実行エンジンは、Robotが保持する永続AIメモリから生成したExecution Context内の作業コピーへのアクセスを提供する。

永続AIメモリの要素数はGame Rule Definitionが`memorySize`として定義し、既定値は20とする。永続AIメモリは符号付き32bit整数の配列を保持するオブジェクトとし、各要素の初期値は0とする。命令は指定したレジスタの値を配列インデックスとして使用してアクセスする。

メモリインデックスが0未満または`memorySize`以上の場合は、その命令の実行時エラーとする。

メモリはTickをまたいで保持される。

AI実行終了後も保持される。

Tick開始時にAI Runtime StateをExecution Contextへ作業コピーとして渡す。AI命令は作業コピーを読み取り、変更要求をExecution Context Changesとして返す。AI Engineが正常終了した命令の変更要求だけを作業コピーへ反映する。

AI実行終了後、SimulatorがExecution Resultに含まれる更新後のAI Runtime StateをWorld State内のRobotへ反映する。AI実行エンジンはRobotを直接更新しない。

---

# コールスタック

CALL命令およびRETURN命令を使用する場合、AI実行エンジンはコールスタックを管理する。

CALL命令はrequiredな`next`出力パスの接続先Node IDを復帰先としてpushし、`targetNodeId`へ遷移する。RETURN命令は復帰先Node IDをpopして遷移する。

空のコールスタックに対するRETURNは実行時エラーとする。

コールスタック上限はGame Rule Definitionが`callStackSize`として定義し、既定値は20とする。上限を超えるpushは、その命令の実行時エラーとする。

コールスタックはAI Runtime Stateの一部としてTickをまたいで保持する。

---

# CPU

AI実行エンジンはCPU消費量を管理する。

1TickのCPU上限はGame Rule Definitionで設定する。Instruction DefinitionのCPUコストは0以上かつCPU上限以下とし、0を許容する。

命令実行前にCPU残量を確認し、CPUコストが不足する場合はその命令を実行せず、そのTickのAI実行を終了する。

CPU上限へ到達するまでに生成した行動要求は破棄しない。

CPU不足の場合、現在のProgram Counterが指す実行できなかったNodeをAI Runtime Stateへ保存する。次TickはそのNodeから再開する。

そのTickのCPU使用量とCPU残量はTickをまたがず、次TickのExecution Context生成時に初期化する。

命令が正常終了した場合は、命令処理前に消費したCPUコストをExecution Contextへ反映する。実行時エラーの場合はその命令のCPU消費を反映しない。

CPU制限はゲームバランスを目的とした論理的制約である。

---

# エラー処理

AI実行中のエラーによってゲーム全体を停止させてはならない。

実行時エラーになった命令のExecution Context ChangesとCPU消費は反映しない。そのTickのAI実行を終了し、次TickはProgramのStart Nodeから開始する。それ以前に正常終了した命令の変更と行動要求は維持する。

初期実装で扱う実行時エラーコードは次のとおりとする。

```ts
type AIRuntimeErrorCode =
  | "empty_call_stack"
  | "call_stack_overflow"
  | "invalid_memory_access"
  | "invalid_instruction_result"
  | "internal_instruction_error";

type AIRuntimeError = {
  readonly code: AIRuntimeErrorCode;
  readonly message: string;
  readonly nodeId: NodeId;
  readonly instructionId: InstructionId;
};
```

`code`はエラー種別を機械的に識別する安定した値、`message`はユーザーへ表示する文字列とする。AI実行エンジンは、命令実装またはExecution Context Changesの適用で発生したエラーへ、実行中のNode IDとInstruction IDを付加する。

追加コードの用途は次のとおりとする。

- `invalid_instruction_result`：`interruptTick`が`false`かつ`nextNodeId`が`null`など、命令実行結果が共通契約に違反する
- `internal_instruction_error`：命令実装が予期しない例外または内部エラーによって正常な結果を返せない

残弾、エネルギー、発熱、現在の動作段階などを理由としてSimulatorが行動要求を実行できないことはAI実行の実行時エラーではない。

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

```ts
type AIDebugInfo = {
  readonly executionTrace: readonly string[];
  readonly terminationReason: string;
  readonly runtimeError: AIRuntimeError | null;
  readonly cpuUsed: Int32;
  readonly executedNodeCount: Int32;
};
```

`executionTrace`は命令の実行順をスタックトレース形式の文字列配列として保持する。各行は次の形式とする。

```text
at {implementationId} ({nodeId}, {instructionId})
```

正常終了したNodeと実行時エラーになったNodeを`executionTrace`へ含める。CPU不足または実行Node数上限により実行しなかったNodeは含めない。`executedNodeCount`へ加算するのは正常終了したNodeだけとする。

`terminationReason`はTickのAI実行を終了した理由をユーザーへ表示する文字列、`runtimeError`は実行時エラーが発生しなかった場合に`null`とする。`cpuUsed`はそのTickで正常に消費を確定したCPUコストの合計、`executedNodeCount`はそのTickで正常終了したNode数とする。

`terminationReason`には状況に応じて次の固定文言を格納する。

- 命令の`interruptTick`による終了：`命令によりTickの実行を中断しました`
- CPU不足による終了：`CPUが不足したためTickの実行を終了しました`
- CPUコスト0の実行Node数上限による終了：`CPUコスト0の実行Node数上限に到達したためTickの実行を終了しました`
- 実行時エラーによる終了：`実行時エラーが発生したためTickの実行を終了しました`

AI実行エンジンは同じ実行時エラーが後続Tickでも発生した場合に通知を抑制せず、各Tickの結果へ正確に格納する。表示側はRuntime Robot ID、Program ID、Node ID、エラーコードの組を同一エラーの識別に使用できる。

デバッグ情報はゲーム進行へ影響を与えない。

---

# モジュール構成

AI実行エンジンは以下のモジュールで構成する。

- Program Loader
- Execution Context
- Scheduler
- Instruction Dispatcher
- Register Manager
- Memory Manager
- Stack Manager
- CPU Manager
- Debug Logger

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

# 関連仕様書

- `docs/specs/current/instructions/concept.md`
- `docs/specs/current/instructions/instruction_model.md`
- `docs/specs/current/instructions/details/`

本書では各命令固有の動作を扱わない。
