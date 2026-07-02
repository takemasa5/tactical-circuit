# 開発基盤

## 目的

本書はPhase 0で構築する開発環境、品質検査、CIの共通仕様を定義する。

---

# プロジェクト

- npmパッケージ名は`tactical-circuit`とする
- アプリケーション表示名は`Tactical Circuit`とする
- Backendを持たないSingle Page Applicationとして開始する

---

# 実行環境

- Node.js 24 LTSを使用する
- Node.jsはmajor version 24に固定し、minorとpatchの更新を許容する
- パッケージ管理にはnpmを使用する
- `package-lock.json`を保存し、CIでは`npm ci`を使用する

---

# Frontendとビルド

- TypeScriptとReactを使用する
- 開発サーバーとProduction buildにはViteを使用する
- 対応ブラウザはViteの標準Production targetとする
- Phase 0ではUI ComponentライブラリとLegacy browser向けPluginを追加しない

---

# TypeScript

TypeScriptは`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`を有効にする。

型チェックではファイルを出力せず、ViteがProduction buildを担当する。

---

# 静的解析とFormatter

- 静的解析にはESLintを使用する
- TypeScript、React Hooks、React Refreshの規則を有効にする
- FormatterにはPrettierを使用する
- ESLintはコード品質、Prettierは書式を担当する

`docs/`配下のMarkdown仕様書はPrettierの整形および`format:check`の対象とする。

---

# テスト

- Test runnerにはVitestを使用する
- DOM環境にはjsdomを使用する
- React ComponentのテストにはReact Testing Libraryを使用する
- CIではwatch modeを使用しない
- Phase 0ではE2Eテストとcoverage thresholdを導入しない

---

# CI

GitHub Actionsはpush、Pull Request、手動実行で起動する。

CIでは次の順序で検証する。

1. `npm ci`
2. Formatter確認
3. ESLint
4. TypeScript型チェック
5. テスト
6. Production build

---

# Secret scan

GitHub Actionsでgitleaksを実行し、Git履歴に含まれる秘密情報を検査する。

- push、Pull Request、手動実行を対象とする
- Git履歴全体を取得して検査する
- 初期状態ではgitleaksの標準ルールを使用する
- 除外規則は誤検出を確認してから個別に追加する

---

# Phase 0完了条件

- 開発サーバーを起動できる
- ブラウザに`Tactical Circuit`と表示できる
- Production buildとpreview serverを実行できる
- Formatter、ESLint、型チェック、テストが成功する
- GitHub ActionsのCIとgitleaksが成功する
