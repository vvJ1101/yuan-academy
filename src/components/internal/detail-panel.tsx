'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
interface Doc {
  id: string; title: string; slug: string; category: string
  fullContent?: string; condensedContent?: string
  ownerDept?: { name: string; slug: string } | null
  audiences?: { department?: { name: string; slug: string } }[]
  folder?: { id: string; name: string } | null
  updatedAt: string; author: { name: string }
  fileSize?: number | null
}

function fmtDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function fmtTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function fmtSize(doc: Doc): string {
  if (doc.fileSize) {
    const b = doc.fileSize
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }
  const content = doc.fullContent || doc.condensedContent || ''
  const bytes = new Blob([content]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function fmtPath(doc: Doc): string {
  const parts: string[] = []
  if (doc.folder?.name) parts.push(doc.folder.name)
  if (doc.ownerDept?.name) parts.push(doc.ownerDept.name)
  if (parts.length === 0) return '根目录'
  return parts.join(' / ')
}
function getTags(doc: Doc): string[] {
  const tags: string[] = []
  if (doc.category === 'sop') tags.push('SOP流程')
  else if (doc.category === 'policy') tags.push('订货政策')
  else if (doc.category === 'training') tags.push('培训资料')
  else if (doc.category === 'reference') tags.push('制度规范')
  else if (doc.category === 'brand') tags.push('品牌管理')
  if (doc.condensedContent) tags.push('AI 解析')
  return tags
}

export function DetailPanel({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const [aiExpanded, setAiExpanded] = useState(false)

  if (!doc) {
    return (
      <aside className="w-[300px] shrink-0 bg-white border-l border-neutral-200 flex items-center justify-center">
        <div className="text-center px-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300 mx-auto mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p className="text-[0.82rem] text-neutral-500 font-medium">选择文件查看详情</p>
          <p className="text-[0.7rem] text-neutral-400 mt-1">点击左侧文件列表中的文件</p>
        </div>
      </aside>
    )
  }

  const fileName = doc.title.toLowerCase()
  const fileType = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ? 'excel'
    : fileName.endsWith('.docx') || fileName.endsWith('.doc') ? 'word'
    : fileName.endsWith('.pdf') ? 'pdf' : 'other'
  const fileTypeLabel = fileType === 'excel' ? 'Excel' : fileType === 'word' ? 'Word' : fileType === 'pdf' ? 'PDF' : '文档'
  const fileTypeIcon = fileType === 'excel' ? '/images/excel.png'
    : fileType === 'word' ? '/images/word.png'
    : fileType === 'pdf' ? '/images/pdf.png' : null
  const deptSlug = doc.audiences?.[0]?.department?.slug || doc.ownerDept?.slug || 'doc'

  return (
    <aside
      className="w-[300px] shrink-0 bg-white border-l border-neutral-200 overflow-hidden flex flex-col h-full"
    >
      <div className="p-4 flex flex-col flex-1 min-h-0 space-y-4">
        {/* ═══ 文件类型图标 + 名称 ═══ */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 shrink-0">
          {fileTypeIcon ? (
            <img src={fileTypeIcon} alt="" className="w-9 h-9 object-contain shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[0.85rem] font-semibold text-neutral-800 truncate">{doc.title}</p>
            <p className="text-[0.68rem] text-neutral-400">{fileTypeLabel} 文档</p>
          </div>
        </div>

        {/* ═══ 区块一：基本信息 ═══ */}
        <section className="shrink-0">
          <h3 className="text-[0.85rem] font-semibold text-neutral-800 mb-2">基本信息</h3>
          <div className="grid gap-y-1.5 gap-x-2" style={{ gridTemplateColumns: '70px 1fr' }}>
            <span className="text-[0.72rem] text-neutral-500">文件类型</span>
            <span className="text-[0.72rem] text-neutral-900">{fileTypeLabel}</span>

            <span className="text-[0.72rem] text-neutral-500">创建人</span>
            <span className="text-[0.72rem] text-neutral-900">{doc.author?.name || '—'}</span>

            <span className="text-[0.72rem] text-neutral-500">更新时间</span>
            <span className="text-[0.72rem] text-neutral-900">{fmtTime(doc.updatedAt)}</span>

            <span className="text-[0.72rem] text-neutral-500">文件大小</span>
            <span className="text-[0.72rem] text-neutral-900">{fmtSize(doc)}</span>

            <span className="text-[0.72rem] text-neutral-500">所在位置</span>
            <span className="text-[0.72rem] text-neutral-900">{fmtPath(doc)}</span>

            <span className="text-[0.72rem] text-neutral-500">权限范围</span>
            <span className="text-[0.72rem] text-neutral-900">
              {doc.audiences && doc.audiences.length > 0
                ? `${doc.audiences.map(a => a.department?.name).filter(Boolean).join('、')}`
                : doc.ownerDept?.name || '未设置'}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {getTags(doc).map(tag => (
              <span key={tag} className="text-[0.68rem] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* ═══ 区块二：AI 摘要 ═══ */}
        <section className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-1.5 shrink-0">
            <h3 className="text-[0.85rem] font-semibold text-neutral-800 flex items-center gap-1.5">
              <Sparkles size={14} strokeWidth={1.5} className="text-[#2563EB]" />
              AI 摘要
            </h3>
            <button
              onClick={() => setAiExpanded(!aiExpanded)}
              className="text-[0.7rem] text-[#2563EB] hover:underline font-medium shrink-0"
            >
              {aiExpanded ? '收起' : '展开全部'}
            </button>
          </div>
          <div className={`text-[0.75rem] text-neutral-600 leading-relaxed overflow-y-auto ${aiExpanded ? 'flex-1' : 'line-clamp-3'} prose prose-sm max-w-none prose-headings:text-neutral-800 prose-p:my-1 prose-ul:my-1 prose-li:my-0`}>
            {(doc.condensedContent || doc.fullContent) ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {(doc.condensedContent || doc.fullContent || '').substring(0, aiExpanded ? 3000 : 400)}
              </ReactMarkdown>
            ) : (
              <p className="text-neutral-400">暂无摘要</p>
            )}
          </div>
        </section>

        {/* ═══ 区块三：最近更新记录 ═══ */}
        <section className="shrink-0">
          <h3 className="text-[0.85rem] font-semibold text-neutral-800 mb-2">最近更新记录</h3>
          <div className="space-y-2">
            <div className="text-[0.72rem] leading-relaxed">
              <span className="font-medium text-neutral-800">{doc.title}</span>
              <span className="text-neutral-500"> — {doc.author?.name || '管理员'} 更新了文件内容</span>
              <span className="text-neutral-400 ml-1 text-[0.68rem]">{fmtTime(doc.updatedAt)}</span>
            </div>
            {doc.condensedContent && (
              <div className="text-[0.72rem] leading-relaxed">
                <span className="font-medium text-neutral-800">{doc.title}</span>
                <span className="text-neutral-500"> — AI 解析完成</span>
                <span className="text-neutral-400 ml-1 text-[0.68rem]">{fmtTime(doc.updatedAt)}</span>
              </div>
            )}
            <p className="text-[0.68rem] text-neutral-400 mt-1">查看更多更新需要接入审计日志 API</p>
          </div>
        </section>

      </div>
    </aside>
  )
}
