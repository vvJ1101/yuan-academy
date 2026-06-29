import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// basePath 'https://academy.yuanshowroom.cn' is stripped before middleware sees the path
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout']
const ADMIN_API = ['/api/documents']

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production'
)

/**
 * Verify JWT signature and return payload, or null if invalid.
 * Uses Web Crypto API (available in Edge Runtime).
 */
async function verifyJwt(token: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

function checkAdminRoute(session: any, pathname: string): boolean {
  if (session.role === 'super_admin') return true
  if (pathname.startsWith('/internal/admin/users') || pathname.startsWith('/api/users')) {
    return false
  }

  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/internal') && !pathname.startsWith('/api') && pathname !== '/login') {
    return NextResponse.next()
  }

  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('session')
  if (!sessionCookie?.value) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify JWT signature (not just decode)
  let session: any = { role: 'staff' }
  const raw = decodeURIComponent(sessionCookie.value)
  if (raw.startsWith('eyJ')) {
    const payload = await verifyJwt(raw)
    if (!payload) {
      // Invalid or expired token → clear cookie + redirect
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.set('session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
      return response
    }
    session = {
      id: payload.id || '',
      name: payload.name || '',
      role: payload.role || 'staff',
      companyId: payload.companyId || null,
      companyName: payload.companyName || '',
      departmentId: payload.departmentId || '',
      departmentName: payload.departmentName || '',
    }
  } else {
    // Legacy plain JSON cookie — still accepted for backward compat
    try { session = JSON.parse(raw) } catch {}
  }

  if (!checkAdminRoute(session, pathname)) {
    if (pathname.startsWith('/api')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.redirect(new URL('/internal/dashboard', request.url))
  }

  if (ADMIN_API.some(p => pathname.startsWith(p)) && session.role !== 'super_admin' && session.role !== 'dept_admin') {
    if (request.method !== 'GET') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/internal/:path*', '/api/:path*', '/login'],
}
