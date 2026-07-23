import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'
import { clearPermissionCache } from '@/lib/permissions/rbac'

export const dynamic = 'force-dynamic'

const SCOPE_MAP: Record<string, number> = {
  ALL: 1, SELF_AND_CHILDREN: 2, SELF: 3, PERSONAL: 4, CUSTOM: 5,
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'role.assignDataScope', '无权查看角色数据权限')
  if (!guard.ok) return guard.response
  const role = await prisma.sysRole.findUnique({ where: { id: (await params).id }, select: { dataScope: true, customDeptIds: true } })
  if (!role) return NextResponse.json({ code: 404, message: 'Not found' }, { status: 404 })
  const labels = ['', 'ALL', 'SELF_AND_CHILDREN', 'SELF', 'PERSONAL', 'CUSTOM']
  return NextResponse.json({
    code: 0,
    data: { dataScope: labels[role.dataScope] || 'SELF_AND_CHILDREN', customDeptIds: JSON.parse(role.customDeptIds || '[]') }
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'role.assignDataScope', '无权分配数据权限')
  if (!guard.ok) return guard.response
  const body = await req.json()
  const dataScope = SCOPE_MAP[body.dataScope] || 2
  // 记录审计日志（必须在 return 之前）
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:datascope" } }).catch((err: any) => console.error("[AuditLogError]", err))
  await prisma.sysRole.update({
    where: { id: (await params).id },
    data: { dataScope, customDeptIds: JSON.stringify(body.customDeptIds || []) },
  })
  clearPermissionCache()
  return NextResponse.json({ code: 0, message: '数据权限更新成功' })

}
