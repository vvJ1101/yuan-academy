import { NextRequest, NextResponse } from 'next/server'
import { verifyLogin, signToken } from '@/lib/auth'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)

  // Rate limit: 5 attempts per minute per IP
  const rate = checkRateLimit(ip, 5, 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `登录尝试次数过多，请 ${rate.retryAfterSeconds} 秒后重试` },
      { status: 429 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = await verifyLogin(email, password)
  if (!user) {
    return NextResponse.json(
      { error: '邮箱或密码错误', remaining: rate.remaining },
      { status: 401 },
    )
  }

  // Successful login → reset rate limit
  resetRateLimit(ip)

  const token = await signToken({
    id: user.id,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    companyName: (user as any).companyName || '',
    departmentId: user.departmentId || '',
    departmentName: user.departmentName || '',
  })

  const response = NextResponse.json({ ok: true, user })
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return response
}
