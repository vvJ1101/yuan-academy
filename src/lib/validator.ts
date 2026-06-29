/**
 * Phase 3 — Document Quality Validator
 * Structural checks (zero API cost). Semantic checks embedded in Phase 2 prompt.
 */

export interface ValidationResult {
  pass: boolean
  score: number        // 0-100
  issues: string[]
}

/**
 * Validate condensedContent against fullContent.
 */
export function validateOutput(condensedContent: string, fullContent: string): ValidationResult {
  const issues: string[] = []
  let score = 100

  // Strip self-check section (AI may echo rules like "无/Users/" which triggers false positives)
  const clean = condensedContent.replace(/^##\s*自检[\s\S]*$/im, '')

  // 1. Image count — only flag if mismatch > 2 (VML parsing can lose 1-2)
  const originalImgs = (fullContent.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
  const outputImgs = (clean.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
  if (originalImgs > 0 && Math.abs(outputImgs - originalImgs) > 2) {
    issues.push(`图片数量偏差过大：原文 ${originalImgs} 张，输出 ${outputImgs} 张`)
    score -= 20
  } else if (originalImgs > 0 && outputImgs !== originalImgs) {
    // Minor mismatch — likely VML, just warn
    issues.push(`图片数量偏差：原文 ${originalImgs} 张，输出 ${outputImgs} 张（可能为 WPS VML 格式）`)
    score -= 5
  }

  // 2. IMAGE_ placeholders
  if (/\[IMAGE_\d*\]/i.test(clean)) {
    issues.push('存在 [IMAGE_] 占位符')
    score -= 20
  }

  // 3. Local filesystem paths (only in image src, not in self-check text)
  const imgSrcs = (clean.match(/!\[[^\]]*\]\(([^)]+)\)/g) || []).filter(s => /\/Users\/|\/home\//.test(s))
  if (imgSrcs.length > 0) {
    issues.push(`${imgSrcs.length} 张图片引用包含本地路径`)
    score -= 10
  }

  // 4. Base64 images
  const base64Imgs = clean.match(/\!\[[^\]]*\]\(data:image\/\w+;base64,[^)]+\)/g)
  if (base64Imgs && base64Imgs.length > 0) {
    issues.push(`${base64Imgs.length} 张图片使用 base64，应替换为文件路径`)
    score -= 10
  }

  // 5. FAQ without answers (only count FAQ section)
  const faqSection = clean.match(/#+\s*(?:场景)?FAQ[\s\S]*?(?=^#+\s|$)/im)
  if (faqSection) {
    const qs = faqSection[0].match(/\*\*Q[：:].+?\*\*/g) || []
    const as_ = faqSection[0].match(/A[：:]/g) || []
    if (qs.length > as_.length) {
      issues.push(`FAQ 中 ${qs.length - as_.length} 条缺少答案`)
      score -= 15
    }
  }

  // 6. Empty modules — heading followed by < 20 chars before next heading
  const blocks = clean.split(/^(?=#+\s)/m).filter(b => b.trim())
  const emptyModules = blocks.filter(b => {
    const lines = b.split('\n').filter(l => l.trim())
    return lines.length <= 2 // heading + at most 1 content line
  })
  if (emptyModules.length > 1) { // >1 because one might be the very last heading
    issues.push(`${emptyModules.length} 个模块接近空内容`)
    score -= 5
  }

  // 7. Orphan images (all images after last step heading + 500 chars)
  const lastStepIdx = Math.max(0, ...(Array.from(clean.matchAll(/^#{2,4}\s+步骤\s*\d/gm)).map(m => m.index || 0)))
  const imgsAfterLastStep = (clean.match(/!\[[^\]]*\]\([^)]+\)/g) || []).filter((_, i) => {
    const idx = clean.indexOf(_, i === 0 ? 0 : clean.indexOf(_, (clean.match(/!\[[^\]]*\]\([^)]+\)/g) || []).slice(0, i).join('').length))
    return false // simplified: skip orphan check for now
  })
  // Simplified orphan check: just check if images exist after the last ## module heading
  const lastHeadingIdx = Math.max(0, ...(Array.from(clean.matchAll(/^##\s+.+/gm)).map(m => m.index || 0)))
  const imgsAfterLastHeading = clean.substring(lastHeadingIdx + 200).match(/!\[[^\]]*\]\([^)]+\)/g)
  if (imgsAfterLastHeading && imgsAfterLastHeading.length > 3) {
    issues.push(`${imgsAfterLastHeading.length} 张图片集中在文末`)
    score -= 5
  }

  return {
    pass: score >= 90,
    score: Math.max(0, score),
    issues,
  }
}
