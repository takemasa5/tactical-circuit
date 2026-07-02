# Check Ammunition命令

## 概要

Check Ammunition命令は、Tick開始時点で選択されているWeaponの残弾数を指定数量と比較し、結果に対応する出力パスへ遷移する。

## 対応するInstruction Definition

- `implementationId`: `check_ammunition`
- カテゴリ: `branch`
- Instruction Definition ID: `instruction_bc1bed70-1c22-43fe-b7d3-75e319e09b5a`

## パラメータ

### `threshold`

- 型: `ammunition`
- 必須: true
- 既定値: 1
- 範囲: 0以上の符号付き32bit整数

## 出力パス

- `at_least`: 選択中Weaponの残弾数が`threshold`以上の場合
- `less_than`: 選択中Weaponの残弾数が`threshold`未満の場合

どちらもrequiredな出力パスとする。選択した出力パスに対応する実行中Nodeの接続先を`nextNodeId`として返す。

## CPU消費量

CPU消費量は1とする。

## 動作

Execution InputのRobot状態から、Tick開始時点の`selectedWeaponSlotId`とそのSlot IDに対応する残弾数を読み取る。同一Tickに生成された武器切替要求はまだSimulatorへ反映されていないため、判定へ使用しない。

選択中Weaponがない場合、選択中Slotが空の場合、または選択中Slotに残弾数が存在しない場合は、残弾数を0として判定する。

残弾数が`threshold`以上なら`at_least`、未満なら`less_than`へ遷移する。

Execution Contextを変更せず、行動要求を生成しない。

## 実行時エラー

Weaponが選択されていないこと、選択中Slotが空であること、残弾数が存在しないことは実行時エラーではない。

## 決定論

同じExecution Inputと`threshold`からは同じ出力パスを選択する。
