import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return NextResponse.json({ error: 'Empty sheet' }, { status: 400 })
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
  if (rows.length < 2) return NextResponse.json({ error: 'No data' }, { status: 400 })

  const policies: Record<string, string>[] = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    const brand = String(r[2] || '').trim()
    if (!brand) continue
    if (brand.startsWith('←') || brand.startsWith('[例]')) continue
    policies.push({ category: String(r[0]||'').trim(), country: String(r[1]||'').trim(), brand, style: String(r[3]||'').trim(), priceRange: String(r[4]||'').trim(), series: String(r[5]||'').trim(), ss26: String(r[6]||'').trim(), aw26: String(r[7]||'').trim(), delivery: String(r[8]||'').trim(), nonCutoff: String(r[9]||'').trim(), pr: String(r[10]||'').trim() })
  }

  // Merge with existing
  const outDir = join(process.cwd(), 'public', 'data')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'policies.json')
  let existing: Record<string, any>[] = []
  if (existsSync(outPath)) { try { existing = JSON.parse(readFileSync(outPath, 'utf-8')) } catch {} }
  const map = new Map(existing.map((p: any) => [p.brand, p]))
  let updated = 0, added = 0
  for (const p of policies) {
    if (map.has(p.brand)) { map.set(p.brand, p); updated++ }
    else { map.set(p.brand, p); added++ }
  }
  const merged = Array.from(map.values())

  for (const dir of ['public/data', 'public/showroom/data']) {
    const d = join(process.cwd(), dir)
    mkdirSync(d, { recursive: true })
    const p = join(d, 'policies.json')
    if (existsSync(p)) copyFileSync(p, join(d, 'policies.backup.json'))
    writeFileSync(p, JSON.stringify(merged, null, 2), 'utf-8')
    writeFileSync(join(d, 'policies.updated.json'), JSON.stringify({ updatedAt: new Date().toISOString() }), 'utf-8')
  }

  return NextResponse.json({ ok: true, count: merged.length, updated, added, brands: merged.map((p: any) => p.brand) })
}
