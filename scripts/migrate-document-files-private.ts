import { createHash } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

import { PrismaClient } from '@prisma/client'

const supported = new Set(['docx', 'pdf', 'ppt', 'pptx', 'xls', 'xlsx'])
const mime: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

type DocumentRecord = { id: string; originalFileName: string }
type MigrationDatabase = {
  findDocument(id: string): Promise<DocumentRecord | null>
  updateDocument(id: string, data: Record<string, unknown>): Promise<void>
}

export interface MigrationOptions {
  publicRoot: string
  privateRoot: string
  apply?: boolean
  removePublicAfterVerify?: boolean
  database: MigrationDatabase
  checksumFile?: (path: string) => Promise<string>
  log?: (message: string) => void
}

export interface MigrationSummary {
  candidates: number
  bytes: number
  verified: number
  failures: number
}

async function checksum(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function exists(path: string) {
  try { await stat(path); return true } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function migrateLegacyFiles(options: MigrationOptions): Promise<MigrationSummary> {
  if (options.removePublicAfterVerify && !options.apply) throw new Error('删除公开副本必须同时显式指定 --apply')
  const checksumFile = options.checksumFile ?? checksum
  const entries = await readdir(options.publicRoot, { withFileTypes: true }).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  })
  const candidates: Array<{ documentId: string; original: string; preview?: string; bytes: number }> = []
  let discoveryFailures = 0
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.name)) continue
    const dir = join(options.publicRoot, entry.name)
    const files = await readdir(dir)
    const originals = files.filter(name => /^original\.[^.]+$/.test(name) && supported.has(extname(name).slice(1).toLowerCase()))
    if (originals.length !== 1) { discoveryFailures += 1; continue }
    const original = join(dir, originals[0])
    const preview = files.includes('output.pdf') ? join(dir, 'output.pdf') : undefined
    try {
      const bytes = (await stat(original)).size + (preview ? (await stat(preview)).size : 0)
      candidates.push({ documentId: entry.name, original, preview, bytes })
    } catch { discoveryFailures += 1 }
  }

  const verified: Array<{ sources: string[] }> = []
  let failures = discoveryFailures
  for (const candidate of candidates) {
    try {
      const document = await options.database.findDocument(candidate.documentId)
      if (!document) throw new Error('数据库中不存在该文档')
      const extension = extname(candidate.original).slice(1).toLowerCase()
      const destinationDir = join(options.privateRoot, candidate.documentId)
      const destinationOriginal = join(destinationDir, `original.${extension}`)
      const originalChecksum = await checksumFile(candidate.original)
      if (await exists(destinationOriginal) && await checksumFile(destinationOriginal) !== originalChecksum) {
        throw new Error('私有目录已存在不同的原文件')
      }
      const previewSource = candidate.preview ?? (extension === 'pdf' ? candidate.original : undefined)
      const destinationPreview = previewSource ? join(destinationDir, 'preview.pdf') : undefined
      const previewChecksum = previewSource ? await checksumFile(previewSource) : undefined
      if (destinationPreview && await exists(destinationPreview) && await checksumFile(destinationPreview) !== previewChecksum) {
        throw new Error('私有目录已存在不同的预览文件')
      }

      if (options.apply) {
        await mkdir(destinationDir, { recursive: true })
        if (!await exists(destinationOriginal)) await copyFile(candidate.original, destinationOriginal)
        if (await checksumFile(destinationOriginal) !== originalChecksum) throw new Error('原文件校验失败')
        if (previewSource && destinationPreview) {
          if (!await exists(destinationPreview)) await copyFile(previewSource, destinationPreview)
          if (await checksumFile(destinationPreview) !== previewChecksum) throw new Error('预览文件校验失败')
        }
        await options.database.updateDocument(candidate.documentId, {
          originalFileName: document.originalFileName.trim() || basename(candidate.original),
          fileType: extension, mimeType: mime[extension], fileSize: (await stat(destinationOriginal)).size,
          processingStatus: 'ready', processingError: null,
          previewPath: destinationPreview ? 'preview.pdf' : null,
        })
      }
      verified.push({ sources: [candidate.original, ...(candidate.preview ? [candidate.preview] : [])] })
    } catch (error) {
      failures += 1
      options.log?.(`[DocumentMigration] ${candidate.documentId}: ${error instanceof Error ? error.message : '迁移失败'}`)
    }
  }

  if (options.removePublicAfterVerify) {
    if (failures > 0 || verified.length !== candidates.length) throw new Error('存在校验或数据库更新失败，拒绝删除公开副本')
    for (const item of verified) for (const source of item.sources) await rm(source, { force: true })
  }
  return { candidates: candidates.length, bytes: candidates.reduce((sum, item) => sum + item.bytes, 0), verified: verified.length, failures }
}

export async function main(argv = process.argv.slice(2)) {
  const args = new Set(argv)
  const unknown = [...args].filter(arg => !['--dry-run', '--apply', '--remove-public-after-verify'].includes(arg))
  if (unknown.length) throw new Error(`不支持的参数: ${unknown.join(', ')}`)
  if (args.has('--dry-run') && args.has('--apply')) throw new Error('--dry-run 与 --apply 不能同时使用')
  const apply = args.has('--apply')
  const prisma = new PrismaClient()
  try {
    const summary = await migrateLegacyFiles({
      publicRoot: join(process.cwd(), 'public', 'uploads', 'documents'),
      privateRoot: join(process.cwd(), 'data', 'private', 'documents'),
      apply,
      removePublicAfterVerify: args.has('--remove-public-after-verify'),
      database: {
        findDocument: id => prisma.document.findUnique({ where: { id }, select: { id: true, originalFileName: true } }),
        updateDocument: async (id, data) => { await prisma.document.update({ where: { id }, data }) },
      },
      log: console.error,
    })
    console.log(`[DocumentMigration] 模式=${apply ? '执行' : '演练'} 文档=${summary.candidates} 字节=${summary.bytes} 验证=${summary.verified} 失败=${summary.failures}`)
    if (summary.failures) process.exitCode = 1
  } finally { await prisma.$disconnect() }
}

if (require.main === module) {
  main().catch(error => { console.error(`[DocumentMigration] ${error instanceof Error ? error.message : '执行失败'}`); process.exitCode = 1 })
}
