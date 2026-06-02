// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RelayTarget } from '@/lib/types'
import MessageComposer from './MessageComposer'

const ALL_CONFIGURED: Record<RelayTarget, boolean> = {
  slack: true,
  teams: true,
}

function jsonResponse(data: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => data })
}

type FetchArgs = [string, RequestInit | undefined]

/**
 * Routes fetch calls the component makes: GET /api/messages (polling),
 * POST /api/messages (send), and POST|DELETE /api/reactions.
 */
function installFetchMock(overrides?: { post?: unknown; reactions?: unknown }) {
  const calls: FetchArgs[] = []
  const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
    calls.push([url, opts])
    const method = opts?.method ?? 'GET'
    if (method === 'GET') return jsonResponse({ messages: [] })
    if (url === '/api/messages') {
      return jsonResponse(
        overrides?.post ?? {
          ok: true,
          messageId: 'm1',
          results: [
            { target: 'slack', ok: true, skipped: false, ts: '1.1' },
            { target: 'teams', ok: true, skipped: false },
          ],
        },
      )
    }
    // /api/reactions
    return jsonResponse(overrides?.reactions ?? { reactions: { '👍': 1 } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderComposer(
  props?: Partial<React.ComponentProps<typeof MessageComposer>>,
) {
  return render(
    <MessageComposer
      configured={ALL_CONFIGURED}
      username="Alice"
      onChangeUsername={() => {}}
      {...props}
    />,
  )
}

describe('MessageComposer — setup phase', () => {
  it('shows the start button when no conversation code exists', () => {
    installFetchMock()
    renderComposer()
    expect(
      screen.getByRole('button', { name: /start new conversation/i }),
    ).toBeInTheDocument()
  })

  it('moves to the active phase and shows the message form on start', async () => {
    installFetchMock()
    const user = userEvent.setup()
    renderComposer()
    await user.click(
      screen.getByRole('button', { name: /start new conversation/i }),
    )
    expect(await screen.findByLabelText('Message')).toBeInTheDocument()
    // A 12-char conversation code is generated and persisted.
    expect(window.sessionStorage.getItem('waigaya-relay:sessionId')).toMatch(
      /^[a-z0-9]{12}$/,
    )
  })

  it('starts directly in the active phase when an initialCode is given', () => {
    installFetchMock()
    renderComposer({ initialCode: 'abc123abc123' })
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
  })
})

describe('MessageComposer — active phase', () => {
  const user = userEvent.setup()

  it('warns about unconfigured relays', () => {
    installFetchMock()
    renderComposer({
      initialCode: 'abc123abc123',
      configured: { slack: true, teams: false },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/Microsoft Teams/)
  })

  it('sends a message and clears the input on success', async () => {
    const { calls } = installFetchMock()
    renderComposer({ initialCode: 'abc123abc123' })

    const textarea = screen.getByLabelText('Message')
    await user.type(textarea, 'hello world')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() =>
      expect(
        calls.some(
          ([url, opts]) => url === '/api/messages' && opts?.method === 'POST',
        ),
      ).toBe(true),
    )
    // The sent message shows up in the log and the input is cleared.
    const log = await screen.findByRole('region', { name: /posted messages/i })
    expect(within(log).getByText('hello world')).toBeInTheDocument()
    expect(textarea).toHaveValue('')
  })

  it('shows a server validation error and keeps the input', async () => {
    installFetchMock({
      post: { ok: false, error: 'Message must not be empty.' },
    })
    renderComposer({ initialCode: 'abc123abc123' })

    await user.type(screen.getByLabelText('Message'), 'oops')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(
      await screen.findByText(/Message must not be empty\./),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toHaveValue('oops')
  })

  it('toggles a reaction: POST on first click, DELETE on second', async () => {
    const { calls } = installFetchMock()
    renderComposer({ initialCode: 'abc123abc123' })

    await user.type(screen.getByLabelText('Message'), 'react to me')
    await user.click(screen.getByRole('button', { name: /send/i }))
    const log = await screen.findByRole('region', { name: /posted messages/i })

    const thumbs = within(log).getByRole('button', { name: /react with 👍/i })
    await user.click(thumbs)
    await waitFor(() =>
      expect(
        calls.some(
          ([url, opts]) => url === '/api/reactions' && opts?.method === 'POST',
        ),
      ).toBe(true),
    )

    // After reacting, clicking again removes the reaction.
    const remove = await within(log).findByRole('button', {
      name: /remove reaction 👍/i,
    })
    await user.click(remove)
    await waitFor(() =>
      expect(
        calls.some(
          ([url, opts]) =>
            url === '/api/reactions' && opts?.method === 'DELETE',
        ),
      ).toBe(true),
    )
  })

  it('clears the conversation and returns to setup on Leave', async () => {
    installFetchMock()
    renderComposer({ initialCode: 'abc123abc123' })
    await user.click(screen.getByRole('button', { name: /leave/i }))
    expect(
      await screen.findByRole('button', { name: /start new conversation/i }),
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem('waigaya-relay:sessionId')).toBeNull()
  })
})
