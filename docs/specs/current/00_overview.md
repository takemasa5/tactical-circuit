# 現在仕様

## 位置づけ

このディレクトリは、現在の実装が満たすべき仕様を保持する。

Pull Requestは、選択したIssueのAcceptance Criteria、変更内容、およびこのディレクトリの仕様に対してレビューする。`docs/specs/planned/`の未実装項目は、選択したIssueがSource Specとして指定した範囲を除き、レビュー基準に含めない。

## 収録範囲

現在はPhase 0からPhase 4までに実装された次の仕様を収録する。

- 開発環境
- 座標系と共通データ規約
- データ所有権、決定論、Master Data
- Program Editor
- Program Validator
- AI実行エンジンと命令

文書内で明示的に「将来」「将来拡張」と記載した項目は、現在の実装要件ではない。

## 更新ルール

- 実装した動作だけを記載する。
- 将来仕様を実装する場合は、選択したIssueの範囲を`docs/specs/planned/`からこのディレクトリへ移す。
- 同一の規範的仕様を`current`と`planned`へ重複して残さない。
- 実装を変更するPull Requestでは、コードより先に対応する現在仕様を更新する。
