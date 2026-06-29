import { PrismaClient } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production'
)
const JWT_EXPIRY = '7d'
const COOKIE_NAME = 'session'

export interface SessionUser {
  id: string; name?: string; role: string; companyId: string | null; companyName?: string
  departmentId: string; departmentName?: string
}

/** Sign a JWT token for session cookie */
export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    name: user.name || '',
    role: user.role,
    companyId: user.companyId || '',
    companyName: user.companyName || '',
    departmentId: user.departmentId || '',
    departmentName: user.departmentName || '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET)
}

/** Verify JWT token and return session user, or null */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      id: payload.id as string,
      name: payload.name as string,
      role: payload.role as string,
      companyId: (payload.companyId as string) || null,
      companyName: payload.companyName as string,
      departmentId: payload.departmentId as string,
      departmentName: payload.departmentName as string,
    }
  } catch {
    return null
  }
}

/** Read session from cookie header string (sync — JWT payload decode, no signature check) */
export function getSessionFromCookies(cookieHeader: string | null): SessionUser | null {
  if (!cookieHeader) return null
  try {
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
    if (!match) return null
    const raw = decodeURIComponent(match[1])
    // JWT token — decode payload without verification (UTF-8 safe)
    if (raw.startsWith('eyJ')) {
      const parts = raw.split('.')
      if (parts.length === 3) {
        const json = Buffer.from(parts[1], 'base64url').toString('utf-8')
        const payload = JSON.parse(json)
        return {
          id: payload.id || '',
          name: payload.name || '',
          role: payload.role || 'staff',
          companyId: payload.companyId || null,
          companyName: payload.companyName || '',
          departmentId: payload.departmentId || '',
          departmentName: payload.departmentName || '',
        }
      }
      return null
    }
    // Legacy plain JSON cookie
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Async session reader — preferred for new code */
export async function getSessionFromCookiesAsync(cookieHeader: string | null): Promise<SessionUser | null> {
  if (!cookieHeader) return null
  try {
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
    if (!match) return null
    const raw = decodeURIComponent(match[1])
    // JWT token
    if (raw.startsWith('eyJ')) {
      return verifyToken(raw)
    }
    // Legacy plain JSON fallback
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { department: true, company: true },
  })
  if (!user) return null
  const valid = await compare(password, user.passwordHash)
  if (!valid) return null
  return {
    id: user.id, email: user.email, name: user.name,
    role: user.role as 'super_admin' | 'dept_admin' | 'staff',
    companyId: user.companyId, companyName: user.company?.name ?? '',
    departmentId: user.departmentId, departmentName: user.department?.name ?? '',
  }
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { department: true, company: true } })
}

export async function hashPassword(password: string) {
  return hash(password, 12)
}

// ── Document permissions → @/lib/permissions/documents (SINGLE SOURCE OF TRUTH) ──
// Import from there: canReadDocument, canEditDocument, getVisibleDocuments, canAccessAdminRoute

// ── Unified RBAC Functions ──

/** super_admin only: user management */
export function canManageUsers(session: SessionUser): boolean {
  return session.role === 'super_admin'
}

/** super_admin OR (时胜 + 品牌部 + dept_admin) */
export function canEditPolicy(session: SessionUser): boolean {
  if (session.role === 'super_admin') return true
  if (session.role === 'dept_admin' &&
      session.companyName === '时胜' &&
      session.departmentName === '品牌部') {
    return true
  }
  return false
}

// ── Document permissions → migrated to @/lib/permissions/documents ──
// Import from there: canReadDocument, canEditDocument, canDeleteDocument, buildDocumentWhere

export { prisma }
