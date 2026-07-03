import { cn } from '@/lib/utils'

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
}

interface TagGroupProps {
  tags: string[]
  color?: 'blue' | 'amber' | 'emerald' | 'neutral' | 'purple' | 'rose'
  className?: string
}

export function TagGroup({ tags, color = 'neutral', className }: TagGroupProps) {
  if (tags.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.filter(Boolean).map((tag, i) => (
        <span
          key={i}
          className={cn(
            'text-[0.68rem] px-2 py-0.5 rounded-full border font-medium',
            COLOR_MAP[color] || COLOR_MAP.neutral
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
