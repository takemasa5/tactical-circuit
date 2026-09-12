# Work Package Issue Template

## Goal

このWork Packageで利用者または上位モジュールが得られる、一つの確認可能な成果を記載する。

## User-visible Outcome

利用者が何をできるようになるかを記載する。UIを含まない場合は、どの上位モジュールからどの動作を確認できるかを記載する。

## Source Spec

- Planned spec: `docs/specs/planned/<file>.md#<section>`
- Current spec: `docs/specs/current/<file>.md#<section>`
- Phase handoff（Applicable: Yesの場合）: `docs/planning/phase_handoffs.md#<section>`

## Phase Handoff

- Applicable: Yes / No
- Source:
  - 申し送り事項に関連する場合は`docs/planning/phase_handoffs.md#<section>`のように参照を書く
- Reason: Work Packageがどのように申し送り事項に関連するかを書く。`Applicable: No`のときは「申し送り事項に関連しない」と記載する

## Acceptance Scenarios

### Normal

- [ ] 利用者または上位モジュールが、成果を最初から最後まで確認できるScenarioを記載する

### Error

- [ ] 不正入力や処理失敗時に、既存状態を壊さず適切な結果を確認できるScenarioを記載する

### Boundary

- [ ] 上限、下限、空、競合、処理順など、この成果に関係する境界Scenarioを記載する

## Acceptance Criteria

- [ ] 上記Scenarioを満たす仕様、実装、自動テストが揃う
- [ ] Codexが上記Scenarioを実行し、結果をPull Requestへ記録する
- [ ] 必要な人の動作確認結果をPull Requestへ記録する
- [ ] 実装した仕様を`docs/specs/current/`へ反映する

## Implementation Checkpoints

- [ ] 最初の利用箇所と一緒に、必要なモデル、Schema、Utilityを追加する
- [ ] 正常系、異常系、境界条件の自動テストを追加する
- [ ] UIまたは上位モジュールへ接続し、Acceptance Scenarioを実行する

チェックポイントは再開可能なcommit単位であり、原則として別Issueや別Pull Requestにしない。

## Out of Scope

- このWork Packageでは実装しない将来仕様を書く
- 成果と無関係なリファクタリングを書く

## Dependencies

- 先に完了する必要があるWork Packageを記載する。依存がない場合は「なし」と記載する

## Resume State

- Branch: 未着手
- Latest checkpoint commit: なし
- Completed checkpoints: なし
- Next checkpoint: 最初の未完了チェックポイント
- Automated checks: 未実行
- Codex operation check: 未実行
- Human operation check: 未実行
- Known issues: なし
- PO confirmation required: なし
