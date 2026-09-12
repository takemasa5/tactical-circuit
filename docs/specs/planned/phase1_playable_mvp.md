# Phase 1 Playable MVP

> Status: PO agreed on 2026-09-13; ready for implementation

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

Phase 1で新しいNodeとして追加できるInstructionは次の9種類とする。

- Start
- End
- Call
- Return
- Detect Enemy
- Move Forward
- Turn
- Fire
- Wait Action

次のInstruction Definitionは`enabled: false`とし、新しいNodeの作成候補へ表示しない。

- Check Ammunition
- Detect Bullet
- Move Backward
- Stop
- Strafe Left
- Strafe Right
- Switch Weapon

正式リリース前の破壊的変更では`AGENTS.md`に従い、変更前に作成または保存された既存Programを破棄する。既存Programとの後方互換性を維持するための移行処理、互換レイヤー、または戦闘専用の互換性判定は追加しない。

起動時に有効な作業中Programが存在しない場合、Editorは後述のプレイヤー用サンプルProgramを表示する。ValidatorがErrorを返す場合、戦闘開始操作はGame Sessionを作成せず、Editor上の診断を維持する。

## 固定対戦データ

Phase 1のUIは利用者へ構成選択を求めず、次の固定値を使用する。ID、表示名、説明、重量、および未使用リソースの値は既存Master Data規則を満たす値として実装時に定義するが、シミュレーション結果へ影響する値は本節の値に固定する。

### Map

- サイズ: 幅800、高さ450
- Obstacle: なし
- プレイヤー側Spawn: 位置`(200, 225)`、向き90度
- 相手側Spawn: 位置`(600, 225)`、向き270度

### Robot

- 両参加者は同じRobot Bodyと装備構成を使用する
- サイズ: 幅40、高さ40
- 最大HP: 100
- 最大Energy: 100
- Heat Capacity: 100
- Engine、Sensor、右手Weaponを各1つ装備する
- 左手Weapon Slotは空とする
- 初期選択Weaponは右手Weaponとする

### Engine

- `maxForwardSpeed`: 4座標単位/Tick
- `turnSpeedDegree`: 10度/Tick
- `acceleration`: 4。ただしPhase 1のMovement Systemは加速処理を行わず、最初の実動作Tickから`maxForwardSpeed`を使用する
- 前進と旋回のprepare Tickおよびrecovery Tick: 0
- `blockedCancelTicks`: 1
- 後退速度および横移動速度: 0
- エネルギー消費: 0

### Sensor

- 検出距離: 1000
- 視野: 360度
- エネルギー消費: 0

Sensor Snapshotには、検出距離内にいる自機以外の`active`なRobotだけをRuntime Robot IDのASCII昇順で格納する。Bulletは格納しない。Obstacleによる遮蔽は行わない。

距離は2点間のユークリッド距離を整数平方根で求め、端数を共通の丸め規則で整数へ確定する。相対方位は0度から359度の整数方向ベクトル表から対象Vectorとの外積の絶対値が最小となる角度を選ぶ。同値の場合は内積が大きい角度、さらに同値の場合は小さい角度を選ぶ。ゲーム実行時に三角関数を使用しない。

### WeaponとProjectile

- Damage: 25
- 最大装弾数および初期装弾数: 12
- 発射間隔: 10 Tick
- リロード: なし
- Bullet速度: 20座標単位/Tick
- Bulletサイズ: 幅8、高さ8
- Bullet寿命: 50 Tick
- 照準拡散、爆発Damage、エネルギー消費、熱発生: 0

Fire要求を採用したTickに、選択中Weaponの残弾が1以上なら残弾を1減らしてBulletを1個生成する。残弾が0の場合はBulletを生成しないが、発射試行は完了したものとする。Bulletの進行VectorはFire要求の`targetDirection`と固定の整数方向ベクトル表から生成する。

Phase 1のFireには予備動作を設けない。発射試行後は、要求採用Tickを1 Tick目として合計`fireIntervalTicks`の間、combat行動を`running`とする。期間中の新しいcombat要求は採用しない。期間終了後にcombat行動を`idle`とする。Switch Weapon、キャンセル、および次動作は扱わない。この限定規則は`PH-003`の完全な戦闘行動段階仕様を解決しない。

