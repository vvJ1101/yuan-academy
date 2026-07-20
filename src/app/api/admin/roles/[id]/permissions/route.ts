import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'
import { clearPermissionCache } from '@/lib/permissions/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'role.assignPermission', '无权查看角色权限')
  if (!guard.ok) return guard.response
  const rows = await prisma.sysRoleMenu.findMany({ where: { roleId: routeParams.id }, select: { menuId: true } })
  return NextResponse.json({ code: 0, data: rows.map(r => r.menuId) })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'role.assignPermission', '无权分配角色权限')
  if (!guard.ok) return guard.response
  const body = await req.json()
  const menuIds: string[] = body.permissionIds || body.menuIds || []
  // 记录审计日志（必须在 return 之前）
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:permissions" } }).catch((err: any) => console.error("[AuditLogError]", err))
  await prisma.$transaction([
    prisma.sysRoleMenu.deleteMany({ where: { roleId: routeParams.id } }),
    ...menuIds.map(menuId => prisma.sysRoleMenu.create({ data: { roleId: routeParams.id, menuId } })),
  ])
  clearPermissionCache()
  return NextResponse.json({ code: 0, message: '权限分配成功' })

}
