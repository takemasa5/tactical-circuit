# Project Instructions

## 共通ルール

- チャット、Issue、Pull Request、レビューコメントは日本語で記述する。
- POは仕様の最終決定者である。仕様が不足または競合している場合は推測せず、POへ確認する。
- タスクでロールが指定された場合は、次のロール別指示を読む。
  - 設計者: `.codex/roles/designer.md`
  - 実装者: `.codex/roles/implementer.md`
  - レビュアー: `.codex/roles/reviewer.md`
- ロールが指定されていない場合は、依頼内容に対応するロールを明示してから、その指示に従う。
- 変更は要求された範囲に限定し、無関係なファイルを変更しない。
- ユーザーの変更を明示的な依頼なく取り消さない。
- `.env*`を変更またはコミットしない。秘密情報をリポジトリへ追加しない。
- 設定ファイルを変更する前にPOへ確認する。
- `DO_NOT_READ`配下を参照しない。

## 仕様書駆動開発

- 実装より仕様を優先する。
- `docs/specs/current/`は現在の実装が満たすべき仕様であり、通常のレビュー基準とする。
- `docs/specs/planned/`は将来仕様であり、未実装であること自体をレビュー指摘にしない。
- GitHub Issueは、利用者または上位モジュールから一つの成果として確認できるWork Packageと、一つのPull Requestで完了する範囲を定義する。
- 小さい実装単位はWork Package内のチェックポイントとcommitで管理し、内部UtilityやSchemaだけを最初の利用箇所から分離して独立したIssueにしない。
- 例外として、実装Issueを登録する前の仕様変更だけを含むPull RequestはIssueなしで作成できる。この場合はPull Request本文にGoal、Source Inputs、Acceptance Criteria、Out of Scope、POの合意を記載し、それらをレビュー基準とする。
- 選択したIssueが`docs/specs/planned/`の一部をSource Specとして指定した場合、その範囲だけを当該Issueの入力仕様として扱う。
- Issue、`docs/specs/current/`、またはロール別指示が競合する場合は実装せず、POへ確認する。
- コードと`docs/specs/current/`を一致させる。動作変更では仕様を先に更新する。

## ドキュメント構成

- `docs/product/`: プロダクトの目的と共通用語
- `docs/specs/current/`: 実装済み仕様
- `docs/specs/planned/`: 将来仕様
- `docs/planning/`: マイルストーン、Issue雛形、申し送り、設計メモ
- `docs/decisions/`: POが承認した重要な設計判断。必要になった時点で作成する

## 開発フロー

- Work Package、Draft Pull Request、動作確認、中断と再開、およびRelease Pull Requestは`docs/planning/development_workflow.md`に従う。
- Work PackageのPull Requestは`develop`を対象とし、GitHub上のCodexレビューを要求しない。
- `develop`からデフォルトブランチへのRelease Pull Requestは、マージ前に`@codex review`を一度実行する。
- Codexレビューの指摘は一括して修正し、修正ごとに再レビューを要求しない。

## Code Review Rules

- IssueのAcceptance Criteriaと`docs/specs/current/`に反する、利用者へ影響する正しさの問題だけを指摘する。
- 決定論、データ所有権、処理順、未実装仕様の`current`混入を重点的に確認する。
- Formatter、Lint、型チェックなどCIで決定的に検査できる事項や、将来仕様の未実装を指摘しない。

## 判断の優先順位

1. 正しさ
2. 決定論の維持
3. 保守性
4. 拡張性
5. 可読性
6. パフォーマンス

性能改善は測定結果に基づいて行い、性能だけを理由に設計を複雑化しない。
