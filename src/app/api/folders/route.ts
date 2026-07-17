import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { getUserAccessibleFolderIds } from '@/lib/permissions/folders'
import { getFolderPermission } from '@/lib/permissions/folders'
import { calculateDocumentStorage } from '@/lib/document-processor'

// GET /api/folders — list folder tree (filtered by user permissions)
export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Calculate actual storage usage from disk
  const storage = await calculateDocumentStorage()

  // Super admin sees everything — all folders get admin permission
  if (session.role === 'super_admin') {
    const folders = await prisma.folder.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { documents: true, children: true } } },
    })
    const foldersWithPerm = folders.map(f => ({ ...f, userPermission: 'admin' }))
    return NextResponse.json({ folders: foldersWithPerm, storage })
  }

  // Other users: only see folders they have permission for (or their company's folders)
  const allowedIds = await getUserAccessibleFolderIds(session)
  let folders = await prisma.folder.findMany({
    where: {
      OR: [
        { id: { in: allowedIds } },
        // Also show folders owned by user's company (even without explicit permissions)
        ...(session.companyId ? [{ companyId: session.companyId }] : []),
        // And folders with no company (group-level)
        { companyId: null },
      ],
    },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { documents: true, children: true } } },
  })

  // 为每个文件夹计算用户的实际权限等级
  folders = await Promise.all(folders.map(async (f) => {
    const perm = await getFolderPermission(session, f.id)
    return { ...f, userPermission: perm || 'none' }
  }))

  return NextResponse.json({ folders, storage })
}

// POST /api/folders — create folder
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session || (session.role !== 'super_admin' && session.role !== 'dept_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, parentId, companyId, inheritPermissions } = await req.json().catch(() => ({}))
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  // 查询同级文件夹的最大 sortOrder（包括根级 parentId=null 的情况）
  const maxSortSibling = await prisma.folder.findFirst({
    where: parentId ? { parentId } : { parentId: null },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const maxSort = maxSortSibling?.sortOrder ?? 0

  const folder = await prisma.folder.create({
    data: {
      name, slug,
      parentId: parentId || null,
      companyId: companyId || null,
      inheritPermissions: inheritPermissions ?? true,
      sortOrder: maxSort + 1,
    },
  })

  // Auto-create default view permission for creating user's company
  if (companyId) {
    await prisma.folderPermission.create({
      data: { folderId: folder.id, companyId, permission: 'admin' },
    })
  }

  return NextResponse.json({ folder }, { status: 201 })
}

// PUT /api/folders — update folder
export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session || (session.role !== 'super_admin' && session.role !== 'dept_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, name, companyId, inheritPermissions } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const data: any = {}
  if (name !== undefined) {
    data.name = name
    data.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
  if (companyId !== undefined) data.companyId = companyId || null
  if (inheritPermissions !== undefined) data.inheritPermissions = inheritPermissions

  const folder = await prisma.folder.update({ where: { id }, data })
  return NextResponse.json({ folder })
}

// DELETE /api/folders — delete folder
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session || (session.role !== 'super_admin' && session.role !== 'dept_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Move child documents to parent folder or unlink
  const folder = await prisma.folder.findUnique({ where: { id }, select: { parentId: true } })
  await prisma.document.updateMany({ where: { folderId: id }, data: { folderId: folder?.parentId || null } })
  await prisma.folder.updateMany({ where: { parentId: id }, data: { parentId: folder?.parentId || null } })
  await prisma.folderPermission.deleteMany({ where: { folderId: id } })
  await prisma.folder.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
