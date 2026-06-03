import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER?.trim()
  const password = process.env.BASIC_AUTH_PASSWORD?.trim()

  if (!user || !password) {
    return NextResponse.next()
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const encoded = authHeader.slice(6)
    const decoded = atob(encoded)
    const colonIndex = decoded.indexOf(':')
    if (colonIndex !== -1) {
      const reqUser = decoded.slice(0, colonIndex)
      const reqPassword = decoded.slice(colonIndex + 1)
      if (reqUser === user && reqPassword === password) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="waigaya-relay"' },
  })
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
