import { rm } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, prisma } from '@/lib/auth'
import { logEdit } from '@/lib/audit'
import { createDocumentHistorySnapshot, finalizeDocumentReplacement, getDocumentProcessorErrorMessage, processDocumentFile } from '@/lib/document-processor'
import { getOriginalFilePath, getPreviewFilePath, validateUploadFile } from '@/lib/document-files'
import { canEdit } from '@/lib/permissions/documents'
import { getDocumentPermission } from '@/lib/permissions/folders'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: (await params).id },
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

  try {
    await prisma.documentHistory.create({
      data: {
        documentId: doc.id,
        content: createDocumentHistorySnapshot({
          title: doc.title, content: doc.content, fullContent: doc.fullContent,
          condensedContent: doc.condensedContent, displayMode: doc.displayMode,
        }),
        editorId: session.id,
        editorName: session.name || session.departmentName || '未知用户',
        remark: '替换原始文件前自动备份',
      },
    })
  } catch {
    return NextResponse.json({ error: '创建替换前备份失败，原文件未变更' }, { status: 500 })
  }

  try {
    const processed = await processDocumentFile({ documentId: doc.id, buffer, upload }, {
      deferReady: true,
      replacement: true,
      afterOriginalStored: async () => {
        await rm(getPreviewFilePath(doc.id), { force: true })
        if (doc.fileType && doc.fileType !== upload.fileType) {
          await rm(getOriginalFilePath(doc.id, doc.fileType as Parameters<typeof getOriginalFilePath>[1]), { force: true })
        }
      },
    })
    if (processed.originalStored === false) return NextResponse.json({ error: '原文件保存失败，请重试' }, { status: 500 })
    const finalized = await finalizeDocumentReplacement({
      prepare: async () => {
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
        return { fullContent, displayMode, parseStats }
      },
      commit: async value => {
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            fullContent: value.fullContent, content: value.fullContent, displayMode: value.displayMode,
            processingStatus: processed.status, processingError: processed.status === 'ready' ? null : processed.error,
          },
        })
      },
      markFailed: async () => {
        await prisma.document.update({
          where: { id: doc.id },
          data: { processingStatus: 'failed', processingError: '替换文件后续处理失败，请重试' },
        })
      },
    })
    await logEdit(session.id, doc.id)
    return NextResponse.json({ ok: true, processing: processed, parseStats: finalized.parseStats })
  } catch (error) {
    const operationalMessage = getDocumentProcessorErrorMessage(error)
    return NextResponse.json({
      error: operationalMessage || '替换处理失败，请稍后重试或联系管理员',
    }, { status: 500 })
  }
}
