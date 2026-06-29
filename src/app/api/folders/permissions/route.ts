import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { clearPermCache } from '@/lib/permissions/folders'

// GET /api/folders/permissions?folderId=xxx
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const folderId = searchParams.get('folderId')
  if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })

  const perms = await prisma.folderPermission.findMany({
    where: { folderId },
    include: {
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ permissions: perms })
}

// POST /api/folders/permissions — add permission rule
export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session || (session.role !== 'super_admin' && session.role !== 'dept_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { folderId, companyId, departmentId, userId, role, permission } = await req.json().catch(() => ({}))
  if (!folderId || !permission) return NextResponse.json({ error: 'folderId and permission required' }, { status: 400 })
  if (!companyId && !departmentId && !userId && !role) return NextResponse.json({ error: 'At least one target required (companyId, departmentId, userId, or role)' }, { status: 400 })

  const perm = await prisma.folderPermission.create({
    data: {
      folderId,
      companyId: companyId || null,
      departmentId: departmentId || null,
      userId: userId || null,
      role: role || null,
      permission,
    },
    include: {
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  clearPermCache()
  return NextResponse.json({ permission: perm }, { status: 201 })
}

// DELETE /api/folders/permissions?id=xxx
export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session || (session.role !== 'super_admin' && session.role !== 'dept_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.folderPermission.delete({ where: { id } })
  clearPermCache()
  return NextResponse.json({ ok: true })
}
