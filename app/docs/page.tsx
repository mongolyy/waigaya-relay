import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs | waigaya-relay",
};

const DOCS = [
  {
    href: "/docs/how-to-use",
    title: "How to Use",
    description: "Message sending steps and important notes",
  },
];

export default function DocsPage() {
  return (
    <main className="app">
      <header className="app__header">
        <div className="how-to__breadcrumb">
          <Link href="/" className="how-to__back">
            ← Back to chat
          </Link>
        </div>
        <h1>Docs</h1>
        <p className="app__lead">Documentation for waigaya-relay.</p>
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
