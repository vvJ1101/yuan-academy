'use client'

import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AIChat } from '@/components/internal/ai-chat'
import { Mermaid } from '@/components/internal/mermaid-renderer'
import { EditableMarkdown } from '@/components/internal/editable-markdown'
import { Pencil, Settings, Trash2, Lightbulb, AlertTriangle } from 'lucide-react'

// ── Types ──
interface Doc {
  id?: string; title: string; content: string; category: string
  condensedContent?: string; displayMode?: string
  department: { name: string }; author: { name: string }
  updatedAt: Date | string; audiences?: string[]
  ownerDeptId?: string
}

interface SOPAnalysis {
  objective: string; chapterFlow: string[]; roles: { dept: string; duty: string }[]
  docFlow: string[]; comparison: { label: string; cols: string[]; rows: string[][] } | null
  warnings: string[]; mnemonic: string[]
}

interface TocItem { id: string; level: number; num: string; text: string }
interface QualityReport { headings: boolean; numbering: boolean; images: number; captions: boolean; comparison: boolean; flow: boolean }
const catLabels: Record<string, string> = { training: '培训资料', sop: 'SOP', reference: '企业制度', brand: '品牌资产' }

// ── Content Analysis ──
/** Detect if condensed content uses the new 9-section AI format */
function isNewFormatCondensed(md: string): boolean {
  const markers = ['文档摘要', '核心流程图', '流程步骤拆解', '关键知识点', '操作要点', '责任矩阵', 'FAQ', '风险提示', '完整性评分']
  const count = markers.filter(m => md.includes(m)).length
  return count >= 3
}

