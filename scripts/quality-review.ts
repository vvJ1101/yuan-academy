/**
 * AI 解析质量批量审核脚本
 * 用法：npx tsx scripts/quality-review.ts [--limit N]
 * 输出：scripts/quality-report.md
 */
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { writeFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com/v1',
})

const SYSTEM_PROMPT = `你是企业知识库审核主管。

你的任务：审核 AI 生成的精简版是否达到企业培训和知识库使用标准。

输入：
1. 原始文档（fullContent）
2. AI 生成的结构化结果（extractedJson）
3. AI 生成的精简版（condensedContent）

你的工作不是重写。你的工作是评分和发现问题。

## 审核维度（V3 标准）

### 1. 图片保留率（20分）
检查：[IMAGE_X] 占位符数量是否与原文图片数量一致。图片顺序是否正确。每缺一张扣3分。

### 2. 步骤完整率（20分）
检查：是否遗漏操作步骤、是否合并步骤、是否改变顺序。每缺一步扣2分。

### 3. 系统路径提取率（10分）
检查：原文中的系统名称和菜单路径是否正确提取。完全缺失扣10分，部分缺失扣5分。

### 4. Checklist生成率（15分）
检查：关键操作是否生成了审核检查清单。缺少扣10分，不完整扣5分。

### 5. 风险点识别率（10分）
检查：原文中的风险描述是否被正确提取为风险控制点。

### 6. 审批链完整率（10分）
检查：审批人、审批部门、审批顺序是否在"谁负责"中保留。

### 7. 去AI味程度（5分）
检查是否出现：首先、其次、最后、综上所述、值得注意的是、以下内容、总结如下。每发现一次扣1分。

### 8. 实际可执行性（10分）
检查：新员工能否仅凭精简版完成操作、培训主管能否直接用于培训。

## 输出格式（纯 JSON）

{
  "totalScore": 85,
  "dimensions": {
    "imageRetention": { "score": 17, "maxScore": 20, "issues": [] },
    "stepCompleteness": { "score": 18, "maxScore": 20, "issues": [] },
    "menuPathExtraction": { "score": 8, "maxScore": 10, "issues": [] },
    "checklistGeneration": { "score": 12, "maxScore": 15, "issues": [] },
    "riskIdentification": { "score": 8, "maxScore": 10, "issues": [] },
    "approvalIntegrity": { "score": 9, "maxScore": 10, "issues": [] },
    "antiAI": { "score": 5, "maxScore": 5, "issues": [] },
    "executability": { "score": 8, "maxScore": 10, "issues": [] }
  },
  "allIssues": [],
  "riskLevel": "低风险",
  "canPublish": true,
  "summary": "..."
}

## 规则
- 只做审核，禁止修改内容
- 如实评分，不要虚高
- 如果某维度找不到原文对应内容（如原文无表格），该维度给满分
- 只输出 JSON，禁止额外文字，禁止 Markdown 代码块`

interface DimensionResult {
  score: number; maxScore: number; issues: string[]
}

interface ReviewResult {
  totalScore: number
  dimensions: Record<string, DimensionResult>
  allIssues: string[]
  riskLevel: string
  canPublish: boolean
  summary: string
}

interface DocReview {
  id: string; title: string; score: number; riskLevel: string; canPublish: boolean
  issues: string[]; error?: string
}

function extractJson(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  const start = s.indexOf('{'), end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.substring(start, end + 1)
  return s
}

async function reviewDocument(id: string, title: string, fullContent: string, condensedContent: string, extractedJson: string): Promise<DocReview> {
  const fc = fullContent.substring(0, 6000)
  const cc = condensedContent.substring(0, 4000)
  const ej = extractedJson.substring(0, 2000)

  const userPrompt = `## 原始文档（fullContent）\n${fc}\n\n## AI 结构化结果（extractedJson）\n${ej}\n\n## AI 精简版（condensedContent）\n${cc}\n\n请审核并输出 JSON。`

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content || ''
    const json = extractJson(raw)
    const result: ReviewResult = JSON.parse(json)

    return {
      id, title, score: result.totalScore, riskLevel: result.riskLevel,
      canPublish: result.canPublish, issues: result.allIssues,
    }
  } catch (e: any) {
    return { id, title, score: 0, riskLevel: '未知', canPublish: false, issues: [], error: e.message }
  }
}

