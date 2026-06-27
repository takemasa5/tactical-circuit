# Tactical Circuit

ロボットのAIを組み立て、決定論的な戦闘シミュレーションで競わせるブラウザゲームです。

## 必要環境

- Node.js 24 LTS
- npm

`.nvmrc`を利用する場合は、次のコマンドでNode.jsのバージョンを切り替えます。

```sh
nvm use
```

## セットアップ

```sh
npm install
npm run dev
```

## 開発コマンド

| コマンド               | 内容                                     |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | 開発サーバーを起動する                   |
| `npm run build`        | 型チェック後にProduction buildを作成する |
| `npm run preview`      | Production buildをローカルで配信する     |
| `npm run typecheck`    | TypeScriptの型チェックを実行する         |
| `npm run lint`         | ESLintを実行する                         |
| `npm run format`       | Prettierで対象ファイルを整形する         |
| `npm run format:check` | Prettierの適用状態を確認する             |
| `npm run test`         | テストを1回実行する                      |
| `npm run test:watch`   | テストをwatch modeで実行する             |

## Secret scan

GitHub Actionsではgitleaksを自動実行します。ローカルで実行する場合は、gitleaksをインストールしてリポジトリ履歴を検査します。

```sh
brew install gitleaks
gitleaks git --redact
```
