import { PrismaClient } from '@prisma/client'
import { parseDocx } from '../src/lib/parser'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, dirname } from 'path'

const prisma = new PrismaClient()
const DOCS_ROOT = '/Users/vv/Desktop/内部文档'

// Owner department determined by folder structure
const OWNER_MAP: Record<string, string> = {
  '人事部': 'hr',
  '财务部': 'finance',
  '品牌部': 'brand',
  '商品部': 'product',
  '订货会': 'showroom',
}

// Audience department parsed from filename prefix
const AUDIENCE_PREFIXES: { prefix: string; slug: string }[] = [
  { prefix: '市场部', slug: 'marketing' },
  { prefix: '商品部', slug: 'product' },
  { prefix: '品牌部', slug: 'brand' },
  { prefix: '财务部', slug: 'finance' },
  { prefix: '人事部', slug: 'hr' },
  { prefix: '订货会', slug: 'showroom' },
]

function slugify(text: string): string {
  return text
    .replace(/\.docx$/i, '')
    .replace(/[（）()（）]/g, '')
    .replace(/[^a-zA-Z0-9一-鿿_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .substring(0, 80)
}

function detectOwner(filePath: string): { name: string; slug: string } | null {
  for (const [name, slug] of Object.entries(OWNER_MAP)) {
    if (filePath.includes(name)) return { name, slug }
  }
  return null
}

function detectOwnerCategory(filePath: string): string {
  const parent = dirname(filePath)
  const parts = parent.split('/')
  const lastDir = parts[parts.length - 1]
  if (lastDir.includes('IT培训') || lastDir.includes('培训')) return 'training'
  if (lastDir.includes('行政')) return 'admin'
  return 'reference'
}

interface AudienceMatch {
  name: string
  slug: string
}

function detectAudience(filename: string): AudienceMatch[] {
  const results: AudienceMatch[] = []
  for (const { prefix, slug } of AUDIENCE_PREFIXES) {
    if (filename.includes(prefix) || filename.startsWith(prefix)) {
      results.push({ name: prefix, slug })
    }
  }
  return results
}

function extractTitle(filename: string): string {
  // Remove .docx extension
  let title = filename.replace(/\.docx$/i, '')
  let audience = ''

  // Extract audience prefix for cleaner naming: "市场部 · 康雷操作手册"
  for (const { prefix } of AUDIENCE_PREFIXES) {
    if (title.startsWith(prefix)) {
      audience = prefix
      title = title.slice(prefix.length)
      if (title.startsWith('_') || title.startsWith('-')) title = title.slice(1)
      break
    }
  }

  // Clean up version suffix
  title = title
    .replace(/[_]?v\d+.*$/i, '')
    .replace(/（原）/, '')
    .replace(/\(原\)/, '')
    .trim()

  // Build clean title
  if (audience) {
    return `${audience} · ${title}`
  }

  // For YUANSHOWROOM-branded docs
  title = title.replace(/^YUANSHOWROOM\s*/i, '')
  return title || filename.replace(/\.docx$/i, '')
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) throw new Error('Run seed first')

  const departments = await prisma.department.findMany()
  const deptBySlug: Record<string, string> = {}
  departments.forEach((d) => (deptBySlug[d.slug] = d.id))

  // Walk directory
  const files: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.')) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.docx')) files.push(full)
    }
  }
  walk(DOCS_ROOT)
  console.log(`Found ${files.length} DOCX files\n`)

  for (const filePath of files) {
    const filename = basename(filePath)
    const owner = detectOwner(filePath)
    if (!owner) { console.log(`  SKIP ${filename} — no owner`); continue }

    const ownerId = deptBySlug[owner.slug]
    if (!ownerId) { console.log(`  SKIP ${filename} — owner dept not in DB`); continue }

    const audiences = detectAudience(filename)
    const category = detectOwnerCategory(filePath)
    const title = extractTitle(filename)
    const slug = slugify(title)

    console.log(`  ${filename}`)
    console.log(`    Owner: ${owner.name} / ${category}`)
    console.log(`    Audience: ${audiences.map(a => a.name).join(', ') || '(none detected)'}`)
    console.log(`    Title: ${title}`)

    try {
      const buffer = readFileSync(filePath)
      const doc = await prisma.document.create({
        data: {
          title,
          slug,
          fullContent: '',
          category,
          ownerDeptId: ownerId,
          authorId: admin.id,
          sourcePath: filePath,
        },
      })

      // Link audience departments
      for (const aud of audiences) {
        const audId = deptBySlug[aud.slug]
        if (audId) {
          await prisma.documentAudience.create({
            data: { documentId: doc.id, departmentId: audId },
          })
        }
      }

      const result = await parseDocx(buffer, doc.id)
      await prisma.document.update({
        where: { id: doc.id },
        data: { fullContent: result.markdown.substring(0, 100000) },
      })

      console.log(`    ✓ ${result.markdown.length.toLocaleString()} chars, ${result.imageCount} images`)
    } catch (err) {
      console.error(`    ✗ ${err}`)
    }
  }

  console.log('\nDone')
  await prisma.$disconnect()
}

main()
