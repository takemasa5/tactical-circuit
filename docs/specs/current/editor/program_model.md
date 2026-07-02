# editor/program_model.md

# Program論理モデル

## 目的

本書はAIプログラム（Program）の論理構造を定義する。

Programはゲーム内AIを表現する唯一のデータモデルであり、Editor、Program Validator、AI Execution Engine、Save/Loadなど、すべてのモジュールが共通して利用する。

本書では実装方法やデータ構造ではなく、Programが満たすべき論理的な制約を定義する。

---

# 基本理念

Programは命令ノードと接続から構成される有向グラフである。

Programは編集方法や表示方法に依存しない。

Canvas表示、保存形式、内部データ構造が変更されても、Programの意味は変化しない。

---

# Program

Programとは、1つのAIプログラム全体を表す論理単位である。

Programは以下の要素で構成される。

- Program ID
- ノード集合
- 開始ノードID
- ノードID発番ソース
- メタデータ
- Editor専用情報

Programは1つ以上の命令ノードを持つ。

Program IDは`program_{uuid}`形式のグローバルIDとする。

保存形式では`nodes`を配列として保持し、Node IDの文字列昇順で保存する。配列順はAI実行へ影響しない。

---

# ノード

ノードはProgramを構成する最小単位である。

1つのノードは1つのInstruction Definitionの配置を表現する。NodeはInstruction Definitionそのものではない。

ノードは以下の情報を持つ。

- Node ID
- Instruction ID
- Parameter Values
- 出力パスごとの接続先Node ID

Instruction IDはMaster Dataの`instruction_{uuid}`を参照する。命令の意味、出力パス、パラメータ定義、CPU消費量はInstruction Definitionが保持し、Nodeへ複製しない。

---

# ノードID

すべてのノードはProgram内で一意な識別子を持つ。

Node IDは`node_{Program内連番}`形式とする。

ノードIDは表示名とは無関係である。

ノードIDは編集時および保存時にも維持される。

---

# 接続

接続はNode間の実行順序を定義する制御フローである。値の受け渡しには使用しない。

Nodeは自身から出る接続を`connections`に保持する。Program直下に独立したConnection集合を持たない。

`connections`はInstruction Definitionの出力パスIDをキー、同一Program内の接続先Node IDを値とする。

```json
{
  "connections": {
    "found": "node_2",
    "not_found": "node_3"
  }
}
```

各出力パスの接続先は最大1つとする。複数のNodeから1つのNodeへ接続することと、自己への接続を許容する。

出力パスIDはInstruction Definition内で一意な小文字の英単語またはスネークケース文字列とする。例として`next`、`found`、`not_found`、`true`、`false`を使用できる。

命令実装が出力パスを選択した場合、実行中Nodeの`connections`から対応する接続先Node IDを解決して`nextNodeId`として返す。接続自体は条件を評価しない。

独立したConnection IDとConnection ID用の発番ソースは持たない。Editor上の接続は、接続元Node IDと出力パスIDの組み合わせで識別する。

---

# 開始ノード

Programは開始ノードを1つ持つ。

Programは開始ノードのNode IDを`startNodeId`として保持する。

`startNodeId`が参照するNodeはProgram内に存在し、開始命令のInstruction IDを参照しなければならない。開始命令を参照するNodeはProgram内に1つだけ存在する。

戦闘開始時のAI実行は開始ノードから開始される。

開始ノードの詳細仕様は命令仕様で定義する。

---

# 終了

Programは終了ノードを持つことができる。

終了ノードは終了命令のInstruction IDを参照するNodeである。Program内に複数配置できる。

終了命令は出力パスを持たず、終了ノードの`connections`は空とする。

終了ノードへ到達した場合、そのTickのAI実行は終了する。

終了ノードへ到達した場合、次Tickで実行するノードはProgramの開始ノードとする。

終了ノードは必須ではない。

CPU上限などによって終了する場合もある。

Programは循環する接続を持つことができる。循環自体はProgramの構造エラーではない。

