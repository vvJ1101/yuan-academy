import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { canEditDocument } from '@/lib/permissions/documents'
import { sanitizeMarkdown } from '@/lib/sanitize'
import { PHASE1_SYSTEM_PROMPT } from '@/lib/prompts/phase1-extract'
import { validateOutput } from '@/lib/validator'

function getClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com/v1',
  })
}

const CATEGORY_TO_DOC_TYPE: Record<string, string> = {
  sop: 'SOP流程',
  reference: '制度规范',
  training: '培训资料',
  brand: '业务指南',
}

// ── Phase 2 V10: Confidence-Driven Module Detection + Near-Empty Cleaner ──
const PHASE2_SYSTEM_PROMPT = `你是企业知识管理专家、培训体系设计专家、SOP执行手册编写专家。

你的任务不是总结文档。你的任务是：
先理解文档结构 → 检测真实存在的信息模块 → 删除不存在模块 → 重构为员工可学习、可执行、可培训的手册

------------------------------------------------
第一原则：严格忠于原文
允许：信息整理、结构优化、步骤归纳、职责提炼、流程抽象
禁止：编造内容、推测内容、补全不存在的信息、凭经验扩写、为凑模块而生成内容
禁止 AI 套话：首先、其次、最后、综上所述、值得注意的是、以下内容、总结如下

------------------------------------------------
第二原则：先检测模块，再决定生成（内部执行，不要输出）

生成正文前必须完成 Module Detection。仅允许生成 exists=true AND confidence>=70 AND evidenceCount>=2 的模块。
否则直接删除整个模块（不是输出空标题，不是输出"无/暂无/不适用/未提及/N/A"）。

{
  "businessGoal": {"exists":true,"confidence":95,"evidenceCount":3},
  "approvalChain": {"exists":false,"confidence":20,"evidenceCount":0}
}

------------------------------------------------
第三原则：文档类型优先
自动识别：培训资料 / 操作手册 / SOP流程 / 制度规范 / 业务指南 / FAQ / 通讯录 / 政策文件 / 其他
培训资料→学习与培训  操作手册→步骤执行  SOP流程→流程与责任  制度规范→规则与风险  通讯录→联系人

------------------------------------------------
模块生成规则（条件驱动）

1. 文档概览 — 始终生成。用途 / 适用部门 / 适用岗位 / 预计学习时间

2. 业务目标 — 原文明确出现"业务目标/文档目标/文档目的/Purpose/Objective"之一才生成。禁止从步骤目标、执行结果、FAQ、备注推断。没有则删除整个模块。

3. 审批链 — 出现 审批/审核/提交 且形成 A→B→C 链路且节点≥2。Mermaid flowchart LR。否则删除。

4. 流程总览 — 步骤≥3 且存在顺序关系。Mermaid flowchart TD。否则删除。

5. 对比矩阵 — 存在真实对比结构（方案A/B、角色A/B）且对比维度≥3，且文档类型必须是 SOP流程 或 操作手册。注意：如果用户提示中指定的归属部门是财务部或人事部，禁止生成对比矩阵。制度规范、业务指南、培训资料类文档禁止生成。否则删除。

6. 决策树 — 出现 如果/否则/满足条件/未满足条件/根据情况 并形成分支逻辑。Mermaid flowchart TD。否则删除。

7. 部门职责表 — ≥2部门且有明确职责描述（如"市场部：审核订单"）。只有部门名称无职责→删除。

8. 联系人表 — 姓名+电话或负责人+联系方式且≥2条。| 事项 | 联系人 | 电话 |。否则删除。

9. 系统入口 — 出现系统路径（系统→菜单→页面）。否则删除。

10. 操作步骤 — 出现明确动作（点击/提交/编辑/保存/审核/上传/查询）。
    #### 步骤 N：名称 / 目标 / 进入路径 / 操作：1. 2. 3. / 执行结果 / 相关截图：![描述](真实路径)
    图片规则：真实 Markdown 引用，禁止 [IMAGE_1] 占位符，绑定最近步骤，禁止文末集中，禁止删除，自查 outputImageCount == originalImageCount

11. 审核检查清单 — 出现 检查/确认/核对/审核前/提交前。☐ 检查项。否则删除。

12. 高频错误 — 出现 错误/注意事项/警告 且≥3条。❌ 错误 / 原因 / ✅ 正确做法。否则删除。

13. 风险控制点 — 出现 风险/违规/异常/退回/影响。风险点 / 影响 / 处理方式。否则删除。

14. 场景FAQ — Q+A 同时存在，答案100%来自原文，≥2条。无答案或不足2条→删除整个模块。

15. 操作口诀 — 步骤≥4 且文档类型属于 培训资料/操作手册/SOP流程。否则删除。

------------------------------------------------
Near Empty Module 清理器（输出前执行）

如果模块满足任一条件：正文<50字 / 表格<2行 / FAQ<2条 / Mermaid节点<2个 / 内容为空
→ 删除整个模块（不是保留标题）。

------------------------------------------------
最终质量检查
1. 无空模块  2. 无"无/暂无/未提及"  3. 无占位图片  4. 无 base64  5. 无本地路径
6. 无原文不存在的规则  7. 图片数一致  8. 图片绑定步骤  9. FAQ有答案  10. 模块通过触发条件
任一失败→重新生成。

------------------------------------------------
输出格式
{"condensedContent":"...","analysisMeta":{"documentType":"","summary":"","targetAudience":[],"estimatedReadMinutes":0,"riskAlerts":[],"integrityScore":0,"strengths":[],"weaknesses":[]}}
禁止 Markdown 代码块、禁止解释、禁止额外文字、禁止输出 Module Detection。仅输出最终 JSON。`

