import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SCOPE_MAP: Record<string, number> = {
  ALL: 1, SELF_AND_CHILDREN: 2, SELF: 3, PERSONAL: 4, CUSTOM: 5,
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  const role = await prisma.sysRole.findUnique({ where: { id: params.id }, select: { dataScope: true, customDeptIds: true } })
  if (!role) return NextResponse.json({ code: 404, message: 'Not found' }, { status: 404 })
  const labels = ['', 'ALL', 'SELF_AND_CHILDREN', 'SELF', 'PERSONAL', 'CUSTOM']
  return NextResponse.json({
    code: 0,
    data: { dataScope: labels[role.dataScope] || 'SELF_AND_CHILDREN', customDeptIds: JSON.parse(role.customDeptIds || '[]') }
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const dataScope = SCOPE_MAP[body.dataScope] || 2
  // 记录审计日志（必须在 return 之前）
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:datascope" } }).catch(() => {})
  await prisma.sysRole.update({
    where: { id: params.id },
    data: { dataScope, customDeptIds: JSON.stringify(body.customDeptIds || []) },
  })
  return NextResponse.json({ code: 0, message: '数据权限更新成功' })

}
