import { type ChildProcess, spawn } from 'node:child_process'
import http from 'node:http'

const MOCK_PORT = 19999
export const APP_PORT = 3099
export const APP_BASE_URL = `http://localhost:${APP_PORT}`

let mockServer: http.Server
let nextProcess: ChildProcess

export async function setup() {
  mockServer = http.createServer((req, res) => {
    // Slack Web API (chat.postMessage) replies with JSON including `ok` and `ts`.
    if (req.url?.startsWith('/slack-api')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ts: '1700000000.000100' }))
      return
    }
    // Teams Incoming Webhook is happy with any 2xx response.
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
  })
  await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, resolve))
  nextProcess = spawn(
    'node',
    ['node_modules/next/dist/bin/next', 'dev', '-p', String(APP_PORT)],
    {
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_CHANNEL_ID: 'C0TEST',
        SLACK_API_BASE_URL: `http://localhost:${MOCK_PORT}/slack-api`,
        TEAMS_WEBHOOK_URL: `http://localhost:${MOCK_PORT}/teams`,
      },
      stdio: 'ignore',
    },
  )

  await waitForServer(APP_BASE_URL, 60_000)
}

export async function teardown() {
  nextProcess?.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    nextProcess?.once('exit', resolve)
    setTimeout(resolve, 5_000)
  })
  if (mockServer) {
    mockServer.closeAllConnections?.()
    await new Promise<void>((resolve) => mockServer.close(() => resolve()))
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (res.status < 500) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`)
}
