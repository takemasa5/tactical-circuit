# Program Validator概要

## 目的

本書はProgram Validatorの責務、検証規則、診断結果、静的グラフ解析を定義する。

Program ValidatorはProgramを実行せず、ProgramとData Repositoryを入力として静的検証を行う。

---

# 責務

Program Validatorは以下を担当する。

- Program基本構造の検証
- Node、Instruction、Parameter Values、接続、Node参照の検証
- 命令固有の静的検証
- 到達不能Nodeの検出
- 純粋な循環プログラムの検出
- ErrorとWarningの生成
- ProgramをAI Engineへ渡せるかの判定

以下は担当しない。

- ProgramまたはMaster Dataの変更
- Programの実行
- 実行時状態に依存する判定
- Instruction Definition自体の検証
- JSONのマイグレーション

Instruction Definition自体の構造、CPUコスト、`implementationId`はData Repositoryが検証する。

---

# 入力

Program Validatorは以下を読み取り専用で受け取る。

- Program
- 検証済みのData Repository

Program Validatorは入力ProgramとData Repositoryを変更してはならない。

入力Programは、Program Editorが生成したか、Program JSON Codecの構造検証を通過した`Program`とする。未解析のJSONやProgram JSON Schemaに適合しない値はProgram JSON Codecが拒否し、Program Validatorへ渡さない。

Program Validatorが受け付ける不完全なProgramとは、requiredな接続やParameter Valueが欠けているなど、Programの構造には適合するが意味上不完全なProgramを指す。Program ValidatorはJSON構造検証を重複して行わない。

---

# 実行タイミング

Program Validatorは少なくとも以下のタイミングで実行できるものとする。

- Editorでの編集後
- Program読込後
- シミュレーション開始前

編集途中でErrorを含むProgramも保存できる。シミュレーション開始前の検証は必須とし、Errorが1件以上あるProgramをAI Engineへ渡してはならない。

WarningはProgramの保存と実行を妨げない。

全体検証と増分検証を実装する場合、同じProgramに対して同じValidation Resultを返さなければならない。

---

# 検証結果

```ts
type ValidationResult = {
  isValid: boolean;
  diagnostics: ValidationDiagnostic[];
};

type ValidationDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  programId: ProgramId;
  nodeId: NodeId | null;
  fieldPath: string | null;
  relatedNodeIds: NodeId[];
};
```

`isValid`はErrorが0件の場合だけ`true`とする。

`code`は診断種別を表す安定した小文字の英単語またはスネークケース文字列とする。表示文言を変更しても、同じ診断種別の`code`は変更しない。

`message`はユーザ向けの説明とする。判定処理やEditorの制御に`message`の文字列解析を使用してはならない。

---

# 診断位置

`nodeId`は問題を主に表示するNodeを示す。Program全体の問題など、主Nodeを1つに定められない場合は`null`とする。

`fieldPath`は、Programまたは`nodeId`が示すNode内の問題フィールドをドット区切りで示す論理パスである。

例を以下に示す。

- `startNodeId`
- `instructionId`
- `connections.found`
- `parameterValues.range`
- `parameterValues.targetNodeId`

Node全体またはグラフ全体の問題では`fieldPath`を`null`とする。配列インデックスとJSONプロパティ順には依存しない。

`relatedNodeIds`は、主Nodeと同時にEditorで強調または参照する関連Nodeを保持する。複数のStart Node、循環を構成するNode、接続先Nodeなどに使用する。`nodeId`と同じNode IDは含めず、関連Nodeがない場合は空配列とする。

複数Nodeにまたがる診断では、原則としてNode IDの連番が最小のNodeを`nodeId`とし、残りを`relatedNodeIds`へ格納する。Program全体の問題として報告する必要がある場合だけ`nodeId`を`null`とする。

---

# Severity

## Error

Programの構造または値が不正で、安全にAI実行できない問題をErrorとする。

Errorが1件以上あるProgramはAI Engineへ渡さない。

## Warning

Programは実行できるが、ユーザの意図と異なる可能性がある問題をWarningとする。

少なくとも以下をWarningとする。

- 任意出力パスの未接続
- 到達不能Node
- 純粋な循環プログラム

---

# 共通診断コード

共通Validatorは少なくとも以下の診断コードを使用する。