async function main() {
  const limitArg = process.argv.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0

  const docs = await prisma.document.findMany({
    where: { condensedContent: { not: '' } },
    select: { id: true, title: true, fullContent: true, condensedContent: true, extractedJson: true },
    orderBy: { updatedAt: 'desc' },
    take: limit || 50,
  })

  console.log(`📋 开始审核 ${docs.length} 篇文档...\n`)

  const results: DocReview[] = []
  let done = 0
  for (const doc of docs) {
    process.stdout.write(`  [${++done}/${docs.length}] ${doc.title.substring(0, 50)}... `)
    const r = await reviewDocument(doc.id, doc.title, doc.fullContent, doc.condensedContent, doc.extractedJson)
    results.push(r)
    const flag = r.error ? '❌' : r.canPublish ? '✅' : `⚠️ ${r.score}分`
    console.log(flag)
  }

  // ── Statistics ──
  const scores = results.filter(r => !r.error).map(r => r.score)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const passCount = results.filter(r => r.score >= 80).length
  const passRate = docs.length > 0 ? Math.round((passCount / docs.length) * 100) : 0
  const failedDocs = results.filter(r => r.score < 80 && !r.error)
  const errorDocs = results.filter(r => r.error)

  // Issue frequency
  const issueFreq = new Map<string, number>()
  for (const r of results) {
    for (const issue of r.issues) {
      const key = issue.substring(0, 60)
      issueFreq.set(key, (issueFreq.get(key) || 0) + 1)
    }
  }
  const topIssues = Array.from(issueFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // ── Generate Report ──
  let report = `# AI 解析质量审核报告\n\n`
  report += `> 审核时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`
  report += `> 审核模型：DeepSeek Chat\n\n`
  report += `## 总览\n\n`
  report += `| 指标 | 数值 |\n|------|------|\n`
  report += `| 测试文档数 | ${docs.length} |\n`
  report += `| 平均评分 | **${avgScore}/100** |\n`
  report += `| 通过率（≥80分） | ${passRate}%（${passCount}/${docs.length}） |\n`
  report += `| 需人工审核（<80分） | ${failedDocs.length} 篇 |\n`
  report += `| 审核失败 | ${errorDocs.length} 篇 |\n\n`

  report += `## 评分分布\n\n`
  const ranges = [
    { min: 90, max: 100, label: '90-100（优秀）' },
    { min: 80, max: 89, label: '80-89（良好）' },
    { min: 60, max: 79, label: '60-79（一般）' },
    { min: 0, max: 59, label: '0-59（差）' },
  ]
  report += `| 区间 | 数量 | 占比 |\n|------|------|------|\n`
  for (const range of ranges) {
    const count = scores.filter(s => s >= range.min && s <= range.max).length
    report += `| ${range.label} | ${count} | ${Math.round((count / docs.length) * 100)}% |\n`
  }

  if (topIssues.length > 0) {
    report += `\n## 问题 TOP ${topIssues.length}\n\n`
    report += `| 排名 | 问题 | 出现次数 |\n|------|------|------|\n`
    topIssues.forEach(([issue, count], i) => {
      report += `| ${i + 1} | ${issue} | ${count} |\n`
    })
  }

  if (failedDocs.length > 0) {
    report += `\n## 需人工审核的文档（< 80分）\n\n`
    report += `| 文档 | 评分 | 风险等级 |\n|------|------|------|\n`
    for (const d of failedDocs) {
      report += `| ${d.title.substring(0, 40)} | ${d.score} | ${d.riskLevel} |\n`
    }
  }

  if (errorDocs.length > 0) {
    report += `\n## 审核失败\n\n`
    for (const d of errorDocs) {
      report += `- ${d.title}: ${d.error}\n`
    }
  }

  // Dimension-level stats
  report += `\n## 维度统计\n\n`
  report += `| 维度 | 常见问题数 |\n|------|------|\n`
  const dims = ['titleAccuracy', 'stepCompleteness', 'approvalIntegrity', 'imageRetention', 'tableRetention', 'antiAI', 'executability']
  const dimLabels: Record<string, string> = {
    titleAccuracy: '标题准确率', stepCompleteness: '步骤完整率', approvalIntegrity: '审批链完整率',
    imageRetention: '图片保留率', tableRetention: '表格保留率', antiAI: '去AI味', executability: '可执行性',
  }
  for (const dim of dims) {
    const count = results.filter(r => r.issues.some(i => dimLabels[dim] && i.includes(dimLabels[dim].slice(0, 2)))).length
    report += `| ${dimLabels[dim] || dim} | ${count} |\n`
  }

  report += `\n## 下一轮 Prompt 优化建议\n\n`
  if (avgScore >= 85) {
    report += `- 当前平均分 ${avgScore} 分，已达到 85 分目标。持续监控即可。\n`
  } else {
    report += `- 当前平均分 ${avgScore} 分，目标 85 分，差距 ${85 - avgScore} 分。\n`
  }
  if (topIssues.length > 0) {
    report += `- 优先解决 TOP3 问题：${topIssues.slice(0, 3).map(i => i[0]).join('、')}\n`
  }
  report += `- 考虑在 Phase 2 Prompt 中增加具体约束来解决高频问题\n`

  const reportPath = join(__dirname, 'quality-report.md')
  writeFileSync(reportPath, report, 'utf-8')
  console.log(`\n✅ 报告已生成：${reportPath}`)
  console.log(`   平均分：${avgScore}/100 | 通过率：${passRate}% | TOP问题：${topIssues.length} 类`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
