import type { SessionClaims } from './session'

export const MAX_POLICY_TEXT_LENGTH = 200_000

type PolicyParseAllowed = {
  ok: true
  text: string
}

type PolicyParseDenied = {
  ok: false
  status: 400 | 401 | 403
  error: string
}

export type PolicyParseValidation = PolicyParseAllowed | PolicyParseDenied

export function canEditPolicy(session: SessionClaims): boolean {
  if (session.role === 'super_admin') return true
  return session.role === 'dept_admin'
    && session.companyName === '时胜'
    && session.departmentName === '品牌部'
}

export function validatePolicyParseRequest(
  session: SessionClaims | null,
  body: unknown,
): PolicyParseValidation {
  if (!session) {
    return { ok: false, status: 401, error: '请先登录' }
  }
  if (!canEditPolicy(session)) {
    return { ok: false, status: 403, error: '无权解析订货政策' }
  }

  const text = typeof body === 'object'
    && body !== null
    && 'text' in body
    && typeof body.text === 'string'
    ? body.text.trim()
    : ''

  if (!text || text.length > MAX_POLICY_TEXT_LENGTH) {
    return { ok: false, status: 400, error: '政策文本为空或超过允许长度' }
  }

  return { ok: true, text }
}
