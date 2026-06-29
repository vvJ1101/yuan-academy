import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { canReadDocument } from '@/lib/permissions/documents'

/** GET /api/documents/[id]/history — list edit history for a document */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user can read this document
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: {
      id: true, ownerDeptId: true, folderId: true,
      audiences: { select: { departmentId: true } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canReadDocument(session, doc as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const history = await (prisma as any).documentHistory.findMany({
    where: { documentId: params.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ history })
}
