# 開発ロードマップ

## 目的

本書は、早期にゲーム全体を操作して確認し、その後のPhaseで不足する機能を継ぎ足す実装順序を定義する。

## Phaseの考え方

- Phase 1で、複雑な機能を省いた状態でもゲームの中心ループをUIから最後まで確認できるPlayable MVPを作る。
- Phase 2以降は、Phase 1の中心ループを壊さず、不足する深さ、選択肢、操作性、コンテンツを追加する。
- 各Phaseはデータ層や特定モジュールだけで完了させず、必要なUIと動作確認を同じPhaseへ含める。
- 実装はWork Packageへ分ける。内部モデルやUtility単体ではなく、利用者または上位モジュールから確認できる縦断機能を一つのWork Packageにする。
- 各Phaseの最後に、Codexと人が同じAcceptance Scenarioを実行する。
- Work Package、Pull Request、レビュー、および再開方法は`docs/planning/development_workflow.md`に従う。

## 旧Phase表記

現在仕様、過去のIssue、Pull Request、Decision Record、および一部の将来仕様に残るPhase 0〜16は、2026年7月まで使用した技術モジュール別の旧Phase表記である。

旧Phase 0〜5で実装済みの開発基盤、データ構造、Program Editor、Program Validator、AI Engine、Simulator基盤と、旧Phase 6で実装済みの一部は、新Phase 1の開始時点における実装済み基盤として扱う。過去の追跡可能性を壊さないため、実装済み文書や履歴上の旧Phase番号は一括変更しない。

今後新しく作成する計画とIssueでは、本書の新Phase番号を使用する。

---

# Phase 1: Playable MVP

## 目的

プレイヤーがProgramを編集し、固定された最小構成のロボット同士を戦わせ、戦闘経過と結果を確認し、Programを修正して再実行できる状態を作る。

## 実装方針

Phase 1では、ゲーム全体の接続確認に必要な最小機能だけを実装する。パーツ選択、複数コンテンツ、高度な物理、詳細なリプレイ操作など、中心ループの確認に不要な複雑さは後続Phaseへ送る。

## 最小セット

- 既存のProgram Editor、Program Validator、AI Engineを戦闘開始フローへ接続する
- 固定されたMap、Robot、Engine、Sensor、Weapon、Game Ruleを使用できる
- AIが最小限の索敵、移動、旋回、射撃を要求できる
- SimulatorがRobotとBulletをTick単位で更新し、命中、ダメージ、撃破、勝敗、Tick上限を処理できる
- Battle UIで戦闘開始、経過、現在Tick、Robot状態、終了結果を確認できる
- 戦闘結果を最初から再生し、Program Editorへ戻って修正後に再実行できる
- 同じ入力と乱数シードから同じ結果を再現できる

## 明示的な簡略化

- Robotとパーツは固定プリセットとし、パーツ編集UIを実装しない
- コンテンツは中心ループの確認に必要な最小数とする
- 移動、Sensor、WeaponはPhase 1のScenarioに必要な基本動作へ限定する
- リプレイはメモリ上で最初から再生できればよく、シーク、倍速、永続保存、差分圧縮を実装しない
- 高度なデバッグ表示、演出、サウンド、レスポンシブ対応、チュートリアルを実装しない
- 詳細仕様でPhase 1に必要な範囲を確定するまで、将来仕様を推測で簡略実装しない

## 推奨Work Package

### WP1-1 最小戦闘を決定論的に完走する

固定された参加者とProgramから、最小限のSensor、Movement、Weapon、Bullet、Damage、Rule処理を通じて戦闘結果まで同期的に生成できるようにする。内部モデル、Schema、計算Utilityは最初の利用箇所と同じWork Packageへ含める。

### WP1-2 編集から再実行までをUIで接続する

Program Editorから戦闘を開始し、Battle UIで経過と結果を確認し、最小リプレイを再生し、Editorへ戻ってProgramを修正して再実行できるようにする。

## 完了条件

- Google Chromeで、Program編集から戦闘結果確認、再生、Program修正、再実行までをUIだけで完了できる
- 正常系、開始不能、Tick上限、同一入力の再現性を自動テストとCodex操作で確認できる
- 人が同じAcceptance Scenarioを実行し、中心ループと最低限の操作感を確認している
- Phase 1のRelease Pull RequestでCIが成功し、`@codex review`のブロッキング指摘が解決している
- 実装済み動作が`docs/specs/current/`に反映されている

