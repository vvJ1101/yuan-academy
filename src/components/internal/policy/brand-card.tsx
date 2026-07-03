'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandSummary } from '@/types/policy-layout'

interface BrandCardProps {
  brand: BrandSummary
  className?: string
}

export function BrandCard({ brand, className }: BrandCardProps) {
  const encoded = encodeURIComponent(brand.brand)

  return (
    <div
      className={cn(
        'bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 hover:border-[#2563EB]/30 hover:shadow-sm transition-all group',
        className
      )}
    >
      {/* ── Header: 品牌名 + 类目/国家标签 ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[0.95rem] font-semibold text-neutral-900 truncate">
            {brand.brand}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[0.62rem] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
              {brand.category}
            </span>
            <span className="text-[0.62rem] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {brand.country}
            </span>
          </div>
        </div>
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          className="text-neutral-300 group-hover:text-[#2563EB] shrink-0 mt-1 transition-colors"
        />
      </div>

      {/* ── Body: 价格段 + 系列 ── */}
      <div className="space-y-1">
        {brand.priceRange && (
          <p className="text-[0.78rem] text-neutral-700">
            <span className="text-neutral-400 text-[0.68rem]">价格段 </span>
            {brand.priceRange}
          </p>
        )}
        {brand.series && (
          <p className="text-[0.78rem] text-neutral-700 truncate">
            <span className="text-neutral-400 text-[0.68rem]">系列 </span>
            {brand.series}
          </p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
        <Link
          href={`/internal/policy/${encoded}`}
          className="flex-1 text-center min-h-[44px] flex items-center justify-center text-[0.78rem] font-medium text-[#2563EB] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors no-underline"
        >
          详情
        </Link>
        <Link
          href={`/internal/policy/${encoded}/ss26`}
          className="flex-1 text-center min-h-[44px] flex items-center justify-center text-[0.78rem] font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-600 transition-colors no-underline"
        >
          政策
        </Link>
      </div>
    </div>
  )
}
