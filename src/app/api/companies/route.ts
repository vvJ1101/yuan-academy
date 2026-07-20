import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companies = await prisma.company.findMany({
    select: {
      id: true, name: true, slug: true, description: true,
      _count: { select: { departments: true, users: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'org.companyCreate', '无权添加公司')
  if (!guard.ok) return guard.response

  const { name, slug, description } = await req.json()
  if (!name || !slug) return NextResponse.json({ error: 'Name and slug required' }, { status: 400 })

  const existing = await prisma.company.findFirst({ where: { OR: [{ name }, { slug }] } })
  if (existing) return NextResponse.json({ error: 'Company name or slug already exists' }, { status: 409 })

  const company = await prisma.company.create({
    data: { name, slug, description: description || '' },
    select: { id: true, name: true, slug: true, description: true,
      _count: { select: { departments: true, users: true } } },
  })
  prisma.auditLog.create({ data: { userId: session!.id, action: "company:create" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json(company, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'org.companyEdit', '无权编辑公司')
  if (!guard.ok) return guard.response

  const { id, name, slug, description } = await req.json()
  if (!id) return NextResponse.json({ error: 'Company ID required' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (slug !== undefined) data.slug = slug
  if (description !== undefined) data.description = description

  const company = await prisma.company.update({
    where: { id }, data,
    select: { id: true, name: true, slug: true, description: true,
      _count: { select: { departments: true, users: true } } },
  })
  prisma.auditLog.create({ data: { userId: session!.id, action: "company:update" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json(company)
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'org.companyDelete', '无权删除公司')
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Company ID required' }, { status: 400 })

  await prisma.company.delete({ where: { id } })
  prisma.auditLog.create({ data: { userId: session!.id, action: "company:delete" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json({ ok: true })
}
