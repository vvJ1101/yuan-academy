import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'

// POST — record a view event
export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId, action } = await req.json()
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  await prisma.auditLog.create({
    data: { userId: session.id, documentId: documentId || null, action },
  })

  return NextResponse.json({ ok: true })
}

// GET — recent activity (admin only)
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const logs = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true } },
      document: { select: { title: true } },
    },
  })

  return NextResponse.json(logs.map(l => ({
    id: l.id,
    user: l.user.name,
    document: l.document?.title || '—',
    action: l.action,
    time: l.createdAt,
  })))
}
