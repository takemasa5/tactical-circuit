# 1 Tick更新

## 目的

実時間から独立した同期APIで、`running`のGame Sessionを入力不変のまま1 Tick進める。

## 更新API

`updateGameSessionTick()`は`running`のGame Sessionだけを受け付ける。入力が`ready`または`finished`の場合は、`invalid_game_status`の失敗結果を返す。

Tick増加が符号付き32bit整数を超える場合は、更新前に`tick_overflow`の失敗結果を返す。

成功時は次を返す。

- 更新後Game Session
- 参加者配列と同じ順序のRobot別AIデバッグ情報

Robot別AIデバッグ情報はRuntime Robot IDと`AIDebugInfo`を持つ。World StateまたはReplay Dataへ格納せず、ゲーム結果と決定論的なWorld State変化へ影響させない。

成功と失敗のどちらでも、入力Game Sessionを変更しない。

## Tick処理順

1 Tick更新は次の順序で処理する。

1. 入力Game Sessionが`running`であることを確認する
2. Tick増加が符号付き32bit整数を超えないことを確認する
3. Tick開始時のWorld Stateを作業状態として複製する
4. 全Robotの`actionRequests`を空にする
5. Tick開始時の各Robotについて`ActionStatusSnapshot`を生成する
6. 各RobotのSensor Snapshotを空配列で生成する
7. 参加者配列の先頭から順にAI Engineを実行する
8. RobotごとにExecution ResultのAI Runtime State、Random State、`actionRequests`を作業状態へ反映する
9. すべてのAI実行後、参加者順に行動要求を現在行動または次動作へ調停する
10. Tickを1増加する
11. 更新後Game SessionとRobot別AIデバッグ情報を返す

Phase 5のSensor Snapshotは`robots`と`bullets`を常に空配列とする。World State内の他RobotやBulletを無条件に公開しない。

Robot State、AI Runtime State、Action Status、およびSensor SnapshotはTick開始時点のスナップショットを使用する。Random Stateだけは共有乱数列の現在値を、各RobotのAI実行直前にExecution Inputへ設定する。

AI Runtime StateとRandom Stateは、1体のAI実行後、次のRobotのAIを実行する前に反映する。Random Stateは全参加者が共有する1本の乱数列として参加者順に消費する。

行動要求はAI実行順にかかわらず同一Tickに生成された要求として扱う。Phase 5では物理効果がないためRobot間の解決は発生しない。

Game Rule Definitionの`tickLimit`による終了判定はPhase 5で行わない。

## AI実行時エラー

AI Engineの`AIDebugInfo.runtimeError`はRobot単位の結果であり、Simulator全体の失敗にしない。

Robot単位のAI実行時エラーが発生した場合は、Execution Resultどおり、正常終了済み命令の変更、行動要求、AI Runtime State、およびRandom Stateを反映する。対象Robotの当該TickのAI実行だけを終了し、後続参加者のAI実行とTick処理を継続する。

次TickはProgramのStart Nodeから再試行する。同じ実行時エラーが再発しても抑制せず、各TickのRobot別AIデバッグ情報へ格納する。

実行時エラーを起こしたRobotをGame Session終了まで無効化しない。他RobotによるWorld State変化を反映した次TickのExecution Inputから、異なる判断または結果になることを許容する。

CPU不足はAI実行時エラーではない。CPU残量不足で実行できなかったNodeを次Tickの再開位置とする。

## Simulator全体の回復不能エラー

Robotへ帰属できない次のような異常は、1 Tick更新全体の失敗とする。

- Tick増加の符号付き32bit整数オーバーフロー
- World State、Game Session、Data Repository間の内部整合性違反
- Simulatorの処理を安全に継続できない予期しない内部エラー

失敗時はTick開始前のGame Sessionを変更せず、安定したError codeとプレイヤーへ表示可能なmessageを返す。部分的なRobot更新、Random State更新、行動状態更新、またはTick増加を確定しない。

呼出し側は同じ状態を自動再試行しない。

## オブジェクト順序

Tick更新では次の順序を維持する。

- AI実行とRobot別デバッグ情報: 参加者順
- Bullet State: 生成順

順序不問のレジスタ、フラグなどのオブジェクトを列挙してゲーム結果を決めない。列挙が必要な場合はキーのASCII文字列昇順を使用する。
