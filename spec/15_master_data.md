# 15_master_data.md

# Master Dataと参照規則

## 目的

本書は、Master Dataの対象、保存形式、ID、参照、読込、検証、不変性を定義する。

---

# 対象

初期バージョンでは以下をMaster Dataとする。

* Instruction Definition
* Robot Body Definition
* Weapon Definition
* Sensor Definition
* Engine Definition
* Armor Definition
* Option Definition
* Projectile Definition
* Map Definition
* Game Rule Definition

以下はMaster Dataに含めない。

* Program
* Robot設計データ
* Game Session
* World State
* Execution Input
* Execution Context
* Execution Result
* Replay Data
* Save Data

---

# 所有権

Data RepositoryはMaster Dataを読み込み、検証し、ID参照を解決する。

読込と検証の完了後、Data RepositoryはMaster Dataを読み取り専用として公開する。ゲーム実行中の更新と削除を禁止する。

---

# ID

Master DataのIDはデータ種別の識別子とUUIDを組み合わせたグローバルIDとする。

```
instruction_{uuid}
robot_body_{uuid}
weapon_{uuid}
sensor_{uuid}
engine_{uuid}
armor_{uuid}
option_{uuid}
projectile_{uuid}
map_{uuid}
game_rule_{uuid}
```

IDはData Repository全体で一意とする。一度公開したIDは変更または再利用しない。

---

# ファイル構成

Master DataはJSONで定義し、1ファイルに1定義を格納する。

```
masterdata/
  manifest.json
  instructions/
  robot_bodies/
  weapons/
  sensors/
  engines/
  armor/
  options/
  projectiles/
  maps/
  game_rules/
```

各データ種別フォルダ直下の`.json`ファイルをすべて読み込む。子フォルダは読み込まない。

ブラウザからファイルシステムの一覧を取得しない。Instruction Definitionについては、開発サーバー起動前とProduction build前にNode.jsスクリプトが`public/master-data/instructions`直下を列挙し、同フォルダの`manifest.json`へ対象ファイル名をASCII文字列昇順で出力する。ブラウザは生成されたmanifestに記載されたJSONを読み込む。Instruction Definitionを追加または削除した場合は、開発サーバーを再起動するかProduction buildを再実行する。

ファイル名は識別、参照解決、処理順に使用しない。ファイル名は`{uuid}.json`を推奨するが、Master DataのIDはJSON内の`id`を正とする。

1ファイルへ複数定義を格納する形式は将来拡張とし、初期バージョンでは扱わない。

---

# Manifest

`masterdata/manifest.json`はMaster Data全体のバージョンを定義する。

```json
{
  "dataType": "master_data_manifest",
  "formatVersion": "0.1.1",
  "payload": {
    "masterDataVersion": "0.1.1"
  }
}
```

Master Dataの追加、削除、性能値、表示情報など内容を変更した場合は`masterDataVersion`のminorを1増加し、buildを1に戻す。

Master DataのJSON構造など互換性を壊す変更でも、majorの固定期間中はmajorを変更しない。変更後のminorとbuildは、構造変更前にプロジェクトオーナーが決定する。majorはプロジェクトオーナーの明示的な指示がある場合のみ変更する。

---

# 保存形式

各Master Dataは共通JSONヘッダを持つ。

```json
{
  "dataType": "weapon",
  "formatVersion": "0.1.1",
  "payload": {
    "id": "weapon_550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Machine Gun",
    "description": "Rapid-fire weapon",
    "enabled": true
  }
}
```

`dataType`はフォルダのMaster Data種別と一致しなければならない。

## 共通フィールド

* `id`：必須。Master DataのグローバルID
* `displayName`：必須。表示名
* `description`：必須。説明
* `enabled`：必須。新規編集時に選択可能かを示す
* `implementationId`：原則として任意。標準と異なる実装を使用する場合に指定する。Instruction DefinitionとOption Definitionでは必須とする

`tags`は初期バージョンの共通フィールドに含めない。

`enabled` が`false`のMaster DataもID参照の解決対象とする。Editorでの新規選択対象からは除外する。

---

# 実装コードとの関係

各Master Data種別は標準実装を1つ持つ。`implementationId`を省略した場合は、そのデータ種別の標準実装を使用する。

Instruction DefinitionとOption Definitionは例外とし、固有の実装を指定する`implementationId`を必須とする。

標準と異なる動作が必要な場合は`implementationId`を指定する。指定された`implementationId`に対応する実装が存在しない場合は検証エラーとする。

性能値、CPU消費、射程、威力などのバランス値はMaster Dataに定義する。アルゴリズムは実装コードが担当する。

少なくとも以下の値を実装コードへ直接埋め込まない。

* 武器性能
* センサー性能
* Robot性能
* CPU消費
* ダメージ
* 射程
* 移動速度

## Instruction Definitionの出力パス

Instruction Definitionは、その命令が選択できる出力パスを`outputPaths`として定義する。

各出力パスは、Instruction Definition内で一意な`id`と、接続を必須とするかを表す`required`を持つ。出力パスIDは小文字の英単語またはスネークケース文字列とする。

命令実装が選択する出力パスIDは`outputPaths`に定義された値でなければならない。命令実装はNodeの`connections`を使用して出力パスを接続先Node IDへ解決し、`nextNodeId`として返す。

## 個別Master Dataのフィールド

個別仕様で別の範囲を定義しない限り、数値フィールドは符号付き32bit整数とする。重量、威力、速度、装弾数、Tick数、熱、エネルギー、排熱性能は0以上とする。`Size`の幅と高さは1以上とする。角度はJSON保存時に0以上360未満へ正規化する。