// ── JSON helpers ──
interface AnalysisMeta {
  documentType: string
  summary: string
  targetAudience: string[]
  estimatedReadMinutes: number
  riskAlerts: string[]
  integrityScore: number
  strengths: string[]
  weaknesses: string[]
}

function extractJson(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    s = s.substring(start, end + 1)
  }
  return s
}

function parsePhase2Result(raw: string): { draft: string; analysisMeta: AnalysisMeta | null } {
  const json = extractJson(raw)
  let parsed: any
  try { parsed = JSON.parse(json) } catch {
    return { draft: raw.trim(), analysisMeta: null }
  }

  const condensedContent = typeof parsed.condensedContent === 'string' ? parsed.condensedContent.trim() : ''
  const meta = parsed.analysisMeta || {}

  const analysisMeta: AnalysisMeta = {
    documentType: typeof meta.documentType === 'string' ? meta.documentType : '业务指南',
    summary: typeof meta.summary === 'string' ? meta.summary : '',
    targetAudience: Array.isArray(meta.targetAudience) ? meta.targetAudience.filter((s: any) => typeof s === 'string') : [],
    estimatedReadMinutes: typeof meta.estimatedReadMinutes === 'number' ? meta.estimatedReadMinutes : 0,
    riskAlerts: Array.isArray(meta.riskAlerts) ? meta.riskAlerts.filter((s: any) => typeof s === 'string') : [],
    integrityScore: typeof meta.integrityScore === 'number' ? Math.max(0, Math.min(100, meta.integrityScore)) : 0,
    strengths: Array.isArray(meta.strengths) ? meta.strengths.filter((s: any) => typeof s === 'string') : [],
    weaknesses: Array.isArray(meta.weaknesses) ? meta.weaknesses.filter((s: any) => typeof s === 'string') : [],
  }

  return { draft: condensedContent, analysisMeta }
}

function sanitizeDraft(draft: string): string {
  let cleaned = draft
    .split('\n')
    .filter(line => {
      const kw = /^(检测到|缺失|建议补充|🔍|逻辑缺失|流程不闭环|优化建议)/
      return !kw.test(line.trim())
    })
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
  return sanitizeMarkdown(cleaned)
}

