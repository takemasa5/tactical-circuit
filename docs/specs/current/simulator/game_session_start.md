# Game Session開始操作

## 目的

生成済みのGame Sessionを明示的かつ不変に開始し、Simulator操作の成功または失敗を安定した結果型で返す。

## Simulator結果型

開始操作は次のSimulator結果型を使用する。

```ts
type SimulatorErrorCode =
  | "invalid_game_status"
  | "tick_overflow"
  | "inconsistent_session"
  | "internal_simulator_error";

type SimulatorResult<T> =
  | { readonly success: true; readonly data: T }
  | {
      readonly success: false;
      readonly code: SimulatorErrorCode;
      readonly message: string;
    };
```

失敗結果は呼出し側が分岐に使用できる安定した`code`と、プレイヤーへ表示可能な`message`を持つ。

## 開始操作

`startGameSession()`は`ready`のGame Sessionだけを受け付ける。

成功時はWorld Stateの`status`だけを`running`へ変更した新しいGame Sessionを返す。Tick、Robot、Random Stateその他の値は変更しない。

入力が`running`または`finished`の場合は、`invalid_game_status`の失敗結果を返す。Phase 5では`finished`へ遷移する処理を実装しない。

成功と失敗のどちらでも、入力Game Sessionを変更しない。
