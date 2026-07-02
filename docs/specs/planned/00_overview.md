# 将来仕様

## 位置づけ

このディレクトリは、POと設計者が合意した未実装または実装途中の将来仕様を保持する。

将来仕様はそのままでは現在の実装やPull Requestのレビュー基準にならない。実装対象はGitHub Issueで選択し、IssueのSource SpecとAcceptance Criteriaによって範囲を限定する。

## 現在の内容

- システム全体の将来アーキテクチャ
- 完成形のゲームループ
- シミュレーター
- パーツシステム
- Program Editorの検索機能

## 実装への移行

1. 設計者がPOと仕様を確定する。
2. 設計者がSource Spec、Acceptance Criteria、Out of Scope、依存関係を含むIssueを作成する。
3. 実装者がIssueの範囲だけを実装する。
4. 実装済みとなった仕様を`docs/specs/current/`へ移し、将来仕様側から削除する。

将来仕様の別項目や後続Issueの範囲は、同じPull Requestへ含めない。
