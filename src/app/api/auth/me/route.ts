import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get visible department IDs for permission checks
  let deptIds: string[] = []
  if (session.role === 'super_admin') {
    const depts = await prisma.department.findMany({ select: { id: true } })
    deptIds = depts.map(d => d.id)
  } else if (session.companyId) {
    const depts = await prisma.department.findMany({
      where: { companyId: session.companyId },
      select: { id: true },
    })
    deptIds = depts.map(d => d.id)
  } else if (session.departmentId) {
    deptIds = [session.departmentId]
  }

  // 🆕 Get user's multi-company memberships
  const userCompanies = await (prisma as any).userCompany.findMany({
    where: { userId: session.id },
    include: { company: { select: { id: true, name: true, slug: true } } },
  })

  // Compute RBAC permissions
  const { getUserPermissions } = await import('@/lib/permissions/rbac')
  const rbac = await getUserPermissions(session)

  return NextResponse.json({
    id: session.id,
    name: (session as any).name || '',
    role: session.role,
    companyId: session.companyId,
    companyName: session.companyName || '',
    departmentId: session.departmentId,
    departmentName: session.departmentName || '',
    allowedDeptIds: deptIds,
    permissions: rbac.permissions,
    dataScope: rbac.dataScope,
    companies: userCompanies.map((uc: { company: { id: string; name: string; slug: string }; role: string }) => ({ id: uc.company.id, name: uc.company.name, slug: uc.company.slug, role: uc.role })),
  })
}
