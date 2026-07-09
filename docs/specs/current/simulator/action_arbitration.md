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

`preparing`中の現在行動に異なる要求が来た場合、現在行動をキャンセルし、新しい要求を`preparing`の現在行動として採用する。

Phase 5には具体的なMovement SystemまたはWeapon Systemが存在しないため、採用した実在の行動を`preparing`から進めず、`phaseElapsedTicks`も増加させない。

## ActionStatusSnapshot

現在行動または次動作の少なくとも一方が存在するカテゴリの`ActionStatusSnapshot`は`running`、両方とも存在しないカテゴリは`idle`とする。

AI Engineへ現在の動作段階、進捗、採用した要求、次動作の内容は公開しない。

## 共通遷移規則

具体的な段階更新では、長さ0 Tickの段階だけを同一Tick内で即座に飛ばす。1 Tick以上を消費した場合は、次段階の処理を次Tickから行う。現在行動完了後の次動作も同じ規則で開始する。

共通の許可遷移は次のとおりとする。

- `preparing`から`executing`
- キャンセルされた`preparing`から、新しい要求の`preparing`
- 正常完了またはキャンセルされた`executing`から`recovering`
- `recovering`完了後、次動作があればその要求の`preparing`
- `recovering`完了後、次動作がなければ現在行動を`null`

事後動作を持たない行動でも、長さ0 Tickの`recovering`を経由したものとして同じ遷移規則を適用する。許可されていない遷移要求はSimulator全体の内部整合性Errorとする。

段階時間、効果、および完了条件を所有する後続サブシステムは、現在段階を直接書き換えず、継続、正常完了、またはキャンセルの遷移結果を共通行動状態更新へ返す。Phase 5の既定処理は`preparing`の継続だけを返す。
