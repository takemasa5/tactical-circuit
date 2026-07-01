# Wait Action命令

## 概要

Wait Action命令は、指定した行動カテゴリの現在の行動と次動作がなくなるまでProgramの進行を待機する。

## 対応するInstruction Definition

- `implementationId`: `wait_action`
- カテゴリ: `control`
- Instruction Definition ID: `instruction_668b0309-f6b3-4d52-8346-d4897d093748`

## パラメータ

### `category`

- 型: `enum`
- 必須: true
- 許可値: `movement`、`combat`
- 既定値: `movement`

`combat`は武器切替、武器発射、格闘をすべて含む。

## 出力パス

`next`をrequiredな出力パスとする。指定カテゴリの行動完了後、実行中Nodeの`connections.next`を`nextNodeId`として返す。

## CPU消費量

CPU消費量は0とする。

## 動作

Wait Action命令は、指定カテゴリについて次の順序で判定する。

1. 現在のExecution Contextですでに行動要求が生成されている場合は待機する。
2. Execution Inputのカテゴリ別行動状態が`running`の場合は待機する。
3. どちらにも該当しない場合は待機を完了する。

待機する場合は`nextNodeId`を実行中のWait Action Node ID、`interruptTick`を`true`として返す。次Tickは同じNodeから再開する。

待機を完了する場合は`connections.next`を`nextNodeId`、`interruptTick`を`false`として返し、同一Tick内でProgramの実行を続ける。

Execution Contextを変更しない。行動要求を生成または取り消さない。

## 実行時エラー

検証済みProgram、Master Data、Execution Inputを前提とするため、通常実行では実行時エラーを発生させない。

## 決定論

同じExecution Context内の行動要求と同じカテゴリ別行動状態からは、同じ待機結果を返す。
