import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })

  const rbac = await getUserPermissions(session)

  return NextResponse.json({
    code: 0,
    data: {
      permissions: rbac.permissions,
      dataScope: rbac.dataScope,
      menuIds: [],
      roles: [],
    }
  })
}
