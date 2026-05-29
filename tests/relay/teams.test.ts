import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postToTeams } from '@/lib/relay/teams'

const WEBHOOK_URL =
  'https://outlook.office.com/webhook/test/IncomingWebhook/token'

describe('postToTeams', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns skipped when webhookUrl is undefined', async () => {
    const result = await postToTeams(undefined, 'hello')
    expect(result).toEqual({
      target: 'teams',
      ok: false,
      skipped: true,
      detail: 'TEAMS_WEBHOOK_URL is not set — Teams relay skipped.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ok:true on a 200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('1', { status: 200 }))
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result).toEqual({ target: 'teams', ok: true, skipped: false })
  })

  it('sends a MessageCard payload to the webhook URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('1', { status: 200 }))
    await postToTeams(WEBHOOK_URL, 'test message')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(WEBHOOK_URL)
    const payload = JSON.parse(options!.body as string)
    expect(payload['@type']).toBe('MessageCard')
    expect(payload['@context']).toBe('https://schema.org/extensions')
    expect(payload.text).toBe('test message')
    expect((options!.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  it('returns ok:false with HTTP status when webhook returns non-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 400 }))
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('HTTP 400'),
    })
  })

  it('includes the error body in detail', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('BadRequest', { status: 400 }),
    )
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result.detail).toContain('BadRequest')
  })

  it('truncates error body longer than 200 characters', async () => {
    const longBody = 'y'.repeat(300)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(longBody, { status: 500 }),
    )
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result.detail).toContain('...')
    const bodyPart = result.detail!.split(': ')[1]
    expect(bodyPart.length).toBeLessThanOrEqual(203)
  })

  it('returns a timeout detail on TimeoutError', async () => {
    const err = Object.assign(new Error('signal timed out'), {
      name: 'TimeoutError',
    })
    vi.mocked(fetch).mockRejectedValueOnce(err)
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('timed out'),
    })
  })

  it('returns an error detail on generic Error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connection refused'))
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('connection refused'),
    })
  })

  it('handles non-Error thrown values safely', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(42)
    const result = await postToTeams(WEBHOOK_URL, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('42'),
    })
  })
})
