import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Use | waigaya-relay",
};

const STEPS = [
  {
    number: 1,
    title: "Enter a message",
    description:
      "Write the topic you want to discuss in Slack and Microsoft Teams in the chat input.",
  },
  {
    number: 2,
    title: "Click Send",
    description:
      "When you click the send button, the message is automatically posted to both Slack and Microsoft Teams.",
  },
  {
    number: 3,
    title: "Check the relay result",
    description:
      "The result for each service (success, failed, or skipped) appears below the composer.",
  },
  {
    number: 4,
    title: "Start threads in Slack and Teams",
    description:
      "Reply to the delivered message in each tool to continue the discussion in a thread.",
  },
];

const NOTES = [
  "You can use only Slack or only Microsoft Teams. Services without webhook URLs are skipped automatically.",
  "If SLACK_WEBHOOK_URL or TEAMS_WEBHOOK_URL is not configured, that service is skipped even after sending. Ask an administrator to check the environment variables.",
  "This app does not include authentication or rate limiting. Use it only in restricted environments such as an internal network.",
];

export default function HowToUsePage() {
  return (
    <main className="app">
      <header className="app__header">
        <div className="how-to__breadcrumb">
          <Link href="/docs" className="how-to__back">
            ← Docs
          </Link>
        </div>
        <h1>How to Use</h1>
        <p className="app__lead">
          waigaya-relay relays messages to Slack and Microsoft Teams so your team can start a discussion from one post.
        </p>
      </header>

      <section className="how-to__section">
        <h2 className="how-to__heading">Sending Steps</h2>
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
        <h2 className="how-to__heading">Notes</h2>
        <ul className="how-to__notes">
          {NOTES.map((note, i) => (
            <li key={i} className="how-to__note">
              {note}
            </li>
          ))}
        </ul>
      </section>

      <div className="how-to__cta">
        <Link href="/" className="how-to__cta-button">
          Open Chat
        </Link>
      </div>
    </main>
  );
}
