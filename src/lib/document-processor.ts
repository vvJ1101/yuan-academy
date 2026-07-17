import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ConversionResult } from './ppt-converter'
import type { ValidatedUpload } from './document-files'

type MetadataChanges = {
  originalFileName?: string
  fileType?: string
  mimeType?: string
  fileSize?: number
  processingStatus: 'processing' | 'ready' | 'failed'
  processingError?: string | null
  previewPath?: string | null
}

export interface ProcessResult {
  status: 'ready' | 'failed'
  hasPreview: boolean
  originalStored?: boolean
  error?: string
}

interface ProcessorDependencies {
  root?: string
  updateMetadata?: (changes: MetadataChanges) => Promise<void>
  convertPpt?: (
    buffer: Buffer,
    extension: 'ppt' | 'pptx',
    docId: string,
    docDir: string,
  ) => Promise<ConversionResult>
  afterOriginalStored?: () => Promise<void>
  deferReady?: boolean
}

interface ProcessInput {
  documentId: string
  buffer: Buffer
  upload: ValidatedUpload
}

export interface StorageSummary {
  usedBytes: number
  usedGB: number
  totalGB: 100
  percent: number
}

export function createDocumentHistorySnapshot(document: {
  title: string
  content: string
  fullContent: string
  condensedContent: string
  displayMode: string
}): string {
  return JSON.stringify(document)
}

export async function finalizeDocumentReplacement<T>(options: {
  prepare: () => Promise<T>
  commit: (value: T) => Promise<void>
  markFailed: () => Promise<void>
}): Promise<T> {
  try {
    const value = await options.prepare()
    await options.commit(value)
    return value
  } catch (error) {
    await options.markFailed().catch(() => undefined)
    throw error
  }
}

function shortProcessingError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '')
  if (/libreoffice|soffice/i.test(raw)) return '服务器缺少 PPT 转换组件，原文件已安全保存'
  return '文件处理失败，原文件已保存，请稍后重试'
}

async function defaultMetadataUpdater(documentId: string, changes: MetadataChanges) {
  const { prisma } = await import('./prisma')
  await prisma.document.update({ where: { id: documentId }, data: changes })
}

export async function processDocumentFile(
  input: ProcessInput,
  dependencies: ProcessorDependencies = {},
): Promise<ProcessResult> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(input.documentId)) throw new Error('文档 ID 无效')
  const root = dependencies.root ?? join(process.cwd(), 'data', 'private', 'documents')
  const docDir = join(root, input.documentId)
  const originalPath = join(docDir, `original.${input.upload.fileType}`)
  const stagingPath = join(docDir, `.original-${randomUUID()}.staging`)
  const updateMetadata = dependencies.updateMetadata
    ?? ((changes: MetadataChanges) => defaultMetadataUpdater(input.documentId, changes))

  try {
    await mkdir(docDir, { recursive: true })
    await writeFile(stagingPath, input.buffer)
    await rename(stagingPath, originalPath)
  } catch (error) {
    await rm(stagingPath, { force: true }).catch(() => undefined)
    const processingError = '原文件保存失败，请重试'
    await updateMetadata({ processingStatus: 'failed', processingError, previewPath: null })
    return { status: 'failed', hasPreview: false, originalStored: false, error: processingError }
  }

  await updateMetadata({
    originalFileName: input.upload.originalFileName,
    fileType: input.upload.fileType,
    mimeType: input.upload.mimeType,
    fileSize: input.buffer.byteLength,
    processingStatus: 'processing',
    processingError: null,
    previewPath: null,
  })

  try {
    await dependencies.afterOriginalStored?.()
    if (input.upload.fileType === 'ppt' || input.upload.fileType === 'pptx') {
      const converter = dependencies.convertPpt ?? (await import('./ppt-converter')).convertPptToPdf
      const converted = await converter(input.buffer, input.upload.fileType, input.documentId, docDir)
      if (!converted.success) throw new Error(converted.error || 'PPT conversion failed')
      await updateMetadata({ processingStatus: dependencies.deferReady ? 'processing' : 'ready', processingError: null, previewPath: 'preview.pdf' })
      return { status: 'ready', hasPreview: true }
    }

    const hasPreview = input.upload.fileType === 'pdf'
    if (hasPreview) await copyFile(originalPath, join(docDir, 'preview.pdf'))
    await updateMetadata({ processingStatus: dependencies.deferReady ? 'processing' : 'ready', processingError: null, previewPath: hasPreview ? 'preview.pdf' : null })
    return { status: 'ready', hasPreview }
  } catch (error) {
    const processingError = shortProcessingError(error)
    await updateMetadata({ processingStatus: 'failed', processingError, previewPath: null })
    return { status: 'failed', hasPreview: false, originalStored: true, error: processingError }
  }
}

export async function calculateDocumentStorage(
  root = join(process.cwd(), 'data', 'private', 'documents'),
): Promise<StorageSummary> {
  let usedBytes = 0
  try {
    const directories = await readdir(root, { withFileTypes: true })
    for (const directory of directories) {
      if (!directory.isDirectory()) continue
      const files = await readdir(join(root, directory.name), { withFileTypes: true })
      const originals = files.filter(file => file.isFile() && /^original\.(docx|pdf|ppt|pptx|xls|xlsx)$/.test(file.name))
      for (const original of originals) usedBytes += (await stat(join(root, directory.name, original.name))).size
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  return {
    usedBytes,
    usedGB: +(usedBytes / 1e9).toFixed(1),
    totalGB: 100,
    percent: Math.min(100, Math.round((usedBytes / 1e11) * 100)),
  }
}
