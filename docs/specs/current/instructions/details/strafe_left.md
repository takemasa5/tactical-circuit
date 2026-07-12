# Strafe Left命令

## 概要

Strafe Left命令は、Robotを左方向へ横移動させる移動系行動要求を生成する。

## 対応するInstruction Definition

- `implementationId`: `strafe_left`
- カテゴリ: `action`
- 公開Master Data ID: `instruction_1157e161-e36f-499c-b330-da32bf4fe9f1`

## パラメータ

なし。

## 出力パス

`next`をrequiredな出力パスとする。実行中Nodeの`connections.next`を`nextNodeId`として返す。

## 行動要求

```ts
type StrafeLeftRequest = {
  readonly type: "strafe_left";
};
```

同一Tickですでに移動系行動要求が生成されている場合は、Strafe Left命令の要求で上書きする。戦闘系行動要求は変更しない。

## CPU消費量

CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの値は1とする。

## 動作

Strafe Left命令は移動系行動要求をExecution Context Changesへ設定し、`connections.next`へ遷移する。`interruptTick`は`false`とする。

レジスタ、フラグ、永続AIメモリ、コールスタック、戦闘系行動要求、Random Stateを変更しない。

## Simulatorでの解釈

実際の横移動はSimulatorが担当する。Strafe Left命令はRobotの位置、向き、速度、World Stateを直接変更しない。

## 実行時エラー

Robotが横移動できないことはAI命令の実行時エラーではない。Strafe Left命令は検証済みProgramとMaster Dataを前提とし、通常実行では実行時エラーを発生させない。
