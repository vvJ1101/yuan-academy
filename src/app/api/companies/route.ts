import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function forbid() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
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
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { name, slug, description } = await req.json()
  if (!name || !slug) return NextResponse.json({ error: 'Name and slug required' }, { status: 400 })

  const existing = await prisma.company.findFirst({ where: { OR: [{ name }, { slug }] } })
  if (existing) return NextResponse.json({ error: 'Company name or slug already exists' }, { status: 409 })

  const company = await prisma.company.create({
    data: { name, slug, description: description || '' },
    select: { id: true, name: true, slug: true, description: true,
      _count: { select: { departments: true, users: true } } },
  })
  return NextResponse.json(company, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

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
  return NextResponse.json(company)
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Company ID required' }, { status: 400 })

  await prisma.company.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
