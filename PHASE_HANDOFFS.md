# Phase申し送り事項

## 目的

本書は、現在のPhaseでは前提機能が存在しないため対応できず、将来Phaseで確認または実装する事項を記録する。

各事項は解決時にも削除せず、状態と対応根拠を更新する。

## 状態

- `pending`: 対象Phaseでの確認または実装が必要
- `resolved`: 実装、仕様、テストなどの対応根拠を記録済み

---

## PH-001 Instruction implementationIdの許可リスト

- 状態: `pending`
- 発生Phase: Phase 3 Program Validator
- 対象Phase: Phase 4 AI実行エンジン
- 関連: PR #5 review thread `PRRT_kwDOTGu1Vs6NKGl5`

### 背景

Phase 3時点ではInstruction Dispatcherと命令実装Registryが存在しない。Program EditorのData Repository生成時は、読込済みInstruction Definitionから`implementationId`を収集しているため、実装コードに存在するIDかどうかを検証できない。

### 対応条件

Phase 4でInstruction Dispatcherと命令実装Registryを追加する際、Registryが公開する固定の対応ID集合をData Repositoryへ渡す。Master Data自身から許可ID集合を生成してはならない。

未知の`implementationId`を持つInstruction Definitionが`unknown_implementation_id`で拒否される再発防止テストを追加する。
