'use client'

import { cn } from '@/lib/utils'
import type { TabDef } from '@/types/policy-layout'

interface TabsProps {
  tabs: TabDef[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeId, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto pb-1', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          disabled={tab.id === activeId}
          className={cn(
            'min-h-[44px] px-4 py-2 text-[0.82rem] font-medium rounded-lg border transition-colors shrink-0',
            tab.id === activeId
              ? 'bg-[#2563EB] text-white border-[#2563EB]'
              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[0.7rem] opacity-70">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
