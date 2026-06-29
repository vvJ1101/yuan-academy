'use client'

import Link from 'next/link'
import { Tag } from 'lucide-react'

const CATEGORIES = [
  { key: 'sop', label: 'SOP流程', href: '/internal/sop' },

  { key: 'faq', label: 'FAQ', href: '/internal/faq' },
  { key: 'training', label: '培训资料', href: '/internal/documents?category=training' },
  { key: 'all', label: '全部文档', href: '/internal/documents' },
]

interface Props { activeCat: string; onCatChange: (key: string) => void }

export function CategoryFilter({ activeCat, onCatChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Tag size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORIES.map(cat => (
          <Link key={cat.key} href={cat.href}
            onClick={() => onCatChange(cat.key)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.7rem] font-medium transition-all no-underline ${
              activeCat === cat.key
                ? 'bg-[#2563EB] text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}>
            {cat.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
