import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postToSlack } from '@/lib/relay/slack'

const CONFIG = { token: 'xoxb-test-token', channel: 'C0TEST' }

/** Build a Slack-style JSON Response (Slack returns HTTP 200 even on errors). */
function slackResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('postToSlack', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns skipped when token or channel is missing', async () => {
    const result = await postToSlack({ token: undefined, channel: 'C0' }, 'hi')
    expect(result).toEqual({
      target: 'slack',
      ok: false,
      skipped: true,
      detail:
        'SLACK_BOT_TOKEN / SLACK_CHANNEL_ID is not set — Slack relay skipped.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ok:true with the message ts on a successful post', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      slackResponse({ ok: true, ts: '1700000000.000100' }),
    )
    const result = await postToSlack(CONFIG, 'hello')
    expect(result).toEqual({
      target: 'slack',
      ok: true,
      skipped: false,
      ts: '1700000000.000100',
    })
  })

  it('calls chat.postMessage with channel, text and the bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      slackResponse({ ok: true, ts: '1.1' }),
    )
    await postToSlack(CONFIG, 'test message')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/chat.postMessage')
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    expect(JSON.parse(options!.body as string)).toEqual({
      channel: 'C0TEST',
      text: 'test message',
    })
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    const headers = options!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer xoxb-test-token')
  })

  it('includes thread_ts when posting into an existing thread', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      slackResponse({ ok: true, ts: '2.2' }),
    )
    await postToSlack(CONFIG, 'reply', '1700000000.000100')

    const [, options] = vi.mocked(fetch).mock.calls[0]
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    expect(JSON.parse(options!.body as string)).toEqual({
      channel: 'C0TEST',
      text: 'reply',
      thread_ts: '1700000000.000100',
    })
  })

  it('omits thread_ts when no thread is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      slackResponse({ ok: true, ts: '3.3' }),
    )
    await postToSlack(CONFIG, 'first message')

    const [, options] = vi.mocked(fetch).mock.calls[0]
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    expect(JSON.parse(options!.body as string)).not.toHaveProperty('thread_ts')
  })

  it('returns ok:false with the Slack error code when ok is false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      slackResponse({ ok: false, error: 'channel_not_found' }),
    )
    const result = await postToSlack(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('channel_not_found'),
    })
  })

  it('returns ok:false with HTTP status on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }))
    const result = await postToSlack(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('HTTP 500'),
    })
  })

  it('returns a timeout detail on TimeoutError', async () => {
    const err = Object.assign(new Error('signal timed out'), {
      name: 'TimeoutError',
    })
    vi.mocked(fetch).mockRejectedValueOnce(err)
    const result = await postToSlack(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('timed out'),
    })
  })

  it('returns an error detail on a generic Error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network failure'))
    const result = await postToSlack(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('network failure'),
    })
  })
})
