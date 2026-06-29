import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

// GET /api/users/:id/companies — get user's company memberships
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const memberships = await (prisma as any).userCompany.findMany({
    where: { userId: params.id },
    select: { companyId: true },
  })

  return NextResponse.json({ companyIds: memberships.map((m: any) => m.companyId) })
}
