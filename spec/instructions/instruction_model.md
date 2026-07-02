# Instruction定義モデル

## 目的

本書はInstruction Definitionの論理構造、命令実行の入出力契約、CPU消費、制御フロー、エラー処理を定義する。

Instruction DefinitionはMaster Dataであり、Program内のNodeからInstruction IDによって参照される。

---

# Instruction Definition

Instruction Definitionは以下の情報を持つ。

* Instruction ID
* 表示名
* 説明
* 有効状態
* カテゴリ
* Parameter Definitions
* Output Path Definitions
* CPUコスト
* Implementation ID
* Editor向け表示情報

Instruction IDは`instruction_{uuid}`形式のグローバルIDとする。

Instruction Definitionは実行状態とProgram固有のNode IDを保持しない。同じInstruction Definitionを複数のProgramとNodeから参照できる。

---

# Nodeとの責務分離

Instruction Definitionは、命令の意味、パラメータ定義、出力パス定義、CPUコスト、実装コードとの対応を保持する。

NodeはInstruction ID、Parameter Values、出力パスごとの接続先Node IDを保持する。Instruction Definitionの内容をNodeへ複製しない。

Instruction Definitionは出力パスIDを定義するが、その出力パスが参照するNode IDは把握しない。出力パスIDと接続先Node IDの対応は、Program内の実行中Nodeが`connections`として保持する。

---

# カテゴリ

Instruction Definitionの`category`は次の文字列列挙値とする。

* `control`
* `branch`
* `sensor`
* `arithmetic`
* `memory`
* `action`
* `special`

カテゴリはEditorでの分類、表示、検索に使用する。命令実装の選択には使用しない。

---

# Parameter Definition

各Parameter Definitionは以下の情報を持つ。

* `id`
* `displayName`
* `description`
* `valueType`
* `required`
* 任意の`defaultValue`
* 任意の値域
* 任意の参照先データ種別
* 任意の列挙値集合
* 任意のEditor向け表示情報

Parameter IDはInstruction Definition内で一意な小文字の英単語またはスネークケース文字列とする。

CALL命令の`targetNodeId`は特殊制御命令の共通契約で使用する予約Parameter IDとし、この命名規則の例外とする。

NodeはParameter IDをキーとしてParameter Valueを保持する。定義されていないParameter IDをNodeへ保存してはならない。

必須パラメータの欠損、型の不一致、値域外の値、不正な参照、未知の列挙値はProgram ValidatorのErrorとする。

`defaultValue`は、同じ`valueType`のParameter Valueと同じJSON表現を使用し、Data Repositoryが以下を検証する。

* 数値型は符号付き32bit整数であり、任意の`minValue`以上かつ任意の`maxValue`以下である
* `degree`は0以上360未満である
* `boolean`は真偽値である
* `enum`は`enumValues`に含まれる文字列である
* 参照型は`valueType`に対応する判別可能な参照オブジェクトである
* `master_data_reference`は指定されたMaster Data種別と一致し、Data Repository内に参照先が存在する

`node_reference`の既定値はData RepositoryでNode ID形式を検証し、実際の参照先の存在はNodeを配置したProgramに対してProgram Validatorが検証する。レジスタ、フラグ、メモリ参照の既定値はData Repositoryで参照形式を検証し、選択中Game Rule Definitionで利用可能な名前であることをシミュレーション開始時に検証する。

---

# Parameter Valueの型

数値の内部表現は符号付き32bit整数とする。ただし、数値型に汎用的な`integer`を使用せず、値の意味を表す型を使用する。

数値型の例を以下に示す。

* `distance`
* `degree`
* `tick`
* `cpu_cost`
* `count`
* `speed`
* `damage`
* `heat`
* `ammunition`

数値以外の型として、少なくとも以下を使用できる。

* `boolean`
* `enum`
* `register_reference`
* `flag_reference`
* `memory_reference`
* `node_reference`
* `master_data_reference`

新しい値の意味が必要になった場合は、新しい`valueType`を追加する。数値型の演算、値域、単位は、その型を使用する個別仕様で定義する。

参照値は通常の数値や文字列と区別できる型付きオブジェクトとして表現する。Node参照の例を以下に示す。

```json
{
  "type": "node_reference",
  "nodeId": "node_3"
}
```

---

# Output Path Definition

各Output Path Definitionは以下の情報を持つ。

* `id`
* `displayName`
* `description`
* `required`
* `displayOrder`

Output Path IDはInstruction Definition内で一意な小文字の英単語またはスネークケース文字列とする。

`required`が`true`の出力パスに接続先がない場合はProgram ValidatorのErrorとする。

命令実装は実行結果に応じて出力パスを選択できる。命令実装には実行中Nodeの`connections`が渡され、選択した出力パスを接続先Node IDへ解決して`nextNodeId`として返す。

