import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { logEdit } from '@/lib/audit'
import { requirePermission } from '@/lib/permissions/guards'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'learningPath.edit', '你没有编辑学习路径的权限')
  if (!guard.ok) return guard.response
  const activeSession = session!

  const routeParams = await params
  const existing = await prisma.learningPath.findUnique({ where: { id: routeParams.id } })
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { title, deptId, docIds } = body

  if (!title) return NextResponse.json({ success: false, error: 'Title required' }, { status: 400 })

  // Full replacement strategy
  const updated = await prisma.learningPath.update({
    where: { id: routeParams.id },
    data: {
      title,
      deptId: deptId || existing.deptId,
      docIds: JSON.stringify(Array.isArray(docIds) ? docIds : []),
    },
  })

  // Audit log
  logEdit(activeSession.id, routeParams.id).catch((err: any) => console.error("[AuditLogError]", err))

  // Resolve docs for response
  let docIdList: string[] = []
  try { docIdList = JSON.parse(updated.docIds || '[]') } catch {}
  const docs = docIdList.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: docIdList } },
        select: { id: true, title: true, slug: true, category: true,
          ownerDept: { select: { name: true } } },
      })
    : []
  const docMap = new Map(docs.map(d => [d.id, d]))
  const ordered = docIdList.map(id => docMap.get(id)).filter(Boolean)

  return NextResponse.json({ success: true, data: { ...updated, docs: ordered, docCount: ordered.length } })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'learningPath.delete', '你没有删除学习路径的权限')
  if (!guard.ok) return guard.response
  const activeSession = session!

  const routeParams = await params
  const existing = await prisma.learningPath.findUnique({ where: { id: routeParams.id } })
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  await prisma.learningPath.delete({ where: { id: routeParams.id } })
  prisma.auditLog.create({ data: { userId: activeSession.id, action: 'learningPath:delete' } }).catch((err: any) => console.error('[AuditLogError]', err))
  return NextResponse.json({ success: true })
}