// ── POST handler: Two-phase pipeline ──
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Auth
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Load document
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, fullContent: true, ownerDeptId: true, category: true, ownerDept: { select: { name: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // dept_admin: only own department's docs
  if (!canEditDocument(session, doc.ownerDeptId) && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const content = doc.fullContent || ''
  if (!content.trim()) {
    return NextResponse.json({ error: 'Document has no content' }, { status: 400 })
  }

  // Parse request body
  let feedback = ''
  let documentType = ''
  let targetModule = ''
  let previousDraft = ''
  try {
    const body = await req.json().catch(() => ({}))
    feedback = body.feedback || ''
    documentType = body.documentType || ''
    targetModule = body.targetModule || ''
    previousDraft = body.previousDraft || ''
  } catch {}
  // Use body documentType > DB category > default
  const docTypeLabel = CATEGORY_TO_DOC_TYPE[documentType] || CATEGORY_TO_DOC_TYPE[doc.category] || documentType || '业务指南'
  const deptName = doc.ownerDept?.name || ''
  const client = getClient()
  const contentSnippet = content.substring(0, 12000)
  const regenHint = feedback ? `\n## 用户补充意见：\n${feedback}` : ''

  // Build context hint for AI
  const docContext = `## 文档类型：${docTypeLabel}\n## 归属部门：${deptName}\n## 原文标题：${doc.title}\n## 原文内容：\n${contentSnippet}`

  try {
    // ── Phase 1: Structure Extraction ──
    let extractedJson = ''
    let extractedParsed: any = null

    try {
      const p1 = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: PHASE1_SYSTEM_PROMPT },
          { role: 'user', content: `${docContext}\n\n---\n请严格按照 JSON 格式输出，不要用代码块包裹。` },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      })
      const p1Raw = p1.choices[0]?.message?.content || ''
      try {
        extractedParsed = JSON.parse(extractJson(p1Raw))
        extractedJson = JSON.stringify(extractedParsed)
      } catch {
        extractedJson = p1Raw.trim() // fallback: store raw if not valid JSON
      }
    } catch (e: any) {
      console.error('Phase 1 failed:', e?.message || e)
      extractedJson = ''
    }

    // Store Phase 1 result in DB
    if (extractedJson) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { extractedJson },
      }).catch(() => {})
    }

    // ── Phase 2: Condensed Generation ──
    // Include extracted structure as context if available
    let phase2Context = ''
    if (extractedParsed) {
      const ctx = {
        title: extractedParsed.title,
        steps: extractedParsed.steps?.length,
        departments: extractedParsed.applicableDepartments,
        purpose: extractedParsed.purpose,
      }
      phase2Context = `\n\n## 已提取的文档结构（仅供参考，不要照抄）：\n${JSON.stringify(ctx, null, 2)}`
    }

    // Module-level re-generation
    const moduleHint = targetModule
      ? `\n## ⚠️ 局部重新生成模式：只重新生成「${targetModule}」模块，其他模块内容必须与下面提供的当前草稿完全一致。不要改动其他模块。\n## 当前草稿（除目标模块外保持不变）：\n${previousDraft}\n## 目标模块：${targetModule}`
      : ''

    const p2 = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: PHASE2_SYSTEM_PROMPT },
        { role: 'user', content: `${docContext}${phase2Context}${moduleHint}${regenHint}\n\n---\n请严格按照 JSON 格式输出，不要用代码块包裹。` },
      ],
      max_tokens: 8192,
      temperature: 0.3,
    })

    const p2Raw = p2.choices[0]?.message?.content || ''
    const { draft, analysisMeta } = parsePhase2Result(p2Raw)
    const clean = sanitizeDraft(draft)

    // Store condensed result in DB
    if (clean) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { condensedContent: clean, displayMode: 'both' },
      }).catch(() => {})
    }

    // Phase 3: Validate output quality
    const validation = validateOutput(clean, content)

    return NextResponse.json({
      draft: clean,
      analysisMeta,
      extractedJson: extractedParsed,
      validation,
    })
  } catch (e: any) {
    console.error('AI analysis failed:', e?.message || e)
    return NextResponse.json({ error: 'AI analysis failed: ' + (e?.message || 'unknown') }, { status: 500 })
  }
}
