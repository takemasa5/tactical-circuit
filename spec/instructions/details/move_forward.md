# Move Forward命令

## 概要

Move Forward命令は、Robotを正面方向へ指定距離だけ移動させる移動系行動要求を生成する。

## 対応するInstruction Definition

- `implementationId`: `move_forward`
- カテゴリ: `action`
- 公開Master Data ID: `instruction_1b671a64-40d5-491e-99b0-da01ff1f3341`

## パラメータ

### `distance`

- 型: `distance`
- 必須: true
- 既定値: 100
- 範囲: 0以上10000以下

Robotが実際に移動できた距離の累計がこの値以上になった時点を、移動の完了条件とする。

## 出力パス

`next`をrequiredな出力パスとする。実行中Nodeの`connections.next`を`nextNodeId`として返す。

## 行動要求

```ts
type MoveForwardRequest = {
  readonly type: "forward";
  readonly distance: Int32;
};
```

`distance`にはParameter Valueをそのまま設定する。移動速度はRobotに装備されたEngine DefinitionからSimulatorが決定するため、行動要求へ含めない。

同一Tickですでに移動系行動要求が生成されている場合は、Move Forward命令の要求で上書きする。戦闘系行動要求は変更しない。

## CPU消費量

CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの値は1とする。

## 動作

Move Forward命令は移動系行動要求をExecution Context Changesへ設定し、`connections.next`へ遷移する。`interruptTick`は`false`とする。

レジスタ、フラグ、永続AIメモリ、コールスタック、戦闘系行動要求、Random Stateを変更しない。

## Simulatorでの解釈

Simulatorは要求を採用した時点から、Robotが正面方向へ実際に移動できた距離を累計する。衝突、能力制限その他の理由によって移動できなかったTickは進捗を増やさない。累計移動距離が要求の`distance`以上になった時点で実動作を完了する。

位置の単純な始点と終点の差ではなく、Tickごとの実移動距離を累計する。

## 実行時エラー

Robotが移動できないことはAI命令の実行時エラーではない。Move Forward命令は検証済みProgramとMaster Dataを前提とし、通常実行では実行時エラーを発生させない。
