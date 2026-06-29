import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, canManageUsers } from '@/lib/auth'
import { hash } from 'bcryptjs'

function forbid() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || !canManageUsers(session)) return forbid()

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true,
      companyId: true,
      company: { select: { id: true, name: true, slug: true } },
      departmentId: true,
      department: { select: { name: true, slug: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { email, name, password, role, companyId, departmentId, companyIds } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  const user = await prisma.user.create({
    data: {
      email, name: name || email.split('@')[0], passwordHash: await hash(password, 12),
      role: role || 'staff', companyId: companyId || null, departmentId: departmentId || null,
    },
    select: { id: true, email: true, name: true, role: true, companyId: true, departmentId: true },
  })
  // Sync multi-company memberships
  if (Array.isArray(companyIds) && companyIds.length > 0) {
    for (const cid of companyIds) {
      await (prisma as any).userCompany.create({ data: { userId: user.id, companyId: cid } }).catch(() => {})
    }
  }
  return NextResponse.json(user, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { id, name, role, companyId, departmentId, password, companyIds } = await req.json()
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (role !== undefined) data.role = role
  if (companyId !== undefined) data.companyId = companyId || null
  if (departmentId !== undefined) data.departmentId = departmentId || null
  if (password) data.passwordHash = await hash(password, 12)
  const user = await prisma.user.update({
    where: { id }, data,
    select: { id: true, email: true, name: true, role: true, companyId: true, departmentId: true },
  })
  // Sync multi-company memberships
  if (Array.isArray(companyIds)) {
    await (prisma as any).userCompany.deleteMany({ where: { userId: id } })
    for (const cid of companyIds) {
      await (prisma as any).userCompany.create({ data: { userId: id, companyId: cid } }).catch(() => {})
    }
  }
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') return forbid()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  await (prisma as any).userCompany.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
