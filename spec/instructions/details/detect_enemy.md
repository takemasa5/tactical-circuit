# Detect Enemy命令

## 概要

Detect Enemy命令は、Execution Inputのセンサースナップショット内に指定範囲の敵Robotが存在するかを判定し、結果に対応する出力パスへ遷移する。

## 対応するInstruction Definition

- `implementationId`: `detect_enemy`
- カテゴリ: `sensor`
- 公開Master Data ID: `instruction_4e80c913-705a-4d87-a05c-4c7f92b4c332`

## 入力

Detect Enemy命令は、実行中NodeのParameter Values、`connections`、Execution Inputの`SensorSnapshot.robots`を読み取る。

ProgramはProgram Validatorを通過済みであることを前提とし、Parameter Valuesと接続の構造を再検証しない。

## パラメータ

### `distance`

- 型: `distance`
- 必須: true
- 範囲: 0以上の符号付き32bit整数
- 単位: ワールド座標系の距離

対象の`distance`がこの値以下の場合に距離条件を満たす。境界値を含む。

### `center_degree`

- 型: `degree`
- 必須: true
- 範囲: 符号付き32bit整数の全範囲

Robotの正面を0度、時計回りを正とする判定範囲の中心角を表す。角度判定前に0以上360未満へ正規化する。

### `sensing_degree`

- 型: `degree`
- 必須: true
- 範囲: 0以上180以下

`center_degree`から左右それぞれへの半角を表す。0は中心角と一致する方向だけ、180は全周を表す。

## 出力パス

- `detected`: 条件を満たす敵Robotが1件以上存在する場合
- `not_detected`: 条件を満たす敵Robotが存在しない場合

どちらもrequiredな出力パスとする。選択した出力パスに対応する実行中Nodeの接続先を`nextNodeId`として返す。

## 判定対象

`SensorSnapshot.robots`のうち、次のすべてを満たすRobotを判定対象とする。

- Runtime Robot IDが自機と異なる
- `status`が`active`

対象配列の順序は判定結果へ影響しない。1件でも範囲条件を満たした時点で結果を`detected`としてよい。

## 角度判定

対象の`bearing`と`center_degree`を0以上360未満へ正規化し、次のように最小角度差を計算する。

```text
difference = abs(normalizedBearing - normalizedCenter)
angularDistance = min(difference, 360 - difference)
```

次の両方を満たす場合に対象を検出範囲内とする。

```text
target.distance <= distance
angularDistance <= sensing_degree
```

距離と角度のどちらも境界値を含む。

## CPU消費量

CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの値は1とする。

## Execution Context Changes

Execution Contextを変更しない。レジスタ、フラグ、永続AIメモリ、コールスタック、行動要求、Random Stateを変更しない。

## 実行時エラー

検証済みProgram、Master Data、Execution Inputを前提とするため、通常実行では実行時エラーを発生させない。

## 決定論

同じParameter ValuesとSensorSnapshotからは同じ出力パスを選択する。対象配列の順序を結果へ使用しない。
