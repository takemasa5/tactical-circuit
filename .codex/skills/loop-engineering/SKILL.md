---
name: loop-engineering
description: "Advance exactly one GitHub Issue by one lifecycle phase per invocation. Resume from an existing pull request first, never poll or sleep for CI/review, and stop after implementation, CI repair, review response, or merge."
---

# Loop Engineering

## Goal

一つのGitHub Issueを、起動ごとにライフサイクルの一段階だけ進める。

このSkillは同一起動内でPull Request作成、レビュー待機、指摘対応、マージまでを連続実行しない。外部状態の変化は次回起動時に確認する。

## Repository Role

- `.codex/roles/implementer.md`に従う。
- リポジトリの`AGENTS.md`とロール別指示はこのSkillより優先する。

## Preconditions

- `develop`ブランチが存在しなければ、代替ブランチを使用せず停止する。
- ユーザーがIssueを指定した場合は、そのIssueを使用する。
- Issueが未指定の場合は、依存関係が完了しているopenなIssueを一つ選択する。
- 一度選択したIssueを、その起動中に変更しない。
- IssueのGoal、Source Spec、Acceptance Criteria、Out of Scope、Dependenciesを確認する。

## Start by Resuming State

毎回、実装を始める前に次の順序で状態を確認する。

1. 選択したIssueに対応する既存Pull Requestを探す。
2. Pull Requestが存在する場合は、そのbase branch、head branch、最新head commit、checks、review、thread-awareなレビューコメント、ラベルを確認する。
3. Pull Requestが存在しない場合は、既存のローカルまたはリモート作業ブランチと未完了変更を確認する。
4. `question`ラベルまたは未解決の仕様質問がある場合は、変更せずに質問内容を報告して停止する。

既存Pull Requestがある場合、新規Pull Requestを作成せず、その状態から再開する。

## Select Exactly One Phase

状態確認後、次の優先順位で今回実行するフェーズを一つだけ選ぶ。

1. Pull Requestがない: Implementation Phase
2. 最新head commitのrequired checkが失敗: CI Repair Phase
3. 未分類または対応可能なレビュー指摘がある: Review Response Phase
4. checkまたはreviewがpending: Pending State
5. merge条件をすべて満たす: Merge Phase
6. 上記に分類できない: Blocked State

一つのフェーズを完了したら、次のフェーズへ進まず停止する。

## Implementation Phase

1. 関連する現在仕様、Issueが指定した将来仕様、既存コード、テストを読む。
2. Acceptance Criteriaを満たす最小限の変更を実装する。
3. 実装した動作を`docs/specs/current/`へ反映し、対応する規範的記述を`docs/specs/planned/`から除く。
4. 必要なテストを追加し、関連するテスト、型チェック、Lint、フォーマット、ビルドを実行する。
5. `develop`を対象とするPull Requestを作成する。
6. Pull Request本文に`Closes #<issue-number>`と`@codex review`を記載する。
7. Pull Requestの作成成功を確認して停止する。

Pull Request作成後にcheckやreviewを待たず、同一起動で状態を再確認しない。

## CI Repair Phase

1. 最新head commitで失敗したcheckのログを確認し、原因を特定する。
2. Issueの範囲内で必要な最小限の修正を行う。
3. 関連するローカル検査を実行する。
4. 既存Pull Requestのブランチへpushする。
5. コードまたは仕様を変更した場合は、Pull Requestへ`@codex review`をコメントする。
6. pushまたは再実行要求の成功を確認して停止する。

更新後のcheckやreviewを待たず、同一起動で状態を再確認しない。

## Review Response Phase

1. 最新head commitに対する全レビュー指摘を、Issue、現在仕様、既存Issue、申し送り事項と照合する。
2. 各指摘を、修正、追跡済み、変更不要、仕様確認のいずれかに分類する。
3. 対象内の妥当な指摘を最小限の変更と再発防止テストで修正する。
4. 変更しない指摘には、追跡先または具体的な根拠を返信する。
5. 仕様確認が必要な場合は質問を説明し、`question`ラベルを付けて停止する。
6. 関連するローカル検査を実行し、変更を既存Pull Requestのブランチへpushする。
7. Pull Requestへ`@codex review`をコメントして停止する。

再レビューや更新後のcheckを待たず、同一起動で状態を再確認しない。

## Pending State

- checkまたはreviewがpendingの場合、sleep、polling、再試行ループを行わない。
- 現在pendingの対象と最新head commitを報告して停止する。
- コメントがまだないことをreview完了とはみなさない。

## Merge Phase

次をすべて満たす場合だけ実行する。

- 最新head commitのrequired checkがすべて成功している。
- 最新head commitへのreviewが完了し、対応可能または未分類の指摘がない。
- 全指摘が解決済み、根拠付きの変更不要、追跡済みのいずれかである。
- `question`ラベルがない。
- Pull RequestがIssueのAcceptance Criteriaを満たしている。

実行手順:

1. Pull Requestを`develop`へマージする。
2. Pull Requestがmergedかつclosedであることを確認する。
3. Issueがcloseされたことを確認する。自動でcloseされていない場合は、Acceptance Criteriaを再確認してからcloseする。
4. リポジトリ指示に従ってマージ後のローカルブランチを整理する。
5. 完了を報告して停止する。

## Blocked State

次の場合は、進行を推測で補わず、理由と必要な判断を報告して停止する。

- 依存Issueが未完了
- `develop`が存在しない
- 権限または外部障害により選択したフェーズを完了できない
- Issue、現在仕様、Source Specが不足または競合する
- POの仕様決定が必要

## Safety

- 選択したIssue以外へ切り替えない。
- IssueのOut of Scopeや無関係な将来仕様を実装しない。
- 無関係なファイルを変更しない。
- ユーザーの変更を明示的な依頼なく取り消さない。
- branch protection、required check、reviewを迂回しない。
- 待機のための`sleep`、定期polling、長時間実行を行わない。

## Completion Report

毎回、次を報告する。

- 選択したIssue
- 今回確認したPull Requestと最新head commit
- 今回実行したフェーズ、またはPending／Blockedの状態
- 作成または更新したPull RequestのURL
- 実行したテストと検査
- 現在のcheckとreviewの状態
- 次回起動時に確認する状態
