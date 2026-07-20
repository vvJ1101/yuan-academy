import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'faq.edit', '你没有编辑 FAQ 的权限')
  if (!guard.ok) return guard.response
  const activeSession = session!

  const routeParams = await params
  const faq = await prisma.faq.findUnique({ where: { id: routeParams.id } })
  if (!faq) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  // dept_admin: only edit own department's FAQ
  if (activeSession.role === 'dept_admin') {
    if (!activeSession.departmentId || faq.departmentId !== activeSession.departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden: can only edit your department FAQ' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const { question, answer, departmentId, category, order } = body

  const data: any = {}
  if (question !== undefined) data.question = question
  if (answer !== undefined) data.answer = answer
  if (departmentId !== undefined) {
    // dept_admin cannot change department
    if (activeSession.role === 'dept_admin' && departmentId !== faq.departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden: cannot change FAQ department' }, { status: 403 })
    }
    data.departmentId = departmentId
  }
  if (category !== undefined) data.category = category
  if (order !== undefined) data.order = order

  const updated = await prisma.faq.update({
    where: { id: routeParams.id },
    data,
    include: { department: { select: { name: true, slug: true } } },
  })

  prisma.auditLog.create({ data: { userId: activeSession.id, action: 'faq:update' } }).catch((err: any) => console.error('[AuditLogError]', err))
  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'faq.delete', '你没有删除 FAQ 的权限')
  if (!guard.ok) return guard.response
  const activeSession = session!

  const routeParams = await params
  const faq = await prisma.faq.findUnique({ where: { id: routeParams.id } })
  if (!faq) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  // dept_admin: only delete own department's FAQ
  if (activeSession.role === 'dept_admin') {
    if (!activeSession.departmentId || faq.departmentId !== activeSession.departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden: can only delete your department FAQ' }, { status: 403 })
    }
  }

  await prisma.faq.delete({ where: { id: routeParams.id } })
  prisma.auditLog.create({ data: { userId: activeSession.id, action: 'faq:delete' } }).catch((err: any) => console.error('[AuditLogError]', err))
  return NextResponse.json({ success: true })
}
