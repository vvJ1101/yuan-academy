import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

/** GET /api/bookmarks — list user's bookmarked documents */
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
  })

  const docIds = bookmarks.map(b => b.documentId)
  const docs = docIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, title: true, slug: true, category: true,
          ownerDept: { select: { name: true } },
          audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      })
    : []

  // Preserve bookmark order
  const docMap = new Map(docs.map(d => [d.id, d]))
  const ordered = docIds.map(id => docMap.get(id)).filter(Boolean)

  return NextResponse.json({ bookmarks: ordered, ids: docIds, total: docIds.length })
}

/** POST /api/bookmarks — add a bookmark */
export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = await req.json().catch(() => ({}))
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

  await prisma.bookmark.upsert({
    where: { userId_documentId: { userId: session.id, documentId } },
    create: { userId: session.id, documentId },
    update: {}, // no-op if exists
  })

  const count = await prisma.bookmark.count({ where: { userId: session.id } })
  return NextResponse.json({ ok: true, total: count })
}

/** DELETE /api/bookmarks — remove a bookmark */
export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const documentId = searchParams.get('documentId')
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

  await prisma.bookmark.deleteMany({
    where: { userId: session.id, documentId },
  })

  const count = await prisma.bookmark.count({ where: { userId: session.id } })
  return NextResponse.json({ ok: true, total: count })
}
