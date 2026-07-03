'use client'

import { cn } from '@/lib/utils'
import type { PolicyFilterState } from '@/types/policy-layout'

interface FilterBarProps {
  categories: string[]
  countries: string[]
  priceRanges: string[]
  styles: string[]
  active: PolicyFilterState
  onChange: (filters: PolicyFilterState) => void
  counts?: Record<string, number>
  className?: string
}

/** 单项筛选 pill 行 */
function FilterRow({
  label,
  options,
  active,
  onChange,
  counts,
}: {
  label: string
  options: string[]
  active: string
  onChange: (v: string) => void
  counts?: Record<string, number>
}) {
  if (options.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[0.65rem] text-neutral-400 mr-1 shrink-0">{label}：</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(active === opt ? '' : opt)}
          className={cn(
            'min-h-[40px] sm:min-h-[44px] px-2.5 py-1 text-[0.7rem] rounded-md border transition-colors',
            active === opt
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
          )}
        >
          {opt}
          {counts?.[opt] !== undefined && (
            <span className="ml-1 opacity-70">({counts[opt]})</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function FilterBar({
  categories,
  countries,
  priceRanges,
  styles,
  active,
  onChange,
  counts,
  className,
}: FilterBarProps) {
  function set(key: keyof PolicyFilterState, value: string) {
    onChange({ ...active, [key]: value })
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search */}
      <input
        type="text"
        value={active.search}
        onChange={e => set('search', e.target.value)}
        placeholder="搜索品牌名或风格..."
        className="w-full px-3 py-2 min-h-[44px] border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-neutral-900"
      />

      {/* Category */}
      <FilterRow
        label="类目"
        options={categories}
        active={active.category}
        onChange={v => set('category', v)}
        counts={counts}
      />

      {/* Country */}
      <FilterRow
        label="国家"
        options={countries}
        active={active.country}
        onChange={v => set('country', v)}
      />

      {/* Price Range */}
      {priceRanges.length > 0 && (
        <FilterRow
          label="价格段"
          options={priceRanges}
          active={active.priceRange}
          onChange={v => set('priceRange', v)}
        />
      )}

      {/* Style */}
      {styles.length > 0 && (
        <FilterRow
          label="风格"
          options={styles}
          active={active.style}
          onChange={v => set('style', v)}
        />
      )}
    </div>
  )
}