| code                          | severity | 意味                                 |
| ----------------------------- | -------- | ------------------------------------ |
| `invalid_start_node_id`       | Error    | `startNodeId`の参照先が存在しない    |
| `invalid_next_node_sequence`  | Error    | `nextNodeSequence`が不正             |
| `duplicate_node_id`           | Error    | Node IDが重複                        |
| `missing_start_node`          | Error    | Start Nodeが存在しない               |
| `multiple_start_nodes`        | Error    | Start Nodeが複数存在する             |
| `start_node_mismatch`         | Error    | `startNodeId`がStart命令以外を参照   |
| `unknown_instruction_id`      | Error    | Instruction Definitionを解決できない |
| `missing_parameter`           | Error    | 必須Parameter Valueが欠損            |
| `unknown_parameter`           | Error    | 未定義Parameter IDが保存されている   |
| `parameter_type_mismatch`     | Error    | `valueType`が一致しない              |
| `parameter_out_of_range`      | Error    | Parameter Valueが値域外              |
| `unknown_enum_value`          | Error    | 未知の列挙値                         |
| `invalid_reference`           | Error    | 参照値の構造が不正                   |
| `missing_reference_target`    | Error    | 参照先が存在しない                   |
| `reference_type_mismatch`     | Error    | 参照先のデータ種別が不正             |
| `unknown_output_path`         | Error    | 未定義Output Path IDが保存されている |
| `missing_required_connection` | Error    | requiredな出力パスが未接続           |
| `invalid_connection_target`   | Error    | 接続先Nodeが不正                     |
| `connection_not_allowed`      | Error    | 出力パスを持たない命令に接続がある   |
| `optional_connection_missing` | Warning  | 任意出力パスが未接続                 |
| `unreachable_node`            | Warning  | Start Nodeから到達不能               |
| `pure_cycle`                  | Warning  | 純粋な循環プログラム                 |

命令固有Validatorは、共通診断コードと重複しない命令固有の`code`を追加できる。

---

# 検証順序

検証は次の順序で行う。

1. Program基本構造
2. Node ID
3. Start Node
4. Instruction参照
5. Parameter Values
6. connections
7. Node参照
8. 命令固有規則
9. 到達可能性
10. 純粋な循環プログラム

前段のErrorによって後段の検証に必要な情報が得られない場合、その情報に依存する検証だけを省略する。他の独立した検証は可能な限り継続する。

---

# Program基本構造とNode ID

少なくとも以下をErrorとする。

- `startNodeId`の参照先が存在しない
- `nextNodeSequence`が現在存在するNode IDの最大連番以下
- Program内でNode IDが重複している

Program ID、Node ID、`nextNodeSequence`の型と値域、Node集合の存在と1件以上のNodeはProgram JSON Codecの構造検証で保証する。

削除済みNode IDの履歴は`nextNodeSequence`だけで管理する。Validatorは削除履歴を復元して検証しない。

Node配列の順序は検証結果と実行順序に影響しない。

---

# Start Node

少なくとも以下をErrorとする。

- Start命令を参照するNodeが0個
- Start命令を参照するNodeが複数
- `startNodeId`の参照先Nodeが存在しない
- `startNodeId`の参照先がStart命令ではない
- Start Nodeのrequiredな出力パスが未接続

Start命令のCPUコストはInstruction Definitionの規則であり、Program Validatorでは検証しない。

---

# Instruction参照

少なくとも以下をErrorとする。

- Data Repositoryに存在しないInstruction IDを参照している

`enabled`が`false`のInstruction Definitionも参照解決の対象とする。既存Nodeからの参照はErrorまたはWarningにしない。Editorは新しいNodeの作成候補から除外する。

Instruction Definitionを解決できないNodeでは、その定義を必要とするParameter Values、出力パス、命令固有規則の検証を省略する。

---

# Parameter Values

少なくとも以下をErrorとする。

- 必須Parameter Valueが欠損している
- Instruction Definitionに存在しないParameter IDが保存されている
- `valueType`がParameter Definitionと一致しない
- 値が定義された値域外である
- 未知の列挙値である
- 参照値の構造が不正である
- 参照先が存在しない
- 参照先のデータ種別が異なる

数値の内部表現が同じ符号付き32bit整数でも、異なる`valueType`間の暗黙変換は行わない。

`degree`は`docs/specs/current/11_coordinate_system.md`に従い、符号付き32bit整数の全範囲を許容する。方向を表す角度に0以上360未満の値域制約を設定せず、負数または360以上であることをErrorまたはWarningにしない。

既定値の補完はProgram Validatorの責務ではない。必須値が保存されていなければErrorとする。

レジスタ、フラグ、メモリの実行時の内容は検証対象外とし、参照形式と参照可能な番号またはIDだけを検証する。

---

# connections

少なくとも以下をErrorとする。

- Instruction Definitionに存在しないOutput Path IDが保存されている
- requiredな出力パスが未接続
- 接続先Nodeが存在しない
- 接続先が同一Program外のNodeである
- 出力パスを持たない命令に接続が保存されている