### Game Rule

- 参加者数: 2
- CPU上限: 100/Tick
- Tick上限: 600
- Register名: `A`、`B`、`C`、`D`
- Flag名: `F1`、`F2`、`F3`
- MemoryサイズおよびCall Stackサイズ: 20
- 初期乱数シード: 固定値1

Phase 1の固定処理は乱数を消費しない。

## Playerと相手Program

プレイヤー用サンプルProgramは、前進、前進完了待機、索敵、射撃、射撃間隔の完了待機を経てEndへ到達する。敵を検出しない分岐では旋回、旋回完了待機を経てEndへ到達する。各Endの次TickはStartから再開する。

相手用固定Programは、索敵、射撃、射撃間隔の完了待機を経てEndへ到達する。敵を検出しない分岐では旋回、旋回完了待機を経てEndへ到達する。

両ProgramのDetect Enemyは、距離1000、中心角0度、半角180度を使用する。プレイヤー用サンプルのMove Forwardは距離40、敵非検出時のTurnは右10度とする。相手用固定Programの敵非検出時のTurnも右10度とする。

## 最小Movement規則

Phase 1ではMove ForwardとTurnだけをMovement Systemで処理する。

- 採用したTickにprepareを完了し、同Tickから実動作を開始する
- 同じ行動の要求が続いても進捗を初期化しない
- movement行動が`running`の間に受けた異なるmovement要求は採用しない
- 行動完了時はrecoveryを設けず、同Tickの更新後に`idle`へ戻す
- 行動中の`ActionStatusSnapshot`は既存仕様どおり`running`とする

Move Forwardは0度から359度の固定小数点方向ベクトル表を使用する。スケールは1000とし、実行時に三角関数を使用しない。1 Tickの予定移動距離は`maxForwardSpeed`と要求の残り距離の小さい方とする。固定小数点の内部位置と実移動距離を進捗として保持し、World Stateへ格納する位置と速度は共通規則で整数へ丸める。

Robot矩形がMap境界内に収まる位置だけを有効とする。予定位置が境界外になる場合は、進行経路上で最後に有効な整数位置まで移動して行動を終了する。ObstacleおよびRobotとの衝突判定は行わない。要求距離へ到達した場合も行動を終了し、速度を`(0, 0)`へ戻す。

Turnは位置と速度を変更せず、1 Tickに`turnSpeedDegree`まで指定方向へ旋回する。最後のTickは要求角度を越えない。指定角度へ到達したTickに行動を終了する。

## Bullet、Damage、勝敗

Bullet同士、BulletとObstacle、およびBulletと発射元Robotの衝突は判定しない。Bulletと自機以外のRobotは、移動後の軸平行矩形が面積重複した場合に命中とする。辺または頂点だけの接触は命中としない。

各Tickで更新対象となるのはTick開始時に存在したBulletだけとし、そのTickに生成したBulletは次Tickから移動する。既存BulletはBullet IDの連番昇順で次の順に処理する。

1. 進行Vectorを位置へ加算する
2. 残り寿命Tick数を1減らす
3. 移動後の位置で対象Robotとの命中を判定する
4. 命中したBulletを削除対象とし、WeaponのDamageを対象Robotへ加算する
5. 命中しなかったBulletがMap外へ出た、または残り寿命が0になった場合は削除する

すべてのBulletを処理した後、Robotごとに合計Damageを参加者順で同時適用する。Armor、部位Damage、防御値は使用しない。HPは0未満にせず、0になったRobotを`destroyed`とする。同じTickに両RobotのHPが0になることを許容する。

撃破済みRobotはAI、Movement、およびFireを実行しない。撃破前に発射したBulletは通常どおり更新する。

勝敗はTick更新後のTick値に対して、次の優先順位で判定する。

