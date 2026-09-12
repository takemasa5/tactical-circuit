# Phase 1 Playable MVP

> Status: Scope agreed; detailed behavior pending

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
- 固定された最小数のMap、Robot、Engine、Sensor、Weapon、Game Ruleを使用する
- 最小限の索敵、移動、旋回、射撃、命中、ダメージ、撃破、勝敗を通して戦闘を完了できる
- Battle UIで戦闘経過、現在Tick、Robot状態、および結果を確認できる
- ReplayはPhase 1の同一セッション内で最初から再生できる
- 同じ完全なアプリケーションバージョン、Program、固定構成、Master Data、初期状態、および乱数シードから同じ結果を得る

## Phase 1では複雑化しない範囲

- Robotおよびパーツ構成の編集
- 複数種類の装備やMapを比較選択するUI
- 中心ループの確認に不要な高度な移動、Sensor、Weapon、Damage規則
- Replayのシーク、倍速、永続保存、および差分圧縮
- 高度なデバッグ表示、演出、サウンド、チュートリアル
- オンライン対戦、共有、ランキング

## 責務とデータ所有権

- Program EditorはProgramだけを編集し、World Stateを変更しない。
- Program Validatorは戦闘開始前にProgramを検査し、ErrorがあるProgramの開始を許可しない。
- AI EngineはExecution Inputから行動要求を生成し、World Stateを変更しない。
- SimulatorはWorld Stateを変更できる唯一のモジュールとし、Sensor、移動、Weapon、Bullet、Damage、勝敗を決定論的な順序で処理する。
- RenderingはWorld StateまたはReplay再生用World Stateを読み取り、ゲーム結果へ影響を与えない。
- UI LayerはProgram、固定対戦入力、および画面状態をApplication Layerへ渡し、Domainロジックを直接所有しない。
- Phase 1の一時Replayデータは戦闘セッションが所有し、ProgramやMaster Dataへ混入させない。

## 処理順

Phase 1の1 Tickは、既存の`docs/specs/current/simulator/tick_update.md`を拡張し、少なくとも次の責務順を維持する。

1. Tick開始時Snapshotを確定する
2. Sensor情報を生成する
3. 参加者順にAIを実行する
4. 行動要求を調停する
5. 移動系の状態と位置を更新する
6. 戦闘系の状態、Bullet、および衝突を更新する
7. Damageを適用する
8. 撃破、勝敗、およびTick上限を判定する
9. Tickを確定する
10. 再生に必要な状態を記録する

同一Tick内の詳細な発射、Bullet移動、命中、および勝敗判定の前後関係は、実装Issueを登録する前に追補仕様で確定する。

## Acceptance Scenario

### Normal

- ErrorのないProgramを使用して固定対戦を開始し、両RobotのAIが実行され、移動または旋回、索敵、射撃、命中、Damage、撃破を経て結果画面へ到達できる
- 結果から同じ戦闘を最初から再生できる
- Editorへ戻ってProgramを変更し、異なる戦闘として再実行できる

### Error

- Program ValidatorがErrorを返すProgramでは戦闘を開始せず、診断位置をEditorで確認できる
- Master DataまたはGame Sessionの整合性エラーでは部分更新を確定せず、EditorのProgramを失わずにエラーを確認できる
- Robot単位のAI実行時Errorは既存仕様に従って他Robotとゲーム全体を停止させず、確認可能な情報として保持する

### Boundary

- Tick上限へ到達した戦闘は終了し、結果を確認できる
- 同じ入力と乱数シードで複数回実行した最終結果と再生内容が一致する
- 戦闘中または再生中の画面更新頻度が変化しても、Simulatorの結果が変化しない

## 詳細仕様でPO合意が必要な事項

次の事項は実装Work Packageを登録する前に、選択肢と既存仕様への影響を提示して確定する。

- Phase 1でUIから使用可能にするInstructionの集合
- Phase 1の移動速度、旋回、衝突、および行動段階の簡略化範囲
- Sensorの検出距離、視野、遮蔽、および検出対象の最小範囲
- Weapon選択、弾速、発射間隔、装弾数、命中、およびDamageの最小規則
- 撃破、相互撃破、Tick上限、および残存Bulletに関する終了順序
- Phase 1のReplayが保持する情報と再生速度
- 固定対戦で使用するProgram、Robot、Map、およびGame Rule
- Editor、Battle、Result、Replay間の画面遷移と中断操作

これらを確定するまでは、既存の将来仕様を推測で単純化して実装しない。

## Work Package方針

詳細仕様の`develop`へのマージ後、次の縦断成果を基準にWork Packageを登録する。

1. 固定入力から最小戦闘を決定論的に最後まで生成できるDomain Work Package
2. Editorから戦闘、結果、Replay、Editorへの復帰を接続するUI Work Package

内部モデル、Schema、固定小数点、衝突Utility、Replay表現などは、最初に使用するWork Packageのチェックポイントとして扱い、単独のIssueにしない。
