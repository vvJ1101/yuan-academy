import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions/rbac'

function roleLabel(role: string) {
  if (role === 'super_admin') return '超级管理员'
  if (role === 'dept_admin') return '部门管理员'
  if (role === 'editor') return '编辑'
  return '员工'
}

function formatScope(items: string[], fallback: string) {
  return items.length > 0 ? items.join('、') : fallback
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  try {
    const { permissions, dataScope } = await getUserPermissions(session)
    const canManageAll = permissions.includes('*') || session.role === 'super_admin'
    const canEdit = canManageAll || permissions.some(p => (
      p.includes('edit') ||
      p.includes('upload') ||
      p.includes('create') ||
      p.includes('delete') ||
      p.includes('manage')
    ))

    const companyScope = formatScope(dataScope.companies || [], session.companyName || '当前公司')
    const deptScope = formatScope(dataScope.departments || [], session.departmentName || '当前部门')

    return NextResponse.json({
      accessibleRange: canManageAll
        ? '全部公司、部门与知识空间'
        : `${companyScope} / ${deptScope}`,
      editableRange: canEdit
        ? (canManageAll ? '全部可管理内容' : '授权范围内可编辑内容')
        : '暂无编辑权限',
      role: roleLabel(session.role),
    })
  } catch {
    return NextResponse.json({ error: '读取权限范围失败，请稍后重试' }, { status: 500 })
  }
}
