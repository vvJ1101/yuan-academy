import { NextRequest, NextResponse } from 'next/server'
import { canEditPolicy, getSessionFromCookiesAsync } from '@/lib/auth'
import { logPolicyChange } from '@/lib/audit'
import { readPolicyPayload, writePolicies } from '@/lib/policy-store'
import XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookiesAsync(req.headers.get('cookie'))
  if (!session?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }
  if (!canEditPolicy(session)) {
    return NextResponse.json({ error: '无权修改订货政策' }, { status: 403 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: '上传请求格式错误' }, { status: 400 })
  }
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: '请选择 Excel 文件' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return NextResponse.json({ error: 'Excel 中没有工作表' }, { status: 400 })
    }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
    if (rows.length < 2) {
      return NextResponse.json({ error: 'Excel 中没有政策数据' }, { status: 400 })
    }

    const policies: Record<string, string>[] = []
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const brand = String(row[2] || '').trim()
      if (!brand || brand.startsWith('←') || brand.startsWith('[例]')) continue
      policies.push({
        category: String(row[0] || '').trim(),
        country: String(row[1] || '').trim(),
        brand,
        style: String(row[3] || '').trim(),
        priceRange: String(row[4] || '').trim(),
        series: String(row[5] || '').trim(),
        policy: String(row[6] || '').trim(),
        delivery: String(row[7] || '').trim(),
      })
    }

    const existing = readPolicyPayload().policies
    const map = new Map(existing.map(policy => [String(policy.brand || ''), policy]))
    let updated = 0
    let added = 0
    for (const policy of policies) {
      if (map.has(policy.brand)) updated++
      else added++
      map.set(policy.brand, policy)
    }
    const merged = Array.from(map.values())
    writePolicies(merged, session.name || '未知用户')
    await logPolicyChange(session.id, 'policy:upload')

    return NextResponse.json({
      ok: true,
      count: merged.length,
      updated,
      added,
      brands: merged.map(policy => String(policy.brand || '')),
    })
  } catch (error) {
    console.error('[PolicyUploadError]', error)
    return NextResponse.json({ error: '订货政策上传失败，请检查 Excel 格式' }, { status: 500 })
  }
}
