# waigaya-relay 📣

> [English version here](./README.md)

Web のチャット画面に投稿すると、その内容を **Slack** と **Microsoft Teams** に中継し、
それぞれのチャンネルに「スレッドの起点となるメッセージ」を投稿するアプリです。

単なる問い合わせ転送ツールではなく、**「ワイワイガヤガヤと議論が始まる場を作る」** ことを
目的にしています。投稿されたメッセージにチームのメンバーが返信していくことで、
Slack / Teams 上でそのまま議論（スレッド）が始まります。

Next.js（App Router）で実装しており、**Vercel にそのままデプロイ**できます。

---

## 主な機能

- Web のチャット画面からメッセージを送信できる
- 送信すると **Slack** と **Microsoft Teams** の両方に投稿される
- **チャットログのセッションごとに専用の Slack スレッドへ投稿** — 同一セッションのメッセージは同じスレッドに返信され、**Start new thread** で新しいスレッドを開始できる
- Slack / Teams のどちらか一方が失敗しても、もう一方の結果は画面に表示される
  （成功 / 失敗 / スキップを個別に確認できる）

---

## 技術スタック

- [Next.js 16](https://nextjs.org/)（App Router）/ React 19
- TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)（スタイリング）
- Slack Web API（`chat.postMessage`）/ Microsoft Teams の Incoming Webhook
- セッションとスレッドの対応表に Upstash Redis（任意）
- ホスティング: [Vercel](https://vercel.com/)

---

## スタイリング

UI には **Tailwind CSS v4**（`@tailwindcss/postcss` プラグイン）を使用しています。すべてのスタイルは JSX 内のユーティリティクラスとして直接適用しており、カスタム CSS クラスは定義していません。

**カラーパレット:**

| 役割 | Tailwind トークン | Hex |
| ---- | ----------------- | --- |
| ページ背景 | `slate-900` | `#0f172a` |
| カード / パネル | `slate-800` | `#1e293b` |
| ボーダー | `slate-700` | `#334155` |
| 本文テキスト | `slate-200` | `#e2e8f0` |
| ミュートテキスト | `slate-400` | `#94a3b8` |
| アクセント（リンク・ボタン） | `indigo-500` | `#6366f1` |
| 成功 | `green-500` | `#22c55e` |
| エラー | `red-500` | `#ef4444` |

`app/globals.css` は最小限の内容のみ保持しています — `body` のベーススタイル（背景色・文字色・フォント・行間）と `dialog::backdrop` のルールのみです。技術的には Tailwind のユーティリティクラスでも表現できますが、グローバルなベーススタイルを 1 つの CSS ファイルにまとめた方がシンプルで、複数のコンポーネントファイルに分散させずに済みます。

---

## 使い方

### 1. チャット画面を開く

アプリの URL（ローカルなら `http://localhost:3000`、デプロイ後は Vercel の URL）にアクセスします。メッセージ入力画面が表示されます。

![初期画面 — メッセージ入力欄が空の状態](./docs/screenshots/01_initial.png)

### 2. メッセージを入力する

投稿したいメッセージを入力します。改行を使って構造的に書くことができ、入力した内容がそのまま各プラットフォームに中継されます。

![メッセージを入力した状態](./docs/screenshots/02_with_message.png)

### 3. 「Send」ボタンを押して結果を確認する

**Send** ボタンをクリックすると、Slack と Microsoft Teams それぞれの中継結果がすぐに表示されます。Webhook URL が未設定の中継先は **skipped**（スキップ）と表示されます。

![送信後 — 各中継先の成功ステータス](./docs/screenshots/03_result_success.png)

| ステータス | 意味 |
| ---------- | ---- |
| `success`  | メッセージの配信に成功した |
| `failed`   | 配信に失敗した（詳細メッセージを確認してください） |
| `skipped`  | Webhook URL が未設定のため中継をスキップした |

### 4. Slack / Teams で返信してスレッドを始める

メッセージが Slack チャンネルや Teams チャンネルに届いたら、チームメンバーがそのメッセージにスレッドで返信できます。中継したメッセージが議論のきっかけとなり、ワイワイガヤガヤが始まります。

---

## セットアップ方法

### 1. 必要なもの

- Node.js 20 以上
- Slack の Bot トークン + チャンネル ID（任意）
- Microsoft Teams の Incoming Webhook URL（任意）
- Upstash Redis の認証情報（任意・本番のスレッド維持には推奨）

> Slack / Teams のどちらか一方だけでも動作します。未設定の中継先は自動的にスキップされます。

### 2. 依存パッケージのインストール

```bash
npm ci
```

### 3. 環境変数の設定

`.env.example` を `.env.local` にコピーして、認証情報を設定します。

```bash
cp .env.example .env.local
```

`.env.local` を編集します。

```dotenv
SLACK_BOT_TOKEN=xoxb-xxxx
SLACK_CHANNEL_ID=C0123456789
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/xxxx/IncomingWebhook/xxxx/xxxx

# 任意: セッション → スレッドの対応表（未設定時はインメモリにフォールバック）
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxx
```

> ⚠️ `.env.local` は `.gitignore` 済みです。**トークンや Webhook URL は絶対にコミットしないでください。**

#### 認証情報の取得方法

- **Slack**: Slack アプリを作成して `chat:write` スコープを付与し、ワークスペースにインストールして
  Bot を対象チャンネルに招待します。**Bot User OAuth Token**（`xoxb-…`）を `SLACK_BOT_TOKEN` に、
  チャンネル ID を `SLACK_CHANNEL_ID` に設定します。Incoming Webhook ではスレッド返信ができないため、
  Web API（`chat.postMessage`）を使用します。
- **Microsoft Teams**: 投稿したいチャンネルの「コネクタ」から
  **Incoming Webhook** を追加して URL を発行します。
- **Upstash（任意）**: [Upstash](https://upstash.com/) で Redis データベースを作成し、REST URL と
  トークンをコピーします。未設定の場合、セッション → スレッドの対応表はインメモリに保持され、
  サーバーレス環境ではインスタンスをまたいで失われる可能性があります。

---

## 環境変数の説明

| 変数名                     | 必須 | 説明                                                                       |
| -------------------------- | ---- | -------------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`          | 任意 | `chat:write` 権限を持つ Slack Bot トークン（`xoxb-…`）。チャンネル ID と併用。 |
| `SLACK_CHANNEL_ID`         | 任意 | 投稿先の Slack チャンネル ID。いずれかが未設定なら Slack への中継をスキップ。 |
| `TEAMS_WEBHOOK_URL`        | 任意 | Teams Incoming Webhook の URL。未設定なら Teams への中継をスキップ。        |
| `UPSTASH_REDIS_REST_URL`   | 任意 | セッション → スレッド対応表用の Upstash Redis REST URL。未設定時はインメモリ。 |
| `UPSTASH_REDIS_REST_TOKEN` | 任意 | Upstash Redis の REST トークン。URL と併せて設定。                          |

- 少なくとも Slack か Teams のどちらかを設定してください（両方未設定だと、すべてスキップとなり失敗します）。
- ローカルでは `.env.local`、Vercel では **Project → Settings → Environment Variables** に登録します。

---

## 起動方法（ローカル）

開発サーバーを起動します。

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

本番ビルドを試す場合:

```bash
npm run build
npm start
```

その他のコマンド:

```bash
npm run typecheck   # 型チェックのみ
```

---

## 動作確認方法

1. `npm run dev` でサーバーを起動する。
2. ブラウザで [http://localhost:3000](http://localhost:3000) を開く。
3. 入力欄にメッセージを書いて「送信する」を押す。
4. 画面下部に中継結果（Slack / Teams それぞれ 成功 / 失敗 / スキップ）が表示される。
5. Slack / Teams のチャンネルにメッセージが届いていることを確認する。
6. 届いたメッセージに返信して、スレッドで議論を始める。

API を直接叩いて確認することもできます。

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"message":"はじめての投稿です！"}'
```

レスポンス例:

```json
{
  "ok": true,
  "results": [
    { "target": "slack", "ok": true, "skipped": false },
    { "target": "teams", "ok": true, "skipped": false }
  ]
}
```

---

## Vercel へのデプロイ

1. このリポジトリを GitHub に push する。
2. [Vercel](https://vercel.com/) で **New Project** からこのリポジトリを import する。
   （Next.js は自動検出されるので、ビルド設定は変更不要です）
3. **Settings → Environment Variables** に `SLACK_BOT_TOKEN`・`SLACK_CHANNEL_ID`・
   `TEAMS_WEBHOOK_URL`、および（推奨）`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` を登録する。
4. **Deploy** を実行する。

デプロイ後は発行された URL でチャット画面を利用できます。
環境変数を変更した場合は再デプロイしてください。

---

## セキュリティ上の注意点

- **Webhook URL はシークレットです。** コードに直接書かず、必ず環境変数で渡してください。
- `.env*` は `.gitignore` 済みです。リポジトリにコミットしないでください。
- 中継処理はサーバー側（API Route）でのみ実行し、Webhook URL をブラウザに渡しません。
  フロントエンドは `/api/messages` だけを呼び出します。
- Webhook URL はログに出力しないようにしています。
- このプロトタイプには **認証・レート制限はありません**。社内ツールとして限定的に使うか、
  公開する場合は認証・レート制限などを別途追加してください。
  （Vercel では HTTPS が標準で有効です）

---

## ディレクトリ構成

```
waigaya-relay/
├── app/
│   ├── layout.tsx                 # ルートレイアウト
│   ├── page.tsx                   # チャット画面（クライアントコンポーネント）
│   ├── globals.css                # Tailwind インポート + body ベーススタイル
│   └── api/messages/route.ts      # メッセージ送信 API (POST)
├── lib/
│   ├── config.ts                  # 環境変数の読み込み
│   ├── types.ts                   # 共有の型定義
│   └── relay/
│       ├── slack.ts               # Slack Webhook 投稿
│       └── teams.ts               # Teams Webhook 投稿
├── docs/plan/                     # 実装計画
├── .env.example
├── next.config.mjs
├── package.json
└── tsconfig.json
```

実装計画は [`docs/plan/20260529_waigaya-relay.md`](./docs/plan/20260529_waigaya-relay.md) を参照してください。

---

## ライセンス

[MIT](./LICENSE)
