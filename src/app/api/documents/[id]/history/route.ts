import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { canReadDocument } from '@/lib/permissions/documents'
import { requirePermission } from '@/lib/permissions/guards'

/** GET /api/documents/[id]/history — list edit history for a document */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'document.historyView', '你没有查看文档历史记录的权限')
  if (!guard.ok) return guard.response

  const activeSession = session!

  // Verify user can read this document
  const doc = await prisma.document.findUnique({
    where: { id: (await params).id },
    select: {
      id: true, ownerDeptId: true, folderId: true,
      audiences: { select: { departmentId: true } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canReadDocument(activeSession, doc as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const history = await (prisma as any).documentHistory.findMany({
    where: { documentId: (await params).id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ history })
}
