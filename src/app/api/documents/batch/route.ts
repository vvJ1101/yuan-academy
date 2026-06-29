import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin' && session.role !== 'dept_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action, ids, folderId } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No document IDs provided' }, { status: 400 })
  }

  if (action === 'delete') {
    let deleted = 0
    for (const id of ids) {
      try {
        await prisma.documentAudience.deleteMany({ where: { documentId: id } })
        await prisma.auditLog.deleteMany({ where: { documentId: id } })
        await prisma.document.delete({ where: { id } })
        deleted++
      } catch { /* skip docs that can't be deleted */ }
    }
    return NextResponse.json({ ok: true, deleted })
  }

  if (action === 'move') {
    let moved = 0
    for (const id of ids) {
      try {
        await prisma.document.update({
          where: { id },
          data: { folderId: folderId || null },
        })
        moved++
      } catch { /* skip */ }
    }
    return NextResponse.json({ ok: true, moved })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
