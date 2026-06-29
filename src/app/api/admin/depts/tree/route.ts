import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })

  const all = await prisma.sysDept.findMany({ orderBy: { sort: 'asc' } })
  const map = new Map<string, any>()
  const roots: any[] = []
  for (const d of all) { map.set(d.id, { ...d, children: [] }) }
  for (const d of all) {
    const node = map.get(d.id)
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId)!.children.push(node)
    } else { roots.push(node) }
  }
  return NextResponse.json({ code: 0, data: roots })
}
