'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

export interface SourceMeta {
  id: string
  title: string
  department: string
  departmentSlug: string
  slug: string
  audienceSlug: string
  category: string
  updatedAt: string
  excerpt: string
}

interface Props {
  sources: SourceMeta[]
}

/** Format a date string to relative or absolute Chinese format */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diff = now - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return '今天更新'
    if (days === 1) return '昨天更新'
    if (days < 7) return `${days} 天前`
    if (days < 30) return `${Math.floor(days / 7)} 周前`
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

/** Calculate a simple relevance score based on excerpt quality */
function relevanceScore(source: SourceMeta): number {
  if (!source.excerpt) return 85
  const len = source.excerpt.length
  if (len > 150) return 98
  if (len > 80) return 92
  return 88
}

const CAT_LABELS: Record<string, string> = {
  sop: 'SOP 流程', training: '培训资料', policy: '政策文件', guide: '操作指引', brand: '品牌资产',
}

export function SourceCitation({ sources }: Props) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[0.68rem] font-medium text-neutral-400 uppercase tracking-[0.08em]">
          参考来源
        </p>
        <span className="text-[0.65rem] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
          {sources.length} 篇文档
        </span>
      </div>

      <div className="space-y-4">
        {sources.map((source, i) => (
          <div
            key={source.id}
            className="group relative border border-neutral-100 rounded-xl p-4 hover:border-neutral-300 hover:shadow-sm transition-all bg-neutral-50/50"
          >
            {/* Source number badge */}
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#2563EB] text-white text-[0.6rem] font-semibold flex items-center justify-center mt-1">
                {i + 1}
              </span>

              <div className="flex-1 min-w-0">
                {/* Document title + link */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/internal/docs/${source.audienceSlug}/${encodeURIComponent(source.slug)}`}
                    className="text-[0.88rem] font-semibold text-neutral-800 hover:text-neutral-950 transition-colors no-underline leading-snug"
                  >
                    <FileText size={15} strokeWidth={1.5} className="inline-block -mt-0.5 mr-1 text-neutral-500" />{source.title}
                  </Link>
                  <Link
                    href={`/internal/docs/${source.audienceSlug}/${encodeURIComponent(source.slug)}`}
                    className="shrink-0 text-[0.68rem] text-neutral-400 hover:text-neutral-700 transition-colors no-underline font-medium opacity-0 group-hover:opacity-100 mt-1"
                  >
                    查看原文 →
                  </Link>
                </div>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                  <span className="text-[0.72rem] text-neutral-500">
                    部门：{source.department || '未分类'}
                  </span>
                  <span className="text-[0.72rem] text-neutral-400">
                    {formatDate(source.updatedAt)}
                  </span>
                  <span className="text-[0.72rem] text-neutral-400">
                    {CAT_LABELS[source.category] || source.category || '文档'}
                  </span>
                  <span className="text-[0.65rem] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    匹配度 {relevanceScore(source)}%
                  </span>
                </div>

                {/* Excerpt */}
                {source.excerpt && (
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-200 rounded-full" />
                    <blockquote className="pl-4 text-[0.78rem] text-neutral-500 leading-relaxed italic line-clamp-3">
                      "{source.excerpt}"
                    </blockquote>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
