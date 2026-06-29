import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'
import { prisma } from '@/lib/prisma'

type Intent = 'question' | 'document' | 'sop' | 'howto'

const aiClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com/v1',
})

const INTENT_PROMPT = `Classify the user query into exactly one intent. Reply with ONLY the word.

Intents:
- question: factual answer or explanation (what/why/when)
- document: searching for a document by name
- sop: business process or workflow
- howto: how to perform an action

Examples:
"什么是云仓" → question
"如何申请报销" → howto
"订货会流程" → sop
"员工手册" → document

Query: `

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query } = await req.json().catch(() => ({}))
  if (!query?.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const q = query.trim()

  // Step 1: FTS search (always get document context)
  const ftsDocs = await ftsSearch(q, session)

  // Step 2: Intent classification
  let intent: Intent = 'document'
  try {
    const res = await aiClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: INTENT_PROMPT + q }],
      max_tokens: 10,
      temperature: 0,
    })
    const raw = (res.choices[0]?.message?.content || '').trim().toLowerCase()
    if (['question', 'document', 'sop', 'howto'].includes(raw)) intent = raw as Intent
  } catch { /* fallback to document */ }

  // Step 3: Build response by intent
  const topDoc = ftsDocs[0]

  if (intent === 'question') {
    return NextResponse.json({
      intent: 'question',
      summary: `关于「${q}」`,
      documents: ftsDocs.slice(0, 3),
    })
  }

  if (intent === 'sop' || intent === 'howto') {
    return NextResponse.json({
      intent,
      summary: topDoc ? `根据「${topDoc.title}」的流程指引` : `搜索「${q}」的结果`,
      primaryDoc: topDoc || null,
      documents: ftsDocs.slice(0, 4),
    })
  }

  return NextResponse.json({
    intent: 'document',
    summary: ftsDocs.length > 0 ? `找到 ${ftsDocs.length} 篇相关文档` : '未找到相关文档',
    documents: ftsDocs.slice(0, 5),
  })
}

// ── Prisma FTS Search + Permission Filter ──
async function ftsSearch(q: string, session: any) {
  try {
    // Use FTS5 for proper full-text search
    const Database = (await import('better-sqlite3')).default
    const dbPath = (await import('path')).join(process.cwd(), 'prisma', 'dev.db')
    const db = new Database(dbPath)
    const clean = q.replace(/['"*()^]/g, '').replace(/\s+/g, ' ').trim()
    // Check if FTS table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='document_fts'").get()
    let docIds: string[] = []
    if (tableCheck) {
      const ftsRows = db.prepare(`SELECT rowid FROM document_fts WHERE document_fts MATCH ? ORDER BY rank LIMIT 20`).all(clean) as { rowid: number }[]
      if (ftsRows.length > 0) {
        const rowIds = ftsRows.map(r => r.rowid)
        const dbDocs = db.prepare(`SELECT id FROM Document WHERE rowid IN (${rowIds.join(',')})`).all() as { id: string }[]
        docIds = dbDocs.map(d => d.id)
      }
    }
    db.close()

    // Fallback to LIKE if FTS returns nothing
    const where = buildDocumentWhere(session)
    if (docIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: { ...where, id: { in: docIds } },
        select: { id: true, title: true, slug: true, category: true,
          ownerDept: { select: { name: true, slug: true } },
          audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
        take: 10,
      })
    }

    // Fallback: LIKE-based search if FTS returned nothing
    const terms = clean.split(/\s+/).filter(Boolean)
    const docs = await prisma.document.findMany({
      where: { ...where, OR: terms.map(t => ({ OR: [{ title: { contains: t } }, { fullContent: { contains: t } }] })) },
      select: { id: true, title: true, slug: true, category: true,
        ownerDept: { select: { name: true, slug: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 10,
    })
    return docs.map(d => ({ id: d.id, title: d.title, snippet: '',
      department: d.ownerDept?.name || '',
      category: d.category,
      slug: d.slug,
      audienceSlug: d.audiences?.[0]?.department?.slug || d.ownerDept?.slug || '',
    }))
  } catch {
    return []
  }
}
