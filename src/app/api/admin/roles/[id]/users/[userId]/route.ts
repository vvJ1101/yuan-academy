import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'
import { clearPermissionCache } from '@/lib/permissions/rbac'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const routeParams = await params
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'role.removeUser', '无权移除角色用户')
  if (!guard.ok) return guard.response
  await prisma.sysUserRole.deleteMany({ where: { roleId: routeParams.id, userId: routeParams.userId } })
  clearPermissionCache(routeParams.userId)
  prisma.auditLog.create({ data: { userId: session!.id, action: "roleUser:remove" } }).catch((err: any) => console.error("[AuditLogError]", err))
  return NextResponse.json({ code: 0, message: '已移除用户' })
}
