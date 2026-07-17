import { rm } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, prisma } from '@/lib/auth'
import { logEdit } from '@/lib/audit'
import { processDocumentFile } from '@/lib/document-processor'
import { getOriginalFilePath, getPreviewFilePath, validateUploadFile } from '@/lib/document-files'
import { canEdit } from '@/lib/permissions/documents'
import { getDocumentPermission } from '@/lib/permissions/folders'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, fullContent: true, condensedContent: true, content: true,
      displayMode: true, fileType: true,
    },
  })
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  if (!canEdit(await getDocumentPermission(session, doc.id))) {
    return NextResponse.json({ error: '你没有编辑该文档的权限' }, { status: 403 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: '上传数据格式无效' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择替换文件' }, { status: 400 })

  let upload
  try { upload = validateUploadFile(file) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '文件校验失败' }, { status: 400 })
  }
  const buffer = Buffer.from(await file.arrayBuffer())

  await prisma.documentHistory.create({
    data: {
      documentId: doc.id,
      content: JSON.stringify({
        title: doc.title, content: doc.content, fullContent: doc.fullContent,
        condensedContent: doc.condensedContent, displayMode: doc.displayMode,
      }).substring(0, 100000),
      editorId: session.id,
      editorName: session.name || session.departmentName || '未知用户',
      remark: '替换原始文件前自动备份',
    },
  })

  try {
    const processed = await processDocumentFile({ documentId: doc.id, buffer, upload }, {
      afterOriginalStored: async () => {
        await rm(getPreviewFilePath(doc.id), { force: true })
        if (doc.fileType && doc.fileType !== upload.fileType) {
          await rm(getOriginalFilePath(doc.id, doc.fileType as Parameters<typeof getOriginalFilePath>[1]), { force: true })
        }
      },
    })
    if (processed.originalStored === false) return NextResponse.json({ error: '原文件保存失败，请重试' }, { status: 500 })
    await logEdit(session.id, doc.id)

    let fullContent = `> 该文档为 ${upload.fileType.toUpperCase()} 文件，请使用在线阅读器查看。`
    let displayMode = upload.fileType === 'pdf' || upload.fileType === 'ppt' || upload.fileType === 'pptx' ? 'pdf' : 'full'
    let parseStats: unknown
    if (upload.fileType === 'docx') {
      const { parseDocx } = await import('@/lib/parser')
      const parsed = await parseDocx(buffer, doc.id)
      fullContent = parsed.markdown.substring(0, 100000)
      displayMode = 'full'
      parseStats = parsed.stats
    }
    await prisma.document.update({ where: { id: doc.id }, data: { fullContent, content: fullContent, displayMode } })
    return NextResponse.json({ ok: true, processing: processed, parseStats })
  } catch {
    return NextResponse.json({ error: '替换文件失败，原文档记录已保留' }, { status: 500 })
  }
}
