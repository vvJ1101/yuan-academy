import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function forbid() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const companySlug = searchParams.get('company')

  const where: Record<string, unknown> = {}
  if (companySlug) {
    where.company = { slug: companySlug }
  }

  const depts = await prisma.department.findMany({
    where,
    select: {
      id: true, name: true, slug: true,
      companyId: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(depts)
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { name, slug, companyId, description } = await req.json()
  if (!name || !slug || !companyId) return NextResponse.json({ error: 'Name, slug and companyId required' }, { status: 400 })

  const existing = await prisma.department.findFirst({
    where: { companyId, slug },
  })
  if (existing) return NextResponse.json({ error: 'Department slug already exists in this company' }, { status: 409 })

  const dept = await prisma.department.create({
    data: { name, slug, companyId, description: description || '' },
    select: {
      id: true, name: true, slug: true, companyId: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { users: true } },
    },
  })
  return NextResponse.json(dept, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { id, name, slug, companyId, description } = await req.json()
  if (!id) return NextResponse.json({ error: 'Department ID required' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (slug !== undefined) data.slug = slug
  if (companyId !== undefined) data.companyId = companyId
  if (description !== undefined) data.description = description

  const dept = await prisma.department.update({
    where: { id }, data,
    select: {
      id: true, name: true, slug: true, companyId: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { users: true } },
    },
  })
  return NextResponse.json(dept)
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Department ID required' }, { status: 400 })

  await prisma.department.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
