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

Switch Weaponの実動作は、指定した手に対応するWeapon Slotへの切替を1回試行した時点で完了する。Slotが空であるなどの理由で選択中Weaponを変更できなかった場合も切替試行は完了したものとする。実動作の後は事後動作へ移り、事後動作の完了後に現在のcombat行動を終了する。次動作が存在する場合は、その予備動作へ移る。

予備動作、切替試行を行うTick、事後動作の長さ、および実動作のキャンセル可否は、`PHASE_HANDOFFS.md`の`PH-003`に従ってPhase 8で定義する。

## 実行時エラー

検証済みProgramとMaster Dataを前提とするため、通常実行では実行時エラーを発生させない。
