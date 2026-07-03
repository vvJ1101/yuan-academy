'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { TagGroup } from './tag-group'
import type { PolicyRecord } from '@/types/policy-layout'

interface PolicyDetailHeaderProps {
  brand: PolicyRecord
  backTo?: string
}

export function PolicyDetailHeader({ brand, backTo = '/internal/policy' }: PolicyDetailHeaderProps) {
  return (
    <div className="mb-6">
      {/* Back link */}
      <Link
        href={backTo}
        className="inline-flex items-center gap-1.5 text-[0.78rem] text-neutral-400 hover:text-[#2563EB] no-underline mb-3 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        返回列表
      </Link>

      {/* Brand info */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.3rem] font-semibold text-neutral-900 tracking-[-0.02em]">
            {brand.brand}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[0.7rem] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
              {brand.category}
            </span>
            <span className="text-[0.7rem] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {brand.country}
            </span>
            {brand.priceRange && (
              <span className="text-[0.7rem] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {brand.priceRange}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick tags */}
      <div className="mt-3 space-y-2">
        {brand.style && <TagGroup tags={[brand.style]} color="neutral" />}
        {brand.series && (
          <p className="text-[0.78rem] text-neutral-500">
            <span className="text-neutral-400">最新系列：</span>
            {brand.series}
          </p>
        )}
      </div>
    </div>
  )
}
