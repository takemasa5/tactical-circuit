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

* ノード集合
* 接続集合
* メタデータ

Programは1つ以上の命令ノードを持つ。

---

# ノード

ノードはProgramを構成する最小単位である。

1つのノードは1つの命令を表現する。

ノードは以下の情報を持つ。

* 一意な識別子
* 命令種別
* パラメータ
* 接続情報
* 編集情報

ノードの意味は命令仕様によって決定される。

---

# ノードID

すべてのノードはProgram内で一意な識別子を持つ。

ノードIDは表示名とは無関係である。

ノードIDは編集時および保存時にも維持される。

---

# 接続

接続はノード間の実行順序を定義する。

接続は出力端子から入力端子へ接続される。

接続は方向を持つ。

接続情報はProgramの一部である。

---

# 開始ノード

Programは開始ノードを1つ持つ。

AI実行は開始ノードから開始される。

開始ノードの詳細仕様は命令仕様で定義する。

---

# 終了

Programは終了ノードを持つことができる。

終了ノードへ到達した場合、そのTickのAI実行は終了する。

終了ノードへ到達した場合、次Tickで実行するノードはProgramの開始ノードとする。

終了ノードは必須ではない。

CPU上限などによって終了する場合もある。

Programは循環する接続を持つことができる。循環自体はProgramの構造エラーではない。

開始ノードから到達可能で、条件分岐を含まず、循環外へ出る接続を持たない循環は純粋な循環プログラムとする。Program ValidatorはこれをWarningとして報告する。

---

# パラメータ

各ノードは命令固有のパラメータを保持できる。

パラメータの意味は命令仕様で定義する。

Programはパラメータの内容を解釈しない。

---

# 編集情報

Programは編集専用情報を保持できる。

例

* ノード位置
* コメント
* 表示状態
* 折りたたみ状態
* 色

これらはAI実行へ影響しない。

---

# メタデータ

Programはプログラム全体に関する情報を保持できる。

例

* 名前
* 作成者
* バージョン
* 作成日時
* 更新日時
* 説明

メタデータはAI実行に影響しない。

---

# 実行情報

ProgramはAI実行中の状態を保持しない。

以下の情報はProgramではなく、World State内のRobotがAI Runtime Stateとして保持する。

* 次Tickで実行するノードID
* レジスタ
* フラグ
* コールスタック
* 永続AIメモリ

Programは常に静的データである。

そのTickのCPU使用量と行動要求はExecution Contextが保持し、Tickをまたがない。

---

# Programの不変条件

Programは以下の条件を満たすことを前提とする。

* ノードIDは一意である
* 接続は方向を持つ
* 開始ノードは1つである
* ノード種別は有効である

これらの検証はProgram Validatorが担当する。

---

# 編集

EditorはProgramを編集する。

以下の操作はProgramを変更する。

* ノード追加
* ノード削除
* 接続追加
* 接続削除
* パラメータ変更
* コメント変更
* メタデータ変更

編集結果はProgramへ反映される。

---

# 保存

Programは保存可能な論理単位である。

保存形式はProgramの意味を保持しなければならない。

保存形式はJSON等、実装に応じて決定する。

---

# 読込

保存されたProgramは復元可能でなければならない。

読込後のProgramは保存前と同じ意味を持つこと。

---

# Program Validatorとの関係

Programは編集途中では不完全な状態を許容する。

Programの妥当性検証はProgram Validatorが担当する。

EditorおよびAI Execution EngineはProgramの検証を行わない。

---

# AI実行との関係

AI Execution EngineはProgramを変更してはならない。

AI実行時はProgramを読み取り専用として扱う。

実行状態はExecution Contextが保持する。

---

# 拡張性

新しい命令を追加してもProgram構造は変更しないことを原則とする。

Programは命令内容ではなく、命令の配置と接続を表現する。

---

# 用語

| 用語                | 説明                       |
| ----------------- | ------------------------ |
| Program           | AIプログラム全体                |
| Node              | 命令を表す論理単位                |
| Connection        | ノード間の接続                  |
| Start Node        | 実行開始地点                   |
| Parameter         | 命令固有の設定値                 |
| Metadata          | プログラム全体の情報               |
| Execution Context | AI実行中の状態（Programには含まれない） |

---

# 他仕様との関係

Programの論理モデルは以下の仕様書から参照される。

* instructions/00_overview.md
* instructions/concept.md
* editor/00_overview.md
* validator/00_overview.md
* ai/00_overview.md
* simulator/00_overview.md

Programの構造を変更する場合は、これらの仕様書との整合性を維持しなければならない。
