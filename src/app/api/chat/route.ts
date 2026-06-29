import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import Database from 'better-sqlite3'
import path from 'path'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { cacheKey, getCached, setCache } from '@/lib/ai-cache'

const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')
const MAX_PER_HOUR = 30

// Rate limiter: userId → { count, resetAt }
const rateLimit = new Map<string, { count: number; resetAt: number }>()

function getClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com/v1',
  })
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt: now + 3600_000 })
    return true
  }
  if (entry.count >= MAX_PER_HOUR) return false
  entry.count++
  return true
}

function buildSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/** Extract a relevant excerpt from document content around matched keywords */
function extractExcerpt(content: string, question: string, maxLen = 200): string {
  if (!content) return ''
  const cleanQ = question.replace(/[?？,，。.！!]/g, ' ').trim()
  const keywords = cleanQ.split(/\s+/).filter(k => k.length >= 2)
  if (keywords.length === 0) return content.substring(0, maxLen)

  // Find the paragraph with the most keyword matches
  const paragraphs = content.split(/\n\n+/)
  let bestPara = paragraphs[0] || ''
  let bestScore = 0

  for (const p of paragraphs) {
    const score = keywords.reduce((s, kw) => s + (p.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; bestPara = p }
  }

  // Trim to maxLen at nearest sentence boundary
  let excerpt = bestPara.trim()
  if (excerpt.length > maxLen) {
    excerpt = excerpt.substring(0, maxLen)
    const lastPeriod = Math.max(excerpt.lastIndexOf('。'), excerpt.lastIndexOf('. '), excerpt.lastIndexOf('\n'))
    if (lastPeriod > maxLen * 0.6) excerpt = excerpt.substring(0, lastPeriod + 1)
    excerpt += '…'
  }
  return excerpt
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return new Response('Unauthorized', { status: 401 })

  if (!checkRateLimit(session.id)) {
    return new Response(JSON.stringify({ error: `每小时最多 ${MAX_PER_HOUR} 次提问` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { documentId, question } = body
  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: '请输入问题' }), { status: 400 })
  }

  // ── Source Hit with full metadata ──
  interface SourceHit {
    id: string
    title: string
    snippet: string
    excerpt: string
    slug: string
    audienceSlug: string
    department: string
    departmentSlug: string
    category: string
    updatedAt: string
  }

  let hits: SourceHit[] = []

  if (documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        ownerDept: { select: { name: true, slug: true } },
        audiences: { select: { department: { select: { slug: true } } }, take: 1 },
      },
    })
    if (doc) {
      const audienceSlug = doc.audiences?.[0]?.department.slug || doc.ownerDept?.slug || 'general'
      const fullContent = doc.fullContent || doc.content || ''
      hits = [{
        id: doc.id,
        title: doc.title,
        snippet: fullContent.substring(0, 4000),
        excerpt: extractExcerpt(fullContent, question.trim()),
        slug: doc.slug,
        audienceSlug,
        department: doc.ownerDept?.name || '',
        departmentSlug: doc.ownerDept?.slug || '',
        category: doc.documentType || 'guide',
        updatedAt: doc.updatedAt.toISOString(),
      }]
    }
  }

  // Cross-document FTS search
  if (hits.length === 0 || !documentId) {
    const db = new Database(DB_PATH)
    try {
      const clean = question.replace(/['"*()^]/g, '')
      const ftsQuery = clean.includes(' ')
        ? clean.split(/\s+/).filter(Boolean).map((t: string) => `"${t}"`).join(' ')
        : clean

      const results = db.prepare(`
        SELECT d.id, d.title, COALESCE(NULLIF(d.fullContent,''), d.content) as content,
               d.slug, d.updatedAt, d.documentType,
               document_fts.audience_slug, document_fts.department
        FROM document_fts
        JOIN Document d ON document_fts.doc_id = d.id
        WHERE document_fts MATCH ?
        ORDER BY rank LIMIT 5
      `).all(ftsQuery) as any[]

      for (const r of results) {
        if (!hits.find(h => h.slug === r.slug)) {
          hits.push({
            id: r.id,
            title: r.title,
            snippet: (r.content || '').substring(0, 3000),
            excerpt: extractExcerpt(r.content || '', question.trim()),
            slug: r.slug,
            audienceSlug: r.audience_slug || 'marketing',
            department: r.department || '',
            departmentSlug: '',
            category: r.documentType || 'guide',
            updatedAt: r.updatedAt || new Date().toISOString(),
          })
        }
      }
    } catch { /* FTS failed */ } finally { db.close() }
  }

  // Fallback
  if (hits.length === 0) {
    const allDocs = await prisma.document.findMany({
      where: { slug: { not: '' } },
      take: 3,
      include: {
        ownerDept: { select: { name: true, slug: true } },
        audiences: { select: { department: { select: { slug: true } } }, take: 1 },
      },
    })
    hits = allDocs.map(d => ({
      id: d.id,
      title: d.title,
      snippet: (d.fullContent || '').substring(0, 2000),
      excerpt: '',
      slug: d.slug,
      audienceSlug: d.audiences?.[0]?.department.slug || d.ownerDept?.slug || 'general',
      department: d.ownerDept?.name || '',
      departmentSlug: d.ownerDept?.slug || '',
      category: d.documentType || 'guide',
      updatedAt: d.updatedAt.toISOString(),
    }))
  }

  // ── Build context for AI ──
  const sourceMeta = hits.map(h => ({
    id: h.id,
    title: h.title,
    department: h.department,
    departmentSlug: h.departmentSlug,
    slug: h.slug,
    audienceSlug: h.audienceSlug,
    category: h.category,
    updatedAt: h.updatedAt,
    excerpt: h.excerpt,
  }))

  const context = hits.map((h, i) => {
    const link = `/internal/docs/${h.audienceSlug}/${encodeURIComponent(h.slug)}`
    return `【来源${i + 1}：${h.title}】\n部门：${h.department}\n链接：${link}\n内容：\n${h.snippet}`
  }).join('\n\n---\n\n')

  // ── Enhanced system prompt ──
  const SYSTEM_PROMPT = `你是 YUAN SHOWROOM 企业知识库助手。严格基于提供的文档内容回答，禁止编造。

回答结构要求：
1. 以「**问题简短概括**」作为标题（如：**如何查看品牌确认订单？**）
2. 用清晰的编号步骤呈现操作流程
3. 如果涉及多个系统或部门，分小节说明
4. 重要提示用 💡 标注
5. 回答末尾标注来源编号，如「参考来源：1、2」
6. 用中文，语言精炼，避免 AI 套话（首先/其次/综上所述）

禁止：
- 编造文档中没有的信息
- 使用 AI 套话填充
- 回答与问题无关的内容`

  // ── Cache key: question + context fingerprint ──
  const ck = cacheKey('deepseek-chat', [
    { role: 'user', content: question.trim() + '|' + context.substring(0, 200) },
  ])

  // Shared: answer saved for ChatLog in both cache-hit and cache-miss paths
  let cachedAnswer = ''

  // ── Stream from DeepSeek (with cache) ──
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Event 1: Source metadata (always sent for UI source cards)
        controller.enqueue(encoder.encode(buildSSE({ type: 'meta', sources: sourceMeta })))

        // Check cache before hitting DeepSeek API
        const cached = getCached(ck)
        if (cached) {
          let parsed: { answer: string; related?: string[] } = { answer: '' }
          try { parsed = JSON.parse(cached) } catch { parsed = { answer: cached } }
          cachedAnswer = parsed.answer
          controller.enqueue(encoder.encode(buildSSE({ type: 'token', content: parsed.answer })))
          if (parsed.related?.length) {
            controller.enqueue(encoder.encode(buildSSE({ type: 'related', questions: parsed.related })))
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        } else {
          // Event 2: AI answer streaming
          const response = await getClient().chat.completions.create({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `参考以下知识库文档内容：\n\n${context}\n\n用户问题：${question}` },
            ],
            max_tokens: 800,
            temperature: 0.3,
            stream: true,
          })

          let fullAnswer = ''
          for await (const chunk of response) {
            const token = chunk.choices?.[0]?.delta?.content
            if (token) {
              fullAnswer += token
              controller.enqueue(encoder.encode(buildSSE({ type: 'token', content: token })))
            }
          }
          cachedAnswer = fullAnswer

          // Event 3: Generate related questions
          let relatedQuestions: string[] = []
          try {
            const relatedRes = await getClient().chat.completions.create({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: 'Based on the user question and context, generate 3-4 related follow-up questions in Chinese. Return ONLY a JSON array of strings, no other text. Example: ["如何查看未发货订单？","退货流程是什么？"]' },
                { role: 'user', content: `Context: ${hits.map(h => h.title).join('、')}\nQuestion: ${question}\nAnswer: ${fullAnswer.substring(0, 500)}` },
              ],
              max_tokens: 150,
              temperature: 0.3,
            })
            const relatedRaw = (relatedRes.choices[0]?.message?.content || '').trim()
            try {
              relatedQuestions = JSON.parse(relatedRaw)
              if (Array.isArray(relatedQuestions) && relatedQuestions.length > 0) {
                controller.enqueue(encoder.encode(buildSSE({ type: 'related', questions: relatedQuestions })))
              }
            } catch { /* parse failed, skip related */ }
          } catch { /* related generation failed */ }

          // Cache the result (10 min TTL)
          try {
            setCache(ck, JSON.stringify({ answer: fullAnswer, related: relatedQuestions }))
          } catch { /* cache set failed */ }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        }

        // Save to ChatLog
        try {
          await prisma.chatLog.create({
            data: {
              userId: session.id,
              question: question.trim(),
              answer: cachedAnswer,
              sources: JSON.stringify(sourceMeta.map(s => s.title)),
            },
          })
        } catch { /* silent */ }
      } catch (err: any) {
        controller.enqueue(encoder.encode(buildSSE({ type: 'error', content: err.message || 'AI 服务不可用' })))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
