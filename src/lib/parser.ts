/**
 * 🔒 SYSTEM LOCK — DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 *
 * This is the verified DOCX→Markdown image extraction pipeline.
 * See CLAUDE.md "图片处理管线" section for the full spec.
 *
 * RED LINES:
 *   - Do NOT add hash-based dedup in mammoth convertImage (breaks src generation)
 *   - Do NOT modify turndown config that affects image output
 *   - Do NOT change Step 3 src replacement logic for non-local paths
 *   - Do NOT share seenHashes between JSZip and mammoth extraction steps
 */

import mammoth from 'mammoth'
import JSZip from 'jszip'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { v4 as uuidv4 } from 'uuid'
import TurndownService from 'turndown'

import { sanitizeMarkdown } from '@/lib/sanitize'

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads', 'documents')

// ── Turndown: mature HTML → Markdown ──
const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  codeBlockStyle: 'fenced',
})

/** Check if a path looks like a local filesystem path (not web URL) */
function isLocalPath(src: string): boolean {
  return /^(\/Users\/|\/home\/|\/private\/|\/tmp\/|[A-Z]:\\)/i.test(src)
}

// ── Parse Stats ──
export interface ParseStats {
  images: number
  tables: number
  h1Headings: number
  h2Headings: number
  h3Headings: number
  orderedLists: number
  unorderedLists: number
}

function countStats(html: string): ParseStats {
  return {
    images: (html.match(/<img[^>]*>/gi) || []).length,
    tables: (html.match(/<table[^>]*>/gi) || []).length,
    h1Headings: (html.match(/<h1[^>]*>/gi) || []).length,
    h2Headings: (html.match(/<h2[^>]*>/gi) || []).length,
    h3Headings: (html.match(/<h3[^>]*>/gi) || []).length,
    orderedLists: (html.match(/<ol[^>]*>/gi) || []).length,
    unorderedLists: (html.match(/<ul[^>]*>/gi) || []).length,
  }
}

