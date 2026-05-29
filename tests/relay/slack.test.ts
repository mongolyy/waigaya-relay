import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postToSlack } from '@/lib/relay/slack'

const WEBHOOK_URL = 'https://hooks.slack.com/services/T000/B000/test'

describe('postToSlack', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns skipped when webhookUrl is undefined', async () => {
    const result = await postToSlack(undefined, 'hello')
    expect(result).toEqual({
      target: 'slack',
      ok: false,
      skipped: true,
      detail: 'SLACK_WEBHOOK_URL is not set — Slack relay skipped.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ok:true on a 200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result).toEqual({ target: 'slack', ok: true, skipped: false })
  })

  it('sends the message as { text } JSON to the webhook URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }))
    await postToSlack(WEBHOOK_URL, 'test message')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(WEBHOOK_URL)
    expect(JSON.parse(options!.body as string)).toEqual({
      text: 'test message',
    })
    expect((options!.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  it('returns ok:false with HTTP status when webhook returns non-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 400 }))
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('HTTP 400'),
    })
  })

  it('includes the error body in detail', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('invalid_token', { status: 403 }),
    )
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result.detail).toContain('invalid_token')
  })

  it('truncates error body longer than 200 characters', async () => {
    const longBody = 'x'.repeat(300)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(longBody, { status: 500 }),
    )
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result.detail).toContain('...')
    // body is capped at 200 chars + "..."
    const bodyPart = result.detail!.split(': ')[1]
    expect(bodyPart.length).toBeLessThanOrEqual(203)
  })

  it('returns a timeout detail on TimeoutError', async () => {
    const err = Object.assign(new Error('signal timed out'), {
      name: 'TimeoutError',
    })
    vi.mocked(fetch).mockRejectedValueOnce(err)
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('timed out'),
    })
  })

  it('returns an error detail on generic Error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network failure'))
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('network failure'),
    })
  })

  it('handles non-Error thrown values safely', async () => {
    vi.mocked(fetch).mockRejectedValueOnce('plain string error')
    const result = await postToSlack(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'slack',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('plain string error'),
    })
  })
})