任意の出力パスが未接続の状態でそのパスが選択された場合、命令実行結果は`nextNodeId`を`null`、`interruptTick`を`true`とする。そのTickのAI実行を終了し、次TickはProgramのStart Nodeから開始する。この場合、正常に完了した命令のExecution Context変更要求は反映する。

---

# 命令実行の入力

命令実装は以下を入力として受け取る。

* Instruction Definition
* 実行中NodeのNode ID
* Parameter Values
* 出力パスと接続先Node IDの対応
* Execution Contextへの読み取り専用アクセス

命令実装はProgram、World State、Replay Data、Master Data、NodeのParameter Valuesを変更してはならない。

命令実装とInstruction Registryの契約は次のとおりとする。

```ts
type InstructionExecutionInput = {
  readonly definition: InstructionDefinition;
  readonly node: ProgramNode;
  readonly context: ExecutionContext;
};

type InstructionImplementation = (
  input: InstructionExecutionInput,
) => InstructionExecutionOutcome;

type InstructionRegistry = ReadonlyMap<string, InstructionImplementation>;
```

Instruction Registryは`implementationId`だけをキーとして命令実装を解決する。Registryが公開する固定のキー集合を、Data RepositoryがInstruction Definitionの`implementationId`を検証するための許可リストとして使用する。Master Data自身から許可リストを生成してはならない。

---

# Execution Contextへのアクセス

命令ごとに、以下の操作を使用できる。

* レジスタのreadとwrite
* フラグのreadとwrite
* 永続AIメモリのreadとwrite
* コールスタックのpushとpop
* 共通乱数生成器からの乱数生成
* 行動要求の変更

write、push、pop、乱数内部状態の更新、行動要求の変更は、Execution Contextを直接変更せず、Execution Context Changesとして返す。

命令実装は実行中に変更要求を一時結果として生成し、AI Engineが命令の正常終了後にまとめて反映する。

Execution Context Changesは以下を保持する。

* レジスタ名をキー、符号付き32bit整数を値とする書込要求
* フラグ名をキー、booleanを値とする書込要求
* メモリインデックスと符号付き32bit整数値の書込要求配列
* 順序付きのコールスタックpushまたはpop要求配列
* 任意の移動系行動要求
* 任意の戦闘系行動要求
* 更新後Random State。乱数を更新しない場合は`null`

異なるカテゴリの行動要求は同時に返すことができる。同じカテゴリについて1つの命令が返せる要求は1つとする。

同一Tick内で複数の正常終了した命令が同じレジスタ、フラグ、メモリインデックスまたは行動要求カテゴリを変更した場合は、実行順が後の命令による変更を最終結果とする。1つのExecution Context Changes内で同じメモリインデックスへの書込要求が複数ある場合は、配列内で後の書込要求を最終結果とする。

コールスタック操作は`stackOperations`の配列順に適用する。Execution Context Changesは命令単位で原子的に適用し、いずれかの変更要求が実行時エラーになった場合は、その命令が返したすべての変更要求を反映しない。

---

# 命令実行結果

命令実行結果は以下の情報を持つ。

```ts
type InstructionExecutionResult = {
  nextNodeId: NodeId | null;
  contextChanges: ExecutionContextChanges;
  interruptTick: boolean;
};

type InstructionExecutionOutcome =
  | {
      readonly success: true;
      readonly result: InstructionExecutionResult;
    }
  | {
      readonly success: false;
      readonly error: {
        readonly code: AIRuntimeErrorCode;
        readonly message: string;
      };
    };
```

命令実装は正常終了時に`success: true`、状態依存の実行時エラー時に`success: false`を返す。AI実行エンジンは`success: false`へ実行中のNode IDとInstruction IDを付加し、AIExecutionOutputのデバッグ情報へ格納する。

`nextNodeId`は、命令実装が選択した出力パスを実行中Nodeの`connections`から解決した結果、CALLの呼出先、またはRETURNでコールスタックから取得した復帰先である。

`interruptTick`が`false`の場合、AI Engineは`nextNodeId`が参照するNodeを同一Tick内の次の処理対象とする。この場合の`nextNodeId`は`null`であってはならない。

`interruptTick`が`true`の場合、AI Engineは`contextChanges`を反映した後にそのTickのAI実行を終了する。

* `nextNodeId`がNode IDの場合、次TickはそのNodeから開始する
* `nextNodeId`が`null`の場合、次TickはProgramのStart Nodeから開始する

`undefined`は使用しない。

代表的な結果を以下に示す。

| 状況 | `interruptTick` | `nextNodeId` |
| --- | --- | --- |
| 通常の遷移 | `false` | 接続先Node ID |
| 条件成立まで待機 | `true` | 実行中Node ID |
| End | `true` | `null` |

---

# CPU消費

1Tickで使用できる最大CPUコストはゲームシステム設定として変更可能にする。ゲームバランス値であるため、Game Rule Definitionで管理する。

