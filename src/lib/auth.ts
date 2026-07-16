import { PrismaClient } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  readVerifiedSession,
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from '@/lib/session'

export interface SessionUser extends SessionClaims {}

/** Sign a JWT token for session cookie */
export async function signToken(user: SessionUser): Promise<string> {
  return signSessionToken(user)
}

/** Verify JWT token and return session user, or null */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  return verifySessionToken(token)
}

/** Read and verify the signed session cookie. Unsigned legacy cookies are rejected. */
export async function getSessionFromCookies(cookieHeader: string | null): Promise<SessionUser | null> {
  return readVerifiedSession(cookieHeader)
}

export const getSessionFromCookiesAsync = getSessionFromCookies

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
