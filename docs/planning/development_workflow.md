# 開発ワークフロー

## 目的

本書は、仕様書駆動開発を維持しながら、GitHub Issue、Pull Request、Codexレビュー、動作確認、および中断後の再開を効率よく進める方法を定義する。

## 作業単位

実装の管理単位はWork Packageとする。

Work Packageは、利用者または上位モジュールから一つの成果として確認できる縦断的な機能であり、一つのIssueと一つのPull Requestで完了する。内部モデル、Schema、計算Utility、個別テストだけを、最初の利用箇所から分離して独立したWork Packageにしない。

実装を安全に進めるための小さい単位はIssueやPull Requestではなく、Work Package内のチェックポイントとcommitで表現する。チェックポイントは独立したPull Requestを要求しない。

Work Packageを分割するのは、次のいずれかに該当する場合とする。

- それぞれを利用者または上位モジュールから独立して動作確認できる
- POの判断、外部依存、または異なるリリース条件によって独立して停止し得る
- 一つのPull Requestでは変更理由、Acceptance Scenario、または失敗時の切り分けが不明確になる

## ブランチとPull Request

- Work Packageごとに`develop`を基点とする作業ブランチを作る。
- 実装開始時に`develop`向けDraft Pull Requestを作り、進捗と再開地点をPull Request本文へ記録する。
- Work PackageのPull RequestではGitHub上のCodexレビューを要求しない。
- Formatter、Lint、型チェック、テスト、Production buildはCIで検査する。
- Codex動作確認と人の動作確認が完了してから、Work Packageを`develop`へマージする。
- リリース対象のWork Packageが揃ったら、`develop`からデフォルトブランチへのRelease Pull Requestを作る。現在のデフォルトブランチは`master`である。
- デフォルトブランチへマージする前に、Release Pull Requestで`@codex review`を明示的に一度実行する。
- Codexの自動レビューは使用しない。Release CandidateのCIと動作確認が完了する前に、Pull Request本文またはコメントへ`@codex review`を書かない。

## レビュー指摘への対応

- 最新Release Candidateへの全指摘を確認してから、対象内の指摘を一括して修正する。
- 指摘ごとに修正と再レビューを繰り返さない。
- 指摘された箇所だけを変更する局所的な修正は、再発防止テスト、CI、および人の確認で完了できる。
- 修正が新しいロジック、外部仕様、または複数モジュールへ広がった場合は、修正をすべてまとめた後に対象を絞って`@codex review`を再度実行する。
- 未解決のブロッキング指摘がある状態でデフォルトブランチへマージしない。

## Codex動作確認

CodexはWork PackageのPull Requestを人へ渡す前に、IssueのAcceptance Scenarioを実行する。

- UIを含む場合は開発サーバーを起動し、対応ブラウザで実際に操作する。
- UIを含まない場合は、公開APIまたは統合テストから利用時と同じシナリオを実行する。
- 表示、操作結果、状態遷移、エラーメッセージ、およびブラウザのコンソールエラーを確認する。
- 仕様とWork Packageの範囲内で発見した問題は自律的に修正し、同じScenarioを最初から再実行する。
- 再発防止可能な問題には、自動テストを追加する。
- 仕様が複数解釈できる場合は修正せず、POへ選択肢と影響を提示する。
- Work Package外の問題は同じPull Requestへ混在させず、後続Work PackageまたはPhase申し送りとして記録する。

## 人の動作確認

- 人とCodexはIssueに記載された同じAcceptance Scenarioを使用する。
- 人の確認結果はDraft Pull Requestへ記録する。
- 複数の指摘がある場合は、可能な限り一度にまとめてCodexへ渡す。
- Codexは対象内の指摘をまとめて修正し、自動検査とCodex動作確認を再実行する。
- 人の動作確認が必要なWork Packageは、確認完了が記録されるまで`develop`へマージしない。

## 中断と再開

Draft Pull Request本文に次の`Resume State`を保持する。

```md
## Resume State

- Branch:
- Latest checkpoint commit:
- Completed checkpoints:
- Next checkpoint:
- Automated checks:
- Codex operation check:
- Human operation check:
- Known issues:
- PO confirmation required:
```

各チェックポイントの完了時に、意味のある最小単位でcommitし、作業ブランチへpushして`Resume State`を更新する。週間上限や外部要因で中断しても、完了済みcommitを作り直さない。

再開時は次の順序で確認する。

1. 既存のDraft Pull Requestと`Resume State`
2. 作業ブランチと最新checkpoint commit
3. `git status`と未commit差分
4. 未完了のAcceptance Criteriaと次のチェックポイント
5. 前回の検査結果と既知の問題

`docs/planning/phase_handoffs.md`はPhase間の仕様申し送り専用とし、一時的な作業状況の記録には使用しない。

## Phaseの完了

Phaseは、ロードマップに定義された利用者向け成果、必要なWork Package、Codex動作確認、人の動作確認、およびRelease Pull Requestの検査がすべて完了し、デフォルトブランチへマージされた時点で完了する。
