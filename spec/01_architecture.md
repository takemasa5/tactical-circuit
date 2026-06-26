# 01_architecture.md

# システムアーキテクチャ

## 目的

本書はゲーム全体のシステム構成を定義する。

各モジュールの責務と依存関係を明確にし、実装時に責務が混在しないことを目的とする。

本書ではアルゴリズムや詳細仕様は扱わない。

---

# 設計方針

システムは以下の方針で設計する。

* 高凝集・低結合
* モジュール間の責務を明確に分離する
* データ駆動設計を基本とする
* 各モジュールは可能な限り独立してテスト可能とする
* UIとゲームロジックを完全に分離する
* レンダリングとゲームシミュレーションを分離する

---

# 全体構成

```
          ┌─────────────────────┐
          │      UI Layer       │
          └─────────┬───────────┘
                    │
      ┌─────────────┼─────────────┐
      │             │             │
      ▼             ▼             ▼
 Program Editor  Battle UI   Replay UI
      │
      ▼
 Program Data
      │
      ▼
 AI Execution Engine
      │
      ▼
 Battle Simulator
      │
      ▼
 World State
      │
      ▼
 Rendering
```

---

# モジュール一覧

システムは以下のモジュールで構成される。

| モジュール               | 責務        |
| ------------------- | --------- |
| Program Editor      | AI編集      |
| Program Validator   | プログラム検証   |
| AI Execution Engine | AI実行      |
| Battle Simulator    | 戦闘進行      |
| Physics Engine      | 移動・衝突     |
| Weapon System       | 武器処理      |
| Sensor System       | センサー計算    |
| Rendering           | 描画        |
| Replay System       | リプレイ      |
| Save Manager        | 保存・読込     |
| Data Repository     | マスターデータ管理 |

---

# モジュールの責務

## Program Editor

責務

* プログラム編集
* ノード配置
* ノード接続
* Undo / Redo
* コピー
* 貼り付け

責務外

* AI実行
* シミュレーション
* 戦闘処理

---

## Program Validator

責務

* 接続チェック
* 無限ループ検出（静的解析）
* 必須ノード検証
* 命令パラメータ検証

責務外

* 実行処理

---

## AI Execution Engine

責務

* 命令実行
* プログラムカウンタ管理
* CPU使用量管理
* メモリ管理
* レジスタ管理
* 命令スケジューリング

責務外

* 描画
* 物理演算
* ダメージ処理

---

## Battle Simulator

責務

* 戦闘進行
* フレーム更新
* 勝敗判定
* オブジェクト管理

責務外

* AI編集
* UI描画

---

## Physics Engine

責務

* 移動
* 回転
* 加速度
* 衝突判定
* 壁との接触判定

責務外

* AI
* 武器

---

## Weapon System

責務

* 発射
* リロード
* 弾生成
* 命中判定
* ダメージ計算

責務外

* 移動
* AI

---

## Sensor System

責務

* レーダー
* 視界
* 距離計算
* ロックオン
* 索敵情報生成

責務外

* 武器制御

---

## Rendering

責務

* 画面描画
* UI描画
* エフェクト
* アニメーション

責務外

* ゲームロジック

描画結果はゲーム進行へ影響を与えない。

---

## Replay System

責務

* フレーム記録
* フレーム再生
* シーク
* 一時停止
* 倍速再生

責務外

* AI計算

---

## Save Manager

責務

* セーブ
* ロード
* バージョン管理
* データ変換

責務外

* シミュレーション

---

## Data Repository

責務

* 命令データ
* 武器データ
* センサーデータ
* ロボットデータ
* マップデータ

責務外

* ゲーム進行

---

# データフロー

ゲーム開始時

```
Master Data
      │
      ▼
Data Repository
      │
      ▼
Game Session
```

AI編集時

```
Editor

↓

Program Data

↓

Validator

↓

Save
```

戦闘開始時

```
Program Data

↓

AI Engine

↓

Simulator
```

戦闘中

```
Simulator

↓

Sensor System

↓

AI Engine

↓

Command

↓

Simulator

↓

Physics

↓

Weapon

↓

World Update
```

描画

```
World State

↓

Renderer

↓

Screen
```

---

# 更新順序

1. 入力受付（UI）
2. AI更新
3. 移動更新
4. センサー更新
5. 武器更新
6. 衝突判定
7. ダメージ処理
8. 勝敗判定
9. リプレイ記録
10. 描画

各更新は必ずこの順序で実行する。

---

# 依存関係

依存は一方向のみ許可する。

```
Editor
    │
    ▼
Program

    │
    ▼

AI

    │
    ▼

Simulator

    │
    ▼

Renderer
```

逆方向の依存は禁止する。

例

Renderer が AI Engine を直接参照してはならない。

---

# データ共有

モジュール間のデータ共有は World State を介して行う。

World State はSimulatorだけが読み書きできるゲーム世界の唯一の状態とする。
各モジュールは他モジュールの内部状態を直接変更してはならない。


例

```
AI

↓

Execution Context

↓

Action Queue

↓

Simulator

↓

World State

↓

Renderer
```

---

# イベント設計

モジュール間通知にはイベントを利用する。

例

* BattleStarted
* BattleFinished
* RobotDestroyed
* WeaponFired
* BulletHit
* ProgramLoaded
* ReplayStarted
* ReplayStopped

イベントは通知のみを目的とし、ゲームロジックを含めない。

---

# エラー処理

各モジュールは自身の責務内で発生したエラーを処理する。

重大なエラーは上位モジュールへ通知する。

ゲーム全体を停止させる例外処理は最小限とする。

---

# テスト方針

各モジュールは単体テスト可能であること。

推奨するテスト単位

* Program Validator
* AI Engine
* Physics Engine
* Weapon System
* Sensor System
* Replay System

UIはロジックと独立してテスト可能とする。

---

# 将来拡張

本アーキテクチャは以下の追加に対応できることを前提とする。

* マルチプレイ
* オンライン対戦
* 新ゲームモード
* 新命令カテゴリ
* 新武器
* 新センサー
* 新ロボット
* スクリプト拡張
* プラグイン機構

既存モジュールへの影響を最小限に抑える構造を維持する。
