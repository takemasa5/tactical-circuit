# Game Session生成

## 目的

検証済みData Repository、参加者、Map、Game Rule、初期乱数シードから、部分状態を公開せず決定論的な初期Game Sessionを生成する。

## 生成入力

`createGameSession()`は次を明示入力として受け取る。

- Robot設計データと、その設計が参照するProgramを持つ参加者配列
- Map Definition ID
- Game Rule Definition ID
- 符号付き32bit整数の初期乱数シード
- 検証済みData Repository

初期乱数シードは呼出し側が指定し、生成処理は実行環境の乱数生成器を使用しない。

## 開始前検証

次を検証し、検出したErrorを配列で返す。Errorが1件でもある場合はGame SessionまたはWorld Stateを返さない。

- Map Definition IDとGame Rule Definition IDをData Repositoryで解決できる
- 参加者数がGame Rule Definitionの`participantCount`と一致する
- Map DefinitionのSpawn Point数が参加者数以上である
- 参加者順に発番したRuntime Robot IDが一意である
- Robot設計データのBody、装備、初期装弾数、初期選択Weaponの参照が有効である
- 参加RobotごとにEngineをちょうど1つ装備している
- Robot設計データの`programId`と渡されたProgramのIDが一致する
- Program ValidatorがProgramにErrorを返さない
- Programの参照値と、使用するInstruction Definitionの既定参照値に含まれるレジスタ、フラグ、メモリ参照用レジスタがGame Rule Definitionに存在する
- ProgramのNodeが実際に使用するInstruction Definitionの`cpuCost`がGame Rule Definitionの`cpuLimit`以下である

メモリ容量とコールスタック容量は、検証済みGame Rule Definitionの正の`memorySize`と`callStackSize`を実行時の前提とする。Data Repository内の未使用Instruction DefinitionはCPU上限との照合対象にしない。

Data Repositoryで検証済みのMap配置を信頼し、参加Robotの実サイズを使った配置の再検証は行わない。同じRobot設計データまたはProgramを複数の参加者が使用できる。

Engine装備数検証は参加RobotのRobot設計データとRobot Body DefinitionのSlot Definitionを使用する。Slotの`category`が`engine`であり、Robot設計データの`equipment`に対応するSlot IDが存在し、参照先がEngine Definitionである装備をEngine装備として数える。Robot設計データの保存および読込では、Engine装備数が0個または2個以上であることを許容する。

## 初期Game Session

参加者配列の先頭から`robot_1`、`robot_2`の順にRuntime Robot IDを発番する。Game Session参加者配列とRobot配列は入力参加者順を維持する。

参加者ごとにRobot設計データとProgramの読み取り専用スナップショットを作成し、入力との可変参照および別参加者のスナップショットとの可変参照を共有しない。

初期World Stateは次を持つ。

- `tick`: `0`
- `status`: `ready`
- `result`: `null`
- `bullets`: 空配列
- `nextBulletSequence`: `1`
- `randomState`: 初期乱数シードから共通決定論規則で初期化した状態
- `obstacles`: Map Definitionの配列順を維持した複製

初期乱数シードの32bitビット列が0の場合、World Stateの内部状態を`0x6D2B79F5`へ置き換える。Game Sessionの`initialRandomSeed`には置換前の入力値を保持する。`masterDataVersion`は現在の固定バージョン`0.1.1`とする。

## 初期Robot State

参加者配列と同じ添字のSpawn Pointを割り当て、その`position`をRobot中心点、`direction`を初期方向とする。各Robot Stateは次で初期化する。

- `id`: 参加者順に発番したRuntime Robot ID
- `robotDesignId`: Robot設計データID
- `position`、`direction`: 対応するSpawn Pointの値
- `velocity`: `{ x: 0, y: 0 }`
- `currentHp`、`energy`: Robot Body Definitionの`maxHp`、`maxEnergy`
- `heat`: `0`
- `status`: `active`
- `partDamage`: 装備済みSlot IDだけをASCII文字列昇順で格納し、各値を`0`
- `selectedWeaponSlotId`: `initialWeaponHand`から解決したSlot ID、または`null`
- `ammunition`: Robot設計データの初期装弾数のコピー
- `aiRuntimeState`: Game Rule DefinitionとProgramのStart Nodeから生成した初期状態
- `actionRequests`: 両カテゴリとも`null`
- `actionState`: 両カテゴリとも現在行動と次動作が`null`

空スロットは`partDamage`へ追加しない。`maxHp`または`maxEnergy`が0でも値をそのまま使用し、撃破や行動不能は判定しない。
