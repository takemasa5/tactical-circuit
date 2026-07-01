# Turn命令

## 概要

Turn命令は、Robotを指定方向へ指定角度まで旋回させる移動系行動要求を生成する。

Turn命令は行動要求の生成だけを担当し、Robotの向き、エネルギー、速度またはWorld Stateを直接変更しない。実際の旋回量の決定とWorld Stateへの反映はSimulatorが担当する。

## 目的

ProgramからRobotの左右旋回を要求できるようにする。

## 対応するInstruction Definition

- `implementationId`: `turn`
- カテゴリ: `action`
- 公開Master Data ID: `instruction_3d7fb802-6f49-4c76-9f4b-3b6e81a3b221`

Instruction Dispatcherは`implementationId`だけを使用してTurn命令実装を選択する。表示名、カテゴリ、Instruction IDを実装選択に使用しない。

## 入力

Turn命令実装は、命令実行の共通入力から以下を使用する。

- 実行中NodeのParameter Values
- 実行中Nodeの`connections`
- 読み取り専用Execution Context

ProgramはProgram Validatorを通過済みであることを前提とする。Turn命令実装はParameter Valuesと接続の構造を再検証しない。

## パラメータ

### `direction`

- 型: `enum`
- 必須: true
- 許可値: `left`、`right`
- 既定値: `left`

`left`はRobot自身の向きを基準とした左旋回、`right`は右旋回を表す。

### `degree`

- 型: `degree`
- 必須: true
- 範囲: 符号付き32bit整数の全範囲
- 既定値: 90
- 単位: 度

`degree`は、命令実行時点のRobotの正面を0度とした時計回りの相対目標角度を表す。旋回方向によって`degree`の解釈を反転しない。

負数および360以上の値を許容し、`turnTo`の計算前に0以上360未満へ正規化する。正規化後の値が0の場合は命令実行時点のRobotの向き自体を目標角度とし、旋回を必要としない要求になる。

## 出力パス

### `next`

- required: true
- 用途: Turn命令の次に実行するNode

Turn命令は実行中Nodeの`connections.next`を解決し、そのNode IDを`nextNodeId`として返す。

## 行動要求

Turn命令は次のいずれかの移動系行動要求を生成する。

```ts
type TurnRequest = {
  readonly type: "turn_left" | "turn_right";
  readonly turnTo: Int32;
};
```

`direction`が`left`なら`turn_left`、`right`なら`turn_right`とする。`turnTo`は旋回を終了するワールド座標系の角度とし、0以上360未満へ正規化する。

`type`は旋回する方向、`turnTo`は旋回の終了条件を表す。旋回速度はRobotに装備されたEngine DefinitionからSimulatorが決定するため、Turn命令の行動要求には含めない。

同一Tickですでに移動系行動要求が生成されている場合は、Turn命令の要求で上書きする。戦闘系行動要求は変更しない。

## CPU消費量

CPU消費量はInstruction Definitionの`cpuCost`を使用する。公開Master Dataでの値は1とする。

AI Engineは命令実行前にCPU残量を確認する。CPU不足の場合はTurn命令を実行せず、行動要求も生成しない。

## 動作

1. `direction`と`degree`をParameter Valuesから読み取る。
2. Execution Inputから命令実行時点のRobotの向きを読み取る。
3. Robotの向きと`degree`をそれぞれ0以上360未満へ正規化する。
4. 正規化したRobotの向きと`degree`を加算し、再度正規化した値を`turnTo`とする。
5. `direction`に対応する移動系行動要求を生成する。
6. `connections.next`を`nextNodeId`として解決する。
7. 行動要求をExecution Context Changesへ設定する。
8. `interruptTick`を`false`として命令実行結果を返す。

`turnTo`の計算は次のとおりとする。左旋回と右旋回で同じ計算を使用する。

```text
currentDirection = normalizeDegree(Execution InputのRobotの向き)
relativeTargetDegree = normalizeDegree(degree)
turnTo = normalizeDegree(currentDirection + relativeTargetDegree)
```

