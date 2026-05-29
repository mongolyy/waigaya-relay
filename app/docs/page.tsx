import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ドキュメント | waigaya-relay",
};

const DOCS = [
  {
    href: "/docs/how-to-use",
    title: "使い方",
    description: "メッセージの送信手順と注意事項",
  },
];

export default function DocsPage() {
  return (
    <main className="app">
      <header className="app__header">
        <div className="how-to__breadcrumb">
          <Link href="/" className="how-to__back">
            ← チャット画面に戻る
          </Link>
        </div>
        <h1>ドキュメント</h1>
        <p className="app__lead">waigaya-relay の各種ドキュメントです。</p>
      </header>

      <ul className="docs__list">
        {DOCS.map((doc) => (
          <li key={doc.href}>
            <Link href={doc.href} className="docs__item">
              <span className="docs__item-title">{doc.title}</span>
              <span className="docs__item-desc">{doc.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
