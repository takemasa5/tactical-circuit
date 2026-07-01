# Switch Weapon命令

## 概要

Switch Weapon命令は、右手または左手のWeaponへ切り替える戦闘系行動要求を生成する。

## 対応するInstruction Definition

- `implementationId`: `switch_weapon`
- カテゴリ: `action`
- Instruction Definition ID: `instruction_007b2990-caaf-481a-996b-3e75547eb15a`

## パラメータ

### `hand`

- 型: `enum`
- 必須: true
- 許可値: `right`、`left`
- 既定値: `right`

## 出力パス

`next`をrequiredな出力パスとする。実行中Nodeの`connections.next`を`nextNodeId`として返す。

## 行動要求

```ts
type SwitchWeaponRequest = {
  readonly type: "switch_weapon";
  readonly hand: "right" | "left";
};
```

AI EngineはRobot Body固有のSlot IDを解決しない。SimulatorはRobot Body Definitionの`weaponMount`を使用し、`right`を`right_hand`、`left`を`left_hand`のWeapon Slotへ解決する。

同一Tickですでに戦闘系行動要求が生成されている場合は、Switch Weapon命令の要求で上書きする。移動系行動要求は変更しない。

## CPU消費量

CPU消費量は1とする。

## 動作

Switch Weapon要求をExecution Context Changesへ設定し、`connections.next`へ遷移する。`interruptTick`は`false`とする。

レジスタ、フラグ、永続AIメモリ、コールスタック、移動系行動要求、Random Stateを変更しない。

## Simulatorでの解釈

指定したWeapon Slotが空である場合、または切替を実行できない場合の処理はSimulatorの行動処理に従う。これはAI命令の実行時エラーではない。

## 実行時エラー

検証済みProgramとMaster Dataを前提とするため、通常実行では実行時エラーを発生させない。
