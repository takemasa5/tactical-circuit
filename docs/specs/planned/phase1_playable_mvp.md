# Phase 1 Playable MVP

> Status: PO agreed on 2026-09-13; WP1-1 implemented, WP1-2 planned

## 目的

Phase 1では、複雑な個別機能を完成させる前に、プロダクトの中心ループをGoogle Chrome上で最初から最後まで操作して評価できる状態を作る。

中心ループは次のとおりとする。

1. Programを作成または編集する
2. Program Validatorの結果を確認する
3. 固定された最小構成の対戦を開始する
4. AIが制御するRobotの戦闘経過を確認する
5. 勝敗またはTick上限による結果を確認する
6. 同じ戦闘を最初から再生する
7. Programを修正して再実行する

## 合意済みの範囲

- 既存のProgram Editor、Program Validator、AI Engine、およびSimulator基盤を使用する
- 固定されたMap、Robot、Engine、Sensor、Weapon、Projectile、Game Ruleを1種類ずつ使用する
- 最小限の索敵、前進、旋回、射撃、命中、Damage、撃破、勝敗を通して戦闘を完了できる
- Battle UIで戦闘経過、現在Tick、Robot状態、および結果を確認できる
- ReplayはPhase 1の同一ブラウザーセッション内で最初から再生できる
- 同じ完全なアプリケーションバージョン、Program、固定構成、Master Data、初期状態、および乱数シードから同じ結果を得る

## Phase 1では複雑化しない範囲

- Robotおよびパーツ構成の編集
- 複数種類の装備やMapを比較選択するUI
- 後退、横移動、停止、Obstacle、Robot同士の衝突、および加速度
- Bullet検出、Sensor遮蔽、および複数対象の選択
- Weapon切替、リロード、照準拡散、爆発、Armor、部位Damage、エネルギー、および熱
- Replayのシーク、倍速、永続保存、差分イベント、および圧縮
- 高度なデバッグ表示、演出、サウンド、チュートリアル
- オンライン対戦、共有、ランキング

## ProgramとInstruction

利用できるInstructionと正式リリース前の既存Programの扱いは、実装済みの`docs/specs/current/simulator/phase1_minimal_battle.md`および`AGENTS.md`に従う。

起動時に有効な作業中Programが存在しない場合、Editorは後述のプレイヤー用サンプルProgramを表示する。ValidatorがErrorを返す場合、戦闘開始操作はGame Sessionを作成せず、Editor上の診断を維持する。

## 固定対戦データ

Phase 1のUIは利用者へ構成選択を求めず、実装済みの`docs/specs/current/simulator/phase1_minimal_battle.md`に定義された固定Master Dataと戦闘規則を使用する。

## Playerと相手Program

プレイヤー用サンプルProgramは、前進、前進完了待機、索敵、射撃、射撃間隔の完了待機を経てEndへ到達する。敵を検出しない分岐では旋回、旋回完了待機を経てEndへ到達する。各Endの次TickはStartから再開する。

相手用固定Programは、索敵、射撃、射撃間隔の完了待機を経てEndへ到達する。敵を検出しない分岐では旋回、旋回完了待機を経てEndへ到達する。

両ProgramのDetect Enemyは、距離1000、中心角0度、半角180度を使用する。プレイヤー用サンプルのMove Forwardは距離40、敵非検出時のTurnは右10度とする。相手用固定Programの敵非検出時のTurnも右10度とする。

## 最小Movement規則

実装済みのMove Forward、Turn、固定小数点Geometry、および境界処理は`docs/specs/current/simulator/phase1_minimal_battle.md`に従う。

## Bullet、Damage、勝敗

実装済みのBullet更新、Damage同時適用、および勝敗判定は`docs/specs/current/simulator/phase1_minimal_battle.md`に従う。

## 1 Tickの処理順

実装済みの処理順とError時の原子性は`docs/specs/current/simulator/tick_update.md`に従う。

## Battle生成と再生

戦闘終了までの同期実行と不変Snapshot生成は、実装済みの`docs/specs/current/simulator/phase1_minimal_battle.md`に従う。

Phase 1の再生では既存のReplay保存形式や差分イベントを生成しない。画面はSnapshot配列だけを先頭から読み取り、AI、Sensor、Movement、Weapon、Damage、または勝敗を再計算しない。Snapshot配列はブラウザーのメモリ上だけに保持し、Editorへ戻るか新しい戦闘を開始した時点で破棄する。

