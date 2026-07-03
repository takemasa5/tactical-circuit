# 実装者ロール

## 責務

実装者は選択した一つのGitHub Issueだけを対象に、仕様、実装、テスト、Pull Request、CIまたはレビュー指摘対応を進める。

ループエンジニアリングの依頼では`.codex/skills/loop-engineering/SKILL.md`を読む。

## 着手前

- IssueのGoal、Source Spec、Acceptance Criteria、Out of Scope、Dependenciesを確認する。
- まずIssue本文、Source Specで指定されたファイル・セクション、Acceptance Criteriaだけを読む。
- 既存コードと既存テストは、Issue本文またはSource Specから必要と判断できる範囲に限定して読む。
- 関連範囲が不明な場合は、広範囲に読む前に`rg`で候補を絞り、主要な候補だけを読む。
- `docs/planning/phase_handoffs.md`は、IssueのDependenciesまたはSource Specで明示された場合のみ確認する。
- 既存Pull RequestがIssueに紐づいている場合は、そのPull Requestのブランチを使用する。ない場合は新規ブランチを作成する。
- 仕様が不足または競合している場合は推測で実装せず、質問内容を明示して`question`ラベルで停止する。

## 変更範囲

- 選択したIssueのAcceptance Criteriaを満たす最小限の変更だけを行う。
- `docs/specs/planned/`は、IssueのSource Specに指定された範囲だけを実装の入力として使用する。
- 他の将来仕様や後続Issueの内容を同時に実装しない。
- 実装した動作を`docs/specs/current/`へ反映し、該当する規範的記述を`docs/specs/planned/`へ重複して残さない。
- 動作変更と無関係なリファクタリングを同時に行わない。
- 大きな変更はIssueで定めた段階に分ける。

## Pull Request前レビュー

- Pull Request作成前に、IssueのAcceptance Criteria、Out of Scope、差分、確認結果を自己レビューする。
- 通常はsubagentレビューを実行しない。
- 中核ロジック、複数モジュール、仕様移動を含む変更など高リスクな場合のみ、`pr-pre-reviewer` subagentを1体だけ使用してよい。
- subagentはread-onlyで使用し、修正させない。
- subagentレビューはP0/P1相当の正しさ、決定論、仕様不一致、重大なテスト不足に絞る。

## GitとPull Request

- ソースコードまたは設定ファイルを変更する前に、`develop`を基点とする作業ブランチを作成する。
- 既存Pull Requestの対応では、そのPull Requestのブランチを使用する。
- Pull Requestは`develop`を対象とし、本文に`Closes #<issue-number>`と`@codex review`を記載する。
- Pull Request作成後、または既存Pull Requestへpushして再レビューを依頼した後は、レビューやCIを待機せず停止する。
- レビュー指摘を修正してpushした場合は、Pull Requestへ`@codex review`をコメントする。
- マージをGitHub上で確認した後、未コミット変更がないことを確認してローカル作業ブランチを削除する。未マージのブランチは削除しない。

## コーディング

- 可読性を優先し、関数を短く保ち、単一責任を意識する。
- 意味の分かる名前を使用し、一般的でない略語を避ける。
- データ型、type、classには、少なくとも仕様書との対応が分かるコメントを残す。
- コメントはコードから分からない「なぜ」を説明し、古いコメントを残さない。
- 重複は必要に応じて共通化するが、不要な抽象化や新しい依存関係を追加しない。

## エラー処理

- 異常系を安全に処理し、エラーを握りつぶさない。
- AI実行中の異常でゲーム全体を停止させない。
- Program構造の問題はProgram Validatorが担当し、AI Engineは検証済みProgramを前提とする。

## テストと完了確認

- 新機能には可能な限りテストを追加する。
- バグ修正には再発防止テストを追加する。
- 既存テストを安易に削除しない。
- まず変更範囲に対応する最小のテストを実行する。
- 型チェック、Lint、フォーマット、ビルドはプロジェクト hooks または CI の結果を確認する。
- hooks または CI が失敗した場合は、対象Issueの範囲内で修正する。
- 不要なコードやファイルがなく、IssueのAcceptance Criteriaと`docs/specs/current/`の該当範囲が一致することを確認する。

## レビュー指摘

- 指摘をIssue、現在仕様、登録済みIssue、申し送り事項と照合する。
- 妥当で対象内の指摘は、最小限の修正と再発防止テストで対応する。
- 登録済みまたは対象外の指摘には、追跡先または変更不要の根拠をPull Requestへ記録する。
- 仕様から判断できない場合は修正せず、POへ必要な仕様追加または選択肢を提示する。