`normalizeDegree`は角度を0以上360未満へ正規化する。加算前にRobotの向きと`degree`を正規化し、符号付き32bit整数のオーバーフローを発生させない。

Turn命令はレジスタ、フラグ、永続AIメモリ、コールスタックおよびRandom Stateを変更しない。

命令実行結果は次の形とする。

```ts
{
  nextNodeId: connections.next,
  contextChanges: {
    registerWrites: {},
    flagWrites: {},
    memoryWrites: [],
    stackOperations: [],
    movementRequest: {
      type: direction === "left" ? "turn_left" : "turn_right",
      turnTo: normalizeDegree(
        normalizeDegree(currentDirection) + normalizeDegree(degree),
      ),
    },
    randomState: null,
  },
  interruptTick: false,
}
```

## Simulatorでの解釈

SimulatorはRobotの現在の動作状態、Game RuleおよびRobotに装備されたEngine Definitionに従い、要求を採用して実行できるか判定する。要求が採用されない場合もTurn命令の実行時エラーにはしない。

要求を採用した場合、Simulatorは`turnTo`をその行動の終了目標として保持する。現在のTurn行動と新しい要求の`type`が同じ場合は、何をするか、およびどのように実行するかが同一であると判定し、新しい要求を無視する。したがって、後続Tickで同じ命令が生成した要求によって、現在のTurn行動の`turnTo`を変更しない。

Turnの実動作はキャンセル可能とする。現在のTurn行動と異なる`type`の移動系要求を実動作中に受けた場合は、現在のTurn行動をキャンセルして事後動作へ移し、新しい要求を次動作として保持する。

現在の向きから`turnTo`までの残り角度は、旋回方向ごとに次のように計算する。

```text
右旋回の残り角度 = normalizeDegree(turnTo - currentDirection)
左旋回の残り角度 = normalizeDegree(currentDirection - turnTo)
```

そのTickの実旋回角度は、残り角度とEngine Definitionの`turnSpeedDegree`の小さい方とする。最後のTickで`turnTo`を越えて旋回しない。残り角度が0になった時点で旋回を完了する。

Robotが旋回できない状態、または必要なエネルギーを使用できない状態の場合、Simulatorは要求を安全に無視する。これはTurn命令の実行時エラーではない。

## 実行時エラー

Program Validator通過後のProgramと検証済みMaster Dataを前提とするため、通常のTurn命令実行では実行時エラーを発生させない。

DispatcherまたはAI Engineが不正な命令実行結果を検出した場合は、共通の実行時エラー規則に従い、その命令のCPU消費とExecution Context Changesを反映しない。

## 使用例

命令実行時点のRobotの向きが100度、`degree`が45度の場合、左右どちらの旋回でも`turnTo`は145度となる。

- `direction`が`right`の場合は、時計回りに45度旋回する。
- `direction`が`left`の場合は、反時計回りに315度旋回する。

いずれの場合もTurn命令は行動要求を生成した後、同一Tick内で`connections.next`が示すNodeへ遷移する。要求を採用した後の継続動作と完了判定はSimulatorが担当する。

## 注意事項

- 旋回方向はRobot自身の向きを基準とする。
- `degree`はRobotの正面を基準とした相対目標角度であり、`turnTo`はワールド座標系の目標角度である。
- `degree`から`turnTo`への変換では旋回方向を使用しない。
- Turn命令は`turnTo`をAI Runtime Stateへ保存しない。
- 実旋回角度はSimulator側の機体性能と状態によって要求値未満になる場合がある。
- デバッグ情報にはParameter Values、生成した行動要求、`nextNodeId`を実行履歴の1要素として記録する。

## 将来拡張

絶対方位への旋回、目標追尾、旋回完了までの待機はTurn命令へ暗黙に追加しない。必要になった場合は別命令または本仕様の明示的な変更として定義する。