Instruction DefinitionのCPUコストは0以上、1Tickの最大CPUコスト以下の符号付き32bit整数とする。CPUコスト0の命令を許容する。

AI Engineは命令実行前にCPU残量を確認する。残量が命令のCPUコスト未満の場合、その命令を実行せずにTickのAI実行を終了する。次Tickは実行できなかったNodeから開始する。

CPUコストは命令処理前に一時的に消費する。命令が正常終了した場合に消費量をExecution Contextへ確定する。

命令が実行時エラーになった場合は一時的な消費を破棄し、その命令のCPU消費をExecution Contextへ反映しない。

---

# 実装コードとの対応

Instruction Definitionでは`implementationId`を必須とする。

Instruction Dispatcherは`implementationId`に対応する命令実装を呼び出す。Instruction ID、カテゴリ、表示名によって実装を選択しない。

対応する命令実装が存在しない場合はData Repositoryの読込エラーとし、不完全なMaster Dataを公開しない。

---

# 特殊な制御命令

## Start

Start命令はrequiredな出力パスを1つ持つ。CPUコストは0とする。

Start命令は出力パスの接続先を`nextNodeId`として返し、`interruptTick`を`false`とする。Execution Contextを変更しない。

ProgramにはStart命令を参照するNodeを1つだけ配置する。0個または複数の配置はProgram ValidatorのErrorとする。

## End

End命令は出力パスを持たない。

End命令は`nextNodeId`を`null`、`interruptTick`を`true`として返す。次TickはProgramのStart Nodeから開始する。

## JUMP

JUMP命令はrequiredな出力パスを1つ持つ。

JUMP命令は出力パスの接続先を`nextNodeId`として返し、`interruptTick`を`false`とする。コールスタックを変更しない。

## CALL

CALL命令は、呼出先を指定する必須の`targetNodeId`パラメータと、復帰先を表すrequiredな`next`出力パスを1つ持つ。

CALL命令は実行中Nodeの`connections.next`を復帰先Node IDとしてコールスタックへpushし、`targetNodeId`を`nextNodeId`として返す。`interruptTick`は`false`とする。

## RETURN

RETURN命令は出力パスを持たない。

RETURN命令はコールスタックをpopし、取得した復帰先Node IDを`nextNodeId`として返す。`interruptTick`は`false`とする。

コールスタックが空の状態でRETURN命令を実行した場合は実行時エラーとする。

---

# 行動要求と実行時エラー

行動命令は行動要求を生成するまでを担当する。残弾不足など、行動要求が現在のゲーム状態では実行できない場合、Simulatorはその要求を実行しない。これはAI命令の実行時エラーではない。

次を実行時エラーとする。

* 空のコールスタックに対するRETURN：`empty_call_stack`
* コールスタック上限を超えるpush：`call_stack_overflow`
* 範囲外メモリインデックスへのアクセス：`invalid_memory_access`
* 共通契約に違反する命令実行結果：`invalid_instruction_result`
* 命令実装の予期しない例外または内部エラー：`internal_instruction_error`

実行時エラーになった命令は原子的に失敗する。

* その命令のExecution Context Changesを反映しない
* その命令のCPU消費を反映しない
* それ以前に正常終了した命令の変更と行動要求は維持する
* そのTickのAI実行を終了する
* 次TickはProgramのStart Nodeから開始する

実行時エラーによってゲーム全体を停止させない。

---

# 決定論

命令実装は現在時刻、実行端末固有情報、開発言語の乱数生成器を参照してはならない。

乱数を使用する命令はExecution Contextが提供する共通乱数生成器だけを使用し、更新後の乱数内部状態をExecution Context Changesへ含める。

同じInstruction Definition、Node、Parameter Values、Execution Contextからは、同じ命令実行結果を生成しなければならない。

---

# Editor向け表示情報

Instruction Definitionは、アイコンID、表示色、パラメータ入力UI、出力パスの表示順、ヘルプ文章などのEditor向け表示情報を持つことができる。

Editor向け表示情報はAI実行結果へ影響しない。

---

# 不変条件

Instruction Definitionは以下を満たさなければならない。

* Instruction IDが有効でData Repository全体で一意である
* `implementationId`が存在し、対応する実装を解決できる
* Parameter IDがInstruction Definition内で一意である
* Output Path IDがInstruction Definition内で一意である
* Parameter Definitionの既定値が型と制約に適合する
* 列挙値がParameter Definition内で重複しない
* CPUコストが0以上かつ1Tickの最大CPUコスト以下である
* Start命令がrequiredな出力パスを1つ持ち、CPUコストが0である
* End命令とRETURN命令が出力パスを持たない
* JUMP命令がrequiredな出力パスを1つ持つ
* CALL命令が必須の`targetNodeId`とrequiredな`next`出力パスを持つ

Instruction Definition自体の検証はData Repositoryが担当する。Nodeへの配置、Parameter Values、接続、Start命令の配置数、Node参照はProgram Validatorが検証する。
