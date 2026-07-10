# 行動要求の調停

## 目的

AI Engineが生成したカテゴリ別行動要求を、Simulatorが保持する現在行動または次動作へ決定論的に反映する。

## 調停対象

調停はRobotごとに行い、`movement`と`combat`を独立して処理する。複数Robotを更新する呼出し側は参加者順でRobotごとの調停を実行する。

`RobotState.actionRequests`が`null`のカテゴリでは、継続中の現在行動または次動作を取り消さない。

## Phase 5の現在行動採用

現在行動がないカテゴリへ新しい要求がある場合、Simulatorは同じTickで現在行動として採用する。採用した現在行動は次を持つ。

- `phase`: `preparing`
- `phaseElapsedTicks`: `0`
- `progress`: `null`

`preparing`中の現在行動に同一要求が来た場合、現在行動の要求、段階、経過Tick、および進捗を変更しない。

要求の同一判定は各命令詳細の「行動要求」に従う。Move Forward/Backwardは`distance`を同一判定に使用せず、Turnは`turnTo`を同一判定に使用しない。

`preparing`中の現在行動に異なる要求が来た場合、現在行動をキャンセルし、新しい要求を`preparing`の現在行動として採用する。

Phase 5には具体的なMovement SystemまたはWeapon Systemが存在しないため、採用した実在の行動を`preparing`から進めず、`phaseElapsedTicks`も増加させない。

Phase 5の調停では、要求の有無にかかわらず`preparing`以外の現在行動をSimulator全体の内部整合性Errorとする。

## ActionStatusSnapshot

現在行動または次動作の少なくとも一方が存在するカテゴリの`ActionStatusSnapshot`は`running`、両方とも存在しないカテゴリは`idle`とする。

AI Engineへ現在の動作段階、進捗、採用した要求、次動作の内容は公開しない。
