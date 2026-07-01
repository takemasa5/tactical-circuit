# Fire命令

## 概要

Fire命令は、Tick開始時点で検出している敵Robotの方向と位置を指定した戦闘系行動要求を生成する。

## 対応するInstruction Definition

- `implementationId`: `fire`
- カテゴリ: `action`
- 公開Master Data ID: `instruction_f47ac10b-58cc-4372-a567-0e02b2c3d479`

## パラメータ

パラメータを持たない。

## 出力パス

`next`をrequiredな出力パスとする。実行中Nodeの`connections.next`を`nextNodeId`として返す。

## 対象

初期バージョンは1対1のGame Sessionだけを対象とする。Execution Inputの`SensorSnapshot.robots`に含まれる、自機以外かつ`active`な検出Robotを射撃対象とする。検出Robotが存在しない場合は射撃要求を生成しない。

複数の敵Robotから対象を選択する仕様は、複数参加者のGame Sessionを追加するときに定義する。

## 行動要求

```ts
type FireRequest = {
  readonly type: "fire";
  readonly targetDirection: Int32;
  readonly targetPosition: Position;
};
```

`targetDirection`はワールド座標系の射撃方向とし、次の計算結果を0以上360未満へ正規化する。

```text
targetDirection = normalizeDegree(自機の向き + 検出Robotのbearing)
```

`targetPosition`には検出Robotの`worldPosition`を設定する。どちらもTick開始時のセンサースナップショットから生成した固定値とし、行動要求の生成後に対象Robotが移動しても更新しない。

SimulatorまたはWeapon実装は、直線軌道を使用する武器では`targetDirection`、目標位置を使用する武器では`targetPosition`を参照できる。Fire命令は選択中Weaponの種類を解釈しない。

同一Tickですでに戦闘系行動要求が生成されている場合は、Fire命令の要求で上書きする。移動系行動要求は変更しない。

## CPU消費量

CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの値は1とする。

## 動作

検出Robotが存在する場合はFire要求をExecution Context Changesへ設定する。存在しない場合は戦闘系行動要求を変更しない。どちらの場合も命令は正常終了し、CPUコストを消費して`connections.next`へ遷移する。`interruptTick`は`false`とする。

レジスタ、フラグ、永続AIメモリ、コールスタック、移動系行動要求、Random Stateを変更しない。

## Simulatorでの解釈

Simulatorは要求を実行する時点で選択されているWeaponを使用する。残弾不足、エネルギー不足、動作段階その他の理由によって発射できない場合の処理はSimulatorとWeaponの仕様に従い、AI命令の実行時エラーにはしない。

## 実行時エラー

検証済みProgram、Master Data、Execution Inputを前提とするため、通常実行では実行時エラーを発生させない。
