'use client'

import Link from 'next/link'
import { ScrollText, HelpCircle, GraduationCap, FolderOpen, ClipboardList } from 'lucide-react'

const CATEGORIES = [
  { key: 'sop', label: 'SOP 流程', href: '/internal/sop', icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },

  { key: 'faq', label: '常见问答', href: '/internal/faq', icon: HelpCircle, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'training', label: '培训资料', href: '/internal/documents?category=training', icon: GraduationCap, color: 'text-violet-600 bg-violet-50' },
  { key: 'all', label: '全部文档', href: '/internal/documents', icon: FolderOpen, color: 'text-neutral-600 bg-neutral-100' },
]

interface Props {
  activeCat: string
  onCatChange: (key: string) => void
}

export function CategoryCards({ activeCat, onCatChange }: Props) {
  return (
    <div className="mb-10">
      <p className="text-[0.72rem] font-light text-neutral-400 mb-3 tracking-wider">浏览</p>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const isActive = activeCat === cat.key
          return (
            <Link
              key={cat.key}
              href={cat.href}
              onClick={() => onCatChange(cat.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 no-underline text-[0.82rem] font-light ${
                isActive
                  ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
                  : 'border-neutral-200 bg-white text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
              }`}
            >
              <span className={`w-6 h-6 rounded-md flex items-center justify-center ${cat.color}`}>
                <cat.icon size={13} strokeWidth={1.5} />
              </span>
              {cat.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
