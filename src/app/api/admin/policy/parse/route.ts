import { NextRequest, NextResponse } from 'next/server'
import { parsePolicyText } from '@/lib/policy-parser'
import { getSessionFromCookies } from '@/lib/auth'
import { validatePolicyParseRequest } from '@/lib/policy-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const body = await req.json().catch(() => null)
  const validation = validatePolicyParseRequest(session, body)
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status },
    )
  }

  const result = parsePolicyText(validation.text)
  return NextResponse.json({ code: 0, data: result })
}
