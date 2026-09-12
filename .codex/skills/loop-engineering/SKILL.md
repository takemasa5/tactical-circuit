---
name: loop-engineering
description: "Resume and advance one GitHub Work Package through durable checkpoints. Reuse its draft pull request, persist resume state, run acceptance scenarios, and stop only for external wait, PO or human input, release review, or completion."
---

# Loop Engineering

## Goal

一つのGitHub Work Packageを既存状態から再開し、外部の確認待ちまたは判断待ちになるまで、再開可能なチェックポイントを積み重ねて進める。

チェックポイントを完了しただけでは停止せず、同じWork Packageの次のチェックポイントを安全に進められる場合は継続する。

## Repository Rules

- `AGENTS.md`、`.codex/roles/implementer.md`、`docs/planning/development_workflow.md`に従う。
- ユーザーがWork Packageを指定した場合はそれを使用する。未指定の場合は、依存関係と仕様が確定したopenなWork Packageを一つ選ぶ。
- 一度選択したWork Packageを実行中に変更しない。
- Work Package外の問題を同じPull Requestへ混在させない。

## Resume First

実装前に次を確認する。

1. Work Packageに紐づく既存Pull Requestと`Resume State`
2. base branch、head branch、最新head commit、checks、review、未解決thread、およびラベル
3. ローカルとリモートの作業ブランチ、`git status`、未commit差分
4. 完了済みAcceptance Criteria、次のチェックポイント、前回の検査結果
5. `question`ラベル、PO確認事項、人の動作確認結果

既存Pull Requestまたは作業ブランチがある場合は新しく作らず、その状態から再開する。完了済みの変更や検査を理由なく作り直さない。

## Preconditions

- Goal、User-visible Outcome、Source Spec、Phase Handoff、Acceptance Scenario、Acceptance Criteria、Implementation Checkpoints、Out of Scope、Dependenciesを確認する。
- 仕様が不足または競合する場合は実装せず、選択肢と影響をPOへ提示する。
- 依存Work Packageが未完了の場合は、その依存が必要な理由を報告して停止する。
- `develop`がGitHubリポジトリに存在しない場合は、設計者による作成を待って停止する。

## Work Package Execution

Pull Requestがない場合は、`develop`を基点とする作業ブランチとDraft Pull Requestを作る。本文に対象Issue、Acceptance Scenario、チェックポイント、および`Resume State`を記載し、`@codex review`は記載しない。

次の未完了チェックポイントを実装し、関連する最小テストを実行する。チェックポイント完了時はcommit、push、および`Resume State`更新を行う。続けて安全に進められるチェックポイントがあれば、同じ実行中に継続する。

Work Packageの実装が揃ったら、次を実行する。

1. Acceptance CriteriaとOut of Scopeに対する自己確認
2. Formatter、Lint、型チェック、テスト、Production build
3. UIを含む場合は対応ブラウザ、含まない場合は公開APIまたは統合テストによるCodex動作確認
4. 対象内で発見した問題の修正と同じAcceptance Scenarioの再実行
5. Draft Pull Requestへの検査結果と最新`Resume State`の記録

人の動作確認が必要な場合は、実行可能なScenarioと確認済みのCodex結果を提示して停止する。人の確認結果が記録され、required checkが成功し、未解決の対象内問題がなければWork Package Pull Requestを`develop`へマージできる。

## CI and Feedback

- required checkが失敗している場合は、ログから原因を特定し、対象内の失敗をまとめて修正してpushする。
- checkがpendingの場合はpollやsleepを行わず、最新head commitとpending checkを`Resume State`へ記録して停止する。
- 人の指摘は全件を確認して分類し、対象内の指摘を一括して修正する。指摘ごとに個別のレビューサイクルを作らない。
- 仕様確認が必要な指摘は推測で修正せず、`question`ラベルと確認事項を記録して停止する。

## Release Pull Request

デフォルトブランチ向けのRelease作業が明示的に選択された場合だけ、次を行う。

1. 対象PhaseのWork Package、Codex動作確認、人の動作確認、および`develop`のrequired checkが完了していることを確認する。
2. `develop`からデフォルトブランチへのRelease Pull Requestを作る。
3. Release Candidateが確定した後、コメントで`@codex review`を一度だけ依頼して停止する。
4. Codex指摘がある場合は全件を分類し、対象内の指摘を一括修正する。
5. 修正が新しいロジック、外部仕様、または複数モジュールへ広がった場合だけ、対象を絞って再レビューを依頼する。
6. required checkが成功し、未解決のブロッキング指摘がなく、POまたは人の承認条件を満たした後にデフォルトブランチへマージする。

GitHub上のCodex自動レビューは使用しない。Work Package Pull Request、通常のpush、CI修正、および個々の指摘修正では`@codex review`を依頼しない。

## Stop Conditions

次の場合に停止し、`Resume State`と必要な次の入力を記録する。

- POによる仕様決定が必要
- 人の動作確認または承認が必要
- checkまたはCodex Release Reviewがpending
- 権限、外部障害、または未完了依存により進められない
- Work PackageまたはReleaseが完了した

待機のためのsleep、定期polling、再試行ループを行わない。

## Completion Report

- 選択したWork PackageまたはRelease
- Pull Requestと最新head commit
- 完了したチェックポイントとAcceptance Scenario
- 実行した自動検査、Codex動作確認、人の動作確認
- 現在のcheckとreview状態
- 最新の`Resume State`と次に行うこと
