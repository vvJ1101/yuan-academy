'use client'

import Link from 'next/link'

const ACTIONS = [

  { label: '搜索', href: '/internal/search' },
  { label: '收藏', href: '/internal/favorites' },
  { label: '最近', href: '/internal/recent' },
]

export function QuickActions() {
  return (
    <div className="flex items-center gap-0 mb-8">
      {ACTIONS.map((a, i) => (
        <span key={a.label} className="flex items-center gap-0">
          {i > 0 && <span className="text-gray-200 mx-1">·</span>}
          <Link
            href={a.href}
            className="px-3 py-1 rounded-full hover:bg-gray-100/60 transition-all duration-200 text-sm font-light text-gray-500 no-underline"
          >
            {a.label}
          </Link>
        </span>
      ))}
    </div>
  )
}
