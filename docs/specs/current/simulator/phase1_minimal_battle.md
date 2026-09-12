# Phase 1最小戦闘

## 対象

Phase 1のDomainは、固定された2参加者について次を実装する。

- 全周Sensorによるactiveな相手Robotの検出
- Move Forwardと左右Turn
- 選択中の固定WeaponによるFireと発射間隔
- 直進Bullet、AABB命中、固定Damage
- 撃破、残存Bullet、相互撃破、Tick上限による勝敗
- 固定対戦を終了まで同期実行するApplication Service
- 初期状態と各完了Tick後の不変World State Snapshot

後退、横移動、Stop、Obstacle、Robot同士の衝突、加速度、Bullet検出、遮蔽、Weapon切替、リロード、照準拡散、爆発、Armor、部位Damage、エネルギー、および熱は実装しない。

## 固定Master Data

Phase 1固定対戦は次のMaster Dataを使用する。

- Map: 800×450、Obstacleなし、Spawnは`(200, 225)`の90度と`(600, 225)`の270度
- Robot Body: 40×40、HP 100、Energy 100、Heat Capacity 100
- Engine: 前進4座標/Tick、旋回10度/Tick、prepareとrecoveryは0
- Sensor: 距離1000、視野360度
- Weapon: Damage 25、装弾数12、発射間隔10 Tick、Bullet寿命50 Tick
- Projectile: 速度20座標/Tick、8×8、爆発なし
- Game Rule: 2参加者、CPU 100/Tick、Tick上限600、初期乱数シード1

RobotはEngine、Sensor、右手Weaponを各1つ装備し、左手Weapon Slotは空とする。固定処理はEnergy、Heat、および乱数を消費しない。

新しいNodeとして追加できるInstructionはStart、End、Call、Return、Detect Enemy、Move Forward、Turn、Fire、Wait Actionとする。Check Ammunition、Detect Bullet、Move Backward、Stop、Strafe Left、Strafe Right、Switch Weaponは公開Instruction Definitionを`enabled: false`とする。

## 決定論的Geometry

0度から359度の方向を、0度=`+Y`、90度=`+X`、スケール1000の生成済み整数方向表で扱う。ゲーム実行時に三角関数を使用しない。

距離は整数平方根で最も近い整数へ丸める。方位は対象Vectorと方向表の外積絶対値が最小となる角度を選び、同値なら内積が大きい角度、さらに同値なら小さい角度を選ぶ。これにより方向表の丸めで隣接角度が同じ内積になっても、真正面を0度として検出できる。

## Sensor Snapshot

Tick開始時の各active Robotについて、装備Sensorの検出距離と視野内にいる自機以外のactive Robotを検出する。結果はRuntime Robot IDのASCII昇順とする。検出情報はWorld位置、自機相対位置、整数距離、自機正面を0度とする相対方位、および状態を持つ。Bullet配列は空とし、Obstacle遮蔽は行わない。

## Movement

Move ForwardとTurnは要求採用Tickに`preparing`から`executing`へ遷移し、同Tickから効果を適用する。prepareとrecoveryは0である。同じ種類の要求を受けても進捗と完了目標を変更しない。`executing`または`recovering`中の新しい要求は採用しない。

Move Forwardはスケール1000の内部位置と累積実移動距離を`MovementProgress`へ保持する。1 Tickに前進速度と残り距離の小さい方まで進み、World Stateの位置と速度は整数へ丸める。Robot矩形がMap境界を越える移動は、最後に有効な整数位置で終了する。要求距離へ到達した場合または1座標単位も進めない場合に行動を終了し、速度を0へ戻す。

Turnは位置を変えず、1 Tickに旋回速度まで指定方向へ旋回する。最後のTickは`turnTo`を越えず、到達したTickに行動を終了する。

## Fire

Fire要求を採用したTickに、選択中Weaponの残弾が1以上なら残弾を1減らし、Robotの更新後位置からBulletを1個生成する。残弾0でも発射試行は完了する。Bullet IDはWorld Stateの次回連番を参加者順に使用する。

発射試行後は要求採用Tickを1 Tick目として`fireIntervalTicks`の間combat行動を`running`とする。期間中のcombat要求は採用しない。期間終了後に`idle`へ戻す。Phase 1ではFireのキャンセル、次動作、Switch Weaponを扱わない。

## BulletとDamage

各Tickで移動するのはTick開始時に存在したBulletだけとし、そのTickに生成したBulletは次Tickから移動する。既存BulletをBullet連番昇順で次の順に処理する。

1. 進行Vectorを位置へ加算する
2. 残り寿命を1減らす
3. 発射元以外のactive Robotとの移動後AABB面積重複を参加者順で判定する
4. 命中DamageをRobotごとに加算する
5. 命中、寿命0、またはMap外のBulletを削除する

すべてのBulletを処理した後、Robotごとの合計Damageを同時適用する。HPは0未満にせず、0になったRobotを`destroyed`とする。撃破時は速度、行動要求、現在行動、および次動作を空にする。撃破前に生成したBulletは消滅まで処理する。

## 勝敗

Damage適用後にTickを1増加し、次の優先順位で判定する。

1. Tick上限へ到達した場合は`tick_limit`の引き分け
2. Bulletが残っている場合は継続
3. 両Robotが撃破なら`mutual_destruction`の引き分け
4. 一方だけが撃破ならactiveなRobotを勝者とする`opponent_destroyed`
5. それ以外は継続

撃破済みRobotは次Tick以降のSensor生成、AI、Movement、およびFireを実行しない。

## 固定対戦Application Service

`runFixedBattle()`はプレイヤーProgram、相手Program、およびData Repositoryを受け取り、固定Robot設計データからGame Sessionを作成する。Programまたは固定入力が不正な場合は`invalid_battle_input`を返し、部分Snapshotを返さない。Simulator処理が失敗した場合は`simulator_error`を返す。

成功時はGame Sessionを開始し、`finished`まで`updateGameSessionTick()`を同期的に呼び出す。開始時と各Tick完了後のWorld Stateを独立して複製、freezeしたSnapshotとして保持する。Snapshot数はTick上限+1以下とする。

成功結果は最終Game Session、Snapshot配列、およびTickごとのRobot別AIデバッグ情報を返す。Snapshotは再生時にシミュレーションを再計算せず順に表示するための一時データであり、Replay Dataや永続保存データではない。
