import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const department = searchParams.get('department')
  const dtype = searchParams.get('dtype')

  const where: any = {}
  if (department && department !== 'all') {
    where.department = { slug: department }
  }
  if (dtype) {
    where.category = { contains: `|${dtype}` }
  }

  const faqs = await prisma.faq.findMany({
    where,
    include: { department: { select: { name: true, slug: true } } },
    orderBy: [{ departmentId: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(faqs)
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'staff') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { question, answer, departmentId, category } = body

  if (!question || !answer) {
    return NextResponse.json({ success: false, error: 'question and answer required' }, { status: 400 })
  }

  // dept_admin: only create FAQ for own department
  if (session.role === 'dept_admin') {
    if (!session.departmentId || session.departmentId !== departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden: can only create FAQ for your department' }, { status: 403 })
    }
  }

  // Get max order for department
  const last = await prisma.faq.findFirst({
    where: { departmentId: departmentId || session.departmentId },
    orderBy: { order: 'desc' },
  })

  const faq = await prisma.faq.create({
    data: {
      question,
      answer,
      departmentId: departmentId || session.departmentId || '',
      category: category || 'general',
      order: (last?.order ?? -1) + 1,
    },
    include: { department: { select: { name: true, slug: true } } },
  })

  return NextResponse.json({ success: true, data: faq }, { status: 201 })
}
