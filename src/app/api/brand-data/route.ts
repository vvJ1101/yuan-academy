import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getContactView } from '@/lib/brand-data-access'
import { projectContactRecord } from '@/lib/brand-data-fields'
import { readBrandPayload } from '@/lib/brand-data-store'
import type { BrandContactRecord } from '@/types/brand-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type') || 'contact'
  if (type !== 'contact') {
    return NextResponse.json({ error: '资料类型暂未接入统一接口' }, { status: 400 })
  }

  const view = await getContactView(session)
  if (!view) return NextResponse.json({ error: '无权查看品牌对接信息' }, { status: 403 })

  try {
    const payload = readBrandPayload<BrandContactRecord>('contact')
    return NextResponse.json({
      items: payload.items.map(item => projectContactRecord(item, view)),
      view,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy,
    })
  } catch {
    return NextResponse.json({ items: [], view, updatedAt: '', updatedBy: '' })
  }
}