方向を表す角度と異なり、Sensor Definitionの`fieldOfViewDegree`は視野の広さを表すため1以上360以下とする。360は全周を表す。Weapon Definitionの`aimSpreadDegree`は0以上360未満とする。

Instruction Definitionの`cpuCost`はData Repositoryで0以上であることを検証する。選択するGame Rule DefinitionによってCPU上限が異なるため、CPU上限以下であることはシミュレーション開始時に選択中Game Ruleを使用して検証する。

### Robot Body Definition

* `weight`
* `maxHp`
* `maxEnergy`
* `heatCapacity`
* `size`
* `slots`

各Slot Definitionは`id`、`displayName`、`category`を持つ。`category`は`weapon`、`sensor`、`engine`、`armor`、`option`のいずれかとする。すべてのスロットは空を許容する。

### Weapon Definition

* `projectileId`
* `damage`
* `maxAmmunition`
* `lifetimeTicks`
* `fireIntervalTicks`
* `reloadTicks`
* `heatGeneration`
* `energyConsumption`
* `aimSpreadDegree`
* `weight`
* `ammunitionWeight`

### Sensor Definition

* `detectionDistance`
* `fieldOfViewDegree`
* `energyConsumption`
* `weight`

### Engine Definition

* `maxForwardSpeed`
* `maxBackwardSpeed`
* `maxStrafeSpeed`
* `acceleration`
* `turnSpeedDegree`
* `energyConsumption`
* `weight`

左右の横移動は同じ`maxStrafeSpeed`を使用する。

### Armor Definition

* `durability`
* `defense`
* `weight`
* `heatDissipation`

### Option Definition

Option Definitionは共通フィールドのみを持ち、`implementationId`を必須とする。Option固有の性能値は個別Option仕様を追加するときに定義する。

### Projectile Definition

* `speed`
* `size`
* `explosionRadius`
* `explosionDamage`

`explosionRadius`が0の場合は爆破なしとする。`explosionDamage`が0の場合は爆破ダメージなしとする。弾の寿命Tick数はProjectile DefinitionではなくWeapon Definitionが保持する。

### Map Definition

* `size`
* `obstacles`
* `spawnPoints`

Obstacle Definitionは`id`、`position`、`size`を持つ。Spawn Point Definitionは`position`と`direction`を持つ。参加者配列の順序でSpawn Pointを割り当てる。

### Game Rule Definition

* `cpuLimit`
* `tickLimit`
* `participantCount`
* `registerNames`
* `flagNames`
* `memorySize`
* `callStackSize`

初期Game Ruleの`participantCount`は2とする。既定の`registerNames`は`A`、`B`、`C`、`D`、`flagNames`は`F1`、`F2`、`F3`、`memorySize`と`callStackSize`は20とする。勝敗判定はSimulator仕様に従う。

---

# 参照規則

Master Data間および他データからMaster Dataへの参照はIDで保持する。Master Dataのコピーを参照元へ埋め込まない。

例

```json
{
  "id": "weapon_550e8400-e29b-41d4-a716-446655440000",
  "projectileId": "projectile_6ba7b810-9dad-41d1-80b4-00c04fd430c8"
}
```

各フィールドの必須参照、任意参照、複数参照、配列順序の意味は各Master Data種別の個別仕様で定義する。

---

# 読込と検証

Data Repositoryは以下の順序でMaster Dataを読み込む。

1. `manifest.json`の構造とバージョンを検証する
2. 各データ種別フォルダのJSONを読み込む
3. JSONスキーマ、ID形式、数値範囲、列挙値を検証する
4. Data Repository全体のID重複を検証する
5. `implementationId`を検証する
6. ID参照先の存在とデータ種別を検証する
7. Instruction DefinitionのParameter Definitionについて、制約の整合性、列挙値の重複、および既定値の型と制約を検証する
8. 禁止された循環参照を検証する
9. すべての検証成功後に読み取り専用Data Repositoryを公開する

検証途中の不完全なData Repositoryを他モジュールへ公開しない。

Master Dataのmanifest生成処理と読込処理は開始と正常終了をログへ記録する。ファイル取得、JSON構造検証、意味検証のいずれかに失敗した場合は、対象ファイル、エラーコード、フィールドパス、期待値を含む原因調査可能なエラーログを記録する。

---

# 不正データと欠損参照

* 組み込みMaster Data自体が不正な場合はData Repositoryの公開に失敗する
* Programが未知のInstruction IDを参照する場合はProgram ValidatorのErrorとする
* Robot設計データが未知のPart IDを参照する場合は読込または構成検証Errorとする
* Replayが必要とするMaster Dataを解決できない場合はReplayの読込を拒否する
* 不正または欠損した参照を別のMaster Dataへ暗黙に置換しない

---

# 順序

ファイル名、JSONプロパティ順、ファイルシステムの読込順に依存しない。

個別仕様で順序に意味があると定義した配列は、JSONの配列順を保持する。順序不問の集合を処理する必要がある場合はIDの文字列昇順を使用する。

---

# 重複と上書き

同じIDの重複定義は検証Errorとする。Master Dataの暗黙の上書きを禁止する。

MODやプラグインによるMaster Dataの追加、上書き、名前空間は初期バージョンの対象外とする。

---

# Game Session

Game Session開始時に、Data Repositoryの`masterDataVersion`をGame Sessionへ記録する。Game Session中はMaster Dataを更新しない。

Simulator、AI Engine、EditorはData RepositoryからMaster Dataを読み取るが、更新しない。

---

# Replay Data

Master DataはReplay Dataまたはリプレイ保存データへ埋め込まない。

リプレイ保存データは記録時の`masterDataVersion`と参照するMaster Data IDを保持する。

再生時に現在のData Repositoryの`masterDataVersion`が記録値と一致しない場合は、リプレイの読込を安全に拒否する。
