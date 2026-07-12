# Stop命令

## 概要

Stop命令は、移動系行動の停止要求を生成する。

## 対応するInstruction Definition

- `implementationId`: `stop`
- カテゴリ: `action`
- 公開Master Data ID: `instruction_d3b66c90-e3e0-433f-a2b1-882a050b071d`

## パラメータ

なし。

## 出力パス

`next`をrequiredな出力パスとする。実行中Nodeの`connections.next`を`nextNodeId`として返す。

## 行動要求

```ts
type StopRequest = {
  readonly type: "stop";
};
```

同一Tickですでに移動系行動要求が生成されている場合は、Stop命令の要求で上書きする。戦闘系行動要求は変更しない。

## CPU消費量

CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの値は1とする。

## 動作

Stop命令は移動系行動要求をExecution Context Changesへ設定し、`connections.next`へ遷移する。`interruptTick`は`false`とする。

レジスタ、フラグ、永続AIメモリ、コールスタック、戦闘系行動要求、Random Stateを変更しない。

## Simulatorでの解釈

実際の停止処理はSimulatorが担当する。Stop命令はRobotの位置、向き、速度、World Stateを直接変更しない。

## 実行時エラー

Robotが停止できないことはAI命令の実行時エラーではない。Stop命令は検証済みProgramとMaster Dataを前提とし、通常実行では実行時エラーを発生させない。
