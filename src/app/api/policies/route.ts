import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookiesAsync } from '@/lib/auth'
import { readPolicyPayload } from '@/lib/policy-store'
import { requireAnyPermission } from '@/lib/permissions/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookiesAsync(request.headers.get('cookie'))
  if (!session?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  const guard = await requireAnyPermission(session, ['menu.brand.ordering', 'brandOrdering.view'], '无权查看订货政策')
  if (!guard.ok) return guard.response

  try {
    return NextResponse.json(readPolicyPayload(), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: '订货政策数据不存在' }, { status: 404 })
    }
    console.error('[PolicyReadError]', error)
    return NextResponse.json({ error: '订货政策数据读取失败' }, { status: 500 })
  }
}