1. Tickが600へ到達した場合、残HPやBulletにかかわらず`tick_limit`の引き分け
2. Bulletが残っている場合、戦闘を継続
3. 両Robotが`destroyed`なら`mutual_destruction`の引き分け
4. 一方だけが`destroyed`なら、残ったRobotを勝者とする`opponent_destroyed`
5. それ以外は戦闘を継続

## 1 Tickの処理順

Phase 1の1 Tickは、既存の`docs/specs/current/simulator/tick_update.md`を次の順に拡張する。

1. Tick開始時World State Snapshotを確定する
2. 参加者順にSensor Snapshotを生成する
3. Tick開始時に`active`なRobotについて参加者順にAIを実行する
4. AI実行結果とRandom Stateを既存規則どおり反映する
5. 参加者順に行動要求を調停する
6. 参加者順にMovementを更新する
7. 参加者順にFireを処理し、新しいBulletを生成する
8. Tick開始時から存在したBulletを更新して命中を収集する
9. 参加者順にDamageと撃破状態を同時適用する
10. Tickを1増加する
11. Tick上限、残存Bullet、撃破状態の優先順位で勝敗を判定する
12. 更新後World Stateを再生用Snapshotとして記録する

Simulator全体の内部整合性Errorまたは整数オーバーフローでは、Tick開始前のGame Sessionを変更せず、部分更新と再生用Snapshotを確定しない。Robot単位のAI実行時Errorは既存仕様どおり他Robotとゲーム全体を停止させない。

## Battle生成と再生

Application Layerは戦闘開始時に固定対戦入力からGame Sessionを作成し、同期的なDomain APIを呼び出して、戦闘終了までのWorld Stateを先に生成する。Domain APIは初期World Stateと各完了Tick後のWorld Stateを不変Snapshotとして配列へ保持する。最大要素数はTick上限+1とする。

Phase 1の再生では既存のReplay保存形式や差分イベントを生成しない。画面はSnapshot配列だけを先頭から読み取り、AI、Sensor、Movement、Weapon、Damage、または勝敗を再計算しない。Snapshot配列はブラウザーのメモリ上だけに保持し、Editorへ戻るか新しい戦闘を開始した時点で破棄する。

再生速度は10 Tick/秒とする。描画が遅れた場合もSnapshotを飛ばさず順に表示する。描画間隔、停止、再開、および画面遷移はシミュレーション結果とSnapshot内容を変更しない。

## UIと画面遷移

Phase 1はReact内の単一ページ状態として、Editor、Battle、Resultの3状態を持つ。URLルーティングは追加しない。

### Editor

- 既存Program EditorとValidator結果を表示する
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

- Program EditorはProgramだけを編集し、World Stateを変更しない
- Program Validatorは戦闘開始前にProgramを検査し、ErrorがあるProgramの開始を許可しない
- AI EngineはExecution Inputから行動要求を生成し、World Stateを変更しない
- SimulatorはWorld Stateを変更できる唯一のDomainモジュールとする
- 戦闘生成用Application ServiceはSimulatorを戦闘終了まで呼び出し、再生用Snapshotを所有する
- Renderingは再生用World State Snapshotを読み取り、ゲーム結果へ影響を与えない
- UI LayerはProgram、固定対戦入力、および画面状態をApplication Layerへ渡し、Domainロジックを直接所有しない

## Work Package

### WP1-1 最小戦闘を決定論的に完走する

固定された参加者とProgramから、最小限のSensor、Movement、Weapon、Bullet、Damage、Rule処理を通じて戦闘結果と再生用Snapshotを同期的に生成できるようにする。固定Master Data、内部モデル、Schema、計算Utility、および現在仕様への反映を同じWork Packageへ含める。

### WP1-2 編集から再実行までをUIで接続する

Program Editorから戦闘を開始し、Battle UIで生成済みSnapshotの経過と結果を確認し、最初から再生し、Editorへ戻ってProgramを修正して再実行できるようにする。プレイヤー用サンプルProgram、相手用固定Program、およびCodexと人のChrome操作確認を同じWork Packageへ含める。

内部モデル、Schema、固定小数点、衝突Utility、Snapshot表現などは、最初に使用するWork Packageのチェックポイントとして扱い、単独のIssueにしない。
