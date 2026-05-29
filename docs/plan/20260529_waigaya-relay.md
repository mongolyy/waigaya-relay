# waigaya-relay 実装計画

作成日: 2026-05-29

> 更新メモ: 当初は Express + 静的 HTML 構成で検討していたが、Vercel へのデプロイを
> 前提とするため **Next.js（App Router）** 構成に変更した。

## 0. コンセプト

Web のチャット画面に投稿すると、その内容を **Slack** と **Microsoft Teams** に中継し、
それぞれのチャンネルで新しいスレッドの起点となるメッセージを投稿するアプリ。

単なる問い合わせ転送ツールではなく、「ワイワイガヤガヤと議論が始まる場を作る」ことが目的。
まずは Vercel にデプロイできる最小構成のプロトタイプを作る。

## 1. 実装方針

- TypeScript で実装し、型をできるだけ活用する。
- **Next.js (App Router)** で フロントエンドと API を 1 つのアプリに統合する。
  - フロントエンド: チャット画面（`app/page.tsx`、クライアントコンポーネント）
  - バックエンド: メッセージ送信 API（`app/api/messages/route.ts`、Route Handler）
- Vercel にそのままデプロイできる構成にする（追加のサーバー不要、API は
  サーバーレス関数として動く）。
- Slack / Teams への投稿は **Incoming Webhook** を利用する。
  - Webhook URL は環境変数で渡し、コードには絶対に書かない。
- Slack と Teams のどちらか一方が失敗しても、もう一方の結果は返す
  （部分的な成功・失敗を画面に表示できるようにする）。
- エラーは API レスポンスで返し、フロントエンドで分かりやすく表示する。

## 2. ディレクトリ構成

```
waigaya-relay/
├── docs/
│   └── plan/
│       └── 20260529_waigaya-relay.md   # 本計画
├── app/                                 # Next.js App Router
│   ├── layout.tsx                       # ルートレイアウト
│   ├── page.tsx                         # チャット画面（クライアントコンポーネント）
│   ├── globals.css                      # スタイル
│   └── api/
│       └── messages/
│           └── route.ts                 # メッセージ送信 API (POST)
├── lib/                                 # フレームワーク非依存のロジック
│   ├── config.ts                        # 環境変数の読み込み
│   ├── types.ts                         # 共有の型定義
│   └── relay/
│       ├── slack.ts                     # Slack Webhook 投稿
│       └── teams.ts                     # Teams Webhook 投稿
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## 3. 技術スタック

| 項目             | 採用技術                          | 理由                                       |
| ---------------- | --------------------------------- | ------------------------------------------ |
| 言語             | TypeScript                        | 要件。型安全に実装する。                   |
| フレームワーク   | Next.js 14 (App Router)           | フロント + API を統合し Vercel に最適。    |
| UI               | React 18                          | Next.js 標準。状態管理は `useState` のみ。 |
| ホスティング     | Vercel                            | 要件。Next.js をゼロ設定でデプロイ可能。   |
| HTTP クライアント | global `fetch`                   | Node.js ランタイム標準。追加依存なし。     |
| 設定             | 環境変数 (`.env.local` / Vercel)  | Webhook URL をシークレットとして渡す。     |

## 4. Slack / Teams 連携方法

### Slack

- Slack の **Incoming Webhook** を作成し、URL を `SLACK_WEBHOOK_URL` に設定する。
- `POST` で `{ "text": "..." }` を送信するとチャンネルにメッセージが投稿される。
- Slack では任意のメッセージに対してスレッド返信ができるため、
  投稿されたメッセージがそのまま「スレッドの起点」になる。

### Microsoft Teams

- Teams チャンネルの **Incoming Webhook** を作成し、URL を `TEAMS_WEBHOOK_URL` に設定する。
- `POST` で MessageCard 形式の JSON
  （`{ "@type": "MessageCard", "@context": "...", "text": "..." }`）を送信する。
- Teams ではチャンネルに投稿されたメッセージに対して返信でスレッドが作られる。

> 補足: いずれも Webhook はチャンネルに「親メッセージ」を投稿するだけで、
> スレッド自体は人間がそのメッセージに返信することで自然に始まる。

## 5. 環境変数の設計

| 変数名              | 必須 | 説明                                        |
| ------------------- | ---- | ------------------------------------------- |
| `SLACK_WEBHOOK_URL` | 任意 | Slack Incoming Webhook の URL。未設定なら Slack 中継をスキップ。 |
| `TEAMS_WEBHOOK_URL` | 任意 | Teams Incoming Webhook の URL。未設定なら Teams 中継をスキップ。 |

- 少なくともどちらか一方の Webhook URL が設定されていることを想定する
  （両方未設定の場合、API は全中継スキップとして失敗を返す）。
- ローカルは `.env.local`、Vercel はダッシュボードの Environment Variables に登録する。
- `.env.example` にプレースホルダを置き、実値は `.env.local`（gitignore 対象）に書く。

## 6. セキュリティ上の注意点

- Webhook URL は **シークレット**。コードに直接書かず、環境変数経由で渡す。
- `.env*` は `.gitignore` で除外し、リポジトリにコミットしない。
- Webhook URL は実質的なアクセス権そのものなので、ログに出力しない。
- 中継処理はサーバー側（Route Handler）でのみ実行し、Webhook URL を
  ブラウザに渡さない（フロントは `/api/messages` だけを叩く）。
- 入力メッセージは長さ制限を設け、空メッセージは弾く（軽いバリデーション）。
- プロトタイプは認証なし。公開する場合は認証・レート制限を別途導入する
  （Vercel は HTTPS が標準で有効）。

## 7. 最小プロトタイプの実装範囲

- [x] Next.js のディレクトリ構成の作成
- [x] Web チャット画面（入力欄 + 送信ボタン + 結果表示）
- [x] メッセージ送信 API (`POST /api/messages`)
- [x] Slack Webhook 投稿処理
- [x] Teams Webhook 投稿処理
- [x] 部分的成功・失敗の表示（Slack/Teams 個別の結果）
- [x] `.env.example` / `.gitignore`
- [x] README（概要・セットアップ・環境変数・起動・動作確認・セキュリティ・Vercel デプロイ）

## 8. 将来的な拡張案

- **Teams の連携方式の移行**: 現在使用している Office 365 Connectors
  （`MessageCard` 形式の Incoming Webhook）は Microsoft が廃止を進めており、
  いずれ新規作成不可・既存も停止する見込み。本運用に向けては
  **Power Automate の Workflows（Adaptive Cards）** への移行を検討する。
- **投稿先チャンネルの選択**: 複数の Webhook をチャンネルとして登録し、
  画面のセレクタから送信先を選べるようにする。
- 投稿者名・アイコンの指定。
- Slack / Teams 側スレッドの URL を取得して画面に返す（Web API / Bot 化が必要）。
- 投稿履歴の保存（Vercel KV / Postgres など）。
- 認証・認可、レート制限、監査ログ。
- Bot トークンを使った双方向同期（スレッド返信を画面に取り込む）。
