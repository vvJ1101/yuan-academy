import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, type SessionClaims } from '@/lib/session'

// basePath 'https://academy.yuanshowroom.cn' is stripped before middleware sees the path
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

if (!pathname.startsWith('/internal') && !pathname.startsWith('/api') && pathname !== '/login') {
    return NextResponse.next()
  }

  if (PUBLIC.some(p => pathname.startsWith(p))) {
    const response = NextResponse.next()
    // Prevent proxy/CDN caching of public pages (avoids stale HTML)
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    return response
  }

  const sessionCookie = request.cookies.get('session')
  if (!sessionCookie?.value) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: '请先登录', source: 'middleware' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Only signed JWT sessions are accepted. Legacy JSON cookies are rejected.
  const raw = decodeURIComponent(sessionCookie.value)
  const session = await verifySessionToken(raw)
  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.set('session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/internal/:path*', '/api/:path*', '/login'],
}
