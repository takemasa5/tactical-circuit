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

## developブランチとWork Package

- 対象Phaseの実装開始に必要な仕様をすべて明記し、POの合意を得た時点で、そのPhaseの設計完了とする。
- Phase設計完了時にGitHubリポジトリの`develop`を確認し、存在しなければ設計者がデフォルトブランチの最新commitから作成する。
- `develop`がすでに存在する場合は作り直したり、別のcommitへ移動したりしない。
- 対象Phaseの仕様追加または変更がある場合は、仕様変更だけを含むPull Requestを`develop`向けに作成する。
- 実装Issueを登録する前の仕様変更Pull RequestはIssueなしで作成し、Pull Request本文にGoal、Source Inputs、Acceptance Criteria、Out of Scope、およびPOの合意を記載する。
- 仕様変更のPull Requestが`develop`へマージされるまで、対象PhaseのIssueを登録しない。
- Issue登録前に、すべてのSource Specが`develop`に存在し、POと合意した内容に一致することを確認する。
- 将来仕様を、一つのPull Requestで完了できる独立したWork Packageへ分割する。
- Work Packageは、利用者または上位モジュールから一つの成果として動作確認できる縦断的な単位にする。
- 内部モデル、Schema、計算Utility、個別テストだけを最初の利用箇所から分離せず、Work Package内のチェックポイントとして記載する。
- Work Packageの分割数やAcceptance Criteria数に固定上限を設けない。独立した動作確認、PO判断、外部依存、またはリリース条件が異なる場合に分割する。
- Issueは`docs/planning/issue_template.md`に従い、Goal、User-visible Outcome、Source Spec、Phase Handoff、Acceptance Scenario、Acceptance Criteria、Implementation Checkpoints、Out of Scope、Dependencies、`Resume State`を含める。
- Source Specはファイル名だけでなく、対象セクション名または見出しまで指定する。
- IssueがPhase申し送り事項に関係する場合は、IssueのSource Specに`docs/planning/phase_handoffs.md`の該当箇所を明記する。
- 関連する申し送り事項は、Issue本文のPhase Handoff欄に要約して記載する。
- 関係しない場合も、Phase Handoff欄に`Applicable: No`と理由を記載する。
- Acceptance Criteriaは外部から完了を判定できる表現にし、正常系、異常系、境界条件を含むAcceptance Scenarioを記載する。
- 中断後に同じ作業を再開できるよう、実装チェックポイントと`Resume State`を記載する。
- 可能な範囲で、主な変更候補ファイル、確認すべき既存テスト、読まなくてよい仕様範囲を記載する。
- 依存Issueがある場合は、Issue番号と完了が必要な理由を明記する。
- Work Packageの成果に必要な仕様移動、実装、テスト、および動作確認は同じIssueに含める。成果と無関係な横断的リファクタリングは混在させない。
- 未確定仕様が残るIssueには`question`ラベルを付け、実装可能なIssueとして扱わない。

## 対象外

- 設計者はIssueの実装や、未実装仕様の実装済み判定を行わない。
- 独立した動作確認やPO判断を持つ将来仕様全体を一つのIssueへまとめない。
