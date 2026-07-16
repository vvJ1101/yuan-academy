import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE_NAME = 'session'
export const SESSION_EXPIRY = '7d'

export interface SessionClaims {
  id: string
  name?: string
  role: string
  companyId: string | null
  companyName?: string
  departmentId: string
  departmentName?: string
}

export function getJwtSecret(secret = process.env.JWT_SECRET || ''): Uint8Array {
  if (!secret.trim()) {
    throw new Error('JWT_SECRET 未配置，无法安全签发或验证会话')
  }
  return new TextEncoder().encode(secret)
}

function normalizeClaims(payload: Record<string, unknown>): SessionClaims | null {
  if (typeof payload.id !== 'string' || !payload.id) return null
  if (typeof payload.role !== 'string' || !payload.role) return null

  return {
    id: payload.id,
    name: typeof payload.name === 'string' ? payload.name : '',
    role: payload.role,
    companyId: typeof payload.companyId === 'string' && payload.companyId
      ? payload.companyId
      : null,
    companyName: typeof payload.companyName === 'string' ? payload.companyName : '',
    departmentId: typeof payload.departmentId === 'string' ? payload.departmentId : '',
    departmentName: typeof payload.departmentName === 'string' ? payload.departmentName : '',
  }
}

function readCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const entry = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${SESSION_COOKIE_NAME}=`))
  if (!entry) return null

  try {
    return decodeURIComponent(entry.slice(SESSION_COOKIE_NAME.length + 1))
  } catch {
    return null
  }
}

export async function signSessionToken(
  user: SessionClaims,
  secret = process.env.JWT_SECRET || '',
): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(getJwtSecret(secret))
}

export async function verifySessionToken(
  token: string,
  secret = process.env.JWT_SECRET || '',
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(secret), {
      algorithms: ['HS256'],
    })
    return normalizeClaims(payload)
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT_SECRET 未配置')) {
      throw error
    }
    return null
  }
}

export async function readVerifiedSession(
  cookieHeader: string | null,
  secret = process.env.JWT_SECRET || '',
): Promise<SessionClaims | null> {
  const token = readCookie(cookieHeader)
  if (!token) return null
  return verifySessionToken(token, secret)
}
