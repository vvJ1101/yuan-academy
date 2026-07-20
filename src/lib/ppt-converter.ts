/**
 * PPT → PDF Converter
 *
 * Uses LibreOffice CLI (soffice) to convert .ppt/.pptx files to PDF.
 * Falls back gracefully if LibreOffice is not installed.
 *
 * Production server (Ubuntu): apt-get install -y libreoffice-impress libreoffice-common
 */

import { execFileSync } from 'child_process'
import { writeFileSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'

export interface ConversionResult {
  success: boolean
  pdfPath?: string
  error?: string
}

/**
 * Try to find the soffice binary at known locations.
 */
function findSoffice(): string | null {
  const candidates = [
    'soffice',                              // system PATH (Ubuntu apt)
    '/usr/bin/soffice',                     // Ubuntu default
    '/Applications/LibreOffice.app/Contents/MacOS/soffice', // Mac default
  ]
  for (const c of candidates) {
    try {
      execFileSync(c, ['--version'], { stdio: 'pipe', timeout: 3000 })
      return c
    } catch {
      continue
    }
  }
  return null
}

/**
 * Convert a PPT/PPTX buffer to PDF.
 *
 * @param buffer - Raw file buffer
 * @param extension - Original PowerPoint extension
 * @param docId - Document ID for output path
 * @param docDir - Absolute path to the document's upload directory
 * @returns Conversion result
 */
export async function convertPptToPdf(
  buffer: Buffer,
  extension: 'ppt' | 'pptx',
  docId: string,
  docDir: string
): Promise<ConversionResult> {
  const soffice = findSoffice()
  if (!soffice) {
    return {
      success: false,
      error: 'LibreOffice 未安装，无法转换 PPT 文件',
    }
  }

  const tmpDir = join(tmpdir(), `ppt-convert-${docId}-${uuidv4()}`)
  const inputPath = join(tmpDir, `input.${extension}`)
  const outputPath = join(tmpDir, 'input.pdf')

  try {
    // 1. Write temp input file
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(inputPath, buffer)

    // 2. Convert via LibreOffice
    execFileSync(soffice, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmpDir, inputPath], {
      stdio: 'pipe', timeout: 120_000,
    })

    if (!existsSync(outputPath)) {
      return { success: false, error: 'PPT 转换失败：LibreOffice 未生成 PDF 文件' }
    }

    // 3. Copy PDF to doc directory
    if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true })
    const destPath = join(docDir, 'preview.pdf')
    copyFileSync(outputPath, destPath)

    return { success: true }
  } catch {
    return {
      success: false,
      error: 'PPT 转换失败，请稍后重试',
    }
  } finally {
    // 4. Cleanup temp files
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}
