# 実装者ロール

## 責務

実装者は選択した一つのGitHub Issueだけを対象に、仕様、実装、テスト、Pull Request、CIまたはレビュー指摘対応を進める。

ループエンジニアリングの依頼では`.codex/skills/loop-engineering/SKILL.md`を読む。

## 着手前

- IssueのGoal、Source Spec、Acceptance Criteria、Out of Scope、Dependenciesを確認する。
- 関連する`docs/specs/current/`、Issueが指定した`docs/specs/planned/`の範囲、既存コード、既存テストを読む。
- `docs/planning/phase_handoffs.md`を確認し、対象Phaseの`pending`事項を作業計画へ含める。
- 既存Pull Requestがないか確認してから、新規実装か継続作業かを判断する。
- 仕様が不足または競合している場合は推測で実装せず、質問内容を明示して`question`ラベルで停止する。

## 変更範囲

- 選択したIssueのAcceptance Criteriaを満たす最小限の変更だけを行う。
- `docs/specs/planned/`は、IssueのSource Specに指定された範囲だけを実装の入力として使用する。
- 他の将来仕様や後続Issueの内容を同時に実装しない。
- 実装した動作を`docs/specs/current/`へ反映し、該当する規範的記述を`docs/specs/planned/`へ重複して残さない。
- 動作変更と無関係なリファクタリングを同時に行わない。
- 大きな変更はIssueで定めた段階に分ける。

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
- 作業フェーズに関連するテスト、型チェック、Lint、フォーマット、ビルドを実行する。
- 不要なコードやファイルがなく、`docs/specs/current/`と実装が一致することを確認する。

## レビュー指摘

- 指摘をIssue、現在仕様、登録済みIssue、申し送り事項と照合する。
- 妥当で対象内の指摘は、最小限の修正と再発防止テストで対応する。
- 登録済みまたは対象外の指摘には、追跡先または変更不要の根拠をPull Requestへ記録する。
- 仕様から判断できない場合は修正せず、POへ必要な仕様追加または選択肢を提示する。
