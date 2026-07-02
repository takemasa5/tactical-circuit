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
- GitHub Issueは一つのPull Requestで実装する範囲と完了条件を定義する。
- 選択したIssueが`docs/specs/planned/`の一部をSource Specとして指定した場合、その範囲だけを当該Issueの入力仕様として扱う。
- Issue、`docs/specs/current/`、またはロール別指示が競合する場合は実装せず、POへ確認する。
- コードと`docs/specs/current/`を一致させる。動作変更では仕様を先に更新する。

## ドキュメント構成

- `docs/product/`: プロダクトの目的と共通用語
- `docs/specs/current/`: 実装済み仕様
- `docs/specs/planned/`: 将来仕様
- `docs/planning/`: マイルストーン、Issue雛形、申し送り、設計メモ
- `docs/decisions/`: POが承認した重要な設計判断。必要になった時点で作成する

## 判断の優先順位

1. 正しさ
2. 決定論の維持
3. 保守性
4. 拡張性
5. 可読性
6. パフォーマンス

性能改善は測定結果に基づいて行い、性能だけを理由に設計を複雑化しない。
