import type { StatsData } from '@/types/dashboard'

interface Props { stats: StatsData }

export function StatsFooter({ stats }: Props) {
  return (
    <div className="mt-16 pt-8 border-t border-gray-100/60">
      <p className="text-xs font-light text-gray-400 tracking-wide text-center">
        知识库共{' '}
        <span className="text-blue-600 font-normal text-sm">{stats.totalDocs}</span>{' '}
        篇文档，已解析{' '}
        <span className="text-blue-600 font-normal text-sm">{stats.aiParsed}</span>{' '}
        篇，
        <span className="text-blue-600 font-normal text-sm">{(stats as any).totalSpaces || 0}</span>{' '}
        个知识空间，覆盖{' '}
        <span className="text-blue-600 font-normal text-sm">{(stats as any).totalDepts || 0}</span>{' '}
        个部门
      </p>
    </div>
  )
}
