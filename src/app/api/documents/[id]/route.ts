import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { canReadDocument, canEditDocument, canDeleteDocument } from '@/lib/permissions/documents'
import { getDocumentPermission } from '@/lib/permissions/folders'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { sanitizeMarkdown } from '@/lib/sanitize'
import { logEdit } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      ownerDept: { select: { name: true, slug: true } },
      audiences: { include: { department: { select: { name: true, slug: true } } } },
      author: { select: { name: true } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // READ check: audience OR ownerDept OR super_admin
  if (!canReadDocument(session, doc)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Return both fullContent and condensedContent, remap for frontend, include userPermission
  let userPermission: string | null = null
  if (session.role === 'super_admin') {
    userPermission = 'admin'
  } else {
    try { userPermission = await getDocumentPermission(session, params.id) } catch {}
    if (!userPermission && doc.ownerDeptId === session.departmentId) {
      userPermission = session.role === 'dept_admin' ? 'admin' : 'edit'
    }
  }
  const { fullContent, condensedContent, ...rest } = doc
  return NextResponse.json({ ...rest, content: fullContent, fullContent, condensedContent: condensedContent || '', userPermission })
}

// PUT — Edit document metadata
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { ownerDept: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Use full permission engine (folder inherit + doc override + legacy + policy check)
  let userPerm: string | null = null
  try { userPerm = await getDocumentPermission(session, params.id) } catch {}
  if (!canEditDocument(session, doc.ownerDeptId, undefined, doc.category) && !(userPerm && ['edit', 'delete', 'admin'].includes(userPerm))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, category, ownerDeptId, audienceIds, content, folderId, remark } = body

  const data: Record<string, unknown> = {}
  if (title) {
    data.title = title
    data.slug = title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200)
  }
  if (category) data.category = category
  if (ownerDeptId) data.ownerDeptId = ownerDeptId
  if (folderId !== undefined) data.folderId = folderId || null
  if (content !== undefined) data.fullContent = typeof content === 'string' ? content.substring(0, 100000) : undefined
  // Sync fullContent → content for backward compat
  if (data.fullContent) data.content = (data.fullContent as string).substring(0, 100000)
  if (body.condensedContent !== undefined) {
    const raw = typeof body.condensedContent === 'string' ? body.condensedContent.substring(0, 100000) : ''
    data.condensedContent = sanitizeMarkdown(raw)
    // Auto-set displayMode when condensed is provided
    if (data.condensedContent) data.displayMode = 'both'
  }

  // Update audiences if provided
  if (audienceIds !== undefined) {
    await prisma.documentAudience.deleteMany({ where: { documentId: params.id } })
    if (audienceIds.length > 0) {
      await Promise.all(audienceIds.map((deptId: string) =>
        prisma.documentAudience.create({ data: { documentId: params.id, departmentId: deptId } })
          .catch(() => {})
      ))
    }
  }

  const updated = await prisma.document.update({
    where: { id: params.id },
    data,
    include: {
      ownerDept: { select: { name: true, slug: true } },
      audiences: { include: { department: { select: { name: true, slug: true } } } },
      author: { select: { name: true } },
    },
  })

  // ── Auto-create DocumentHistory when content is modified ──
  if (content !== undefined) {
    await (prisma as any).documentHistory.create({
      data: {
        documentId: params.id,
        content: (typeof content === 'string' ? content.substring(0, 100000) : doc.fullContent) || '',
        editorId: session.id,
        editorName: session.name || session.departmentName || 'Unknown',
        remark: remark || null,
      },
    }).catch((err: Error) => console.error('[DocumentHistory] Failed to create:', err.message))
  }

  // ── Audit log ──
  logEdit(session.id, params.id)

  return NextResponse.json(updated)
}

// DELETE — Delete document
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, ownerDeptId: true, folderId: true, category: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Use full permission engine (folder inherit + doc override + legacy + policy check)
  let userPermDel: string | null = null
  try { userPermDel = await getDocumentPermission(session, params.id) } catch {}
  if (!canDeleteDocument(session, doc.ownerDeptId, undefined, doc.category) && !(userPermDel && ['delete', 'admin'].includes(userPermDel))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete related records
  await prisma.documentAudience.deleteMany({ where: { documentId: params.id } })
  await prisma.auditLog.deleteMany({ where: { documentId: params.id } })
  await prisma.document.delete({ where: { id: params.id } })

  // Delete uploaded images
  const imgDir = join(process.cwd(), 'public', 'uploads', 'documents', params.id)
  if (existsSync(imgDir)) {
    try { rmSync(imgDir, { recursive: true }) } catch {}
  }

  return NextResponse.json({ ok: true })
}
