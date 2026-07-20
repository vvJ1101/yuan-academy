import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSessionFromCookies } from '@/lib/auth'
import { canExportContact, getContactView } from '@/lib/brand-data-access'
import { getContactFields, getContactExportHeaders } from '@/lib/brand-data-fields'
import { readBrandPayload } from '@/lib/brand-data-store'
import type { BrandContactRecord } from '@/types/brand-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type') || 'contact'
  if (type !== 'contact') return NextResponse.json({ error: '资料类型无效' }, { status: 400 })

  const view = await getContactView(session)
  if (!view) return NextResponse.json({ error: '无权导出品牌对接信息' }, { status: 403 })
  if (!await canExportContact(session, view)) {
    return NextResponse.json({ error: '无权导出品牌对接信息' }, { status: 403 })
  }

  try {
    const payload = readBrandPayload<BrandContactRecord>('contact')
    const fields = getContactFields(view)
    const rows = [
      getContactExportHeaders(view),
      ...payload.items.map(item => fields.map(field => item[field] || '')),
    ]
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, '品牌对接信息')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': "attachment; filename*=UTF-8''%E5%93%81%E7%89%8C%E5%AF%B9%E6%8E%A5%E4%BF%A1%E6%81%AF.xlsx",
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    console.error('[BrandExportError]', error)
    return NextResponse.json({ error: '品牌对接信息导出失败' }, { status: 500 })
  }
}
