import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })

  const all = await prisma.sysMenu.findMany({
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  })

  // Build tree from flat list
  const map = new Map<string, any>()
  const roots: any[] = []
  for (const m of all) {
    const node = { ...m, children: [] as any[] }
    map.set(m.id, node)
  }
  for (const m of all) {
    const node = map.get(m.id)
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return NextResponse.json({ code: 0, data: roots })
}
