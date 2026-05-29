import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'waigaya-relay',
  description:
    'Web チャットに投稿すると Slack と Microsoft Teams に中継してスレッドの起点を作るアプリ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
