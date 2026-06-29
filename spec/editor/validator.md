# Program Validator連携仕様

> Status: Draft

## 目的

本書はProgram EditorとProgram Validatorの責務境界を定義する。

Program Validator本体とEditorへの診断表示はPhase 3で実装する。

---

# Phase 2

Phase 2のProgram EditorはProgram Validatorへ依存しない。

Editorは以下の意味上の妥当性を判定しない。

* Start命令の配置数
* requiredな出力パスの接続
* 到達不能Nodeと循環
* Parameter Valueの必須指定、型、値域
* Node参照とMaster Data参照の有効性

編集途中の不完全なProgramも保存および読込できる。

Editor自身の操作に必要な存在確認、Node ID発番、符号付き32bit整数の保証は編集操作の事前条件であり、Program Validatorの代替ではない。

---

# Phase 3で追加する連携

Phase 3では編集後のProgramをProgram Validatorへ渡し、診断結果をProgramとは別のUI状態として保持する。

診断表示は`spec/validator/00_overview.md`で定義された以下を利用する。

* severity
* diagnostic code
* message
* Node ID
* field path
* related Node IDs

診断表示によってProgramを自動変更しない。

Editorは編集後とProgram読込後にProgram全体を検証し、以下を表示する。

* Error件数とWarning件数
* severity、message、diagnostic codeを含む診断一覧
* `nodeId`が示す主Nodeの強調
* `relatedNodeIds`が示す関連Nodeの同時強調

診断一覧からNode単位の診断を選択した場合は、`nodeId`と`relatedNodeIds`のNodeを同時に選択する。Program全体の診断はNode選択を変更しない。

ValidatorのErrorが存在しても編集と保存は継続できる。AI実行だけを禁止する。WarningはAI実行を禁止しない。
