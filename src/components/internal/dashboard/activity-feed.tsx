'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Rss, Clock, ArrowRight } from 'lucide-react'
import { fetchActivity, type ActivityItem } from '@/lib/dashboard/fetchers'

function slug(d: ActivityItem) {
  return d.audiences?.[0]?.department?.slug || d.audienceSlug || d.ownerDept?.slug || 'general'
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivity()
      .then(d => setItems((d.recentDocs || d.recentUpdates || []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!items.length) return null

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-neutral-400 uppercase tracking-wider">
          <Rss size={13} strokeWidth={1.5} />
          最近更新
        </h3>
        <Link
          href="/internal/recent"
          className="inline-flex items-center gap-1 text-[0.68rem] text-[#2563EB] hover:text-blue-700 font-medium no-underline"
        >
          全部 <ArrowRight size={11} strokeWidth={2} />
        </Link>
      </div>
      <div className="space-y-0.5">
        {items.map((d, i) => (
          <Link
            key={d.id || i}
            href={`/internal/docs/${slug(d)}/${encodeURIComponent(d.slug)}`}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-neutral-50 transition-colors no-underline group"
          >
            <Clock size={12} strokeWidth={1.5} className="text-neutral-300 shrink-0 group-hover:text-neutral-400" />
            <span className="text-[0.78rem] text-neutral-700 truncate flex-1 group-hover:text-neutral-900">{d.title}</span>
            <span className="text-[0.65rem] text-neutral-400 shrink-0">
              {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : ''}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
