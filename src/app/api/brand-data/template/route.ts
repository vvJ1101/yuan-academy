import { readFileSync } from 'node:fs'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getContactView } from '@/lib/brand-data-access'
import { getBrandTemplatePath } from '@/lib/brand-data-store'
import { requirePermission } from '@/lib/permissions/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const uploadGuard = await requirePermission(session, 'brandContact.upload', '无权下载品牌对接信息上传模板')
  if (!uploadGuard.ok) return uploadGuard.response

  const type = new URL(req.url).searchParams.get('type') || 'contact'
  if (type !== 'contact') return NextResponse.json({ error: '资料类型无效' }, { status: 400 })

  const view = await getContactView(session)
  if (!view) return NextResponse.json({ error: '无权下载品牌对接信息模板' }, { status: 403 })

  try {
    const template = new Uint8Array(readFileSync(getBrandTemplatePath('contact')))
    return new NextResponse(template, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': "attachment; filename*=UTF-8''%E5%93%81%E7%89%8C%E5%AF%B9%E6%8E%A5%E4%BF%A1%E6%81%AF-%E4%B8%8A%E4%BC%A0%E6%A8%A1%E6%9D%BF.xlsx",
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: '品牌对接信息模板不存在' }, { status: 404 })
    }
    console.error('[BrandTemplateReadError]', error)
    return NextResponse.json({ error: '品牌对接信息模板读取失败' }, { status: 500 })
  }
}
