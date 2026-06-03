import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { middleware } from '@/middleware'

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers['authorization'] = authHeader
  return new NextRequest('http://localhost/', { headers })
}

function basicAuthHeader(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`
}

describe('middleware basic auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('passes through when env vars are not set', () => {
    delete process.env.BASIC_AUTH_USER
    delete process.env.BASIC_AUTH_PASSWORD
    const res = middleware(makeRequest())
    expect(res.status).toBe(200)
  })

  it('returns 401 when no credentials are provided', () => {
    process.env.BASIC_AUTH_USER = 'alice'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const res = middleware(makeRequest())
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Basic realm="waigaya-relay"')
  })

  it('returns 401 for wrong credentials', () => {
    process.env.BASIC_AUTH_USER = 'alice'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const res = middleware(makeRequest(basicAuthHeader('alice', 'wrong')))
    expect(res.status).toBe(401)
  })

  it('passes through for correct credentials', () => {
    process.env.BASIC_AUTH_USER = 'alice'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const res = middleware(makeRequest(basicAuthHeader('alice', 'secret')))
    expect(res.status).toBe(200)
  })

  it('allows passwords that contain colons', () => {
    process.env.BASIC_AUTH_USER = 'alice'
    process.env.BASIC_AUTH_PASSWORD = 'pa:ss:word'
    const res = middleware(makeRequest(basicAuthHeader('alice', 'pa:ss:word')))
    expect(res.status).toBe(200)
  })
})
