import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions/guards'

// GET /api/users/:id/companies — get user's company memberships
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  const guard = await requirePermission(session, 'menu.admin.users', '无权查看用户公司归属')
  if (!guard.ok) return guard.response

  const memberships = await (prisma as any).userCompany.findMany({
    where: { userId: (await params).id },
    select: { companyId: true },
  })

  return NextResponse.json({ companyIds: memberships.map((m: any) => m.companyId) })
}
