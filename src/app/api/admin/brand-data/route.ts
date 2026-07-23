import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { logPolicyChange } from '@/lib/audit'
import { canEditContact } from '@/lib/brand-data-access'
import { CONTACT_FIELD_LABELS } from '@/lib/brand-data-fields'
import { readBrandPayload, writeBrandPayload } from '@/lib/brand-data-store'
import type { BrandContactRecord } from '@/types/brand-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FIELD_KEYS = Object.keys(CONTACT_FIELD_LABELS) as (keyof BrandContactRecord)[]

function normalizeRecord(value: unknown): BrandContactRecord | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const record: Partial<BrandContactRecord> = {}
  for (const key of FIELD_KEYS) {
    record[key] = typeof input[key] === 'string' ? input[key].trim() : ''
  }
  return record.brandName ? record as BrandContactRecord : null
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  if (!await canEditContact(session)) {
    return NextResponse.json({ error: '无权编辑品牌对接信息' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求数据格式错误' }, { status: 400 })
  }

  const type = String(body.type || '')
  if (type !== 'contact') return NextResponse.json({ error: '资料类型无效' }, { status: 400 })

  const originalBrandName = String(body.originalBrandName || '').trim()
  const record = normalizeRecord(body.record)
  if (!originalBrandName || !record) {
    return NextResponse.json({ error: '请填写品牌名称和有效字段' }, { status: 400 })
  }

  try {
    const payload = readBrandPayload<BrandContactRecord>('contact')
    const targetKey = originalBrandName.toLowerCase()
    const index = payload.items.findIndex(item => item.brandName.trim().toLowerCase() === targetKey)
    if (index < 0) {
      return NextResponse.json({ error: '品牌记录不存在' }, { status: 404 })
    }

    const duplicate = payload.items.some((item, itemIndex) =>
      itemIndex !== index && item.brandName.trim().toLowerCase() === record.brandName.trim().toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json({ error: '已存在同名品牌' }, { status: 409 })
    }

    const nextItems = [...payload.items]
    nextItems[index] = record
    const updated = writeBrandPayload('contact', nextItems, session.name || session.id)
    await logPolicyChange(session.id, 'brandContact:update')

    return NextResponse.json({
      ok: true,
      item: record,
      updatedAt: updated.updatedAt,
      updatedBy: updated.updatedBy,
    })
  } catch (error) {
    console.error('[BrandContactUpdateError]', error)
    return NextResponse.json({ error: '品牌对接信息保存失败' }, { status: 500 })
  }
}
