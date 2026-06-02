import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', () => ({
  getTeamsBotLoginUrl: vi.fn(() => 'https://test-login'),
  getTeamsBotServiceUrl: vi.fn(() => 'https://test-service'),
}))

import { _resetTokenCacheForTests, postToTeams } from '@/lib/relay/teams'

const CONFIG = {
  appId: 'test-app-id',
  appPassword: 'test-password',
  tenantId: 'test-tenant',
  channelId: '19:test@thread.tacv2',
}

function tokenResponse(token = 'test-token', expiresIn = 3600) {
  return new Response(
    JSON.stringify({ access_token: token, expires_in: expiresIn }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function conversationResponse(id = 'conv-123') {
  return new Response(JSON.stringify({ id, activityId: 'act-456' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function activityResponse() {
  return new Response(JSON.stringify({ id: 'act-789' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('postToTeams', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    _resetTokenCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns skipped when any required config field is missing', async () => {
    const result = await postToTeams({ ...CONFIG, appId: undefined }, 'hello')
    expect(result).toEqual({
      target: 'teams',
      ok: false,
      skipped: true,
      detail: 'Teams Bot is not configured — Teams relay skipped.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ok:true and a conversationId when starting a new thread', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())

    const result = await postToTeams(CONFIG, 'hello')
    expect(result).toEqual({
      target: 'teams',
      ok: true,
      skipped: false,
      conversationId: 'conv-123',
    })
  })

  it('acquires a token and POSTs to /v3/conversations when no conversationId is given', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())

    await postToTeams(CONFIG, 'test message')

    const [tokenUrl, tokenOpts] = vi.mocked(fetch).mock.calls[0]
    expect(tokenUrl).toBe('https://test-login/test-tenant/oauth2/v2.0/token')
    // biome-ignore lint/style/noNonNullAssertion: tokenOpts is guaranteed by mock setup
    expect((tokenOpts!.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    )

    const [convUrl, convOpts] = vi.mocked(fetch).mock.calls[1]
    expect(convUrl).toBe('https://test-service/v3/conversations')
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    const body = JSON.parse(convOpts!.body as string)
    expect(body.isGroup).toBe(true)
    expect(body.channelData.channel.id).toBe(CONFIG.channelId)
    expect(body.channelData.tenant.id).toBe(CONFIG.tenantId)
    expect(body.activity.text).toBe('test message')
    expect(body.bot.id).toBe(CONFIG.appId)
    // biome-ignore lint/style/noNonNullAssertion: convOpts is guaranteed by mock setup
    expect((convOpts!.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    )
  })

  it('POSTs to /v3/conversations/{id}/activities when conversationId is given', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(activityResponse())

    const result = await postToTeams(CONFIG, 'reply text', {
      conversationId: 'conv-existing',
    })
    expect(result).toEqual({ target: 'teams', ok: true, skipped: false })

    const [url, opts] = vi.mocked(fetch).mock.calls[1]
    expect(url).toBe(
      'https://test-service/v3/conversations/conv-existing/activities',
    )
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    const body = JSON.parse(opts!.body as string)
    expect(body.type).toBe('message')
    expect(body.text).toBe('reply text')
  })

  it('reuses the cached token on a second call', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())
      .mockResolvedValueOnce(conversationResponse('conv-456'))

    await postToTeams(CONFIG, 'first')
    await postToTeams(CONFIG, 'second')

    // 3 calls total: 1 token + 2 conversations (no second token fetch)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it('does not fire a second token request when two calls race concurrently', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())
      .mockResolvedValueOnce(conversationResponse('conv-456'))

    // Both calls start before either resolves — the second must reuse the pending promise.
    await Promise.all([postToTeams(CONFIG, 'first'), postToTeams(CONFIG, 'second')])

    // 3 calls total: 1 token + 2 conversations (no second token fetch)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it('prepends username in bold to the message text', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())

    await postToTeams(CONFIG, 'hello', { username: 'Alice' })

    const [, opts] = vi.mocked(fetch).mock.calls[1]
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    const body = JSON.parse(opts!.body as string)
    expect(body.activity.text).toBe('**Alice**: hello')
  })

  it('escapes markdown special characters in the username', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())

    await postToTeams(CONFIG, 'hello', { username: '**Bot**' })

    const [, opts] = vi.mocked(fetch).mock.calls[1]
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    const body = JSON.parse(opts!.body as string)
    // * → ＊ (full-width), applied to each character in **Bot**
    expect(body.activity.text).toBe('**＊＊Bot＊＊**: hello')
  })

  it('sends plain text when username is not provided', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(conversationResponse())

    await postToTeams(CONFIG, 'no username')

    const [, opts] = vi.mocked(fetch).mock.calls[1]
    // biome-ignore lint/style/noNonNullAssertion: options is guaranteed by mock setup
    const body = JSON.parse(opts!.body as string)
    expect(body.activity.text).toBe('no username')
  })

  it('returns ok:false with HTTP status when the service returns non-2xx', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('', { status: 403 }))

    const result = await postToTeams(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('HTTP 403'),
    })
  })

  it('includes the error body in detail', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))

    const result = await postToTeams(CONFIG, 'hello')
    expect(result.detail).toContain('Unauthorized')
  })

  it('truncates error body longer than 200 characters', async () => {
    const longBody = 'x'.repeat(300)
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(longBody, { status: 500 }))

    const result = await postToTeams(CONFIG, 'hello')
    expect(result.detail).toContain('...')
    // biome-ignore lint/style/noNonNullAssertion: detail asserted via toContain above
    const bodyPart = result.detail!.split(': ')[1]
    expect(bodyPart.length).toBeLessThanOrEqual(203)
  })

  it('returns a timeout detail on TimeoutError', async () => {
    const err = Object.assign(new Error('signal timed out'), {
      name: 'TimeoutError',
    })
    vi.mocked(fetch).mockRejectedValueOnce(err)

    const result = await postToTeams(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('timed out'),
    })
  })

  it('returns an error detail on generic Error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connection refused'))

    const result = await postToTeams(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('connection refused'),
    })
  })

  it('handles non-Error thrown values safely', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(42)

    const result = await postToTeams(CONFIG, 'hello')
    expect(result).toMatchObject({
      target: 'teams',
      ok: false,
      skipped: false,
      detail: expect.stringContaining('42'),
    })
  })
})
