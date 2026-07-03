# プロパティ編集仕様

> Status: Draft

## 目的

本書はProgram EditorにおけるParameter Value、コメント、Programメタデータの編集を定義する。

---

# Nodeプロパティ表示

Nodeを1つだけ選択した場合、Property Editorへ以下を表示する。

- Node ID
- Instruction Definitionの表示名と説明
- Parameter Definitionごとの入力欄
- Nodeコメント

Node IDとInstruction IDはPhase 2では変更できない。

Nodeが未選択、複数選択、または接続選択の場合はNodeプロパティを編集しない。

---

# Parameter Value変更

Parameter Value変更はNode ID、Parameter ID、変更後の値、操作日時を入力とする。

Nodeが存在する場合、指定したParameter IDの値を`parameterValues`へ設定する。元と同じ値の場合はProgramを変更しない。

Parameter Value削除は、指定したParameter IDを`parameterValues`から削除する。未設定の場合はProgramを変更しない。

Program Editorは値域、必須指定、参照先など意味上の妥当性を判定しない。Programが保持可能な構造と符号付き32bit整数の範囲だけを保証する。意味上の検証はProgram Validatorが担当する。

---

# Parameter入力UI

入力UIはInstruction Definitionの`valueType`と`editorInfo`に基づいて選択する。

Phase 2で最低限提供する入力は以下とする。

| Value Type              | 入力方法                     |
| ----------------------- | ---------------------------- |
| 数値型                  | 整数入力                     |
| `boolean`               | チェックボックス             |
| `enum`                  | 選択肢                       |
| `register_reference`    | レジスタ名入力               |
| `flag_reference`        | フラグ名入力                 |
| `memory_reference`      | インデックス用レジスタ名入力 |
| `node_reference`        | Program内Nodeの選択          |
| `master_data_reference` | 指定種別のMaster Data選択    |

数値入力の編集中に空文字や整数として解釈できない文字列になった場合、その文字列は入力欄の一時状態として保持し、Programへ反映しない。符号付き32bit整数として確定できた時点でProgramへ反映する。

読込済みProgramにInstruction Definitionで未定義のParameter IDが存在する場合、その値を削除せず、読み取り専用の未定義項目として表示する。

Parameter名へマウスポインターを重ねた場合、対応するParameter Definitionの`description`をツールチップとして表示する。説明表示はParameter Valueを変更しない。

---

# コメント変更

コメント変更はNode ID、変更後文字列、操作日時を入力とする。

空文字へ変更した場合は対象Node IDを`editorState.comments`から削除する。元と同じ内容の場合はProgramを変更しない。

コメントは複数行を許容する。

---

# Programメタデータ変更

Nodeが選択されていない場合、Programの以下のメタデータを編集できる。

- 名前
- 作者
- 説明

Program IDと作成日時は変更できない。更新日時は編集成功時に自動更新する。

名前、作者、説明は空文字を入力できる。意味上の必須条件が追加された場合はProgram Validatorで検証する。

---

# 履歴単位

確定したParameter Value変更、コメント変更、メタデータ変更をそれぞれ1回の履歴項目とする。

テキスト入力はフォーカスを外した時、または明示的に確定した時にProgramへ反映し、入力中の1文字ごとに履歴を作成しない。
