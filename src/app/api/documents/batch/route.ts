import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { requirePermission, requireAnyPermission } from '@/lib/permissions/guards'

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const batchGuard = await requirePermission(session, 'document.batchManage', '你没有批量管理文档的权限')
  if (!batchGuard.ok) return batchGuard.response

  const { action, ids, folderId } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No document IDs provided' }, { status: 400 })
  }

  if (action === 'delete') {
    const deleteGuard = await requirePermission(session, 'document.delete', '你没有批量删除文档的权限')
    if (!deleteGuard.ok) return deleteGuard.response
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
    const moveGuard = await requireAnyPermission(session, ['document.edit'], '你没有批量移动文档的权限')
    if (!moveGuard.ok) return moveGuard.response
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
