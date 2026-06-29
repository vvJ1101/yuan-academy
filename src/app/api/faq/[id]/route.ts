import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'staff') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const faq = await prisma.faq.findUnique({ where: { id: params.id } })
  if (!faq) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  // dept_admin: only edit own department's FAQ
  if (session.role === 'dept_admin') {
    if (!session.departmentId || faq.departmentId !== session.departmentId) {
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
    if (session.role === 'dept_admin' && departmentId !== faq.departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden: cannot change FAQ department' }, { status: 403 })
    }
    data.departmentId = departmentId
  }
  if (category !== undefined) data.category = category
  if (order !== undefined) data.order = order

  const updated = await prisma.faq.update({
    where: { id: params.id },
    data,
    include: { department: { select: { name: true, slug: true } } },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'staff') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const faq = await prisma.faq.findUnique({ where: { id: params.id } })
  if (!faq) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  // dept_admin: only delete own department's FAQ
  if (session.role === 'dept_admin') {
    if (!session.departmentId || faq.departmentId !== session.departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden: can only delete your department FAQ' }, { status: 403 })
    }
  }

  await prisma.faq.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
