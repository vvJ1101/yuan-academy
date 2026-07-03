'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapseSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
}

export function CollapseSection({
  title,
  defaultExpanded = false,
  children,
  className,
}: CollapseSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={cn('border border-neutral-200 rounded-xl overflow-hidden', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50/50 hover:bg-neutral-100 transition-colors min-h-[44px]"
      >
        <span className="text-[0.82rem] font-medium text-neutral-800">{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={cn(
            'text-neutral-400 transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
