'use client'

import Link from 'next/link'
import { Clock, Star, BookOpen } from 'lucide-react'
import type { StatsData } from '@/types/dashboard'

interface Props { stats: StatsData; bookmarkCount: number; viewCount: number }

export function QuickAccess({ stats, bookmarkCount, viewCount }: Props) {
  const links = [
    { key: 'recent', label: '最近访问', count: viewCount, Icon: Clock, href: '/internal/recent' },
    { key: 'bookmarks', label: '我的收藏', count: bookmarkCount, Icon: Star, href: '/internal/favorites' },
    { key: 'toLearn', label: '待学习', count: stats.toLearn, Icon: BookOpen, href: '/internal/documents?filter=learning' },
  ]

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
      <h3 className="text-[0.68rem] font-medium text-neutral-400 uppercase tracking-wider mb-3">快捷入口</h3>
      <div className="space-y-1">
        {links.map(l => (
          <Link
            key={l.key}
            href={l.href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors no-underline group"
          >
            <l.Icon size={15} strokeWidth={1.5} className="text-neutral-400 group-hover:text-[#2563EB] transition-colors shrink-0" />
            <span className="text-[0.78rem] text-neutral-700 flex-1 group-hover:text-neutral-900">{l.label}</span>
            <span className="text-[0.8rem] font-semibold text-neutral-800">{l.count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