// ── Main parse function ──
export async function parseDocx(buffer: Buffer, documentId?: string): Promise<{
  markdown: string
  imageCount: number
  stats: ParseStats
  warnings: string[]
}> {
  const docDir = documentId ? join(UPLOADS_DIR, documentId) : join(UPLOADS_DIR, 'temp')
  if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true })

  // Dedup tracking: content hash → filename (avoid saving same image twice)
  const seenHashes = new Set<string>()
  function hashBuffer(buf: Buffer): string {
    // Fast hash: size + first 64 bytes + last 64 bytes
    const head = buf.slice(0, 64).toString('hex')
    const tail = buf.slice(-64).toString('hex')
    return `${buf.length}:${head}:${tail}`
  }

  // ── Step 1: Extract ALL images from word/media/ via JSZip (fallback for WPS/non-standard) ──
  const imageMap = new Map<string, string>()

  try {
    const zip = await JSZip.loadAsync(buffer)
    const mediaFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith('word/media/') && !f.endsWith('/')
    )

    for (const mediaPath of mediaFiles) {
      const file = zip.files[mediaPath]
      if (!file) continue
      const origName = basename(mediaPath)
      // Skip if already mapped
      if (imageMap.has(origName)) continue
      const ext = (origName.split('.').pop() || 'png').toLowerCase()
      const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png'
      const uuidName = `${uuidv4()}.${safeExt}`
      try {
        const fileData = await file.async('nodebuffer')
        const h = hashBuffer(fileData)
        if (seenHashes.has(h)) continue // dedup
        seenHashes.add(h)
        writeFileSync(join(docDir, uuidName), fileData)
        imageMap.set(origName, `/uploads/documents/${documentId || 'temp'}/${uuidName}`)
      } catch { /* skip */ }
    }
  } catch { /* not a valid ZIP */ }

  // ── Step 2: Convert with mammoth (handles standard embedded images) ──
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      // 🔒 DO NOT add hash/seenHashes check here — must always return valid src
      // JSZip (Step 1) handles dedup independently. Adding dedup here causes
      // ALL images to be stripped (empty src → turndown drops them).
      convertImage: mammoth.images.imgElement((image) => {
        return image.read().then((imgBuffer) => {
          const mime = image.contentType || 'image/png'
          const ext = mime.replace('image/', '')
          // Only allow common image formats
          const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png'
          const filename = `${uuidv4()}.${safeExt}`
          try {
            writeFileSync(join(docDir, filename), imgBuffer)
          } catch { /* skip on disk error */ }
          return { src: `/uploads/documents/${documentId || 'temp'}/${filename}` }
        }).catch(() => {
          // If image read fails, return empty to skip this image
          return { src: '' }
        })
      }),
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='heading 1'] => h1:fresh",
        "p[style-name='heading 2'] => h2:fresh",
        "p[style-name='heading 3'] => h3:fresh",
        "p[style-name='标题 1'] => h1:fresh",
        "p[style-name='标题 2'] => h2:fresh",
        "p[style-name='标题 3'] => h3:fresh",
        "p[style-name='Title'] => h1:fresh",
        "r[style-name='Strong'] => strong",
      ],
    }
  )

  let html = result.value

  // ── Step 3: Clean up image tags ──
  // Issues handled:
  //   A) img alt contains WPS local path → replace alt with clean text
  //   B) img src is a local filesystem path → try JSZip match, else strip
  //   C) img src is base64 data URI → save to disk as file

  html = html.replace(/<img[^>]*\/?>/gi, (fullMatch) => {
    const srcMatch = fullMatch.match(/src="([^"]*)"/i)
    const altMatch = fullMatch.match(/alt="([^"]*)"/i)
    let src = srcMatch ? srcMatch[1] : ''
    let alt = altMatch ? altMatch[1] : ''

    // A: Clean garbage alt text (WPS local paths)
    if (isLocalPath(alt)) {
      alt = '图片'
      fullMatch = fullMatch.replace(/alt="[^"]*"/i, `alt="${alt}"`)
    }

    // B: Local filesystem path in src → try JSZip remap
    if (isLocalPath(src)) {
      const name = basename(src)
      const decoded = decodeURIComponent(name)
      const mapped = imageMap.get(name) || imageMap.get(decoded)
      if (mapped) {
        fullMatch = fullMatch.replace(src, mapped)
      } else {
        return '' // strip unresolvable local path
      }
    }

    // C: base64 data URI → decode and save to disk (fallback for mammoth w/o convertImage)
    if (src.startsWith('data:image/')) {
      try {
        const [header, b64] = src.split(',')
        const mimeMatch = header.match(/data:(image\/\w+)/)
        const ext = mimeMatch ? mimeMatch[1].replace('image/', '') : 'png'
        const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png'
        const buffer = Buffer.from(b64, 'base64')
        if (buffer.length > 1024) {
          const filename = `${uuidv4()}.${safeExt}`
          try { writeFileSync(join(docDir, filename), buffer) } catch { /* skip */ }
          const imgPath = `/uploads/documents/${documentId || 'temp'}/${filename}`
          fullMatch = fullMatch.replace(src, imgPath)
        }
      } catch { /* keep original */ }
    }

    return fullMatch
  })

  // ── Step 4: Track effective image count ──
  const stats = countStats(html)

  // ── Step 5: Convert HTML to Markdown ──
  let markdown = td.turndown(html)

  // Post-processing
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim()

  // Sanitize
  markdown = sanitizeMarkdown(markdown)

  // Collect warnings
  const warnings = result.messages.map((m) => m.message)
  const totalJszip = imageMap.size
  const totalMammoth = (result.value.match(/<img[^>]*>/gi) || []).length
  const finalImages = stats.images
  if (totalJszip > finalImages) {
    warnings.push(`VML图片丢失：DOCX包含${totalJszip}张图片，成功提取${finalImages}张，${totalJszip - finalImages}张无法映射（WPS Office VML格式）`)
  }

  return {
    markdown,
    imageCount: stats.images,
    stats,
    warnings,
  }
}
