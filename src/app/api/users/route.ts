import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'
import { clearPermissionCache } from '@/lib/permissions/rbac'
import { hash } from 'bcryptjs'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'menu.admin.users', '无权查看用户管理')
  if (!guard.ok) return guard.response

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
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'user.create', '无权新建用户')
  if (!guard.ok) return guard.response

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
      await (prisma as any).userCompany.create({ data: { userId: user.id, companyId: cid } }).catch((err: any) => console.error("[AuditLogError]", err))
    }
  }
  prisma.auditLog.create({ data: { userId: session!.id, action: "user:create" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json(user, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'user.edit', '无权编辑用户')
  if (!guard.ok) return guard.response

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

  // ── 审计日志：管理员重置密码 ──
  if (password) {
    try {
      await prisma.auditLog.create({
        data: { userId: session!.id, action: `admin_reset_password:${id}` },
      })
    } catch {
      console.error('[AUDIT] 管理员重置密码审计日志写入失败')
    }
  }

  // Sync multi-company memberships
  if (Array.isArray(companyIds)) {
    await (prisma as any).userCompany.deleteMany({ where: { userId: id } })
    for (const cid of companyIds) {
      await (prisma as any).userCompany.create({ data: { userId: id, companyId: cid } }).catch((err: any) => console.error("[AuditLogError]", err))
    }
  }
  clearPermissionCache(id)
  prisma.auditLog.create({ data: { userId: session!.id, action: "user:update" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'user.delete', '无权删除用户')
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  await (prisma as any).userCompany.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })
  clearPermissionCache(id)
  prisma.auditLog.create({ data: { userId: session!.id, action: "user:delete" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json({ ok: true })
}
