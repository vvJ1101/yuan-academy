import { readFileSync } from 'node:fs'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookiesAsync } from '@/lib/auth'
import { getPolicyTemplatePath } from '@/lib/policy-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookiesAsync(request.headers.get('cookie'))
  if (!session?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  try {
    const template = new Uint8Array(readFileSync(getPolicyTemplatePath()))
    return new NextResponse(template, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': "attachment; filename*=UTF-8''%E8%AE%A2%E8%B4%A7%E6%94%BF%E7%AD%96-%E4%B8%8A%E4%BC%A0%E6%A8%A1%E6%9D%BF.xlsx",
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: '订货政策模板不存在' }, { status: 404 })
    }
    console.error('[PolicyTemplateReadError]', error)
    return NextResponse.json({ error: '订货政策模板读取失败' }, { status: 500 })
  }
}
