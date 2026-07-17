import { createHash } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const publicRoot = join(process.cwd(), 'public', 'uploads', 'documents')
const privateRoot = join(process.cwd(), 'data', 'private', 'documents')
const supported = new Set(['docx', 'pdf', 'ppt', 'pptx', 'xls', 'xlsx'])
const mime: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

async function checksum(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const unknown = [...args].filter(arg => !['--dry-run', '--apply', '--remove-public-after-verify'].includes(arg))
  if (unknown.length) throw new Error(`不支持的参数: ${unknown.join(', ')}`)
  if (args.has('--dry-run') && args.has('--apply')) throw new Error('--dry-run 与 --apply 不能同时使用')
  const apply = args.has('--apply')
  const removePublic = args.has('--remove-public-after-verify')
  if (removePublic && !apply) throw new Error('删除公开副本必须同时显式指定 --apply')

  const entries = await readdir(publicRoot, { withFileTypes: true }).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  })
  const candidates: Array<{ documentId: string; dir: string; original: string; preview?: string }> = []
  let bytes = 0
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.name)) continue
    const dir = join(publicRoot, entry.name)
    const files = await readdir(dir)
    const originals = files.filter(name => /^original\.[^.]+$/.test(name) && supported.has(extname(name).slice(1).toLowerCase()))
    if (originals.length !== 1) continue
    const original = join(dir, originals[0])
    const preview = files.includes('output.pdf') ? join(dir, 'output.pdf') : undefined
    bytes += (await stat(original)).size + (preview ? (await stat(preview)).size : 0)
    candidates.push({ documentId: entry.name, dir, original, preview })
  }

  console.log(`[DocumentMigration] 模式=${apply ? '执行' : '演练'} 文档=${candidates.length} 字节=${bytes}`)
  if (!apply) return

  const verifiedPublicDirs: string[] = []
  let failures = 0
  for (const candidate of candidates) {
    try {
      const document = await prisma.document.findUnique({ where: { id: candidate.documentId }, select: { id: true } })
      if (!document) throw new Error('数据库中不存在该文档')
      const extension = extname(candidate.original).slice(1).toLowerCase()
      const destinationDir = join(privateRoot, candidate.documentId)
      const destinationOriginal = join(destinationDir, `original.${extension}`)
      await mkdir(destinationDir, { recursive: true })
      await copyFile(candidate.original, destinationOriginal)
      if (await checksum(candidate.original) !== await checksum(destinationOriginal)) throw new Error('原文件校验失败')

      let previewPath: string | null = null
      const previewSource = candidate.preview ?? (extension === 'pdf' ? candidate.original : undefined)
      if (previewSource) {
        const destinationPreview = join(destinationDir, 'preview.pdf')
        await copyFile(previewSource, destinationPreview)
        if (await checksum(previewSource) !== await checksum(destinationPreview)) throw new Error('预览文件校验失败')
        previewPath = 'preview.pdf'
      }
      const size = (await stat(destinationOriginal)).size
      await prisma.document.update({
        where: { id: candidate.documentId },
        data: {
          originalFileName: basename(candidate.original), fileType: extension,
          mimeType: mime[extension], fileSize: size, processingStatus: 'ready',
          processingError: null, previewPath,
        },
      })
      verifiedPublicDirs.push(candidate.dir)
    } catch (error) {
      failures += 1
      console.error(`[DocumentMigration] ${candidate.documentId}: ${error instanceof Error ? error.message : '迁移失败'}`)
    }
  }

  if (removePublic) {
    if (failures > 0 || verifiedPublicDirs.length !== candidates.length) {
      throw new Error('存在校验或数据库更新失败，拒绝删除公开副本')
    }
    for (const dir of verifiedPublicDirs) await rm(dir, { recursive: true, force: true })
  }
  console.log(`[DocumentMigration] 完成=${verifiedPublicDirs.length} 失败=${failures} 公开副本=${removePublic ? '已删除' : '已保留'}`)
  if (failures) process.exitCode = 1
}

main()
  .catch(error => { console.error(`[DocumentMigration] ${error instanceof Error ? error.message : '执行失败'}`); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
