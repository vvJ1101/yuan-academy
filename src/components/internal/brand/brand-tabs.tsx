'use client'

import Link from 'next/link'

export function BrandTabs({ active }: { active: 'ordering' | 'contact' }) {
  const tabs = [
    { key: 'ordering' as const, label: '订货政策', href: '/internal/brand?type=ordering' },
    { key: 'contact' as const, label: '品牌对接信息', href: '/internal/brand?type=contact' },
  ]

  return (
    <div className="flex items-center gap-2 rounded-xl bg-neutral-100 p-1">
      {tabs.map(tab => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-[0.78rem] font-medium no-underline transition-colors ${
            active === tab.key
              ? 'bg-white text-[#2563EB] shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
