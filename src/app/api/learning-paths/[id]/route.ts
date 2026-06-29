import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { logEdit } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ success: false, error: 'Forbidden: super_admin only' }, { status: 403 })

  const existing = await prisma.learningPath.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { title, deptId, docIds } = body

  if (!title) return NextResponse.json({ success: false, error: 'Title required' }, { status: 400 })

  // Full replacement strategy
  const updated = await prisma.learningPath.update({
    where: { id: params.id },
    data: {
      title,
      deptId: deptId || existing.deptId,
      docIds: JSON.stringify(Array.isArray(docIds) ? docIds : []),
    },
  })

  // Audit log
  logEdit(session.id, params.id).catch(() => {})

  // Resolve docs for response
  let docIdList: string[] = []
  try { docIdList = JSON.parse(updated.docIds || '[]') } catch {}
  const docs = docIdList.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: docIdList } },
        select: { id: true, title: true, slug: true, category: true,
          ownerDept: { select: { name: true } } },
      })
    : []
  const docMap = new Map(docs.map(d => [d.id, d]))
  const ordered = docIdList.map(id => docMap.get(id)).filter(Boolean)

  return NextResponse.json({ success: true, data: { ...updated, docs: ordered, docCount: ordered.length } })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ success: false, error: 'Forbidden: super_admin only' }, { status: 403 })

  const existing = await prisma.learningPath.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  await prisma.learningPath.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
