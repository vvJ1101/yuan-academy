'use client'

import Link from 'next/link'

const CATEGORIES = [
  { key: 'sop', label: 'SOP 流程', href: '/internal/sop', color: 'bg-blue-300/80' },
  { key: 'policy', label: '订货政策', href: '/internal/policy', color: 'bg-orange-300/80' },
  { key: 'faq', label: '常见问答', href: '/internal/faq', color: 'bg-green-300/80' },
  { key: 'training', label: '培训资料', href: '/internal/documents?category=training', color: 'bg-purple-300/80' },
  { key: 'all', label: '全部文档', href: '/internal/documents', color: 'bg-gray-400' },
]

interface Props {
  activeCat: string
  onCatChange: (key: string) => void
}

export function CategoryChips({ activeCat, onCatChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm font-light mb-12">
      <span className="text-gray-400 mr-2">浏览</span>
      {CATEGORIES.map(cat => {
        const isActive = activeCat === cat.key
        return (
          <Link
            key={cat.key}
            href={cat.href}
            onClick={() => onCatChange(cat.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-200 no-underline text-sm font-light ${
              isActive
                ? 'bg-gray-100 text-gray-800 border-transparent'
                : 'bg-white text-gray-500 border-gray-200/60 hover:bg-gray-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cat.color}`} />
            {cat.label}
          </Link>
        )
      })}
    </div>
  )
}
