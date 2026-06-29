import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { canReadDocument } from '@/lib/permissions/documents'
import { getDocumentPermission } from '@/lib/permissions/folders'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify document exists and user has read permission
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, ownerDeptId: true, folderId: true, audiences: { select: { departmentId: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const folderPerm = doc.folderId ? await getDocumentPermission(session, doc.folderId) : null
  if (!canReadDocument(session, doc, folderPerm)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const filePath = join(process.cwd(), 'public', 'uploads', 'documents', params.id, 'original.docx')
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Original file not found' }, { status: 404 })
  }
  const buffer = readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="document-${params.id}.docx"`,
    },
  })
}
