import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  requireRole?: string[]  // e.g. ['super_admin'] or ['super_admin', 'dept_admin']
}

// Role hierarchy: super_admin > dept_admin > staff
const ROLE_LEVEL: Record<string, number> = { super_admin: 3, dept_admin: 2, staff: 1 }

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Decode base64url to UTF-8 (atob alone can't handle multibyte chars like Chinese)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function parseSession(raw: string): any {
  // JWT token
  if (raw.startsWith('eyJ')) {
    return decodeJwtPayload(raw)
  }
  // Legacy plain JSON
  try { return JSON.parse(raw) } catch { return null }
}

export function AuthGuard({ children, requireRole }: Props) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('session')

  // No session → redirect to login
  if (!sessionCookie?.value) {
    redirect('/login')
  }

  // Validate session (JWT or legacy JSON)
  const session = parseSession(decodeURIComponent(sessionCookie.value))
  if (!session?.id || !session?.role) {
    redirect('/login')
  }

  // Check role requirement
  if (requireRole && requireRole.length > 0) {
    const userLevel = ROLE_LEVEL[session.role] || 0
    const requiredLevel = Math.max(...requireRole.map(r => ROLE_LEVEL[r] || 0))
    if (userLevel < requiredLevel) {
      redirect('/internal/dashboard')
    }
  }

  return <>{children}</>
}
