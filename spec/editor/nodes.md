# ノード編集仕様

> Status: Draft

## 目的

本書はProgram Editorにおけるノードの作成、削除、移動を定義する。

---

# Programの新規作成

新規Programは以下の入力から作成する。

* Program ID
* Start命令のInstruction ID
* 名前、作者、説明
* 作成日時
* Startノードの初期位置

作成するProgramはStartノードを1つだけ持つ。

* StartノードIDは`node_1`とする
* `startNodeId`は`node_1`とする
* `nextNodeSequence`は2とする
* Startノードの`parameterValues`と`connections`は空とする
* 作成日時と更新日時は同じ入力日時とする
* Startノードの位置を`editorState.nodePositions`へ保持する
* `editorState.comments`は空とする

Start命令のInstruction IDが有効であることの確認は呼出元の責務とする。

---

# ノード作成

ノード作成はInstruction ID、配置位置、操作日時を入力とする。

Node IDには現在の`nextNodeSequence`を使用し、`node_{連番}`形式で発番する。作成後に`nextNodeSequence`を1増加する。削除済みNode IDは再利用しない。

作成するNodeは以下を初期値とする。

* `instructionId`は入力されたInstruction ID
* `connections`は空
* `parameterValues`にはInstruction Definitionで既定値が定義されたパラメータだけを設定する
* 既定値を持たないパラメータは設定しない

既定値は複製して保持し、Instruction Definitionが持つ値を変更しない。

配置位置は符号付き32bit整数の座標とし、`editorState.nodePositions`へ保存する。

`nextNodeSequence`を増加できない場合、または入力位置が範囲外の場合は作成に失敗する。

---

# ノード削除

1回の操作で1つ以上のノードを削除できる。

次の場合は操作全体を失敗とし、どのノードも削除しない。

* 対象が空である
* 存在しないNode IDが含まれる
* `startNodeId`が含まれる

削除成功時は以下を同じ編集操作として行う。

1. 対象Nodeを`nodes`から削除する
2. 対象Nodeの位置とコメントを`editorState`から削除する
3. 残るNodeの`connections`から、削除対象を接続先とする接続を削除する

残るNodeのParameter Valueが削除対象をNode参照している場合、そのParameter Valueは変更しない。意味上不正なNode参照の検出はProgram Validatorが担当する。

`nextNodeSequence`は変更しない。

---

# ノード移動

1回の操作で1つ以上のノードを移動できる。

移動操作はNode IDごとの移動後位置と操作日時を入力とする。すべてのNode IDが存在し、すべての位置が符号付き32bit整数の範囲内である場合だけ成功する。

ドラッグ中の表示位置は一時的なUI状態として扱う。ポインターを離して位置が確定した時点で、ドラッグ開始前から確定位置までを1回の編集操作としてProgramへ反映する。

すべての対象Nodeが元と同じ位置の場合はProgramを変更しない。

---

# Node説明表示

Programキャンバス上のNode、またはInstructionパレットのNode作成候補へマウスポインターを重ねた場合、対応するInstruction Definitionの`description`をツールチップとして表示する。説明表示はProgramを変更しない。

---

# 履歴との関係

ノードの作成、削除、確定した移動はそれぞれ1回の履歴項目とする。

複数ノードの削除または移動も、ユーザーによる1操作につき1回の履歴項目とする。
