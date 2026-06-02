// Records a demo GIF of the app and saves it to docs/demo.gif.
// Run: npm run record-demo
//
// Environment variables:
//   APP_URL          - URL of the running app (default: http://localhost:3000)
//   CHROME_PATH      - Path to Chromium executable (default: Playwright's managed Chromium)
//   PLAYWRIGHT_BROWSERS_PATH - Root directory of Playwright browser binaries
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../docs')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const context = await browser.newContext({
  viewport: { width: 1000, height: 700 },
  recordVideo: { dir: outDir, size: { width: 1000, height: 700 } },
  colorScheme: 'dark',
})

const page = await context.newPage()

await page.goto(process.env.APP_URL || 'http://localhost:3000')
await page.waitForLoadState('networkidle')
await page.waitForTimeout(800)

// Enter username in the welcome dialog
const input = page.locator('#dialog-username')
await input.waitFor({ state: 'visible' })
await input.fill('Alice')
await page.waitForTimeout(400)

// Click Start (submit button inside the dialog)
await page.locator('dialog button[type="submit"]').click()
await page.waitForTimeout(600)

// Click "Start new conversation"
await page.getByRole('button', { name: /Start new conversation/ }).click()
await page.waitForTimeout(600)

// Expand "How to use"
await page.getByText('How to use').click()
await page.waitForTimeout(800)

// Close "How to use"
await page.getByText('How to use').click()
await page.waitForTimeout(400)

// Type a message
const textarea = page.locator('textarea#message')
await textarea.fill("Hello team! Let's kick off today's discussion 🚀")
await page.waitForTimeout(600)

// Send
await page.getByRole('button', { name: 'Send' }).click()
await page.waitForTimeout(1200)

// React with 👍
await page
  .getByRole('button', { name: /React with 👍/ })
  .first()
  .click()
await page.waitForTimeout(500)
await page
  .getByRole('button', { name: /React with 🎉/ })
  .first()
  .click()
await page.waitForTimeout(800)

// Send a second message
await textarea.fill('Thanks everyone for joining!')
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Send' }).click()
await page.waitForTimeout(1000)

await page.waitForTimeout(600)

const videoPath = await page.video()?.path()
await context.close()
await browser.close()

console.log('VIDEO:', videoPath)
