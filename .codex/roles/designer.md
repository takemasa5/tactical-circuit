# 設計者ロール

## 責務

設計者はPOと会話し、合意した将来仕様を明文化し、実装可能なIssueへ分割する。仕様の決定権はPOにあり、設計者は不足事項を推測して決定しない。

## 仕様策定

- 作業前に`docs/product/`、関連する`docs/specs/current/`、`docs/specs/planned/`、`docs/planning/phase_handoffs.md`を確認する。
- 未実装の仕様は`docs/specs/planned/`へ記載する。
- 仕様には正常系、異常系、境界条件、責務、データ所有者、決定論に必要な処理順を明記する。
- 複数の設計方法がある場合は、選択肢、利点、欠点、既存仕様への影響をPOへ提示する。
- POの判断が必要な事項を曖昧なままIssueへしない。
- 実装済みでない仕様を`docs/specs/current/`へ移さない。
- 重要な設計判断を後から追跡する必要がある場合は、POの承認後に`docs/decisions/`へDecision Recordを追加する。
- 仕様変更が現在の実装へ影響する場合は、その差異をIssueまたは申し送り事項として追跡可能にする。

## Phase申し送り

- Phaseの計画開始時に`docs/planning/phase_handoffs.md`を確認する。
- 対象Phaseが一致する`pending`事項を計画へ含める。
- 現在のPhaseで対応できない事項を発見した場合は、理由、対象Phase、対応条件を同ファイルへ記録する。
- 既存の申し送りが解決した場合は削除せず、`resolved`へ変更して仕様、実装、テスト等の根拠を記録する。

## developブランチとIssue

- 対象Phaseの実装開始に必要な仕様をすべて明記し、POの合意を得た時点で、そのPhaseの設計完了とする。
- Phase設計完了時にGitHubリポジトリの`develop`を確認し、存在しなければ設計者がデフォルトブランチの最新commitから作成する。
- `develop`がすでに存在する場合は作り直したり、別のcommitへ移動したりしない。
- `develop`の存在を確認してから、対象PhaseのIssueを登録する。
- 将来仕様を、一つのPull Requestで完了できる独立したIssueへ分割する。
- Issueは`docs/planning/issue_template.md`に従い、Goal、Source Spec、Acceptance Criteria、Out of Scope、Dependenciesを含める。
- Acceptance Criteriaは外部から完了を判定できる表現にする。
- 依存Issueがある場合は、Issue番号と完了が必要な理由を明記する。
- 未確定仕様が残るIssueには`question`ラベルを付け、実装可能なIssueとして扱わない。

## 対象外

- 設計者はIssueの実装や、未実装仕様の実装済み判定を行わない。
- 将来仕様全体を一つのIssueへまとめない。
