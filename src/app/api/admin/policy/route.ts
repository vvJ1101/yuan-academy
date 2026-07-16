import { NextRequest, NextResponse } from 'next/server'
import { canEditPolicy, getSessionFromCookiesAsync } from '@/lib/auth'
import { logPolicyChange } from '@/lib/audit'
import { writePolicies } from '@/lib/policy-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookiesAsync(req.headers.get('cookie'))
  if (!session?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  if (!canEditPolicy(session)) {
    return NextResponse.json({ error: '无权修改订货政策' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const policies = body?.policies
  if (!Array.isArray(policies)) {
    return NextResponse.json({ error: '订货政策数据格式错误' }, { status: 400 })
  }

  try {
    const stored = writePolicies(policies, session.name || '未知用户')
    await logPolicyChange(session.id, 'policy:update')
    return NextResponse.json({
      ok: true,
      count: stored.policies.length,
      updatedAt: stored.updatedAt,
      updatedBy: stored.updatedBy,
    })
  } catch (error) {
    console.error('[PolicyWriteError]', error)
    return NextResponse.json({ error: '订货政策保存失败' }, { status: 500 })
  }
}
