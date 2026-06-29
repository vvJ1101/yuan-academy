import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { policies } = await req.json()
  if (!Array.isArray(policies)) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  for (const dir of ['public/data', 'public/showroom/data']) {
    const d = join(process.cwd(), dir)
    mkdirSync(d, { recursive: true })
    const p = join(d, 'policies.json')
    if (existsSync(p)) copyFileSync(p, join(d, 'policies.backup.json'))
    writeFileSync(p, JSON.stringify(policies, null, 2), 'utf-8')
    writeFileSync(join(d, 'policies.updated.json'), JSON.stringify({ updatedAt: new Date().toISOString() }), 'utf-8')
  }
  return NextResponse.json({ ok: true, count: policies.length })
}
