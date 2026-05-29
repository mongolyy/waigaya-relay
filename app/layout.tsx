import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "waigaya-relay",
  description:
    "A web chat app that relays messages to Slack and Microsoft Teams to start discussion threads.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
