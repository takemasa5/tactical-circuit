# Phase 2 プログラムエディタ仕様

> Status: Draft

## 目的

本書は`spec/02_roadmap.md`のPhase 2で実装するプログラムエディタの範囲と完了条件を定義する。

個々の編集操作は本書から参照する個別仕様で定義する。

---

# 実装範囲

Phase 2では以下を実装する。

* Programの新規作成
* ノードの作成、削除、移動
* 接続の作成、変更、削除
* ノードの選択、複数選択
* パラメータ、コメント、Programメタデータの編集
* Undo、Redo
* ノード群のコピー、貼り付け
* localStorageへのProgram保存とlocalStorageからの読込
* Program JSONファイルのExportとImport
* 上記操作を行うための最小限のProgram Editor UI

Programの編集操作はUIから分離し、Reactに依存しない処理としてテスト可能にする。

---

# Phase 2の対象外

以下はPhase 2の対象外とする。

* Program Validatorによる検証と診断表示
* Program内検索
* AI実行、シミュレーション、デバッグ実行
* 自動整列、グループ化、折りたたみ
* OSのクリップボードとのデータ共有
* 編集操作ごとの自動保存
* タッチ操作とスマートフォン専用UI

Program Validator連携はPhase 3で実装する。検索は実装時期を別途定める。

---

# 依存データ

Program Editorは以下を入力として受け取る。

* 編集対象のProgram
* Data Repositoryが公開する有効なInstruction Definition
* Program新規作成時に使用するStart命令のInstruction ID

Program EditorはStart命令のInstruction IDを推測しない。新規作成を要求する呼出元が、有効なStart命令のInstruction IDを明示する。

Program ID、現在日時など環境に依存する値も呼出元から受け取る。編集処理内で乱数や現在時刻を直接取得しない。

---

# 編集結果

Programを変更する編集操作は、変更後の新しいProgramを返す。入力されたProgramを直接変更しない。

編集操作は成功または失敗を返す。失敗時はProgramを変更せず、UIで表示可能なエラーコードを返す。例外によってアプリケーション全体を停止させない。

実際に値が変化しない操作は成功した変更として扱わず、履歴へ追加しない。

---

# 更新日時

Programを変更する操作が成功した場合、`metadata.updatedAt`を操作時に呼出元から渡されたUTCのISO 8601日時へ更新する。

UndoとRedoは履歴に保存されたProgramをそのまま復元するため、UndoまたはRedoの実行時刻では`updatedAt`を更新しない。

コピー、選択変更、保存要求はProgramを変更しないため、`updatedAt`を更新しない。

---

# UI状態

選択状態、履歴、クリップボード、読込エラーなど編集セッションだけで使用する状態はProgramへ保存しない。

保存対象となるノード位置とコメントだけを`Program.editorState`へ保持する。

---

# 保存と読込

保存形式にはPhase 1で実装したProgram JSON Codecを使用する。

標準の保存先と読込元はlocalStorageとする。ファイルへの保存はExport、ファイルからの読込はImportとして明示的に分離する。

構造上読み込めないJSONは現在のProgramを変更せず、読込エラーを表示する。構造上読み込めるProgramは意味上不完全でも読み込める。

詳細は`persistence.md`で定義する。

---

# 完了条件

Phase 2は以下をすべて満たした時点で完了とする。

* UIから新しいProgramを作成できる
* UIからノードの作成、削除、移動、接続、切断ができる
* UIからパラメータ、コメント、Programメタデータを編集できる
* 複数ノードをコピーして貼り付けられる
* Program全体を対象にUndoとRedoを実行できる
* ProgramをlocalStorageへ保存し、同じ意味を持つProgramとして読み込める
* ProgramをJSONファイルへExportし、同じ意味を持つProgramとしてImportできる
* 編集ドメイン処理に自動テストがある
* ビルド、テスト、Lint、Format checkが成功する

---

# 関連仕様

* `nodes.md`
* `connections.md`
* `selection.md`
* `clipboard.md`
* `history.md`
* `property_editor.md`
* `persistence.md`
* `layout.md`
* `validator.md`
* `search.md`
