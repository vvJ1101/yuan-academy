/**
 * Clean garbled characters, HTML entities, and control chars from Markdown.
 * Used by parser, upload API, and AI analyze route.
 */

/** Characters to strip entirely */
function shouldStrip(code: number): boolean {
  // Control characters except newline (10) and tab (9)
  if (code < 0x20 && code !== 0x0a && code !== 0x09) return true
  // U+FFFC Object Replacement Character (Word embedded objects)
  if (code === 0xfffc) return true
  // U+FFFD Replacement Character
  if (code === 0xfffd) return true
  // BOM (U+FEFF)
  if (code === 0xfeff) return true
  return false
}

/** Characters to replace with space */
function shouldReplaceWithSpace(code: number): boolean {
  // Non-breaking space (U+00A0)
  if (code === 0x00a0) return true
  // Narrow no-break space (U+202F)
  if (code === 0x202f) return true
  return false
}

/** Zero-width characters that should be removed */
function isZeroWidth(code: number): boolean {
  // U+200B Zero-width space
  // U+200C Zero-width non-joiner
  // U+200D Zero-width joiner
  // U+200E Left-to-right mark
  // U+200F Right-to-left mark
  if (code >= 0x200b && code <= 0x200f) return true
  // U+2028 Line separator
  // U+2029 Paragraph separator
  if (code === 0x2028 || code === 0x2029) return true
  return false
}

export function sanitizeMarkdown(md: string): string {
  // First pass: HTML entities
  let result = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

  // Second pass: character-level sanitization
  const chars: string[] = []
  for (let i = 0; i < result.length; i++) {
    const code = result.charCodeAt(i)
    if (shouldStrip(code)) continue
    if (isZeroWidth(code)) continue
    if (shouldReplaceWithSpace(code)) {
      chars.push(' ')
    } else {
      chars.push(result.charAt(i))
    }
  }
  result = chars.join('')

  // Normalize line endings
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Collapse excessive blank lines
  result = result.replace(/\n{4,}/g, '\n\n\n')

  return result.trim()
}
