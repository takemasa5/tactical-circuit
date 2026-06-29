# Program Editor UI仕様

> Status: Draft

## 目的

本書はPhase 2で提供するProgram Editor UIの最小構成と操作を定義する。

見た目の詳細、色、フォント、装飾は本書では固定しない。

---

# 画面構成

Program Editorは以下の領域で構成する。

* ツールバー
* Instructionパレット
* Programキャンバス
* Property Editor
* ステータス表示

画面幅が不足する場合もProgramキャンバスを操作できる領域を残す。Phase 2はデスクトップ版Google Chromeを対象とする。

---

# ツールバー

ツールバーは以下の操作を提供する。

* 新規作成
* 保存
* 読込
* Export
* Import
* Undo
* Redo
* コピー
* 貼り付け
* 削除
* Zoom In
* Zoom Out
* 現在のZoom倍率表示

実行できない操作は無効表示する。

新規作成、読込、Importによって未保存の編集内容を破棄する場合は、`persistence.md`に従って確認する。

---

# Instructionパレット

InstructionパレットにはData Repositoryが公開する有効なInstruction Definitionだけを表示する。

Instructionはカテゴリごとに分類し、各項目に少なくとも表示名を表示する。同じカテゴリ内では表示名、Instruction IDの順で文字列昇順に並べる。

Instructionを選択してキャンバス位置を指定することでNodeを作成できる。

無効なInstruction Definitionを参照する既存Nodeはキャンバスから削除せず、Instructionを解決できないNodeとして表示する。

---

# Programキャンバス

キャンバスはProgramのNodeと接続を表示する。

Node位置には`editorState.nodePositions`の論理座標を使用する。表示のスクロール位置は編集セッション中のUI状態とし、Programへ保存しない。

各Nodeには少なくとも以下を表示する。

* Instruction Definitionの表示名
* Node ID
* 入力となる接続領域
* 定義された出力パスごとの出力ポート
* コメントが存在することを示す表示

接続は接続元の出力ポートから接続先Nodeの入力領域まで描画する。描画順はNodeや接続の意味および実行順へ影響しない。

Nodeと接続の選択、Node移動、範囲選択、接続操作は各個別仕様に従う。

## Zoom

ProgramキャンバスはNode、接続、接続プレビュー、選択範囲を含むキャンバス全体を拡大・縮小できる。

Zoom倍率は50%から200%までの範囲とし、Zoom InとZoom Outでは10%ずつ変更する。初期値は100%とする。

Zoom倍率とスクロール位置は編集セッション中だけ使用するUI状態とし、Programへ保存しない。Zoom操作はProgramを変更せず、UndoとRedoの履歴へ追加しない。

Node移動、範囲選択、接続操作では、Zoom倍率を考慮して画面座標をProgramの論理座標へ変換する。

---

# Property Editor

1つのNodeが選択されている場合はNodeプロパティを表示する。

Nodeが選択されていない場合はProgramメタデータを表示する。複数Nodeまたは接続が選択されている場合は、選択数または接続情報だけを表示し、Nodeプロパティを編集しない。

---

# ステータス表示

ステータス領域には少なくとも以下を表示できるようにする。

* 保存、読込、Export、Importの成功
* 操作が失敗した理由
* 未保存の変更の有無

一時的なメッセージだけに依存せず、読込失敗やImport失敗などユーザーの対応が必要なエラーは明示的に閉じるまで確認できるようにする。

---

# キーボード操作

Phase 2では以下のショートカットを提供する。

| 操作 | Windows / Linux | macOS |
| --- | --- | --- |
| Undo | `Ctrl+Z` | `Meta+Z` |
| Redo | `Ctrl+Shift+Z` | `Meta+Shift+Z` |
| コピー | `Ctrl+C` | `Meta+C` |
| 貼り付け | `Ctrl+V` | `Meta+V` |
| 保存 | `Ctrl+S` | `Meta+S` |
| 選択解除 | `Escape` | `Escape` |
| 削除 | `Delete`または`Backspace` | `Delete`または`Backspace` |

テキスト入力欄にフォーカスがある場合、Undo、Redo、コピー、貼り付け、Backspaceはブラウザ標準のテキスト編集を優先する。

保存ショートカットではブラウザ標準のページ保存を実行せず、Program保存を要求する。

---

# アクセシビリティ

ボタンと入力欄には用途を識別できる名前を付ける。

選択状態、無効状態、操作エラーは色だけに依存せず、文字またはWeb標準の状態属性でも判別可能にする。

キーボードだけでツールバー、Instructionパレット、Property Editorの主要操作へ到達できるようにする。
