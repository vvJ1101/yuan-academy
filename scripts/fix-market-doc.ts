import { readFileSync, writeFileSync } from 'fs'
import { parseDocx } from '../src/lib/parser'

const DOC_ID = 'cmpuospr1000by8gnncyasy0v'
const filePath = '/Users/vv/Desktop/内部文档/人事部/IT培训/市场部_联欣&康雷系统操作手册（原）.docx'

async function main() {
  console.log('Parsing DOCX...')
  const buffer = readFileSync(filePath)
  const result = await parseDocx(buffer, DOC_ID)

  // Fix image paths
  const fixed = result.markdown.replace(
    /\/uploads\/documents\/[^/]+\//g,
    `/uploads/documents/${DOC_ID}/`
  )

  console.log(`Content: ${fixed.length} chars, ${(fixed.match(/!\[image\]/g) || []).length} images`)

  // Save to temp file
  writeFileSync('/tmp/market-fixed.md', fixed, 'utf-8')
  console.log('Saved to /tmp/market-fixed.md')
}

main().catch(e => { console.error(e); process.exit(1) })
