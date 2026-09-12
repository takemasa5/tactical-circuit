# 1 Tick更新

## 目的

実時間から独立した同期APIで、`running`のGame Sessionを入力不変のまま1 Tick進める。

## 更新API

`updateGameSessionTick()`は`running`のGame Sessionだけを受け付ける。入力が`ready`または`finished`の場合は、`invalid_game_status`を返す。Tick増加が符号付き32bit整数を超える場合は`tick_overflow`を返す。

成功時は更新後Game Sessionと、AIを実行したactiveなRobotのデバッグ情報を参加者順で返す。Robot別AIデバッグ情報はWorld StateまたはReplay Dataへ格納せず、ゲーム結果へ影響させない。

成功と失敗のどちらでも入力Game Sessionを変更しない。

## Tick処理順

1 Tick更新は次の順序で処理する。

1. 入力Game Sessionが`running`であることを確認する
2. Tick増加が符号付き32bit整数を超えないことを確認する
3. Tick開始時Game SessionとBullet ID集合をSnapshotとして保持する
4. World Stateを作業状態として複製し、全Robotの`actionRequests`を空にする
5. destroyedなRobotの行動要求、現在行動、および次動作を空にする
6. Tick開始時のactiveなRobotについて、参加者順にAction StatusとSensor Snapshotを生成する
7. activeなRobotのAIを参加者順で実行し、AI Runtime State、Random State、行動要求を反映する
8. activeなRobotの行動要求を参加者順で調停する
9. activeなRobotのMovementを参加者順で更新する
10. activeなRobotのFireを参加者順で処理し、新しいBulletを生成する
11. Tick開始時に存在したBulletを連番順で移動し、命中Damageを収集する
12. Robotごとの合計Damageと撃破状態を同時適用する
13. Tickを1増加する
14. Tick上限、残存Bullet、撃破状態の優先順位で勝敗を判定する
15. 更新後Game SessionとRobot別AIデバッグ情報を返す

Robot State、AI Runtime State、Action Status、およびSensor SnapshotはTick開始時点を使用する。Random Stateだけは共有乱数列の現在値を各RobotのAI実行直前に設定し、1体の実行後に次のRobotより先に反映する。

行動要求はAI実行順にかかわらず同一Tickに生成された要求として扱う。Movement、Fire、Bullet、Damageは全RobotのAI実行後に処理する。

そのTickにFireで生成したBulletはTick開始時Bullet ID集合に含まれないため、次Tickから移動する。

詳細なSensor、Movement、Fire、Bullet、Damage、および勝敗規則は`phase1_minimal_battle.md`に従う。

## AI実行時エラー

AI Engineの`AIDebugInfo.runtimeError`はRobot単位の結果であり、Simulator全体の失敗にしない。

Robot単位のAI実行時Errorでは、正常終了済み命令の変更、行動要求、AI Runtime State、およびRandom StateをExecution Resultどおり反映し、後続参加者とTick処理を継続する。次TickはStart Nodeから再試行する。同じErrorが再発しても各Tickのデバッグ情報へ格納する。

CPU不足はAI実行時Errorではない。CPU残量不足で実行できなかったNodeを次Tickの再開位置とする。

## Simulator全体の回復不能エラー

次の異常は1 Tick更新全体の失敗とする。

- Tickまたはゲームロジックの符号付き32bit整数オーバーフロー
- World State、Game Session、Data Repository間の内部整合性違反
- Phase 1で未対応の行動要求または不正な行動進捗
- Simulatorを安全に継続できない予期しない内部Error

失敗時はTick開始前のGame Sessionを変更せず、部分的なRobot、Bullet、Random State、行動状態、Damage、勝敗、またはTick増加を確定しない。呼出し側は同じ状態を自動再試行しない。

## オブジェクト順序

- Robot State: Tick開始時のWorld State配列順
- Sensor検出Robot: Runtime Robot IDのASCII昇順
- AI実行、行動処理、Damage適用、Robot別デバッグ情報: 参加者順
- Bullet更新と保存順: Bullet IDの連番昇順
- Obstacle State: Tick開始時のWorld State配列順

順序不問のオブジェクトを列挙してゲーム結果を決めない。列挙が必要な場合はキーのASCII文字列昇順を使用する。
