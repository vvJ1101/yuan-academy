/**
 * OCR module — extract text from document screenshots using tesseract.js
 *
 * Usage: POST /api/documents/[id]/ocr → runs OCR on all images in the doc's upload dir
 * Results stored in extractedJson.images[].ocrText — indexed by FTS5 for searchability
 */

import { createWorker } from 'tesseract.js'
import { readdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface OcrResult {
  imagePath: string
  text: string
  confidence: number
  error?: string
}

/**
 * Run OCR on all PNG images in a document's upload directory.
 * Uses tesseract.js with chi_sim (Simplified Chinese) + eng.
 * Skips images already OCR'd (checks extractedJson cache).
 */
export async function ocrDocumentImages(
  documentId: string,
  onProgress?: (current: number, total: number, file: string) => void,
): Promise<OcrResult[]> {
  const docDir = join(process.cwd(), 'public', 'uploads', 'documents', documentId)
  if (!existsSync(docDir)) return []

  // List all PNG images (skip original.docx)
  const files = readdirSync(docDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
  if (files.length === 0) return []

  const worker = await createWorker('chi_sim+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress && m.progress) {
        onProgress(m.progress * 100, files.length, 'OCR 识别中...')
      }
    },
  })

  const results: OcrResult[] = []

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const imagePath = join(docDir, file)
      try {
        const imageBuffer = readFileSync(imagePath)
        const { data } = await worker.recognize(imageBuffer)
        results.push({
          imagePath: `/uploads/documents/${documentId}/${file}`,
          text: data.text?.trim() || '',
          confidence: Math.round(data.confidence || 0),
        })
      } catch (err: any) {
        results.push({
          imagePath: `/uploads/documents/${documentId}/${file}`,
          text: '',
          confidence: 0,
          error: err.message || 'OCR failed',
        })
      }
      if (onProgress) onProgress(i + 1, files.length, file)
    }
  } finally {
    await worker.terminate()
  }

  return results
}

/**
 * Lightweight: run OCR on a single image buffer.
 * Used for on-the-spot OCR (e.g., AI analyzer preview).
 */
export async function ocrSingleImage(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('chi_sim+eng', 1)
  try {
    const { data } = await worker.recognize(imageBuffer)
    return data.text?.trim() || ''
  } finally {
    await worker.terminate()
  }
}
