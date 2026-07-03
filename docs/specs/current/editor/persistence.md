# Program保存・読込仕様

> Status: Draft

## 目的

本書はProgram Editorから行うProgramの保存、読込、Export、Importを定義する。

実際の永続化処理はSave Managerの責務とし、Editorは保存要求と読込結果を扱う。

---

# 共通保存形式

localStorageとファイルには、`saveProgram`が生成した共通JSON Envelopeを含むJSON文字列を保存する。

Node、Parameter Value、接続、Editor専用情報の保存順はProgram Codecのcanonicalize規則に従う。

Program ValidatorのErrorまたはWarningの有無にかかわらず、構造上保存可能なProgramは保存できる。

---

# 保存

標準の保存先はブラウザのlocalStorageとする。

保存対象は現在編集中のProgramである。Save ManagerはProgram IDによってProgramを識別し、同じProgram IDの保存データが存在する場合は上書きする。

保存はユーザーの保存操作によって実行する。編集操作ごとの自動保存は行わない。

保存成功時は、保存したProgramのcanonicalなJSONを未保存変更の比較基準とする。

保存失敗時はProgram、履歴、選択、クリップボード、未保存変更の比較基準を変更せず、エラーを表示する。

localStorageが利用できない場合と、容量不足などにより書き込めない場合を保存失敗として扱う。

---

# 読込

標準の読込元はブラウザのlocalStorageとする。

Save ManagerはlocalStorageに保存されているProgramをProgram IDによって識別できる形でEditorへ提示する。ユーザーが対象を選択した後、そのJSON文字列を`loadProgram`で読み込む。

読込時はJSON Envelope、バージョン、JSON構造、ID形式、数値範囲を検証する。

読込成功時は以下を行う。

1. 読み込んだProgramを現在の編集対象にする
2. UndoとRedoの履歴を空にする
3. Node選択と接続選択を解除する
4. Property Editorの一時入力状態を破棄する
5. 読み込んだProgramのcanonicalなJSONを未保存変更の比較基準にする

アプリケーション専用クリップボードは維持する。

localStorageからの取得または`loadProgram`が失敗した場合、現在のProgram、履歴、選択、クリップボード、未保存変更の比較基準を変更しない。

---

# Export

Exportは現在編集中のProgramをUTF-8のJSONファイルとして保存する操作とする。

ExportするJSONには共通保存形式を使用する。

ファイル名は次の形式とする。

```text
program-{Program IDから`program_`を除いた値}.json
```

Exportの成功または失敗によってProgram、履歴、選択、クリップボード、localStorageの保存内容、未保存変更の比較基準を変更しない。

---

# Import

Importはユーザーが選択した1つのUTF-8 JSONファイルからProgramを読み込む操作とする。

ファイル内容は`loadProgram`で検証する。Import成功時は読込成功時と同様に編集対象、履歴、選択、一時入力状態を更新する。

ImportしたProgramはlocalStorageへ自動保存しない。Import直後は未保存のProgramとして扱い、標準の保存操作が成功するまで未保存変更がある状態とする。

アプリケーション専用クリップボードは維持する。

ファイル読取または`loadProgram`が失敗した場合、現在のProgram、履歴、選択、クリップボード、未保存変更の比較基準を変更しない。

---

# エラー表示

UIには少なくとも以下を区別できるエラーメッセージを表示する。

- localStorageを利用できない
- localStorageへ書き込めない
- 保存済みProgramを取得できない
- Import対象ファイルを読み取れない
- JSONとして解析できない
- 対象データ種別がProgramではない
- 保存形式のバージョンに対応していない
- ProgramのJSON構造が不正

内部例外やスタックトレースをユーザー向けメッセージへ直接表示しない。

---

# 未保存変更と破棄確認

現在のProgramに未保存変更がある状態で新規作成、読込、Importを要求した場合、現在の編集内容を破棄する確認を表示する。

保存または読込により比較基準が存在する場合、比較基準のcanonicalなJSONと現在のProgramのcanonicalなJSONを比較して変更有無を判定する。

新規作成またはImportしたProgramは、localStorageへの保存が成功するまで未保存として扱う。

確認を取り消した場合は現在の状態を変更しない。
