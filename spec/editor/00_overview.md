# editor/00_overview.md

# プログラムエディタ概要

## 目的

本書はプログラムエディタ全体の設計方針および責務を定義する。

プログラムエディタは、プレイヤーがAIプログラムを作成・編集するための機能を提供する。

本書では編集機能全体の共通仕様を扱い、各編集操作の詳細は個別仕様書で定義する。

---

# 基本理念

プログラムエディタはProgramオブジェクトを編集するためのツールである。

画面表示はProgramの視覚的表現であり、Programそのものではない。

編集操作はすべてProgramへ反映される。

表示方法を変更してもProgramの意味は変化しない。

---

# 責務

プログラムエディタは以下を担当する。

* Programの編集
* ノードの配置
* ノードの接続
* パラメータ編集
* Undo
* Redo
* コピー
* 貼り付け
* 検索
* 保存要求
* Program Validatorとの連携

以下は担当しない。

* AI実行
* シミュレーション
* 描画エンジン
* ゲームルール

---

# 編集対象

エディタが編集する対象はProgramである。

Programは以下で構成される。

* ノード
* パラメータ
* コメント
* メタデータ

接続は各Nodeの`connections`に、出力パスIDと接続先Node IDの対応として保持する。Program直下に独立したConnection集合は持たない。

エディタはProgramの構造を維持しながら編集を行う。

---

# ノード

ノードは命令を表す。

ノードは画面上で自由に配置できる。

ノードの位置は編集情報であり、AI実行には影響しない。

---

# 接続

接続はノード間の実行順序を表す。

接続の作成・変更・削除はエディタが行う。

エディタ上の接続は、接続元Node IDと出力パスIDの組み合わせで識別する。独立したConnection IDは発番しない。

接続の妥当性はProgram Validatorが検証する。

---

# パラメータ編集

各命令が持つパラメータはエディタから編集できる。

編集方法は命令種別に応じて変化する。

パラメータの意味は命令仕様で定義する。

---

# Program Validatorとの関係

エディタはProgram Validatorと連携する。

編集後は必要に応じてValidatorを実行し、結果を表示する。

Validatorが検出したエラーは編集画面へ反映する。

EditorはValidation Diagnosticの`nodeId`と`fieldPath`を使用して主な問題箇所を表示し、`relatedNodeIds`を使用して循環や複数Nodeにまたがる関連箇所を同時に強調できる。

エディタ自身はProgramの妥当性を判断しない。

---

# Undo / Redo

編集操作は履歴として保持する。

UndoおよびRedoはProgram全体を対象とする。

履歴管理方法は個別仕様で定義する。

---

# コピー・貼り付け

ノード群はコピーできる。

選択したノード間の接続はコピー時に保持し、選択範囲外のノードへの接続は引き継がない。

貼り付け時はProgram内で一意な識別子を生成する。

---

# 検索

Program内のノードを検索できる。

検索対象は以下を含む。

* 命令種別
* 名前
* コメント
* ラベル

検索方法は個別仕様で定義する。

---

# 表示

エディタはProgramを視覚的に表示する。

表示内容は以下を含む。

* ノード
* 接続
* エラー表示
* Warning表示
* 選択状態
* コメント

表示は編集内容を変更してはならない。

---

# 保存

保存対象はProgramである。

エディタは保存要求を発行する。

実際の保存処理はSave Managerが担当する。

---

# 読込

Programの読込はSave Managerが担当する。

エディタは受け取ったProgramを表示する。

---

# AIとの関係

エディタはAIを実行しない。

Programは保存後にAI実行エンジンへ渡される。

実行中のAIを編集してはならない。

---

# デバッグ表示

エディタは以下を表示できる。

* Program Validator結果
* ノード情報
* パラメータ
* コメント
* 実行開始ノード
* ブレークポイント（将来拡張）

デバッグ表示はProgramへ影響を与えない。

---

# モジュール構成

プログラムエディタは以下のモジュールで構成する。

* Program Editor
* Node Editor
* Connection Editor
* Property Editor
* Selection Manager
* Clipboard Manager
* History Manager
* Validator View
* Search System

各モジュールは独立して実装可能であること。

---

# 拡張性

以下の機能を追加可能な構造とする。

* 自動整列
* コメント
* グループ化
* 折りたたみ
* マクロ
* テンプレート
* デバッグ実行
* リファクタリング支援

既存Programとの互換性を維持することを原則とする。

---

# 個別仕様書

プログラムエディタの詳細仕様は以下で定義する。

* phase2.md
* nodes.md
* connections.md
* selection.md
* clipboard.md
* history.md
* property_editor.md
* persistence.md
* validator.md
* search.md
* layout.md

本書では画面レイアウトやUI操作の詳細は扱わない。
