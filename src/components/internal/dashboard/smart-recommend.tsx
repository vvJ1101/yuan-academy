'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Flame, FileText, Paperclip, ArrowUpRight } from 'lucide-react'
import { fetchRecommendations, type RecommendItem } from '@/lib/dashboard/fetchers'

function slug(d: RecommendItem) {
  return d.audiences?.[0]?.department?.slug || d.audienceSlug || d.ownerDept?.name || 'general'
}

export function SmartRecommend() {
  const [recs, setRecs] = useState<RecommendItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecommendations()
      .then(d => setRecs(d.forYou?.length ? d.forYou : d.popular || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
      <h3 className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-neutral-400 uppercase tracking-wider mb-3">
        <Flame size={13} strokeWidth={1.5} className="text-red-500" />
        智能推荐 · 基于你的浏览记录
      </h3>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-[60px] bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      ) : recs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {recs.slice(0, 4).map(d => (
            <Link key={d.id} href={`/internal/docs/${slug(d)}/${encodeURIComponent(d.slug)}`}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors no-underline group border border-transparent hover:border-neutral-200">
              <FileText size={15} strokeWidth={1.5} className="text-neutral-400 shrink-0 mt-0.5 group-hover:text-[#2563EB] transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-[0.82rem] text-neutral-800 truncate font-medium group-hover:text-neutral-900">{d.title}</p>
                <p className="text-[0.7rem] text-neutral-400 mt-0.5 truncate">{d.category || ''}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[0.78rem] text-neutral-400 py-4 text-center">浏览更多文档以获取个性化推荐</p>
      )}

      {/* Templates row */}
      <div className="mt-4 pt-3 border-t border-neutral-100">
        <h4 className="inline-flex items-center gap-1.5 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
          <Paperclip size={12} strokeWidth={1.5} />
          你可能需要
        </h4>
        <div className="flex flex-wrap gap-2">
          {[
            { title: '商品准入标准_填写模板', slug: '商品准入标准_填写模板' },
            { title: '订货会筹备清单模板', slug: '订货会筹备清单模板' },
          ].map((t, i) => (
            <Link key={i} href={`/internal/docs/general/${encodeURIComponent(t.slug)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-neutral-200 rounded-lg hover:border-[#2563EB]/50 hover:bg-blue-50/30 transition-all no-underline group text-[0.73rem]">
              <FileText size={13} strokeWidth={1.5} className="text-neutral-400 shrink-0 group-hover:text-[#2563EB]" />
              <span className="text-neutral-600 group-hover:text-[#2563EB]">{t.title}</span>
              <ArrowUpRight size={11} strokeWidth={2} className="text-neutral-300 shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