function analyzeContent(md: string, docTitle?: string): SOPAnalysis {
  const lines = md.split('\n')
  const analysis: SOPAnalysis = { objective: '', chapterFlow: [], roles: [], docFlow: [], comparison: null, warnings: [], mnemonic: [] }
  let inFirstParagraph = true
  const seenDepts = new Set<string>()

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    if (inFirstParagraph && !t.match(/^[#!\-*|>]/) && t.length > 20) {
      if (!analysis.objective) analysis.objective = t
      if (t.match(/^[#]/)) inFirstParagraph = false
    }

    const roleMatch = t.match(/(市场部|商品部|品牌部|财务部|人事部|品牌方|客户经理)/)
    if (roleMatch && !seenDepts.has(roleMatch[1])) {
      seenDepts.add(roleMatch[1])
      const ctx = t.substring(t.indexOf(roleMatch[1])).replace(/[。；\]\[]/g, ' ').replace(/\s+/g, ' ').substring(0, 40).trim()
      analysis.roles.push({ dept: roleMatch[1], duty: ctx.length > 5 ? ctx : '相关操作' })
    }

    if (t.match(/注意|重要|警告|⚠|必须|严禁|禁止|禁忌|杜绝|一定不|切勿|需要特别|务必|切记|不可|不得|不准/) && t.length > 4) {
      let c = t.replace(/^[⚠\s#*>\-—]+/, '').replace(/^\d+[.、)）]\s*/, '').trim()
      if (!analysis.warnings.includes(c)) analysis.warnings.push(c.substring(0, 150))
    }

    if (t.match(/渠道订单|回款单|出货指令单|订金收入单|余额转账单|应收费用单|采购单|库存调整单|仓库出货单/)) {
      const docs = t.match(/(渠道订单|回款单|出货指令单|订金收入单|余额转账单|应收费用单|采购单|库存调整单|仓库出货单)/g) || []
      docs.forEach(d => { if (!analysis.docFlow.includes(d)) analysis.docFlow.push(d) })
    }
  }

  if (md.includes('云仓') && (md.includes('现货') || md.includes('期货'))) {
    analysis.comparison = {
      label: '订单类型对比', cols: ['对比项', '云仓', '现货', '期货'],
      rows: [
        ['负责部门', '市场部', '商品部', '商品部'],
        ['是否截单', '否', '是（限定时日）', '是（限定时日）'],
        ['回款要求', '100% 回款', '100% 回款', '50% 订金 + 尾款'],
        ['审核方式', '提交人自行审核', '提交财务审核', '提交财务审核'],
        ['是否转采购', '否', '是（商品部操作）', '是（商品部操作）'],
        ['转发货条件', '自行审核后提交', '财务审核后提交', '尾款收齐+审核后提交'],
        ['退换货处理', '需经商品部退货处理', '需经商品部退货处理', '需经商品部退货处理'],
      ],
    }
  }

  if (md.includes('云仓')) analysis.mnemonic.push('云仓三步：检查订单 → 回款登记（自行审核）→ 提交出货')
  if (md.includes('现货')) analysis.mnemonic.push('现货四步：截单 → 转采购 → 回款审核 → 转发货')
  if (md.includes('期货')) analysis.mnemonic.push('期货五步：截单 → 转采购 → 收订金 → 收尾款 → 转发货')
  if (md.includes('采购单') && md.includes('库存')) analysis.mnemonic.push('品牌方四步：确认采购单 → 维护库存 → 商品配货 → 品牌发货')
  if (md.includes('意向订单') || md.includes('订单数据')) analysis.mnemonic.push('数据查看三步：意向订单 → 确认订单 → 汇总分析')
  // 财务对账口诀 — only for 财务部 docs
  if (docTitle && docTitle.includes('财务')) {
    analysis.mnemonic.push('财务对账：核对数据 → 确认无误 → 生成报表')
  }
  if (analysis.mnemonic.length === 0 && analysis.roles.length >= 2) {
    analysis.mnemonic.push(`${analysis.roles.map(r => r.dept).join(' + ')} 协同完成业务操作`)
  }

  // For docs with order type comparison, replace flat doc flow with per-type flows
  if (analysis.comparison) {
    analysis.docFlow = []
  }

  return analysis
}

// ── Content cleaner: strip mermaid flowcharts & diagram-only sections ──
// ── Content processing: preserve original structure ──
function numberContent(md: string, chapterFlow: string[], tocItems: TocItem[]): string {
  let lines = reorderProductDoc(md.split('\n'))
  const result: string[] = []
  let h1Seq = 0, h2Seq = 0

  for (const line of lines) {
    const h1m = line.match(/^#\s+(.+)/)
    if (h1m) {
      const text = h1m[1]
      if (text === '目录' || text === '目 录') continue
      h1Seq++; h2Seq = 0
      chapterFlow.push(text)
      result.push('', line, '')
      tocItems.push({ id: `ch-${h1Seq}`, level: 1, num: `${h1Seq}`, text })
      continue
    }

    const h2m = line.match(/^##\s+(.+)/)
    if (h2m) {
      const text = h2m[1]
      if (h1Seq === 0) { h1Seq++; chapterFlow.push(text); result.push('', line, ''); continue }
      h2Seq++
      result.push('', line, '')
      tocItems.push({ id: `ch-${h1Seq}-${h2Seq}`, level: 2, num: `${h1Seq}.${h2Seq}`, text })
      continue
    }

    const h3m = line.match(/^###\s+(.+)/)
    if (h3m) {
      const text = h3m[1]
      if (h1Seq === 0) { result.push('', line, ''); continue }
      result.push('', line, '')
      tocItems.push({ id: `ch-${h1Seq}-${h2Seq}-${tocItems.filter(t => t.level === 3).length + 1}`, level: 3, num: `${h1Seq}.${h2Seq}.${tocItems.filter(t => t.level === 3).length + 1}`, text })
      continue
    }

    result.push(line)
  }

  return result.join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

/** Reorder 商品部 doc: move system basics (建档, 联欣) to appendix after operational content */
function reorderProductDoc(lines: string[]): string[] {
  const joined = lines.join('\n')
  // Only apply to 商品部 docs (detected by presence of both 建档 and 运作流程)
  if (!joined.includes('建档') || !joined.includes('运作流程')) return lines

  // Find chapter boundaries: split by H1/H2 headings
  const chapters: { heading: string; content: string[]; isAppendix: boolean }[] = []
  let current: string[] = []
  let currentHeading = ''
  let currentIsAppendix = false

  for (const line of lines) {
    const h1m = line.match(/^#\s+(.+)/)
    const h2m = line.match(/^##\s+(.+)/)

    if (h1m || h2m) {
      if (current.length > 0 || currentHeading) {
        chapters.push({ heading: currentHeading, content: current, isAppendix: currentIsAppendix })
      }
      const title = (h1m || h2m)![1]
      currentHeading = line
      current = []
      // Mark as appendix: 建档说明, 联欣操作手册, 主题管理
      currentIsAppendix = /建档|联欣系统操作|主题管理/.test(title)
    } else {
      current.push(line)
    }
  }
  if (current.length > 0 || currentHeading) {
    chapters.push({ heading: currentHeading, content: current, isAppendix: currentIsAppendix })
  }

  // Check if reorder is needed: appendix chapters NOT at the end
  const lastOpsIdx = chapters.map((c, i) => (!c.isAppendix && c.heading) ? i : -1).filter(i => i >= 0).pop() ?? -1
  const hasAppendixBeforeEnd = chapters.some((c, i) => c.isAppendix && i < lastOpsIdx)
  if (!hasAppendixBeforeEnd || lastOpsIdx < 0) return lines

  // Reorder: operational first, then appendix
  const ops = chapters.filter(c => !c.isAppendix)
  const appendix = chapters.filter(c => c.isAppendix)
  // Add appendix header
  const reordered = [...ops]
  if (appendix.length > 0) {
    reordered.push({ heading: '# 附录：系统基础信息', content: [], isAppendix: false })
    // Demote appendix H1s to H2s
    for (const ch of appendix) {
      if (ch.heading.startsWith('# ')) {
        ch.heading = ch.heading.replace(/^# /, '## ')
      }
      reordered.push(ch)
    }
  }

  const result: string[] = []
  for (const ch of reordered) {
    if (ch.heading) result.push(ch.heading)
    result.push(...ch.content)
  }
  return result
}

/** Fix step numbering gaps: 1. 2. 4. 5. → 1. 2. 3. 4. */
function fixStepNumbering(md: string): string {
  const lines = md.split('\n')
  let stepCounter = 0, inSequence = false
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\.\s+(.+)/)
    if (m) {
      const num = parseInt(m[1])
      if (!inSequence || num !== stepCounter + 1) { stepCounter = 0; inSequence = true }
      stepCounter++
      if (num !== stepCounter) lines[i] = `${stepCounter}. ${m[2]}`
    } else if (!lines[i].trim()) {
      // blank line — may or may not end sequence
      continue
    } else if (inSequence && !lines[i].match(/^\d+\.\s/)) {
      inSequence = false; stepCounter = 0
    }
  }
  return lines.join('\n')
}

// ── Quality checker ──
function checkQuality(content: string, analysis: SOPAnalysis, tocItems: TocItem[]): QualityReport {
  return {
    headings: tocItems.length > 0,
    numbering: checkNumbering(tocItems),
    images: (content.match(/!\[图/g) || []).length,
    captions: (content.match(/!\[图[\d.-]+\]/g) || []).length > 0,
    comparison: !!analysis.comparison,
    flow: analysis.chapterFlow.length > 0,
  }
}

function checkNumbering(items: TocItem[]): boolean {
  const h1s = items.filter(i => i.level === 1).map(i => parseInt(i.num))
  for (let i = 0; i < h1s.length - 1; i++) { if (h1s[i + 1] !== h1s[i] + 1) return false }
  return true
}

// ── Extract TOC from rendered headings ──
function extractTocFromHtml(html: string): TocItem[] {
  const items: TocItem[] = []
  const regex = /<h([23])\s+id="(ch-[^"]+)"[^>]*>([\d.]+)\s+(.+?)<\/h[23]>/g
  let m
  while ((m = regex.exec(html)) !== null) {
    items.push({ id: m[2], level: parseInt(m[1]), num: m[3], text: m[4].replace(/<[^>]*>/g, '') })
  }
  return items
}

// ── Main Component ──
export function MarkdownReader({ doc, canManage: canManageProp, hideHeader }: { doc: Doc; canManage?: boolean; hideHeader?: boolean }) {
  const hasCondensed = !!(doc.condensedContent && doc.condensedContent.trim())
  const defaultMode = (hasCondensed && doc.displayMode !== 'full') ? 'condensed' : 'full'
  const [viewMode, setViewMode] = useState<'condensed' | 'full'>(defaultMode)
  const activeContent = viewMode === 'condensed' && hasCondensed ? doc.condensedContent! : doc.content
  const newFormat = hasCondensed && viewMode === 'condensed' && isNewFormatCondensed(activeContent)

  // Inline editing
  const [canManage, setCanManage] = useState(canManageProp ?? false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // Metadata modal
  const [showMeta, setShowMeta] = useState(false)
  const [edTitle, setEdTitle] = useState('')
  const [edOwnerDept, setEdOwnerDept] = useState('')
  const [edAudienceIds, setEdAudienceIds] = useState<string[]>([])
  const [edCategory, setEdCategory] = useState('')
  const [metaStatus, setMetaStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [metaMsg, setMetaMsg] = useState('')
  const [deptsForMeta, setDeptsForMeta] = useState<any[]>([])
  const [compsForMeta, setCompsForMeta] = useState<any[]>([])
  const [deleting, setDeleting] = useState(false)

  // Free-form editing state (not derived from regex)
  const [editObjective, setEditObjective] = useState('')
  const [editRoles, setEditRoles] = useState<{ dept: string; duty: string }[]>([])
  const [editWarnings, setEditWarnings] = useState<string[]>([])

  useEffect(() => {
    if (canManageProp) { setCanManage(true); return }
    if (!doc.id) return
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(async u => {
        if (!u?.role) return
        if (u.role === 'super_admin') { setCanManage(true); return }
        // Check document permission via the full permission engine
        try {
          const permRes = await fetch(`/api/documents/${doc.id}`)
          const docData = await permRes.json()
          const perm = docData?.userPermission
          if (perm && ['edit', 'delete', 'admin'].includes(perm)) {
            setCanManage(true)
            return
          }
        } catch { /* fallback to legacy */ }
        // Legacy fallback: dept_admin + ownerDept match
        if (u.role === 'dept_admin' && u.departmentId && doc.ownerDeptId) {
          if (u.departmentId === doc.ownerDeptId) setCanManage(true)
        }
      }).catch(() => {})
  }, [doc.id, canManageProp])

  function startEditing() {
    setEditContent(activeContent)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
  }

  async function saveContent() {
    if (!doc.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: doc.title, content: editContent }),
      })
      if (res.ok) {
        router.refresh()
      } else { alert('保存失败') }
    } catch { alert('网络错误') }
    setSaving(false)
  }

  // ── Metadata editing ──
  function openMeta() {
    if (!doc.id) return
    // Fetch departments & companies for the modal
    Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
      fetch(`/api/documents/${doc.id}`).then(r => r.json()),
    ]).then(([depts, comps, fullDoc]) => {
      if (Array.isArray(depts)) setDeptsForMeta(depts)
      if (Array.isArray(comps)) setCompsForMeta(comps)
      setEdTitle(doc.title)
      setEdOwnerDept((fullDoc as any)?.ownerDeptId || '')
      setEdAudienceIds(((fullDoc as any)?.audiences || []).map((a: any) => a.departmentId))
      setEdCategory(doc.category)
      setMetaStatus('idle')
      setMetaMsg('')
      setShowMeta(true)
    }).catch(() => alert('加载数据失败'))
  }

  async function handleMeta(e: React.FormEvent) {
    e.preventDefault()
    if (!doc.id || !edTitle) return
    setMetaStatus('saving')
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: edTitle, category: edCategory, ownerDeptId: edOwnerDept, audienceIds: edAudienceIds, content: doc.content }),
      })
      if (res.ok) {
        setMetaStatus('done'); setMetaMsg('保存成功')
        setTimeout(() => { setShowMeta(false); router.refresh() }, 600)
      } else {
        const d = await res.json().catch(() => ({}))
        setMetaStatus('error'); setMetaMsg(d.error || '保存失败')
      }
    } catch { setMetaStatus('error'); setMetaMsg('网络错误') }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!doc.id || !confirm(`确定删除「${doc.title}」？此操作不可恢复。`)) return
    setDeleting(true)
    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/internal/documents')
    else { alert('删除失败'); setDeleting(false) }
  }

  function deptsByCompany(slug: string) { return deptsForMeta.filter((d: any) => d.company?.slug === slug) }
  function toggleAudience(id: string) { setEdAudienceIds((p: string[]) => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }

  const analysis = useMemo(() => analyzeContent(activeContent, doc.title), [activeContent, doc.title])
  const editAnalysis = useMemo(() => analyzeContent(editContent, doc.title), [editContent, doc.title])

  // Strip analyzed text from body so it doesn't duplicate in view mode
  const bodyContent = useMemo(() => {
    let md = activeContent
    // Remove explicit ## 业务目标 section
    md = md.replace(/\n*##\s*业务目标\s*\n[\s\S]*?(?=\n##|\n*$)/, '')
    // Remove explicit ## 角色职责 section
    md = md.replace(/\n*##\s*角色职责\s*\n[\s\S]*?(?=\n##|\n*$)/, '')
    // Remove explicit ## 注意事项 / 常见错误 section
    md = md.replace(/\n*##\s*(?:注意事项|常见错误)[^\n]*\s*\n[\s\S]*?(?=\n##|\n*$)/, '')
    // Remove the detected objective text (first occurrence)
    if (analysis.objective) {
      const idx = md.indexOf(analysis.objective)
      if (idx >= 0) md = (md.substring(0, idx) + md.substring(idx + analysis.objective.length))
    }
    // Remove detected role lines
    for (const r of analysis.roles) {
      const pattern = r.dept + '：' + r.duty
      md = md.split(pattern).join('')
    }
    // Remove detected warnings
    for (const w of analysis.warnings) {
      md = md.split(w).join('')
    }
    return md.replace(/\n{4,}/g, '\n\n\n').trim()
  }, [activeContent, analysis])

  // Free-form role editing
  function updateRoleItem(index: number, field: 'dept' | 'duty', value: string) {
    setEditRoles(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }
  function addRole() {
    setEditRoles(prev => [...prev, { dept: '', duty: '' }])
  }
  function removeRole(index: number) {
    setEditRoles(prev => prev.filter((_, i) => i !== index))
  }
  const chapterFlow: string[] = []
  // Generate content and TOC from body (without analysis sections)
  const { content, tocItems } = useMemo(() => {
    const items: TocItem[] = []
    const flow: string[] = []
    const c = numberContent(bodyContent, flow, items)
    chapterFlow.splice(0, chapterFlow.length, ...flow)
    return { content: c, tocItems: items }
  }, [bodyContent])
  const quality = useMemo(() => checkQuality(content, analysis, tocItems), [content, analysis, tocItems])

  const contentRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState('')
  const [renderedHtml, setRenderedHtml] = useState('')
  const floatingToc = useMemo(() => extractTocFromHtml(renderedHtml), [renderedHtml])

  // IntersectionObserver for floating TOC sync
  useEffect(() => {
    if (!contentRef.current) return
    // Wait for headings to render
    const timer = setTimeout(() => {
      const headings = contentRef.current?.querySelectorAll('h1[id], h2[id], h3[id]')
      if (!headings?.length) return

      const observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) { setActiveId(e.target.id); break }
          }
        },
        { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
      )
      headings.forEach(h => observer.observe(h))
      return () => observer.disconnect()
    }, 500)
    return () => clearTimeout(timer)
  }, [renderedHtml])

  // Capture rendered HTML for TOC extraction
  useEffect(() => {
    if (contentRef.current) {
      const timer = setTimeout(() => setRenderedHtml(contentRef.current?.innerHTML || ''), 600)
      return () => clearTimeout(timer)
    }
  }, [content])

  // Audit: log document view
  useEffect(() => {
    if (!doc.id) return
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, action: 'view' }),
    }).catch(() => {}) // silent fail
  }, [doc.id])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="max-w-[960px] mx-auto py-8 md:py-12 px-4 md:px-8 lg:px-14 relative">
      {/* Header — hidden when provided by parent page */}
      {!hideHeader && (
      <header className="mb-6 md:mb-8 pb-6 md:pb-8 border-b border-neutral-200">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="text-[0.72rem] font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded">{catLabels[doc.category] || doc.category}</span>
          {doc.audiences?.length ? <span className="text-[0.78rem] text-neutral-500 font-normal">适用部门：{doc.audiences.join('、')}</span> : null}
          <span className="text-[0.78rem] text-neutral-400 font-normal">归属部门：{doc.department.name}</span>
        </div>
        <h1 className="text-[1.7rem] font-semibold leading-[1.35] tracking-[-0.02em] text-neutral-900 mb-3">{doc.title}</h1>
        <p className="text-[0.82rem] text-neutral-400 font-normal">{doc.author.name} · {new Date(doc.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {/* Version toggle — only show if condensed version exists */}
        {hasCondensed && !isEditing && (
          <div className="flex items-center gap-1 mt-4">
            <span className="text-[0.7rem] text-neutral-400 font-medium mr-1">视图：</span>
            <button
              onClick={() => setViewMode('condensed')}
              className={`px-3 py-1.5 text-[0.72rem] rounded-md border transition-colors font-normal ${
                viewMode === 'condensed' ? 'bg-[#2563EB] text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
              }`}
            >
              精简版
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 text-[0.72rem] rounded-md border transition-colors font-normal ${
                viewMode === 'full' ? 'bg-[#2563EB] text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
              }`}
            >
              原文
            </button>
          </div>
        )}

        {/* Edit controls */}
        {canManage && (
          <div className="flex items-center gap-2 mt-4">
            {isEditing ? (
              <>
                <button onClick={cancelEditing}
                  className="px-3 py-1.5 text-[0.72rem] text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors">
                  取消编辑
                </button>
                <button onClick={saveContent} disabled={saving}
                  className="px-4 py-1.5 text-[0.72rem] text-white bg-neutral-900 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50">
                  {saving ? '保存中...' : '保存内容'}
                </button>
              </>
            ) : (
              <>
                <button onClick={startEditing}
                  className="px-3 py-1.5 text-[0.72rem] text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-400 transition-colors">
                  <Pencil size={14} strokeWidth={1.5} className="inline-block -mt-0.5 mr-1" />编辑内容
                </button>
                <button onClick={openMeta}
                  className="px-3 py-1.5 text-[0.72rem] text-neutral-500 border border-neutral-100 rounded-md hover:bg-neutral-50 transition-colors">
                  <Settings size={14} strokeWidth={1.5} className="inline-block -mt-0.5 mr-1" />信息
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-3 py-1.5 text-[0.72rem] text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50">
                  {deleting ? '删除中...' : <><Trash2 size={14} strokeWidth={1.5} className="inline-block -mt-0.5 mr-1" />删除</>}
                </button>
              </>
            )}
          </div>
        )}
      </header>
      )}

      {/* ── Top TOC ── */}
      {tocItems.length > 0 && (
        <nav className="mb-10 p-5 md:p-6 bg-neutral-50 rounded-xl border border-neutral-200">
          <p className="text-[0.7rem] tracking-[0.12em] uppercase text-neutral-400 font-medium mb-4">目录</p>
          <div className="space-y-1">
            {tocItems.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`block w-full text-left text-[0.82rem] transition-colors font-normal hover:text-neutral-900 no-underline ${
                  item.level === 1 ? 'text-neutral-700' : item.level === 2 ? 'text-neutral-600 pl-4' : 'text-neutral-500 pl-8'
                }`}
              >
                <span className="text-neutral-400 mr-2">{item.num}</span>
                {item.text}
              </button>
            ))}
          </div>
        </nav>
      )}

      {isEditing ? (
        /* ═══ Edit mode: click-to-edit blocks ═══ */
        <div className="flex-1">
          <p className="text-[0.7rem] text-neutral-400 mb-4"><Lightbulb size={14} strokeWidth={1.5} className="inline-block -mt-0.5 mr-1" />点击任意文字直接编辑，改完点「保存内容」</p>
          <EditableMarkdown content={editContent} onChange={setEditContent} />
        </div>
      ) : (
        /* ═══ View mode: analyzed content ═══ */
        <div className="flex gap-10 flex-1">
        <div ref={contentRef} className="flex-1 min-w-0">
          {newFormat ? (
            /* ═══ New 9-section condensed format: render whole content as is ═══ */
            <article className="doc-content max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                h1: ({ children }) => { const id = headingId(children); return <h1 id={id} className="text-[1.35rem] font-semibold text-neutral-900 mt-12 mb-4 pb-2 border-b-2 border-neutral-200">{children}</h1> },
                h2: ({ children }) => { const id = headingId(children); return <h2 id={id} className="text-[1.15rem] font-semibold text-neutral-900 mt-12 mb-4 pb-2 border-b-2 border-neutral-200">{children}</h2> },
                h3: ({ children }) => { const id = headingId(children); return <h3 id={id} className="text-[1rem] font-semibold text-neutral-800 mt-10 mb-3 pl-3 border-l-[3px] border-neutral-300">{children}</h3> },
                h4: ({ children }) => <h4 className="text-[0.9rem] font-semibold text-neutral-700 mt-8 mb-2 px-3 py-1.5 bg-neutral-100 rounded">{children}</h4>,
                p: ({ children }) => { const t = String(children).replace(/<[^>]*>/g, ''); if (t.match(/^(注意|重要|⚠|警告|严禁)/)) return <div className="my-4 px-4 py-3 bg-amber-50 border-l-[3px] border-amber-400 text-[0.88rem] text-amber-800 rounded-r">{children}</div>; return <p className="text-[0.92rem] leading-[1.9] text-neutral-700 font-normal mb-4">{children}</p> },
                ul: ({ children }) => <ul className="mb-6 space-y-1.5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-6 space-y-2 list-decimal list-inside marker:text-neutral-400 marker:font-medium">{children}</ol>,
                li: ({ children }) => <li className="text-[0.92rem] leading-[1.8] text-neutral-700 font-normal pl-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-neutral-900 bg-amber-50/60 px-1 -mx-0.5 rounded">{children}</strong>,
                img: ({ src, alt }) => src ? (<figure className="my-10" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}><img src={src.startsWith('/showroom/') ? src : src.startsWith('/') ? `/showroom${src}` : src} alt={alt || '截图'} className="w-full max-w-full h-auto rounded-lg border border-neutral-200 shadow-sm" loading="lazy" /><figcaption className="text-[0.78rem] text-neutral-400 text-center mt-3">{alt || '操作截图'}</figcaption></figure>) : null,
                table: ({ children }) => <div className="overflow-x-auto my-6 rounded-lg border border-neutral-200"><table className="w-full text-[0.85rem]">{children}</table></div>,
                th: ({ children }) => <th className="border-b border-neutral-200 px-4 py-2.5 bg-neutral-50 text-left font-semibold text-neutral-700 text-[0.78rem]">{children}</th>,
                td: ({ children }) => <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{children}</td>,
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeStr = String(children).replace(/\n$/, '')
                  if (match && match[1] === 'mermaid') {
                    return <Mermaid chart={codeStr} />
                  }
                  return <code className="bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded text-[0.85rem] font-mono" {...props}>{children}</code>
                },
              }}>{activeContent}</ReactMarkdown>
            </article>
          ) : (
            /* ═══ Original format: parsed analysis sections ═══ */
            <>
              {/* 业务目标 */}
              {analysis.objective && <Section title="业务目标"><p className="text-[0.94rem] leading-[1.9] text-neutral-700 font-normal">{analysis.objective}</p></Section>}

              {/* 流程概览 */}
              {(chapterFlow.length > 0 || analysis.docFlow.length > 0) && (
                <Section title="流程概览">
                  {chapterFlow.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {chapterFlow.map((ch, i) => (
                        <span key={i} className="flex items-center gap-2">
                          <button onClick={() => scrollTo(`ch-${i + 1}`)} className="px-3 py-1.5 bg-white border border-neutral-300 rounded-md text-[0.8rem] text-neutral-700 hover:text-neutral-900 hover:border-neutral-500 transition-colors font-normal cursor-pointer">
                            {ch}
                          </button>
                          {i < chapterFlow.length - 1 && <span className="text-neutral-400">↓</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  {analysis.docFlow.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.72rem] text-neutral-400 font-medium mr-2">单据流转：</span>
                      {analysis.docFlow.map((d, i) => (
                        <span key={d} className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-[0.75rem] text-amber-800 font-normal">{d}</span>
                          {i < analysis.docFlow.length - 1 && <span className="text-amber-300">→</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* 角色职责 */}
              {analysis.roles.length > 0 && (
                <Section title="角色职责">
                  <div className="overflow-hidden rounded-lg border border-neutral-200">
                    <table className="w-full text-[0.88rem]">
                      <thead><tr className="bg-neutral-50"><th className="text-left px-4 py-2.5 font-semibold text-neutral-700 text-[0.8rem] border-b border-neutral-200">部门</th><th className="text-left px-4 py-2.5 font-semibold text-neutral-700 text-[0.8rem] border-b border-neutral-200">职责</th></tr></thead>
                      <tbody>{analysis.roles.map((r, i) => (<tr key={i} className="border-b border-neutral-100 last:border-0"><td className="px-4 py-2.5 font-medium text-neutral-800">{r.dept}</td><td className="px-4 py-2.5 text-neutral-600">{r.duty}</td></tr>))}</tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* 业务对比表 */}
              {analysis.comparison && (
                <Section title={analysis.comparison.label}>
                  <div className="overflow-x-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-[0.85rem]">
                      <thead><tr className="bg-neutral-50">{analysis.comparison.cols.map((c, i) => (<th key={i} className={`text-left px-4 py-2.5 font-semibold text-neutral-700 text-[0.78rem] border-b border-neutral-200 ${i === 0 ? '' : 'text-center'}`}>{c}</th>))}</tr></thead>
                      <tbody>{analysis.comparison.rows.map((row, ri) => (<tr key={ri} className="border-b border-neutral-100 last:border-0"><td className="px-4 py-2.5 font-medium text-neutral-800">{row[0]}</td>{row.slice(1).map((cell, ci) => (<td key={ci} className="px-4 py-2.5 text-neutral-600 text-center">{cell}</td>))}</tr>))}</tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* 详细操作 */}
              <Section title="详细操作">
                <article className="doc-content max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    h1: ({ children }) => { const id = headingId(children); return <h1 id={id} className="text-[1.35rem] font-semibold text-neutral-900 mt-12 mb-4 pb-2 border-b-2 border-neutral-200">{children}</h1> },
                    h2: ({ children }) => { const id = headingId(children); return <h2 id={id} className="text-[1.15rem] font-semibold text-neutral-900 mt-12 mb-4 pb-2 border-b-2 border-neutral-200">{children}</h2> },
                    h3: ({ children }) => { const id = headingId(children); return <h3 id={id} className="text-[1rem] font-semibold text-neutral-800 mt-10 mb-3 pl-3 border-l-[3px] border-neutral-300">{children}</h3> },
                    h4: ({ children }) => <h4 className="text-[0.9rem] font-semibold text-neutral-700 mt-8 mb-2 px-3 py-1.5 bg-neutral-100 rounded">{children}</h4>,
                    p: ({ children }) => { const t = String(children).replace(/<[^>]*>/g, ''); if (t.match(/^(注意|重要|⚠|警告|严禁)/)) return <div className="my-4 px-4 py-3 bg-amber-50 border-l-[3px] border-amber-400 text-[0.88rem] text-amber-800 rounded-r">{children}</div>; return <p className="text-[0.92rem] leading-[1.9] text-neutral-700 font-normal mb-4">{children}</p> },
                    ul: ({ children }) => <ul className="mb-6 space-y-1.5">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-6 space-y-2 list-decimal list-inside marker:text-neutral-400 marker:font-medium">{children}</ol>,
                    li: ({ children }) => <li className="text-[0.92rem] leading-[1.8] text-neutral-700 font-normal pl-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-neutral-900 bg-amber-50/60 px-1 -mx-0.5 rounded">{children}</strong>,
                    img: ({ src, alt }) => src ? (<figure className="my-10" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}><img src={src.startsWith('/showroom/') ? src : src.startsWith('/') ? `/showroom${src}` : src} alt={alt || '截图'} className="w-full max-w-full h-auto rounded-lg border border-neutral-200 shadow-sm" loading="lazy" /><figcaption className="text-[0.78rem] text-neutral-400 text-center mt-3">{alt || '操作截图'}</figcaption></figure>) : null,
                    table: ({ children }) => <div className="overflow-x-auto my-6 rounded-lg border border-neutral-200"><table className="w-full text-[0.85rem]">{children}</table></div>,
                    th: ({ children }) => <th className="border-b border-neutral-200 px-4 py-2.5 bg-neutral-50 text-left font-semibold text-neutral-700 text-[0.78rem]">{children}</th>,
                    td: ({ children }) => <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{children}</td>,
                    code: ({ className, children, ...props }: any) => {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeStr = String(children).replace(/\n$/, '')
                      if (match && match[1] === 'mermaid') {
                        return <Mermaid chart={codeStr} />
                      }
                      return <code className="bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded text-[0.85rem] font-mono" {...props}>{children}</code>
                    },
                  }}>{content}</ReactMarkdown>
                </article>
              </Section>

              {/* 常见错误 */}
              {analysis.warnings.length > 0 && (
                <Section title="常见错误 & 注意事项">
                  <ul className="space-y-2">{analysis.warnings.map((w, i) => (<li key={i} className="flex items-start gap-2 text-[0.9rem] text-neutral-700 font-normal"><AlertTriangle size={16} strokeWidth={1.5} className="text-amber-500 shrink-0 mt-0.5" /><span>{w}</span></li>))}</ul>
                </Section>
              )}

              {/* 操作口诀 */}
              {analysis.mnemonic.length > 0 && (
                <Section title="操作口诀">
                  <div className="space-y-2">{analysis.mnemonic.map((m, i) => (<p key={i} className="text-[0.94rem] text-neutral-700 font-medium bg-neutral-50 px-4 py-2.5 rounded-lg border border-neutral-200">{m}</p>))}</div>
                </Section>
              )}

              {/* 文档质量检查 */}
              <Section title="文档质量检查">
                <div className="flex flex-wrap gap-2">
                  <QualityBadge ok={quality.headings} label="标题结构" />
                  <QualityBadge ok={quality.numbering} label="编号连续" />
                  <QualityBadge ok={quality.images > 0} label={`${quality.images}张图片`} />
                  <QualityBadge ok={quality.captions} label="图片说明" />
                  <QualityBadge ok={quality.flow} label="流程概览" />
                  {analysis.comparison && <QualityBadge ok={quality.comparison} label="对比表" />}
                </div>
              </Section>
            </>
          )}

        </div>

        {/* ── Right floating TOC ── */}
        {floatingToc.length > 0 && (
          <aside className="hidden lg:block w-[200px] shrink-0">
            <nav className="sticky top-24">
              <p className="text-[0.6rem] tracking-[0.12em] uppercase text-neutral-400 font-medium mb-3">目录</p>
              <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                {floatingToc.map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={`block w-full text-left text-[0.7rem] transition-colors font-normal hover:text-neutral-900 no-underline truncate ${
                      activeId === item.id ? 'text-neutral-900 font-medium' : 'text-neutral-400'
                    } ${item.level === 3 ? 'pl-4' : item.level === 2 ? 'pl-2' : ''}`}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            </nav>
          </aside>
        )}

        </div>
      )}

      {/* AI Chat */}
      {!isEditing && doc.id && (
        <AIChat documentId={doc.id} documentTitle={doc.title} />
      )}

      {/* ══════════ Metadata Modal ══════════ */}
      {showMeta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMeta(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[1rem] font-semibold text-neutral-900">文档信息</h2>
                <button onClick={() => setShowMeta(false)} className="text-neutral-400 hover:text-neutral-700 text-lg leading-none">&times;</button>
              </div>
              <form onSubmit={handleMeta} className="space-y-4">
                <div>
                  <label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">标题</label>
                  <input type="text" value={edTitle} onChange={e => setEdTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.85rem] focus:outline-none focus:border-neutral-900 font-normal" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">归属部门</label>
                    <select value={edOwnerDept} onChange={e => setEdOwnerDept(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.85rem] focus:outline-none focus:border-neutral-900 font-normal">
                      {compsForMeta.map((c: any) => {
                        const ds = deptsByCompany(c.slug)
                        if (!ds.length) return null
                        return <optgroup key={c.id} label={c.name}>{ds.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">分类</label>
                    <select value={edCategory} onChange={e => setEdCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.85rem] focus:outline-none focus:border-neutral-900 font-normal">
                      {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">适用部门（留空=全部适用）</label>
                  {compsForMeta.map((c: any) => {
                    const ds = deptsByCompany(c.slug)
                    if (!ds.length) return null
                    return (
                      <div key={c.id} className="mb-1">
                        <span className="text-[0.6rem] text-neutral-400">{c.name}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {ds.map((d: any) => (
                            <button key={d.id} type="button" onClick={() => toggleAudience(d.id)}
                              className={`px-2.5 py-1 text-[0.7rem] rounded border transition-colors font-normal ${edAudienceIds.includes(d.id) ? 'bg-[#2563EB] text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
                              {d.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {metaMsg && (
                  <div className={`text-[0.78rem] px-3 py-2 rounded-md ${metaStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{metaMsg}</div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowMeta(false)}
                    className="flex-1 px-4 py-2 border border-neutral-200 text-neutral-600 text-[0.82rem] rounded-lg hover:bg-neutral-50 transition-colors">取消</button>
                  <button type="submit" disabled={metaStatus === 'saving'}
                    className="flex-1 px-4 py-2 bg-[#2563EB] text-white text-[0.82rem] rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
                    {metaStatus === 'saving' ? '保存中...' : '保存信息'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[0.7rem] tracking-[0.14em] uppercase text-neutral-400 font-medium mb-4 pb-2 border-b border-neutral-100">{title}</h2>
      {children}
    </section>
  )
}

function QualityBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[0.7rem] px-2 py-1 rounded font-normal ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

/** Generate heading ID from content: "1. 系统简介" → "ch-1" */
function headingId(children: React.ReactNode): string {
  const text = String(children).replace(/<[^>]*>/g, '')
  const numMatch = text.match(/^([\d.]+)/)
  return numMatch ? `ch-${numMatch[1].replace(/\.$/, '')}` : `ch-${text.substring(0, 20).replace(/\s+/g, '-')}`
}

