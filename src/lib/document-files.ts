import { basename, extname, join } from 'node:path'

export type DocumentFileType = 'pdf' | 'ppt' | 'pptx' | 'xls' | 'xlsx' | 'docx'

export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface ValidatedUpload {
  originalFileName: string
  fileType: DocumentFileType
  mimeType: string
  fileSize: number
}

interface UploadFileInput {
  name: string
  type: string
  size: number
}

type DocumentPermission = 'view' | 'edit' | 'delete' | 'admin'

const MAX_FILE_SIZE = 100 * 1024 * 1024

const MIME_BY_FILE_TYPE: Record<DocumentFileType, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const SUPPORTED_FILE_TYPES = new Set<DocumentFileType>(
  Object.keys(MIME_BY_FILE_TYPE) as DocumentFileType[],
)

export function validateUploadFile(file: UploadFileInput): ValidatedUpload {
  const originalFileName = basename(file.name)
  const extension = extname(originalFileName).slice(1).toLowerCase()

  if (!SUPPORTED_FILE_TYPES.has(extension as DocumentFileType)) {
    throw new Error('不支持该文件类型进行在线处理')
  }

  const fileType = extension as DocumentFileType
  if (file.type !== MIME_BY_FILE_TYPE[fileType]) {
    throw new Error('文件 MIME 类型与扩展名不匹配')
  }

  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    throw new Error('文件大小无效')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('文件大小不能超过 100 MB')
  }

  return {
    originalFileName,
    fileType,
    mimeType: file.type,
    fileSize: file.size,
  }
}

function getDocumentDirectory(docId: string): string {
  if (!docId || basename(docId) !== docId) {
    throw new Error('文档 ID 无效')
  }

  return join(process.cwd(), 'data', 'private', 'documents', docId)
}

export function getOriginalFilePath(docId: string, fileType: DocumentFileType): string {
  if (!SUPPORTED_FILE_TYPES.has(fileType)) {
    throw new Error('不支持该文件类型')
  }

  return join(getDocumentDirectory(docId), `original.${fileType}`)
}

export function getPreviewFilePath(docId: string): string {
  return join(getDocumentDirectory(docId), 'preview.pdf')
}

export function canDownloadPermission(permission: DocumentPermission | null): boolean {
  return permission === 'edit' || permission === 'delete' || permission === 'admin'
}