開始ノードから到達可能で、条件分岐、CALL、RETURNを含まず、循環外へ出る接続またはNode参照を持たない循環は純粋な循環プログラムとする。Program ValidatorはこれをWarningとして報告する。

---

# パラメータ

各ノードは命令固有の設定値を`parameterValues`オブジェクトとして保持できる。

`parameterValues`はInstruction Definitionが定義するパラメータIDをキーとし、設定値を値とする。数値には`distance`、`degree`、`tick`、`count`など値の意味を表す型を使用し、汎用的な`integer`型は使用しない。ほかに真偽値、列挙値、レジスタ参照、フラグ参照、メモリ参照、Node参照、Master Data ID参照を使用できる。実際に使用できる型は各パラメータ定義で指定する。

数値、真偽値、列挙値はそれぞれJSONの整数、boolean、文字列として直接保存する。参照値は以下の判別可能なオブジェクトとして保存する。

```json
{ "type": "register_reference", "registerName": "A" }
{ "type": "flag_reference", "flagName": "F1" }
{ "type": "memory_reference", "indexRegisterName": "A" }
{ "type": "node_reference", "nodeId": "node_1" }
{
  "type": "master_data_reference",
  "dataType": "weapon",
  "id": "weapon_550e8400-e29b-41d4-a716-446655440000"
}
```

パラメータの必須・任意、既定値、値域、参照先の種別はInstruction Definitionが定義する。定義されていないパラメータ、型の不一致、値域外の値、不正な参照はProgram ValidatorのErrorとする。

パラメータの意味は命令仕様で定義する。

Programはパラメータの内容を解釈しない。

---

# 編集情報

ProgramはAI実行に使用しない編集専用情報を`editorState`として、論理データと分離して保持する。

Phase 1では以下を保持する。

- Node IDをキーとするNode位置
- Node IDをキーとするコメント

これらはAI実行へ影響しない。表示状態、折りたたみ状態、色は必要になるPhaseで追加する。

現在の選択状態など、編集セッション中だけ必要な一時的なUI状態はProgramへ保存しない。

---

# メタデータ

Programはプログラム全体に関する以下の情報を必須で保持する。

- 名前
- 作者
- 説明
- 作成日時
- 更新日時

作者と説明は空文字を許容する。

メタデータはAI実行に影響しない。

作成日時と更新日時はUTCのISO 8601形式の文字列とする。Program IDと保存形式のバージョンはメタデータとは別のフィールドとして保持する。

---

# ID発番ソース

Programは次に発番するNode IDの連番部分を`nextNodeSequence`として保持する。初期値は1とする。

Node追加時は`nextNodeSequence`を使用してNode IDを発番し、その後に1増加させる。削除したNode IDは再利用しない。

Program全体をコピーする場合は`nextNodeSequence`もコピーする。一部のNodeを別のProgramへ貼り付ける場合は、貼り付け先Programの`nextNodeSequence`を使用してNode IDを振り直す。

---

# コピー規則

Program全体をコピーして新しいProgramを作成する場合は、新しいProgram IDを発番する。Node IDと`nextNodeSequence`はコピー元の値を維持する。

一部のNodeをコピーして貼り付ける場合は、選択したすべてのNodeへ新しいNode IDを発番する。選択したNode間の接続は、新しいNode IDへ置き換えて維持する。選択範囲外のNodeへの接続は貼り付け先へ引き継がない。

接続は独立したIDを持たないため、接続用IDの再発番は行わない。

---

# Node参照

パラメータ、接続、命令実行結果からNodeを参照する場合は、表示名やラベルではなくNode IDを使用する。

CALL命令は呼出先を`targetNodeId`パラメータとして保持する。JUMP命令はrequiredな出力パスの接続先を遷移先とする。参照対象Nodeは同一Program内に存在しなければならない。

表示用のラベルを持つ場合も、ラベルはNode参照の解決に使用しない。

---

# 配列とプロパティの順序

保存形式でNodeを配列として保持する場合、配列順はAIの実行順序に影響しない。実行順序は開始ノード、接続、AI Runtime Stateによってのみ決定する。

`connections`のJSONプロパティ順も意味を持たない。Instructionが返した出力パスIDによって接続先を選択する。

