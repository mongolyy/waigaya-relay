import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "使い方 | waigaya-relay",
};

const STEPS = [
  {
    number: 1,
    title: "メッセージを入力する",
    description:
      "チャット画面の入力欄に、Slack・Teams で議論したいトピックを書きます。",
  },
  {
    number: 2,
    title: "「送信する」を押す",
    description:
      "送信ボタンを押すと、入力したメッセージが Slack と Microsoft Teams の両方に自動で投稿されます。",
  },
  {
    number: 3,
    title: "中継結果を確認する",
    description:
      "画面下部に各サービスへの投稿結果（成功 / 失敗 / スキップ）が表示されます。",
  },
  {
    number: 4,
    title: "Slack / Teams でスレッドを始める",
    description:
      "届いたメッセージに返信することで、それぞれのツール上でそのままスレッドの議論が始まります。",
  },
];

const NOTES = [
  "Slack・Teams のどちらか一方だけでも使えます。未設定のサービスは自動的にスキップされます。",
  "環境変数（SLACK_WEBHOOK_URL / TEAMS_WEBHOOK_URL）が未設定の場合、送信してもスキップされます。管理者に確認してください。",
  "このアプリには認証やレート制限がありません。社内など限定された環境でご利用ください。",
];

export default function HowToUsePage() {
  return (
    <main className="app">
      <header className="app__header">
        <div className="how-to__breadcrumb">
          <Link href="/docs" className="how-to__back">
            ← ドキュメント一覧
          </Link>
        </div>
        <h1>使い方</h1>
        <p className="app__lead">
          waigaya-relay はメッセージを Slack・Microsoft Teams に中継し、チームの議論のきっかけを作るツールです。
        </p>
      </header>

      <section className="how-to__section">
        <h2 className="how-to__heading">送信の手順</h2>
        <ol className="how-to__steps">
          {STEPS.map((step) => (
            <li key={step.number} className="how-to__step">
              <span className="how-to__step-number">{step.number}</span>
              <div>
                <p className="how-to__step-title">{step.title}</p>
                <p className="how-to__step-desc">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="how-to__section">
        <h2 className="how-to__heading">注意事項</h2>
        <ul className="how-to__notes">
          {NOTES.map((note) => (
            <li key={note} className="how-to__note">
              {note}
            </li>
          ))}
        </ul>
      </section>

      <div className="how-to__cta">
        <Link href="/" className="how-to__cta-button">
          チャット画面を開く
        </Link>
      </div>
    </main>
  );
}
