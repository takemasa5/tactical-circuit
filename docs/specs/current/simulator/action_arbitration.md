# 行動要求の調停

## 目的

AI Engineが生成したカテゴリ別行動要求を、Simulatorが保持する現在行動へ決定論的に反映する。

## 調停対象

調停はactiveなRobotごとに行い、`movement`と`combat`を独立して処理する。複数Robotは参加者順で処理する。destroyedなRobotは調停せず、行動要求、現在行動、および次動作を空にする。

`RobotState.actionRequests`が`null`のカテゴリでは、継続中の現在行動を取り消さない。

## 現在行動の採用

現在行動がないカテゴリへ新しい要求がある場合、同じTickで現在行動として採用する。採用時は次を持つ。

- `phase`: `preparing`
- `phaseElapsedTicks`: `0`
- `progress`: `null`

`preparing`中の現在行動に同一要求が来た場合、現在行動の要求、段階、経過Tick、および進捗を変更しない。

要求の同一判定は各命令詳細の「行動要求」に従う。Move Forward/Backwardは`distance`を同一判定に使用せず、Turnは`turnTo`を同一判定に使用しない。

`preparing`中の現在行動に異なる要求が来た場合、現在行動を破棄し、新しい要求を`preparing`として採用する。

`executing`または`recovering`中は、新しい要求の有無や内容にかかわらず現在行動を維持する。Phase 1では新しい要求を次動作として保持しない。Movement SystemまたはCombat Systemが行動を完了した時点で、現在行動と次動作を`null`にする。

Phase 1で未対応の要求を保持した現在行動は、対応Systemが`inconsistent_session`として拒否する。正式リリース前の旧Programを動かすための互換分岐は追加しない。

## ActionStatusSnapshot

現在行動または次動作の少なくとも一方が存在するカテゴリの`ActionStatusSnapshot`は`running`、両方とも存在しないカテゴリは`idle`とする。

AI Engineへ現在の動作段階、進捗、採用した要求、次動作の内容は公開しない。
