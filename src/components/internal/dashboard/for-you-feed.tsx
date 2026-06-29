'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchRecommendations, type RecommendItem } from '@/lib/dashboard/fetchers'
import { fetchActivity, type ActivityItem } from '@/lib/dashboard/fetchers'

function recSlug(d: RecommendItem) {
  return d.audiences?.[0]?.department?.slug || d.audienceSlug || d.ownerDept?.name || 'general'
}
function actSlug(d: ActivityItem) {
  return d.audiences?.[0]?.department?.slug || d.audienceSlug || d.ownerDept?.slug || 'general'
}

export function ForYouFeed() {
  const [recs, setRecs] = useState<RecommendItem[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchRecommendations().catch(() => ({ forYou: [], popular: [] })),
      fetchActivity().catch(() => ({ recentDocs: [], recentUpdates: [] } as any)),
    ]).then(([r, a]) => {
      setRecs((r.forYou?.length ? r.forYou : r.popular || []).slice(0, 5))
      setActivity((a.recentDocs || a.recentUpdates || []).slice(0, 3))
      setLoading(false)
    })
  }, [])

  return (
    <div className="">
      {/* Recommended */}
      <h3 className="text-xs font-medium text-gray-300 tracking-widest uppercase mb-4">推荐阅读</h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-[36px] bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : recs.length > 0 ? (
        <div className="space-y-3">
          {recs.map(d => (
            <Link
              key={d.id}
              href={`/internal/docs/${recSlug(d)}/${encodeURIComponent(d.slug)}`}
              className="group flex items-start gap-3 hover:-translate-x-1 transition-transform duration-200 no-underline cursor-pointer"
            >
              <span className="w-0.5 h-4 bg-gray-200 group-hover:bg-blue-500 transition-colors mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-light text-gray-700 group-hover:text-gray-900 transition-colors">
                  {d.title}
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  {d.reason || d.category || ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 font-light">暂无推荐</p>
      )}

      {/* Recent updates */}
      {activity.length > 0 && (
        <>
          <hr className="my-5 border-gray-100/80" />
          <h3 className="text-xs font-medium text-gray-300 tracking-widest uppercase mb-3">最近更新</h3>
          <div className="space-y-2 text-sm font-light text-gray-400">
            {activity.map((d, i) => (
              <Link
                key={d.id || i}
                href={`/internal/docs/${actSlug(d)}/${encodeURIComponent(d.slug)}`}
                className="block hover:text-gray-600 transition-colors duration-200 no-underline cursor-pointer"
              >
                · {d.title}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
