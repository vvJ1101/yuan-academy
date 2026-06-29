import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const paths = await prisma.learningPath.findMany({ orderBy: { createdAt: 'desc' } })

  const enriched = await Promise.all(paths.map(async p => {
    let docIds: string[] = []
    try { docIds = JSON.parse(p.docIds || '[]') } catch {}
    const docs = docIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: docIds } },
          select: { id: true, title: true, slug: true, category: true,
            ownerDept: { select: { name: true, slug: true } },
            audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
        })
      : []
    const docMap = new Map(docs.map(d => [d.id, d]))
    const ordered = docIds.map(id => docMap.get(id)).filter(Boolean)
    return { ...p, docCount: ordered.length, docs: ordered }
  }))

  return NextResponse.json({ success: true, data: enriched })
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ success: false, error: 'Forbidden: super_admin only' }, { status: 403 })

  const { title, deptId, docIds } = await req.json().catch(() => ({}))
  if (!title) return NextResponse.json({ success: false, error: 'Title required' }, { status: 400 })

  const path = await prisma.learningPath.create({
    data: { title, deptId: deptId || null, docIds: JSON.stringify(Array.isArray(docIds) ? docIds : []) },
  })

  return NextResponse.json({ success: true, data: path }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ success: false, error: 'Forbidden: super_admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })

  try {
    await prisma.learningPath.delete({ where: { id } })
  } catch {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
