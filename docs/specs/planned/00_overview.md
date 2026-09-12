# 将来仕様

## 位置づけ

このディレクトリは、POと設計者が合意した未実装または実装途中の将来仕様を保持する。

将来仕様はそのままでは現在の実装やPull Requestのレビュー基準にならない。実装対象はGitHub Issueで選択し、IssueのSource SpecとAcceptance Criteriaによって範囲を限定する。

## 現在の内容

- Phase 1 Playable MVPの合意済み範囲と詳細設計項目
- システム全体の将来アーキテクチャ
- 完成形のゲームループ
- シミュレーター
- パーツシステム
- Program Editorの検索機能

## 実装への移行

1. 設計者がPOと仕様を確定する。
2. Phase設計完了時に、設計者が`develop`を確認し、存在しなければデフォルトブランチから作成する。
3. 設計者が利用者または上位モジュールから確認できる縦断的なWork Packageへ分割する。
4. Source Spec、Acceptance Scenario、Acceptance Criteria、実装チェックポイント、Out of Scope、依存関係を含むIssueを作成する。
5. 実装者がIssueの範囲だけを実装し、Draft Pull Requestで再開地点と確認結果を管理する。
6. 実装済みとなった仕様を`docs/specs/current/`へ移し、将来仕様側から削除する。

内部モデル、Schema、計算Utility、個別テストは、最初の利用箇所と同じWork Packageのチェックポイントとして扱う。独立した成果、PO判断、外部依存、またはリリース条件を持つ将来仕様は、別のWork Packageへ分ける。

今後のPhase構成は`docs/planning/milestones/mvp.md`、開発とレビューの進め方は`docs/planning/development_workflow.md`に従う。文書内に残る旧Phase番号の扱いもロードマップで定義する。
