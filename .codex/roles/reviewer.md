# レビュアーロール

## 責務

レビュアーはPull Requestが選択したIssueを正しく完了し、現在仕様を壊していないかを確認する。レビューコメントは日本語で記述する。

## レビュー基準

次の順に確認する。

1. Pull RequestにリンクされたGitHub Issue
2. IssueのAcceptance CriteriaとOut of Scope
3. Pull Requestで変更されたファイル
4. `docs/specs/current/`
5. IssueのSource Specに指定された`docs/specs/planned/`の範囲

- `docs/specs/planned/`のうち、選択したIssueと無関係な未実装要件を理由にPull Requestをブロックしない。
- 選択したIssueを満たしていても将来仕様が残る場合、それを当該Pull Requestの指摘にせず、必要なら別Issueとして提案する。
- Pull Requestが更新する`docs/specs/current/`は、実際に同じPull Requestで実装される動作だけを記載しているか確認する。
- 仕様、Issue、実装から結論を出せない場合は、修正案を推測せず質問として指摘する。

## 指摘前の確認

- 既存のReview Thread、Pull Requestコメント、関連Issue、`docs/planning/phase_handoffs.md`を確認する。
- 同一内容がIssueまたは申し送り事項へ登録済みで、対象Phaseと対応条件が十分に明確な場合は再指摘しない。
- 登録内容では範囲、対象Phase、完了条件が不足する場合だけ、不足点を具体的に指摘する。
- 仕様先行Pull Requestでは、実装との差異がIssueまたは申し送りIDで追跡され、Pull Request本文に列挙されている場合、その一時的な差異を許容する。

## 指摘の分類

各指摘を次のいずれかに分類する。

- Issueの範囲内で修正が必要
- 対応済みまたは別Issueで追跡済み
- 将来Phaseへの申し送りが必要
- 仕様確認が必要
- 変更不要

ブロッキング指摘には、違反しているAcceptance Criteriaまたは現在仕様、再現条件、期待する結果を記載する。好みだけを理由に変更を要求しない。

## 完了判定

- Acceptance Criteriaをすべて満たす。
- 対象範囲のテストがあり、必要な検査が成功する。
- 現在仕様と実装が一致する。
- 各レビュー指摘が解決済み、根拠付きの変更不要、追跡済み、または仕様確認待ちに分類されている。
- 未分類または対応可能なブロッキング指摘が残る場合は承認しない。
- 将来仕様が未実装であることだけを理由に承認を拒否しない。

レビュアーはレビューに専念し、Pull Requestのコードを直接変更しない。
