import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const role = await prisma.sysRole.findUnique({ where: { id: params.id } })
  if (!role) return NextResponse.json({ code: 404, message: 'Not found' }, { status: 404 })
  return NextResponse.json({
    code: 0, data: {
      id: role.id, name: role.name, code: role.code, description: role.description || '',
      dataScope: ['ALL','SELF_AND_CHILDREN','SELF','PERSONAL','CUSTOM'][role.dataScope - 1],
      createTime: role.createdAt.toISOString(), status: role.status === 1 ? 'active' : 'disabled',
    }
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.description !== undefined) data.description = body.description
  if (body.status !== undefined) data.status = body.status === 'disabled' ? 0 : 1
  await prisma.sysRole.update({ where: { id: params.id }, data })
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:update" } }).catch(() => {})
  return NextResponse.json({ code: 0, message: '更新成功' })


}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const userCount = await prisma.sysUserRole.count({ where: { roleId: params.id } })
  if (userCount > 0) {
    return NextResponse.json({ code: 400, message: '该角色下存在用户，无法删除' }, { status: 400 })
  }
  await prisma.sysRole.delete({ where: { id: params.id } })
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:delete" } }).catch(() => {})
  return NextResponse.json({ code: 0, message: '删除成功' })


}