---

# 実行情報

ProgramはAI実行中の状態を保持しない。

以下の情報はProgramではなく、World State内のRobotがAI Runtime Stateとして保持する。

- 次Tickで実行するノードID
- レジスタ
- フラグ
- コールスタック
- 永続AIメモリ

Programは常に静的データである。

そのTickのCPU使用量と行動要求はExecution Contextが保持し、Tickをまたがない。

---

# Programの不変条件

Programは以下の条件を満たすことを前提とする。

- Program IDが有効である
- Program内でNode IDが一意である
- `startNodeId`がProgram内の開始ノードを参照する
- 開始命令を参照するNodeが1つだけ存在する
- すべてのInstruction IDが有効なInstruction Definitionを参照する
- `connections`の出力パスIDが、参照するInstruction Definitionに定義されている
- すべての接続先Node IDが同一Program内に存在する
- Instruction Definitionが必須とした出力パスに接続先が存在する
- 終了ノードの`connections`が空である
- すべてのParameter ValuesがInstruction Definitionのパラメータ定義に適合する
- `nextNodeSequence`が、過去に発番したNode IDを再利用しない値である

これらの検証はProgram Validatorが担当する。

---

# 編集

EditorはProgramを編集する。

以下の操作はProgramを変更する。

- ノード追加
- ノード削除
- 接続追加
- 接続削除
- パラメータ変更
- コメント変更
- メタデータ変更

編集結果はProgramへ反映される。

---

# 保存

Programは保存可能な論理単位である。

保存形式はProgramの意味を保持しなければならない。

保存形式はJSONとし、共通データ規約で定義した共通ヘッダとバージョン規則に従う。

JSON読込時はJSON構造、ID形式、数値範囲を検証する。接続不足、開始ノード、参照先、Parameter ValueとInstruction Definitionの整合性などProgramの意味に関する検証はProgram Validatorが担当する。不完全なProgramもJSONへ保存し、再度読み込めるものとする。

---

# 読込

保存されたProgramは復元可能でなければならない。

読込後のProgramは保存前と同じ意味を持つこと。

---

# Program Validatorとの関係

Programは編集途中では不完全な状態を許容する。

不完全なProgramもEditorから保存できる。AI実行を開始できるのは、Program ValidatorのErrorが0件の場合だけとする。WarningはAI実行を妨げない。

Programの妥当性検証はProgram Validatorが担当する。

EditorおよびAI Execution EngineはProgramの検証を行わない。

---

# AI実行との関係

AI Execution EngineはProgramを変更してはならない。

AI実行時はProgramを読み取り専用として扱う。

Tickをまたぐ実行状態はWorld State内のRobotがAI Runtime Stateとして保持する。Execution ContextはそのTickで使用する作業コピーを保持する。

---

# 拡張性

新しい命令を追加してもProgram構造は変更しないことを原則とする。

Programは命令内容ではなく、命令の配置と接続を表現する。

---

# 用語

| 用語              | 説明                                           |
| ----------------- | ---------------------------------------------- |
| Program           | AIプログラム全体                               |
| Node              | 命令を表す論理単位                             |
| Connection        | Node内に保持する出力パスから接続先Nodeへの対応 |
| Start Node        | 実行開始地点                                   |
| Parameter         | 命令固有の設定値                               |
| Metadata          | プログラム全体の情報                           |
| Execution Context | 1Tick内のAI実行状態（Programには含まれない）   |

---

# 他仕様との関係

Programの論理モデルは以下の現在仕様から参照される。

- `docs/specs/current/instructions/00_overview.md`
- `docs/specs/current/instructions/concept.md`
- `docs/specs/current/editor/00_overview.md`
- `docs/specs/current/validator/00_overview.md`
- `docs/specs/current/ai/00_overview.md`

Programの構造を変更する場合は、これらの現在仕様との整合性を維持しなければならない。

`docs/specs/planned/simulator/00_overview.md`からも参照されるが、選択したIssueのSource Specに指定されていない限り、将来仕様との整合は通常のレビューをブロックする条件にしない。