---

# Phase 2: 移動と物理の拡張

## 目的

Phase 1の基本移動を、機体構成とMap制約を考慮した戦術的な移動へ拡張する。

## 追加候補

- 固定小数点による詳細な速度、加速度、移動距離管理
- 前進、後退、左右横移動、旋回、停止の完全な段階遷移
- キャンセル、次動作、詰まり判定
- Map境界、Obstacle、Robot同士の衝突
- Engine性能差と移動中の状態表示

詳細な移動仕様は`docs/specs/planned/simulator/phase6_movement.md`を機能バックログとして使用し、Phase 1で実装済みとなった部分を除いてWork Package化する。

---

# Phase 3: SensorとAI表現力の拡張

## 目的

戦況を認識してProgramを改善する余地を増やす。

## 追加候補

- 複数Sensorと性能差
- 距離、方位、視野、遮蔽
- Bullet検出
- Sensor情報を利用する分岐命令
- Program検索、自動整列、デバッグ実行などAI編集支援
- Sensor状態とAI判断の可視化

---

# Phase 4: Weaponと戦闘の拡張

## 目的

Phase 1の単純な射撃と勝敗を、選択と対策が生まれる戦闘へ拡張する。

## 追加候補

- 複数Weapon、Weapon切替、装弾数、リロード
- 発射前後の段階時間とキャンセル規則
- Projectile性能、爆発、命中種別
- Armor、部位ダメージ、撃破条件
- 武器・弾・ダメージの表示と戦闘ログ
- `PH-003`の解決

---

# Phase 5: Robot構築とリソース管理

## 目的

固定プリセットから、プレイヤーが戦術に合わせてRobotを構築できるゲームへ拡張する。

## 追加候補

- Robot、Engine、Weapon、Sensor、Armor、Optionの選択
- Slot、重量、互換性の検証
- エネルギー、熱、排熱、行動不能
- Robot設計UIと保存
- `PH-004`の解決

---

# Phase 6: Replay、保存、共有可能なデータ

## 目的

Phase 1の一時的な再生とProgram保存を、継続利用できるデータ機能へ拡張する。

## 追加候補

- Replay差分イベント、シーク、一時停止、倍速再生
- Replay保存、読込、互換性検証
- Robot、Program、設定の統合保存
- データVersion移行
- 共有を見据えたImportとExport

---

# Phase 7: 操作性とデバッグの強化

## 目的

Programの問題発見と改善を速くし、長時間利用できる操作性を整える。

## 追加候補

- AI実行ログ、CPU使用量、現在Node、Sensor範囲、当たり判定の表示
- Battle UI、Replay UI、Program Editorの操作改善
- キーボード操作、アクセシビリティ、レスポンシブ対応
- エラー回復、空状態、読込中状態の改善
- 繰り返す主要操作のE2Eテスト

---

# Phase 8: コンテンツ、バランス、リリース

## 目的

中心ループと拡張機能を、初期リリースとして継続的に遊べる品質へ仕上げる。

## 追加候補

- Robot、Weapon、Sensor、Map、Game Rule、サンプルAIの追加
- バランス調整
- パフォーマンス測定と必要な最適化
- チュートリアル、操作説明、エラー案内
- 演出、サウンド、視覚的な仕上げ
- リリース検査と公開準備

---

# 将来実装

- オンライン対戦
- AI、Replay、Robot構成の共有
- ランキング、トーナメント、キャンペーン
- MODまたはPlugin機構
- 新しいゲームモード

## 開発ルール

- 各Phase開始前に、対象範囲の正常系、異常系、境界条件、責務、データ所有者、および決定論に必要な処理順を仕様へ記載してPOの合意を得る。
- 将来の動作を変更する場合は、実装より先に`docs/specs/planned/`を更新する。
- 実装した動作は`docs/specs/current/`へ反映し、コードとの整合性を維持する。
- 各PhaseはUIまたは上位モジュールから確認できる成果を持ち、内部モジュールの完成だけをPhase完了としない。
- 各Phase完了時には、自動テスト、Codex動作確認、人の動作確認、およびRelease Pull RequestのCodexレビューを実施する。