`connections`はOutput Path IDをキー、接続先Node IDを値とするオブジェクトであるため、同じ出力パスに複数の接続先を保存する表現は持たない。

任意出力パスが未接続の場合はWarningとする。未接続の任意出力パスが実行時に選択された場合の動作はInstruction定義モデルに従う。

複数Nodeから同じNodeへの接続と自己接続は許容する。

---

# Node参照と特殊命令

少なくとも以下をErrorとする。

- CALLの`targetNodeId`が欠損している
- CALLの`targetNodeId`が同一Program内のNodeを参照していない
- CALLのrequiredな`next`出力パスが未接続
- JUMPのrequiredな出力パスが未接続
- EndまたはRETURNに接続が保存されている

空のコールスタックに対するRETURNは実行状態に依存するため、静的検証のErrorまたはWarningにしない。実行時エラーとして扱う。

表示名やラベルはNode参照の解決に使用しない。

---

# 命令固有検証

共通ValidatorはInstruction IDまたはカテゴリによる巨大な条件分岐を持たない。

`implementationId`に対応する命令実装は、必要に応じて命令固有の静的検証処理を提供できる。Program Validatorは共通検証後にその処理を呼び出す。

命令固有の静的検証もProgramとData Repositoryを変更してはならず、共通のValidation Diagnosticを返す。

---

# 静的制御フローグラフ

到達可能性と純粋な循環プログラムの解析では、Programから静的制御フローグラフを構築する。

Nodeを頂点とし、以下を有向辺とする。

- Nodeの`connections`が参照する接続先Node
- CALLの`targetNodeId`が参照する呼出先Node

CALLの復帰先である`connections.next`は通常の接続として辺に含まれる。

RETURNの復帰先は実行時のコールスタックに依存するため、RETURNからの静的な辺は追加しない。

不正な接続とNode参照はグラフへ追加しない。

Instruction Definitionを解決できないNodeが1件以上存在する場合、そのNodeからの制御フローを確定できないため、到達可能性と純粋な循環プログラムの解析を省略する。

---

# 到達可能性

静的制御フローグラフをStart Nodeから探索し、到達できないNodeを到達不能Nodeとする。

到達不能NodeごとにWarningを1件生成する。

到達不能Nodeであっても、Node自体の構造、Instruction参照、Parameter Values、接続は通常どおり検証する。

---

# 純粋な循環プログラム

純粋な循環プログラムは、静的制御フローグラフ上で以下をすべて満たすNode集合とする。

- Start Nodeから到達可能である
- 自己ループ、または複数Nodeによる循環を形成する
- 実行時に複数の出力パスから経路を選択する条件分岐命令を含まない
- Node集合から外部へ出る有効な接続またはNode参照を持たない
- CALL命令とRETURN命令を含まない

Phase 3では、Instruction Definitionが2件以上のOutput Path Definitionを持つ命令を、実行時に経路を選択する条件分岐命令として扱う。Instructionの`category`は条件分岐の判定に使用しない。

純粋な循環プログラムごとにWarningを1件生成する。循環を構成するNode群は`nodeId`と`relatedNodeIds`で報告する。

自己ループも検出対象とする。

CALL命令またはRETURN命令を含む循環はコールスタックに依存するため、純粋な循環プログラムとして扱わない。

---

# 診断結果の順序

同じ入力から同じ診断順序を返すため、Validation Diagnosticを次の順序で並べる。

1. `severity`がError、Warningの順
2. Program全体の診断、Node単位の診断の順
3. `nodeId`の連番昇順
4. `code`の文字列昇順
5. `fieldPath`の文字列昇順

Node IDが不正で連番を取得できない場合はNode IDの文字列昇順を使用する。`relatedNodeIds`も同じNode ID順に並べる。

Node配列順、JSONプロパティ順、Data Repositoryの読込順に依存しない。

---

# 不完全なProgram

Program Validatorは構造検証を通過した編集途中の意味上不完全なProgramも受け付け、検出できた問題をValidation Resultとして返す。

1つの原因から派生する診断を可能な限り重複して報告しない。例えばInstruction Definitionを解決できない場合、そのNodeについて未知の出力パスやParameter Definitionとの不一致を追加報告しない。

意味上不完全なProgramによってProgram Validator全体を例外終了させない。

---

# 不変条件

Program Validatorは以下を満たす。

- 入力ProgramとData Repositoryを変更しない
- 同じ入力から同じValidation Resultを返す
- ErrorがあるProgramをAI Engineへ渡さない
- WarningだけのProgramは実行を許可する
- 診断メッセージの解析を処理条件に使用しない
- ファイル順、配列順、JSONプロパティ順に検証結果を依存させない
- 検証可能な問題を1件検出しただけで検証全体を終了しない
