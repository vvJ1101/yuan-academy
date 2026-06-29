/**
 * 将精简版文档写入数据库的 condensedContent 字段。
 * 不影响 fullContent 和 content。
 * 用法：npx tsx scripts/updateCondensedContent.ts
 */

import { PrismaClient } from '@prisma/client'
import { CONDENSED_DOCS } from './condensed-docs'

const prisma = new PrismaClient()

async function main() {
  console.log(`准备更新 ${CONDENSED_DOCS.length} 份文档的精简版...\n`)

  let updated = 0
  let skipped = 0

  for (const { slug, content } of CONDENSED_DOCS) {
    const doc = await prisma.document.findFirst({
      where: { slug },
      select: { id: true, title: true, slug: true },
    })

    if (!doc) {
      console.log(`  ✗ 未找到: slug="${slug}"`)
      skipped++
      continue
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        condensedContent: content,
        displayMode: 'both',
      },
    })

    console.log(`  ✓ ${doc.title}`)
    console.log(`    精简版 ${content.length.toLocaleString()} 字符`)
    updated++
  }

  console.log(`\n完成：${updated} 份更新，${skipped} 份跳过`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('更新失败:', err)
  prisma.$disconnect()
  process.exit(1)
})