再生速度は10 Tick/秒とする。描画が遅れた場合もSnapshotを飛ばさず順に表示する。描画間隔、停止、再開、および画面遷移はシミュレーション結果とSnapshot内容を変更しない。

## UIと画面遷移

Phase 1はReact内の単一ページ状態として、Editor、Battle、Resultの3状態を持つ。URLルーティングは追加しない。

### Editor

- 既存Program EditorとValidator結果を表示する
- アプリ全体をブラウザーの表示領域内へ固定し、ページ自体はスクロールさせない
- Programキャンバスはスクロールバー、ホイール、および右ボタンドラッグで表示位置を移動できる
- `戦闘開始`操作を追加する
- Validator Errorがある場合は開始せず、既存の診断表示を維持する
- 開始処理が失敗した場合はPlayer Programを保持し、Editor内にエラーを表示する

### Battle

- Map、両Robot、Bullet、現在Tick、Tick上限を表示する
- Robotごとに名前、HP、残弾、状態を表示する
- 開始時は初期Snapshotから10 Tick/秒で自動再生する
- `一時停止`、`再開`、`Editorへ戻る`を提供する
- Editorへ戻ってもPlayer Programを変更または破棄しない

### Result

- 勝利、敗北、相互撃破、またはTick上限引き分けを表示する
- 最終Tickと両Robotの最終HPを表示する
- `最初から再生`と`Editorへ戻る`を提供する
- `最初から再生`は同じSnapshot配列の初期Snapshotへ戻り、自動再生する

高度な演出、戦闘ログ、シークバー、速度変更、およびレスポンシブ対応はPhase 1に含めない。

## Acceptance Scenario

### Normal

- 起動時のプレイヤー用サンプルProgramで戦闘を開始し、前進、索敵、射撃、Bullet移動、命中、Damage、および撃破を経て結果へ到達できる
- Battleを一時停止および再開しても、最終結果と各Snapshotが変化しない
- Resultから同じ戦闘を最初から再生できる
- Editorへ戻ってProgramを変更し、新しい戦闘を実行できる

### Error

- Program ValidatorがErrorを返すProgramでは戦闘を開始せず、診断位置をEditorで確認できる
- Master DataまたはGame Sessionの整合性Errorでは部分更新と再生用Snapshotを確定せず、EditorのProgramを失わずにエラーを確認できる
- Robot単位のAI実行時Errorは既存仕様に従って他Robotとゲーム全体を停止させず、確認可能なデバッグ情報として保持する

### Boundary

- Tick上限へ到達した戦闘はTick 600で引き分けとして終了する
- 同一Tickで両Robotが撃破され、残存Bulletがなくなった場合は相互撃破になる
- Robot撃破後も残存Bulletを処理し、その結果による相互撃破を判定できる
- 同じ入力と乱数シードで複数回実行した全Snapshotと最終結果が一致する
- BattleまたはReplayの表示間隔が変化しても、生成済みSnapshotと最終結果が変化しない

## 責務とデータ所有権

- Domain側の責務とSnapshot所有権は`docs/specs/current/13_data_ownership.md`および`docs/specs/current/simulator/phase1_minimal_battle.md`に従う
- Program EditorはProgramだけを編集し、World Stateを変更しない
- Program Validatorは戦闘開始前にProgramを検査し、ErrorがあるProgramの開始を許可しない
- Renderingは再生用World State Snapshotを読み取り、ゲーム結果へ影響を与えない
- UI LayerはProgram、固定対戦入力、および画面状態をApplication Layerへ渡し、Domainロジックを直接所有しない

## Work Package

### WP1-1 最小戦闘を決定論的に完走する

固定された参加者とProgramから、最小限のSensor、Movement、Weapon、Bullet、Damage、Rule処理を通じて戦闘結果と再生用Snapshotを同期的に生成できるようにする。固定Master Data、内部モデル、Schema、計算Utility、および現在仕様への反映を同じWork Packageへ含める。

### WP1-2 編集から再実行までをUIで接続する

Program Editorから戦闘を開始し、Battle UIで生成済みSnapshotの経過と結果を確認し、最初から再生し、Editorへ戻ってProgramを修正して再実行できるようにする。プレイヤー用サンプルProgram、相手用固定Program、およびCodexと人のChrome操作確認を同じWork Packageへ含める。

内部モデル、Schema、固定小数点、衝突Utility、Snapshot表現などは、最初に使用するWork Packageのチェックポイントとして扱い、単独のIssueにしない。
