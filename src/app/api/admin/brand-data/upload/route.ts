import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { logPolicyChange } from '@/lib/audit'
import { canUploadContact } from '@/lib/brand-data-access'
import { mergeBrandContactRecords, parseBrandContactWorkbook } from '@/lib/brand-data-excel'
import { readBrandPayload, writeBrandPayload } from '@/lib/brand-data-store'
import type { BrandContactRecord } from '@/types/brand-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  if (!await canUploadContact(session)) {
    return NextResponse.json({ error: '无权上传品牌对接信息' }, { status: 403 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: '上传请求格式错误' }, { status: 400 })

  const type = String(formData.get('type') || '')
  const mode = String(formData.get('mode') || 'merge') === 'replace' ? 'replace' : 'merge'
  const file = formData.get('file')
  if (type !== 'contact') return NextResponse.json({ error: '资料类型无效' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择 Excel 文件' }, { status: 400 })

  try {
    const incoming = parseBrandContactWorkbook(Buffer.from(await file.arrayBuffer()))
    if (incoming.length === 0) {
      return NextResponse.json({ error: 'Excel 中没有可导入的品牌数据' }, { status: 400 })
    }
    let existing: BrandContactRecord[] = []
    if (mode === 'merge') {
      try {
        existing = readBrandPayload<BrandContactRecord>('contact').items
      } catch {
        existing = []
      }
    }
    const merged = mergeBrandContactRecords(existing, incoming, mode)
    const payload = writeBrandPayload(
      'contact',
      merged,
      session.name || session.id,
    )
    await logPolicyChange(session.id, 'brandContact:upload')
    return NextResponse.json({
      ok: true,
      mode,
      imported: incoming.length,
      total: payload.items.length,
      updatedAt: payload.updatedAt,
    })
  } catch (error) {
    console.error('[BrandContactUploadError]', error)
    return NextResponse.json({ error: '品牌对接信息上传失败，请检查 Excel 格式' }, { status: 500 })
  }
}
